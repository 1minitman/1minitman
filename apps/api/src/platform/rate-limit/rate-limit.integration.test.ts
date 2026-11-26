import { createDatabase } from '@1minitman/db';
import { rateLimitPolicies } from '@1minitman/db/schema';
import { RedisClient } from 'bun';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { requestContext } from '../http/middleware';
import { createRouter } from '../http/router';
import { createLogger } from '../logger';
import {
  checkRateLimit,
  createMemoryRateLimiter,
  createPolicyStore,
  createRedisRateLimiter,
  failsClosed,
  postgresPolicySource,
  publishPolicyChange,
  rateLimit,
  subscribeToPolicyChanges,
  type LimitRule,
  type RateLimits,
} from './index';

// Integration: needs the local PostgreSQL and Redis (`pnpm services:up`, `pnpm db:migrate`).
// Test rows use a `test.api03_*` key and are deleted afterwards; the seeded rows are never edited.
const databaseUrl = process.env.DATABASE_URL;
const adminUrl = process.env.ADMIN_DATABASE_URL;
const redisUrl = process.env.REDIS_URL;
const ready = Boolean(databaseUrl && adminUrl && redisUrl);
// In CI a missing service must fail the run, never skip it (GAP-STD01-09).
const ci = !['', 'false', '0'].includes(process.env.CI?.trim().toLowerCase() ?? '');
if (ci && !ready) {
  throw new Error('Rate-limit tests need DATABASE_URL, ADMIN_DATABASE_URL and REDIS_URL in CI');
}

const logger = createLogger('error');
const database = ready
  ? createDatabase({ url: databaseUrl!, surface: 'member', appEnv: 'local', max: 2 })
  : null;
// Config writes need an approval only when app.env is production [SQL enforce_config_approval].
const admin = ready
  ? createDatabase({ url: adminUrl!, surface: 'admin', appEnv: 'staging', max: 2 })
  : null;
const redis = ready ? new RedisClient(redisUrl!) : null;
const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 12);
afterAll(async () => {
  redis?.close();
  await Promise.all([database?.close(), admin?.close()]);
});

/** The 15 rows seeded by migration 0001 [TR §13.3]: key, scope, max, window, lockout. */
const SEEDED: [string, string, number, number, number | null][] = [
  ['otp.send', 'phone', 5, 3600, null],
  ['otp.verify.sms', 'phone', 3, 600, 1800],
  ['otp.verify.email', 'email', 5, 600, 900],
  ['login.account', 'account', 5, 900, 900],
  ['login.ip', 'ip', 50, 900, null],
  ['signup.device', 'device', 5, 86400, null],
  ['signup.ip', 'ip', 20, 3600, null],
  ['reactions.user', 'account', 120, 60, null],
  ['messages.user', 'account', 30, 60, null],
  ['messages.daily', 'account', 1000, 86400, null],
  ['media.upload', 'account', 30, 3600, null],
  ['reports.user', 'account', 20, 86400, null],
  ['export.user', 'account', 1, 86400, null],
  ['public.forms', 'ip', 10, 3600, null],
  ['admin.login', 'account_ip', 10, 900, 1800],
];

describe.skipIf(!ready)('policies from PostgreSQL', () => {
  test('the 15 seeded policies load with their seeded values', async () => {
    const rows = await postgresPolicySource(database!).load();
    const seeded = rows
      .filter((r) => !r.key.startsWith('test.'))
      .map((r) => [r.key, r.scope, r.maxRequests, r.windowSeconds, r.lockoutSeconds])
      .sort();
    expect(seeded).toEqual([...SEEDED].sort());
    for (const r of rows.filter((r) => !r.key.startsWith('test.'))) {
      expect(r).toMatchObject({ algorithm: 'sliding_window', isActive: true });
    }
  });

  test('DEC-002: the fail-closed policies are exactly the four the owner named', async () => {
    const rows = await postgresPolicySource(database!).load();
    expect(
      rows
        .filter((r) => !r.key.startsWith('test.') && failsClosed(r))
        .map((r) => r.key)
        .sort(),
    ).toEqual(['admin.login', 'login.account', 'otp.verify.email', 'otp.verify.sms']);
  });

  test('every seeded policy is enforced by its key: request N allowed, N+1 refused', async () => {
    const store = createPolicyStore(postgresPolicySource(database!));
    await store.reload();
    const rateLimits: RateLimits = { policies: store, limiter: createMemoryRateLimiter() };
    for (const [key, , max, , lockout] of SEEDED) {
      const subject = `subject-${suffix}`;
      for (let i = 1; i <= max; i++) {
        const check = await checkRateLimit(rateLimits, key, subject, logger);
        if (check.outcome !== 'allowed') throw new Error(`${key}: request ${i} of ${max} refused`);
      }
      expect(await checkRateLimit(rateLimits, key, subject, logger)).toMatchObject({
        outcome: lockout === null ? 'limited' : 'locked',
        ...(lockout === null ? {} : { retryAfterSeconds: lockout }),
      });
    }
  });
});

