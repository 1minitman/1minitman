import type { RedisClient } from 'bun';
import type { IdempotencyRecord, IdempotencyStore } from './store';

/**
 * Coded default for every idempotency command, the same as the rate limiter's (1MM-STD-16
 * section 6: every Redis command has a timeout; the Bun client queues commands while it
 * reconnects). A **Recommendation** to move into `remote_config` with the other timeouts
 * (GAP-STD16-02).
 */
export const IDEMPOTENCY_STORE_TIMEOUT_MS = 100;

// Claim: return the record already there, or write the lease. One script, so it is atomic across
// every API instance.
const BEGIN = `
local v = redis.call('GET', KEYS[1])
if v then return v end
redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2])
return false
`;

// Store the response unless another request has claimed the key since our lease lapsed.
const COMPLETE = `
local v = redis.call('GET', KEYS[1])
if v and cjson.decode(v).owner ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'PX', ARGV[3])
return 1
`;

const RELEASE = `
local v = redis.call('GET', KEYS[1])
if v and cjson.decode(v).owner == ARGV[1] then redis.call('DEL', KEYS[1]) end
return 0
`;

const withTimeout = async <T>(work: Promise<T>, timeoutMs: number): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`idempotency store timed out after ${timeoutMs} ms`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

export const createRedisIdempotencyStore = (
  redis: RedisClient,
  timeoutMs: number = IDEMPOTENCY_STORE_TIMEOUT_MS,
): IdempotencyStore => {
  const run = (script: string, key: string, args: string[]) =>
    withTimeout(redis.send('EVAL', [script, '1', key, ...args]), timeoutMs);
  return {
    async begin(key, fingerprint, owner, leaseMs) {
      const lease: IdempotencyRecord = { state: 'in_progress', fingerprint, owner };
      const existing = (await run(BEGIN, key, [JSON.stringify(lease), String(leaseMs)])) as
        string | null;
      if (existing === null) return { claimed: true };
      return { claimed: false, record: JSON.parse(existing) as IdempotencyRecord };
    },
    async complete(key, fingerprint, owner, response, ttlMs) {
      const record: IdempotencyRecord = { state: 'completed', fingerprint, owner, response };
      const done = await run(COMPLETE, key, [owner, JSON.stringify(record), String(ttlMs)]);
      return done === 1;
    },
    async release(key, owner) {
      await run(RELEASE, key, [owner]);
    },
  };
};
