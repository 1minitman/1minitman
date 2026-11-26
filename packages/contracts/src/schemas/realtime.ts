import { z } from 'zod';
import { PROBLEM_CODE_PATTERN } from '../errors/registry';
import { FieldErrorSchema } from './problem';
import { TimestampSchema } from './primitives';

/*
 * Realtime envelopes (MOD-00 plan sections 4.2 and 4.4): the member WebSocket at `/v1/ws`
 * ([TR §8.3], 1MM-ADR-0019, TRX-034) and the admin Server-Sent Events stream ([ADM §1.6]).
 * Feature modules add their own event payload schemas next to their routes and validate them
 * with these envelopes; the gateway validates every client frame with the same zod schemas as
 * REST.
 *
 * Sourced facts: one socket per signed-in device; the access token is sent in the first frame,
 * never in the URL; expiry closes the socket with a dedicated application close code so the
 * client refreshes and reconnects with exponential backoff and jitter (TRX-034); the client sends
 * `presence.heartbeat` every 30 s [TR §8.3]; `ws:conn:{user_id}` and `presence:{user_id}` live
 * 120 s [DD §14]. The frame names `auth`, `ready` and `error`, the close-code numbers and the
 * limits marked **Recommendation** are not in any source: GAP-MOD00-24.
 */

/** The member WebSocket path [TR §8.3]. */
export const MEMBER_WS_PATH = '/v1/ws';

/** The client sends `presence.heartbeat` this often [TR §8.3]. */
export const WS_HEARTBEAT_SECONDS = 30;

/** TTL of `ws:conn:{user_id}`; a socket silent for this long is closed [DD §14]. */
export const WS_CONNECTION_TTL_SECONDS = 120;

/**
 * Close codes. 1001 is the WebSocket standard "going away" (an instance draining on deploy);
 * the 4xxx codes are application codes (RFC 6455 section 7.4.2). TRX-034 names only "a dedicated
 * code" for expiry: the numbers are a **Recommendation** (GAP-MOD00-24).
 *
 * Client rule: `token_expired` and `unauthenticated` refresh the access token, then reconnect;
 * `session_revoked` signs out; every other code reconnects with exponential backoff and jitter.
 */
export const WS_CLOSE_CODES = {
  going_away: 1001,
  token_expired: 4001,
  unauthenticated: 4002,
  session_revoked: 4003,
  auth_timeout: 4004,
  invalid_frame: 4005,
  slow_consumer: 4006,
  dependency_unavailable: 4007,
} as const;
export type WsCloseReason = keyof typeof WS_CLOSE_CODES;

/** An event name: lower-case dotted words, as in [TR §8.3] (`presence.heartbeat`, `message.new`). */
export const EVENT_TYPE_PATTERN = /^[a-z][a-z_]*(\.[a-z][a-z_]*)*$/;
export const EventTypeSchema = z.string().max(64).regex(EVENT_TYPE_PATTERN);

/** A client-made frame id, echoed on the reply or error so the client can match them. */
export const ClientFrameIdSchema = z.string().min(1).max(64);

/** Every frame the client sends. `data` is validated by the event's own schema. */
export const ClientFrameSchema = z.strictObject({
  type: EventTypeSchema,
  id: ClientFrameIdSchema.optional(),
  data: z.unknown().optional(),
});
export type ClientFrame = z.infer<typeof ClientFrameSchema>;

/** The first frame: the member access token (TRX-034). Nothing else is accepted before it. */
export const WS_AUTH_FRAME = 'auth';
export const AuthFrameSchema = z.strictObject({
  type: z.literal(WS_AUTH_FRAME),
  id: ClientFrameIdSchema.optional(),
  data: z.strictObject({ token: z.string().min(1).max(4096) }),
});

/** Every frame the server sends. */
export const ServerFrameSchema = z.strictObject({
  type: EventTypeSchema,
  id: ClientFrameIdSchema.optional(),
  data: z.unknown(),
});
export type ServerFrame = z.infer<typeof ServerFrameSchema>;

/** Sent once the first frame is accepted; the client may send events from then on. */
export const WS_READY_FRAME = 'ready';
export const ReadyFrameDataSchema = z.strictObject({
  connection_id: z.uuid(),
  heartbeat_seconds: z.literal(WS_HEARTBEAT_SECONDS),
});

/** A refused frame. The socket stays open; `code` is a problem code of 1MM-STD-13. */
export const WS_ERROR_FRAME = 'error';
export const ErrorFrameDataSchema = z.strictObject({
  code: z.string().regex(PROBLEM_CODE_PATTERN),
  errors: z.array(FieldErrorSchema).optional(),
  retry_after_seconds: z.number().int().nonnegative().optional(),
});

/** Client to server every `WS_HEARTBEAT_SECONDS` [TR §8.3]. No payload. */
export const PRESENCE_HEARTBEAT = 'presence.heartbeat';
export const PresenceHeartbeatDataSchema = z.strictObject({}).optional();

/** Test-only event (MOD-00 plan section 4.2): relayed to every socket of the sender. */
export const ECHO_EVENT = 'echo';
export const EchoDataSchema = z.strictObject({ text: z.string().max(256) });

/**
 * One admin Server-Sent Event [ADM §1.6]: the SSE `event` field is `type`; the `data` field is
 * this object as JSON. Feature modules define each event's `data` (MOD-01 `session.revoked`,
 * MOD-09 `queue.counts`, ...).
 */
export const AdminStreamEventSchema = z.strictObject({
  type: EventTypeSchema,
  data: z.unknown(),
  at: TimestampSchema,
});
export type AdminStreamEvent = z.infer<typeof AdminStreamEventSchema>;

/** The client falls back to polling this often while the stream is down [ADM §1.6]. */
export const ADMIN_STREAM_POLL_SECONDS = 30;
