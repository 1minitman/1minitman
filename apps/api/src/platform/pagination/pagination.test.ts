import { listQuerySchema } from '@1minitman/contracts';
import { createDatabase, withAdminTx, type Tx } from '@1minitman/db';
import { createRoute } from '@hono/zod-openapi';
import { describe, expect, test } from 'bun:test';
import { and, sql } from 'drizzle-orm';
import { integer, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { ProblemError } from '../errors';
import { requestContext } from '../http/middleware';
import { errorHandler } from '../http/problem';
import { createRouter } from '../http/router';
import { createLogger } from '../logger';
import { CURSOR_MAX_LENGTH, createCursorCodec, defineKeysetList } from './index';

// MOD-00 plan rule 7: lists never use OFFSET; an unknown sort field is a 422. Section 9: a tampered
// cursor and a cursor from another list are refused.

const ID = '0193b1f4-7c2a-7d3e-8f00-000000000001';

const problemOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    if (error instanceof ProblemError) return error;
    throw error;
  }
  throw new Error('expected a ProblemError');
};

describe('cursor codec', () => {
  const codec = createCursorCodec({ list: 'admin.users', sort: 'created_at', kind: 'timestamp' });

  test('round-trips a position as an opaque base64url string', () => {
    for (const toward of ['next', 'prev'] as const) {
      const position = { key: '1764151200123456', id: ID, toward };
      const cursor = codec.encode(position);
      expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(codec.decode(cursor)).toEqual(position);
    }
    expect(codec.decode(undefined)).toBeUndefined();
  });

  const forge = (payload: unknown) => Buffer.from(JSON.stringify(payload)).toString('base64url');
  const valid = { v: 1, l: 'admin.users', s: 'created_at', t: 'n', k: '1764151200123456', i: ID };

  test.each([
    ['not base64url', 'abc+/=='],
    ['empty', ''],
    ['too long', 'a'.repeat(CURSOR_MAX_LENGTH + 1)],
    ['not JSON', Buffer.from('{oops').toString('base64url')],
    ['a JSON array', forge([1, 2])],
    ['a JSON string', forge('x')],
    ['null', forge(null)],
    ['wrong version', forge({ ...valid, v: 2 })],
    ['an extra field', forge({ ...valid, x: 1 })],
    ['a missing field', forge({ ...valid, i: undefined })],
    ['another list', forge({ ...valid, l: 'admin.reports' })],
    ['another sort', forge({ ...valid, s: 'name' })],
    ['a bad direction', forge({ ...valid, t: 'x' })],
    ['an injected key', forge({ ...valid, k: "1'); DROP TABLE users; --" })],
    ['a key out of range', forge({ ...valid, k: '99999999999999999999' })],
    ['a timestamp PostgreSQL cannot cast', forge({ ...valid, k: '9223372036854775807' })],
    ['a numeric key as a number', forge({ ...valid, k: 1764151200123456 })],
    ['a bad id', forge({ ...valid, i: 'not-a-uuid' })],
  ])('a cursor that is %s is a 422 validation on `cursor`', (_, cursor) => {
    const problem = problemOf(() => codec.decode(cursor));
    expect(problem.code).toBe('validation');
    expect(problem.details.errors).toEqual([
      expect.objectContaining({ path: 'cursor', code: 'invalid_format' }),
    ]);
  });

  test('a cursor from another list is refused even with the same sort', () => {
    const other = createCursorCodec({
      list: 'admin.reports',
      sort: 'created_at',
      kind: 'timestamp',
    });
    const cursor = other.encode({ key: '1', id: ID, toward: 'next' });
    expect(problemOf(() => codec.decode(cursor)).details.errors?.[0]?.message).toContain(
      'another list',
    );
  });
});

const items = pgTable('pagination_items', {
  id: uuid().primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
  n: integer().notNull(),
});

const list = defineKeysetList({
  list: 'test.items',
  sorts: {
    created_at: { column: items.createdAt, kind: 'timestamp', direction: 'desc' },
    n: { column: items.n, kind: 'integer', direction: 'asc' },
  },
  id: items.id,
});

