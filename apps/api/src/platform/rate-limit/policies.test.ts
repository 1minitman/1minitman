import { describe, expect, test } from 'bun:test';
import { createLogger } from '../logger';
import {
  CONFIG_CHANGE_CHANNEL,
  createPolicyStore,
  publishPolicyChange,
  RATE_LIMIT_POLICIES_CHANGED,
  staticPolicySource,
  subscribeToPolicyChanges,
  type PolicySubscriber,
  type RateLimitPolicy,
} from './index';

const row = (key: string, maxRequests = 5): RateLimitPolicy => ({
  key,
  scope: 'ip',
  maxRequests,
  windowSeconds: 60,
  lockoutSeconds: null,
  algorithm: 'sliding_window',
  isActive: true,
});
const quiet = createLogger('error');

describe('policy store', () => {
  test('is empty until loaded, then answers by key', async () => {
    const store = createPolicyStore(staticPolicySource([row('a.b'), row('c.d', 9)]));
    expect(store.loaded).toBe(false);
    expect(store.get('a.b')).toBeUndefined();
    await store.reload();
    expect(store.loaded).toBe(true);
    expect(store.get('c.d')?.maxRequests).toBe(9);
    expect(store.get('x.y')).toBeUndefined();
  });

  test('a reload replaces the snapshot whole: removed rows disappear', async () => {
    let rows = [row('a.b'), row('c.d')];
    const store = createPolicyStore({ load: () => Promise.resolve(rows) });
    await store.reload();
    rows = [row('a.b', 1)];
    await store.reload();
    expect(store.get('a.b')?.maxRequests).toBe(1);
    expect(store.get('c.d')).toBeUndefined();
  });

  test('a failed reload throws and keeps the previous policies', async () => {
    let fail = false;
    const store = createPolicyStore({
      load: () => (fail ? Promise.reject(new Error('db down')) : Promise.resolve([row('a.b')])),
    });
    await store.reload();
    fail = true;
    expect(store.reload()).rejects.toThrow('db down');
    await Bun.sleep(0);
    expect(store.get('a.b')).toBeDefined();
    fail = false;
    await store.reload();
  });

  test('the first load failing leaves the store unloaded (the API does not start)', async () => {
    const store = createPolicyStore({ load: () => Promise.reject(new Error('db down')) });
    expect(store.reload()).rejects.toThrow('db down');
    await Bun.sleep(0);
    expect(store.loaded).toBe(false);
  });

  test('reloads run in order: a slow older read never overwrites a newer one', async () => {
    const releases: (() => void)[] = [];
    let version = 0;
    const store = createPolicyStore({
      load: () => {
        const mine = ++version;
        return new Promise((resolve) => releases.push(() => resolve([row('a.b', mine)])));
      },
    });
    const first = store.reload();
    const second = store.reload();
    await Bun.sleep(0);
    expect(releases).toHaveLength(1);
    releases[0]!();
    await first;
    await Bun.sleep(0);
    releases[1]!();
    await second;
    expect(store.get('a.b')?.maxRequests).toBe(2);
  });
});

describe('reload on change', () => {
  const fakeSubscriber = () => {
    const listeners = new Map<string, (message: string, channel: string) => void>();
    const subscriber = {
      onconnect: null as PolicySubscriber['onconnect'],
      subscribe: (channel: string, listener: (message: string, channel: string) => void) => {
        listeners.set(channel, listener);
        return Promise.resolve(1);
      },
      unsubscribe: (channel: string) => {
        listeners.delete(channel);
        return Promise.resolve();
      },
    };
    const send = (message: string) =>
      listeners.get(CONFIG_CHANGE_CHANNEL)?.(message, CONFIG_CHANGE_CHANNEL);
    return {
      subscriber: subscriber as unknown as PolicySubscriber,
      listeners,
      send,
      raw: subscriber,
    };
  };

  test('a change message reloads; other config messages do not', async () => {
    let loads = 0;
    const store = createPolicyStore({ load: () => (loads++, Promise.resolve([row('a.b')])) });
    const fake = fakeSubscriber();
    const stop = await subscribeToPolicyChanges(fake.subscriber, store, quiet);
    fake.send('remote_config');
    await Bun.sleep(0);
    expect(loads).toBe(0);
    fake.send(RATE_LIMIT_POLICIES_CHANGED);
    await Bun.sleep(0);
    expect(loads).toBe(1);
    await stop();
    expect(fake.listeners.size).toBe(0);
    expect(fake.raw.onconnect).toBeNull();
  });

  test('a reconnect reloads, because a message sent while disconnected is lost', async () => {
    let loads = 0;
    const store = createPolicyStore({ load: () => (loads++, Promise.resolve([])) });
    const fake = fakeSubscriber();
    await subscribeToPolicyChanges(fake.subscriber, store, quiet);
    (fake.raw.onconnect as unknown as () => void)();
    await Bun.sleep(0);
    expect(loads).toBe(1);
  });

  test('a failed reload is logged and the previous policies stay', async () => {
    let fail = false;
    const store = createPolicyStore({
      load: () => (fail ? Promise.reject(new Error('db down')) : Promise.resolve([row('a.b')])),
    });
    await store.reload();
    const errors: string[] = [];
    const logger = { ...quiet, error: (message: string) => void errors.push(message) };
    const fake = fakeSubscriber();
    await subscribeToPolicyChanges(fake.subscriber, store, logger);
    fail = true;
    fake.send(RATE_LIMIT_POLICIES_CHANGED);
    await Bun.sleep(1);
    expect(errors).toHaveLength(1);
    expect(store.get('a.b')).toBeDefined();
  });

  test('publishPolicyChange sends the change message on the config channel', async () => {
    const sent: [string, string][] = [];
    await publishPolicyChange({
      publish: (channel: string, message: string) => (
        sent.push([channel, message]),
        Promise.resolve(1)
      ),
    });
    expect(sent).toEqual([[CONFIG_CHANGE_CHANNEL, RATE_LIMIT_POLICIES_CHANGED]]);
  });
});
