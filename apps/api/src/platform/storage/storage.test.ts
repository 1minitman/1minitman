import { afterAll, beforeEach, describe, expect, test } from 'bun:test';
import { ProblemError } from '../errors';
import { OutboundTimeoutError } from '../outbound';
import { startLocalS3 } from './local-s3';
import {
  DEFAULT_DOWNLOAD_URL_SECONDS,
  DEFAULT_UPLOAD_URL_SECONDS,
  MAX_UPLOAD_BYTES,
  verifyUpload,
  type UploadDeclaration,
} from './port';
import { createR2Storage, r2ConfigFromEnv, type R2Env } from './r2-storage';

// MOD-00-API-06, definition of done: "A presigned PUT accepts only the declared type and size".
// The R2 adapter runs against the local stand-in, which checks SigV4 as the store does.

let clock = new Date('2026-11-28T12:00:00Z');
const local = startLocalS3({ now: () => clock });
afterAll(() => local.stop());

const buckets = {
  quarantine: 'media-quarantine',
  originals: 'media-originals',
  variants: 'media-variants',
  exports: 'exports',
  backups: 'backups',
};
const storage = createR2Storage({
  endpoint: local.endpoint,
  ...local.credentials,
  buckets,
  now: () => clock,
});

const jpeg = (bytes: number) => new Uint8Array(bytes).fill(0xff);
const declared: UploadDeclaration = {
  key: 'u/0193/m/1.jpg',
  contentType: 'image/jpeg',
  bytes: 2048,
};

const put = (url: string, body: Uint8Array, headers: Record<string, string>) =>
  fetch(url, { method: 'PUT', body, headers });

beforeEach(() => {
  local.objects.clear();
  clock = new Date('2026-11-28T12:00:00Z');
});

describe('presigned PUT (definition of done)', () => {
  test('accepts the declared type and size', async () => {
    const upload = storage.presignUpload(declared);
    const res = await put(upload.url, jpeg(2048), upload.headers);
    expect(res.status).toBe(200);
    const stored = local.objects.get(`media-quarantine/${declared.key}`);
    expect(stored?.contentType).toBe('image/jpeg');
    expect(stored?.body.byteLength).toBe(2048);
  });

  test('refuses another type', async () => {
    const upload = storage.presignUpload(declared);
    const res = await put(upload.url, jpeg(2048), { 'Content-Type': 'image/png' });
    expect(res.status).toBe(403);
    expect(await res.text()).toContain('SignatureDoesNotMatch');
    expect(local.objects.size).toBe(0);
  });

  test('refuses a missing type', async () => {
    const upload = storage.presignUpload(declared);
    const res = await fetch(upload.url, { method: 'PUT', body: new Blob([jpeg(2048)]) });
    expect(res.status).toBe(403);
    expect(local.objects.size).toBe(0);
  });

  test('refuses a larger body', async () => {
    const upload = storage.presignUpload(declared);
    const res = await put(upload.url, jpeg(2049), upload.headers);
    expect(res.status).toBe(403);
    expect(local.objects.size).toBe(0);
  });

  test('refuses a smaller body', async () => {
    const upload = storage.presignUpload(declared);
    const res = await put(upload.url, jpeg(2047), upload.headers);
    expect(res.status).toBe(403);
    expect(local.objects.size).toBe(0);
  });

  test('refuses another key than the one signed', async () => {
    const upload = storage.presignUpload(declared);
    const res = await put(upload.url.replace('/1.jpg', '/2.jpg'), jpeg(2048), upload.headers);
    expect(res.status).toBe(403);
    expect(local.objects.size).toBe(0);
  });

  test('refuses an expired URL and accepts up to its last second', async () => {
    const upload = storage.presignUpload(declared, { expiresInSeconds: 60 });
    expect(upload.expiresAt.toISOString()).toBe('2026-11-28T12:01:00.000Z');
    clock = new Date('2026-11-28T12:01:00Z');
    expect((await put(upload.url, jpeg(2048), upload.headers)).status).toBe(200);
    clock = new Date('2026-11-28T12:01:01Z');
    expect((await put(upload.url, jpeg(2048), upload.headers)).status).toBe(403);
  });

  test('always targets quarantine, with the Recommendation life by default', () => {
    const upload = storage.presignUpload(declared);
    expect(new URL(upload.url).pathname).toBe(`/media-quarantine/${declared.key}`);
    expect(upload.method).toBe('PUT');
    expect(upload.bytes).toBe(2048);
    expect(upload.expiresAt.getTime() - clock.getTime()).toBe(DEFAULT_UPLOAD_URL_SECONDS * 1000);
  });
});

