import { createDatabase } from '@1minitman/db';
import { PgBoss } from 'pg-boss';
import { loadEnv } from './config/env';
import { jobs, pendingJobs } from './jobs';
import { postgresCatalogue } from './platform/catalogue';
import { postgresFailureNotifier } from './platform/failure-notifier';
import { createLogger, errorLabel } from './platform/logger';
import { createSentryReporter } from './platform/reporter';
import { startRunner } from './platform/runner';

const env = loadEnv();
const logger = createLogger(env.LOG_LEVEL, { service: 'worker' });
const reporter = createSentryReporter({
  dsn: env.SENTRY_DSN_WORKER,
  environment: env.APP_ENV,
  release: env.APP_VERSION,
});

const database = createDatabase({
  url: env.WORKER_DATABASE_URL,
  surface: 'worker',
  appEnv: env.APP_ENV,
  max: 4,
  applicationName: 'worker',
});
// pg-boss keeps its tables in its own `pgboss` schema, on its own connection and database role.
// Job payloads are stored there in plain text: pass ids, never secrets or personal data.
// The schema itself is created by `pnpm db:roles`; the queue role may not create schemas.
const boss = new PgBoss({
  connectionString: env.QUEUE_DATABASE_URL,
  application_name: 'worker-queue',
  createSchema: false,
});
// The label only: a queue driver's message can quote a job payload or a query value.
boss.on('error', (error) => logger.error('queue error', { error: errorLabel(error) }));

await boss.start();
await startRunner(boss, jobs, {
  catalogue: postgresCatalogue(database),
  pending: pendingJobs,
  context: { database, logger },
  reporter,
  notifier: postgresFailureNotifier(database),
});

const shutdown = async (signal: string) => {
  logger.info('shutting down', { signal });
  await boss.stop({ graceful: true, timeout: 20_000 });
  await reporter.flush(2_000);
  await database.close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
