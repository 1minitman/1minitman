import { WS_CLOSE_CODES } from '@1minitman/contracts';
import type { ServerWebSocket } from 'bun';
import { describe, expect, test } from 'bun:test';
import { z } from 'zod';
import type { AccessTokenVerifier, SessionDenyList } from '../auth/member';
import type { MemberPrincipal } from '../auth/principals';
import { ProblemError } from '../errors';
import { requestContext } from '../http/middleware';
import { errorHandler } from '../http/problem';
import { createRouter } from '../http/router';
import { createLogger } from '../logger';
import { createMemoryRateLimiter, createPolicyStore, staticPolicySource } from '../rate-limit';
import { conversationChannel, userChannel } from './channels';
import { createMemoryConnectionRegistry, type ConnectionRegistry } from './connection-registry';
import { echoEvent } from './echo';
import {
  createWebSocketGateway,
  newSocketState,
  type SocketState,
  type WebSocketGatewayDeps,
} from './gateway';
import { createMemoryRelay, type Relay } from './relay';

const logger = createLogger('error');
const MEMBER_A = '01900000-0000-7000-8000-00000000000a';
const MEMBER_B = '01900000-0000-7000-8000-00000000000b';
const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000);

/** Tokens are `tok:<member>:<session>`; `expires` overrides the 15-minute expiry. */
const tokens = (expires?: () => Date | undefined): AccessTokenVerifier => ({
  verify: (token) => {
    const [kind, memberId, sessionId] = token.split(':');
    if (kind !== 'tok' || !memberId || !sessionId) return Promise.resolve(null);
    const expiresAt = expires ? expires() : inMinutes(15);
    return Promise.resolve({ memberId, sessionId, ...(expiresAt ? { expiresAt } : {}) });
  },
});
const revoked = new Set<string>();
const denyList: SessionDenyList = { isDenied: (id) => Promise.resolve(revoked.has(id)) };

const setup = (overrides: Partial<WebSocketGatewayDeps> = {}) => {
  const relay = overrides.relay ?? createMemoryRelay(logger);
  const memory = createMemoryConnectionRegistry();
  const gateway = createWebSocketGateway({
    tokens: tokens(),
    denyList,
    relay,
    registry: memory.registry,
    logger,
    ...overrides,
  });

  const connect = () => {
    const sent: { type: string; id?: string; data: Record<string, unknown> }[] = [];
    let closed: { code: number; reason: string } | undefined;
    let buffered = 0;
    let sendStatus: number | undefined;
    const ws = {
      data: newSocketState(),
      readyState: 1,
      send(text: string) {
        sent.push(JSON.parse(text) as (typeof sent)[number]);
        return sendStatus ?? text.length;
      },
      close(code: number, reason: string) {
        if (closed) return;
        closed = { code, reason };
        ws.readyState = 3;
        void gateway.websocket.close?.(asBun(ws), code, reason);
      },
      getBufferedAmount: () => buffered,
    };
    gateway.websocket.open?.(asBun(ws));
    const client = {
      ws,
      sent,
      closed: () => closed,
      raw(text: string | Buffer) {
        void gateway.websocket.message?.(asBun(ws), text as string);
      },
      frame(frame: Record<string, unknown>) {
        client.raw(JSON.stringify(frame));
      },
      async settle() {
        await ws.data.queue;
        await Bun.sleep(1);
        await ws.data.queue;
      },
      async auth(member = MEMBER_A, session = `sess-${member}`) {
        client.frame({ type: 'auth', id: 'a1', data: { token: `tok:${member}:${session}` } });
        await client.settle();
      },
      setBuffered(bytes: number) {
        buffered = bytes;
      },
      setSendStatus(status: number) {
        sendStatus = status;
      },
    };
    return client;
  };
  return { gateway, relay, memory, connect };
};
const asBun = (ws: unknown) => ws as ServerWebSocket<SocketState>;

