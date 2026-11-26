/**
 * Coded default for every Redis command of the realtime layer. 1MM-STD-16 section 6: every Redis
 * command has a timeout; the value matches the session denylist and the rate limiter. A
 * **Recommendation** to move into `remote_config` with the other timeouts (GAP-STD16-02).
 */
export const REALTIME_REDIS_TIMEOUT_MS = 100;

/** Rejects when `work` has not settled within `ms` (the Redis client queues while reconnecting). */
export const withTimeout = async <T>(work: Promise<T>, ms: number, what: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${what} timed out after ${ms} ms`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};
