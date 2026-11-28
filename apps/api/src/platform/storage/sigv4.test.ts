import { afterAll, describe, expect, test } from 'bun:test';
import { startLocalS3 } from './local-s3';
import { canonicalRequest, objectPath, presignUrl, signatureFor, uriEncode } from './sigv4';

// The signer is checked against two references it shares no code with: Bun's own S3 presigner
// and the presigned-URL example published by AWS. The local stand-in's verifier is checked
// against Bun's own signed requests.

const credentials = {
  accessKeyId: 'AKIDEXAMPLE',
  secretAccessKey: 'test-secret-not-real',
  region: 'auto',
};
const endpoint = 'https://example-account.r2.cloudflarestorage.com';

const bunPresign = (key: string, method: 'GET' | 'PUT') =>
  new URL(
    new Bun.S3Client({ ...credentials, bucket: 'media-quarantine', endpoint }).presign(key, {
      method,
      expiresIn: 900,
    }),
  );

const amzDateToDate = (amzDate: string) =>
  new Date(amzDate.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, '$1-$2-$3T$4:$5:$6Z'));

describe('presignUrl', () => {
  for (const method of ['GET', 'PUT'] as const) {
    for (const key of ['u/0193/photo.jpg', 'a b/ü(1)*.png']) {
      test(`matches Bun's presigner for ${method} ${key}`, () => {
        const reference = bunPresign(key, method);
        const amzDate = reference.searchParams.get('X-Amz-Date')!;
        const ours = new URL(
          presignUrl(credentials, {
            method,
            endpoint,
            bucket: 'media-quarantine',
            key,
            expiresInSeconds: 900,
            now: amzDateToDate(amzDate),
          }),
        );
        expect(ours.pathname).toBe(reference.pathname);
        expect(ours.searchParams.get('X-Amz-Credential')).toBe(
          reference.searchParams.get('X-Amz-Credential'),
        );
        expect(ours.searchParams.get('X-Amz-Signature')).toBe(
          reference.searchParams.get('X-Amz-Signature'),
        );
      });
    }
  }

  test('signs content-type and content-length when they are declared', () => {
    const url = new URL(
      presignUrl(credentials, {
        method: 'PUT',
        endpoint,
        bucket: 'media-quarantine',
        key: 'k.jpg',
        expiresInSeconds: 60,
        now: new Date('2026-11-28T12:00:00Z'),
        signedHeaders: { 'content-type': 'image/jpeg', 'content-length': '1024' },
      }),
    );
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('content-length;content-type;host');
    expect(url.searchParams.get('X-Amz-Date')).toBe('20261128T120000Z');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('60');
  });
});

test('reproduces the AWS presigned-URL example signature', () => {
  // "Authenticating Requests: Using Query Parameters (AWS Signature Version 4)", Amazon S3 API
  // reference: GET /test.txt on examplebucket, 24 hours, with AWS's published example keys.
  const example = {
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    region: 'us-east-1',
  };
  const { text } = canonicalRequest({
    method: 'GET',
    path: '/test.txt',
    query: {
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': 'AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request',
      'X-Amz-Date': '20130524T000000Z',
      'X-Amz-Expires': '86400',
      'X-Amz-SignedHeaders': 'host',
    },
    headers: { host: 'examplebucket.s3.amazonaws.com' },
    payloadHash: 'UNSIGNED-PAYLOAD',
  });
  expect(signatureFor(example, '20130524T000000Z', text)).toBe(
    'aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404',
  );
});

test('encodes keys the way SigV4 wants', () => {
  expect(uriEncode("a!'()*~-._")).toBe('a%21%27%28%29%2A~-._');
  expect(objectPath('b', 'x y/z+1.jpg')).toBe('/b/x%20y/z%2B1.jpg');
});

describe('local stand-in', () => {
  const local = startLocalS3();
  afterAll(() => local.stop());

  test("accepts Bun's own signed write and stat, and refuses a wrong secret", async () => {
    const client = new Bun.S3Client({
      ...local.credentials,
      region: 'auto',
      bucket: 'media-quarantine',
      endpoint: local.endpoint,
    });
    await client.write('bun/hello.txt', 'hello', { type: 'text/plain' });
    expect(local.objects.get('media-quarantine/bun/hello.txt')?.contentType).toStartWith(
      'text/plain',
    );
    const stat = await client.stat('bun/hello.txt');
    expect(stat.size).toBe(5);

    const wrong = new Bun.S3Client({
      accessKeyId: local.credentials.accessKeyId,
      secretAccessKey: 'not-the-secret',
      region: 'auto',
      bucket: 'media-quarantine',
      endpoint: local.endpoint,
    });
    await expect(wrong.write('bun/other.txt', 'x')).rejects.toThrow();
    expect(local.objects.has('media-quarantine/bun/other.txt')).toBe(false);
  });
});
