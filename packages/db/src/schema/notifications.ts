import { sql } from 'drizzle-orm';
import { boolean, jsonb, pgEnum, pgTable, smallint, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { bytea, TIMESTAMPTZ } from './types';

// Notifications [TR §4.2]. Constraints, indexes and foreign keys are owned by the SQL
// migrations; models carry only what queries need: names, types, nullability, defaults.

/** `notif_channel_t` [SQL]. */
export const NOTIFICATION_CHANNELS = ['push', 'email', 'sms', 'whatsapp', 'in_app'] as const;
export const notifChannel = pgEnum('notif_channel_t', NOTIFICATION_CHANNELS);
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

/** `delivery_status_t` [SQL]. */
export const deliveryStatus = pgEnum('delivery_status_t', [
  'queued',
  'batched',
  'throttled',
  'sent',
  'delivered',
  'opened',
  'failed',
  'suppressed',
]);

/** `app_locale` domain [SQL]. */
export const APP_LOCALES = ['en', 'pcm', 'fr'] as const;
export type AppLocale = (typeof APP_LOCALES)[number];

/** `notifications.recipient_kind` CHECK [SQL] (v3.4 W3 / B5). */
export const NOTIFICATION_RECIPIENT_KINDS = [
  'member',
  'waitlist',
  'newsletter',
  'contact',
  'applicant',
  'story_partner',
  'investor_contact',
] as const;
export type NotificationRecipientKind = (typeof NOTIFICATION_RECIPIENT_KINDS)[number];

/**
 * The notification outbox and delivery log [TR §4.2]: rows are written in the same transaction as
 * the change that causes them (`writeOutbox()`), and `notifications.deliver` sends them.
 */
export const notifications = pgTable('notifications', {
  id: uuid().primaryKey().default(sql`uuid_v7()`),
  userId: uuid('user_id'),
  templateCode: text('template_code'),
  channel: notifChannel().notNull(),
  locale: text().$type<AppLocale>().notNull(),
  params: jsonb().notNull().default({}),
  dedupeKey: text('dedupe_key'),
  collapseKey: text('collapse_key'),
  status: deliveryStatus().notNull().default('queued'),
  scheduledFor: timestamp('scheduled_for', TIMESTAMPTZ).notNull().defaultNow(),
  silent: boolean().notNull().default(false),
  provider: text(),
  providerMsgId: text('provider_msg_id'),
  attempts: smallint().notNull().default(0),
  error: text(),
  sentAt: timestamp('sent_at', TIMESTAMPTZ),
  createdAt: timestamp('created_at', TIMESTAMPTZ).notNull().defaultNow(),
  recipientKind: text('recipient_kind')
    .$type<NotificationRecipientKind>()
    .notNull()
    .default('member'),
  recipientEnc: bytea('recipient_enc'),
  recipientHash: bytea('recipient_hash'),
  recipientRefId: uuid('recipient_ref_id'),
  broadcastId: uuid('broadcast_id'),
});