describe('defineKeysetList', () => {
  test('an unknown sort is a 422 on `sort`, also when a route schema did not refuse it', () => {
    for (const sort of ['password_hash', 'constructor', '__proto__']) {
      const problem = problemOf(() => list.plan({ limit: 25, sort }));
      expect(problem.code).toBe('validation');
      expect(problem.details.errors?.[0]?.path).toBe('sort');
    }
  });

  test('a cursor issued for one sort is refused under another', () => {
    const page = list.plan({ limit: 25, sort: 'n' });
    const response = page.toResponse(
      Array.from({ length: 26 }, (_, i) => ({ id: ID, cursor_key: String(i) })),
      (r) => r.cursor_key,
    );
    expect(response.has_more).toBe(true);
    expect(response.items).toHaveLength(25);
    const problem = problemOf(() =>
      list.plan({ limit: 25, sort: 'created_at', cursor: response.next_cursor! }),
    );
    expect(problem.code).toBe('validation');
  });

  test('a route with listQuerySchema answers an unknown sort with a 422 problem', async () => {
    const app = createRouter();
    app.use('*', requestContext(createLogger('error')));
    app.onError(errorHandler);
    app.openapi(
      createRoute({
        method: 'get',
        path: '/items',
        request: { query: listQuerySchema(['created_at', 'n'] as const, 'created_at') },
        responses: { 200: { description: 'ok' } },
      }),
      (c) => {
        const page = list.plan(c.req.valid('query'));
        return c.json({ fetch: page.fetch }, 200);
      },
    );
    const bad = await app.request('/items?sort=email');
    expect(bad.status).toBe(422);
    expect(bad.headers.get('Content-Type')).toBe('application/problem+json');
    const body = (await bad.json()) as { reason: string; errors: { path: string }[] };
    expect(body.reason).toBe('validation');
    expect(body.errors[0]?.path).toBe('sort');
    expect((await app.request('/items?limit=10')).status).toBe(422);
    expect((await app.request('/items?cursor=%21%21')).status).toBe(422);
    expect(await (await app.request('/items?limit=25')).json()).toEqual({ fetch: 26 });
  });
});

const adminUrl = process.env.ADMIN_DATABASE_URL;
const ci = !['', 'false', '0'].includes(process.env.CI?.trim().toLowerCase() ?? '');
if (ci && !adminUrl) throw new Error('Pagination tests need ADMIN_DATABASE_URL in CI');

describe.skipIf(!adminUrl)('defineKeysetList on PostgreSQL', () => {
  class Rollback<T> extends Error {
    constructor(readonly value: T) {
      super('roll back');
    }
  }

  test.each(['created_at', 'n'])(
    'sort %s: paging by cursor returns every row once, in order, then back again',
    async (sort) => {
      const admin = createDatabase({ url: adminUrl!, surface: 'admin', appEnv: 'staging', max: 1 });
      const read = (tx: Tx, cursor?: string) => {
        const page = list.plan({ limit: 25, sort, cursor });
        return tx
          .select({ id: items.id, cursor_key: page.key })
          .from(items)
          .where(and(sql`true`, page.where))
          .orderBy(...page.orderBy)
          .limit(page.fetch)
          .then((rows) => page.toResponse(rows, (r) => r.id));
      };
      const seen = await withAdminTx(admin, async (tx) => {
        await tx.execute(sql`CREATE TEMP TABLE pagination_items (
          id uuid PRIMARY KEY, created_at timestamptz NOT NULL, n integer NOT NULL
        ) ON COMMIT DROP`);
        await tx.execute(sql`INSERT INTO pagination_items
          SELECT gen_random_uuid(), now() - (i % 9) * interval '1 microsecond', i % 4
          FROM generate_series(1, 60) AS i`);
        const order = sort === 'n' ? sql`n asc, id asc` : sql`created_at desc, id desc`;
        const all = (
          await tx
            .select({ id: items.id })
            .from(items)
            .orderBy(sql`${order}`)
        ).map((r) => r.id);
        const pages = [await read(tx)];
        while (pages.at(-1)!.next_cursor) pages.push(await read(tx, pages.at(-1)!.next_cursor!));
        const back = await read(tx, pages.at(-1)!.prev_cursor!);
        throw new Rollback({ all, pages, back });
      }).catch((e: unknown) => {
        if (e instanceof Rollback)
          return e.value as {
            all: string[];
            pages: { items: string[]; has_more: boolean; prev_cursor: string | null }[];
            back: { items: string[] };
          };
        throw e;
      });
      await admin.close();
      expect(seen.pages.map((p) => p.items.length)).toEqual([25, 25, 10]);
      expect(seen.pages.flatMap((p) => p.items)).toEqual(seen.all);
      expect(seen.pages[0]!.prev_cursor).toBeNull();
      expect(seen.pages.at(-1)!.has_more).toBe(false);
      expect(seen.back.items).toEqual(seen.pages[1]!.items);
    },
  );
});
