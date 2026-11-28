import { createHash } from 'node:crypto';
import {
  canonicalRequest,
  SIGV4_ALGORITHM,
  signatureFor,
  signaturesEqual,
  UNSIGNED_PAYLOAD,
  type SigningCredentials,
} from './sigv4';

/**
 * The local stand-in for R2, for tests only (MOD-00 plan task 12; 1MM-STD-01 section 3.1: vendor
 * adapters run against a local fake HTTP server, never a live vendor). A `Bun.serve` on
 * `127.0.0.1` that keeps objects in memory and speaks the slice of the S3 API the port uses:
 * PUT (presigned or signed), PUT with `x-amz-copy-source`, HEAD, GET and DELETE, path style.
 *
 * It checks SigV4 the way an S3 store does: it rebuilds the canonical request from the headers
 * the caller actually sent, for every name in `SignedHeaders`, and refuses with 403 when the
 * signature differs or the URL has expired. That is what makes a presigned PUT with a different
 * `Content-Type` or `Content-Length` fail. Signature arithmetic is shared with the signer, so it
 * is checked separately against Bun's presigner and the AWS example (`sigv4.test.ts`).
 */

export interface LocalObject {
  body: Uint8Array;
  contentType: string;
  etag: string;
}

export interface LocalS3 {
  endpoint: string;
  credentials: Pick<SigningCredentials, 'accessKeyId' | 'secretAccessKey'>;
  /** `bucket/key` → object, to inspect or seed in tests. */
  objects: Map<string, LocalObject>;
  /** Stores an object without any signature check (an upload a store failed to police). */
  seed(bucket: string, key: string, body: Uint8Array, contentType: string): void;
  stop(): Promise<void>;
}

const xmlError = (status: number, code: string) =>
  new Response(`<?xml version="1.0" encoding="UTF-8"?><Error><Code>${code}</Code></Error>`, {
    status,
    headers: { 'content-type': 'application/xml' },
  });

const etagOf = (body: Uint8Array) => `"${createHash('md5').update(body).digest('hex')}"`;

/** `/bucket/a/b.jpg` → `bucket/a/b.jpg`, decoded. */
const objectId = (pathname: string) =>
  pathname
    .slice(1)
    .split('/')
    .map((segment) => decodeURIComponent(segment))
    .join('/');

const parseAuthorization = (value: string) => {
  const match =
    /^AWS4-HMAC-SHA256 Credential=([^,]+), SignedHeaders=([^,]+), Signature=([0-9a-f]+)$/.exec(
      value,
    );
  return match ? { credential: match[1]!, signedHeaders: match[2]!, signature: match[3]! } : null;
};

export const startLocalS3 = (
  options: { accessKeyId?: string; secretAccessKey?: string; now?: () => Date } = {},
): LocalS3 => {
  const accessKeyId = options.accessKeyId ?? 'local-access-key';
  const secretAccessKey = options.secretAccessKey ?? 'local-secret-key';
  const now = options.now ?? (() => new Date());
  const objects = new Map<string, LocalObject>();

  /** `null` when the request is correctly signed and in date, else the refusal. */
  const refuse = (req: Request, url: URL): Response | null => {
    const query = Object.fromEntries(url.searchParams);
    const presigned = 'X-Amz-Signature' in query;
    const auth = presigned ? null : parseAuthorization(req.headers.get('authorization') ?? '');
    const credential = presigned ? query['X-Amz-Credential'] : auth?.credential;
    const signedHeaders = presigned ? query['X-Amz-SignedHeaders'] : auth?.signedHeaders;
    const given = presigned ? query['X-Amz-Signature'] : auth?.signature;
    const amzDate = presigned ? query['X-Amz-Date'] : req.headers.get('x-amz-date');
    if (!credential || !signedHeaders || !given || !amzDate) {
      return xmlError(403, 'AccessDenied');
    }
    if (presigned && query['X-Amz-Algorithm'] !== SIGV4_ALGORITHM) {
      return xmlError(403, 'AccessDenied');
    }
    const [key, , region] = credential.split('/');
    if (key !== accessKeyId || !region) return xmlError(403, 'InvalidAccessKeyId');

    if (presigned) {
      const issued = Date.parse(
        amzDate.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, '$1-$2-$3T$4:$5:$6Z'),
      );
      const expires = Number(query['X-Amz-Expires']);
      if (!Number.isFinite(issued) || now().getTime() > issued + expires * 1000) {
        return xmlError(403, 'AccessDenied');
      }
    }

    const headers: Record<string, string> = {};
    for (const name of signedHeaders.split(';')) {
      const value = req.headers.get(name);
      // A signed header the caller did not send cannot match.
      if (value === null) return xmlError(403, 'SignatureDoesNotMatch');
      headers[name] = value;
    }
    const signedQuery = { ...query };
    delete signedQuery['X-Amz-Signature'];
    const { text } = canonicalRequest({
      method: req.method,
      path: url.pathname,
      query: signedQuery,
      headers,
      payloadHash: presigned
        ? UNSIGNED_PAYLOAD
        : (req.headers.get('x-amz-content-sha256') ?? UNSIGNED_PAYLOAD),
    });
    const expected = signatureFor({ accessKeyId, secretAccessKey, region }, amzDate, text);
    return signaturesEqual(expected, given) ? null : xmlError(403, 'SignatureDoesNotMatch');
  };

  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch: async (req) => {
      const url = new URL(req.url);
      const refused = refuse(req, url);
      if (refused) return refused;
      const id = objectId(url.pathname);
      const stored = objects.get(id);

      switch (req.method) {
        case 'PUT': {
          const source = req.headers.get('x-amz-copy-source');
          if (source) {
            const from = objects.get(objectId(source));
            if (!from) return xmlError(404, 'NoSuchKey');
            objects.set(id, { ...from });
            return new Response(
              `<?xml version="1.0" encoding="UTF-8"?><CopyObjectResult><ETag>${from.etag}</ETag></CopyObjectResult>`,
              { headers: { 'content-type': 'application/xml' } },
            );
          }
          const body = new Uint8Array(await req.arrayBuffer());
          const etag = etagOf(body);
          objects.set(id, {
            body,
            contentType: req.headers.get('content-type') ?? 'application/octet-stream',
            etag,
          });
          return new Response(null, { headers: { etag } });
        }
        case 'HEAD':
        case 'GET': {
          if (!stored) return xmlError(404, 'NoSuchKey');
          const headers = {
            'content-type': stored.contentType,
            'content-length': String(stored.body.byteLength),
            etag: stored.etag,
          };
          return new Response(req.method === 'GET' ? stored.body : null, { headers });
        }
        case 'DELETE':
          objects.delete(id);
          return new Response(null, { status: 204 });
        default:
          return xmlError(405, 'MethodNotAllowed');
      }
    },
  });

  return {
    endpoint: `http://127.0.0.1:${server.port}`,
    credentials: { accessKeyId, secretAccessKey },
    objects,
    seed: (bucket, key, body, contentType) => {
      objects.set(`${bucket}/${key}`, { body, contentType, etag: etagOf(body) });
    },
    stop: () => server.stop(true),
  };
};
