import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { sql } from 'drizzle-orm';
import { createDatabase, type Database } from './client';
import { OutboxInputError, writeOutbox, type OutboxNotification } from './outbox';
import { databaseReady } from './test-env';
import { withMemberTx, withWorkerTx, type Tx } from './transactions';

// Unit checks: refused before any query is sent, so an unreachable pool is enough.
describe('writeOutbox() input checks', () => {
  const offline = createDatabase({
    url: 'postgres://nobody@127.0.0.1:1/none',
    surface: 'worker',
    appEnv: 'local',
    max: 1,
  });
  afterAll(() => offline.close());
  const fakeTx = offline.db as unknown as Tx;

  test('an empty list writes nothing and sends no query', async () => {
    expect(await writeOutbox(fakeTx, [])).toEqual({ ids: [], deduplicated: 0 });
  });

  test('a notification with neither template nor broadcast is refused', async () => {
    const bad = {
      recipient: { kind: 'member', userId: crypto.randomUUID() },
      channel: 'push',
      locale: 'en',
    } as unknown as OutboxNotification;
    await expect(writeOutbox(fakeTx, bad)).rejects.toBeInstanceOf(OutboxInputError);
  });

  test('a non-member recipient needs a 32-byte hash and an encrypted address', async () => {
    const base = { templateCode: 'N01', locale: 'en' } as const;
    await expect(
      writeOutbox(fakeTx, {
        ...base,
        recipient: {
          kind: 'waitlist',
          channel: 'email',
          addressEncrypted: new Uint8Array([1]),
          addressHash: new Uint8Array(31),
        },
      }),
    ).rejects.toThrow(/32-byte/);
    await expect(
      writeOutbox(fakeTx, {
        ...base,
        recipient: {
          kind: 'waitlist',
          channel: 'email',
          addressEncrypted: new Uint8Array(),
          addressHash: new Uint8Array(32),
        },
      }),
    ).rejects.toThrow(/addressEncrypted/);
  });
});

// Behaviour on PostgreSQL 16: the outbox row commits or rolls back with the change [TR §4.2].
// Every row is synthetic and removed: rolled back, or deleted with its fixture user.
const urls = { member: process.env.DATABASE_URL, worker: process.env.WORKER_DATABASE_URL };
const ready = databaseReady({
  DATABASE_URL: urls.member,
  WORKER_DATABASE_URL: urls.worker,
});

