import { EventTypeSchema, TimestampSchema } from '@1minitman/contracts';
import type { Context } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import type { AdminPrincipal } from '../auth/principals';
import type { AppEnv } from '../http/context';
import { problemResponse } from '../http/problem';
import type { Logger } from '../logger';
import { ADMIN_ALL_CHANNEL, adminChannel } from './channels';
import type { Relay, RelayListener } from './relay';

/*
 * The admin Server-Sent Events hub (MOD-00 plan section 4.2, [ADM §1.6]): one stream per console
 * tab, events filtered on the server by permission and scope, fanned out across API instances on
 * `ch:admin:{admin_id}` and `ch:admin:all` (TRX-053). MOD-01 mounts `GET /admin/v1/stream` behind
 * `requireAdmin()` and calls `stream(c, currentAdmin(c))`; it also supplies the filter, because
 * permissions and scope live in its tables. Until then `denyAllAdminStreamFilter` lets nothing
 * through. The console falls back to 30 s polling while the stream is down.
 */

/** **Recommendation** (GAP-MOD00-25): an SSE comment this often keeps proxies from idling out. */
export const ADMIN_STREAM_HEARTBEAT_MS = 25_000;
/** **Recommendation** (GAP-MOD00-25): events waiting for one slow tab before its stream closes. */
export const ADMIN_STREAM_MAX_QUEUED = 100;

/** What travels on the admin channels: the event plus what the filter decides on. */
const AdminChannelMessageSchema = z.strictObject({
  type: EventTypeSchema,
  data: z.unknown(),
  /**
   * The `admin_permissions.key` a receiver must hold, or `null` for an event addressed to one
   * admin on `ch:admin:{admin_id}` that needs no permission (for example `session.revoked`).
   */
  permission: z.string().min(1).nullable(),
  /** The target's scope dimensions (for example a country), read only by the filter. */
  scope: z.record(z.string(), z.string()).optional(),
  at: TimestampSchema,
});
export type AdminChannelMessage = z.infer<typeof AdminChannelMessageSchema>;

/** An event as a module publishes it; `at` is set by the hub. */
export type AdminEventInput = Omit<AdminChannelMessage, 'at'>;

/** Decides whether one admin's stream receives one event. MOD-01 implements it. */
export interface AdminStreamFilter {
  canReceive(principal: AdminPrincipal, event: AdminChannelMessage): Promise<boolean>;
}

/** Deny by default: no event reaches any stream until MOD-01 supplies the real filter. */
export const denyAllAdminStreamFilter: AdminStreamFilter = {
  canReceive: () => Promise.resolve(false),
};

export interface AdminStreamHubDeps {
  relay: Relay;
  filter: AdminStreamFilter;
  logger: Logger;
  heartbeatMs?: number;
  maxQueued?: number;
  now?: () => Date;
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

export const createAdminStreamHub = ({
  relay,
  filter,
  logger,
  heartbeatMs = ADMIN_STREAM_HEARTBEAT_MS,
  maxQueued = ADMIN_STREAM_MAX_QUEUED,
  now = () => new Date(),
}: AdminStreamHubDeps) => {
  let open = 0;

  const publish = async (channel: string, event: AdminEventInput) =>
    relay.publish(
      channel,
      JSON.stringify(AdminChannelMessageSchema.parse({ ...event, at: now().toISOString() })),
    );

  return {
    /** To one admin's tabs, on every instance. */
    publishToAdmin: (adminId: string, event: AdminEventInput) =>
      publish(adminChannel(adminId), event),
    /** To every admin whose permission and scope the filter accepts. */
    publishToAll: (event: AdminEventInput) => publish(ADMIN_ALL_CHANNEL, event),
    /** Streams on this instance (for tests and metrics). */
    streamCount: () => open,

    /**
     * The SSE response for one tab. Subscribes before the response starts, so a Redis failure is
     * a 503 problem the console turns into polling, not an empty stream.
     */
    async stream(c: Context<AppEnv>, principal: AdminPrincipal): Promise<Response> {
      let queued = 0;
      let chain = Promise.resolve();
      let write: ((event: AdminChannelMessage) => Promise<void>) | undefined;
      let end: (() => void) | undefined;
      const ended = new Promise<void>((resolve) => (end = resolve));

      const deliver = async (text: string) => {
        let event: AdminChannelMessage;
        try {
          event = AdminChannelMessageSchema.parse(JSON.parse(text));
        } catch (error) {
          logger.error('admin stream message malformed, dropped', { error: message(error) });
          return;
        }
        let allowed = false;
        try {
          allowed = await filter.canReceive(principal, event);
        } catch (error) {
          // Fail closed: an event the filter cannot decide on is not sent.
          logger.error('admin stream filter failed, event dropped', {
            event: event.type,
            error: message(error),
          });
        }
        if (allowed && write) await write(event);
      };
      const listener: RelayListener = (text) => {
        if (queued >= maxQueued) {
          logger.warn('admin stream slow consumer, closing', { admin_id: principal.adminId });
          end?.();
          return;
        }
        queued += 1;
        chain = chain
          .then(() => deliver(text))
          .catch(() => end?.())
          .finally(() => {
            queued -= 1;
          });
      };

      const channels = [adminChannel(principal.adminId), ADMIN_ALL_CHANNEL];
      const leaveAll = () => Promise.all(channels.map((channel) => relay.leave(channel, listener)));
      try {
        for (const channel of channels) await relay.join(channel, listener);
      } catch (error) {
        await leaveAll();
        logger.error('admin stream could not subscribe', { error: message(error) });
        return problemResponse(c, 'dependency_unavailable');
      }

      open += 1;
      // Bun closes a request idle for 10 s by default; a stream is idle by design between events,
      // so its own heartbeat replaces that timeout.
      const server: unknown = c.env;
      const timeout = (server as { timeout?: unknown } | undefined)?.timeout;
      if (typeof timeout === 'function') timeout.call(server, c.req.raw, 0);

      return streamSSE(c, async (stream) => {
        write = ({ type, data, at }) =>
          stream.writeSSE({ event: type, data: JSON.stringify({ type, data, at }) });
        stream.onAbort(() => end?.());
        // A first comment sends the headers now, so the console knows the stream is live.
        await stream.write(': open\n\n');
        const heartbeat = setInterval(() => {
          stream.write(': ping\n\n').catch(() => end?.());
        }, heartbeatMs);
        try {
          await ended;
        } finally {
          clearInterval(heartbeat);
          write = undefined;
          open -= 1;
          await leaveAll();
        }
      });
    },
  };
};

export type AdminStreamHub = ReturnType<typeof createAdminStreamHub>;
