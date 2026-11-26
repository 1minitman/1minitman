import { assertAppEnv, createDatabase } from '@1minitman/db';
import { PgBoss } from 'pg-boss';
import { loadEnv } from './config/env';
import { jobs } from './jobs';
import type { JobContext } from './platform/job';
import { startRunner } from './platform/runner';

const env = loadEnv();
const log: JobContext['log'] = (message, fields) =>
  console.log(
    JSON.stringify({ time: new Date().toISOString(), service: 'worker', message, ...fields }),
  );

const database = createDatabase({
  url: env.WORKER_DATABASE_URL,
  surface: 'worker',
  appEnv: env.APP_ENV,
  max: 4,
  applicationName: 'worker',
});
// TRX-056: in production the worker login must carry app.env = 'production' as a role setting.
await assertAppEnv(database);
// pg-boss keeps its tables in its own `pgboss` schema, on its own connection and database role.
// Job payloads are stored there in plain text: pass ids, never secrets or personal data.
// The schema itself is created by `pnpm db:roles`; the queue role may not create schemas.
const boss = new PgBoss({
  connectionString: env.QUEUE_DATABASE_URL,
  application_name: 'worker-queue',
  createSchema: false,
});
boss.on('error', (error) => log('queue error', { error: error.message }));

await boss.start();
await startRunner(boss, jobs, { database, log });

const shutdown = async (signal: string) => {
  log('shutting down', { signal });
  await boss.stop({ graceful: true, timeout: 20_000 });
  await database.close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
