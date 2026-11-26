import { describe, expect, test } from 'bun:test';
import { createMemoryRateLimiter, type LimitRule } from './index';

const keys = { counter: 'rl:test.policy:s', lock: 'lock:test.policy:s' };
const rule = (overrides: Partial<LimitRule> = {}): LimitRule => ({
  limit: 3,
  windowSeconds: 10,
  algorithm: 'sliding_window',
  lockoutSeconds: null,
  ...overrides,
});
const clock = (start = 1_000_000) => {
  let now = start;
  return { now: () => now, advance: (ms: number) => (now += ms) };
};

describe.each(['sliding_window', 'fixed_window', 'token_bucket'] as const)(
  'memory limiter, %s',
  (algorithm) => {
    test('request N is allowed and N+1 refused, with a retry time', async () => {
      const limiter = createMemoryRateLimiter(clock(0).now);
      const r = rule({ algorithm });
      const results = [];
      for (let i = 0; i < 4; i++) results.push(await limiter.consume(keys, r));
      expect(results.slice(0, 3).map((d) => d.outcome)).toEqual(['allowed', 'allowed', 'allowed']);
      expect(results.map((d) => d.remaining)).toEqual([2, 1, 0, 0]);
      expect(results[3]).toMatchObject({ outcome: 'limited' });
      expect(results[3]!.retryAfterSeconds).toBeGreaterThan(0);
      expect(results[3]!.retryAfterSeconds).toBeLessThanOrEqual(10);
    });

    test('a full window later the budget is back', async () => {
      const time = clock(0);
      const limiter = createMemoryRateLimiter(time.now);
      const r = rule({ algorithm });
      for (let i = 0; i < 3; i++) await limiter.consume(keys, r);
      expect((await limiter.consume(keys, r)).outcome).toBe('limited');
      time.advance(10_001);
      expect((await limiter.consume(keys, r)).outcome).toBe('allowed');
    });
  },
);

describe('memory limiter, algorithm details', () => {
  test('sliding window: only hits inside the last window count', async () => {
    const time = clock();
    const limiter = createMemoryRateLimiter(time.now);
    await limiter.consume(keys, rule({ limit: 2 }));
    time.advance(6_000);
    await limiter.consume(keys, rule({ limit: 2 }));
    expect((await limiter.consume(keys, rule({ limit: 2 }))).retryAfterSeconds).toBe(4);
    time.advance(4_001);
    expect((await limiter.consume(keys, rule({ limit: 2 }))).outcome).toBe('allowed');
  });

  test('fixed window: the count resets at the window boundary, not a window after the first hit', async () => {
    const time = clock(9_000);
    const limiter = createMemoryRateLimiter(time.now);
    const r = rule({ limit: 1, algorithm: 'fixed_window' });
    expect((await limiter.consume(keys, r)).outcome).toBe('allowed');
    expect(await limiter.consume(keys, r)).toMatchObject({
      outcome: 'limited',
      retryAfterSeconds: 1,
    });
    time.advance(1_000);
    expect((await limiter.consume(keys, r)).outcome).toBe('allowed');
  });

  test('token bucket: tokens refill at limit per window', async () => {
    const time = clock();
    const limiter = createMemoryRateLimiter(time.now);
    const r = rule({ limit: 2, algorithm: 'token_bucket' });
    await limiter.consume(keys, r);
    await limiter.consume(keys, r);
    expect(await limiter.consume(keys, r)).toMatchObject({
      outcome: 'limited',
      retryAfterSeconds: 5,
    });
    time.advance(5_000);
    expect((await limiter.consume(keys, r)).outcome).toBe('allowed');
    expect((await limiter.consume(keys, r)).outcome).toBe('limited');
  });

  test('changing the algorithm restarts the count', async () => {
    const limiter = createMemoryRateLimiter(clock().now);
    for (let i = 0; i < 3; i++) await limiter.consume(keys, rule());
    expect((await limiter.consume(keys, rule())).outcome).toBe('limited');
    expect((await limiter.consume(keys, rule({ algorithm: 'fixed_window' }))).outcome).toBe(
      'allowed',
    );
  });

  test('each key has its own budget', async () => {
    const limiter = createMemoryRateLimiter(clock().now);
    for (let i = 0; i < 3; i++) await limiter.consume(keys, rule());
    const other = { counter: 'rl:test.policy:t', lock: 'lock:test.policy:t' };
    expect((await limiter.consume(other, rule())).outcome).toBe('allowed');
  });
});

describe('memory limiter, lockouts', () => {
  test('N+1 starts the lock; requests during it are refused uncounted; afterwards the window is fresh', async () => {
    const time = clock();
    const limiter = createMemoryRateLimiter(time.now);
    const r = rule({ lockoutSeconds: 1800 });
    for (let i = 0; i < 3; i++) expect((await limiter.consume(keys, r)).outcome).toBe('allowed');
    expect(await limiter.consume(keys, r)).toMatchObject({
      outcome: 'locked',
      retryAfterSeconds: 1800,
    });
    expect(await limiter.lockRemaining(keys.lock)).toBe(1800);
    time.advance(600_000);
    expect(await limiter.consume(keys, r)).toMatchObject({
      outcome: 'locked',
      retryAfterSeconds: 1200,
    });
    time.advance(1_200_000);
    expect(await limiter.lockRemaining(keys.lock)).toBe(0);
    for (let i = 0; i < 3; i++) expect((await limiter.consume(keys, r)).outcome).toBe('allowed');
    expect((await limiter.consume(keys, r)).outcome).toBe('locked');
  });

  test('no lock without a lockout', async () => {
    const limiter = createMemoryRateLimiter(clock().now);
    for (let i = 0; i < 4; i++) await limiter.consume(keys, rule());
    expect(await limiter.lockRemaining(keys.lock)).toBe(0);
  });
});
