import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { sql } from 'drizzle-orm';
import { createDatabase, type Database } from './client';
import {
  TransactionContextError,
  withAdminTx,
  withMemberTx,
  withWorkerTx,
  type Tx,
} from './transactions';

// Unit checks: no query is sent, so an unreachable URL is enough (postgres.js connects lazily).
const offline = (surface: Database['surface']) =>
  createDatabase({ url: 'postgres://nobody@127.0.0.1:1/none', surface, appEnv: 'local', max: 1 });

describe('transaction helpers refuse the wrong pool or a bad member id', () => {
  const pools = { member: offline('member'), admin: offline('admin'), worker: offline('worker') };
  afterAll(() => Promise.all(Object.values(pools).map((p) => p.close())));
  const id = '0190a3c4-0000-7000-8000-000000000001';
  const noop = () => Promise.resolve(1);

  test('withMemberTx runs only on the member pool', async () => {
    for (const pool of [pools.admin, pools.worker]) {
      await expect(withMemberTx(pool, id, noop)).rejects.toBeInstanceOf(TransactionContextError);
    }
  });

  test('withAdminTx runs only on the admin pool', async () => {
    for (const pool of [pools.member, pools.worker]) {
      await expect(withAdminTx(pool, noop)).rejects.toBeInstanceOf(TransactionContextError);
    }
  });

  test('withWorkerTx runs only on the worker pool', async () => {
    for (const pool of [pools.member, pools.admin]) {
      await expect(withWorkerTx(pool, noop)).rejects.toBeInstanceOf(TransactionContextError);
    }
  });

  test('withMemberTx refuses a member id that is not a UUID', async () => {
    for (const bad of ['', 'abc', `${id}'; --`, ` ${id}`, '00000000-0000-0000-0000-00000000000g']) {
      await expect(withMemberTx(pools.member, bad, noop)).rejects.toBeInstanceOf(
        TransactionContextError,
      );
    }
  });

  test('createDatabase requires the environment name', () => {
    expect(() =>
      createDatabase({ url: 'postgres://x@127.0.0.1:1/none', surface: 'member', appEnv: '' }),
    ).toThrow(/appEnv/);
  });
});

// Behaviour on PostgreSQL 16 (`pnpm services:up && pnpm db:migrate && pnpm db:roles`).
const urls = {
  member: process.env.DATABASE_URL,
  admin: process.env.ADMIN_DATABASE_URL,
  worker: process.env.WORKER_DATABASE_URL,
};
const ready = Object.values(urls).every(Boolean);

const rows = async <T>(tx: Tx, query: ReturnType<typeof sql>) =>
  (await tx.execute(query)) as unknown as T[];

