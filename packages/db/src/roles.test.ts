import { afterAll, describe, expect, test } from 'bun:test';
import postgres from 'postgres';

// Proves the role separation on a real database (`pnpm services:up && pnpm db:migrate && pnpm db:roles`).
const urls = {
  api: process.env.DATABASE_URL,
  worker: process.env.WORKER_DATABASE_URL,
  queue: process.env.QUEUE_DATABASE_URL,
};
const ready = Object.values(urls).every(Boolean);
const connect = (url: string | undefined) => postgres(url ?? '', { max: 1, onnotice: () => {} });
const api = connect(urls.api);
const worker = connect(urls.worker);
const queue = connect(urls.queue);
afterAll(() => Promise.all([api.end(), worker.end(), queue.end()]));

const denied = (query: Promise<unknown>) =>
  expect(query).rejects.toThrow(/permission denied|must be owner/);

describe.skipIf(!ready)('database roles', () => {
  test('the member API reads data but cannot change the schema', async () => {
    const [row] = await api`SELECT count(*)::int AS n FROM remote_config`;
    expect(row?.n).toBeGreaterThan(0);
    await denied(api`CREATE TABLE should_not_exist (id int)`);
    await denied(api`DROP TABLE remote_config`);
    await denied(api`ALTER TABLE remote_config ADD COLUMN nope int`);
  });

  test('the member API cannot touch admin-only tables or the migration ledger', async () => {
    await denied(api`SELECT 1 FROM vendor_settings`);
    await denied(api`SELECT 1 FROM admin_recovery_codes`);
    await denied(api`SELECT 1 FROM schema_migrations`);
  });

  test('nobody can rewrite the audit log', async () => {
    await denied(api`DELETE FROM admin_audit_log`);
    await denied(worker`UPDATE admin_audit_log SET reason = 'x'`);
  });

  test('the worker cannot run DDL, except creating partitions through the definer function', async () => {
    await denied(worker`CREATE TABLE should_not_exist (id int)`);
    const [row] =
      await worker`SELECT ensure_monthly_partitions('messages', current_date, 1) AS made`;
    expect(row?.made).toBeGreaterThanOrEqual(0);
    await denied(api`SELECT ensure_monthly_partitions('messages', current_date, 1)`);
  });

  test('the queue role owns pgboss and cannot read member data', async () => {
    await queue`CREATE TABLE IF NOT EXISTS pgboss.role_probe (id int)`;
    await queue`DROP TABLE pgboss.role_probe`;
    await denied(queue`SELECT 1 FROM users`);
    await denied(queue`SELECT 1 FROM remote_config`);
  });
});
