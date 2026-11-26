import { sql } from 'drizzle-orm';
import type { Database, DatabaseSurface, Db } from './client';

/** The transaction handle passed to the callback of every helper below. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Raised when a helper is used on the wrong pool or with an unusable member id. Fails closed. */
export class TransactionContextError extends Error {
  override readonly name = 'TransactionContextError';
}

const requireSurface = (database: Database, expected: DatabaseSurface, helper: string) => {
  if (database.surface !== expected) {
    throw new TransactionContextError(
      `${helper} needs the ${expected} pool, got the ${database.surface} pool`,
    );
  }
};

/**
 * One member transaction on the `app_api` pool [TR §8.1], [1MM-DB-05 §4.1].
 *
 * The first statement is `SELECT set_config('app.user_id', $1, true)` (TRX-033): the id is a bound
 * parameter and the setting is transaction-local, so it never leaks to the next request through a
 * transaction-mode pooler. `app.env` is set again for the transaction so the value holds even if
 * a pooler drops startup parameters (GAP-DB05-06). Row-level security then confines every query
 * in `fn` to that member. The id must come from the verified access token, never from the request.
 */
export const withMemberTx = async <T>(
  database: Database,
  memberId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> => {
  requireSurface(database, 'member', 'withMemberTx');
  if (typeof memberId !== 'string' || !UUID.test(memberId)) {
    throw new TransactionContextError('withMemberTx needs a member id in UUID form');
  }
  return database.db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT set_config('app.user_id', ${memberId}, true), set_config('app.env', ${database.appEnv}, true)`,
    );
    return fn(tx);
  });
};

/**
 * A transaction on a pool that bypasses row-level security. The member context is cleared for the
 * transaction so nothing can depend on a stray `app.user_id`; `app.env` is set as for members.
 */
const withBypassTx = <T>(database: Database, fn: (tx: Tx) => Promise<T>): Promise<T> =>
  database.db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT set_config('app.user_id', '', true), set_config('app.env', ${database.appEnv}, true)`,
    );
    return fn(tx);
  });

/**
 * One admin transaction on the `app_admin_api` pool (`ADMIN_DATABASE_URL`). Row-level security is
 * bypassed: the permission check and the audit insert, written in this same transaction, are the
 * protection [1MM-DB-05 §11].
 */
export const withAdminTx = async <T>(
  database: Database,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> => {
  requireSurface(database, 'admin', 'withAdminTx');
  return withBypassTx(database, fn);
};

/** One worker transaction on the `app_worker` pool (`WORKER_DATABASE_URL`). */
export const withWorkerTx = async <T>(
  database: Database,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> => {
  requireSurface(database, 'worker', 'withWorkerTx');
  return withBypassTx(database, fn);
};
