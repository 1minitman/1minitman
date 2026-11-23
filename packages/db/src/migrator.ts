import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';

/**
 * Forward-only SQL migration runner.
 *
 * - Files are `migrations/NNNN_name.sql`, applied in name order, each exactly once.
 * - A file is sent as one simple-protocol query, so PostgreSQL runs it as a single
 *   implicit transaction: it applies fully or not at all.
 *   Consequence: a new enum value cannot be used in the file that adds it. Split it in two files.
 * - An applied file must never change; the checksum check refuses to continue if one did.
 * - A session advisory lock stops two runners (two deploys) from migrating at once.
 */
export const MIGRATIONS_DIR = join(import.meta.dirname, '..', 'migrations');
const LOCK_KEY = 1_646_974; // arbitrary, constant

export interface MigrationFile {
  name: string;
  checksum: string;
  sql: string;
}
export interface MigrationState extends Omit<MigrationFile, 'sql'> {
  appliedAt: Date | null;
}

export const listMigrations = (dir = MIGRATIONS_DIR): MigrationFile[] =>
  readdirSync(dir)
    .filter((file) => /^\d{4}_.+\.sql$/.test(file))
    .sort()
    .map((name) => {
      const sql = readFileSync(join(dir, name), 'utf8');
      return { name, sql, checksum: createHash('sha256').update(sql).digest('hex') };
    });

const connect = (url: string) => postgres(url, { max: 1, onnotice: () => {} });

const ensureLedger = (sql: postgres.Sql) => sql`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name       text PRIMARY KEY,
    checksum   text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`;

const readApplied = async (sql: postgres.Sql) => {
  const rows = await sql<{ name: string; checksum: string; applied_at: Date }[]>`
    SELECT name, checksum, applied_at FROM schema_migrations ORDER BY name`;
  return new Map(rows.map((row) => [row.name, row]));
};

const assertUnchanged = (
  files: MigrationFile[],
  applied: Awaited<ReturnType<typeof readApplied>>,
) => {
  for (const file of files) {
    const row = applied.get(file.name);
    if (row && row.checksum !== file.checksum) {
      throw new Error(
        `Migration ${file.name} was edited after it was applied. Restore it and add a new numbered file instead.`,
      );
    }
  }
};

export const migrationStatus = async (
  url: string,
  dir = MIGRATIONS_DIR,
): Promise<MigrationState[]> => {
  const sql = connect(url);
  try {
    await ensureLedger(sql);
    const applied = await readApplied(sql);
    return listMigrations(dir).map(({ name, checksum }) => ({
      name,
      checksum,
      appliedAt: applied.get(name)?.applied_at ?? null,
    }));
  } finally {
    await sql.end();
  }
};

export const migrate = async (
  url: string,
  { dir = MIGRATIONS_DIR, log = console.log }: { dir?: string; log?: (line: string) => void } = {},
): Promise<string[]> => {
  const sql = connect(url);
  const done: string[] = [];
  try {
    await sql`SELECT pg_advisory_lock(${LOCK_KEY})`;
    await ensureLedger(sql);
    const files = listMigrations(dir);
    const applied = await readApplied(sql);
    assertUnchanged(files, applied);

    for (const file of files.filter((f) => !applied.has(f.name))) {
      const started = performance.now();
      const ledger = `INSERT INTO schema_migrations (name, checksum) VALUES ('${file.name}', '${file.checksum}');`;
      // Schema and ledger row in the same implicit transaction.
      await sql.unsafe(`${file.sql}\n;${ledger}`).simple();
      done.push(file.name);
      log(`applied ${file.name} in ${Math.round(performance.now() - started)} ms`);
    }
    if (done.length === 0) log('database is up to date');
    return done;
  } finally {
    await sql`SELECT pg_advisory_unlock(${LOCK_KEY})`.catch(() => {});
    await sql.end();
  }
};
