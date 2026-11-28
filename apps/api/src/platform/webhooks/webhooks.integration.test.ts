import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createDatabase, type Database } from '@1minitman/db';
import { createApp } from '../../app';
import { createCheckReadiness } from '../../modules/system';
import { denyAllAuth } from '../auth';
import { createMemoryIdempotencyStore } from '../idempotency';
import { createLogger } from '../logger';
import { createMemoryRateLimiter, createPolicyStore, staticPolicySource } from '../rate-limit';
import { createInMemoryRealtime } from '../realtime';
import { createFakeVendor, FAKE_SIGNATURE_HEADER, signFake } from './fake-vendor';
import { createWebhookIntake, type WebhookQueue } from './intake';
import { postgresWebhookStore } from './postgres-store';
import type { StoredWebhookEvent } from './store';

// MOD-00 plan task 14: rule 11 with a fake vendor, end to end through the API on the local
// PostgreSQL as `app_api` (`pnpm services:up && pnpm db:migrate && pnpm db:roles`). Event ids are
// random and every row is deleted afterwards.
const url = process.env.DATABASE_URL;
const ci = !['', 'false', '0'].includes(process.env.CI?.trim().toLowerCase() ?? '');
if (ci && !url) throw new Error('Webhook intake tests need DATABASE_URL in CI');
const SECRET = 'integration-secret-not-real';

describe.skipIf(!url)('webhook intake on PostgreSQL with a fake vendor', () => {
  let db: Database;
  let app: ReturnType<typeof createApp>;
  const enqueued: StoredWebhookEvent[] = [];
  const prefix = `test-api-${crypto.randomUUID()}`;

  beforeAll(() => {
    db = createDatabase({ url: url ?? '', surface: 'member', appEnv: 'local', max: 5 });
    const logger = createLogger('error');
    const queue: WebhookQueue = {
      enqueue: (event) => {
        enqueued.push(event);
        return Promise.resolve();
      },
    };
    const webhooks = createWebhookIntake({ store: postgresWebhookStore(db), queue, logger });
    webhooks.register(createFakeVendor({ secret: SECRET, path: 'fake' }));
    app = createApp({
      env: {
        APP_ENV: 'local',
        APP_VERSION: 'test',
        CORS_ALLOWED_ORIGINS: [],
        ORIGIN_SHARED_SECRET: '',
      },
      logger,
      checkReadiness: createCheckReadiness({
        database: { name: 'database', ping: () => Promise.resolve() },
        redis: { name: 'redis', ping: () => Promise.resolve() },
      }),
      surfaces: {
        rateLimits: {
          policies: createPolicyStore(staticPolicySource([])),
          limiter: createMemoryRateLimiter(),
        },
        auth: denyAllAuth(),
        idempotency: createMemoryIdempotencyStore(),
        realtime: createInMemoryRealtime(logger),
        webhooks,
      },
    });
  });
  afterAll(async () => {
    await db.sql`DELETE FROM webhook_events WHERE event_id LIKE ${`${prefix}-%`}`;
    await db.close();
  });

  const post = (body: string, signature: string) =>
    app.request('/webhooks/fake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [FAKE_SIGNATURE_HEADER]: signature },
      body,
    });
  const rowsFor = (eventId: string) =>
    db.sql<
      { signature_valid: boolean; status: string; event_type: string }[]
    >`SELECT signature_valid, status, event_type FROM webhook_events
      WHERE provider = 'carrier' AND event_id = ${eventId}`.then((rows) => [...rows]);

  test('an invalid signature is stored with signature_valid = false and never processed', async () => {
    const eventId = `${prefix}-forged`;
    const body = JSON.stringify({ id: eventId, type: 'thing.happened' });
    const res = await post(body, signFake('not-the-secret', body));
    expect(res.status).toBe(401);
    expect(((await res.json()) as { reason: string }).reason).toBe('webhook_signature_invalid');
    expect(await rowsFor(eventId)).toEqual([
      { signature_valid: false, status: 'ignored', event_type: 'thing.happened' },
    ]);
    expect(enqueued.some((e) => e.eventType === 'thing.happened' && e.id === eventId)).toBe(false);
  });

  test('a duplicate (provider, event_id) is acknowledged and ignored, also in parallel', async () => {
    const eventId = `${prefix}-dup`;
    const body = JSON.stringify({ id: eventId, type: 'thing.happened' });
    const before = enqueued.length;
    const responses = await Promise.all(
      Array.from({ length: 10 }, () => post(body, signFake(SECRET, body))),
    );
    expect(responses.map((r) => r.status)).toEqual(Array.from({ length: 10 }, () => 200));
    expect(await rowsFor(eventId)).toEqual([
      { signature_valid: true, status: 'received', event_type: 'thing.happened' },
    ]);
    expect(enqueued.length - before).toBe(1);
  });

  test('the genuine event replaces a forged copy that came first, and is processed', async () => {
    const eventId = `${prefix}-race`;
    const forged = JSON.stringify({ id: eventId, type: 'thing.happened', data: 'forged' });
    expect((await post(forged, 'bad')).status).toBe(401);
    const genuine = JSON.stringify({ id: eventId, type: 'thing.happened', data: 'genuine' });
    expect((await post(genuine, signFake(SECRET, genuine))).status).toBe(200);
    const [row] = await db.sql<{ signature_valid: boolean; data: string }[]>`
      SELECT signature_valid, payload->>'data' AS data FROM webhook_events
      WHERE provider = 'carrier' AND event_id = ${eventId}`;
    expect(row).toEqual({ signature_valid: true, data: 'genuine' });
    expect(enqueued.at(-1)?.status).toBe('received');
  });

  test('an unused event type is stored as ignored and not processed', async () => {
    const eventId = `${prefix}-unused`;
    const body = JSON.stringify({ id: eventId, type: 'thing.unused' });
    const before = enqueued.length;
    expect((await post(body, signFake(SECRET, body))).status).toBe(200);
    expect(await rowsFor(eventId)).toEqual([
      { signature_valid: true, status: 'ignored', event_type: 'thing.unused' },
    ]);
    expect(enqueued.length).toBe(before);
  });

  test('the database down: 503 so the vendor retries', async () => {
    const down = createDatabase({
      url: 'postgres://nobody@127.0.0.1:1/none',
      surface: 'member',
      appEnv: 'local',
      max: 1,
    });
    const intake = createWebhookIntake({
      store: postgresWebhookStore(down),
      queue: { enqueue: () => Promise.resolve() },
      logger: createLogger('error'),
    });
    const vendor = createFakeVendor({ secret: SECRET, path: 'fake' });
    intake.register(vendor);
    const body = JSON.stringify({ id: `${prefix}-down`, type: 'thing.happened' });
    await expect(
      intake.receive(vendor, {
        rawBody: new TextEncoder().encode(body),
        headers: new Headers({ [FAKE_SIGNATURE_HEADER]: signFake(SECRET, body) }),
      }),
    ).rejects.toThrow('webhook_events is unavailable');
    await down.close();
  });
});
