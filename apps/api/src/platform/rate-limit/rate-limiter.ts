export interface RateLimitDecision {
  allowed: boolean;
  /** Requests left in the current window. */
  remaining: number;
  /** Seconds until the next request would be allowed (0 when allowed). */
  retryAfterSeconds: number;
}

/**
 * Port: counts hits per key in a sliding window.
 * Keys follow the Redis keyspace in the data dictionary: `rl:{policy}:{subject}`.
 */
export interface RateLimiter {
  hit(key: string, limit: number, windowSeconds: number): Promise<RateLimitDecision>;
}

/** In-process limiter for tests and single-instance tools. Production uses the Redis one. */
export const createMemoryRateLimiter = (now: () => number = Date.now): RateLimiter => {
  const hits = new Map<string, number[]>();
  return {
    async hit(key, limit, windowSeconds) {
      const windowMs = windowSeconds * 1000;
      const current = now();
      const recent = (hits.get(key) ?? []).filter((time) => time > current - windowMs);
      if (recent.length < limit) {
        recent.push(current);
        hits.set(key, recent);
        return { allowed: true, remaining: limit - recent.length, retryAfterSeconds: 0 };
      }
      hits.set(key, recent);
      const oldest = recent[0] ?? current;
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - current) / 1000)),
      };
    },
  };
};
