import { describe, expect, test } from 'bun:test';
import { isProblemCode, SURFACE_NAMES } from '@1minitman/contracts';
import { buildOpenApiDocument, createApp, type AppDeps } from './app';
import { createCheckReadiness } from './modules/system';
import { denyAllAuth } from './platform/auth';
import { createMemoryIdempotencyStore } from './platform/idempotency';
import { createLogger } from './platform/logger';
import { ORIGIN_SECRET_HEADER } from './platform/origin';
import {
  createMemoryRateLimiter,
  createPolicyStore,
  staticPolicySource,
} from './platform/rate-limit';
import { createInMemoryRealtime } from './platform/realtime';
import {
  createMemoryWebhookStore,
  createWebhookIntake,
  pendingRowWebhookQueue,
} from './platform/webhooks';

const probe = (name: 'database' | 'redis', ok: boolean) => ({
  name,
  ping: () => (ok ? Promise.resolve() : Promise.reject(new Error('connection refused'))),
});

const deps = (databaseUp = true, env: Partial<AppDeps['env']> = {}): AppDeps => ({
  env: {
    APP_ENV: 'local',
    APP_VERSION: 'test',
    CORS_ALLOWED_ORIGINS: ['http://localhost:5173'],
    ORIGIN_SHARED_SECRET: '',
    ...env,
  },
  logger: createLogger('error'),
  checkReadiness: createCheckReadiness({
    database: probe('database', databaseUp),
    redis: probe('redis', true),
  }),
  surfaces: {
    rateLimits: {
      policies: createPolicyStore(staticPolicySource([])),
      limiter: createMemoryRateLimiter(),
    },
    auth: denyAllAuth(),
    idempotency: createMemoryIdempotencyStore(),
    realtime: createInMemoryRealtime(createLogger('error')),
    webhooks: createWebhookIntake({
      store: createMemoryWebhookStore(),
      queue: pendingRowWebhookQueue,
      logger: createLogger('error'),
    }),
  },
});
const build = (databaseUp = true) => createApp(deps(databaseUp));

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
    expect(await res.json()).toMatchObject({
      type: 'tag:1minitman.com,2026:problem:not_found',
      status: 404,
      reason: 'not_found',
      request_id: 'req_12345678',
    });
  });

  test('every documented route answers only with registry codes', async () => {
    const app = build(false);
    for (const surface of SURFACE_NAMES) {
      const doc = buildOpenApiDocument(deps(false), surface);
      for (const path of Object.keys(doc.paths ?? {})) {
        const res = await app.request(path, { headers: { authorization: 'Bearer not-a-token' } });
        if (res.status < 400 || !res.headers.get('content-type')?.includes('problem+json'))
          continue;
        const body = (await res.json()) as { reason?: unknown; type?: unknown };
        expect(isProblemCode(body.reason)).toBe(true);
        expect(body.type).not.toBe('about:blank');
      }
    }
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

describe('origin lock (MOD-00 rule 9)', () => {
  const secret = 'b'.repeat(64);
  const staging = () => createApp(deps(true, { APP_ENV: 'staging', ORIGIN_SHARED_SECRET: secret }));
  const viaCloudflare = { [ORIGIN_SECRET_HEADER]: secret, 'cf-connecting-ip': '203.0.113.9' };

  test('staging /ready is 200 through Cloudflare and refused at the origin directly', async () => {
    const app = staging();
    expect((await app.request('/ready', { headers: viaCloudflare })).status).toBe(200);
    const direct = await app.request('/ready');
    expect(direct.status).toBe(404);
    expect(await direct.json()).toMatchObject({ reason: 'not_found' });
  });

  test('every path is locked, the docs and the webhooks included', async () => {
    const app = staging();
    for (const path of ['/health', '/docs', '/openapi/member.json', '/v1/ws']) {
      expect((await app.request(path)).status).toBe(404);
    }
    const webhook = await app.request('/webhooks/any', { method: 'POST', body: '{}' });
    expect(webhook.status).toBe(404);
  });

  test('local serves direct requests', async () => {
    expect((await build().request('/ready')).status).toBe(200);
  });
});

describe('body limits (MOD-00 behaviour 12)', () => {
  test('a public body over 64 KiB is 413 payload_too_large with the limit', async () => {
    const res = await build().request('/public/v1/anything', {
      method: 'POST',
      body: 'a'.repeat(64 * 1024 + 1),
      headers: { 'content-type': 'application/json' },
    });
    expect(res.status).toBe(413);
    expect(await res.json()).toMatchObject({ reason: 'payload_too_large', limit: 65_536 });
  });

  test('a webhook body over 1 MiB is refused before the intake reads it', async () => {
    const res = await build().request('/webhooks/fake', {
      method: 'POST',
      body: 'a'.repeat(1024 * 1024 + 1),
    });
    expect(res.status).toBe(413);
  });
});
