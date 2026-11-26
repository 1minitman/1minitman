import { and, eq, getTableColumns, sql, type SQL } from 'drizzle-orm';
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { Tx } from './transactions';

/*
 * Optimistic concurrency [TR §8.1], [ADM §1.4], [1MM-STD-16 §5]: a write names the version it
 * read, `UPDATE … WHERE id = :id AND <version> = :expected`, and zero rows means someone else
 * changed the row (412, MOD-00 plan rule 8) or it is gone (404). The API carries the version as
 * the entity tag (`ETag` on reads, `If-Match` on writes).
 *
 * The version is the row's `version` integer where the table has one, otherwise `updated_at`
 * (stamped by the `set_updated_at()` trigger). `updated_at` is compared in whole microseconds, its
 * full precision: a JavaScript Date keeps milliseconds only and would never match. The trigger
 * stamps `now()`, the transaction start, so two updates of one row inside one transaction keep
 * the same token; use `version` where that matters.
 */

export interface RowVersion {
  column: AnyPgColumn;
  kind: 'updated_at' | 'version';
}

const TOKEN = /^\d{1,18}$/;
const INT4_MAX = 2147483647;

/** True when `token` could be a version of this kind; anything else matches no row. */
export const isVersionToken = (kind: RowVersion['kind'], token: unknown): token is string =>
  typeof token === 'string' &&
  TOKEN.test(token) &&
  (kind === 'updated_at' || Number(token) <= INT4_MAX);

/** The version of a row as a text token: select it next to the row and send it as the ETag. */
export const versionToken = (version: RowVersion): SQL<string> =>
  version.kind === 'updated_at'
    ? sql<string>`((extract(epoch from ${version.column}) * 1000000)::bigint)::text`
    : sql<string>`(${version.column})::text`;

const versionEquals = (version: RowVersion, token: string): SQL =>
  version.kind === 'updated_at'
    ? sql`(extract(epoch from ${version.column}) * 1000000)::bigint = ${token}::bigint`
    : sql`${version.column} = ${token}::integer`;

export type ConditionalUpdate =
  /** The row matched and was changed; `token` is its new version. */
  | { outcome: 'updated'; token: string }
  /** The row exists at another version: nothing was changed. */
  | { outcome: 'stale'; token: string }
  /** No row has this id. */
  | { outcome: 'missing' };

const propertyOf = (table: PgTable, column: AnyPgColumn): string => {
  const entry = Object.entries(getTableColumns(table)).find(([, c]) => c === column);
  if (!entry) throw new Error(`column ${column.name} is not a column of the table`);
  return entry[0];
};

/**
 * Updates one row only if it is still at the `expected` version, in the caller's transaction.
 * A `version` column is incremented here; `updated_at` is stamped by the table's trigger. Under
 * READ COMMITTED a concurrent writer waits for the row lock, then re-checks the version, so of
 * two writers holding the same token exactly one succeeds.
 */
export const updateIfMatch = async <T extends PgTable>(
  tx: Tx,
  args: {
    table: T;
    id: AnyPgColumn;
    idValue: string;
    version: RowVersion;
    expected: string;
    set: Record<string, unknown>;
  },
): Promise<ConditionalUpdate> => {
  const { table, id, idValue, version, expected } = args;
  const set: Record<string, unknown> = { ...args.set };
  if (version.kind === 'version') {
    set[propertyOf(table, version.column)] = sql`${version.column} + 1`;
  }
  if (Object.keys(set).length === 0) throw new Error('updateIfMatch needs at least one column');

  if (isVersionToken(version.kind, expected)) {
    // drizzle cannot narrow the set type for a table chosen at run time.
    const updated = (await tx
      .update(table)
      .set(set as never)
      .where(and(eq(id, idValue), versionEquals(version, expected)))
      .returning({ token: versionToken(version) })) as { token: string }[];
    if (updated[0]) return { outcome: 'updated', token: updated[0].token };
  }
  const current = (await tx
    .select({ token: versionToken(version) })
    .from(table as PgTable)
    .where(eq(id, idValue))) as { token: string }[];
  return current[0] ? { outcome: 'stale', token: current[0].token } : { outcome: 'missing' };
};
