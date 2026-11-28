import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../http/context';
import { requestContext } from '../http/middleware';
import { errorHandler } from '../http/problem';
import { createRouter } from '../http/router';
import { createLogger, type Logger } from '../logger';
import { ORIGIN_SECRET_HEADER, originLock } from '../origin';
import {
  checkRateLimit,
  createMemoryRateLimiter,
  createPolicyStore,
  failsClosed,
  normaliseIdentity,
  rateLimit,
  resolveSubject,
  staticPolicySource,
  type LimitKeys,
  type RateLimiter,
  type RateLimitOptions,
  type RateLimitPolicy,
  type RateLimits,
} from './index';

const policy = (overrides: Partial<RateLimitPolicy> = {}): RateLimitPolicy => ({
  key: 'test.ip',
  scope: 'ip',
  maxRequests: 2,
  windowSeconds: 60,
  lockoutSeconds: null,
  algorithm: 'sliding_window',
  isActive: true,
  ...overrides,
});

const rateLimitsWith = async (
  policies: RateLimitPolicy[],
  limiter: RateLimiter = createMemoryRateLimiter(),
): Promise<RateLimits> => {
  const store = createPolicyStore(staticPolicySource(policies));
  await store.reload();
  return { policies: store, limiter };
};

const recordingLogger = () => {
  const lines: { level: string; message: string; fields?: Record<string, unknown> }[] = [];
  const at = (level: string) => (message: string, fields?: Record<string, unknown>) =>
    void lines.push({ level, message, fields });
  const logger: Logger = {
    debug: at('debug'),
    info: at('info'),
    warn: at('warn'),
    error: at('error'),
    child: () => logger,
  } as Logger;
  return { logger, lines };
};

interface AppOptions extends RateLimitOptions {
  logger?: Logger;
  member?: string;
}
const appWith = (rateLimits: RateLimits, key: string, options: AppOptions = {}) => {
  const app = createRouter();
  app.onError(errorHandler);
  app.use('*', requestContext(options.logger ?? createLogger('error')));
  if (options.member) {
    const memberId = options.member;
    app.use(
      '*',
      createMiddleware<AppEnv>(async (c, next) => {
        c.set('member', { memberId, sessionId: 's' });
        await next();
      }),
    );
  }
  app.use('*', rateLimit(rateLimits, key, options));
  app.get('/', (c) => c.text('ok'));
  return app;
};
const from = (ip: string, extra: Record<string, string> = {}) => ({
  headers: { 'cf-connecting-ip': ip, ...extra },
});
const down: RateLimiter = {
  consume: () => Promise.reject(new Error('redis down')),
  lockRemaining: () => Promise.reject(new Error('redis down')),
};

