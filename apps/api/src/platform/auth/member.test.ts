import { RedisClient } from 'bun';
import { afterAll, describe, expect, spyOn, test } from 'bun:test';
import { requestContext } from '../http/middleware';
import { errorHandler } from '../http/problem';
import { createRouter } from '../http/router';
import { createLogger } from '../logger';
import {
  bearerToken,
  createMemberGuards,
  createRedisSessionDenyList,
  currentMember,
  denyAllMemberAuthPorts,
  SESSION_DENY_LIST_TIMEOUT_MS,
  sessionDenyKey,
  type MemberAuthPorts,
  type MemberPrincipal,
} from './index';

const MEMBER: MemberPrincipal = {
  memberId: '0190a8a4-0000-7000-8000-000000000001',
  sessionId: '0190a8a4-0000-7000-8000-0000000000aa',
};

/** Ports that accept exactly one token; everything else is configurable per test. */
const ports = (overrides: Partial<MemberAuthPorts> = {}): MemberAuthPorts => ({
  tokens: { verify: (token) => Promise.resolve(token === 'good.token.sig' ? MEMBER : null) },
  denyList: { isDenied: () => Promise.resolve(false) },
  recentAuth: { isRecent: () => Promise.resolve(true) },
  ...overrides,
});

const appWith = (p: MemberAuthPorts) => {
  const guards = createMemberGuards(p);
  const app = createRouter().basePath('/v1');
  app.use('*', requestContext(createLogger('error')));
  app.onError(errorHandler);
  app.get('/me', guards.requireMember(), (c) => c.json(currentMember(c)));
  app.put('/me/password', guards.requireMember(), guards.requireRecentAuth(), (c) =>
    c.body(null, 204),
  );
  app.get('/unguarded-recent', guards.requireRecentAuth(), (c) => c.text('ok'));
  app.get('/unguarded-current', (c) => c.json(currentMember(c)));
  return app;
};
const bearer = (token: string) => ({ headers: { authorization: `Bearer ${token}` } });

const expectProblem = async (res: Response, status: number, reason: string) => {
  expect(res.status).toBe(status);
  expect(res.headers.get('content-type')).toContain('application/problem+json');
  const body = (await res.json()) as Record<string, unknown>;
  expect(body).toMatchObject({ status, reason });
  expect(typeof body.request_id).toBe('string');
};

describe('bearerToken', () => {
  test('reads the token of a Bearer header, scheme case-insensitive', () => {
    expect(bearerToken('Bearer abc.def-ghi_jk')).toBe('abc.def-ghi_jk');
    expect(bearerToken('bearer abc')).toBe('abc');
  });

  test('rejects missing, empty, other schemes and tokens with spaces', () => {
    for (const header of [undefined, '', 'Bearer', 'Bearer ', 'Basic dXNlcjpwYXNz', 'Bearer a b']) {
      expect(bearerToken(header)).toBeUndefined();
    }
  });
});