describe.skipIf(!ready)('a changed row changes behaviour without a restart', () => {
  const key = `test.api03_reload_${suffix}`;
  let subscriber: RedisClient;
  let stop: () => Promise<void>;
  const store = ready ? createPolicyStore(postgresPolicySource(database!)) : null;
  const rateLimits = (): RateLimits => ({
    policies: store!,
    limiter: createRedisRateLimiter(redis!),
  });
  const ip = `10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

  const update = async (
    values: Partial<typeof rateLimitPolicies.$inferInsert>,
    expect: (p: ReturnType<NonNullable<typeof store>['get']>) => boolean,
  ) => {
    await admin!.db.update(rateLimitPolicies).set(values).where(eq(rateLimitPolicies.key, key));
    await publishPolicyChange(redis!);
    for (let i = 0; i < 100 && !expect(store!.get(key)); i++) await Bun.sleep(20);
    if (!expect(store!.get(key))) throw new Error('the change message did not reload the policies');
  };
  const clearKeys = () => redis!.send('DEL', [`rl:${key}:${ip}`, `lock:${key}:${ip}`]);

  beforeAll(async () => {
    await admin!.db.insert(rateLimitPolicies).values({
      key,
      scope: 'ip',
      maxRequests: 2,
      windowSeconds: 60,
      appliesTo: 'test only',
      description: 'MOD-00-API-03 reload test, deleted afterwards',
    });
    await store!.reload();
    subscriber = new RedisClient(redisUrl!);
    stop = await subscribeToPolicyChanges(subscriber, store!, logger);
  });
  afterAll(async () => {
    await stop?.();
    subscriber?.close();
    await clearKeys();
    await admin!.db.delete(rateLimitPolicies).where(eq(rateLimitPolicies.key, key));
  });

  test('edit the limit, deactivate, then give it a lockout', async () => {
    const app = createRouter();
    app.use('*', requestContext(logger));
    app.use('*', rateLimit(rateLimits(), key));
    app.get('/', (c) => c.text('ok'));
    const hit = async () =>
      (await app.request('/', { headers: { 'cf-connecting-ip': ip } })).status;

    expect([await hit(), await hit(), await hit()]).toEqual([200, 200, 429]);

    await update({ maxRequests: 4 }, (p) => p?.maxRequests === 4);
    expect([await hit(), await hit(), await hit()]).toEqual([200, 200, 429]);

    await update({ isActive: false }, (p) => p?.isActive === false);
    for (let i = 0; i < 6; i++) expect(await hit()).toBe(200);

    await clearKeys();
    await update(
      { isActive: true, maxRequests: 1, lockoutSeconds: 120 },
      (p) => p?.lockoutSeconds === 120,
    );
    expect([await hit(), await hit(), await hit()]).toEqual([200, 423, 423]);
    const ttl = await redis!.pttl(`lock:${key}:${ip}`);
    expect(ttl).toBeGreaterThan(110_000);
    expect(ttl).toBeLessThanOrEqual(120_000);
  });
});

describe.skipIf(!ready)('Redis rate limiter', () => {
  const rule = (overrides: Partial<LimitRule> = {}): LimitRule => ({
    limit: 3,
    windowSeconds: 30,
    algorithm: 'sliding_window',
    lockoutSeconds: null,
    ...overrides,
  });
  const freshKeys = () => {
    const id = crypto.randomUUID();
    return { counter: `rl:test.api03:${id}`, lock: `lock:test.api03:${id}` };
  };
  const cleanup = (keys: { counter: string; lock: string }) =>
    redis!.send('DEL', [keys.counter, keys.lock]);

  for (const algorithm of ['sliding_window', 'fixed_window', 'token_bucket'] as const) {
    test(`${algorithm}: request N allowed, N+1 refused`, async () => {
      const limiter = createRedisRateLimiter(redis!);
      const keys = freshKeys();
      // A fixed window may roll over mid-test; use a long one so it does not.
      const r = rule({ algorithm, windowSeconds: 3600 });
      const outcomes = [];
      for (let i = 0; i < 4; i++) outcomes.push(await limiter.consume(keys, r));
      expect(outcomes.map((d) => d.outcome)).toEqual(['allowed', 'allowed', 'allowed', 'limited']);
      expect(outcomes.map((d) => d.remaining)).toEqual([2, 1, 0, 0]);
      expect(outcomes[3]!.retryAfterSeconds).toBeGreaterThan(0);
      await cleanup(keys);
    });
  }

  test('a lockout sets lock:{policy}:{subject}, refuses during it and clears the counter', async () => {
    const limiter = createRedisRateLimiter(redis!);
    const keys = freshKeys();
    const r = rule({ limit: 2, lockoutSeconds: 900 });
    await limiter.consume(keys, r);
    await limiter.consume(keys, r);
    expect(await limiter.consume(keys, r)).toMatchObject({
      outcome: 'locked',
      retryAfterSeconds: 900,
    });
    expect(await redis!.exists(keys.counter)).toBe(false);
    expect(await limiter.consume(keys, r)).toMatchObject({ outcome: 'locked' });
    expect(await redis!.exists(keys.counter)).toBe(false);
    expect(await limiter.lockRemaining(keys.lock)).toBe(900);
    expect(await limiter.lockRemaining(freshKeys().lock)).toBe(0);
    await cleanup(keys);
  });

  test('sliding_window: after the limit is lowered, the retry time follows the newest hits', async () => {
    const limiter = createRedisRateLimiter(redis!);
    const keys = freshKeys();
    const now = Date.now();
    // Three hits already in the window: 50 min, 40 min and 1 min ago (window 1 hour).
    await redis!.send('ZADD', [
      keys.counter,
      String(now - 3_000_000),
      'a',
      String(now - 2_400_000),
      'b',
      String(now - 60_000),
      'c',
    ]);
    await redis!.send('PEXPIRE', [keys.counter, '3600000']);
    // Limit lowered to 1: a slot frees when the hit of 1 min ago leaves, about 59 min from now.
    const decision = await limiter.consume(keys, rule({ limit: 1, windowSeconds: 3600 }));
    expect(decision.outcome).toBe('limited');
    expect(decision.retryAfterSeconds).toBeGreaterThan(3_500);
    expect(decision.retryAfterSeconds).toBeLessThanOrEqual(3_541);
    await cleanup(keys);
  });

  test('changing the algorithm on a live key restarts the count instead of failing', async () => {
    const limiter = createRedisRateLimiter(redis!);
    const keys = freshKeys();
    for (let i = 0; i < 4; i++) await limiter.consume(keys, rule());
    expect((await limiter.consume(keys, rule({ algorithm: 'token_bucket' }))).outcome).toBe(
      'allowed',
    );
    expect((await limiter.consume(keys, rule({ algorithm: 'fixed_window' }))).outcome).toBe(
      'allowed',
    );
    expect((await limiter.consume(keys, rule())).outcome).toBe('allowed');
    await cleanup(keys);
  });

  test('50 parallel hits on one key from two instances: exactly the limit is allowed', async () => {
    const second = new RedisClient(redisUrl!);
    try {
      const instances = [
        createRedisRateLimiter(redis!, 2000),
        createRedisRateLimiter(second, 2000),
      ];
      const keys = freshKeys();
      const results = await Promise.all(
        Array.from({ length: 50 }, (_, i) => instances[i % 2]!.consume(keys, rule({ limit: 10 }))),
      );
      expect(results.filter((r) => r.outcome === 'allowed')).toHaveLength(10);
      expect(results.filter((r) => r.outcome === 'limited')).toHaveLength(40);
      await cleanup(keys);
    } finally {
      second.close();
    }
  });

  test('Redis unreachable: the command times out, a lockout policy refuses and the rest pass', async () => {
    const dead = new RedisClient('redis://127.0.0.1:1', { connectionTimeout: 50, maxRetries: 0 });
    try {
      const limiter = createRedisRateLimiter(dead, 50);
      expect(limiter.consume(freshKeys(), rule())).rejects.toThrow();
      const store = createPolicyStore(postgresPolicySource(database!));
      await store.reload();
      const rateLimits: RateLimits = { policies: store, limiter };
      expect(await checkRateLimit(rateLimits, 'login.account', 'x', logger)).toMatchObject({
        outcome: 'unavailable',
        refuse: true,
      });
      expect(await checkRateLimit(rateLimits, 'login.ip', 'x', logger)).toMatchObject({
        outcome: 'unavailable',
        refuse: false,
      });
    } finally {
      dead.close();
    }
  });
});