describe('rateLimit middleware', () => {
  test('allows up to the limit, then answers 429 problem+json with Retry-After', async () => {
    const app = appWith(await rateLimitsWith([policy()]), 'test.ip');
    const first = await app.request('/', from('1.1.1.1'));
    expect(first.status).toBe(200);
    expect(first.headers.get('ratelimit-limit')).toBe('2');
    expect(first.headers.get('ratelimit-remaining')).toBe('1');
    expect((await app.request('/', from('1.1.1.1'))).status).toBe(200);
    const blocked = await app.request('/', from('1.1.1.1'));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('content-type')).toContain('application/problem+json');
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(await blocked.json()).toMatchObject({
      reason: 'rate_limited',
      request_id: expect.any(String),
    });
  });

  test('each caller has its own budget', async () => {
    const app = appWith(await rateLimitsWith([policy()]), 'test.ip');
    await app.request('/', from('1.1.1.1'));
    await app.request('/', from('1.1.1.1'));
    expect((await app.request('/', from('2.2.2.2'))).status).toBe(200);
  });

  test('a policy with a lockout answers 423 locked with until, and keeps refusing during the lock', async () => {
    const rateLimits = await rateLimitsWith([policy({ lockoutSeconds: 900 })]);
    const app = appWith(rateLimits, 'test.ip');
    await app.request('/', from('1.1.1.1'));
    await app.request('/', from('1.1.1.1'));
    const before = Date.now();
    const locked = await app.request('/', from('1.1.1.1'));
    expect(locked.status).toBe(423);
    expect(locked.headers.get('retry-after')).toBe('900');
    const body = (await locked.json()) as { reason: string; until: string };
    expect(body.reason).toBe('locked');
    const until = Date.parse(body.until);
    expect(until).toBeGreaterThanOrEqual(before + 899_000);
    expect(until).toBeLessThanOrEqual(Date.now() + 900_000);
    expect((await app.request('/', from('1.1.1.1'))).status).toBe(423);
    expect(await rateLimits.limiter.lockRemaining('lock:test.ip:1.1.1.1')).toBe(900);
  });

  test('an inactive policy is not enforced and counts nothing', async () => {
    const app = appWith(await rateLimitsWith([policy({ isActive: false })]), 'test.ip');
    for (let i = 0; i < 5; i++) {
      const res = await app.request('/', from('1.1.1.1'));
      expect(res.status).toBe(200);
      expect(res.headers.get('ratelimit-limit')).toBeNull();
    }
  });

  test('a key with no row is not enforced and is logged as an error', async () => {
    const { logger, lines } = recordingLogger();
    const app = appWith(await rateLimitsWith([policy()]), 'test.missing', { logger });
    expect((await app.request('/', from('1.1.1.1'))).status).toBe(200);
    expect(lines).toContainEqual(
      expect.objectContaining({ level: 'error', fields: { policy: 'test.missing' } }),
    );
  });

  test('a scope that cannot be resolved is a programming error: 500 problem+json', async () => {
    const { logger, lines } = recordingLogger();
    const app = appWith(
      await rateLimitsWith([policy({ key: 'test.phone', scope: 'phone' })]),
      'test.phone',
      {
        logger,
      },
    );
    const res = await app.request('/', from('1.1.1.1'));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ reason: 'internal' });
    expect(
      lines.some((l) => l.level === 'error' && String(l.fields?.error).includes('no subject')),
    ).toBe(true);
  });

  test('the account scope counts the signed-in member, wherever they connect from', async () => {
    const rateLimits = await rateLimitsWith([policy({ key: 'test.account', scope: 'account' })]);
    const app = appWith(rateLimits, 'test.account', { member: 'member-1' });
    await app.request('/', from('1.1.1.1'));
    await app.request('/', from('2.2.2.2'));
    expect((await app.request('/', from('3.3.3.3'))).status).toBe(429);
  });

  test('the phone scope uses the identity the route supplies, hashed in the key', async () => {
    const limiter = createMemoryRateLimiter();
    const seen: LimitKeys[] = [];
    const spy: RateLimiter = {
      consume: (keys, rule) => (seen.push(keys), limiter.consume(keys, rule)),
      lockRemaining: (key) => limiter.lockRemaining(key),
    };
    const app = appWith(
      await rateLimitsWith([policy({ key: 'otp.test', scope: 'phone' })], spy),
      'otp.test',
      {
        identity: (c) => c.req.header('x-phone'),
      },
    );
    await app.request('/', from('1.1.1.1', { 'x-phone': '+2348000000000' }));
    await app.request('/', from('2.2.2.2', { 'x-phone': '+2348000000000' }));
    expect((await app.request('/', from('3.3.3.3', { 'x-phone': '+2348000000000' }))).status).toBe(
      429,
    );
    const hash = createHash('sha256').update('+2348000000000').digest('hex');
    expect(seen[0]).toEqual({ counter: `rl:otp.test:${hash}`, lock: `lock:otp.test:${hash}` });
    expect(JSON.stringify(seen)).not.toContain('2348000000000');
  });

  test('a supplied account identity is normalised and hashed: variants share one window, no raw address in the key', async () => {
    const limiter = createMemoryRateLimiter();
    const seen: LimitKeys[] = [];
    const spy: RateLimiter = {
      consume: (keys, rule) => (seen.push(keys), limiter.consume(keys, rule)),
      lockRemaining: (key) => limiter.lockRemaining(key),
    };
    const app = appWith(
      await rateLimitsWith([policy({ key: 'login.test', scope: 'account' })], spy),
      'login.test',
      { identity: (c) => c.req.header('x-email') },
    );
    await app.request('/', from('1.1.1.1', { 'x-email': 'Alice@Example.test' }));
    await app.request('/', from('2.2.2.2', { 'x-email': ' alice@example.test ' }));
    expect(
      (await app.request('/', from('3.3.3.3', { 'x-email': 'ALICE@EXAMPLE.TEST' }))).status,
    ).toBe(429);
    const hash = createHash('sha256').update('alice@example.test').digest('hex');
    expect(new Set(seen.map((k) => k.counter))).toEqual(new Set([`rl:login.test:${hash}`]));
    expect(JSON.stringify(seen).toLowerCase()).not.toContain('example.test');
  });

  test('an edit to the row applies on the next request, without a new middleware', async () => {
    let rows = [policy({ maxRequests: 1 })];
    const store = createPolicyStore({ load: () => Promise.resolve(rows) });
    await store.reload();
    const app = appWith({ policies: store, limiter: createMemoryRateLimiter() }, 'test.ip');
    expect((await app.request('/', from('1.1.1.1'))).status).toBe(200);
    expect((await app.request('/', from('1.1.1.1'))).status).toBe(429);
    rows = [policy({ maxRequests: 5 })];
    await store.reload();
    expect((await app.request('/', from('1.1.1.1'))).status).toBe(200);
    rows = [policy({ maxRequests: 5, isActive: false })];
    await store.reload();
    for (let i = 0; i < 10; i++) expect((await app.request('/', from('1.1.1.1'))).status).toBe(200);
  });
});

