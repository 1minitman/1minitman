import {
  AuthFrameSchema,
  ClientFrameSchema,
  EVENT_TYPE_PATTERN,
  fieldErrorsFromIssues,
  PRESENCE_HEARTBEAT,
  PresenceHeartbeatDataSchema,
  ServerFrameSchema,
  WS_AUTH_FRAME,
  WS_CLOSE_CODES,
  WS_CONNECTION_TTL_SECONDS,
  WS_ERROR_FRAME,
  WS_HEARTBEAT_SECONDS,
  WS_READY_FRAME,
  type ClientFrame,
  type ProblemCode,
  type ServerFrame,
  type WsCloseReason,
} from '@1minitman/contracts';
import type { WebSocketHandler } from 'bun';
import type { Context } from 'hono';
import type { z } from 'zod';
import type { AccessTokenVerifier, SessionDenyList } from '../auth/member';
import type { MemberPrincipal } from '../auth/principals';
import { ProblemError } from '../errors';
import type { AppEnv } from '../http/context';
import { problemResponse } from '../http/problem';
import type { Logger } from '../logger';
import { checkRateLimit, type RateLimits } from '../rate-limit';
import { userChannel } from './channels';
import type { ConnectionRegistry } from './connection-registry';
import type { Relay, RelayListener } from './relay';

/*
 * The member WebSocket gateway at `/v1/ws` (MOD-00 plan section 4.2, 1MM-ADR-0019, TRX-034).
 *
 * Handshake: the upgrade carries no credential. The first frame is `auth` with the member access
 * token; until it is accepted no other frame is read. The token is checked like REST
 * (`AccessTokenVerifier`, then the session denylist), the connection joins `ws:conn:{user_id}`
 * and `ch:user:{user_id}`, and the server answers `ready`. The socket closes with
 * `token_expired` the moment the token expires, so the client refreshes and reconnects.
 *
 * After `ready` the client sends `presence.heartbeat` every 30 s; each one refreshes the
 * connection registry's 120 s TTL and checks the denylist again, so a revoked session loses its
 * socket within one heartbeat. A socket that sends nothing for 120 s is closed by the server, and
 * so is one that sends other frames but no heartbeat for 120 s (`auth_timeout`): any frame resets
 * Bun's idle timeout, but only a heartbeat re-checks the session.
 *
 * Feature modules add events with `register()`: each has a zod schema (the same one REST uses),
 * an optional rate-limit policy from `rate_limit_policies`, and a handler. A frame that fails is
 * answered with an `error` frame carrying a problem code; the socket stays open.
 */

/** **Recommendation** (GAP-MOD00-24): time allowed for the `auth` frame after the upgrade. */
export const WS_AUTH_TIMEOUT_MS = 10_000;
/** **Recommendation** (GAP-MOD00-24): largest frame read; Bun closes a bigger one with 1009. */
export const WS_MAX_FRAME_BYTES = 64 * 1024;
/** **Recommendation** (GAP-MOD00-24): bytes queued for one socket before it is a slow consumer. */
export const WS_SLOW_CONSUMER_BYTES = 1024 * 1024;
/** **Recommendation** (GAP-MOD00-24): frames waiting to be handled before the socket is closed. */
export const WS_MAX_PENDING_FRAMES = 32;

/** The longest delay `setTimeout` takes; a later expiry is re-armed when it fires. */
const MAX_TIMER_MS = 2_147_483_647;
const OPEN = 1;

type Phase = 'awaiting_auth' | 'open' | 'closed';

/** Per-socket state, kept in Bun's `ws.data`. */
export interface SocketState {
  connectionId: string;
  phase: Phase;
  principal?: MemberPrincipal;
  /** Channel listeners this socket holds, so a close leaves every one of them. */
  subscriptions: Map<string, RelayListener>;
  timers: Set<ReturnType<typeof setTimeout>>;
  /** Frames are handled one at a time, in order. */
  queue: Promise<void>;
  pending: number;
  /** When the last accepted heartbeat (or `ready`) happened, in `now()` milliseconds. */
  lastHeartbeatAt?: number;
}

