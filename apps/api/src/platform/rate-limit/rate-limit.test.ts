import { RedisClient } from 'bun';
import { afterAll, describe, expect, test } from 'bun:test';
import { requestContext } from '../http/middleware';
import { createRouter } from '../http/router';
import { createLogger } from '../logger';
import {
  createMemoryRateLimiter,
  createRedisRateLimiter,
  rateLimit,
  type RateLimiter,
} from './index';

const appWith = (limiter: RateLimiter) => {
  const app = createRouter();
  app.use('*', requestContext(createLogger('error')));
  app.use('*', rateLimit(limiter, { policy: 'test.ip', limit: 2, windowSeconds: 60 }));
  app.get('/', (c) => c.text('ok'));
  return app;
};
const from = (ip: string) => ({ headers: { 'cf-connecting-ip': ip } });

describe('rateLimit middleware', () => {
  test('allows up to the limit, then answers 429 problem+json with Retry-After', async () => {
    const app = appWith(createMemoryRateLimiter());
    expect((await app.request('/', from('1.1.1.1'))).status).toBe(200);
    expect((await app.request('/', from('1.1.1.1'))).status).toBe(200);
    const blocked = await app.request('/', from('1.1.1.1'));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('content-type')).toContain('application/problem+json');
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(await blocked.json()).toMatchObject({ reason: 'rate_limited' });
  });

  test('each caller has its own budget', async () => {
    const app = appWith(createMemoryRateLimiter());
    await app.request('/', from('1.1.1.1'));
    await app.request('/', from('1.1.1.1'));
    expect((await app.request('/', from('2.2.2.2'))).status).toBe(200);
  });

  test('the window slides: old hits stop counting', async () => {
    let now = 0;
    const limiter = createMemoryRateLimiter(() => now);
    await limiter.hit('k', 1, 10);
    expect((await limiter.hit('k', 1, 10)).allowed).toBe(false);
    now = 10_001;
    expect((await limiter.hit('k', 1, 10)).allowed).toBe(true);
  });

  test('a broken limiter never blocks the product', async () => {
    const app = appWith({ hit: () => Promise.reject(new Error('redis down')) });
    expect((await app.request('/', from('1.1.1.1'))).status).toBe(200);
  });
});

// Integration: needs the local Redis (`pnpm services:up`).
const redisUrl = process.env.REDIS_URL;
const redis = redisUrl ? new RedisClient(redisUrl) : null;
afterAll(() => redis?.close());

describe.skipIf(!redis)('Redis rate limiter', () => {
  test('counts atomically across concurrent requests', async () => {
    const limiter = createRedisRateLimiter(redis!);
    const key = `rl:test:${crypto.randomUUID()}`;
    const results = await Promise.all(Array.from({ length: 10 }, () => limiter.hit(key, 3, 30)));
    expect(results.filter((r) => r.allowed)).toHaveLength(3);
    const blocked = results.find((r) => !r.allowed);
    expect(blocked?.retryAfterSeconds).toBeGreaterThan(0);
    await redis!.send('DEL', [key]);
  });
});
