import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';

// Applies roles/roles.sql (group roles + grants). On a local or CI database it also creates the
// throwaway login users from roles/local-logins.sql. Idempotent.
const url = process.env.DATABASE_MIGRATION_URL;
if (!url) {
  console.error('DATABASE_MIGRATION_URL is not set. Copy .env.example to .env.development first.');
  process.exit(1);
}
const dir = join(import.meta.dirname, '..', '..', 'roles');
const isLocal = (process.env.APP_ENV ?? 'local') === 'local';

const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  await sql.unsafe(readFileSync(join(dir, 'roles.sql'), 'utf8')).simple();
  console.log('roles and grants applied');
  if (isLocal) {
    await sql.unsafe(readFileSync(join(dir, 'local-logins.sql'), 'utf8')).simple();
    console.log(
      'local login users ready (minitman_api, minitman_admin, minitman_worker, minitman_queue)',
    );
  }
} finally {
  await sql.end();
}
