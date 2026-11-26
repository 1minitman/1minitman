import { describe, expect, test } from 'bun:test';
import { requestContext } from '../http/middleware';
import { errorHandler } from '../http/problem';
import { createRouter } from '../http/router';
import { createLogger } from '../logger';
import {
  ADMIN_PIPELINE,
  createAdminGuards,
  currentAdmin,
  denyAllAdminAuthPorts,
  type AdminAuthPorts,
  type AdminCheck,
  type AdminCheckInput,
  type AdminPrincipal,
  type AdminRequest,
} from './index';

const ADMIN: AdminPrincipal = {
  adminId: '0190a8a4-0000-7000-8000-0000000000b1',
  sessionId: '0190a8a4-0000-7000-8000-0000000000b2',
};
const allow: AdminCheck = () => Promise.resolve({ allow: true });

/** Ports that allow everything and record the order in which they were asked. */
const recordingPorts = (calls: string[], overrides: Partial<AdminAuthPorts> = {}) => {
  const record =
    (name: string, check: AdminCheck): AdminCheck =>
    (input) => {
      calls.push(name);
      return check(input);
    };
  const base: AdminAuthPorts = {
    session: () => {
      calls.push('session');
      return Promise.resolve({ allow: true, principal: ADMIN });
    },
    status: allow,
    permission: allow,
    scope: allow,
    ip: allow,
    reauth: allow,
  };
  const ports = { ...base, ...overrides };
  return {
    ...ports,
    session: overrides.session
      ? (request: AdminRequest) => {
          calls.push('session');
          return overrides.session!(request);
        }
      : base.session,
    status: record('status', ports.status),
    permission: record('permission', ports.permission),
    scope: record('scope', ports.scope),
    ip: record('ip', ports.ip),
    reauth: record('reauth', ports.reauth),
  } satisfies AdminAuthPorts;
};

const appWith = (ports: AdminAuthPorts) => {
  const guards = createAdminGuards(ports);
  const app = createRouter().basePath('/admin/v1');
  app.use('*', requestContext(createLogger('error')));
  app.onError(errorHandler);
  app.get('/users', guards.requireAdmin('users.read'), (c) => c.json(currentAdmin(c)));
  app.get('/unguarded', (c) => c.json(currentAdmin(c)));
  return app;
};

const expectProblem = async (res: Response, status: number, reason: string) => {
  expect(res.status).toBe(status);
  expect(res.headers.get('content-type')).toContain('application/problem+json');
  const body = (await res.json()) as Record<string, unknown>;
  expect(body).toMatchObject({ status, reason });
  expect(typeof body.request_id).toBe('string');
  return body;
};

describe('requireAdmin with the deny-by-default ports', () => {
  test('no credentials: 401 unauthenticated', async () => {
    await expectProblem(
      await appWith(denyAllAdminAuthPorts()).request('/admin/v1/users'),
      401,
      'unauthenticated',
    );
  });

  test('a member access token is not a credential here: still 401', async () => {
    const res = await appWith(denyAllAdminAuthPorts()).request('/admin/v1/users', {
      headers: { authorization: 'Bearer member.access.token' },
    });
    await expectProblem(res, 401, 'unauthenticated');
  });

  test('every stub check refuses with its own registry code', async () => {
    const stubs = denyAllAdminAuthPorts();
    const input: AdminCheckInput = {
      principal: ADMIN,
      permission: 'users.ban',
      request: { method: 'GET', path: '/admin/v1/x', headers: new Headers(), ip: '203.0.113.9' },
    };
    expect(await stubs.status(input)).toEqual({ allow: false, code: 'suspended' });
    expect(await stubs.permission(input)).toEqual({
      allow: false,
      code: 'permission',
      details: { permission: 'users.ban' },
    });
    expect(await stubs.scope(input)).toEqual({ allow: false, code: 'not_found' });
    expect(await stubs.ip(input)).toEqual({ allow: false, code: 'ip_not_allowed' });
    expect(await stubs.reauth(input)).toEqual({ allow: false, code: 'reauth_required' });
  });
});

describe('requireAdmin pipeline', () => {
  test('runs session, status, permission, scope, IP, re-auth in that order', async () => {
    const calls: string[] = [];
    const res = await appWith(recordingPorts(calls)).request('/admin/v1/users');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(ADMIN);
    expect(calls).toEqual(['session', ...ADMIN_PIPELINE]);
    expect(ADMIN_PIPELINE).toEqual(['status', 'permission', 'scope', 'ip', 'reauth']);
  });

  test('checks receive the principal, the route permission and the request', async () => {
    const seen: AdminCheckInput[] = [];
    const ports = recordingPorts([], {
      permission: (input) => {
        seen.push(input);
        return Promise.resolve({ allow: true });
      },
    });
    await appWith(ports).request('/admin/v1/users?q=secret', {
      headers: { 'cf-connecting-ip': '203.0.113.7' },
    });
    expect(seen).toHaveLength(1);
    expect(seen[0]?.principal).toEqual(ADMIN);
    expect(seen[0]?.permission).toBe('users.read');
    expect(seen[0]?.request).toMatchObject({
      method: 'GET',
      path: '/admin/v1/users',
      ip: '203.0.113.7',
    });
  });

  test('a session refusal (revoked, idle, expired) stops before any other check', async () => {
    const calls: string[] = [];
    const ports = recordingPorts(calls, {
      session: () => Promise.resolve({ allow: false, code: 'session_expired' }),
    });
    await expectProblem(await appWith(ports).request('/admin/v1/users'), 401, 'session_expired');
    expect(calls).toEqual(['session']);
  });

  const refusals = [
    { step: 'status', code: 'suspended', status: 403 },
    { step: 'permission', code: 'permission', status: 403 },
    { step: 'scope', code: 'not_found', status: 404 },
    { step: 'ip', code: 'ip_not_allowed', status: 403 },
    { step: 'reauth', code: 'reauth_required', status: 403 },
  ] as const;

  for (const { step, code, status } of refusals) {
    test(`a ${step} refusal answers ${status} ${code} and later checks never run`, async () => {
      const calls: string[] = [];
      const ports = recordingPorts(calls, { [step]: denyAllAdminAuthPorts()[step] });
      const body = await expectProblem(
        await appWith(ports).request('/admin/v1/users'),
        status,
        code,
      );
      const index = ADMIN_PIPELINE.indexOf(step);
      expect(calls).toEqual(['session', ...ADMIN_PIPELINE.slice(0, index + 1)]);
      if (step === 'permission') expect(body.permission).toBe('users.read');
    });
  }

  test('a failing check is an internal error, never an allow', async () => {
    const ports = recordingPorts([], { ip: () => Promise.reject(new Error('db down')) });
    await expectProblem(await appWith(ports).request('/admin/v1/users'), 500, 'internal');
  });

  test('a permission key is required to build the guard', () => {
    expect(() => createAdminGuards(denyAllAdminAuthPorts()).requireAdmin('')).toThrow();
  });
});

describe('currentAdmin', () => {
  test('on a route without the guard it raises 401 rather than returning nothing', async () => {
    await expectProblem(
      await appWith(denyAllAdminAuthPorts()).request('/admin/v1/unguarded'),
      401,
      'unauthenticated',
    );
  });
});
