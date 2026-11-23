import type { RedisClient } from 'bun';
import type { RateLimiter } from './rate-limiter';

// Sliding window in one sorted set per key. A Lua script makes "trim, count, add" atomic, so
// every API instance sees the same count and two requests can never both take the last slot.
const SCRIPT = `
local key, now, window, limit, member = KEYS[1], tonumber(ARGV[1]), tonumber(ARGV[2]), tonumber(ARGV[3]), ARGV[4]
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)
if count < limit then
  redis.call('ZADD', key, now, member)
  redis.call('PEXPIRE', key, window)
  return {1, limit - count - 1, 0}
end
local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
return {0, 0, tonumber(oldest[2]) + window - now}
`;

export const createRedisRateLimiter = (redis: RedisClient): RateLimiter => ({
  async hit(key, limit, windowSeconds) {
    const now = Date.now();
    const reply = (await redis.send('EVAL', [
      SCRIPT,
      '1',
      key,
      String(now),
      String(windowSeconds * 1000),
      String(limit),
      `${now}:${crypto.randomUUID()}`,
    ])) as [number, number, number];
    const [allowed, remaining, retryMs] = reply;
    return {
      allowed: allowed === 1,
      remaining,
      retryAfterSeconds: allowed === 1 ? 0 : Math.max(1, Math.ceil(retryMs / 1000)),
    };
  },
});