describe('presignUpload refuses a bad declaration before signing', () => {
  const problem = (fn: () => unknown) => {
    try {
      fn();
    } catch (error) {
      return error instanceof ProblemError ? error.code : 'other';
    }
    return 'none';
  };

  test.each(['', 'image', 'IMAGE/JPEG', 'image/jpeg; charset=x', 'image/ jpeg', 'image/jpeg\n'])(
    'type %p is 415 unsupported_media_type',
    (contentType) => {
      expect(problem(() => storage.presignUpload({ ...declared, contentType }))).toBe(
        'unsupported_media_type',
      );
    },
  );

  test.each([0, -1, 1.5, Number.NaN, MAX_UPLOAD_BYTES + 1])(
    'size %p is 413 payload_too_large',
    (bytes) => {
      expect(problem(() => storage.presignUpload({ ...declared, bytes }))).toBe(
        'payload_too_large',
      );
    },
  );

  test('the schema maximum is allowed', () => {
    expect(storage.presignUpload({ ...declared, bytes: MAX_UPLOAD_BYTES }).bytes).toBe(
      MAX_UPLOAD_BYTES,
    );
  });

  test.each(['', '/a.jpg', 'a//b.jpg', 'a/../b.jpg', './a.jpg', 'a\u0000.jpg', 'a\\b.jpg'])(
    'key %p is refused',
    (key) => {
      expect(() => storage.presignUpload({ ...declared, key })).toThrow('invalid object key');
    },
  );

  test.each([0, -5, 1.5, 604_801])('a life of %p seconds is refused', (expiresInSeconds) => {
    expect(() => storage.presignUpload(declared, { expiresInSeconds })).toThrow(/presigned URL/);
  });
});

describe('presigned GET', () => {
  test('downloads the object for 5 minutes by default', async () => {
    local.seed('media-variants', 'v/1.webp', jpeg(10), 'image/webp');
    const download = storage.presignDownload({ bucket: 'variants', key: 'v/1.webp' });
    expect(download.expiresAt.getTime() - clock.getTime()).toBe(
      DEFAULT_DOWNLOAD_URL_SECONDS * 1000,
    );
    const res = await fetch(download.url);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/webp');
    expect((await res.arrayBuffer()).byteLength).toBe(10);
  });

  test('cannot be turned into an upload', async () => {
    const download = storage.presignDownload({ bucket: 'variants', key: 'v/1.webp' });
    expect((await put(download.url, jpeg(1), {})).status).toBe(403);
  });
});

