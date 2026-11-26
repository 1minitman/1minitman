import { recordWebhookEvent, type Database } from '@1minitman/db';
import type { WebhookStore } from './store';

/** `webhook_events` on PostgreSQL through the API's pool (`app_api`). */
export const postgresWebhookStore = (database: Database): WebhookStore => ({
  record: (event) => recordWebhookEvent(database, event),
});