describe('requireMember', () => {
  test('no credentials: 401 unauthenticated, and the verifier is not called', async () => {
    let calls = 0;
    const app = appWith(
      ports({
        tokens: {
          verify: () => {
            calls += 1;
            return Promise.resolve(MEMBER);
          },
        },
      }),
    );
    await expectProblem(await app.request('/v1/me'), 401, 'unauthenticated');
    expect(calls).toBe(0);
  });

  test('a malformed header or a token the verifier refuses: 401 unauthenticated', async () => {
    const app = appWith(ports());
    await expectProblem(
      await app.request('/v1/me', { headers: { authorization: 'Basic dXNlcjpwYXNz' } }),
      401,
      'unauthenticated',
    );
    await expectProblem(
      await app.request('/v1/me', bearer('expired.or.forged')),
      401,
      'unauthenticated',
    );
  });

  test('a valid token on a live session reaches the handler with the member in context', async () => {
    const res = await appWith(ports()).request('/v1/me', bearer('good.token.sig'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(MEMBER);
  });

  test('a revoked session: 401 session_expired; the denylist is asked for that session', async () => {
    const asked: string[] = [];
    const app = appWith(
      ports({
        denyList: {
          isDenied: (sessionId) => {
            asked.push(sessionId);
            return Promise.resolve(true);
          },
        },
      }),
    );
    await expectProblem(
      await app.request('/v1/me', bearer('good.token.sig')),
      401,
      'session_expired',
    );
    expect(asked).toEqual([MEMBER.sessionId]);
  });

  test('denylist unreachable: fails closed with 503 dependency_unavailable', async () => {
    const app = appWith(
      ports({ denyList: { isDenied: () => Promise.reject(new Error('redis down')) } }),
    );
    await expectProblem(
      await app.request('/v1/me', bearer('good.token.sig')),
      503,
      'dependency_unavailable',
    );
  });

  test('the deny-by-default ports refuse every request, with or without a token', async () => {
    const app = appWith(denyAllMemberAuthPorts());
    await expectProblem(await app.request('/v1/me'), 401, 'unauthenticated');
    await expectProblem(
      await app.request('/v1/me', bearer('good.token.sig')),
      401,
      'unauthenticated',
    );
  });
});

describe('requireRecentAuth', () => {
  test('re-authenticated within the window: the M+ route runs', async () => {
    const res = await appWith(ports()).request('/v1/me/password', {
      method: 'PUT',
      ...bearer('good.token.sig'),
    });
    expect(res.status).toBe(204);
  });

  test('outside the window: 403 reauth_required, asked for the signed-in member', async () => {
    const asked: MemberPrincipal[] = [];
    const app = appWith(
      ports({
        recentAuth: {
          isRecent: (principal) => {
            asked.push(principal);
            return Promise.resolve(false);
          },
        },
      }),
    );
    const res = await app.request('/v1/me/password', {
      method: 'PUT',
      ...bearer('good.token.sig'),
    });
    await expectProblem(res, 403, 'reauth_required');
    expect(asked).toEqual([MEMBER]);
  });

  test('without credentials the M+ route is 401, not 403', async () => {
    const app = appWith(ports());
    await expectProblem(
      await app.request('/v1/me/password', { method: 'PUT' }),
      401,
      'unauthenticated',
    );
  });

  test('used without requireMember it refuses with 401', async () => {
    await expectProblem(
      await appWith(ports()).request('/v1/unguarded-recent'),
      401,
      'unauthenticated',
    );
  });

  test('re-auth window unreadable: fails closed with 503 dependency_unavailable and logs', async () => {
    const app = appWith(
      ports({ recentAuth: { isRecent: () => Promise.reject(new Error('store down')) } }),
    );
    const logged = spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = await app.request('/v1/me/password', {
        method: 'PUT',
        ...bearer('good.token.sig'),
      });
      await expectProblem(res, 503, 'dependency_unavailable');
      const lines = logged.mock.calls.map(
        (call) => JSON.parse(String(call[0])) as Record<string, unknown>,
      );
      expect(lines).toContainEqual(
        expect.objectContaining({
          level: 'error',
          message: 're-auth window unavailable, refusing request',
          error: 'store down',
        }),
      );
    } finally {
      logged.mockRestore();
    }
  });

  test('the deny-by-default port refuses re-auth', async () => {
    expect(await denyAllMemberAuthPorts().recentAuth.isRecent(MEMBER)).toBe(false);
  });
});

describe('currentMember', () => {
  test('on a route without the guard it raises 401 rather than returning nothing', async () => {
    await expectProblem(
      await appWith(ports()).request('/v1/unguarded-current'),
      401,
      'unauthenticated',
    );
  });
});

// Integration: needs the local Redis (`pnpm services:up`).
const redisUrl = process.env.REDIS_URL;
const redis = redisUrl ? new RedisClient(redisUrl) : null;
afterAll(() => redis?.close());

describe.skipIf(!redis)('Redis session denylist', () => {
  test('a session is denied while sess:deny:{session} exists, and only that session', async () => {
    if (!redis) return;
    const denyList = createRedisSessionDenyList(redis);
    const revoked = `test-${crypto.randomUUID()}`;
    const live = `test-${crypto.randomUUID()}`;
    expect(sessionDenyKey(revoked)).toBe(`sess:deny:${revoked}`);
    expect(await denyList.isDenied(revoked)).toBe(false);
    await redis.set(sessionDenyKey(revoked), '1', 'EX', 60);
    try {
      expect(await denyList.isDenied(revoked)).toBe(true);
      expect(await denyList.isDenied(live)).toBe(false);

      const app = appWith(
        ports({
          tokens: { verify: () => Promise.resolve({ ...MEMBER, sessionId: revoked }) },
          denyList,
        }),
      );
      await expectProblem(await app.request('/v1/me', bearer('any')), 401, 'session_expired');
    } finally {
      await redis.del(sessionDenyKey(revoked));
    }
  });

  test('an unreachable Redis rejects, so requireMember fails closed', async () => {
    const down = new RedisClient('redis://127.0.0.1:1', {
      autoReconnect: false,
      connectionTimeout: 500,
    });
    try {
      const app = appWith(ports({ denyList: createRedisSessionDenyList(down) }));
      await expectProblem(
        await app.request('/v1/me', bearer('good.token.sig')),
        503,
        'dependency_unavailable',
      );
    } finally {
      down.close();
    }
  });
});

describe('Redis session denylist timeout', () => {
  test('a Redis that accepts the connection but never answers rejects within the timeout', async () => {
    // A TCP listener that never replies: the command neither succeeds nor fails on its own.
    const silent = Bun.listen({ hostname: '127.0.0.1', port: 0, socket: { data() {} } });
    const hung = new RedisClient(`redis://127.0.0.1:${silent.port}`, {
      autoReconnect: false,
      connectionTimeout: 10_000,
    });
    try {
      const started = Date.now();
      const denyList = createRedisSessionDenyList(hung, 50);
      await expect(denyList.isDenied('any')).rejects.toThrow('timed out after 50 ms');
      expect(Date.now() - started).toBeLessThan(2_000);

      const app = appWith(ports({ denyList }));
      await expectProblem(
        await app.request('/v1/me', bearer('good.token.sig')),
        503,
        'dependency_unavailable',
      );
    } finally {
      hung.close();
      silent.stop(true);
    }
  });

  test('the coded default stays inside the 200 ms read budget', () => {
    expect(SESSION_DENY_LIST_TIMEOUT_MS).toBeGreaterThan(0);
    expect(SESSION_DENY_LIST_TIMEOUT_MS).toBeLessThan(200);
  });
});
