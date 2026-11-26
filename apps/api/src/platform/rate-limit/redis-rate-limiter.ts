import type { RedisClient } from 'bun';
import { toSeconds, type RateLimitDecision, type RateLimiter } from './rate-limiter';

/**
 * Coded default for every limiter command. 1MM-STD-16 section 6: every Redis command has a
 * timeout, and the Bun client queues commands while it reconnects, so without one an outage
 * would hang the request instead of reaching the fail-open or fail-closed rule (DEC-002). The
 * value is a **Recommendation** to move into `remote_config` with the other timeouts
 * (GAP-STD16-02), the same as the session denylist's.
 */
export const RATE_LIMITER_TIMEOUT_MS = 100;

// One script per hit makes "check the lock, count, decide, lock" atomic, so every API instance
// sees the same count and two requests can never both take the last slot. Time comes from the
// Redis server (TIME), not from the instance, so clock skew between instances changes nothing.
// A counter left in another algorithm's shape (the policy was edited) is dropped and restarted.
// A sliding-window refusal retries when the hit `limit` places from the newest leaves the window
// (not the oldest: after the limit was lowered the set holds more hits than the limit).
// Replies: {1, remaining, 0} allowed; {0, 0, retry_ms} limited; {2, 0, retry_ms} locked.
const SCRIPT = `
local ck, lk = KEYS[1], KEYS[2]
local alg, limit, window, lockout, member = ARGV[1], tonumber(ARGV[2]), tonumber(ARGV[3]), tonumber(ARGV[4]), ARGV[5]
local t = redis.call('TIME')
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
local lock_ttl = redis.call('PTTL', lk)
if lock_ttl > 0 then return {2, 0, lock_ttl} end
local want = 'hash'
if alg == 'sliding_window' then want = 'zset' end
local kind = redis.call('TYPE', ck)['ok']
if kind ~= 'none' and kind ~= want then redis.call('DEL', ck) end
local retry
if alg == 'sliding_window' then
  redis.call('ZREMRANGEBYSCORE', ck, 0, now - window)
  local count = redis.call('ZCARD', ck)
  if count < limit then
    redis.call('ZADD', ck, now, member)
    redis.call('PEXPIRE', ck, window)
    return {1, limit - count - 1, 0}
  end
  local frees = redis.call('ZRANGE', ck, count - limit, count - limit, 'WITHSCORES')
  retry = tonumber(frees[2]) + window - now
elseif alg == 'fixed_window' then
  local start = math.floor(now / window) * window
  local count = 0
  if tonumber(redis.call('HGET', ck, 's')) == start then
    count = tonumber(redis.call('HGET', ck, 'c')) or 0
  else
    redis.call('HSET', ck, 's', tostring(start), 'c', '0')
  end
  redis.call('PEXPIREAT', ck, start + window)
  if count < limit then
    redis.call('HINCRBY', ck, 'c', 1)
    return {1, limit - count - 1, 0}
  end
  retry = start + window - now
else
  local tokens = tonumber(redis.call('HGET', ck, 't'))
  local at = tonumber(redis.call('HGET', ck, 'a'))
  if tokens == nil or at == nil then tokens = limit; at = now end
  tokens = math.min(limit, tokens + (now - at) * limit / window)
  local ok = tokens >= 1
  if ok then tokens = tokens - 1 end
  redis.call('HSET', ck, 't', tostring(tokens), 'a', tostring(now))
  redis.call('PEXPIRE', ck, window)
  if ok then return {1, math.floor(tokens), 0} end
  retry = math.ceil((1 - tokens) * window / limit)
end
if lockout > 0 then
  redis.call('SET', lk, '1', 'PX', lockout)
  redis.call('DEL', ck)
  return {2, 0, lockout}
end
return {0, 0, retry}
`;

const withTimeout = async <T>(work: Promise<T>, timeoutMs: number, what: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${what} timed out after ${timeoutMs} ms`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

export const createRedisRateLimiter = (
  redis: RedisClient,
  timeoutMs: number = RATE_LIMITER_TIMEOUT_MS,
): RateLimiter => ({
  async consume(keys, rule) {
    const reply = (await withTimeout(
      redis.send('EVAL', [
        SCRIPT,
        '2',
        keys.counter,
        keys.lock,
        rule.algorithm,
        String(rule.limit),
        String(rule.windowSeconds * 1000),
        String((rule.lockoutSeconds ?? 0) * 1000),
        crypto.randomUUID(),
      ]),
      timeoutMs,
      'rate limiter',
    )) as [number, number, number];
    const [code, remaining, retryMs] = reply;
    if (code === 1) return { outcome: 'allowed', remaining, retryAfterSeconds: 0 };
    const decision: RateLimitDecision = {
      outcome: code === 2 ? 'locked' : 'limited',
      remaining: 0,
      retryAfterSeconds: toSeconds(retryMs),
    };
    return decision;
  },
  async lockRemaining(lockKey) {
    const ttl = (await withTimeout(redis.pttl(lockKey), timeoutMs, 'rate limiter')) as number;
    return ttl > 0 ? toSeconds(ttl) : 0;
  },
});
