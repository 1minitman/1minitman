import type { RedisClient } from 'bun';
import type { SessionDenyList } from './member';

/** The denylist key for a member session ([TR §8.1], [DD §14]). MOD-03 writes it. */
export const sessionDenyKey = (sessionId: string) => `sess:deny:${sessionId}`;

/**
 * Coded default for the denylist read. 1MM-STD-16 section 6: every Redis command has a timeout
 * and a read request's outbound calls stay under the 200 ms p95 budget [TR §15.1]. The value is
 * a **Recommendation** to move into `remote_config` with the other timeouts (GAP-STD16-02).
 */
export const SESSION_DENY_LIST_TIMEOUT_MS = 100;

/**
 * Reads `sess:deny:{session}`. A Redis failure, or no answer within `timeoutMs` (the client
 * queues commands while it reconnects), rejects; `requireMember()` then fails closed.
 */
export const createRedisSessionDenyList = (
  redis: RedisClient,
  timeoutMs: number = SESSION_DENY_LIST_TIMEOUT_MS,
): SessionDenyList => ({
  async isDenied(sessionId) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        redis.exists(sessionDenyKey(sessionId)),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`session denylist timed out after ${timeoutMs} ms`)),
            timeoutMs,
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  },
});
