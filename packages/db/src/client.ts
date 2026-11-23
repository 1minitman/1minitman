import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

export interface DatabaseOptions {
  /** Connection string. Use the pooled URL at runtime (Neon pooler in production). */
  url: string;
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
  max = 10,
  applicationName = '1minitman',
}: DatabaseOptions) => {
  const sql = postgres(url, {
    max,
    connection: { application_name: applicationName, TimeZone: 'UTC' },
    // Schema NOTICEs are noise at runtime.
    onnotice: () => {},
  });
  return { db: drizzle(sql), sql, close: () => sql.end({ timeout: 5 }) };
};

export type Database = ReturnType<typeof createDatabase>;
export type Db = Database['db'];
