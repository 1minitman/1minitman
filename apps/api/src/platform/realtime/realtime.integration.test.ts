import { RedisClient } from 'bun';
import { afterAll, describe, expect, test } from 'bun:test';
import { WS_CLOSE_CODES } from '@1minitman/contracts';
import { createApp } from '../../app';
import { createCheckReadiness } from '../../modules/system';
import { createRedisSessionDenyList, denyAllAuth, sessionDenyKey } from '../auth';
import type { AccessTokenVerifier } from '../auth/member';
import { createMemoryIdempotencyStore } from '../idempotency';
import { createLogger } from '../logger';
import { createMemoryRateLimiter, createPolicyStore, staticPolicySource } from '../rate-limit';
import { connectionKey, userChannel } from './channels';
import { createRedisConnectionRegistry } from './connection-registry';
import { echoEvent } from './echo';
import { createWebSocketGateway } from './gateway';
import { createRedisRelay } from './relay';
import { createAdminStreamHub } from './sse-hub';
import { createMemoryWebhookStore, createWebhookIntake, pendingRowWebhookQueue } from '../webhooks';

// Integration: two API instances in this process, each with its own Redis connections, against
// the local Redis (`pnpm services:up`). Keys use random member ids and are deleted afterwards.
const redisUrl = process.env.REDIS_URL;
const ci = !['', 'false', '0'].includes(process.env.CI?.trim().toLowerCase() ?? '');
// In CI a missing service must fail the run, never skip it (GAP-STD01-09).
if (ci && !redisUrl) throw new Error('Realtime tests need REDIS_URL in CI');

const logger = createLogger('error');
const admin = redisUrl ? new RedisClient(redisUrl) : null;
const cleanup: string[] = [];
const instances: { stop: () => Promise<void> }[] = [];

/** Tokens are `tok:<member>:<session>[:<expires epoch ms>]`. */
const tokens: AccessTokenVerifier = {
  verify: (token) => {
    const [kind, memberId, sessionId, expires] = token.split(':');
    if (kind !== 'tok' || !memberId || !sessionId) return Promise.resolve(null);
    const expiresAt = new Date(expires ? Number(expires) : Date.now() + 15 * 60_000);
    return Promise.resolve({ memberId, sessionId, expiresAt });
  },
};

const startInstance = async () => {
  const publisher = new RedisClient(redisUrl!);
  const subscriber = new RedisClient(redisUrl!);
  const relay = createRedisRelay({ subscriber, publisher, logger });
  const gateway = createWebSocketGateway({
    tokens,
    denyList: createRedisSessionDenyList(publisher),
    relay,
    registry: createRedisConnectionRegistry(publisher),
    logger,
  });
  gateway.register(echoEvent);
  const adminStream = createAdminStreamHub({
    relay,
    filter: { canReceive: () => Promise.resolve(true) },
    logger,
  });
  const app = createApp({
    env: { APP_ENV: 'local', APP_VERSION: 'test', CORS_ALLOWED_ORIGINS: [] },
    logger,
    checkReadiness: createCheckReadiness({
      database: { name: 'database', ping: () => Promise.resolve() },
      redis: { name: 'redis', ping: () => Promise.resolve() },
    }),
    surfaces: {
      rateLimits: {
        policies: createPolicyStore(staticPolicySource([])),
        limiter: createMemoryRateLimiter(),
      },
      auth: denyAllAuth(),
      idempotency: createMemoryIdempotencyStore(),
      realtime: { gateway, adminStream },
      webhooks: createWebhookIntake({
        store: createMemoryWebhookStore(),
        queue: pendingRowWebhookQueue,
        logger,
      }),
    },
  });
  // Stands in for MOD-01's GET /admin/v1/stream.
  app.get('/test/stream/:admin', (c) =>
    adminStream.stream(c, { adminId: c.req.param('admin'), sessionId: 'as-test' }),
  );
  const server = Bun.serve({
    port: 0,
    fetch: (request, bunServer) => app.fetch(request, bunServer),
    websocket: gateway.websocket,
  });
  const instance = {
    gateway,
    adminStream,
    relay,
    http: `http://localhost:${server.port}`,
    ws: `ws://localhost:${server.port}/v1/ws`,
    async stop() {
      await gateway.close();
      await server.stop(true);
      subscriber.close();
      publisher.close();
    },
  };
  instances.push(instance);
  return instance;
};

