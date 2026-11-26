import { sql, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

/*
 * Keyset pagination [TR §8.1], [ADM §1.4]: a page starts after (or before) the `(sort key, id)`
 * of a row, never at an OFFSET (MOD-00 plan rule 7). The id breaks ties, so rows that share a
 * sort key are neither skipped nor repeated. The API turns a position into an opaque cursor
 * (`apps/api/src/platform/pagination`); this file only builds the SQL and reads the page back.
 *
 * Requirements on a sort: the column is NOT NULL, and an index leads with `(column, id)` (sort
 * only on indexed columns, MOD-00 plan behaviour 9). The id is a uuid primary key.
 */

/** How a sort key is carried as text in a cursor and cast back in SQL. */
export type KeysetKind = 'timestamp' | 'text' | 'citext' | 'integer' | 'numeric' | 'uuid';

export interface KeysetSort {
  column: AnyPgColumn;
  kind: KeysetKind;
  direction: 'asc' | 'desc';
}

/** Where a page starts: after the row (`next`) or before it (`prev`). */
export interface KeysetPosition {
  key: string;
  id: string;
  toward: 'next' | 'prev';
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INT8_MAX = 9223372036854775807n;
const INTEGER = /^-?\d{1,19}$/;
const NUMERIC = /^-?\d{1,100}(\.\d{1,100})?$/;
/** Longest text sort key a cursor carries; keeps a cursor short enough for a URL. */
export const KEYSET_TEXT_KEY_MAX = 256;

/**
 * Range of a timestamp key, in microseconds since the Unix epoch. The low end is PostgreSQL's
 * earliest `timestamptz` (4714-11-24 00:00 UTC BC); the high end, 2^59 - 1 (the year 20237), is
 * where the cast in `keyValue` stops being exact (it multiplies an interval by a float8). A key
 * outside it would make the cast fail (a 500) or name the wrong microsecond, so it is refused.
 */
export const KEYSET_TIMESTAMP_MIN = -210866803200000000n;
export const KEYSET_TIMESTAMP_MAX = 2n ** 59n - 1n;

const inRange = (value: string, min: bigint, max: bigint) => {
  if (!INTEGER.test(value)) return false;
  const n = BigInt(value);
  return n <= max && n >= min;
};

/**
 * True when `key` is a well-formed sort key of `kind`, so casting it in SQL cannot fail. A cursor
 * is client input: the API checks every key with this before it reaches a query.
 */
export const isKeysetKey = (kind: KeysetKind, key: unknown): key is string => {
  if (typeof key !== 'string') return false;
  switch (kind) {
    case 'timestamp':
      return inRange(key, KEYSET_TIMESTAMP_MIN, KEYSET_TIMESTAMP_MAX);
    case 'integer':
      return inRange(key, -INT8_MAX - 1n, INT8_MAX);
    case 'numeric':
      return NUMERIC.test(key);
    case 'uuid':
      return UUID.test(key);
    case 'text':
    case 'citext':
      return key.length <= KEYSET_TEXT_KEY_MAX && !key.includes('\u0000');
  }
};

export const isKeysetId = (id: unknown): id is string => typeof id === 'string' && UUID.test(id);

/**
 * The sort key of a row as text, to select next to the row (as `cursor_key`). A timestamp is
 * carried as whole microseconds since the epoch: a JavaScript Date keeps only milliseconds,
 * and a cursor rounded to the millisecond would skip or repeat rows.
 */
export const keysetKey = (sort: KeysetSort): SQL<string> =>
  sort.kind === 'timestamp'
    ? sql<string>`((extract(epoch from ${sort.column}) * 1000000)::bigint)::text`
    : sql<string>`(${sort.column})::text`;

const keyValue = (kind: KeysetKind, key: string): SQL => {
  switch (kind) {
    case 'timestamp':
      // Whole seconds and the remaining microseconds apart: one product of the full key would be
      // rounded by the float8 multiply once it passes 2^53 microseconds (the year 2255).
      return sql`(timestamptz 'epoch' + (${key}::bigint / 1000000) * interval '1 second' + (${key}::bigint % 1000000) * interval '1 microsecond')`;
    case 'text':
      return sql`${key}::text`;
    case 'citext':
      return sql`${key}::citext`;
    case 'integer':
      return sql`${key}::bigint`;
    case 'numeric':
      return sql`${key}::numeric`;
    case 'uuid':
      return sql`${key}::uuid`;
  }
};

export interface KeysetPlan {
  /** The page condition, to AND with the list's own filters; undefined on the first page. */
  where: SQL | undefined;
  /** ORDER BY for the query, in the order rows are read. */
  orderBy: SQL[];
  /** LIMIT for the query: one more row than the page, to learn whether more follow. */
  fetch: number;
  /** Select this as `cursor_key` next to every row. */
  key: SQL<string>;
}

/**
 * Builds the query parts for one page. Keys in `position` must have passed `isKeysetKey` and
 * `isKeysetId`; anything else is refused here too, so a bad key never reaches a cast.
 */
export const keysetPlan = (args: {
  sort: KeysetSort;
  id: AnyPgColumn;
  limit: number;
  position?: KeysetPosition;
}): KeysetPlan => {
  const { sort, id, limit, position } = args;
  if (!Number.isInteger(limit) || limit < 1)
    throw new RangeError('limit must be a positive integer');
  // Reading backwards (`prev`) walks the index in the opposite direction; keysetPage restores the order.
  const backwards = position?.toward === 'prev';
  const ascending = (sort.direction === 'asc') !== backwards;
  const dir = ascending ? sql`asc` : sql`desc`;
  let where: SQL | undefined;
  if (position) {
    if (!isKeysetKey(sort.kind, position.key) || !isKeysetId(position.id)) {
      throw new RangeError('keyset position is not well formed');
    }
    const op = ascending ? sql`>` : sql`<`;
    where = sql`(${sort.column}, ${id}) ${op} (${keyValue(sort.kind, position.key)}, ${position.id}::uuid)`;
  }
  return {
    where,
    orderBy: [sql`${sort.column} ${dir}`, sql`${id} ${dir}`],
    fetch: limit + 1,
    key: keysetKey(sort),
  };
};

export interface KeysetPageResult<R> {
  /** At most `limit` rows, in the list's sort order. */
  rows: R[];
  next: KeysetPosition | null;
  prev: KeysetPosition | null;
  hasMore: boolean;
}

/**
 * Reads back the rows of a `keysetPlan` query (at most `limit + 1`, in read order). `next` is set
 * when rows follow the page and `prev` when rows precede it; `hasMore` equals `next !== null`.
 */
export const keysetPage = <R extends { cursor_key: string }>(
  fetched: readonly R[],
  args: { limit: number; position?: KeysetPosition; idOf: (row: R) => string },
): KeysetPageResult<R> => {
  const { limit, position, idOf } = args;
  const extra = fetched.length > limit;
  const rows = fetched.slice(0, limit);
  if (position?.toward === 'prev') rows.reverse();
  const first = rows[0];
  const last = rows.at(-1);
  const at = (row: R | undefined, toward: KeysetPosition['toward']): KeysetPosition | null =>
    row ? { key: row.cursor_key, id: idOf(row), toward } : null;

  let next: KeysetPosition | null;
  let prev: KeysetPosition | null;
  if (!position) {
    next = extra ? at(last, 'next') : null;
    prev = null;
  } else if (position.toward === 'next') {
    next = extra ? at(last, 'next') : null;
    prev = at(first, 'prev');
  } else {
    next = at(last, 'next');
    prev = extra ? at(first, 'prev') : null;
  }
  return { rows, next, prev, hasMore: next !== null };
};