describe('Redis unreachable (DEC-002)', () => {
  test('a policy without a lockout fails open and logs a warning', async () => {
    const { logger, lines } = recordingLogger();
    const app = appWith(await rateLimitsWith([policy()], down), 'test.ip', { logger });
    expect((await app.request('/', from('1.1.1.1'))).status).toBe(200);
    expect(lines.some((l) => l.level === 'warn' && l.fields?.policy === 'test.ip')).toBe(true);
  });

  test('a lockout policy fails closed: 503 dependency_unavailable and an error log', async () => {
    const { logger, lines } = recordingLogger();
    const app = appWith(await rateLimitsWith([policy({ lockoutSeconds: 900 })], down), 'test.ip', {
      logger,
    });
    const res = await app.request('/', from('1.1.1.1'));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ reason: 'dependency_unavailable' });
    expect(lines.some((l) => l.level === 'error' && l.fields?.policy === 'test.ip')).toBe(true);
  });

  test('failsClosed follows lockout_seconds', () => {
    expect(failsClosed(policy({ lockoutSeconds: 1800 }))).toBe(true);
    expect(failsClosed(policy())).toBe(false);
  });
});

describe('resolveSubject', () => {
  const contextFor = async (
    scope: RateLimitPolicy['scope'],
    identity?: string,
    principal?: { member?: string; admin?: string },
  ) => {
    let subject: string | undefined;
    const app = createRouter();
    app.use('*', requestContext(createLogger('error')));
    app.get('/', (c) => {
      if (principal?.member) c.set('member', { memberId: principal.member, sessionId: 's' });
      if (principal?.admin) c.set('admin', { adminId: principal.admin, sessionId: 's' });
      subject = resolveSubject({ scope }, c, identity);
      return c.text('ok');
    });
    await app.request('/', from('9.9.9.9'));
    return subject;
  };
  const sha = (value: string) => createHash('sha256').update(value).digest('hex');

  test('ip, account, account_ip, device, phone and email', async () => {
    expect(await contextFor('ip')).toBe('9.9.9.9');
    expect(await contextFor('account', undefined, { member: 'm1' })).toBe('m1');
    expect(await contextFor('account', 'staff@example.test')).toBe(sha('staff@example.test'));
    expect(await contextFor('account', undefined, { admin: 'a1' })).toBe('a1');
    expect(await contextFor('account')).toBeUndefined();
    expect(await contextFor('account_ip', 'staff@example.test')).toBe(
      sha('staff@example.test|9.9.9.9'),
    );
    expect(await contextFor('account_ip', undefined, { admin: 'a1' })).toBe(sha('a1|9.9.9.9'));
    expect(await contextFor('account_ip')).toBeUndefined();
    expect(await contextFor('device', 'device-1')).toBe('device-1');
    expect(await contextFor('device')).toBeUndefined();
    expect(await contextFor('email', 'a@example.test')).toBe(sha('a@example.test'));
    expect(await contextFor('phone')).toBeUndefined();
  });

  test('case and white-space variants of a supplied identity map to one subject', async () => {
    for (const scope of ['email', 'account', 'account_ip'] as const) {
      const subjects = new Set(
        await Promise.all(
          ['Alice@x.test', 'alice@x.test ', ' ALICE@X.TEST'].map((v) => contextFor(scope, v)),
        ),
      );
      expect(subjects.size).toBe(1);
      expect([...subjects][0]).not.toContain('@');
    }
    expect(await contextFor('email', ' Alice@x.test ')).toBe(sha('alice@x.test'));
  });

  test('phone identities drop spaces, dashes and parentheses and keep the leading +', async () => {
    const subjects = new Set(
      await Promise.all(
        ['+234 800 000 0000', '+234-800-000-0000', ' +234 (800) 000-0000 ', '+2348000000000'].map(
          (v) => contextFor('phone', v),
        ),
      ),
    );
    expect([...subjects]).toEqual([sha('+2348000000000')]);
    expect(normaliseIdentity('phone', ' (0800) 000 0000')).toBe('08000000000');
  });

  test('X-Forwarded-For stands in for Cloudflare in local only (GAP-MOD00-36)', async () => {
    let subject: string | undefined;
    const appIn = (appEnv: 'local' | 'staging') => {
      const app = createRouter();
      app.use('*', requestContext(createLogger('error')));
      app.use('*', originLock({ appEnv, secret: 'origin-secret' }));
      app.get('/', (c) => ((subject = resolveSubject({ scope: 'ip' }, c)), c.text('ok')));
      return app;
    };
    const local = appIn('local');
    await local.request('/', { headers: { 'x-forwarded-for': '5.5.5.5, 6.6.6.6' } });
    expect(subject).toBe('5.5.5.5');
    await local.request('/');
    expect(subject).toBe('unknown');

    const staging = appIn('staging');
    await staging.request('/', {
      headers: {
        [ORIGIN_SECRET_HEADER]: 'origin-secret',
        'cf-connecting-ip': '7.7.7.7',
        'x-forwarded-for': '5.5.5.5',
      },
    });
    expect(subject).toBe('7.7.7.7');
  });
});

describe('checkRateLimit, for handlers that count some events only', () => {
  test('counts per call and reports allowed, then locked', async () => {
    const rateLimits = await rateLimitsWith([policy({ key: 'login.test', lockoutSeconds: 900 })]);
    const logger = createLogger('error');
    expect(await checkRateLimit(rateLimits, 'login.test', 'acct', logger)).toMatchObject({
      outcome: 'allowed',
      remaining: 1,
    });
    await checkRateLimit(rateLimits, 'login.test', 'acct', logger);
    expect(await checkRateLimit(rateLimits, 'login.test', 'acct', logger)).toMatchObject({
      outcome: 'locked',
      retryAfterSeconds: 900,
    });
  });
});
