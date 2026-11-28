import { describe, expect, spyOn, test } from 'bun:test';
import type { Environment } from '@1minitman/contracts';
import { requestContext } from '../http/middleware';
import { errorHandler } from '../http/problem';
import { createRouter } from '../http/router';
import { createLogger } from '../logger';
import { clientIp } from '../rate-limit';
import { ORIGIN_SECRET_HEADER, originLock } from './origin-lock';

const SECRET = 'origin-secret-for-tests-only-0123456789';

const appIn = (appEnv: Environment, secret = SECRET, level: 'warn' | 'error' = 'error') => {
  const logger = createLogger(level);
  const app = createRouter();
  app.onError(errorHandler);
  app.use('*', requestContext(logger));
  app.use('*', originLock({ appEnv, secret }));
  app.get('/ready', (c) => c.json({ ip: clientIp(c) }));
  return app;
};

const viaCloudflare = (ip = '203.0.113.9', extra: Record<string, string> = {}) => ({
  headers: { [ORIGIN_SECRET_HEADER]: SECRET, 'cf-connecting-ip': ip, ...extra },
});

describe('originLock outside local (rule 9)', () => {
  test.each(['dev', 'demo', 'staging', 'production'] as const)(
    '%s: a request through Cloudflare is served with the client IP from CF-Connecting-IP',
    async (appEnv) => {
      const res = await appIn(appEnv).request('/ready', viaCloudflare());
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ip: '203.0.113.9' });
    },
  );

  test('a request at the origin directly is refused with 404 not_found', async () => {
    const res = await appIn('staging').request('/ready');
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/problem+json');
    expect(await res.json()).toMatchObject({ reason: 'not_found', status: 404 });
  });

  test('a wrong or empty secret is refused', async () => {
    const app = appIn('production');
    for (const value of ['wrong', '', `${SECRET}x`, SECRET.slice(0, -1)]) {
      const res = await app.request('/ready', {
        headers: { [ORIGIN_SECRET_HEADER]: value, 'cf-connecting-ip': '203.0.113.9' },
      });
      expect(res.status).toBe(404);
    }
  });

  test('a spoofed CF-Connecting-IP without the secret is refused', async () => {
    const res = await appIn('staging').request('/ready', {
      headers: { 'cf-connecting-ip': '198.51.100.1' },
    });
    expect(res.status).toBe(404);
  });

  test('the secret without a valid CF-Connecting-IP is refused', async () => {
    const app = appIn('staging');
    expect(
      (await app.request('/ready', { headers: { [ORIGIN_SECRET_HEADER]: SECRET } })).status,
    ).toBe(404);
    expect((await app.request('/ready', viaCloudflare('not-an-ip'))).status).toBe(404);
  });

  test('X-Forwarded-For is never the client IP (GAP-MOD00-36)', async () => {
    const res = await appIn('staging').request(
      '/ready',
      viaCloudflare('2001:db8::1', { 'x-forwarded-for': '198.51.100.7' }),
    );
    expect(await res.json()).toEqual({ ip: '2001:db8::1' });
  });

  test('with no secret configured every request is refused', async () => {
    const res = await appIn('staging', '').request('/ready', viaCloudflare());
    expect(res.status).toBe(404);
  });

  test('a refusal is logged with its reason and never the presented value', async () => {
    const log = spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      await appIn('staging', SECRET, 'warn').request('/ready?x=1', {
        headers: { [ORIGIN_SECRET_HEADER]: 'guessed-value', 'cf-connecting-ip': '203.0.113.9' },
      });
      const lines = log.mock.calls.map(([line]) => String(line));
      const refusal = lines.find((line) => line.includes('did not come through Cloudflare'));
      expect(refusal).toBeDefined();
      expect(JSON.parse(refusal!)).toMatchObject({ reason: 'origin_secret', path: '/ready' });
      expect(lines.join('\n')).not.toContain('guessed-value');
    } finally {
      log.mockRestore();
    }
  });
});

describe('originLock in local', () => {
  test('nothing is refused', async () => {
    expect((await appIn('local').request('/ready')).status).toBe(200);
  });

  test('CF-Connecting-IP first, then the first X-Forwarded-For address, then unknown', async () => {
    const app = appIn('local');
    const ip = async (headers: Record<string, string>) =>
      ((await (await app.request('/ready', { headers })).json()) as { ip: string }).ip;
    expect(await ip({ 'cf-connecting-ip': '203.0.113.1', 'x-forwarded-for': '5.5.5.5' })).toBe(
      '203.0.113.1',
    );
    expect(await ip({ 'x-forwarded-for': '5.5.5.5, 6.6.6.6' })).toBe('5.5.5.5');
    expect(await ip({})).toBe('unknown');
  });
});