describe('handshake: the token comes in the first frame (TRX-034)', () => {
  test('a valid token is answered with ready and the connection joins the registry', async () => {
    const { connect, memory, relay } = setup();
    const client = connect();
    await client.auth();
    expect(client.closed()).toBeUndefined();
    expect(client.sent).toEqual([
      {
        type: 'ready',
        id: 'a1',
        data: { connection_id: client.ws.data.connectionId, heartbeat_seconds: 30 },
      },
    ]);
    expect(memory.connections(MEMBER_A)).toEqual([client.ws.data.connectionId]);
    expect(relay.channels()).toEqual([userChannel(MEMBER_A)]);
  });

  test('no auth frame within the timeout closes with auth_timeout', async () => {
    const { connect } = setup({ authTimeoutMs: 10 });
    const client = connect();
    await Bun.sleep(30);
    expect(client.closed()).toEqual({ code: WS_CLOSE_CODES.auth_timeout, reason: 'auth_timeout' });
  });

  test('a first frame that is not auth, or a bad token, closes with unauthenticated', async () => {
    const { connect } = setup();
    for (const frame of [
      { type: 'echo', data: { text: 'hi' } },
      { type: 'auth', data: {} },
      { type: 'auth', data: { token: 'garbage' } },
    ]) {
      const client = connect();
      client.frame(frame);
      await client.settle();
      expect(client.closed()?.code).toBe(WS_CLOSE_CODES.unauthenticated);
    }
  });

  test('an expired token closes with token_expired', async () => {
    const client = setup({ tokens: tokens(() => new Date(Date.now() - 1000)) }).connect();
    await client.auth();
    expect(client.closed()?.code).toBe(WS_CLOSE_CODES.token_expired);
  });

  test('a principal without an expiry is refused: the socket could not be closed on time', async () => {
    const client = setup({ tokens: tokens(() => undefined) }).connect();
    await client.auth();
    expect(client.closed()?.code).toBe(WS_CLOSE_CODES.unauthenticated);
  });

  test('a revoked session closes with session_revoked', async () => {
    revoked.add('sess-revoked');
    const client = setup().connect();
    await client.auth(MEMBER_A, 'sess-revoked');
    expect(client.closed()?.code).toBe(WS_CLOSE_CODES.session_revoked);
    revoked.delete('sess-revoked');
  });

  test('a verifier or denylist failure closes with dependency_unavailable', async () => {
    const failing = { verify: () => Promise.reject(new Error('keys unavailable')) };
    const one = setup({ tokens: failing }).connect();
    await one.auth();
    expect(one.closed()?.code).toBe(WS_CLOSE_CODES.dependency_unavailable);

    const down = { isDenied: () => Promise.reject(new Error('redis down')) };
    const two = setup({ denyList: down }).connect();
    await two.auth();
    expect(two.closed()?.code).toBe(WS_CLOSE_CODES.dependency_unavailable);
  });

  test('a registry or relay failure closes with dependency_unavailable', async () => {
    const registry: ConnectionRegistry = {
      add: () => Promise.reject(new Error('redis down')),
      refresh: () => Promise.resolve(),
      remove: () => Promise.resolve(),
    };
    const client = setup({ registry }).connect();
    await client.auth();
    expect(client.closed()?.code).toBe(WS_CLOSE_CODES.dependency_unavailable);

    const relay: Relay = {
      ...createMemoryRelay(logger),
      join: () => Promise.reject(new Error('redis down')),
    };
    const other = setup({ relay }).connect();
    await other.auth();
    expect(other.closed()?.code).toBe(WS_CLOSE_CODES.dependency_unavailable);
  });

  test('a socket closed while authenticating leaves nothing behind', async () => {
    let release: () => void = () => {};
    const slow: AccessTokenVerifier = {
      verify: async (token) => {
        await new Promise<void>((resolve) => (release = resolve));
        return tokens().verify(token);
      },
    };
    const { connect, memory, relay } = setup({ tokens: slow });
    const client = connect();
    client.frame({ type: 'auth', data: { token: `tok:${MEMBER_A}:s1` } });
    await Bun.sleep(1);
    client.ws.close(1000, 'bye');
    release();
    await client.settle();
    expect(memory.connections(MEMBER_A)).toEqual([]);
    expect(relay.channels()).toEqual([]);
    expect(client.sent).toEqual([]);
  });

  test('binary or non-JSON frames close with invalid_frame', async () => {
    const { connect } = setup();
    const binary = connect();
    binary.raw(Buffer.from('{}'));
    await binary.settle();
    expect(binary.closed()?.code).toBe(WS_CLOSE_CODES.invalid_frame);

    const text = connect();
    await text.auth();
    text.raw('{not json');
    await text.settle();
    expect(text.closed()?.code).toBe(WS_CLOSE_CODES.invalid_frame);
  });
});

