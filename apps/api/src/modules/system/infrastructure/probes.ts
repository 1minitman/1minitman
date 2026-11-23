import type { Database } from '@1minitman/db';
import type { RedisClient } from 'bun';
import type { DependencyProbe } from '../domain/dependency-probe';

export const postgresProbe = (database: Database): DependencyProbe => ({
  name: 'database',
  ping: async () => {
    await database.sql`SELECT 1`;
  },
});

export const redisProbe = (redis: RedisClient): DependencyProbe => ({
  name: 'redis',
  ping: async () => {
    await redis.send('PING', []);
  },
});
