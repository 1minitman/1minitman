import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

/**
 * AWS Signature Version 4 for the S3 API, which R2 speaks [TR §4.3]. Written here instead of using
 * `Bun.S3Client` because Bun's `presign()` signs the `host` header only (its `type` option becomes
 * `response-content-type`, which shapes a download, not an upload), so a URL it presigns would
 * accept any type and any size. Signing `content-type` and `content-length` as signed headers
 * binds both to the URL: the store recomputes the signature from the headers the uploader sends
 * and refuses the request when either differs. Bun's client also has no server-side copy.
 *
 * Pure functions of their inputs (the clock is passed in), so the tests check them against Bun's
 * own presigner and the published AWS example.
 */

export interface SigningCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  /** `auto` for R2. */
  region: string;
}

export const SIGV4_ALGORITHM = 'AWS4-HMAC-SHA256';
export const UNSIGNED_PAYLOAD = 'UNSIGNED-PAYLOAD';
/** The longest validity SigV4 allows a presigned URL: seven days. */
export const SIGV4_MAX_EXPIRES_SECONDS = 604_800;
const SERVICE = 's3';

export const sha256Hex = (data: string | Uint8Array) =>
  createHash('sha256').update(data).digest('hex');

const hmac = (key: string | Buffer, data: string) =>
  createHmac('sha256', key).update(data).digest();

/** RFC 3986 encoding as SigV4 wants it: only `A-Z a-z 0-9 - . _ ~` stay as they are. */
export const uriEncode = (value: string) =>
  encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );

/** `/bucket/key` with every segment encoded and the slashes kept (S3 path style). */
export const objectPath = (bucket: string, key: string) =>
  `/${uriEncode(bucket)}/${key.split('/').map(uriEncode).join('/')}`;

/** `20261128T120000Z` and `20261128`. */
export const amzDates = (now: Date) => {
  const amzDate = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
  return { amzDate, dateStamp: amzDate.slice(0, 8) };
};

const scopeOf = (dateStamp: string, region: string) =>
  `${dateStamp}/${region}/${SERVICE}/aws4_request`;

const canonicalQuery = (params: Record<string, string>) =>
  Object.keys(params)
    .sort()
    .map((name) => `${uriEncode(name)}=${uriEncode(params[name] ?? '')}`)
    .join('&');

/** Header names lower-cased and sorted; values trimmed with inner runs of spaces folded. */
const canonicalHeaders = (headers: Record<string, string>) => {
  const entries = Object.entries(headers)
    .map(([name, value]) => [name.toLowerCase(), value.trim().replace(/\s+/g, ' ')] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return {
    block: entries.map(([name, value]) => `${name}:${value}\n`).join(''),
    signed: entries.map(([name]) => name).join(';'),
  };
};

export interface CanonicalRequestInput {
  method: string;
  /** Already encoded, as `objectPath()` returns it. */
  path: string;
  query: Record<string, string>;
  /** Every header that is signed, `host` included. */
  headers: Record<string, string>;
  payloadHash: string;
}

export const canonicalRequest = (input: CanonicalRequestInput) => {
  const { block, signed } = canonicalHeaders(input.headers);
  return {
    text: [
      input.method,
      input.path,
      canonicalQuery(input.query),
      block,
      signed,
      input.payloadHash,
    ].join('\n'),
    signedHeaders: signed,
  };
};

export const signatureFor = (
  credentials: SigningCredentials,
  amzDate: string,
  canonical: string,
) => {
  const dateStamp = amzDate.slice(0, 8);
  const stringToSign = [
    SIGV4_ALGORITHM,
    amzDate,
    scopeOf(dateStamp, credentials.region),
    sha256Hex(canonical),
  ].join('\n');
  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${credentials.secretAccessKey}`, dateStamp), credentials.region), SERVICE),
    'aws4_request',
  );
  return createHmac('sha256', signingKey).update(stringToSign).digest('hex');
};

export interface PresignInput {
  method: 'GET' | 'PUT';
  /** `https://<account>.r2.cloudflarestorage.com`, no trailing slash. */
  endpoint: string;
  bucket: string;
  key: string;
  expiresInSeconds: number;
  now: Date;
  /** Headers the caller of the URL must send with exactly these values (`content-type`, ...). */
  signedHeaders?: Record<string, string>;
}

/** A query-string signed URL (the "presigned URL" of the S3 API). */
export const presignUrl = (credentials: SigningCredentials, input: PresignInput) => {
  const url = new URL(objectPath(input.bucket, input.key), `${input.endpoint}/`);
  const { amzDate, dateStamp } = amzDates(input.now);
  const headers = { ...input.signedHeaders, host: url.host };
  const signedHeaderNames = canonicalHeaders(headers).signed;
  const query: Record<string, string> = {
    'X-Amz-Algorithm': SIGV4_ALGORITHM,
    'X-Amz-Credential': `${credentials.accessKeyId}/${scopeOf(dateStamp, credentials.region)}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(input.expiresInSeconds),
    'X-Amz-SignedHeaders': signedHeaderNames,
  };
  const { text } = canonicalRequest({
    method: input.method,
    path: url.pathname,
    query,
    headers,
    payloadHash: UNSIGNED_PAYLOAD,
  });
  const signature = signatureFor(credentials, amzDate, text);
  url.search = `${canonicalQuery(query)}&X-Amz-Signature=${signature}`;
  return url.toString();
};

export interface SignedRequestInput {
  method: 'HEAD' | 'GET' | 'PUT' | 'DELETE';
  url: URL;
  /** Extra headers to sign and send (`x-amz-copy-source`, ...). */
  headers?: Record<string, string>;
  /** The body is empty for every call the port makes server-side. */
  now: Date;
}

/**
 * Headers for a server-side call signed in the `Authorization` header. `host` is signed but not
 * returned: `fetch` sets it from the URL.
 */
export const signRequest = (credentials: SigningCredentials, input: SignedRequestInput) => {
  const { amzDate, dateStamp } = amzDates(input.now);
  const payloadHash = sha256Hex('');
  const sent: Record<string, string> = {
    ...input.headers,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };
  const { text, signedHeaders } = canonicalRequest({
    method: input.method,
    path: input.url.pathname,
    query: Object.fromEntries(input.url.searchParams),
    headers: { ...sent, host: input.url.host },
    payloadHash,
  });
  const signature = signatureFor(credentials, amzDate, text);
  return {
    ...sent,
    authorization: `${SIGV4_ALGORITHM} Credential=${credentials.accessKeyId}/${scopeOf(dateStamp, credentials.region)}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
};

/** Constant-time comparison of two hex signatures. */
export const signaturesEqual = (a: string, b: string) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};
