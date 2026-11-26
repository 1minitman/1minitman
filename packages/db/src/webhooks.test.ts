import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createDatabase, type Database } from './client';
import { databaseReady } from './test-env';
import { recordWebhookEvent, type NewWebhookEvent } from './webhooks';

// recordWebhookEvent() on PostgreSQL 16 as the member API login (`app_api`): stored once under
// UNIQUE (provider, event_id), also under parallel deliveries [TR §12], [SQL]. Event ids are
// random and every row written is deleted afterwards.
const url = process.env.DATABASE_URL;
const ready = databaseReady({ DATABASE_URL: url });

describe.skipIf(!ready)('recordWebhookEvent() on PostgreSQL', () => {
  let db: Database;
  const prefix = `test-db-${crypto.randomUUID()}`;
  let n = 0;
  const newId = () => `${prefix}-${++n}`;

  const event = (eventId: string, over: Partial<NewWebhookEvent> = {}): NewWebhookEvent => ({
    provider: 'carrier',
    eventId,
    eventType: 'thing.happened',
    signatureValid: true,
    payload: { eventId },
    status: 'received',
    ...over,
  });

  const rowsFor = (eventId: string) =>
    db.sql<
      { provider: string; signature_valid: boolean; status: string; payload: unknown }[]
    >`SELECT provider, signature_valid, status, payload FROM webhook_events WHERE event_id = ${eventId}`.then(
      (rows) => [...rows],
    );

  beforeAll(() => {
    db = createDatabase({ url: url ?? '', surface: 'member', appEnv: 'local', max: 10 });
  });
  afterAll(async () => {
    await db.sql`DELETE FROM webhook_events WHERE event_id LIKE ${`${prefix}-%`}`;
    await db.close();
  });

  test('a new event is stored with the table defaults and returned', async () => {
    const id = newId();
    const stored = await recordWebhookEvent(db, event(id));
    expect(stored).toEqual({
      id: expect.any(String),
      provider: 'carrier',
      eventType: 'thing.happened',
      status: 'received',
    });
    const [row] = await db.sql<
      { attempts: number; attempt_log: unknown; processed_at: Date | null }[]
    >`SELECT attempts, attempt_log, processed_at FROM webhook_events WHERE id = ${stored?.id ?? ''}`;
    expect(row).toEqual({ attempts: 0, attempt_log: [], processed_at: null });
  });

  test('a duplicate returns null and changes nothing', async () => {
    const id = newId();
    await recordWebhookEvent(db, event(id));
    expect(await recordWebhookEvent(db, event(id, { payload: { other: true } }))).toBeNull();
    expect(await rowsFor(id)).toEqual([
      { provider: 'carrier', signature_valid: true, status: 'received', payload: { eventId: id } },
    ]);
  });

  test('20 parallel deliveries of one event store it once', async () => {
    const id = newId();
    const results = await Promise.all(
      Array.from({ length: 20 }, () => recordWebhookEvent(db, event(id))),
    );
    expect(results.filter((r) => r !== null)).toHaveLength(1);
    expect(await rowsFor(id)).toHaveLength(1);
  });

  test('an unverified row gives way to the verified copy; a verified row never does', async () => {
    const id = newId();
    const forged = await recordWebhookEvent(
      db,
      event(id, { signatureValid: false, status: 'ignored', payload: { forged: true } }),
    );
    expect(forged?.status).toBe('ignored');
    // A second unverified copy is a duplicate.
    expect(
      await recordWebhookEvent(db, event(id, { signatureValid: false, status: 'ignored' })),
    ).toBeNull();
    const genuine = await recordWebhookEvent(db, event(id, { payload: { genuine: true } }));
    expect(genuine).toEqual({ ...forged, status: 'received' } as never);
    expect(
      await recordWebhookEvent(db, event(id, { signatureValid: false, status: 'ignored' })),
    ).toBeNull();
    expect(await rowsFor(id)).toEqual([
      {
        provider: 'carrier',
        signature_valid: true,
        status: 'received',
        payload: { genuine: true },
      },
    ]);
  });

  test('the same event id from another provider is another event', async () => {
    const id = newId();
    expect(await recordWebhookEvent(db, event(id))).not.toBeNull();
    expect(await recordWebhookEvent(db, event(id, { provider: 'daily' }))).not.toBeNull();
    expect(await rowsFor(id)).toHaveLength(2);
  });

  test('a provider outside the CHECK is refused by the database', async () => {
    const bad = event(newId(), { provider: 'acme' as NewWebhookEvent['provider'] });
    await expect(recordWebhookEvent(db, bad)).rejects.toThrow();
  });
});
