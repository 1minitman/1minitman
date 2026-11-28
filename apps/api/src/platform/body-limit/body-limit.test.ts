import { describe, expect, test } from 'bun:test';
import { requestContext } from '../http/middleware';
import { errorHandler } from '../http/problem';
import { createRouter } from '../http/router';
import { createLogger } from '../logger';
import { BODY_LIMITS, bodyLimitFor, bodyLimits, MAX_BODY_BYTES } from './body-limit';

const SMALL = { member: 40, admin: 50, public: 10, webhooks: 30, other: 5 };

const appWith = (limits = SMALL) => {
  const app = createRouter();
  app.onError(errorHandler);
  app.use('*', requestContext(createLogger('error')));
  app.use('*', bodyLimits(limits));
  app.post('*', async (c) => c.json({ bytes: (await c.req.arrayBuffer()).byteLength }));
  return app;
};

const post = (body: string | ReadableStream<Uint8Array>, headers: Record<string, string> = {}) => ({
  method: 'POST',
  body,
  headers,
});

/** A body sent chunked, with no Content-Length, as a stream of `chunks` pieces of `size` bytes. */
const chunked = (chunks: number, size: number) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < chunks; i += 1) controller.enqueue(new Uint8Array(size));
      controller.close();
    },
  });

describe('bodyLimitFor', () => {
  test.each([
    ['/v1/me', 'member'],
    ['/v1', 'member'],
    ['/public/v1/forms/contact', 'public'],
    ['/admin/v1/users', 'admin'],
    ['/webhooks/revenuecat', 'webhooks'],
    ['/health', 'other'],
    ['/v10/x', 'other'],
    ['/v1x', 'other'],
  ] as const)('%s falls under %s', (path, name) => {
    expect(bodyLimitFor(path, SMALL)).toBe(SMALL[name]);
  });

  test('the coded limits (Recommendation, GAP-MOD00-37)', () => {
    expect(BODY_LIMITS).toEqual({
      member: 1_048_576,
      admin: 1_048_576,
      public: 65_536,
      webhooks: 1_048_576,
      other: 65_536,
    });
    expect(MAX_BODY_BYTES).toBe(1_048_576);
  });
});

describe('bodyLimits', () => {
  test('a body at the limit is accepted; one byte over is 413 payload_too_large', async () => {
    const app = appWith();
    const at = await app.request('/v1/x', post('a'.repeat(40)));
    expect(at.status).toBe(200);
    expect(await at.json()).toEqual({ bytes: 40 });

    const over = await app.request('/v1/x', post('a'.repeat(41)));
    expect(over.status).toBe(413);
    expect(over.headers.get('content-type')).toContain('application/problem+json');
    expect(await over.json()).toMatchObject({ reason: 'payload_too_large', limit: 40 });
  });

  test('each surface has its own limit', async () => {
    const app = appWith();
    const status = async (path: string, bytes: number) =>
      (await app.request(path, post('a'.repeat(bytes)))).status;
    expect(await status('/public/v1/forms', 10)).toBe(200);
    expect(await status('/public/v1/forms', 11)).toBe(413);
    expect(await status('/admin/v1/pages', 50)).toBe(200);
    expect(await status('/admin/v1/pages', 51)).toBe(413);
    expect(await status('/webhooks/fake', 30)).toBe(200);
    expect(await status('/webhooks/fake', 31)).toBe(413);
    expect(await status('/health', 6)).toBe(413);
  });

  test('a declared Content-Length over the limit is refused before the body is read', async () => {
    const res = await appWith().request(
      '/public/v1/forms',
      post(chunked(1, 4), { 'content-length': '1000000' }),
    );
    expect(res.status).toBe(413);
  });

  test('a chunked body is counted as it streams', async () => {
    const app = appWith();
    expect((await app.request('/v1/x', post(chunked(4, 10)))).status).toBe(200);
    expect((await app.request('/v1/x', post(chunked(5, 10)))).status).toBe(413);
  });

  test('a request without a body passes', async () => {
    const res = await appWith().request('/v1/x', { method: 'POST' });
    expect(res.status).toBe(200);
  });
});