describe('after ready', () => {
  test('the socket closes with token_expired when the token expires', async () => {
    const client = setup({ tokens: tokens(() => new Date(Date.now() + 40)) }).connect();
    await client.auth();
    expect(client.closed()).toBeUndefined();
    await Bun.sleep(80);
    expect(client.closed()).toEqual({
      code: WS_CLOSE_CODES.token_expired,
      reason: 'token_expired',
    });
  });

  test('a heartbeat refreshes the registry, checks the denylist and calls onHeartbeat', async () => {
    const beats: MemberPrincipal[] = [];
    let refreshed = 0;
    const memory = createMemoryConnectionRegistry();
    const registry: ConnectionRegistry = {
      ...memory.registry,
      refresh: (...args) => {
        refreshed += 1;
        return memory.registry.refresh(...args);
      },
    };
    const client = setup({
      registry,
      onHeartbeat: (principal) => {
        beats.push(principal);
        return Promise.resolve();
      },
    }).connect();
    await client.auth(MEMBER_A, 'sess-beat');
    client.frame({ type: 'presence.heartbeat' });
    client.frame({ type: 'presence.heartbeat', data: {} });
    await client.settle();
    expect(refreshed).toBe(2);
    expect(beats.map((b) => b.sessionId)).toEqual(['sess-beat', 'sess-beat']);
    expect(client.sent).toHaveLength(1); // ready only: a heartbeat has no reply

    revoked.add('sess-beat');
    client.frame({ type: 'presence.heartbeat' });
    await client.settle();
    expect(client.closed()?.code).toBe(WS_CLOSE_CODES.session_revoked);
    expect(memory.connections(MEMBER_A)).toEqual([]);
    revoked.delete('sess-beat');
  });

  test('a heartbeat with a payload is refused; a registry failure on heartbeat closes', async () => {
    const memory = createMemoryConnectionRegistry();
    const registry: ConnectionRegistry = {
      ...memory.registry,
      refresh: () => Promise.reject(new Error('redis down')),
    };
    const client = setup({ registry }).connect();
    await client.auth();
    client.frame({ type: 'presence.heartbeat', id: 'h1', data: { state: 'away' } });
    await client.settle();
    expect(client.sent.at(-1)).toEqual({ type: 'error', id: 'h1', data: { code: 'validation' } });
    client.frame({ type: 'presence.heartbeat' });
    await client.settle();
    expect(client.closed()?.code).toBe(WS_CLOSE_CODES.dependency_unavailable);
  });

  test('an unknown event or a malformed envelope is answered with bad_request', async () => {
    const client = setup().connect();
    await client.auth();
    client.frame({ type: 'nothing.here', id: 'x1' });
    client.frame({ type: 'Bad Name' });
    await client.settle();
    expect(client.sent.slice(1)).toEqual([
      { type: 'error', id: 'x1', data: { code: 'bad_request' } },
      { type: 'error', data: { code: 'bad_request' } },
    ]);
    expect(client.closed()).toBeUndefined();
  });

  test('data is validated with the event schema; failures name the fields', async () => {
    const { gateway, connect } = setup();
    gateway.register(echoEvent);
    const client = connect();
    await client.auth();
    client.frame({ type: 'echo', id: 'e1', data: { text: 'x'.repeat(300) } });
    await client.settle();
    expect(client.sent.at(-1)).toEqual({
      type: 'error',
      id: 'e1',
      data: {
        code: 'validation',
        errors: [expect.objectContaining({ path: 'text', code: 'too_long' })],
      },
    });
  });

  test('echo reaches every socket of the sender and no one else', async () => {
    const { gateway, connect } = setup();
    gateway.register(echoEvent);
    const [first, second, other] = [connect(), connect(), connect()];
    await first.auth();
    await second.auth();
    await other.auth(MEMBER_B);
    first.frame({ type: 'echo', id: 'e1', data: { text: 'hello' } });
    await first.settle();
    await Bun.sleep(1);
    const echo = { type: 'echo', data: { text: 'hello' } };
    expect(first.sent.at(-1)).toEqual(echo);
    expect(second.sent.at(-1)).toEqual(echo);
    expect(other.sent.map((f) => f.type)).toEqual(['ready']);
  });

  test('handlers can reply, join and leave a conversation channel and publish to it', async () => {
    const conversation = '01900000-0000-7000-8000-0000000000c1';
    const { gateway, connect } = setup();
    gateway.register({
      type: 'test.join',
      schema: z.strictObject({ leave: z.boolean().optional() }),
      async handle(context, data) {
        if (data.leave) await context.leave(conversationChannel(conversation));
        else await context.join(conversationChannel(conversation));
        context.reply('test.joined', { left: Boolean(data.leave) });
      },
    });
    const [a, b] = [connect(), connect()];
    await a.auth();
    await b.auth(MEMBER_B);
    a.frame({ type: 'test.join', id: 'j1', data: {} });
    b.frame({ type: 'test.join', id: 'j2', data: {} });
    await a.settle();
    await b.settle();
    expect(a.sent.at(-1)).toEqual({ type: 'test.joined', id: 'j1', data: { left: false } });

    await gateway.publish(conversationChannel(conversation), {
      type: 'message.new',
      data: { n: 1 },
    });
    await Bun.sleep(1);
    expect(a.sent.at(-1)?.type).toBe('message.new');
    expect(b.sent.at(-1)?.type).toBe('message.new');

    b.frame({ type: 'test.join', data: { leave: true } });
    await b.settle();
    await gateway.publish(conversationChannel(conversation), {
      type: 'message.new',
      data: { n: 2 },
    });
    await Bun.sleep(1);
    expect(a.sent.at(-1)?.data).toEqual({ n: 2 });
    expect(b.sent.at(-1)?.data).toEqual({ left: true });
  });

  test('a ProblemError becomes its code; any other failure is internal', async () => {
    const { gateway, connect } = setup();
    gateway.register({
      type: 'test.fail',
      schema: z.strictObject({ problem: z.boolean() }),
      handle: (_context, data) => {
        if (data.problem) throw new ProblemError('rate_limited', { retry_after_seconds: 9 });
        throw new Error('boom');
      },
    });
    gateway.register({
      type: 'test.invalid',
      schema: z.unknown(),
      handle: () => {
        throw new ProblemError('validation', {
          errors: [{ path: 'x', code: 'required', message: 'Required' }],
        });
      },
    });
    const client = connect();
    await client.auth();
    client.frame({ type: 'test.fail', id: 'p', data: { problem: true } });
    client.frame({ type: 'test.fail', id: 'q', data: { problem: false } });
    client.frame({ type: 'test.invalid', id: 'r' });
    await client.settle();
    expect(client.sent.slice(1)).toEqual([
      { type: 'error', id: 'p', data: { code: 'rate_limited', retry_after_seconds: 9 } },
      { type: 'error', id: 'q', data: { code: 'internal' } },
      {
        type: 'error',
        id: 'r',
        data: {
          code: 'validation',
          errors: [{ path: 'x', code: 'required', message: 'Required' }],
        },
      },
    ]);
  });

  test('an event with a policy is limited by rate_limit_policies, per member', async () => {
    const policies = createPolicyStore(
      staticPolicySource([
        {
          key: 'test.ws',
          scope: 'account',
          maxRequests: 1,
          windowSeconds: 60,
          lockoutSeconds: null,
          algorithm: 'fixed_window',
          isActive: true,
        },
      ]),
    );
    await policies.reload();
    const { gateway, connect } = setup({
      rateLimits: { policies, limiter: createMemoryRateLimiter() },
    });
    gateway.register({ ...echoEvent, type: 'test.limited', rateLimitPolicy: 'test.ws' });
    const [a, b] = [connect(), connect()];
    await a.auth();
    await b.auth(MEMBER_B);
    a.frame({ type: 'test.limited', id: '1', data: { text: 'a' } });
    a.frame({ type: 'test.limited', id: '2', data: { text: 'b' } });
    b.frame({ type: 'test.limited', id: '3', data: { text: 'c' } });
    await a.settle();
    await b.settle();
    const errors = [...a.sent, ...b.sent].filter((f) => f.type === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ id: '2', data: { code: 'rate_limited' } });
    expect(errors[0]!.data.retry_after_seconds).toBeGreaterThan(0);
  });

  test('a policy that fails closed while the limiter is down refuses the frame', async () => {
    const policies = createPolicyStore(
      staticPolicySource([
        {
          key: 'test.locking',
          scope: 'account',
          maxRequests: 5,
          windowSeconds: 60,
          lockoutSeconds: 60,
          algorithm: 'fixed_window',
          isActive: true,
        },
      ]),
    );
    await policies.reload();
    const limiter = {
      consume: () => Promise.reject(new Error('redis down')),
      lockRemaining: () => Promise.reject(new Error('redis down')),
    };
    const { gateway, connect } = setup({ rateLimits: { policies, limiter } });
    gateway.register({ ...echoEvent, type: 'test.locking', rateLimitPolicy: 'test.locking' });
    const client = connect();
    await client.auth();
    client.frame({ type: 'test.locking', id: 'l', data: { text: 'x' } });
    await client.settle();
    expect(client.sent.at(-1)).toEqual({
      type: 'error',
      id: 'l',
      data: { code: 'dependency_unavailable' },
    });
  });

  test('a policy without a rate limiter is a wiring error, and closes the socket', async () => {
    const { gateway, connect } = setup();
    gateway.register({ ...echoEvent, type: 'test.unwired', rateLimitPolicy: 'test.ws' });
    const client = connect();
    await client.auth();
    client.frame({ type: 'test.unwired', data: { text: 'x' } });
    await client.settle();
    expect(client.closed()?.code).toBe(WS_CLOSE_CODES.dependency_unavailable);
  });
});

