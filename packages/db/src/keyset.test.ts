import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { and, sql, type SQL } from 'drizzle-orm';
import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createDatabase, type Database } from './client';
import {
  isKeysetId,
  isKeysetKey,
  keysetPage,
  keysetPlan,
  type KeysetPosition,
  type KeysetSort,
} from './keyset';
import { databaseReady } from './test-env';
import { type Tx, withAdminTx } from './transactions';

// MOD-00 plan rule 7: lists never use OFFSET. Unit tests for key checks and page assembly, then
// behaviour tests on PostgreSQL 16 that walk a whole list forwards and backwards and compare it
// with one ORDER BY over every row. The rows live in a temporary table that is rolled back.

describe('isKeysetKey', () => {
  test.each([
    ['timestamp', '1764151200123456', true],
    ['timestamp', '-1', true],
    ['timestamp', '9223372036854775807', true],
    ['timestamp', '9223372036854775808', false],
    ['timestamp', '12.5', false],
    ['timestamp', '1; DROP TABLE users', false],
    ['integer', '42', true],
    ['integer', '4x', false],
    ['numeric', '-12.50', true],
    ['numeric', '1e5', false],
    ['uuid', '0193b1f4-7c2a-7d3e-8f00-000000000001', true],
    ['uuid', 'not-a-uuid', false],
    ['text', 'Ada', true],
    ['text', 'x'.repeat(257), false],
    ['text', 'a\u0000b', false],
    ['citext', '', true],
  ] as const)('%s %p is %p', (kind, key, expected) => {
    expect(isKeysetKey(kind, key)).toBe(expected);
  });

  test('a non-string key or id is refused', () => {
    expect(isKeysetKey('integer', 42)).toBe(false);
    expect(isKeysetId(null)).toBe(false);
    expect(isKeysetId('0193b1f4-7c2a-7d3e-8f00-000000000001')).toBe(true);
  });
});

describe('keysetPlan', () => {
  const t = pgTable('t', { id: uuid().primaryKey(), n: integer().notNull() });
  const sort: KeysetSort = { column: t.n, kind: 'integer', direction: 'asc' };

  test('the first page has no condition and fetches one row more than the page', () => {
    const plan = keysetPlan({ sort, id: t.id, limit: 25 });
    expect(plan.where).toBeUndefined();
    expect(plan.fetch).toBe(26);
    expect(plan.orderBy).toHaveLength(2);
  });

  test('a malformed position or limit never reaches SQL', () => {
    const bad: KeysetPosition = { key: '1 OR 1=1', id: crypto.randomUUID(), toward: 'next' };
    expect(() => keysetPlan({ sort, id: t.id, limit: 25, position: bad })).toThrow(RangeError);
    const badId: KeysetPosition = { key: '1', id: 'x', toward: 'next' };
    expect(() => keysetPlan({ sort, id: t.id, limit: 25, position: badId })).toThrow(RangeError);
    expect(() => keysetPlan({ sort, id: t.id, limit: 0 })).toThrow(RangeError);
  });
});

describe('keysetPage', () => {
  const row = (n: number) => ({ id: `id-${n}`, cursor_key: String(n) });
  const idOf = (r: { id: string }) => r.id;

  test('first page: next only when a row follows', () => {
    const more = keysetPage([row(1), row(2), row(3)], { limit: 2, idOf });
    expect(more.rows.map(idOf)).toEqual(['id-1', 'id-2']);
    expect(more.next).toEqual({ key: '2', id: 'id-2', toward: 'next' });
    expect(more.prev).toBeNull();
    expect(more.hasMore).toBe(true);

    const last = keysetPage([row(1)], { limit: 2, idOf });
    expect(last.next).toBeNull();
    expect(last.hasMore).toBe(false);
  });

  test('a page read backwards is returned in list order with both cursors', () => {
    const position: KeysetPosition = { key: '5', id: 'id-5', toward: 'prev' };
    const page = keysetPage([row(4), row(3), row(2)], { limit: 2, position, idOf });
    expect(page.rows.map(idOf)).toEqual(['id-3', 'id-4']);
    expect(page.prev).toEqual({ key: '3', id: 'id-3', toward: 'prev' });
    expect(page.next).toEqual({ key: '4', id: 'id-4', toward: 'next' });
  });

  test('an empty page after a cursor has no cursors', () => {
    const position: KeysetPosition = { key: '5', id: 'id-5', toward: 'next' };
    expect(keysetPage([], { limit: 2, position, idOf })).toEqual({
      rows: [],
      next: null,
      prev: null,
      hasMore: false,
    });
  });
});

const url = process.env.ADMIN_DATABASE_URL;
const ready = databaseReady({ ADMIN_DATABASE_URL: url });

const items = pgTable('keyset_items', {
  id: uuid().primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
  name: text().notNull(),
  n: integer().notNull(),
});

