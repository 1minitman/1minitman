import { describe, expect, test } from 'bun:test';
import { createApp, type AppDeps } from './app';
import { createCheckReadiness } from './modules/system';
import { createLogger } from './platform/logger';

const probe = (name: 'database' | 'redis', ok: boolean) => ({
  name,
  ping: () => (ok ? Promise.resolve() : Promise.reject(new Error('connection refused'))),
});

const build = (databaseUp = true) =>
  createApp({
    env: { APP_ENV: 'local', APP_VERSION: 'test', CORS_ALLOWED_ORIGINS: ['http://localhost:5173'] },
    logger: createLogger('error'),
    checkReadiness: createCheckReadiness({
      database: probe('database', databaseUp),
      redis: probe('redis', true),
    }),
  } satisfies AppDeps);

describe('system routes', () => {
  test('GET /health answers without touching dependencies', async () => {
    const res = await build(false).request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'ok', service: '1minitman-api' });
    expect(res.headers.get('x-request-id')).toBeTruthy();
  });

  test('GET /ready is 503 when the database is down', async () => {
    const res = await build(false).request('/ready');
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({
      status: 'degraded',
      checks: { database: { status: 'down' } },
    });
  });
});

describe('errors', () => {
  test('unknown routes return problem+json with the request id', async () => {
    const res = await build().request('/v1/nope', { headers: { 'x-request-id': 'req_12345678' } });
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/problem+json');
    expect(await res.json()).toMatchObject({ status: 404, request_id: 'req_12345678' });
  });
});

describe('cors', () => {
  test('only configured origins are allowed', async () => {
    const app = build();
    const ok = await app.request('/health', { headers: { Origin: 'http://localhost:5173' } });
    const no = await app.request('/health', { headers: { Origin: 'https://evil.example' } });
    expect(ok.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    expect(no.headers.get('access-control-allow-origin')).toBeNull();
  });
});