describe('back-pressure and limits', () => {
  test('a slow consumer is closed instead of buffered without bound', async () => {
    const { gateway, connect } = setup({ slowConsumerBytes: 1000 });
    const client = connect();
    await client.auth();
    client.setBuffered(5000);
    await gateway.publishToUser(MEMBER_A, { type: 'message.new', data: {} });
    await Bun.sleep(1);
    expect(client.closed()?.code).toBe(WS_CLOSE_CODES.slow_consumer);
  });

  test('a dropped send (Bun returns 0) also closes as a slow consumer', async () => {
    const { gateway, connect } = setup();
    const client = connect();
    await client.auth();
    client.setSendStatus(0);
    await gateway.publishToUser(MEMBER_A, { type: 'message.new', data: {} });
    await Bun.sleep(1);
    expect(client.closed()?.code).toBe(WS_CLOSE_CODES.slow_consumer);
  });

  test('more frames waiting than allowed closes with invalid_frame', async () => {
    const client = setup({ maxPendingFrames: 2 }).connect();
    for (let i = 0; i < 3; i += 1) client.frame({ type: 'presence.heartbeat' });
    expect(client.closed()?.code).toBe(WS_CLOSE_CODES.invalid_frame);
  });

  test('frames and payload size are bounded; the idle timeout is the 120 s TTL', () => {
    const { gateway } = setup();
    expect(gateway.websocket.maxPayloadLength).toBe(64 * 1024);
    expect(gateway.websocket.idleTimeout).toBe(120);
    expect(gateway.websocket.sendPings).toBe(false);
  });

  test('publishing a frame that is not a server frame throws', async () => {
    const { gateway } = setup();
    await expect(gateway.publishToUser(MEMBER_A, { type: 'Bad', data: {} })).rejects.toThrow();
  });
});