afterAll(async () => {
  await Promise.all(instances.map((instance) => instance.stop()));
  if (admin && cleanup.length > 0) await admin.send('DEL', cleanup);
  admin?.close();
});

interface Frame {
  type: string;
  id?: string;
  data: Record<string, unknown>;
}

/** A member app's socket: connects, authenticates and records every frame and the close. */
const connect = async (url: string, token: string) => {
  const socket = new WebSocket(url);
  const frames: Frame[] = [];
  const closed = new Promise<{ code: number; reason: string }>((resolve) =>
    socket.addEventListener('close', (event) =>
      resolve({ code: event.code, reason: event.reason }),
    ),
  );
  socket.addEventListener('message', (event) =>
    frames.push(JSON.parse(String(event.data)) as Frame),
  );
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener('open', () => resolve());
    socket.addEventListener('error', () => reject(new Error('websocket error')));
  });
  const client = {
    frames,
    closed,
    send: (frame: Record<string, unknown>) => socket.send(JSON.stringify(frame)),
    close: () => socket.close(1000),
    async waitFor(match: (frame: Frame) => boolean, ms = 1000) {
      const deadline = Date.now() + ms;
      while (Date.now() < deadline) {
        const found = frames.find(match);
        if (found) return found;
        await Bun.sleep(5);
      }
      throw new Error('frame did not arrive');
    },
  };
  client.send({ type: 'auth', id: 'a', data: { token } });
  await client.waitFor((frame) => frame.type === 'ready');
  return client;
};

const member = () => {
  const id = crypto.randomUUID();
  cleanup.push(connectionKey(id));
  return id;
};

/** Waits until Redis reports `count` subscribers on the channel. */
const subscribers = async (channel: string, count: number) => {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const reply = (await admin!.send('PUBSUB', ['NUMSUB', channel])) as [string, number];
    if (Number(reply[1]) >= count) return;
    await Bun.sleep(20);
  }
  throw new Error(`fewer than ${count} subscribers on ${channel}`);
};

