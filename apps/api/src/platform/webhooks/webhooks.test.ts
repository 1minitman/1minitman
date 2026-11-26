import { describe, expect, test } from 'bun:test';
import { requestContext } from '../http/middleware';
import { errorHandler, notFoundHandler } from '../http/problem';
import { createRouter, type Router } from '../http/router';
import { createLogger, type Logger } from '../logger';
import { createFakeVendor, FAKE_SIGNATURE_HEADER, signFake } from './fake-vendor';
import { createWebhookIntake, type WebhookQueue } from './intake';
import { mountWebhookRoutes } from './routes';
import { createMemoryWebhookStore, type StoredWebhookEvent, type WebhookStore } from './store';
import { constantTimeEqual, type WebhookVendor } from './vendor';

// MOD-00 plan §4.3 rule 11 and the response table of 1MM-STD-13 §4.7, against a fake vendor and
// an in-memory store. The PostgreSQL store is covered in webhooks.integration.test.ts.

const SECRET = 'test-secret-not-real';

const recordingLogger = () => {
  const lines: { level: string; message: string; fields?: Record<string, unknown> }[] = [];
  const make = (): Logger => ({
    debug: (message, fields) => lines.push({ level: 'debug', message, fields }),
    info: (message, fields) => lines.push({ level: 'info', message, fields }),
    warn: (message, fields) => lines.push({ level: 'warn', message, fields }),
    error: (message, fields) => lines.push({ level: 'error', message, fields }),
    child: () => make(),
  });
  return { logger: make(), lines };
};

const setup = (
  options: { store?: WebhookStore; queue?: WebhookQueue; vendor?: WebhookVendor } = {},
) => {
  const store = createMemoryWebhookStore();
  const enqueued: StoredWebhookEvent[] = [];
  const queue: WebhookQueue = options.queue ?? {
    enqueue: (event) => {
      enqueued.push(event);
      return Promise.resolve();
    },
  };
  const { logger, lines } = recordingLogger();
  const intake = createWebhookIntake({ store: options.store ?? store, queue, logger });
  intake.register(options.vendor ?? createFakeVendor({ secret: SECRET, path: 'fake' }));
  const app = createRouter();
  app.use('*', requestContext(createLogger('error')));
  app.onError(errorHandler);
  app.notFound(notFoundHandler);
  app.route('/', mountWebhookRoutes(createRouter().basePath('/webhooks') as Router, intake));
  return { app, store, enqueued, intake, lines };
};

const event = (id: string, type = 'thing.happened', data: unknown = { n: 1 }) =>
  JSON.stringify({ id, type, data });