/** The part of Bun's `ServerWebSocket` the gateway uses; a test supplies a fake. */
export interface GatewaySocket {
  data: SocketState;
  readonly readyState: number;
  send(data: string): number;
  close(code?: number, reason?: string): void;
  getBufferedAmount(): number;
}

/** What a feature module's handler can do with the socket that sent the frame. */
export interface SocketEventContext {
  principal: MemberPrincipal;
  connectionId: string;
  /** The client's frame id, when it sent one. */
  frameId?: string;
  logger: Logger;
  /** Sends a frame to this socket only, carrying the client's frame id. */
  reply(type: string, data: unknown): void;
  /** Subscribes this socket to a channel (for example `conversationChannel(id)` after an access check). */
  join(channel: string): Promise<void>;
  leave(channel: string): Promise<void>;
  /** Publishes to every socket on the channel, on every instance. */
  publish(channel: string, frame: ServerFrame): Promise<void>;
}

export interface SocketEventDefinition<S extends z.ZodType = z.ZodType> {
  /** Client-to-server event name from [TR §8.3]. */
  type: string;
  /** Validates `data`, as the matching REST route validates its body. */
  schema: S;
  /** A `rate_limit_policies.key` consumed per frame, with the member as subject. */
  rateLimitPolicy?: string;
  handle(context: SocketEventContext, data: z.output<S>): void | Promise<void>;
}

export interface WebSocketGatewayDeps {
  tokens: AccessTokenVerifier;
  denyList: SessionDenyList;
  relay: Relay;
  registry: ConnectionRegistry;
  logger: Logger;
  /** Needed only when an event names a `rateLimitPolicy`. */
  rateLimits?: RateLimits;
  /** Called on each heartbeat after the checks pass: MOD-07 and MOD-08 write presence here. */
  onHeartbeat?: (principal: MemberPrincipal) => Promise<void>;
  authTimeoutMs?: number;
  /** No accepted heartbeat for this long after `ready` closes the socket; the 120 s TTL. */
  heartbeatTimeoutMs?: number;
  slowConsumerBytes?: number;
  maxPendingFrames?: number;
  now?: () => number;
}

interface UpgradeServer {
  upgrade(request: Request, options: { data: SocketState }): boolean;
}
const isUpgradeServer = (value: unknown): value is UpgradeServer =>
  typeof (value as { upgrade?: unknown } | undefined)?.upgrade === 'function';

const RESERVED = new Set([WS_AUTH_FRAME, WS_READY_FRAME, WS_ERROR_FRAME, PRESENCE_HEARTBEAT]);

/** Read through a call: the phase changes across awaits, which narrowing cannot see. */
const isClosed = (ws: GatewaySocket) => ws.data.phase === 'closed';

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

export const newSocketState = (): SocketState => ({
  connectionId: crypto.randomUUID(),
  phase: 'awaiting_auth',
  subscriptions: new Map(),
  timers: new Set(),
  queue: Promise.resolve(),
  pending: 0,
});

