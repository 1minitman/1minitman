import { sql } from 'drizzle-orm';
import { boolean, jsonb, pgTable, smallint, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { TIMESTAMPTZ } from './types';

// Inbound webhooks [TR §12]. Constraints and indexes are owned by the SQL migrations.

/** `webhook_events.provider` CHECK [SQL]. */
export const WEBHOOK_PROVIDERS = [
  'flutterwave',
  'stripe',
  'revenuecat',
  'app_store',
  'google_play',
  'liveness',
  'termii',
  'twilio',
  'whatsapp',
  'resend',
  'daily',
  'carrier',
] as const;
export type WebhookProvider = (typeof WEBHOOK_PROVIDERS)[number];

/** `webhook_events.status` CHECK [SQL]. */
export type WebhookEventStatus = 'received' | 'processing' | 'processed' | 'failed' | 'ignored';

/** Every inbound webhook, stored once: `UNIQUE (provider, event_id)` refuses a duplicate. */
export const webhookEvents = pgTable('webhook_events', {
  id: uuid().primaryKey().default(sql`uuid_v7()`),
  provider: text().$type<WebhookProvider>().notNull(),
  eventId: text('event_id').notNull(),
  eventType: text('event_type').notNull(),
  signatureValid: boolean('signature_valid').notNull(),
  payload: jsonb().notNull(),
  status: text().$type<WebhookEventStatus>().notNull().default('received'),
  attempts: smallint().notNull().default(0),
  lastError: text('last_error'),
  receivedAt: timestamp('received_at', TIMESTAMPTZ).notNull().defaultNow(),
  processedAt: timestamp('processed_at', TIMESTAMPTZ),
  attemptLog: jsonb('attempt_log').notNull().default([]),
});