describe('registry of events', () => {
  test('reserved, malformed and duplicate names are refused', () => {
    const { gateway } = setup();
    for (const type of ['auth', 'ready', 'error', 'presence.heartbeat', 'Not.Valid']) {
      expect(() => gateway.register({ ...echoEvent, type })).toThrow(/not allowed/);
    }
    gateway.register(echoEvent);
    expect(() => gateway.register(echoEvent)).toThrow(/twice/);
  });
});

describe('upgrade route and drain', () => {
  const appWith = (server: unknown) => {
    const { gateway } = setup();
    const app = createRouter();
    app.use('*', requestContext(logger));
    app.onError(errorHandler);
    app.get('/v1/ws', (c) => gateway.upgrade(c));
    return {
      app,
      request: (headers: Record<string, string>) => app.request('/v1/ws', { headers }, server),
    };
  };

  test('a request without Upgrade: websocket is a 400 problem', async () => {
    const res = await appWith(undefined).request({});
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toContain('application/problem+json');
  });

  test('the upgrade hands Bun a fresh socket state; a refused upgrade is a 400', async () => {
    const seen: SocketState[] = [];
    const ok = appWith({
      upgrade: (_req: Request, options: { data: SocketState }) => (seen.push(options.data), true),
    });
    expect((await ok.request({ upgrade: 'websocket' })).status).toBe(200);
    expect(seen[0]?.phase).toBe('awaiting_auth');

    const refused = appWith({ upgrade: () => false });
    expect((await refused.request({ upgrade: 'websocket' })).status).toBe(400);
  });

  test('without the Bun server the route fails loudly', async () => {
    const res = await appWith({}).request({ upgrade: 'websocket' });
    expect(res.status).toBe(500);
  });

  test('close() drains every socket with 1001', async () => {
    const { gateway, connect, relay } = setup();
    const [a, b] = [connect(), connect()];
    await a.auth();
    expect(gateway.connectionCount()).toBe(2);
    await gateway.close();
    expect(a.closed()?.code).toBe(1001);
    expect(b.closed()?.code).toBe(1001);
    expect(gateway.connectionCount()).toBe(0);
    expect(relay.channels()).toEqual([]);
  });
});
