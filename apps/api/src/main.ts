import { createDatabase } from '@1minitman/db';
import { RedisClient } from 'bun';
import { createApp } from './app';
import { loadEnv } from './config/env';
import { createCheckReadiness, postgresProbe, redisProbe } from './modules/system';
import {
  createAdminGuards,
  createMemberGuards,
  createRedisSessionDenyList,
  denyAllAdminAuthPorts,
  denyAllMemberAuthPorts,
} from './platform/auth';
import { createLogger } from './platform/logger';
import {
  createPolicyStore,
  createRedisRateLimiter,
  postgresPolicySource,
  subscribeToPolicyChanges,
} from './platform/rate-limit';

// Composition root: the only place that knows concrete infrastructure.
const env = loadEnv();
const logger = createLogger(env.LOG_LEVEL, { service: 'api', env: env.APP_ENV });

const database = createDatabase({
  url: env.DATABASE_URL,
  surface: 'member',
  appEnv: env.APP_ENV,
  applicationName: 'api',
});
// The admin surface has its own pool and login; admin modules take it through withAdminTx.
const adminDatabase = createDatabase({
  url: env.ADMIN_DATABASE_URL,
  surface: 'admin',
  appEnv: env.APP_ENV,
  max: 5,
  applicationName: 'api-admin',
});
const redis = new RedisClient(env.REDIS_URL);
// A subscribed connection can run no other command, so the reload listener has its own.
const redisSubscriber = new RedisClient(env.REDIS_URL);

// Limits come only from rate_limit_policies: loaded before the first request (a failure stops the
// start), then reloaded on every change message and after a reconnect (MOD-00-API-03).
const rateLimitPolicies = createPolicyStore(postgresPolicySource(database), logger);
await rateLimitPolicies.reload();
const stopPolicyReload = await subscribeToPolicyChanges(redisSubscriber, rateLimitPolicies, logger);

const app = createApp({
  env,
  logger,
  checkReadiness: createCheckReadiness({
    database: postgresProbe(database),
    redis: redisProbe(redis),
  }),
  surfaces: {
    rateLimits: { policies: rateLimitPolicies, limiter: createRedisRateLimiter(redis) },
    auth: {
      // Deny by default until MOD-03 supplies token verification and MOD-01 the admin checks.
      member: createMemberGuards({
        ...denyAllMemberAuthPorts(),
        denyList: createRedisSessionDenyList(redis),
      }),
      admin: createAdminGuards(denyAllAdminAuthPorts()),
    },
  },
});

const server = Bun.serve({ port: env.API_PORT, fetch: app.fetch });
logger.info('api listening', { url: `http://localhost:${server.port}`, docs: '/docs' });

const shutdown = async (signal: string) => {
  logger.info('shutting down', { signal });
  await server.stop();
  await stopPolicyReload().catch(() => {});
  redisSubscriber.close();
  redis.close();
  await Promise.all([database.close(), adminDatabase.close()]);
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
