import { WEBHOOK_PROVIDERS } from '@1minitman/db/schema';
import type { Logger } from '../logger';
import type { StoredWebhookEvent, WebhookStore } from './store';
import type { WebhookRequest, WebhookVendor } from './vendor';

/**
 * Hands a stored event to its processing. Called after the row is stored and only for an event to
 * process (`status = 'received'`). A failure here is logged and the vendor still gets its 200: the
 * row stays `received`, where `idx_webhooks_pending` and `webhooks.retry` (MOD-10) find it.
 * Which queue carries the event to the owning module's handler is GAP-MOD00-29.
 */
export interface WebhookQueue {
  enqueue(event: StoredWebhookEvent): Promise<void>;
}

/** What the intake did with one request; the route turns it into the response [1MM-STD-13 §4.7]. */
export type WebhookOutcome =
  /** Stored and handed to processing. 200. */
  | { kind: 'accepted'; event: StoredWebhookEvent }
  /** Stored with `status = 'ignored'`: an event type the owning module does not use. 200. */
  | { kind: 'ignored'; event: StoredWebhookEvent }
  /** Already stored: acknowledged and not processed again. 200. */
  | { kind: 'duplicate' }
  /** Signature missing or invalid: never processed; stored when the body names an event. 401. */
  | { kind: 'invalid_signature'; stored: boolean }
  /** Correctly signed, but not a well-formed event. 400. */
  | { kind: 'unreadable' };

/** Raised when the event cannot be stored (database down); the route answers 503. */
export class WebhookStoreUnavailableError extends Error {
  override readonly name = 'WebhookStoreUnavailableError';
}

export interface WebhookIntake {
  /** Adds a vendor route (`POST /webhooks/<path>`). Called by the owning module at start. */
  register(vendor: WebhookVendor): void;
  /** The vendor registered for a path segment, if any. */
  vendorFor(path: string): WebhookVendor | undefined;
  /** The pipeline for one request [TR §12]: verify, store once, acknowledge, enqueue. */
  receive(vendor: WebhookVendor, request: WebhookRequest): Promise<WebhookOutcome>;
}

export interface WebhookIntakeDeps {
  store: WebhookStore;
  queue: WebhookQueue;
  logger: Logger;
}

const PATH = /^[a-z0-9][a-z0-9-]{0,62}$/;

/** A queue that hands nothing on: the row waits as `received` for `webhooks.retry` (GAP-MOD00-29). */
export const pendingRowWebhookQueue: WebhookQueue = { enqueue: () => Promise.resolve() };

/** A short, payload-free label for a store error: the driver's code (`ECONNREFUSED`, `23514`). */
const errorCode = (error: unknown): string => {
  const cause =
    error instanceof Error ? (error.cause as { code?: unknown } | undefined) : undefined;
  if (cause && typeof cause.code === 'string') return cause.code;
  const own = (error as { code?: unknown } | null)?.code;
  if (typeof own === 'string') return own;
  return error instanceof Error ? error.name : 'unknown';
};

const verifySafely = async (
  vendor: WebhookVendor,
  request: WebhookRequest,
  logger: Logger,
): Promise<boolean> => {
  try {
    return (await vendor.verify(request)) === true;
  } catch (error) {
    // Fail closed: a check that cannot decide is an invalid signature.
    logger.error('webhook signature check threw', {
      provider: vendor.provider,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
};

const parseSafely = (vendor: WebhookVendor, request: WebhookRequest) => {
  try {
    const parsed = vendor.parse(request);
    if (!parsed) return null;
    if (typeof parsed.eventId !== 'string' || parsed.eventId.length === 0) return null;
    if (typeof parsed.eventType !== 'string' || parsed.eventType.length === 0) return null;
    if (parsed.payload === undefined) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const createWebhookIntake = ({ store, queue, logger }: WebhookIntakeDeps): WebhookIntake => {
  const vendors = new Map<string, WebhookVendor>();

  const record = async (...args: Parameters<WebhookStore['record']>) => {
    try {
      return await store.record(...args);
    } catch (error) {
      // Never the error message: the driver puts the query parameters, payload included, in it.
      logger.error('webhook could not be stored', {
        provider: args[0].provider,
        error: errorCode(error),
      });
      throw new WebhookStoreUnavailableError('webhook_events is unavailable');
    }
  };

  return {
    register: (vendor) => {
      if (!PATH.test(vendor.path)) {
        throw new Error(`webhook path "${vendor.path}" must be lower-case letters, digits, dashes`);
      }
      if (!(WEBHOOK_PROVIDERS as readonly string[]).includes(vendor.provider)) {
        throw new Error(`webhook provider "${vendor.provider}" is not in webhook_events.provider`);
      }
      if (vendors.has(vendor.path)) {
        throw new Error(`webhook path "${vendor.path}" is already registered`);
      }
      vendors.set(vendor.path, vendor);
    },

    vendorFor: (path) => vendors.get(path),

    receive: async (vendor, request) => {
      const signatureValid = await verifySafely(vendor, request, logger);
      const parsed = parseSafely(vendor, request);

      if (!signatureValid) {
        // Rule 11: stored with signature_valid = false and never processed. Without an event id
        // there is no row to store (event_id is NOT NULL, GAP-MOD00-30).
        // A store failure is logged by record() and the answer stays 401: the request is refused
        // for its signature, whatever the database does.
        const stored = parsed
          ? await record({
              provider: vendor.provider,
              eventId: parsed.eventId,
              eventType: parsed.eventType,
              signatureValid: false,
              payload: parsed.payload,
              status: 'ignored',
            }).catch(() => null)
          : null;
        // Counted for the forgery alert [TR §14]; no payload or header value is logged.
        logger.warn('webhook signature invalid', {
          provider: vendor.provider,
          stored: stored !== null,
        });
        return { kind: 'invalid_signature', stored: stored !== null };
      }

      if (!parsed) return { kind: 'unreadable' };

      const handled = vendor.handles(parsed.eventType);
      const event = await record({
        provider: vendor.provider,
        eventId: parsed.eventId,
        eventType: parsed.eventType,
        signatureValid: true,
        payload: parsed.payload,
        status: handled ? 'received' : 'ignored',
      });
      if (!event) return { kind: 'duplicate' };
      if (event.status === 'ignored') return { kind: 'ignored', event };

      try {
        await queue.enqueue(event);
      } catch (error) {
        logger.error('webhook enqueue failed; the row stays pending', {
          provider: vendor.provider,
          webhook_event_id: event.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return { kind: 'accepted', event };
    },
  };
};