describe.skipIf(!ready)('row-level security context on PostgreSQL', () => {
  let member: Database;
  let admin: Database;
  let worker: Database;
  const a = crypto.randomUUID();
  const b = crypto.randomUUID();

  beforeAll(async () => {
    member = createDatabase({
      url: urls.member ?? '',
      surface: 'member',
      appEnv: 'staging',
      max: 2,
    });
    admin = createDatabase({ url: urls.admin ?? '', surface: 'admin', appEnv: 'staging', max: 1 });
    worker = createDatabase({ url: urls.worker ?? '', surface: 'worker', appEnv: 'local', max: 1 });
    await withAdminTx(admin, async (tx) => {
      for (const id of [a, b]) {
        await tx.execute(
          sql`INSERT INTO users (id, email, first_name) VALUES (${id}, ${`rls-${id}@example.test`}, 'Test')`,
        );
      }
      await tx.execute(
        sql`INSERT INTO blocks (blocker_id, blocked_id, surface) VALUES (${a}, ${b}, 'chat_actions'), (${b}, ${a}, 'chat_actions')`,
      );
    });
  });

  afterAll(async () => {
    await withAdminTx(admin, (tx) => tx.execute(sql`DELETE FROM users WHERE id IN (${a}, ${b})`));
    await Promise.all([member.close(), admin.close(), worker.close()]);
  });

  const ownBlocks = (tx: Tx) =>
    rows<{ blocker_id: string }>(
      tx,
      sql`SELECT blocker_id FROM blocks WHERE blocker_id IN (${a}, ${b}) OR blocked_id IN (${a}, ${b})`,
    );

  test('two members on parallel connections each see only their own rows', async () => {
    // Both transactions are open at once: each waits until the other has set its context.
    let arrived = 0;
    let release: () => void = () => {};
    const bothOpen = new Promise<void>((resolve) => (release = resolve));
    const meet = async () => {
      arrived += 1;
      if (arrived === 2) release();
      await bothOpen;
    };
    const run = (me: string, other: string) =>
      withMemberTx(member, me, async (tx) => {
        await meet();
        const [ctx] = await rows<{ pid: number; me: string }>(
          tx,
          sql`SELECT pg_backend_pid() AS pid, app_current_user_id()::text AS me`,
        );
        const visible = await ownBlocks(tx);
        const theirs = await rows(tx, sql`SELECT 1 FROM blocks WHERE blocker_id = ${other}`);
        return { pid: ctx?.pid, me: ctx?.me, visible, theirs };
      });

    const [ra, rb] = await Promise.all([run(a, b), run(b, a)]);
    expect(ra.pid).not.toBe(rb.pid);
    expect(ra.me).toBe(a);
    expect(rb.me).toBe(b);
    expect(ra.visible.map((r) => r.blocker_id)).toEqual([a]);
    expect(rb.visible.map((r) => r.blocker_id)).toEqual([b]);
    expect(ra.theirs).toHaveLength(0);
    expect(rb.theirs).toHaveLength(0);
  });

  test('without a member context the member login sees none of the owner-only rows', async () => {
    const found = await member.sql`SELECT 1 FROM blocks WHERE blocker_id IN (${a}, ${b})`;
    expect(found).toHaveLength(0);
  });

  test('the member context ends with the transaction and does not leak to the next query', async () => {
    const single = createDatabase({
      url: urls.member ?? '',
      surface: 'member',
      appEnv: 'staging',
      max: 1,
    });
    try {
      await withMemberTx(single, a, (tx) => ownBlocks(tx));
      const [after] =
        await single.sql`SELECT coalesce(current_setting('app.user_id', true), '') AS v`;
      expect(after?.v).toBe('');
      expect(await single.sql`SELECT 1 FROM blocks WHERE blocker_id = ${a}`).toHaveLength(0);
    } finally {
      await single.close();
    }
  });

  test('a member cannot write a row in another member’s name', async () => {
    await expect(
      withMemberTx(member, a, (tx) =>
        tx.execute(
          sql`INSERT INTO blocks (blocker_id, blocked_id, surface) VALUES (${b}, ${a}, 'report')`,
        ),
      ),
    ).rejects.toThrow();
  });

  test('an error inside the callback rolls the whole transaction back', async () => {
    const boom = new Error('rollback');
    await expect(
      withMemberTx(member, a, async (tx) => {
        await tx.execute(
          sql`UPDATE blocks SET unblocked_at = now(), unblock_via = 'blocked_list' WHERE blocker_id = ${a}`,
        );
        throw boom;
      }),
    ).rejects.toBe(boom);
    const still = await withAdminTx(admin, (tx) =>
      rows<{ n: number }>(
        tx,
        sql`SELECT count(*)::int AS n FROM blocks WHERE blocker_id = ${a} AND unblocked_at IS NULL`,
      ),
    );
    expect(still[0]?.n).toBe(1);
  });

  test('admin and worker transactions bypass row-level security and carry no member context', async () => {
    for (const run of [
      (fn: (tx: Tx) => Promise<unknown>) => withAdminTx(admin, fn),
      (fn: (tx: Tx) => Promise<unknown>) => withWorkerTx(worker, fn),
    ]) {
      const result = (await run(async (tx) => {
        const [ctx] = await rows<{ me: string | null }>(
          tx,
          sql`SELECT app_current_user_id() AS me`,
        );
        return { me: ctx?.me, visible: await ownBlocks(tx) };
      })) as { me: string | null; visible: unknown[] };
      expect(result.me).toBeNull();
      expect(result.visible).toHaveLength(2);
    }
  });

  test('every connection carries app.env from APP_ENV, inside and outside a transaction', async () => {
    const [outside] = await member.sql`SELECT app_env() AS e`;
    expect(outside?.e).toBe('staging');
    const inside = await withWorkerTx(worker, (tx) =>
      rows<{ e: string }>(tx, sql`SELECT app_env() AS e`),
    );
    expect(inside[0]?.e).toBe('local');
  });

  describe('four-eyes on config writes follows app.env', () => {
    const key = `test.db01_${crypto.randomUUID().slice(0, 8)}`;
    const insert = (tx: Tx) =>
      tx.execute(
        sql`INSERT INTO remote_config (key, value, value_type, description) VALUES (${key}, '1'::jsonb, 'int', 'MOD-00-DB-01 test, rolled back')`,
      );
    const sentinel = new Error('roll back the test row');

    test('production refuses a config insert without an approval', async () => {
      const prod = createDatabase({
        url: urls.admin ?? '',
        surface: 'admin',
        appEnv: 'production',
        max: 1,
      });
      try {
        const error = await withAdminTx(prod, insert).then(
          () => null,
          (e: unknown) => e as { cause?: { code?: string; message?: string } },
        );
        expect(error?.cause?.code).toBe('42501');
        expect(error?.cause?.message).toMatch(/four-eyes/);
      } finally {
        await prod.close();
      }
    });

    test('staging allows the same insert', async () => {
      await expect(
        withAdminTx(admin, async (tx) => {
          await insert(tx);
          throw sentinel;
        }),
      ).rejects.toBe(sentinel);
      expect(await admin.sql`SELECT 1 FROM remote_config WHERE key = ${key}`).toHaveLength(0);
    });
  });
});
