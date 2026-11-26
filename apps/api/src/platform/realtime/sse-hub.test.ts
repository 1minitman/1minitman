import { AdminStreamEventSchema } from '@1minitman/contracts';
import { describe, expect, test } from 'bun:test';
import type { AdminPrincipal } from '../auth/principals';
import { requestContext } from '../http/middleware';
import { createRouter } from '../http/router';
import { createLogger } from '../logger';
import { ADMIN_ALL_CHANNEL, adminChannel } from './channels';
import { createMemoryRelay, type Relay } from './relay';
import { withTimeout } from './timeout';
import {
  createAdminStreamHub,
  denyAllAdminStreamFilter,
  type AdminStreamFilter,
  type AdminStreamHubDeps,
} from './sse-hub';

const logger = createLogger('error');
const ADMIN: AdminPrincipal = { adminId: 'adm-1', sessionId: 'as-1' };
const OTHER: AdminPrincipal = { adminId: 'adm-2', sessionId: 'as-2' };

/** Admins hold `reports.read`; `adm-2` also needs scope country NG. */
const filter: AdminStreamFilter = {
  canReceive: (principal, event) => {
    if (event.type === 'boom.event') return Promise.reject(new Error('permissions unavailable'));
    if (event.permission !== null && event.permission !== 'reports.read') {
      return Promise.resolve(false);
    }
    if (principal.adminId === 'adm-2' && event.scope?.country !== 'NG') {
      return Promise.resolve(false);
    }
    return Promise.resolve(true);
  },
};

const setup = (overrides: Partial<AdminStreamHubDeps> = {}) => {
  const relay = overrides.relay ?? createMemoryRelay(logger);
  const hub = createAdminStreamHub({
    relay,
    filter,
    logger,
    now: () => new Date('2026-11-26T10:00:00.000Z'),
    ...overrides,
  });
  const app = createRouter();
  app.use('*', requestContext(logger));
  app.get('/stream/:admin', (c) => hub.stream(c, c.req.param('admin') === 'adm-2' ? OTHER : ADMIN));
  return { hub, relay, app };
};

/** Reads SSE blocks from a response until `count` arrived or `ms` passed. */
const reader = (res: Response) => {
  const body = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  return {
    async read(count: number, ms = 200) {
      const blocks: string[] = [];
      const deadline = Date.now() + ms;
      while (blocks.length < count && Date.now() < deadline) {
        const chunk = await Promise.race([
          body.read(),
          Bun.sleep(deadline - Date.now()).then(() => null),
        ]);
        if (!chunk || chunk.done) break;
        buffer += decoder.decode(chunk.value);
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        blocks.push(...parts.filter((part) => part && part !== ': open'));
      }
      return blocks;
    },
    cancel: () => body.cancel(),
  };
};
const parse = (block: string) => {
  const fields = Object.fromEntries(
    block
      .split('\n')
      .map((line) => [line.slice(0, line.indexOf(':')), line.slice(line.indexOf(':') + 2)]),
  ) as Record<string, string>;
  return { event: fields.event, data: JSON.parse(fields.data ?? 'null') as unknown };
};