const post = (
  app: Router,
  body: string,
  signature: string | null = signFake(SECRET, body),
  path = 'fake',
) =>
  app.request(`/webhooks/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(signature === null ? {} : { [FAKE_SIGNATURE_HEADER]: signature }),
    },
    body,
  });

const reasonOf = async (res: Response) => ((await res.json()) as { reason: string }).reason;

describe('webhook intake: rule 11 and 1MM-STD-13 §4.7', () => {
  test('a correctly signed event is stored once, acknowledged with 200 and enqueued', async () => {
    const { app, store, enqueued } = setup();
    const res = await post(app, event('evt_1'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    const row = [...store.rows.values()][0];
    expect(row).toMatchObject({
      provider: 'carrier',
      eventId: 'evt_1',
      eventType: 'thing.happened',
      signatureValid: true,
      status: 'received',
    });
    expect(enqueued.map((e) => e.id)).toEqual([row?.id ?? '']);
  });

  test('an invalid signature is stored with signature_valid = false, 401, never processed', async () => {
    const { app, store, enqueued, lines } = setup();
    const body = event('evt_forged');
    const res = await post(app, body, signFake('wrong-secret', body));
    expect(res.status).toBe(401);
    expect(res.headers.get('content-type')).toContain('application/problem+json');
    expect(await reasonOf(res)).toBe('webhook_signature_invalid');
    expect([...store.rows.values()]).toEqual([
      expect.objectContaining({ eventId: 'evt_forged', signatureValid: false, status: 'ignored' }),
    ]);
    expect(enqueued).toHaveLength(0);
    const warn = lines.find((l) => l.message === 'webhook signature invalid');
    expect(warn?.fields).toEqual({ provider: 'carrier', stored: true });
  });

  test('a missing signature is the same as an invalid one', async () => {
    const { app, store, enqueued } = setup();
    const res = await post(app, event('evt_unsigned'), null);
    expect(res.status).toBe(401);
    expect([...store.rows.values()][0]?.signatureValid).toBe(false);
    expect(enqueued).toHaveLength(0);
  });

  test('an invalid signature on a body that names no event is refused and not stored', async () => {
    const { app, store } = setup();
    const res = await post(app, 'not json', 'deadbeef');
    expect(res.status).toBe(401);
    expect(store.rows.size).toBe(0);
  });

  test('a signature check that throws fails closed', async () => {
    const vendor = {
      ...createFakeVendor({ secret: SECRET, path: 'fake' }),
      verify: () => {
        throw new TypeError('no signature matches header t=1,v1=abc for body {"phone":"x"}');
      },
    };
    const { app, enqueued, lines } = setup({ vendor });
    const res = await post(app, event('evt_throw'));
    expect(res.status).toBe(401);
    expect(enqueued).toHaveLength(0);
    // Logged with a payload-free label: a vendor library's message can quote the header or body.
    const logged = lines.find((l) => l.message === 'webhook signature check threw');
    expect(logged?.fields).toEqual({ provider: 'carrier', error: 'TypeError' });
    expect(JSON.stringify(lines)).not.toContain('phone');
  });

  test('a duplicate (provider, event_id) is acknowledged with the same 200 and ignored', async () => {
    const { app, store, enqueued } = setup();
    const body = event('evt_dup');
    const first = await post(app, body);
    const again = await Promise.all([
      post(app, body),
      post(app, event('evt_dup', 'thing.happened', 2)),
    ]);
    expect([first.status, ...again.map((r) => r.status)]).toEqual([200, 200, 200]);
    for (const res of again) expect(await res.json()).toEqual({ received: true });
    expect(store.rows.size).toBe(1);
    expect(enqueued).toHaveLength(1);
  });

  test('a forged copy cannot make the genuine event a duplicate', async () => {
    const { app, store, enqueued } = setup();
    const forged = event('evt_race', 'thing.happened', { forged: true });
    expect((await post(app, forged, 'bad')).status).toBe(401);
    const genuine = event('evt_race', 'thing.happened', { genuine: true });
    expect((await post(app, genuine)).status).toBe(200);
    const row = [...store.rows.values()][0];
    expect(row).toMatchObject({ signatureValid: true, status: 'received' });
    expect(row?.payload).toEqual({
      id: 'evt_race',
      type: 'thing.happened',
      data: { genuine: true },
    });
    expect(enqueued).toHaveLength(1);
    // A later forged copy changes nothing.
    expect((await post(app, forged, 'bad')).status).toBe(401);
    expect([...store.rows.values()][0]?.signatureValid).toBe(true);
    expect(enqueued).toHaveLength(1);
  });

  test('an event type the owning module does not use is stored as ignored, 200, not enqueued', async () => {
    const { app, store, enqueued } = setup();
    const res = await post(app, event('evt_other', 'thing.unused'));
    expect(res.status).toBe(200);
    expect([...store.rows.values()][0]?.status).toBe('ignored');
    expect(enqueued).toHaveLength(0);
  });

  test('a correctly signed body that is not an event is 400 bad_request and not stored', async () => {
    const { app, store } = setup();
    for (const body of [
      'not json',
      JSON.stringify({ id: 'x' }),
      JSON.stringify({ id: '', type: 't' }),
    ]) {
      const res = await post(app, body);
      expect(res.status).toBe(400);
      expect(await reasonOf(res)).toBe('bad_request');
    }
    expect(store.rows.size).toBe(0);
  });

  test('an unknown vendor path is 404 not_found', async () => {
    const { app } = setup();
    const res = await post(app, event('evt_x'), null, 'nobody');
    expect(res.status).toBe(404);
    expect(await reasonOf(res)).toBe('not_found');
  });

  test('when the event cannot be stored the vendor gets 503 so it retries', async () => {
    const failure = Object.assign(new Error('Failed query: insert ... params: {"phone":"x"}'), {
      cause: { code: 'ECONNREFUSED' },
    });
    const store: WebhookStore = { record: () => Promise.reject(failure) };
    const { app, enqueued, lines } = setup({ store });
    const res = await post(app, event('evt_down'));
    expect(res.status).toBe(503);
    expect(await reasonOf(res)).toBe('dependency_unavailable');
    expect(enqueued).toHaveLength(0);
    // The log names the driver code, never the message, which carries the payload.
    const logged = lines.find((l) => l.message === 'webhook could not be stored');
    expect(logged?.fields).toEqual({ provider: 'carrier', error: 'ECONNREFUSED' });
    expect(JSON.stringify(lines)).not.toContain('phone');
    // An invalid signature stays 401 even when it cannot be stored.
    expect((await post(app, event('evt_down2'), 'bad')).status).toBe(401);
  });

  test('an enqueue failure still acknowledges: the row stays pending for webhooks.retry', async () => {
    const failure = Object.assign(new Error('insert job failed: {"phone":"x"}'), { code: '57P01' });
    const queue: WebhookQueue = { enqueue: () => Promise.reject(failure) };
    const { app, store, lines } = setup({ queue });
    const res = await post(app, event('evt_q'));
    expect(res.status).toBe(200);
    const row = [...store.rows.values()][0];
    expect(row?.status).toBe('received');
    const logged = lines.find((l) => l.message.startsWith('webhook enqueue failed'));
    expect(logged?.fields).toEqual({
      provider: 'carrier',
      webhook_event_id: row?.id,
      error: '57P01',
    });
    expect(JSON.stringify(lines)).not.toContain('phone');
  });

  test('the same event id from two providers is two events', async () => {
    const store = createMemoryWebhookStore();
    const { app, intake } = setup({ store });
    intake.register(createFakeVendor({ secret: SECRET, path: 'fake-two', provider: 'daily' }));
    const body = event('evt_shared');
    expect((await post(app, body)).status).toBe(200);
    expect((await post(app, body, signFake(SECRET, body), 'fake-two')).status).toBe(200);
    expect(store.rows.size).toBe(2);
  });
});

describe('webhook vendor registration', () => {
  const { intake } = setup();
  test('a path is lower-case letters, digits and dashes, and registered once', () => {
    expect(() => intake.register(createFakeVendor({ secret: SECRET, path: 'Bad/Path' }))).toThrow();
    expect(() => intake.register(createFakeVendor({ secret: SECRET, path: '' }))).toThrow();
    expect(() => intake.register(createFakeVendor({ secret: SECRET, path: 'fake' }))).toThrow(
      /already registered/,
    );
  });

  test('the provider must be one webhook_events accepts', () => {
    const vendor = {
      ...createFakeVendor({ secret: SECRET, path: 'other' }),
      provider: 'acme',
    } as unknown as WebhookVendor;
    expect(() => intake.register(vendor)).toThrow(/webhook_events.provider/);
  });
});

describe('constantTimeEqual()', () => {
  test('equal only for the same bytes, whatever the input form', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true);
    expect(constantTimeEqual('abc', new TextEncoder().encode('abc'))).toBe(true);
    expect(constantTimeEqual('abc', 'abd')).toBe(false);
    expect(constantTimeEqual('abc', 'abcd')).toBe(false);
    expect(constantTimeEqual('', '')).toBe(true);
  });
});
