import { createDatabase } from '@1minitman/db';
import { RedisClient } from 'bun';
import { afterAll, describe, expect, test } from 'bun:test';
import { postgresProbe, redisProbe } from './probes';

// Integration: needs the local PostgreSQL and Redis (`pnpm services:up`).
const databaseUrl = process.env.DATABASE_URL;
const redisUrl = process.env.REDIS_URL;
const database = databaseUrl
  ? createDatabase({ url: databaseUrl, surface: 'member', appEnv: 'local', max: 1 })
  : null;
const redis = redisUrl ? new RedisClient(redisUrl) : null;
// In CI a missing service must fail the run, never skip it (GAP-STD01-09).
const ci = !['', 'false', '0'].includes(process.env.CI?.trim().toLowerCase() ?? '');
if (ci && (!database || !redis))
  throw new Error('Probe tests need DATABASE_URL and REDIS_URL in CI');
afterAll(async () => {
  redis?.close();
  await database?.close();
});

describe.skipIf(!database)('postgres probe', () => {
  test('pings the database', async () => {
    const probe = postgresProbe(database!);
    expect(probe.name).toBe('database');
    expect(await probe.ping()).toBeUndefined();
  });
});

describe.skipIf(!redis)('redis probe', () => {
  test('pings Redis', async () => {
    const probe = redisProbe(redis!);
    expect(probe.name).toBe('redis');
    expect(await probe.ping()).toBeUndefined();
  });
});