describe.skipIf(!redisUrl)('realtime across two API instances', () => {
  test('an echo sent on one instance reaches the member socket on the other', async () => {
    const [a, b] = [await startInstance(), await startInstance()];
    const id = member();
    const onA = await connect(a.ws, `tok:${id}:s1`);
    const onB = await connect(b.ws, `tok:${id}:s2`);
    onA.send({ type: 'echo', id: 'e1', data: { text: 'across' } });
    const echo = { type: 'echo', data: { text: 'across' } };
    expect(await onB.waitFor((f) => f.type === 'echo')).toEqual(echo);
    expect(await onA.waitFor((f) => f.type === 'echo')).toEqual(echo);
    await Bun.sleep(50);
    // Published once through Redis: each socket sees one copy.
    expect(onB.frames.filter((f) => f.type === 'echo')).toHaveLength(1);
    expect(onA.frames.filter((f) => f.type === 'echo')).toHaveLength(1);
    onA.close();
    onB.close();
  });

  test('the heartbeat keeps ws:conn alive; a close removes the connection', async () => {
    const [a, b] = [await startInstance(), await startInstance()];
    const id = member();
    const onA = await connect(a.ws, `tok:${id}:s1`);
    const onB = await connect(b.ws, `tok:${id}:s2`);
    const key = connectionKey(id);
    const ids = [onA, onB].map((c) => c.frames[0]!.data.connection_id as string).sort();
    expect(((await admin!.send('SMEMBERS', [key])) as string[]).sort()).toEqual(ids);
    const ttl = Number(await admin!.send('TTL', [key]));
    expect(ttl).toBeGreaterThan(100);
    expect(ttl).toBeLessThanOrEqual(120);

    await admin!.send('EXPIRE', [key, '5']);
    onB.send({ type: 'presence.heartbeat' });
    const deadline = Date.now() + 1000;
    while (Number(await admin!.send('TTL', [key])) <= 5 && Date.now() < deadline)
      await Bun.sleep(5);
    expect(Number(await admin!.send('TTL', [key]))).toBeGreaterThan(100);

    onA.close();
    await onA.closed;
    await Bun.sleep(50);
    const remaining = ids.filter((i) => i !== onA.frames[0]!.data.connection_id);
    expect((await admin!.send('SMEMBERS', [key])) as string[]).toEqual(remaining);
    onB.close();
  });

  test('a session revoked mid-connection closes on the next heartbeat', async () => {
    const a = await startInstance();
    const id = member();
    const session = `s-${crypto.randomUUID()}`;
    cleanup.push(sessionDenyKey(session));
    const client = await connect(a.ws, `tok:${id}:${session}`);
    await admin!.send('SET', [sessionDenyKey(session), '1', 'EX', '60']);
    client.send({ type: 'presence.heartbeat' });
    expect((await client.closed).code).toBe(WS_CLOSE_CODES.session_revoked);
  });

  test('an access token that expires mid-connection closes with token_expired', async () => {
    const a = await startInstance();
    const client = await connect(a.ws, `tok:${member()}:s1:${Date.now() + 150}`);
    expect(await client.closed).toEqual({
      code: WS_CLOSE_CODES.token_expired,
      reason: 'token_expired',
    });
  });

  test('a token already expired on connect never reaches ready', async () => {
    const a = await startInstance();
    const socket = new WebSocket(a.ws);
    const closed = new Promise<number>((resolve) =>
      socket.addEventListener('close', (event) => resolve(event.code)),
    );
    await new Promise((resolve) => socket.addEventListener('open', resolve));
    socket.send(JSON.stringify({ type: 'auth', data: { token: `tok:${member()}:s1:1` } }));
    expect(await closed).toBe(WS_CLOSE_CODES.token_expired);
  });

  test('the relay subscribes again after the Redis pub/sub connection drops', async () => {
    const [a, b] = [await startInstance(), await startInstance()];
    const id = member();
    const onA = await connect(a.ws, `tok:${id}:s1`);
    const onB = await connect(b.ws, `tok:${id}:s2`);
    await admin!.send('CLIENT', ['KILL', 'TYPE', 'pubsub']);
    await subscribers(userChannel(id), 2);
    onA.send({ type: 'echo', data: { text: 'after reconnect' } });
    await onB.waitFor((f) => f.type === 'echo', 2000);
    await Bun.sleep(50);
    expect(onB.frames.filter((f) => f.type === 'echo')).toHaveLength(1);
    onA.close();
    onB.close();
  });

  test('an admin event published on one instance reaches a stream on the other', async () => {
    const [a, b] = [await startInstance(), await startInstance()];
    const adminId = crypto.randomUUID();
    const res = await fetch(`${b.http}/test/stream/${adminId}`);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const reader = res.body!.getReader();
    await a.adminStream.publishToAdmin(adminId, {
      type: 'session.revoked',
      data: { session_id: 'as-test' },
      permission: null,
    });
    let text = '';
    const deadline = Date.now() + 1000;
    while (!text.includes('event: session.revoked') && Date.now() < deadline) {
      const chunk = await reader.read();
      if (chunk.done) break;
      text += new TextDecoder().decode(chunk.value);
    }
    expect(text).toContain('event: session.revoked');
    expect(text).toContain('"session_id":"as-test"');
    await reader.cancel();
  });

  test('GET /v1/ws without an upgrade is a 400 problem', async () => {
    const a = await startInstance();
    const res = await fetch(`${a.http}/v1/ws`);
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toContain('application/problem+json');
  });

  test('a shutdown drains sockets with 1001 going away', async () => {
    const a = await startInstance();
    const client = await connect(a.ws, `tok:${member()}:s1`);
    await a.gateway.close();
    expect((await client.closed).code).toBe(1001);
  });
});
