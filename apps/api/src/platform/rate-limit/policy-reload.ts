import type { RedisClient } from 'bun';
import type { Logger } from '../logger';
import type { PolicyStore } from './policies';

/**
 * The pub/sub channel that tells every API instance a config table changed (MOD-02 plan
 * section 4.2: "the API publishes a change message; every API instance ... reloads its
 * rate-limit policies"). No source names the channel: this name is the proposal of
 * GAP-MOD00-19 and changes here only if the gap is settled otherwise.
 */
export const CONFIG_CHANGE_CHANNEL = 'ch:config';

/** The message on `CONFIG_CHANGE_CHANNEL` that means `rate_limit_policies` changed. */
export const RATE_LIMIT_POLICIES_CHANGED = 'rate_limit_policies';

/** The part of a Redis connection the subscription uses. It must be a dedicated connection. */
export type PolicySubscriber = Pick<RedisClient, 'subscribe' | 'unsubscribe' | 'onconnect'>;

/**
 * Reloads the store whenever a change message arrives, and after every reconnect (a message sent
 * while the connection was down is lost, so the store reads the table again). A failed reload
 * keeps the previous policies and logs an error. Returns a function that stops listening.
 */
export const subscribeToPolicyChanges = async (
  subscriber: PolicySubscriber,
  store: PolicyStore,
  logger: Logger,
): Promise<() => Promise<void>> => {
  const reload = (why: string) =>
    store.reload().catch((error: unknown) =>
      logger.error('rate-limit policy reload failed, keeping the previous policies', {
        why,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  const listener = (message: string) => {
    if (message === RATE_LIMIT_POLICIES_CHANGED) void reload('change message');
  };
  subscriber.onconnect = () => void reload('reconnect');
  await subscriber.subscribe(CONFIG_CHANGE_CHANNEL, listener);
  return async () => {
    subscriber.onconnect = null;
    await subscriber.unsubscribe(CONFIG_CHANGE_CHANNEL, listener);
  };
};

/**
 * Tells every API instance to reload the policies. MOD-02 calls it after a committed change to
 * `rate_limit_policies` (A31, `PATCH /security/rate-limits`).
 */
export const publishPolicyChange = (redis: Pick<RedisClient, 'publish'>) =>
  redis.publish(CONFIG_CHANGE_CHANNEL, RATE_LIMIT_POLICIES_CHANGED);