describe('admin SSE hub', () => {
  test('an event the filter accepts is streamed with its type, data and time', async () => {
    const { hub, app } = setup();
    const res = await app.request('/stream/adm-1');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const stream = reader(res);
    await hub.publishToAll({
      type: 'queue.counts',
      data: { reports: 3 },
      permission: 'reports.read',
    });
    const [block] = await stream.read(1);
    const event = parse(block!);
    expect(event.event).toBe('queue.counts');
    expect(AdminStreamEventSchema.parse(event.data)).toEqual({
      type: 'queue.counts',
      data: { reports: 3 },
      at: '2026-11-26T10:00:00.000Z',
    });
    await stream.cancel();
  });

  test('permission and scope are filtered on the server; a filter failure drops the event', async () => {
    const { hub, app } = setup();
    const scoped = reader(await app.request('/stream/adm-2'));
    await hub.publishToAll({ type: 'case.updated', data: { n: 1 }, permission: 'safety.read' });
    await hub.publishToAll({ type: 'case.updated', data: { n: 2 }, permission: 'reports.read' });
    await hub.publishToAll({ type: 'boom.event', data: {}, permission: 'reports.read' });
    await hub.publishToAll({
      type: 'case.updated',
      data: { n: 3 },
      permission: 'reports.read',
      scope: { country: 'NG' },
    });
    const blocks = await scoped.read(2, 100);
    expect(blocks.map((b) => parse(b).data)).toEqual([
      { type: 'case.updated', data: { n: 3 }, at: '2026-11-26T10:00:00.000Z' },
    ]);
    await scoped.cancel();
  });

  test('an event for one admin reaches only that admin', async () => {
    const { hub, app } = setup();
    const mine = reader(await app.request('/stream/adm-1'));
    const theirs = reader(await app.request('/stream/adm-2'));
    await hub.publishToAdmin('adm-1', { type: 'session.revoked', data: {}, permission: null });
    expect((await mine.read(1)).map((b) => parse(b).event)).toEqual(['session.revoked']);
    expect(await theirs.read(1, 50)).toEqual([]);
    await mine.cancel();
    await theirs.cancel();
  });

  test('the deny-all filter lets nothing through', async () => {
    const { hub, app } = setup({ filter: denyAllAdminStreamFilter });
    const stream = reader(await app.request('/stream/adm-1'));
    await hub.publishToAdmin('adm-1', { type: 'session.revoked', data: {}, permission: null });
    expect(await stream.read(1, 50)).toEqual([]);
    await stream.cancel();
  });

  test('a malformed channel message is dropped and the stream carries on', async () => {
    const { hub, relay, app } = setup();
    const stream = reader(await app.request('/stream/adm-1'));
    await relay.publish(ADMIN_ALL_CHANNEL, '{not json');
    await relay.publish(ADMIN_ALL_CHANNEL, JSON.stringify({ type: 'x' }));
    await hub.publishToAll({ type: 'queue.counts', data: {}, permission: 'reports.read' });
    expect((await stream.read(1)).map((b) => parse(b).event)).toEqual(['queue.counts']);
    await stream.cancel();
  });

  test('a heartbeat comment is written while the stream is idle', async () => {
    const { app } = setup({ heartbeatMs: 10 });
    const stream = reader(await app.request('/stream/adm-1'));
    expect(await stream.read(1)).toEqual([': ping']);
    await stream.cancel();
  });

  test('a closed tab leaves both channels', async () => {
    const { hub, relay, app } = setup();
    const stream = reader(await app.request('/stream/adm-1'));
    expect(relay.channels().sort()).toEqual([ADMIN_ALL_CHANNEL, adminChannel('adm-1')].sort());
    expect(hub.streamCount()).toBe(1);
    await stream.cancel();
    await Bun.sleep(5);
    expect(hub.streamCount()).toBe(0);
    expect(relay.channels()).toEqual([]);
  });

  test('a tab that cannot keep up is closed', async () => {
    let release: () => void = () => {};
    const stuck: AdminStreamFilter = {
      canReceive: () => new Promise((resolve) => (release = () => resolve(true))),
    };
    const { hub, relay, app } = setup({ filter: stuck, maxQueued: 2 });
    const res = await app.request('/stream/adm-1');
    for (let i = 0; i < 4; i += 1) {
      await hub.publishToAll({ type: 'queue.counts', data: { i }, permission: 'reports.read' });
    }
    await Bun.sleep(5);
    release();
    await Bun.sleep(5);
    expect(relay.channels()).toEqual([]);
    expect(hub.streamCount()).toBe(0);
    await res.body?.cancel();
  });

  test('close() ends every open stream, so a shutdown is not held open', async () => {
    const { hub, relay, app } = setup();
    const first = reader(await app.request('/stream/adm-1'));
    const second = reader(await app.request('/stream/adm-2'));
    expect(hub.streamCount()).toBe(2);
    hub.close();
    await Bun.sleep(5);
    expect(hub.streamCount()).toBe(0);
    expect(relay.channels()).toEqual([]);
    expect(await first.read(1, 50)).toEqual([]);
    expect(await second.read(1, 50)).toEqual([]);
  });

  test('a subscribe failure is a 503 problem, so the console falls back to polling', async () => {
    const memory = createMemoryRelay(logger);
    let joins = 0;
    const relay: Relay = {
      ...memory,
      join: (channel, listener) => {
        joins += 1;
        return joins === 2
          ? Promise.reject(new Error('redis down'))
          : memory.join(channel, listener);
      },
    };
    const { app, hub } = setup({ relay });
    const res = await app.request('/stream/adm-1');
    expect(res.status).toBe(503);
    expect(((await res.json()) as { reason: string }).reason).toBe('dependency_unavailable');
    expect(memory.channels()).toEqual([]);
    expect(hub.streamCount()).toBe(0);
  });

  test('publishing an event that breaks the envelope throws', async () => {
    const { hub } = setup();
    await expect(
      hub.publishToAll({ type: 'Bad Type', data: {}, permission: 'reports.read' }),
    ).rejects.toThrow();
  });
});

describe('all-admin events need a permission', () => {
  test('publishToAll refuses an event without a permission instead of bypassing the filter', async () => {
    const { hub, relay } = setup();
    const published: string[] = [];
    await relay.join(ADMIN_ALL_CHANNEL, (text) => void published.push(text));
    for (const permission of [null, '']) {
      await expect(
        hub.publishToAll({
          type: 'queue.counts',
          data: {},
          permission: permission as unknown as string,
        }),
      ).rejects.toThrow();
    }
    expect(published).toEqual([]);
  });

  test('a message on ch:admin:all without a permission is dropped by the stream', async () => {
    const { relay, app } = setup();
    const stream = reader(await app.request('/stream/adm-1'));
    await relay.publish(
      ADMIN_ALL_CHANNEL,
      JSON.stringify({
        type: 'queue.counts',
        data: {},
        permission: null,
        at: '2026-11-26T10:00:00.000Z',
      }),
    );
    expect(await stream.read(1, 50)).toEqual([]);
    await stream.cancel();
  });
});

describe('memory relay', () => {
  test('one failing listener does not stop delivery to the others', async () => {
    const relay = createMemoryRelay(logger);
    const got: string[] = [];
    await relay.join('ch:test', () => {
      throw new Error('broken listener');
    });
    await relay.join('ch:test', (text) => got.push(text));
    await relay.publish('ch:test', 'hello');
    await Bun.sleep(1);
    expect(got).toEqual(['hello']);
    await relay.close();
    expect(relay.channels()).toEqual([]);
  });
});

describe('withTimeout', () => {
  test('passes a prompt result through and rejects a late one', async () => {
    expect(await withTimeout(Promise.resolve(7), 50, 'fast')).toBe(7);
    await expect(withTimeout(Bun.sleep(50), 5, 'slow call')).rejects.toThrow(
      'slow call timed out after 5 ms',
    );
  });
});
