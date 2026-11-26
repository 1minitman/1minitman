/** `rate_limit_policies.algorithm` [SQL]. */
export type RateLimitAlgorithm = 'sliding_window' | 'token_bucket' | 'fixed_window';

/** The numbers of one policy, as the limiter needs them. They come only from the table. */
export interface LimitRule {
  /** `max_requests`: requests allowed in one window (the token bucket's capacity). */
  limit: number;
  windowSeconds: number;
  algorithm: RateLimitAlgorithm;
  /** `lockout_seconds`: when set, the request over the limit starts a lock this long. */
  lockoutSeconds: number | null;
}

/** The Redis keys of one policy and subject [DD §14]. */
export interface LimitKeys {
  /** `rl:{policy}:{subject}`: the counter. */
  counter: string;
  /** `lock:{policy}:{subject}`: present while a lockout runs. */
  lock: string;
}

export type RateLimitDecision =
  | { outcome: 'allowed'; remaining: number; retryAfterSeconds: 0 }
  /** Over the limit, no lockout: retry once the window frees a slot. */
  | { outcome: 'limited'; remaining: 0; retryAfterSeconds: number }
  /** A lockout is running (started now, or earlier): retry once it ends. */
  | { outcome: 'locked'; remaining: 0; retryAfterSeconds: number };

/**
 * Port: counts one hit for a key and decides, atomically, under the policy's algorithm.
 * A request during a lock is refused without being counted. When a request goes over the limit
 * of a policy with a lockout, the lock is set for `lockoutSeconds` and the counter is cleared, so
 * the subject starts a fresh window when the lock ends.
 */
export interface RateLimiter {
  consume(keys: LimitKeys, rule: LimitRule): Promise<RateLimitDecision>;
  /** Seconds left on `lock:{policy}:{subject}`, 0 when none. Counts nothing. */
  lockRemaining(lockKey: string): Promise<number>;
}

export const toSeconds = (ms: number) => Math.max(1, Math.ceil(ms / 1000));

const allowed = (remaining: number): RateLimitDecision => ({
  outcome: 'allowed',
  remaining,
  retryAfterSeconds: 0,
});

type CounterState =
  | { algorithm: 'sliding_window'; hits: number[] }
  | { algorithm: 'fixed_window'; start: number; count: number }
  | { algorithm: 'token_bucket'; tokens: number; at: number };

/**
 * In-process limiter for tests and single-instance tools; same semantics as the Redis one.
 * Production uses `createRedisRateLimiter`.
 */
export const createMemoryRateLimiter = (now: () => number = Date.now): RateLimiter => {
  const counters = new Map<string, CounterState>();
  const locks = new Map<string, number>();

  const lockLeftMs = (key: string, current: number) => {
    const until = locks.get(key);
    if (until === undefined) return 0;
    if (until <= current) {
      locks.delete(key);
      return 0;
    }
    return until - current;
  };

  /** Counts a hit; returns the remaining budget, or the milliseconds until one frees up. */
  const count = (
    key: string,
    { limit, windowSeconds, algorithm }: LimitRule,
    current: number,
  ): { ok: true; remaining: number } | { ok: false; retryMs: number } => {
    const windowMs = windowSeconds * 1000;
    const previous = counters.get(key);
    const state = previous?.algorithm === algorithm ? previous : undefined;
    if (algorithm === 'sliding_window') {
      const recent = (state?.algorithm === 'sliding_window' ? state.hits : []).filter(
        (time) => time > current - windowMs,
      );
      counters.set(key, { algorithm, hits: recent });
      if (recent.length < limit) {
        recent.push(current);
        return { ok: true, remaining: limit - recent.length };
      }
      return { ok: false, retryMs: (recent[0] ?? current) + windowMs - current };
    }
    if (algorithm === 'fixed_window') {
      const start = Math.floor(current / windowMs) * windowMs;
      const used = state?.algorithm === 'fixed_window' && state.start === start ? state.count : 0;
      if (used < limit) {
        counters.set(key, { algorithm, start, count: used + 1 });
        return { ok: true, remaining: limit - used - 1 };
      }
      counters.set(key, { algorithm, start, count: used });
      return { ok: false, retryMs: start + windowMs - current };
    }
    const bucket = state?.algorithm === 'token_bucket' ? state : { tokens: limit, at: current };
    const tokens = Math.min(limit, bucket.tokens + ((current - bucket.at) * limit) / windowMs);
    if (tokens >= 1) {
      counters.set(key, { algorithm, tokens: tokens - 1, at: current });
      return { ok: true, remaining: Math.floor(tokens - 1) };
    }
    counters.set(key, { algorithm, tokens, at: current });
    return { ok: false, retryMs: Math.ceil(((1 - tokens) * windowMs) / limit) };
  };

  return {
    async consume(keys, rule) {
      const current = now();
      const lockMs = lockLeftMs(keys.lock, current);
      if (lockMs > 0) {
        return { outcome: 'locked', remaining: 0, retryAfterSeconds: toSeconds(lockMs) };
      }
      const result = count(keys.counter, rule, current);
      if (result.ok) return allowed(result.remaining);
      if (rule.lockoutSeconds !== null) {
        locks.set(keys.lock, current + rule.lockoutSeconds * 1000);
        counters.delete(keys.counter);
        return { outcome: 'locked', remaining: 0, retryAfterSeconds: rule.lockoutSeconds };
      }
      return { outcome: 'limited', remaining: 0, retryAfterSeconds: toSeconds(result.retryMs) };
    },
    async lockRemaining(lockKey) {
      const ms = lockLeftMs(lockKey, now());
      return ms > 0 ? toSeconds(ms) : 0;
    },
  };
};
