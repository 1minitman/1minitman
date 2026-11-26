import { createRoute, z } from '@hono/zod-openapi';
import { describe, expect, test } from 'bun:test';
import { ProblemError } from '../errors';
import { requestContext } from '../http/middleware';
import { errorHandler } from '../http/problem';
import { createRouter } from '../http/router';
import { createLogger } from '../logger';
import {
  createMemoryIdempotencyStore,
  idempotent,
  IDEMPOTENCY_LEASE_MS,
  IDEMPOTENCY_TTL_MS,
  type IdempotencyStore,
  type IdempotentOptions,
} from './index';

// MOD-00 plan rule 6: a replayed Idempotency-Key never executes the handler twice. Unit tests with
// the in-memory store; the Redis store and 50 parallel hits are in idempotency.integration.test.ts.

const KEY = '0193b1f4-7c2a-4d3e-8f00-000000000001';
const OTHER_KEY = '0193b1f4-7c2a-4d3e-8f00-000000000002';

interface Harness {
  app: ReturnType<typeof createRouter>;
  calls: { count: number };
  store: IdempotencyStore;
}

/**
 * POST /things creates a thing (201 with Location and ETag); behaviour can be steered by the body:
 * `{ fail: 'crash' }` throws (500), `{ fail: 'gone' }` is 409 `nothing_to_undo` (retry `never`),
 * `{ fail: 'limited' }` is 429-like `backoff`, `{ wait: true }` blocks until `release()`.
 */
const harness = (
  store: IdempotencyStore = createMemoryIdempotencyStore(),
  options: IdempotentOptions = {},
): Harness & { release: () => void } => {
  const calls = { count: 0 };
  let release = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  const app = createRouter();
  app.use('*', requestContext(createLogger('error')));
  app.onError(errorHandler);
  // Stand-in for requireMember(): the principal is part of the fingerprint.
  app.use('*', async (c, next) => {
    const member = c.req.header('x-test-member');
    if (member) c.set('member', { memberId: member, sessionId: member });
    await next();
  });
  app.post('/things', idempotent(store, options), async (c) => {
    calls.count += 1;
    const body = await c.req.json<{ name?: string; fail?: string; wait?: boolean }>();
    if (body.wait) await gate;
    if (body.fail === 'crash') throw new Error('boom');
    if (body.fail === 'gone') throw new ProblemError('nothing_to_undo');
    if (body.fail === 'limited') throw new ProblemError('idempotency_in_progress');
    if (body.fail === 'invalid') {
      throw new ProblemError('validation', {
        errors: [{ path: 'name', code: 'required', message: 'Required' }],
      });
    }
    c.header('Location', `/things/${calls.count}`);
    c.header('ETag', '"1"');
    c.header('RateLimit-Remaining', String(10 - calls.count));
    c.header('Access-Control-Allow-Origin', 'https://one.example');
    return c.json({ id: calls.count, name: body.name }, 201);
  });
  app.post('/other', idempotent(store), (c) => {
    calls.count += 1;
    return c.body(null, 204);
  });
  app.post('/optional', idempotent(store, { required: false }), (c) => {
    calls.count += 1;
    return c.json({ n: calls.count });
  });
  return { app, calls, store, release: () => release() };
};

const post = (
  h: { app: Harness['app'] },
  body: unknown,
  key: string | null = KEY,
  extra: Record<string, string> = {},
  path = '/things',
) =>
  h.app.request(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(key === null ? {} : { 'Idempotency-Key': key }),
      ...extra,
    },
    body: JSON.stringify(body),
  });

const reason = async (res: Response) => ((await res.json()) as { reason: string }).reason;