export const createWebSocketGateway = (deps: WebSocketGatewayDeps) => {
  const {
    tokens,
    denyList,
    relay,
    registry,
    logger,
    authTimeoutMs = WS_AUTH_TIMEOUT_MS,
    heartbeatTimeoutMs = WS_CONNECTION_TTL_SECONDS * 1000,
    slowConsumerBytes = WS_SLOW_CONSUMER_BYTES,
    maxPendingFrames = WS_MAX_PENDING_FRAMES,
    now = Date.now,
  } = deps;
  const events = new Map<string, SocketEventDefinition>();
  const sockets = new Set<GatewaySocket>();

  const close = (ws: GatewaySocket, reason: WsCloseReason) => {
    if (ws.data.phase === 'closed') return;
    ws.data.phase = 'closed';
    ws.close(WS_CLOSE_CODES[reason], reason);
  };

  /** Sends text; a socket that cannot keep up is closed rather than buffered without bound. */
  const sendRaw = (ws: GatewaySocket, text: string) => {
    if (ws.readyState !== OPEN || ws.data.phase === 'closed') return;
    const sent = ws.send(text);
    if (sent === 0 || ws.getBufferedAmount() > slowConsumerBytes) {
      logger.warn('websocket slow consumer, closing', {
        connection_id: ws.data.connectionId,
        buffered: ws.getBufferedAmount(),
      });
      close(ws, 'slow_consumer');
    }
  };
  const send = (ws: GatewaySocket, frame: ServerFrame) => sendRaw(ws, JSON.stringify(frame));
  const sendError = (
    ws: GatewaySocket,
    frameId: string | undefined,
    code: ProblemCode,
    extra: { errors?: unknown[]; retry_after_seconds?: number } = {},
  ) =>
    send(ws, {
      type: WS_ERROR_FRAME,
      ...(frameId ? { id: frameId } : {}),
      data: { code, ...extra },
    });

  const startTimer = (ws: GatewaySocket, ms: number, fire: () => void) => {
    const timer = setTimeout(() => {
      ws.data.timers.delete(timer);
      fire();
    }, ms);
    ws.data.timers.add(timer);
  };

  const armExpiry = (ws: GatewaySocket, expiresAt: number) => {
    const delay = expiresAt - now();
    if (delay <= 0) return close(ws, 'token_expired');
    startTimer(ws, Math.min(delay, MAX_TIMER_MS), () => armExpiry(ws, expiresAt));
  };

  /**
   * Closes a socket whose last accepted heartbeat is older than the TTL. Other frames reset Bun's
   * idle timeout but not this one, so a revoked session cannot keep its socket by never sending a
   * heartbeat (the denylist is re-checked only there).
   */
  const armHeartbeatWatch = (ws: GatewaySocket) => {
    const due = (ws.data.lastHeartbeatAt ?? now()) + heartbeatTimeoutMs - now();
    if (due <= 0) {
      logger.info('websocket missed its heartbeats, closing', {
        connection_id: ws.data.connectionId,
      });
      return close(ws, 'auth_timeout');
    }
    startTimer(ws, Math.min(due, MAX_TIMER_MS), () => armHeartbeatWatch(ws));
  };

  const join = async (ws: GatewaySocket, channel: string) => {
    if (ws.data.phase === 'closed' || ws.data.subscriptions.has(channel)) return;
    const listener: RelayListener = (text) => sendRaw(ws, text);
    ws.data.subscriptions.set(channel, listener);
    try {
      await relay.join(channel, listener);
    } catch (error) {
      ws.data.subscriptions.delete(channel);
      throw error;
    }
    // Closed while subscribing: the close handler has already run, so leave here.
    if (isClosed(ws)) {
      ws.data.subscriptions.delete(channel);
      await relay.leave(channel, listener);
    }
  };
  const leave = async (ws: GatewaySocket, channel: string) => {
    const listener = ws.data.subscriptions.get(channel);
    if (!listener) return;
    ws.data.subscriptions.delete(channel);
    await relay.leave(channel, listener);
  };

  const publish = async (channel: string, frame: ServerFrame) => {
    await relay.publish(channel, JSON.stringify(ServerFrameSchema.parse(frame)));
  };

  /** The denylist check of REST, for the handshake and every heartbeat. */
  const sessionLive = async (ws: GatewaySocket, principal: MemberPrincipal) => {
    try {
      if (!(await denyList.isDenied(principal.sessionId))) return true;
      close(ws, 'session_revoked');
    } catch (error) {
      logger.error('session denylist unavailable, closing websocket', { error: message(error) });
      close(ws, 'dependency_unavailable');
    }
    return false;
  };

  const authenticate = async (ws: GatewaySocket, raw: unknown) => {
    const frame = AuthFrameSchema.safeParse(raw);
    if (!frame.success) return close(ws, 'unauthenticated');

    let principal: MemberPrincipal | null;
    try {
      principal = await tokens.verify(frame.data.data.token);
    } catch (error) {
      logger.error('access token verification failed, closing websocket', {
        error: message(error),
      });
      return close(ws, 'dependency_unavailable');
    }
    if (!principal) return close(ws, 'unauthenticated');
    if (!principal.expiresAt) {
      logger.error('access token verifier returned no expiry, refusing websocket');
      return close(ws, 'unauthenticated');
    }
    if (principal.expiresAt.getTime() <= now()) return close(ws, 'token_expired');
    if (!(await sessionLive(ws, principal)) || isClosed(ws)) return;

    ws.data.principal = principal;
    try {
      await registry.add(principal.memberId, ws.data.connectionId);
      await join(ws, userChannel(principal.memberId));
    } catch (error) {
      logger.error('realtime store unavailable, closing websocket', { error: message(error) });
      return close(ws, 'dependency_unavailable');
    }
    if (isClosed(ws)) {
      await registry.remove(principal.memberId, ws.data.connectionId);
      return;
    }

    for (const timer of ws.data.timers) clearTimeout(timer);
    ws.data.timers.clear();
    ws.data.phase = 'open';
    ws.data.lastHeartbeatAt = now();
    armExpiry(ws, principal.expiresAt.getTime());
    armHeartbeatWatch(ws);
    send(ws, {
      type: WS_READY_FRAME,
      ...(frame.data.id ? { id: frame.data.id } : {}),
      data: { connection_id: ws.data.connectionId, heartbeat_seconds: WS_HEARTBEAT_SECONDS },
    });
  };

  const heartbeat = async (ws: GatewaySocket, principal: MemberPrincipal, frame: ClientFrame) => {
    if (!PresenceHeartbeatDataSchema.safeParse(frame.data).success) {
      return sendError(ws, frame.id, 'validation');
    }
    if (!(await sessionLive(ws, principal))) return;
    try {
      await registry.refresh(principal.memberId, ws.data.connectionId);
      ws.data.lastHeartbeatAt = now();
      await deps.onHeartbeat?.(principal);
    } catch (error) {
      logger.error('realtime store unavailable on heartbeat, closing websocket', {
        error: message(error),
      });
      close(ws, 'dependency_unavailable');
    }
  };

  const dispatch = async (ws: GatewaySocket, principal: MemberPrincipal, frame: ClientFrame) => {
    if (frame.type === PRESENCE_HEARTBEAT) return heartbeat(ws, principal, frame);
    const definition = events.get(frame.type);
    if (!definition) return sendError(ws, frame.id, 'bad_request');

    const data = definition.schema.safeParse(frame.data);
    if (!data.success) {
      return sendError(ws, frame.id, 'validation', {
        errors: fieldErrorsFromIssues(data.error.issues),
      });
    }

    if (definition.rateLimitPolicy) {
      if (!deps.rateLimits) throw new Error(`no rate limiter for ${definition.type}`);
      const check = await checkRateLimit(
        deps.rateLimits,
        definition.rateLimitPolicy,
        principal.memberId,
        logger,
      );
      if (check.outcome === 'limited' || check.outcome === 'locked') {
        return sendError(ws, frame.id, 'rate_limited', {
          retry_after_seconds: check.retryAfterSeconds,
        });
      }
      if (check.outcome === 'unavailable' && check.refuse) {
        return sendError(ws, frame.id, 'dependency_unavailable');
      }
    }

    const context: SocketEventContext = {
      principal,
      connectionId: ws.data.connectionId,
      ...(frame.id ? { frameId: frame.id } : {}),
      logger,
      reply: (type, payload) =>
        send(ws, { type, ...(frame.id ? { id: frame.id } : {}), data: payload }),
      join: (channel) => join(ws, channel),
      leave: (channel) => leave(ws, channel),
      publish,
    };
    try {
      await definition.handle(context, data.data);
    } catch (error) {
      if (error instanceof ProblemError) {
        const { errors, retry_after_seconds } = error.details;
        return sendError(ws, frame.id, error.code, {
          ...(errors ? { errors } : {}),
          ...(retry_after_seconds !== undefined ? { retry_after_seconds } : {}),
        });
      }
      logger.error('websocket event handler failed', { event: frame.type, error: message(error) });
      sendError(ws, frame.id, 'internal');
    }
  };

  const handleFrame = async (ws: GatewaySocket, text: string | Buffer) => {
    if (ws.data.phase === 'closed') return;
    if (typeof text !== 'string') return close(ws, 'invalid_frame');
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return close(ws, 'invalid_frame');
    }
    if (ws.data.phase === 'awaiting_auth') return authenticate(ws, raw);

    const frame = ClientFrameSchema.safeParse(raw);
    if (!frame.success) return sendError(ws, undefined, 'bad_request');
    // `principal` is set before the phase becomes open.
    return dispatch(ws, ws.data.principal!, frame.data);
  };

  const websocket: WebSocketHandler<SocketState> = {
    maxPayloadLength: WS_MAX_FRAME_BYTES,
    // No frame for 120 s (four missed heartbeats): the server closes the socket [DD §14].
    idleTimeout: WS_CONNECTION_TTL_SECONDS,
    sendPings: false,
    open(ws) {
      sockets.add(ws);
      startTimer(ws, authTimeoutMs, () => {
        if (ws.data.phase === 'awaiting_auth') close(ws, 'auth_timeout');
      });
    },
    message(ws, text) {
      if (ws.data.pending >= maxPendingFrames) return close(ws, 'invalid_frame');
      ws.data.pending += 1;
      ws.data.queue = ws.data.queue
        .then(() => handleFrame(ws, text))
        .catch((error: unknown) => {
          logger.error('websocket frame failed', { error: message(error) });
          close(ws, 'dependency_unavailable');
        })
        .finally(() => {
          ws.data.pending -= 1;
        });
    },
    async close(ws) {
      sockets.delete(ws);
      ws.data.phase = 'closed';
      for (const timer of ws.data.timers) clearTimeout(timer);
      ws.data.timers.clear();
      const subscriptions = [...ws.data.subscriptions];
      ws.data.subscriptions.clear();
      await Promise.all(subscriptions.map(([channel, listener]) => relay.leave(channel, listener)));
      if (ws.data.principal) {
        await registry.remove(ws.data.principal.memberId, ws.data.connectionId);
      }
    },
  };

  return {
    /**
     * Registers a client-to-server event. Throws on a duplicate, a reserved name (`auth`, `ready`,
     * `error`, `presence.heartbeat`) or a name that is not a dotted lower-case event name.
     */
    register<S extends z.ZodType>(definition: SocketEventDefinition<S>) {
      if (!EVENT_TYPE_PATTERN.test(definition.type) || RESERVED.has(definition.type)) {
        throw new Error(`websocket event name not allowed: ${definition.type}`);
      }
      if (events.has(definition.type)) {
        throw new Error(`websocket event registered twice: ${definition.type}`);
      }
      events.set(definition.type, definition as unknown as SocketEventDefinition);
    },
    /** The Hono handler for `GET /v1/ws`: needs Bun's server as the second argument of `fetch`. */
    upgrade(c: Context<AppEnv>) {
      if (c.req.header('upgrade')?.toLowerCase() !== 'websocket') {
        return problemResponse(c, 'bad_request', { detail: 'Expected a WebSocket upgrade' });
      }
      const server: unknown = c.env;
      if (!isUpgradeServer(server)) throw new Error('websocket upgrade needs the Bun server');
      if (!server.upgrade(c.req.raw, { data: newSocketState() })) {
        return problemResponse(c, 'bad_request', { detail: 'WebSocket upgrade failed' });
      }
      return new Response(null);
    },
    /** Pass to `Bun.serve({ websocket })`. */
    websocket,
    /** Publishes to every socket of a member, on every instance (`ch:user:{user_id}`). */
    publishToUser: (userId: string, frame: ServerFrame) => publish(userChannel(userId), frame),
    publish,
    /** Open sockets on this instance. */
    connectionCount: () => sockets.size,
    /** Drain on shutdown: closes every socket with 1001 so clients reconnect elsewhere. */
    async close() {
      for (const ws of sockets) close(ws, 'going_away');
      await relay.close();
    },
  };
};

export type WebSocketGateway = ReturnType<typeof createWebSocketGateway>;
