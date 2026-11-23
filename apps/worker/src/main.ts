import { createDatabase } from '@1minitman/db';
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

const database = createDatabase({ url: env.DATABASE_URL, max: 4, applicationName: 'worker' });
// pg-boss keeps its tables in its own `pgboss` schema and creates them on first start.
const boss = new PgBoss({ connectionString: env.queueUrl, application_name: 'worker-queue' });
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