describe('idempotent()', () => {
  test('a replay returns the stored response and never runs the handler again', async () => {
    const h = harness();
    const first = await post(h, { name: 'a' });
    expect(first.status).toBe(201);
    const replay = await post(h, { name: 'a' });
    expect(h.calls.count).toBe(1);
    expect(replay.status).toBe(201);
    expect(await replay.json()).toEqual(await first.json());
    expect(replay.headers.get('Location')).toBe('/things/1');
    expect(replay.headers.get('ETag')).toBe('"1"');
    expect(replay.headers.get('Content-Type')).toStartWith('application/json');
    // Per-exchange headers are not replayed; the replay has its own request id.
    expect(replay.headers.get('RateLimit-Remaining')).toBeNull();
    expect(replay.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(replay.headers.get('X-Request-Id')).not.toBe(first.headers.get('X-Request-Id'));
  });

  test('the same key with a different body is 409 idempotency_key_reused', async () => {
    const h = harness();
    await post(h, { name: 'a' });
    const res = await post(h, { name: 'b' });
    expect(res.status).toBe(409);
    expect(res.headers.get('Content-Type')).toBe('application/problem+json');
    expect(await reason(res)).toBe('idempotency_key_reused');
    expect(h.calls.count).toBe(1);
  });

  test('the same key and body from another member is refused, not answered', async () => {
    const h = harness();
    await post(h, { name: 'a' }, KEY, { 'x-test-member': 'member-1' });
    const res = await post(h, { name: 'a' }, KEY, { 'x-test-member': 'member-2' });
    expect(res.status).toBe(409);
    expect(await reason(res)).toBe('idempotency_key_reused');
    expect(h.calls.count).toBe(1);
  });

  test('a key is scoped to its route', async () => {
    const h = harness();
    await post(h, { name: 'a' });
    const other = await post(h, {}, KEY, {}, '/other');
    expect(other.status).toBe(204);
    expect(h.calls.count).toBe(2);
  });

  test('a replay while the first request runs is 409 idempotency_in_progress', async () => {
    const h = harness();
    const first = post(h, { wait: true, name: 'a' });
    await Bun.sleep(5);
    const second = await post(h, { wait: true, name: 'a' });
    expect(second.status).toBe(409);
    expect(await reason(second)).toBe('idempotency_in_progress');
    h.release();
    expect((await first).status).toBe(201);
    expect(h.calls.count).toBe(1);
    // Once finished, the same request replays the stored response.
    expect((await post(h, { wait: true, name: 'a' })).status).toBe(201);
    expect(h.calls.count).toBe(1);
  });

  test('a required key that is missing is 400 idempotency_key_required', async () => {
    const h = harness();
    const res = await post(h, { name: 'a' }, null);
    expect(res.status).toBe(400);
    expect(await reason(res)).toBe('idempotency_key_required');
    expect(h.calls.count).toBe(0);
  });

  test.each([
    ['not a UUID', 'abc'],
    ['empty', ''],
    ['oversized', `${KEY}${'0'.repeat(200)}`],
    ['UUID with spaces', ` ${KEY}x`],
  ])('a malformed key (%s) is 400 and the handler never runs', async (_, key) => {
    const h = harness();
    const res = await post(h, { name: 'a' }, key);
    expect(res.status).toBe(400);
    expect(await reason(res)).toBe('idempotency_key_required');
    expect(h.calls.count).toBe(0);
  });

  test('the same key and body with another query string is 409 idempotency_key_reused', async () => {
    const h = harness();
    expect((await post(h, { name: 'a' }, KEY, {}, '/things?dry_run=1')).status).toBe(201);
    expect((await post(h, { name: 'a' }, KEY, {}, '/things?dry_run=1')).status).toBe(201);
    const res = await post(h, { name: 'a' }, KEY, {}, '/things');
    expect(res.status).toBe(409);
    expect(await reason(res)).toBe('idempotency_key_reused');
    expect(h.calls.count).toBe(1);
  });

  test('a stored 204 replays with no body', async () => {
    const h = harness();
    expect((await post(h, {}, KEY, {}, '/other')).status).toBe(204);
    const replay = await post(h, {}, KEY, {}, '/other');
    expect(replay.status).toBe(204);
    expect(await replay.text()).toBe('');
    expect(h.calls.count).toBe(1);
  });

  test('upper- and lower-case spellings of one key are the same key', async () => {
    const h = harness();
    await post(h, { name: 'a' }, KEY.toUpperCase());
    await post(h, { name: 'a' }, KEY);
    expect(h.calls.count).toBe(1);
  });

  test('an optional key: no header runs every time; a sent key is honoured', async () => {
    const h = harness();
    await post(h, {}, null, {}, '/optional');
    await post(h, {}, null, {}, '/optional');
    expect(h.calls.count).toBe(2);
    await post(h, {}, OTHER_KEY, {}, '/optional');
    const replay = await post(h, {}, OTHER_KEY, {}, '/optional');
    expect(await replay.json()).toEqual({ n: 3 });
    expect(h.calls.count).toBe(3);
  });

  test('a 5xx is not stored: the retry with the same key runs the handler', async () => {
    const h = harness();
    const crash = await post(h, { fail: 'crash' });
    expect(crash.status).toBe(500);
    const retry = await post(h, { fail: 'crash' });
    expect(retry.status).toBe(500);
    expect(h.calls.count).toBe(2);
  });

  test('a validation problem frees the key, so the corrected request can use it', async () => {
    const h = harness();
    expect((await post(h, { fail: 'invalid' })).status).toBe(422);
    const corrected = await post(h, { name: 'a' });
    expect(corrected.status).toBe(201);
    expect(h.calls.count).toBe(2);
  });

  test('a backoff problem frees the key', async () => {
    const h = harness();
    expect((await post(h, { fail: 'limited' })).status).toBe(409);
    await post(h, { fail: 'limited' });
    expect(h.calls.count).toBe(2);
  });

  test('a final problem (retry never) is stored and replayed', async () => {
    const h = harness();
    const first = await post(h, { fail: 'gone' });
    expect(first.status).toBe(409);
    const replay = await post(h, { fail: 'gone' });
    expect(replay.status).toBe(409);
    expect(replay.headers.get('Content-Type')).toBe('application/problem+json');
    expect(await reason(replay)).toBe('nothing_to_undo');
    expect(h.calls.count).toBe(1);
  });

  test('a stored response expires after the TTL', async () => {
    let now = 0;
    const h = harness(createMemoryIdempotencyStore(() => now));
    await post(h, { name: 'a' });
    now += IDEMPOTENCY_TTL_MS - 1;
    await post(h, { name: 'a' });
    expect(h.calls.count).toBe(1);
    now += 1;
    await post(h, { name: 'a' });
    expect(h.calls.count).toBe(2);
  });

  test('a lease left by a crashed instance lapses', async () => {
    let now = 0;
    const store = createMemoryIdempotencyStore(() => now);
    const h = harness(store);
    await store.begin(`idem:POST /things:${KEY}`, 'someone-else', 'crashed', IDEMPOTENCY_LEASE_MS);
    expect((await post(h, { name: 'a' })).status).toBe(409);
    now += IDEMPOTENCY_LEASE_MS;
    expect((await post(h, { name: 'a' })).status).toBe(201);
  });

  test('if the store cannot answer: 503 dependency_unavailable and the handler never runs', async () => {
    const failing: IdempotencyStore = {
      begin: () => Promise.reject(new Error('connection refused')),
      complete: () => Promise.resolve(true),
      release: () => Promise.resolve(),
    };
    const h = harness(failing);
    const res = await post(h, { name: 'a' });
    expect(res.status).toBe(503);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.reason).toBe('dependency_unavailable');
    expect(JSON.stringify(body)).not.toContain('connection refused');
    expect(h.calls.count).toBe(0);
  });

  test('a lease that lapsed and was claimed again: the late response stands but is not stored', async () => {
    let now = 0;
    const store = createMemoryIdempotencyStore(() => now);
    const h = harness(store);
    const slow = post(h, { wait: true, name: 'a' });
    await Bun.sleep(5);
    now += IDEMPOTENCY_LEASE_MS;
    // The lease lapsed: a retry claims the key and runs (the second run waits on the same gate).
    const retry = post(h, { wait: true, name: 'a' });
    await Bun.sleep(5);
    h.release();
    const [first, second] = await Promise.all([slow, retry]);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(h.calls.count).toBe(2);
    // The retry owns the key, so its response is the one kept for replay.
    const replay = await post(h, { wait: true, name: 'a' });
    expect(await replay.json()).toEqual(await second.json());
    expect(h.calls.count).toBe(2);
  });

  test('if storing the response fails, the response still stands', async () => {
    const base = createMemoryIdempotencyStore();
    const h = harness({ ...base, complete: () => Promise.reject(new Error('lost')) });
    const res = await post(h, { name: 'a' });
    expect(res.status).toBe(201);
  });

  test('works with an OpenAPI route: the validator reads the body after the fingerprint', async () => {
    const store = createMemoryIdempotencyStore();
    let calls = 0;
    const app = createRouter();
    app.use('*', requestContext(createLogger('error')));
    app.onError(errorHandler);
    app.openapi(
      createRoute({
        method: 'post',
        path: '/items/{id}',
        middleware: [idempotent(store)] as const,
        request: {
          params: z.object({ id: z.string() }),
          body: { content: { 'application/json': { schema: z.object({ name: z.string() }) } } },
        },
        responses: { 200: { description: 'ok' } },
      }),
      (c) => {
        calls += 1;
        return c.json({ id: c.req.valid('param').id, name: c.req.valid('json').name }, 200);
      },
    );
    const send = (id: string, body: unknown) =>
      app.request(`/items/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': KEY },
        body: JSON.stringify(body),
      });
    expect(await (await send('1', { name: 'a' })).json()).toEqual({ id: '1', name: 'a' });
    expect(await (await send('1', { name: 'a' })).json()).toEqual({ id: '1', name: 'a' });
    expect(calls).toBe(1);
    // Same route pattern, another resource: the same key is a different request.
    expect((await send('2', { name: 'a' })).status).toBe(409);
    // Another body with the same key is refused before the validator sees it.
    expect((await send('1', { name: 5 })).status).toBe(409);
  });
});
