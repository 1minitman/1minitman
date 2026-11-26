import { sql } from 'drizzle-orm';
import type { Database } from './client';
import { webhookEvents, type WebhookEventStatus, type WebhookProvider } from './schema/webhooks';

/** One inbound event as the webhook intake stores it [TR §12]. */
export interface NewWebhookEvent {
  provider: WebhookProvider;
  eventId: string;
  eventType: string;
  signatureValid: boolean;
  payload: unknown;
  /** `received` for an event to process; `ignored` for an unused type or an invalid signature. */
  status: Extract<WebhookEventStatus, 'received' | 'ignored'>;
}

/** The stored row, as the processing queue receives it. */
export interface StoredWebhookEvent {
  id: string;
  provider: WebhookProvider;
  eventType: string;
  status: NewWebhookEvent['status'];
}

/**
 * Inserts one inbound event into `webhook_events` and returns it, or null when the event was
 * already stored: `UNIQUE (provider, event_id)` decides atomically, so parallel deliveries of one
 * event store it once [SQL].
 *
 * One exception: a row stored with an invalid signature gives way to the first correctly signed
 * copy of the same event, so a forged request that guesses an event id cannot turn the genuine
 * event into a "duplicate" (GAP-MOD00-30). A correctly signed row is never replaced.
 *
 * The table holds no member-owned rows and has no row-level security, and this is one statement,
 * so it runs on any pool without a member context (the API uses `app_api`).
 */
export const recordWebhookEvent = async (
  database: Database,
  event: NewWebhookEvent,
): Promise<StoredWebhookEvent | null> => {
  const [row] = await database.db
    .insert(webhookEvents)
    .values({
      provider: event.provider,
      eventId: event.eventId,
      eventType: event.eventType,
      signatureValid: event.signatureValid,
      payload: event.payload,
      status: event.status,
    })
    .onConflictDoUpdate({
      target: [webhookEvents.provider, webhookEvents.eventId],
      set: {
        eventType: sql`excluded.event_type`,
        signatureValid: sql`excluded.signature_valid`,
        payload: sql`excluded.payload`,
        status: sql`excluded.status`,
        receivedAt: sql`now()`,
      },
      setWhere: sql`${webhookEvents.signatureValid} = false AND excluded.signature_valid = true`,
    })
    .returning({
      id: webhookEvents.id,
      provider: webhookEvents.provider,
      eventType: webhookEvents.eventType,
      status: webhookEvents.status,
    });
  if (!row) return null;
  return { ...row, status: row.status === 'received' ? 'received' : 'ignored' };
};