describe('server-side calls', () => {
  test('head reads the real size and type, null when missing', async () => {
    local.seed('media-quarantine', 'a.jpg', jpeg(7), 'image/jpeg');
    expect(await storage.head({ bucket: 'quarantine', key: 'a.jpg' })).toMatchObject({
      bytes: 7,
      contentType: 'image/jpeg',
    });
    expect(await storage.head({ bucket: 'quarantine', key: 'none.jpg' })).toBeNull();
  });

  test('copy moves bytes between buckets without the API reading them', async () => {
    local.seed('media-quarantine', 'q/a b.jpg', jpeg(9), 'image/jpeg');
    await storage.copy(
      { bucket: 'quarantine', key: 'q/a b.jpg' },
      { bucket: 'originals', key: 'o/a b.jpg' },
    );
    expect(local.objects.get('media-originals/o/a b.jpg')?.body.byteLength).toBe(9);
  });

  test('copy of a missing object is not_found', async () => {
    await expect(
      storage.copy({ bucket: 'quarantine', key: 'gone' }, { bucket: 'originals', key: 'x' }),
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  test('delete removes the object and a missing one is fine', async () => {
    local.seed('media-quarantine', 'd.jpg', jpeg(1), 'image/jpeg');
    await storage.delete({ bucket: 'quarantine', key: 'd.jpg' });
    expect(local.objects.size).toBe(0);
    await storage.delete({ bucket: 'quarantine', key: 'd.jpg' });
  });

  test('a refused call is provider_error and carries no secret', async () => {
    const wrong = createR2Storage({
      endpoint: local.endpoint,
      accessKeyId: local.credentials.accessKeyId,
      secretAccessKey: 'wrong-secret-value',
      buckets,
      now: () => clock,
    });
    const error = await wrong.head({ bucket: 'quarantine', key: 'a.jpg' }).catch((e) => e);
    expect(error).toBeInstanceOf(ProblemError);
    expect(error.code).toBe('provider_error');
    expect(String(error.message)).not.toContain('wrong-secret-value');
  });

  test('a store that does not answer times out with provider_timeout', async () => {
    const hanging = createR2Storage({
      endpoint: local.endpoint,
      ...local.credentials,
      buckets,
      timeoutMs: 20,
      fetch: (() => new Promise(() => {})) as unknown as typeof fetch,
    });
    await expect(hanging.head({ bucket: 'quarantine', key: 'a.jpg' })).rejects.toBeInstanceOf(
      OutboundTimeoutError,
    );
  });
});

describe('verifyUpload (the quarantine hand-off check on complete)', () => {
  test('passes an upload made through the presigned URL', async () => {
    const upload = storage.presignUpload(declared);
    await put(upload.url, jpeg(2048), upload.headers);
    expect(await verifyUpload(storage, declared)).toMatchObject({ ok: true });
  });

  test('reports a missing object', async () => {
    expect(await verifyUpload(storage, declared)).toEqual({ ok: false, reason: 'missing' });
  });

  // Seeded directly: an object that a store let through despite the signed headers.
  test('reports a size that differs from the declaration', async () => {
    local.seed('media-quarantine', declared.key, jpeg(4096), 'image/jpeg');
    expect(await verifyUpload(storage, declared)).toMatchObject({
      ok: false,
      reason: 'size_mismatch',
    });
  });

  test('reports a type that differs from the declaration', async () => {
    local.seed('media-quarantine', declared.key, jpeg(2048), 'text/html');
    expect(await verifyUpload(storage, declared)).toMatchObject({
      ok: false,
      reason: 'type_mismatch',
    });
  });
});

describe('r2ConfigFromEnv', () => {
  const env: R2Env = {
    R2_ACCOUNT_ID: 'example-account',
    R2_ENDPOINT: '',
    R2_ACCESS_KEY_ID: 'key-id-value',
    R2_SECRET_ACCESS_KEY: 'secret-value',
    R2_BUCKET_QUARANTINE: 'media-quarantine',
    R2_BUCKET_ORIGINALS: 'media-originals',
    R2_BUCKET_VARIANTS: 'media-variants',
    R2_BUCKET_EXPORTS: 'exports',
    R2_BUCKET_BACKUPS: 'backups',
  };

  test('derives the account endpoint and maps the five buckets', () => {
    const config = r2ConfigFromEnv(env);
    expect(config.endpoint).toBe('https://example-account.r2.cloudflarestorage.com');
    expect(config.buckets).toEqual(buckets);
  });

  test('prefers R2_ENDPOINT', () => {
    const config = r2ConfigFromEnv({ ...env, R2_ENDPOINT: 'https://other.example.com' });
    expect(config.endpoint).toBe('https://other.example.com');
  });

  test('names every missing setting and never a value', () => {
    const run = () =>
      r2ConfigFromEnv({
        ...env,
        R2_ACCOUNT_ID: '',
        R2_ACCESS_KEY_ID: '',
        R2_SECRET_ACCESS_KEY: '',
      });
    expect(run).toThrow(/R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY/);
    const error = (() => {
      try {
        r2ConfigFromEnv({ ...env, R2_SECRET_ACCESS_KEY: '' });
      } catch (e) {
        return e as Error;
      }
    })();
    expect(error?.message).toContain('R2_SECRET_ACCESS_KEY');
    expect(error?.message).not.toContain('key-id-value');
    expect(error?.message).not.toContain('example-account');
  });
});
