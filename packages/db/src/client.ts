import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

/**
 * Which API surface or program a pool serves. It decides which transaction helper may use the
 * pool: `member` connects as `app_api` (row-level security applies), `admin` as `app_admin_api`
 * and `worker` as `app_worker` (both bypass row-level security) [TR §10.3].
 */
export type DatabaseSurface = 'member' | 'admin' | 'worker';

export interface DatabaseOptions {
  /** Connection string. Use the pooled URL at runtime (Neon pooler in production). */
  url: string;
  /** The surface this pool serves; checked by `withMemberTx`, `withAdminTx` and `withWorkerTx`. */
  surface: DatabaseSurface;
  /**
   * The deployment environment (`APP_ENV`). Hosted logins carry `app.env` as a role setting
   * (`ALTER ROLE … SET app.env`, TRX-056), which always wins. The transaction helpers fall back to
   * this value only when the session has none (local and test databases), and `assertAppEnv`
   * refuses to start production when the database does not report `production`.
   */
  appEnv: string;
  /** Maximum connections held by this process. */
  max?: number;
  /** Shown in pg_stat_activity, e.g. "api" or "worker". */
  applicationName?: string;
}

/**
 * Opens a connection pool and returns the Drizzle database plus the raw client.
 * Every connection runs in UTC: the schema assumes it (schema.sql preamble).
 */
export const createDatabase = ({
  url,
  surface,
  appEnv,
  max = 10,
  applicationName = '1minitman',
}: DatabaseOptions) => {
  if (!appEnv) throw new Error('createDatabase: appEnv is required (APP_ENV)');
  const sql = postgres(url, {
    max,
    // Startup parameters. `app.env` is deliberately not one: it is a per-login role setting
    // (TRX-056), and transaction-mode poolers refuse custom startup parameters.
    connection: { application_name: applicationName, TimeZone: 'UTC' },
    // Schema NOTICEs are noise at runtime.
    onnotice: () => {},
  });
  return {
    db: drizzle(sql),
    sql,
    surface,
    appEnv,
    close: () => sql.end({ timeout: 5 }),
  };
};

export type Database = ReturnType<typeof createDatabase>;
export type Db = Database['db'];

/** Raised at start-up when production runs against a database that does not report production. */
export class AppEnvMismatchError extends Error {
  override readonly name = 'AppEnvMismatchError';
}

/**
 * Start-up check (TRX-056): when `appEnv` is `production`, the login's own `app.env` role setting
 * must make `app_env()` report `production`, outside any transaction, or four-eyes enforcement
 * would silently be off. Other environments are not checked. Returns what the database reports.
 */
export const assertAppEnv = async (database: Database): Promise<string> => {
  const [row] = await database.sql<{ env: string }[]>`SELECT app_env() AS env`;
  const reported = row?.env ?? '';
  if (database.appEnv === 'production' && reported !== 'production') {
    throw new AppEnvMismatchError(
      `APP_ENV is production but the ${database.surface} database login reports app_env() = '${reported}'; set ALTER ROLE … SET app.env = 'production'`,
    );
  }
  return reported;
};
