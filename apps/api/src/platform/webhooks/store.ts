import type { NewWebhookEvent, StoredWebhookEvent } from '@1minitman/db';

export type { NewWebhookEvent, StoredWebhookEvent };

/**
 * Storage for `webhook_events`. `UNIQUE (provider, event_id)` refuses a duplicate [SQL].
 * `record()` returns the stored row, or null when the event was already stored; an unverified
 * row gives way to a verified copy (`recordWebhookEvent()` in packages/db, GAP-MOD00-30).
 */
export interface WebhookStore {
  record(event: NewWebhookEvent): Promise<StoredWebhookEvent | null>;
}

/** In-memory store with the same rules, for unit tests. */
export const createMemoryWebhookStore = () => {
  const rows = new Map<string, NewWebhookEvent & { id: string }>();
  const store: WebhookStore & { rows: typeof rows } = {
    rows,
    record: (event) => {
      const key = `${event.provider}\u0000${event.eventId}`;
      const existing = rows.get(key);
      if (existing && (existing.signatureValid || !event.signatureValid)) {
        return Promise.resolve(null);
      }
      const id = existing?.id ?? crypto.randomUUID();
      rows.set(key, { ...event, id });
      return Promise.resolve({
        id,
        provider: event.provider,
        eventType: event.eventType,
        status: event.status,
      });
    },
  };
  return store;
};