describe.skipIf(!ready)('keyset pages on PostgreSQL', () => {
  let admin: Database;

  class Rollback<T> extends Error {
    constructor(readonly value: T) {
      super('roll back');
    }
  }
  const rolledBack = <T>(fn: (tx: Tx) => Promise<T>): Promise<T> =>
    withAdminTx(admin, async (tx) => {
      throw new Rollback(await fn(tx));
    }).catch((e: unknown) => {
      if (e instanceof Rollback) return e.value as T;
      throw e;
    });

  beforeAll(() => {
    admin = createDatabase({
      url: url ?? '',
      surface: 'admin',
      appEnv: 'staging',
      max: 1,
      applicationName: 'db-tests',
    });
  });
  afterAll(() => admin.close());

  /**
   * 23 rows. Timestamps repeat (ties broken by id) and several differ only in the microsecond, so
   * a cursor rounded to the millisecond would lose rows. Names repeat with different case.
   */
  const seed = async (tx: Tx) => {
    await tx.execute(sql`CREATE TEMP TABLE keyset_items (
      id uuid PRIMARY KEY, created_at timestamptz NOT NULL, name text NOT NULL, n integer NOT NULL
    ) ON COMMIT DROP`);
    await tx.execute(sql`INSERT INTO keyset_items
      SELECT gen_random_uuid(),
             timestamptz '2026-11-26 10:00:00' + (i % 7) * interval '1 microsecond',
             (ARRAY['ada','Ada','bola','Chi'])[1 + i % 4],
             i % 5
      FROM generate_series(1, 23) AS i`);
  };

  const walk = async (tx: Tx, sort: KeysetSort, limit: number, filter?: SQL) => {
    const read = async (position?: KeysetPosition) => {
      const plan = keysetPlan({ sort, id: items.id, limit, position });
      const fetched = await tx
        .select({ id: items.id, cursor_key: plan.key })
        .from(items)
        .where(and(filter, plan.where))
        .orderBy(...plan.orderBy)
        .limit(plan.fetch);
      return keysetPage(fetched, { limit, position, idOf: (r) => r.id });
    };
    const forward: string[][] = [];
    let page = await read();
    forward.push(page.rows.map((r) => r.id));
    let lastPage = page;
    while (page.next) {
      page = await read(page.next);
      forward.push(page.rows.map((r) => r.id));
      lastPage = page;
    }
    const backward: string[][] = [];
    let back = lastPage;
    while (back.prev) {
      back = await read(back.prev);
      backward.unshift(back.rows.map((r) => r.id));
    }
    return { forward, backward, lastPage };
  };

  const expected = async (tx: Tx, order: SQL, filter?: SQL) =>
    (
      await tx
        .select({ id: items.id })
        .from(items)
        .where(filter)
        .orderBy(sql`${order}`)
    ).map((r) => r.id);

  test.each([
    ['timestamp asc', { kind: 'timestamp', direction: 'asc' }, sql`created_at asc, id asc`],
    ['timestamp desc', { kind: 'timestamp', direction: 'desc' }, sql`created_at desc, id desc`],
    ['integer asc', { kind: 'integer', direction: 'asc' }, sql`n asc, id asc`],
    ['text desc', { kind: 'text', direction: 'desc' }, sql`name desc, id desc`],
  ] as const)('%s: every row exactly once, forwards and backwards', async (_, s, order) => {
    const column =
      s.kind === 'timestamp' ? items.createdAt : s.kind === 'integer' ? items.n : items.name;
    const sort: KeysetSort = { column, kind: s.kind, direction: s.direction };
    const seen = await rolledBack(async (tx) => {
      await seed(tx);
      return { walked: await walk(tx, sort, 5), all: await expected(tx, order) };
    });
    expect(seen.all).toHaveLength(23);
    expect(seen.walked.forward.flat()).toEqual(seen.all);
    expect(seen.walked.forward.map((p) => p.length)).toEqual([5, 5, 5, 5, 3]);
    expect(seen.walked.lastPage.hasMore).toBe(false);
    // Backwards from the last page: the four earlier pages, identical to the forward ones.
    expect(seen.walked.backward).toEqual(seen.walked.forward.slice(0, -1));
  });

  test('the page condition combines with the list filter', async () => {
    const sort: KeysetSort = { column: items.createdAt, kind: 'timestamp', direction: 'asc' };
    const filter = sql`${items.n} <> 0`;
    const seen = await rolledBack(async (tx) => {
      await seed(tx);
      return {
        walked: await walk(tx, sort, 25, filter),
        all: await expected(tx, sql`created_at asc, id asc`, filter),
      };
    });
    expect(seen.walked.forward.flat()).toEqual(seen.all);
    expect(seen.walked.forward).toHaveLength(1);
  });

  test('rows inserted ahead of the cursor do not shift the next page', async () => {
    const sort: KeysetSort = { column: items.n, kind: 'integer', direction: 'asc' };
    const seen = await rolledBack(async (tx) => {
      await seed(tx);
      const plan = keysetPlan({ sort, id: items.id, limit: 5 });
      const first = keysetPage(
        await tx
          .select({ id: items.id, cursor_key: plan.key })
          .from(items)
          .orderBy(...plan.orderBy)
          .limit(plan.fetch),
        { limit: 5, idOf: (r) => r.id },
      );
      // New rows sort before the cursor; OFFSET 5 would now repeat rows of the first page.
      await tx.execute(sql`INSERT INTO keyset_items
        SELECT gen_random_uuid(), now(), 'new', -1 FROM generate_series(1, 3)`);
      const nextPlan = keysetPlan({ sort, id: items.id, limit: 5, position: first.next! });
      const second = await tx
        .select({ id: items.id, cursor_key: nextPlan.key })
        .from(items)
        .where(nextPlan.where)
        .orderBy(...nextPlan.orderBy)
        .limit(nextPlan.fetch);
      return { first: first.rows.map((r) => r.id), second: second.map((r) => r.id) };
    });
    expect(seen.second.some((id) => seen.first.includes(id))).toBe(false);
  });
});
