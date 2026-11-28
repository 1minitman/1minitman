import { ProblemError } from '../errors';

/**
 * The storage port (MOD-00 plan section 4.1 behaviour 14, [TR §4.3], [TR §5.3], [TR §13.1]):
 * presigned PUT with type and size limits into `media-quarantine`, short-lived presigned GET,
 * server-side copy and delete. Every bucket is private; the app never holds cloud keys
 * [TR §5.3]. R2 is the adapter (`r2-storage.ts`); tests use the same adapter against the local
 * stand-in (`local-s3.ts`).
 *
 * The port knows no media kinds, plans or per-kind type lists: those are the caller's
 * (`POST /v1/media/upload-url` in MOD-04, `/public/v1/uploads` in MOD-14), which pass the declared
 * type and size in and read their own limits from config.
 */

/** The five private buckets ([TR §4.3]; names from `.env.example`). */
export const BUCKETS = ['quarantine', 'originals', 'variants', 'exports', 'backups'] as const;
export type Bucket = (typeof BUCKETS)[number];

/** The largest object the schema stores: `media_assets.bytes <= 104857600` [SQL]. */
export const MAX_UPLOAD_BYTES = 104_857_600;

/**
 * **Recommendation** (GAP-MOD00-38): no source gives the life of an upload URL. Fifteen minutes
 * covers a 100 MB clip on a slow mobile link; callers pass their config value when one exists.
 */
export const DEFAULT_UPLOAD_URL_SECONDS = 900;
/** Short-lived download: at most 5 minutes for the console [ADM A01]. */
export const DEFAULT_DOWNLOAD_URL_SECONDS = 300;

/** `type/subtype`, lower case, no parameters: the form `media_assets.mime_type` checks [SQL]. */
const MIME_TYPE = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/;
/** S3 and R2 keys are at most 1024 bytes of UTF-8. */
const MAX_KEY_BYTES = 1024;

export interface UploadDeclaration {
  /** The object key in `media-quarantine`; the caller chooses it (MOD-04 owns the layout). */
  key: string;
  /** The declared media type; the upload must send exactly this `Content-Type`. */
  contentType: string;
  /** The declared size in bytes; the upload must send exactly this `Content-Length`. */
  bytes: number;
}

export interface PresignedUpload {
  method: 'PUT';
  url: string;
  /**
   * Headers the uploader sends unchanged. `Content-Length` is signed too but is not listed: the
   * HTTP client sets it from the body (browsers refuse to let code set it), and a body of any other
   * size fails the signature.
   */
  headers: Record<string, string>;
  bytes: number;
  expiresAt: Date;
}

export interface PresignedDownload {
  url: string;
  expiresAt: Date;
}

export interface StoredObject {
  bytes: number;
  contentType: string;
  etag: string;
}

export interface ObjectRef {
  bucket: Bucket;
  key: string;
}

export interface ObjectStorage {
  /** A URL that accepts one PUT of exactly the declared type and size into quarantine. */
  presignUpload(
    declaration: UploadDeclaration,
    options?: { expiresInSeconds?: number },
  ): PresignedUpload;
  /** A short-lived GET. */
  presignDownload(ref: ObjectRef, options?: { expiresInSeconds?: number }): PresignedDownload;
  /** The object's real size and type, or `null` when there is none. */
  head(ref: ObjectRef): Promise<StoredObject | null>;
  /** Server-side copy (quarantine → originals, ...); the bytes never pass through the API. */
  copy(from: ObjectRef, to: ObjectRef): Promise<void>;
  /** Deletes the object; deleting a missing object succeeds. */
  delete(ref: ObjectRef): Promise<void>;
}

const hasControlOrBackslash = (key: string) =>
  [...key].some((char) => {
    const code = char.charCodeAt(0);
    return code < 0x20 || code === 0x7f || char === '\\';
  });

/**
 * Refuses an empty key, a leading slash, `.` or `..` segments, control characters, `\` and text
 * that is not well-formed UTF-16.
 */
export const assertObjectKey = (key: string) => {
  const segments = key.split('/');
  const valid =
    key.length > 0 &&
    // A lone surrogate has no UTF-8 form; `encodeURIComponent` would throw on it while signing.
    !/\p{Surrogate}/u.test(key) &&
    new TextEncoder().encode(key).length <= MAX_KEY_BYTES &&
    !hasControlOrBackslash(key) &&
    segments.every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');
  if (!valid) throw new Error('invalid object key');
};

export const assertExpiry = (seconds: number, max: number) => {
  if (!Number.isInteger(seconds) || seconds <= 0 || seconds > max) {
    throw new Error(`presigned URL life must be a whole number of seconds from 1 to ${max}`);
  }
};

/**
 * Checks a declaration before anything is signed: a well-formed lower-case media type
 * (415 `unsupported_media_type`) and a whole size from 1 byte to `MAX_UPLOAD_BYTES`
 * (413 `payload_too_large`). The caller's own allow-list and plan caps come first.
 */
export const assertUploadDeclaration = (declaration: UploadDeclaration) => {
  assertObjectKey(declaration.key);
  if (!MIME_TYPE.test(declaration.contentType)) {
    throw new ProblemError('unsupported_media_type', { detail: 'declared type is not valid' });
  }
  if (
    !Number.isInteger(declaration.bytes) ||
    declaration.bytes <= 0 ||
    declaration.bytes > MAX_UPLOAD_BYTES
  ) {
    throw new ProblemError('payload_too_large', {
      detail: `declared size must be 1 to ${MAX_UPLOAD_BYTES} bytes`,
      limit: MAX_UPLOAD_BYTES,
    });
  }
};

export type UploadCheck =
  | { ok: true; object: StoredObject }
  | { ok: false; reason: 'missing' }
  | { ok: false; reason: 'size_mismatch' | 'type_mismatch'; object: StoredObject };

/**
 * The quarantine hand-off check, run on `complete` before the media job starts: the object that
 * arrived must have the declared size and type. The signed headers already make the store refuse
 * any other upload; this second check holds even if a store ignored them, and it is the one the
 * caller acts on (delete the object, refuse the completion). It reads metadata only; the
 * magic-byte check against the content is `media.process`'s (MOD-04-WRK-01).
 */
export const verifyUpload = async (
  storage: Pick<ObjectStorage, 'head'>,
  declaration: UploadDeclaration,
): Promise<UploadCheck> => {
  const object = await storage.head({ bucket: 'quarantine', key: declaration.key });
  if (!object) return { ok: false, reason: 'missing' };
  if (object.bytes !== declaration.bytes) return { ok: false, reason: 'size_mismatch', object };
  if (object.contentType.trim().toLowerCase() !== declaration.contentType) {
    return { ok: false, reason: 'type_mismatch', object };
  }
  return { ok: true, object };
};
