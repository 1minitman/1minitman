import {
  notifications,
  type AppLocale,
  type NotificationChannel,
  type NotificationRecipientKind,
} from './schema/notifications';
import type { Tx } from './transactions';

// Outbox write helper [TR §4.2], [1MM-DB-03] (transaction rules): a notification is a row written in the
// same transaction as the change that causes it, never a call to a provider from inside the
// transaction. The job `notifications.deliver` sends the rows. Outbound partner webhooks are not
// in v1 (1MM-ADR-0051), so the notification outbox is the only one.

/** A member of the app: the row carries `user_id` and RLS-owned data stays with the member. */
export interface MemberRecipient {
  kind: 'member';
  userId: string;
}

/**
 * Someone who is not a member (waitlist, newsletter, contact, ...): the address is stored
 * encrypted with its SHA-256 hash, and only e-mail, SMS and WhatsApp can reach them
 * (`ck_notifications_recipient`) [SQL].
 */
export interface OtherRecipient {
  kind: Exclude<NotificationRecipientKind, 'member'>;
  /** The encrypted address (`recipient_enc`). */
  addressEncrypted: Uint8Array;
  /** SHA-256 of the normalised address (`recipient_hash`, 32 bytes). */
  addressHash: Uint8Array;
  /** The row the recipient came from (`recipient_ref_id`), when there is one. */
  sourceId?: string;
  channel: 'email' | 'sms' | 'whatsapp';
}

interface OutboxFields {
  locale: AppLocale;
  /** Values the template interpolates. Never a secret: the row is kept 90 days. */
  params?: Record<string, unknown>;
  /** One row per recipient and key: a second write with the same key is dropped. */
  dedupeKey?: string;
  /** Messages with the same key are collapsed into one by the delivery job (per thread). */
  collapseKey?: string;
  /** Not before this time; default now. */
  scheduledFor?: Date;
  /** Delivered without sound (quiet hours). */
  silent?: boolean;
}

/** What produced the message: a catalogue template, a broadcast, or both [SQL ck_notifications_source]. */
type OutboxSource =
  | { templateCode: string; broadcastId?: string }
  | { templateCode?: undefined; broadcastId: string };

export type OutboxNotification = OutboxFields &
  OutboxSource &
  (
    | { recipient: MemberRecipient; channel: NotificationChannel }
    | { recipient: OtherRecipient; channel?: undefined }
  );

export interface OutboxWriteResult {
  /** Ids of the rows written; a row dropped by its dedupe key is left out. */
  ids: string[];
  /** How many rows a dedupe key dropped. */
  deduplicated: number;
}

const SHA256_BYTES = 32;

/** Raised when a notification breaks a rule the table also enforces, before it reaches the database. */
export class OutboxInputError extends Error {
  override readonly name = 'OutboxInputError';
}

const toRow = (n: OutboxNotification): typeof notifications.$inferInsert => {
  if (n.templateCode === undefined && n.broadcastId === undefined) {
    throw new OutboxInputError('An outbox notification needs a template code or a broadcast id');
  }
  const common = {
    templateCode: n.templateCode ?? null,
    broadcastId: n.broadcastId ?? null,
    locale: n.locale,
    params: n.params ?? {},
    dedupeKey: n.dedupeKey ?? null,
    collapseKey: n.collapseKey ?? null,
    silent: n.silent ?? false,
    ...(n.scheduledFor ? { scheduledFor: n.scheduledFor } : {}),
  };
  if (n.recipient.kind === 'member') {
    return {
      ...common,
      recipientKind: 'member',
      userId: n.recipient.userId,
      channel: n.channel as NotificationChannel,
    };
  }
  const r = n.recipient;
  if (r.addressHash.byteLength !== SHA256_BYTES) {
    throw new OutboxInputError('recipient addressHash must be a 32-byte SHA-256 digest');
  }
  if (r.addressEncrypted.byteLength === 0) {
    throw new OutboxInputError('recipient addressEncrypted must not be empty');
  }
  return {
    ...common,
    recipientKind: r.kind,
    userId: null,
    channel: r.channel,
    recipientEnc: r.addressEncrypted,
    recipientHash: r.addressHash,
    recipientRefId: r.sourceId ?? null,
  };
};

/**
 * Writes notifications into the outbox inside the caller's transaction (`withMemberTx`,
 * `withAdminTx` or `withWorkerTx`), so they commit or roll back with the change that caused
 * them. A row whose dedupe key was already used for that recipient is dropped, not an error.
 */
export const writeOutbox = async (
  tx: Tx,
  input: OutboxNotification | readonly OutboxNotification[],
): Promise<OutboxWriteResult> => {
  const list: readonly OutboxNotification[] = Array.isArray(input)
    ? input
    : [input as OutboxNotification];
  if (list.length === 0) return { ids: [], deduplicated: 0 };
  const rows = list.map(toRow);
  // No conflict target: both partial unique indexes (member and non-member dedupe) apply.
  const written = await tx
    .insert(notifications)
    .values(rows)
    .onConflictDoNothing()
    .returning({ id: notifications.id });
  return { ids: written.map((w) => w.id), deduplicated: rows.length - written.length };
};
