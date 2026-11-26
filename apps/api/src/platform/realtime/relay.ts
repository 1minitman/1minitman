import type { RedisClient } from 'bun';
import type { Logger } from '../logger';
import { REALTIME_REDIS_TIMEOUT_MS, withTimeout } from './timeout';

/** A message handed to the local listeners of a channel, exactly as it was published. */
export type RelayListener = (message: string) => void;

/**
 * Cross-instance fan-out over Redis pub/sub (1MM-ADR-0019, [TR §4.2]). An instance subscribes to
 * a channel while at least one local listener (a socket or a stream) is on it, and unsubscribes
 * when the last one leaves. A message is always published through Redis, never delivered
 * locally first, so a socket on this instance and one on another see the same single copy.
 */
export interface Relay {
  /** Adds a local listener; subscribes the instance to the channel on the first one. */
  join(channel: string, listener: RelayListener): Promise<void>;
  /** Removes a local listener; unsubscribes on the last one. Never rejects. */
  leave(channel: string, listener: RelayListener): Promise<void>;
  /** Publishes to every instance subscribed to the channel. Rejects when Redis cannot answer. */
  publish(channel: string, message: string): Promise<void>;
  /** The channels this instance is subscribed to (for tests and metrics). */
  channels(): string[];
  /** Stops listening and drops every local listener. */
  close(): Promise<void>;
}

/** Local listeners per channel, shared by both relays. */
const createListenerTable = (logger: Logger) => {
  const table = new Map<string, Set<RelayListener>>();
  return {
    table,
    /** True when this is the channel's first listener. */
    add(channel: string, listener: RelayListener) {
      const listeners = table.get(channel);
      if (listeners) {
        listeners.add(listener);
        return false;
      }
      table.set(channel, new Set([listener]));
      return true;
    },
    /** True when the channel has no listener left. */
    remove(channel: string, listener: RelayListener) {
      const listeners = table.get(channel);
      if (!listeners) return false;
      listeners.delete(listener);
      if (listeners.size > 0) return false;
      table.delete(channel);
      return true;
    },
    dispatch(channel: string, message: string) {
      for (const listener of table.get(channel) ?? []) {
        try {
          listener(message);
        } catch (error) {
          // One broken listener must not stop delivery to the others.
          logger.error('realtime listener failed', {
            channel,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    },
  };
};

/** In-process relay for unit tests and a single instance. Delivery is asynchronous, like Redis. */
export const createMemoryRelay = (logger: Logger): Relay => {
  const listeners = createListenerTable(logger);
  return {
    join: (channel, listener) => {
      listeners.add(channel, listener);
      return Promise.resolve();
    },
    leave: (channel, listener) => {
      listeners.remove(channel, listener);
      return Promise.resolve();
    },
    publish: (channel, message) => {
      queueMicrotask(() => listeners.dispatch(channel, message));
      return Promise.resolve();
    },
    channels: () => [...listeners.table.keys()],
    close: () => {
      listeners.table.clear();
      return Promise.resolve();
    },
  };
};

/** The part of a Redis connection the relay subscribes with. It must be a dedicated connection. */
export type RelaySubscriber = Pick<RedisClient, 'subscribe' | 'unsubscribe' | 'onconnect'>;

export interface RedisRelayDeps {
  /** A connection used only for SUBSCRIBE (a subscribed connection can run nothing else). */
  subscriber: RelaySubscriber;
  /** Any connection, for PUBLISH. */
  publisher: Pick<RedisClient, 'publish'>;
  logger: Logger;
  timeoutMs?: number;
}

/**
 * Redis pub/sub relay. Bun's client does not restore subscriptions after a reconnect (a
 * subscription is silently lost when the connection drops), so on every reconnect the relay
 * subscribes again to each channel that still has local listeners. Messages published while the
 * connection was down are lost; clients resync over REST, which is the polling fallback
 * [TR §4.2].
 */
export const createRedisRelay = ({
  subscriber,
  publisher,
  logger,
  timeoutMs = REALTIME_REDIS_TIMEOUT_MS,
}: RedisRelayDeps): Relay => {
  const listeners = createListenerTable(logger);
  // One Redis-side listener per channel; Bun keeps its own list, which a reconnect leaves stale.
  const dispatchers = new Map<string, (message: string, channel: string) => void>();
  let connections = 0;

  // A first join's SUBSCRIBE still in flight; a later join on the channel waits for it.
  const subscribing = new Map<string, Promise<void>>();

  const subscribe = async (channel: string) => {
    const dispatcher = (message: string) => listeners.dispatch(channel, message);
    dispatchers.set(channel, dispatcher);
    try {
      // 1MM-STD-16 section 6: the client queues commands while it reconnects, so without a
      // timeout a join (and the socket's handshake) would wait for as long as Redis is down.
      await withTimeout(subscriber.subscribe(channel, dispatcher), timeoutMs, 'realtime subscribe');
    } catch (error) {
      // A SUBSCRIBE that lands after the timeout must not stay behind; UNSUBSCRIBE queues after it.
      if (dispatchers.get(channel) === dispatcher) dispatchers.delete(channel);
      await subscriber.unsubscribe(channel).catch(() => {});
      throw error;
    }
  };
  const unsubscribe = async (channel: string) => {
    dispatchers.delete(channel);
    await subscriber.unsubscribe(channel);
  };

  subscriber.onconnect = () => {
    connections += 1;
    if (connections === 1) return;
    const channels = [...listeners.table.keys()];
    logger.warn('realtime relay reconnected, subscribing again', { channels: channels.length });
    for (const channel of channels) {
      // Drop Bun's stale record first; subscribing on top of it would deliver every message twice.
      void unsubscribe(channel)
        .catch(() => {})
        .then(() => (listeners.table.has(channel) ? subscribe(channel) : undefined))
        .catch((error: unknown) =>
          logger.error('realtime relay could not subscribe again', {
            channel,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
    }
  };

  return {
    async join(channel, listener) {
      let pending = subscribing.get(channel);
      if (listeners.add(channel, listener)) {
        pending = subscribe(channel).finally(() => subscribing.delete(channel));
        subscribing.set(channel, pending);
      }
      try {
        await pending;
      } catch (error) {
        // Every listener that waited on the failed SUBSCRIBE leaves, so none is left unserved.
        listeners.remove(channel, listener);
        throw error;
      }
    },
    async leave(channel, listener) {
      if (!listeners.remove(channel, listener)) return;
      await unsubscribe(channel).catch((error: unknown) =>
        logger.warn('realtime relay could not unsubscribe', {
          channel,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    },
    async publish(channel, message) {
      await withTimeout(publisher.publish(channel, message), timeoutMs, 'realtime publish');
    },
    channels: () => [...listeners.table.keys()],
    async close() {
      subscriber.onconnect = null;
      const channels = [...listeners.table.keys()];
      listeners.table.clear();
      await Promise.all(channels.map((channel) => unsubscribe(channel).catch(() => {})));
    },
  };
};