describe.skipIf(!ready)('writeOutbox() on PostgreSQL', () => {
  let worker: Database;
  let member: Database;
  const committedUsers: string[] = [];

  class Rollback extends Error {}
  const rolledBack = (fn: (tx: Tx) => Promise<void>) =>
    withWorkerTx(worker, async (tx) => {
      await fn(tx);
      throw new Rollback('roll back the test rows');
    }).catch((e: unknown) => {
      if (!(e instanceof Rollback)) throw e;
    });

  const insertUser = async (tx: Tx) => {
    const id = crypto.randomUUID();
    await tx.execute(
      sql`INSERT INTO users (id, email, first_name) VALUES (${id}, ${`outbox-${id}@example.test`}, 'Test')`,
    );
    return id;
  };

  const countFor = async (userId: string) => {
    const rows = await worker.sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM notifications WHERE user_id = ${userId}`;
    return rows[0]?.n ?? 0;
  };

  beforeAll(() => {
    worker = createDatabase({ url: urls.worker ?? '', surface: 'worker', appEnv: 'local', max: 2 });
    member = createDatabase({ url: urls.member ?? '', surface: 'member', appEnv: 'local', max: 2 });
  });
  afterAll(async () => {
    if (committedUsers.length) {
      await worker.sql`DELETE FROM users WHERE id = ANY(${committedUsers}::uuid[])`;
    }
    await Promise.all([worker.close(), member.close()]);
  });

  test('the row commits with the change that caused it, with the table defaults', async () => {
    const userId = await withWorkerTx(worker, async (tx) => {
      const id = await insertUser(tx);
      const result = await writeOutbox(tx, {
        recipient: { kind: 'member', userId: id },
        channel: 'push',
        templateCode: 'N03',
        locale: 'pcm',
        params: { name: 'Test' },
      });
      expect(result.ids).toHaveLength(1);
      return id;
    });
    committedUsers.push(userId);
    const [row] = await worker.sql<
      {
        status: string;
        channel: string;
        recipient_kind: string;
        attempts: number;
        silent: boolean;
        params: unknown;
      }[]
    >`SELECT status, channel, recipient_kind, attempts, silent, params
      FROM notifications WHERE user_id = ${userId}`;
    expect(row).toEqual({
      status: 'queued',
      channel: 'push',
      recipient_kind: 'member',
      attempts: 0,
      silent: false,
      params: { name: 'Test' },
    });
  });

  test('a rolled-back change leaves no outbox row', async () => {
    let userId = '';
    await rolledBack(async (tx) => {
      userId = await insertUser(tx);
      await writeOutbox(tx, {
        recipient: { kind: 'member', userId },
        channel: 'in_app',
        templateCode: 'N01',
        locale: 'en',
      });
      expect(await countFor(userId)).toBe(0); // not visible outside the transaction yet
    });
    expect(await countFor(userId)).toBe(0);
  });

  test('a repeated dedupe key for the same member is dropped, not an error', async () => {
    await rolledBack(async (tx) => {
      const userId = await insertUser(tx);
      const n: OutboxNotification = {
        recipient: { kind: 'member', userId },
        channel: 'push',
        templateCode: 'N01',
        locale: 'en',
        dedupeKey: 'likes:2026-11-26T10',
      };
      const first = await writeOutbox(tx, n);
      const second = await writeOutbox(tx, [n, { ...n, dedupeKey: 'likes:2026-11-26T11' }]);
      expect(first).toEqual({ ids: [expect.any(String)], deduplicated: 0 });
      expect(second.ids).toHaveLength(1);
      expect(second.deduplicated).toBe(1);
    });
  });

  test('a non-member recipient is stored encrypted with its hash and source row', async () => {
    await rolledBack(async (tx) => {
      const hash = new Uint8Array(32).fill(7);
      const sourceId = crypto.randomUUID();
      const { ids } = await writeOutbox(tx, {
        recipient: {
          kind: 'waitlist',
          channel: 'email',
          addressEncrypted: new Uint8Array([1, 2, 3]),
          addressHash: hash,
          sourceId,
        },
        templateCode: 'N01',
        locale: 'fr',
        scheduledFor: new Date('2030-01-01T00:00:00Z'),
      });
      const result = await tx.execute<{
        user_id: string | null;
        recipient_kind: string;
        channel: string;
        recipient_ref_id: string;
        hash_ok: boolean;
        scheduled_for: string;
      }>(sql`SELECT user_id, recipient_kind, channel, recipient_ref_id,
                    recipient_hash = ${Buffer.from(hash)} AS hash_ok, scheduled_for::text
             FROM notifications WHERE id = ${ids[0]}`);
      expect(result[0]).toMatchObject({
        user_id: null,
        recipient_kind: 'waitlist',
        channel: 'email',
        recipient_ref_id: sourceId,
        hash_ok: true,
      });
      expect(result[0]?.scheduled_for).toStartWith('2030-01-01');
    });
  });

  test('the member API (app_api) writes the outbox inside withMemberTx', async () => {
    const userId = await withWorkerTx(worker, insertUser);
    committedUsers.push(userId);
    await withMemberTx(member, userId, (tx) =>
      writeOutbox(tx, {
        recipient: { kind: 'member', userId },
        channel: 'in_app',
        templateCode: 'N03',
        locale: 'en',
      }),
    );
    expect(await countFor(userId)).toBe(1);
  });
});
