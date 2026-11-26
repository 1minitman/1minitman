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
   * The deployment environment (`APP_ENV`). Sent as the `app.env` setting on every connection,
   * so `app_env()` and the four-eyes rule in `enforce_config_approval()` see it.
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
    // Startup parameters: every server connection carries them, including `app.env` [SQL app_env()].
    connection: { application_name: applicationName, TimeZone: 'UTC', 'app.env': appEnv },
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
