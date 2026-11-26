import type { RedisClient } from 'bun';
import type { SessionDenyList } from './member';

/** The denylist key for a member session ([TR §8.1], [DD §14]). MOD-03 writes it. */
export const sessionDenyKey = (sessionId: string) => `sess:deny:${sessionId}`;

/** Reads `sess:deny:{session}`. A Redis failure rejects; `requireMember()` then fails closed. */
export const createRedisSessionDenyList = (redis: RedisClient): SessionDenyList => ({
  isDenied: (sessionId) => redis.exists(sessionDenyKey(sessionId)),
});
