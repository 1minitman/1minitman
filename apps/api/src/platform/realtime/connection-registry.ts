import type { RedisClient } from 'bun';
import { WS_CONNECTION_TTL_SECONDS } from '@1minitman/contracts';
import { connectionKey } from './channels';
import { REALTIME_REDIS_TIMEOUT_MS, withTimeout } from './timeout';

/**
 * The connection registry `ws:conn:{user_id}`: the set of a member's open connection ids, 120 s
 * TTL refreshed by the 30 s heartbeat [DD §14], [TR §8.3]. A member whose set has expired has no
 * live socket anywhere, which feature modules use to decide between a push and a socket event.
 */
export interface ConnectionRegistry {
  /** Adds the connection and (re)sets the TTL. Rejects when Redis cannot answer. */
  add(userId: string, connectionId: string): Promise<void>;
  /** Heartbeat: adds the connection again (it may have expired) and resets the TTL. */
  refresh(userId: string, connectionId: string): Promise<void>;
  /** Removes the connection on close. Never rejects; the TTL cleans up a failure. */
  remove(userId: string, connectionId: string): Promise<void>;
}

export const createRedisConnectionRegistry = (
  redis: Pick<RedisClient, 'send'>,
  timeoutMs: number = REALTIME_REDIS_TIMEOUT_MS,
): ConnectionRegistry => {
  const touch = async (userId: string, connectionId: string) => {
    const key = connectionKey(userId);
    await withTimeout(
      Promise.all([
        redis.send('SADD', [key, connectionId]),
        redis.send('EXPIRE', [key, String(WS_CONNECTION_TTL_SECONDS)]),
      ]),
      timeoutMs,
      'connection registry',
    );
  };
  return {
    add: touch,
    refresh: touch,
    async remove(userId, connectionId) {
      await withTimeout(
        redis.send('SREM', [connectionKey(userId), connectionId]),
        timeoutMs,
        'connection registry',
      ).catch(() => {});
    },
  };
};

/** In-process registry for unit tests: the set per member, without TTLs. */
export const createMemoryConnectionRegistry = () => {
  const sets = new Map<string, Set<string>>();
  const registry: ConnectionRegistry = {
    add(userId, connectionId) {
      sets.set(userId, (sets.get(userId) ?? new Set()).add(connectionId));
      return Promise.resolve();
    },
    refresh(userId, connectionId) {
      return registry.add(userId, connectionId);
    },
    remove(userId, connectionId) {
      sets.get(userId)?.delete(connectionId);
      return Promise.resolve();
    },
  };
  return { registry, connections: (userId: string) => [...(sets.get(userId) ?? [])] };
};
