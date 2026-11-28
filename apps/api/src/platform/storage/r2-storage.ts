import { ProblemError } from '../errors';
import { withOutboundTimeout } from '../outbound';
import {
  assertExpiry,
  assertObjectKey,
  assertUploadDeclaration,
  DEFAULT_DOWNLOAD_URL_SECONDS,
  DEFAULT_UPLOAD_URL_SECONDS,
  type Bucket,
  type ObjectRef,
  type ObjectStorage,
} from './port';
import {
  objectPath,
  presignUrl,
  SIGV4_MAX_EXPIRES_SECONDS,
  signRequest,
  type SigningCredentials,
} from './sigv4';

/**
 * **Recommendation** (GAP-MOD00-38): the timeout of a server-side storage call, until a
 * `vendors.r2.timeout_ms` config key exists (GAP-STD16-02 proposes 5000 ms as the default).
 */
export const DEFAULT_STORAGE_TIMEOUT_MS = 5000;

export interface R2StorageConfig {
  /** `https://<account-id>.r2.cloudflarestorage.com`, or the local stand-in's address. */
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Real bucket name for each logical bucket. */
  buckets: Record<Bucket, string>;
  timeoutMs?: number;
  /** Injected for tests. */
  now?: () => Date;
  fetch?: typeof fetch;
}

/** R2 signs with region `auto`. */
const R2_REGION = 'auto';
const PROVIDER = 'r2';

/** The storage port on R2 through the S3 API (path-style URLs, SigV4). */
export const createR2Storage = (config: R2StorageConfig): ObjectStorage => {
  const endpoint = config.endpoint.replace(/\/+$/, '');
  const credentials: SigningCredentials = {
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    region: R2_REGION,
  };
  const now = config.now ?? (() => new Date());
  const doFetch = config.fetch ?? fetch;
  const timeoutMs = config.timeoutMs ?? DEFAULT_STORAGE_TIMEOUT_MS;
  const bucketName = (bucket: Bucket) => config.buckets[bucket];

  const call = (
    method: 'HEAD' | 'PUT' | 'DELETE',
    ref: ObjectRef,
    headers?: Record<string, string>,
  ) => {
    assertObjectKey(ref.key);
    const url = new URL(objectPath(bucketName(ref.bucket), ref.key), `${endpoint}/`);
    return withOutboundTimeout({ provider: PROVIDER, timeoutMs }, async (signal) => {
      const signed = signRequest(credentials, { method, url, headers, now: now() });
      const res = await doFetch(url, { method, headers: signed, signal });
      // Read the body inside the timeout; HEAD has none.
      const body = method === 'HEAD' ? '' : await res.text();
      return { res, body };
    });
  };

  const failed = (operation: string, status: number) =>
    new ProblemError('provider_error', { detail: `${PROVIDER} ${operation} answered ${status}` });

  return {
    presignUpload: (declaration, options = {}) => {
      assertUploadDeclaration(declaration);
      const expiresInSeconds = options.expiresInSeconds ?? DEFAULT_UPLOAD_URL_SECONDS;
      assertExpiry(expiresInSeconds, SIGV4_MAX_EXPIRES_SECONDS);
      const issuedAt = now();
      const url = presignUrl(credentials, {
        method: 'PUT',
        endpoint,
        bucket: bucketName('quarantine'),
        key: declaration.key,
        expiresInSeconds,
        now: issuedAt,
        signedHeaders: {
          'content-type': declaration.contentType,
          'content-length': String(declaration.bytes),
        },
      });
      return {
        method: 'PUT',
        url,
        headers: { 'Content-Type': declaration.contentType },
        bytes: declaration.bytes,
        expiresAt: new Date(issuedAt.getTime() + expiresInSeconds * 1000),
      };
    },

    presignDownload: (ref, options = {}) => {
      assertObjectKey(ref.key);
      const expiresInSeconds = options.expiresInSeconds ?? DEFAULT_DOWNLOAD_URL_SECONDS;
      assertExpiry(expiresInSeconds, SIGV4_MAX_EXPIRES_SECONDS);
      const issuedAt = now();
      const url = presignUrl(credentials, {
        method: 'GET',
        endpoint,
        bucket: bucketName(ref.bucket),
        key: ref.key,
        expiresInSeconds,
        now: issuedAt,
      });
      return { url, expiresAt: new Date(issuedAt.getTime() + expiresInSeconds * 1000) };
    },

    head: async (ref) => {
      const { res } = await call('HEAD', ref);
      if (res.status === 404) return null;
      if (!res.ok) throw failed('head', res.status);
      const bytes = Number(res.headers.get('content-length'));
      if (!Number.isInteger(bytes) || bytes < 0) throw failed('head', res.status);
      return {
        bytes,
        contentType: res.headers.get('content-type') ?? '',
        etag: res.headers.get('etag') ?? '',
      };
    },

    copy: async (from, to) => {
      assertObjectKey(from.key);
      const { res, body } = await call('PUT', to, {
        'x-amz-copy-source': objectPath(bucketName(from.bucket), from.key),
      });
      if (res.status === 404) {
        throw new ProblemError('not_found', { detail: 'copy source not found' });
      }
      // The S3 API can answer a copy with 200 and an error document.
      if (!res.ok || body.includes('<Error>')) throw failed('copy', res.status);
    },

    delete: async (ref) => {
      const { res } = await call('DELETE', ref);
      if (!res.ok && res.status !== 404) throw failed('delete', res.status);
    },
  };
};

/** The settings `createR2Storage` needs, from the validated environment. */
export interface R2Env {
  R2_ACCOUNT_ID: string;
  R2_ENDPOINT: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET_QUARANTINE: string;
  R2_BUCKET_ORIGINALS: string;
  R2_BUCKET_VARIANTS: string;
  R2_BUCKET_EXPORTS: string;
  R2_BUCKET_BACKUPS: string;
}

/**
 * Builds the R2 configuration, or throws naming every missing setting (never a value). The
 * endpoint is `R2_ENDPOINT` when set, else the account endpoint from `R2_ACCOUNT_ID`.
 */
export const r2ConfigFromEnv = (env: R2Env): R2StorageConfig => {
  const missing: string[] = [];
  if (!env.R2_ENDPOINT && !env.R2_ACCOUNT_ID) missing.push('R2_ACCOUNT_ID');
  if (!env.R2_ACCESS_KEY_ID) missing.push('R2_ACCESS_KEY_ID');
  if (!env.R2_SECRET_ACCESS_KEY) missing.push('R2_SECRET_ACCESS_KEY');
  if (missing.length > 0) {
    throw new Error(`storage is not configured: set ${missing.join(', ')} (see .env.example)`);
  }
  return {
    endpoint: env.R2_ENDPOINT || `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    buckets: {
      quarantine: env.R2_BUCKET_QUARANTINE,
      originals: env.R2_BUCKET_ORIGINALS,
      variants: env.R2_BUCKET_VARIANTS,
      exports: env.R2_BUCKET_EXPORTS,
      backups: env.R2_BUCKET_BACKUPS,
    },
  };
};
