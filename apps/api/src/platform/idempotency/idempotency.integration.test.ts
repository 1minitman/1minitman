import { RedisClient } from 'bun';
import { afterAll, describe, expect, test } from 'bun:test';
import { requestContext } from '../http/middleware';
import { errorHandler } from '../http/problem';
import { createRouter } from '../http/router';
import { createLogger } from '../logger';
import { createRedisIdempotencyStore, IDEMPOTENCY_TTL_MS, idempotent } from './index';

// Integration: needs the local Redis (`pnpm services:up`). MOD-00 plan rule 6 under concurrency
// (section 9: 50 parallel hits on one key) and with Redis down. Keys are random UUIDs; every key
// written is deleted afterwards.
const redisUrl = process.env.REDIS_URL;
const ci = !['', 'false', '0'].includes(process.env.CI?.trim().toLowerCase() ?? '');
if (ci && !redisUrl) throw new Error('Idempotency tests need REDIS_URL in CI');

describe.skipIf(!redisUrl)('idempotent() on Redis', () => {
  const redis = new RedisClient(redisUrl ?? '');
  const written: string[] = [];
  afterAll(async () => {
    if (written.length) await redis.del(...written);
    redis.close();
  });

  const appWith = (store = createRedisIdempotencyStore(redis), delayMs = 20) => {
    const calls = { count: 0 };
    const app = createRouter();
    app.use('*', requestContext(createLogger('error')));
    app.onError(errorHandler);
    app.post('/v1/test/orders', idempotent(store), async (c) => {
      calls.count += 1;
      const body = await c.req.json<{ amount: number }>();
      await Bun.sleep(delayMs);
      return c.json({ order: calls.count, amount: body.amount }, 201);
    });
    return { app, calls };
  };

  const send = (app: ReturnType<typeof createRouter>, key: string, amount: number) =>
    app.request('/v1/test/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
      body: JSON.stringify({ amount }),
    });

  const newKey = () => {
    const key = crypto.randomUUID();
    written.push(`idem:POST /v1/test/orders:${key}`);
    return key;
  };

  test('50 parallel hits on one key run the handler exactly once', async () => {
    const { app, calls } = appWith();
    const key = newKey();
    const responses = await Promise.all(Array.from({ length: 50 }, () => send(app, key, 500)));
    expect(calls.count).toBe(1);
    const statuses = responses.map((r) => r.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(
      statuses.length - statuses.filter((s) => s === 409).length,
    );
    for (const res of responses.filter((r) => r.status === 409)) {
      expect(((await res.json()) as { reason: string }).reason).toBe('idempotency_in_progress');
    }
    // After the first finishes, every retry is a replay of the one stored response.
    const replay = await send(app, key, 500);
    expect(replay.status).toBe(201);
    expect(await replay.json()).toEqual({ order: 1, amount: 500 });
    expect(calls.count).toBe(1);
  });

  test("two API instances share the key: the second replays the first one's response", async () => {
    const one = appWith();
    const two = appWith();
    const key = newKey();
    const first = await send(one.app, key, 7);
    const replay = await send(two.app, key, 7);
    expect(await replay.json()).toEqual(await first.json());
    expect(one.calls.count + two.calls.count).toBe(1);
  });

  test('a different body with the key is 409 idempotency_key_reused', async () => {
    const { app, calls } = appWith();
    const key = newKey();
    await send(app, key, 1);
    const res = await send(app, key, 2);
    expect(res.status).toBe(409);
    expect(((await res.json()) as { reason: string }).reason).toBe('idempotency_key_reused');
    expect(calls.count).toBe(1);
  });

  test('the stored response lives under idem:{route}:{key} for 24 h', async () => {
    const { app } = appWith();
    const key = newKey();
    await send(app, key, 3);
    const redisKey = `idem:POST /v1/test/orders:${key}`;
    const ttl = (await redis.pttl(redisKey)) as number;
    expect(ttl).toBeGreaterThan(IDEMPOTENCY_TTL_MS - 60_000);
    expect(ttl).toBeLessThanOrEqual(IDEMPOTENCY_TTL_MS);
    const record = JSON.parse((await redis.get(redisKey))!) as { state: string };
    expect(record.state).toBe('completed');
  });

  test('Redis unreachable: 503 dependency_unavailable within the timeout, handler never runs', async () => {
    const down = new RedisClient('redis://127.0.0.1:1', {
      autoReconnect: false,
      connectionTimeout: 50,
    });
    const { app, calls } = appWith(createRedisIdempotencyStore(down, 100));
    const started = performance.now();
    const res = await send(app, crypto.randomUUID(), 1);
    expect(res.status).toBe(503);
    expect(((await res.json()) as { reason: string }).reason).toBe('dependency_unavailable');
    expect(performance.now() - started).toBeLessThan(1000);
    expect(calls.count).toBe(0);
    down.close();
  });

  test('a 5xx frees the key in Redis, so the retry runs', async () => {
    const store = createRedisIdempotencyStore(redis);
    let calls = 0;
    const app = createRouter();
    app.use('*', requestContext(createLogger('error')));
    app.onError(errorHandler);
    app.post('/v1/test/orders', idempotent(store), (c) => {
      calls += 1;
      return calls === 1 ? c.json({}, 503) : c.json({ ok: true }, 201);
    });
    const key = newKey();
    expect((await send(app, key, 1)).status).toBe(503);
    expect(await redis.exists(`idem:POST /v1/test/orders:${key}`)).toBe(false);
    expect((await send(app, key, 1)).status).toBe(201);
    expect(calls).toBe(2);
  });

  test('Redis that accepts but never answers: 503 after the command timeout', async () => {
    // A TCP server that never replies: the command hangs until the store's timeout fires.
    const silent = Bun.listen({
      hostname: '127.0.0.1',
      port: 0,
      socket: { data() {}, open() {} },
    });
    const hung = new RedisClient(`redis://127.0.0.1:${silent.port}`, { autoReconnect: false });
    const { app, calls } = appWith(createRedisIdempotencyStore(hung, 50));
    const res = await send(app, crypto.randomUUID(), 1);
    expect(res.status).toBe(503);
    expect(calls.count).toBe(0);
    hung.close();
    silent.stop(true);
  });
});
