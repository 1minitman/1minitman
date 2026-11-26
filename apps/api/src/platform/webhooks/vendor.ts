import type { WebhookProvider } from '@1minitman/db/schema';
import { timingSafeEqual } from 'node:crypto';

/** What the intake hands a vendor port: the body exactly as received, and the request headers. */
export interface WebhookRequest {
  rawBody: Uint8Array;
  headers: Headers;
}

/** The vendor's own identity for the event, read from the body (and headers, for some vendors). */
export interface ParsedWebhook {
  /** The vendor's event id: with the provider, the key that refuses a duplicate. */
  eventId: string;
  eventType: string;
  /** The stored payload (`webhook_events.payload`, jsonb). */
  payload: unknown;
}

/**
 * One vendor's port into the intake pipeline [TR §12]. The owning module (billing, verification,
 * messaging, ...) supplies it with the route path, the signature check and the event parser;
 * this module owns the pipeline and the storage.
 */
export interface WebhookVendor {
  /** A value of the `webhook_events.provider` CHECK [SQL]. */
  provider: WebhookProvider;
  /** Path segment under `/webhooks`, as the owning module's source names it. */
  path: string;
  /**
   * True only when the request carries a valid signature for the raw body. Compare secrets and
   * digests with `constantTimeEqual()`. A throw counts as an invalid signature.
   */
  verify(request: WebhookRequest): boolean | Promise<boolean>;
  /** The event's id, type and payload, or null when the body is not a well-formed event. */
  parse(request: WebhookRequest): ParsedWebhook | null;
  /** True for the event types the owning module processes; any other type is stored as ignored. */
  handles(eventType: string): boolean;
}

/** Compares two secrets or digests in constant time; a length difference is simply unequal. */
export const constantTimeEqual = (a: string | Uint8Array, b: string | Uint8Array): boolean => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
};
