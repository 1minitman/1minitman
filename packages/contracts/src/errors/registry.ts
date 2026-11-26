/**
 * The problem-type registry (1MM-STD-13 section 4). One entry per error code: the code is the
 * `reason` member of every problem document, the `type` URI and the i18n key `error.<code>` are
 * built from it. A code is never renamed, reused or removed (1MM-STD-13 section 2.1 rule 3).
 *
 * Adding a code: 1MM-STD-13 section 8. The registry test compares this object with the tables
 * in the standard, so the document and the code cannot drift.
 */

/** Retry classes (1MM-STD-13 section 3). Clients implement the class, not a per-code rule. */
export const RETRY_CLASSES = [
  'never',
  'fix',
  'auth',
  'refresh',
  'after',
  'backoff',
  'upgrade',
] as const;
export type RetryClass = (typeof RETRY_CLASSES)[number];

/** Extension members a problem document may carry (1MM-STD-13 section 2.1). */
export const PROBLEM_EXTENSION_MEMBERS = [
  'errors',
  'entitlement',
  'upsell',
  'permission',
  'retry_after_seconds',
  'until',
  'tries_left',
  'limit',
  'used',
] as const;
export type ProblemExtensionMember = (typeof PROBLEM_EXTENSION_MEMBERS)[number];

/** Where in 1MM-STD-13 section 4 a code is defined. */
export type ProblemCodeGroup = 'platform' | 'auth' | 'domain' | 'admin' | 'webhook';

/** Error codes are lower snake_case (1MM-STD-13 section 2.1 rule 2). */
export const PROBLEM_CODE_PATTERN = /^[a-z][a-z0-9_]{2,48}$/;

export interface ProblemCodeDefinition {
  readonly status: number;
  /** Short English summary for logs and API readers. Never shown to a person as the message. */
  readonly title: string;
  readonly retry: RetryClass;
  readonly group: ProblemCodeGroup;
  /** Extension members the standard says this code always carries. */
  readonly carries: readonly ProblemExtensionMember[];
}

const def = (
  group: ProblemCodeGroup,
  status: number,
  retry: RetryClass,
  title: string,
  carries: readonly ProblemExtensionMember[] = [],
): ProblemCodeDefinition => ({ group, status, retry, title, carries });

export const PROBLEM_CODES = {
  // ---- 4.1 Platform codes (any route)
  bad_request: def('platform', 400, 'never', 'Bad request'),
  validation: def('platform', 422, 'fix', 'Validation failed', ['errors']),
  unauthenticated: def('platform', 401, 'auth', 'Not signed in'),
  session_expired: def('platform', 401, 'auth', 'Session expired'),
  token_reuse: def('platform', 401, 'auth', 'Refresh token reused'),
  reauth_required: def('platform', 403, 'auth', 'Re-authentication required'),
  permission: def('platform', 403, 'never', 'Permission required', ['permission']),
  entitlement: def('platform', 403, 'upgrade', 'Entitlement required', ['entitlement', 'upsell']),
  quota_exhausted: def('platform', 402, 'upgrade', 'Quota exhausted', ['upsell', 'limit', 'used']),
  restricted: def('platform', 403, 'never', 'Account restricted'),
  suspended: def('platform', 403, 'never', 'Account suspended'),
  blocked: def('platform', 403, 'never', 'Blocked'),
  not_found: def('platform', 404, 'never', 'Not found'),
  feature_disabled: def('platform', 404, 'never', 'Feature disabled'),
  precondition_required: def('platform', 428, 'never', 'If-Match required'),
  precondition_failed: def('platform', 412, 'refresh', 'If-Match does not match'),
  idempotency_key_required: def('platform', 400, 'never', 'Idempotency-Key required'),
  idempotency_key_reused: def('platform', 409, 'never', 'Idempotency-Key reused'),
  idempotency_in_progress: def('platform', 409, 'backoff', 'Request in progress'),
  rate_limited: def('platform', 429, 'after', 'Too many requests', ['retry_after_seconds']),
  locked: def('platform', 423, 'after', 'Locked', ['until']),
  payload_too_large: def('platform', 413, 'fix', 'Payload too large'),
  unsupported_media_type: def('platform', 415, 'fix', 'Unsupported media type'),
  maintenance: def('platform', 503, 'after', 'Maintenance', ['retry_after_seconds']),
  dependency_unavailable: def('platform', 503, 'backoff', 'Dependency unavailable'),
  provider_error: def('platform', 502, 'backoff', 'Provider error'),
  provider_timeout: def('platform', 504, 'backoff', 'Provider timeout'),
  internal: def('platform', 500, 'backoff', 'Internal error'),
  expired: def('platform', 410, 'never', 'Expired'),

  // ---- 4.4 Authentication and onboarding (MOD-03)
  invalid_credentials: def('auth', 401, 'fix', 'Invalid credentials'),
  provider_token_invalid: def('auth', 401, 'fix', 'Provider token invalid'),
  code_wrong: def('auth', 422, 'fix', 'Code wrong', ['tries_left']),
  code_expired: def('auth', 410, 'never', 'Code expired'),
  cooldown: def('auth', 409, 'after', 'Cooldown', ['until']),
  channel_unavailable: def('auth', 422, 'fix', 'Channel unavailable'),
  phone_not_linked: def('auth', 422, 'never', 'Phone not linked'),
  integrity_failed: def('auth', 403, 'never', 'Integrity check failed'),
  registration_closed: def('auth', 403, 'never', 'Registration closed'),
  age_gate_blocked: def('auth', 403, 'never', 'Age gate blocked'),
  invite_required: def('auth', 403, 'fix', 'Invite required'),
  market_waitlist: def('auth', 403, 'never', 'Market waitlist'),
  last_method: def('auth', 409, 'never', 'Last sign-in method'),
  already_answered: def('auth', 409, 'refresh', 'Already answered'),
  onboarding_incomplete: def('auth', 409, 'refresh', 'Onboarding incomplete'),
  version_not_current: def('auth', 422, 'refresh', 'Version not current'),

  // ---- 4.5 Domain codes by module
  consent_missing: def('domain', 403, 'fix', 'Consent missing'),
  cap_reached: def('domain', 403, 'never', 'Cap reached'),
  media_not_ready: def('domain', 409, 'backoff', 'Media not ready'),
  upload_mismatch: def('domain', 409, 'fix', 'Upload mismatch'),
  slot_taken: def('domain', 409, 'refresh', 'Slot taken'),
  prompt_already_used: def('domain', 409, 'fix', 'Prompt already used'),
  main_photo_required: def('domain', 409, 'fix', 'Main photo required'),
  nickname_unavailable: def('domain', 409, 'fix', 'Nickname unavailable'),
  already_requested: def('domain', 409, 'refresh', 'Already requested'),
  window_closed: def('domain', 410, 'never', 'Window closed'),
  illegal_state: def('domain', 409, 'refresh', 'Illegal state'),
  already_claimed: def('domain', 409, 'refresh', 'Already claimed'),
  badge_steps_incomplete: def('domain', 409, 'fix', 'Badge steps incomplete'),
  badge_already_submitted: def('domain', 409, 'refresh', 'Badge already submitted'),
  vendor_result_pending: def('domain', 409, 'backoff', 'Vendor result pending'),
  number_in_use: def('domain', 409, 'fix', 'Number in use'),
  payment_required: def('domain', 402, 'upgrade', 'Payment required'),
  nothing_to_undo: def('domain', 409, 'never', 'Nothing to undo'),
  not_pending: def('domain', 409, 'refresh', 'Not pending'),
  already_decided: def('domain', 409, 'refresh', 'Already decided'),
  intro_not_ended: def('domain', 409, 'backoff', 'Intro not ended'),
  conversation_exists: def('domain', 409, 'refresh', 'Conversation exists'),
  conversation_not_live: def('domain', 409, 'never', 'Conversation not live'),
  already_sent: def('domain', 409, 'refresh', 'Already sent'),
  safety_filter: def('domain', 422, 'fix', 'Safety filter'),
  conversation_limit: def('domain', 403, 'upgrade', 'Conversation limit'),
  payment_declined: def('domain', 402, 'fix', 'Payment declined'),
  already_paid: def('domain', 409, 'refresh', 'Already paid'),
  subscription_exists: def('domain', 409, 'refresh', 'Subscription exists'),
  store_billed: def('domain', 409, 'never', 'Store billed'),
  trial_already_used: def('domain', 409, 'never', 'Trial already used'),
  verification_required: def('domain', 403, 'upgrade', 'Verification required'),
  offers_disabled: def('domain', 409, 'never', 'Offers disabled'),
  not_rendered: def('domain', 409, 'backoff', 'Not rendered'),
  category_locked: def('domain', 409, 'never', 'Category locked'),
  group_full: def('domain', 409, 'never', 'Group full'),
  group_paused: def('domain', 409, 'never', 'Group paused'),
  group_banned: def('domain', 403, 'never', 'Group banned'),
  group_role_required: def('domain', 403, 'never', 'Group role required'),
  already_member: def('domain', 409, 'refresh', 'Already member'),
  own_limit_reached: def('domain', 409, 'never', 'Own limit reached'),
  owner_cannot_leave: def('domain', 409, 'never', 'Owner cannot leave'),
  ticket_closed: def('domain', 409, 'never', 'Ticket closed'),
  duplicate: def('domain', 409, 'fix', 'Duplicate'),
  already_published: def('domain', 409, 'never', 'Already published'),
  deletion_state: def('domain', 409, 'refresh', 'Deletion state'),

  // ---- 4.6 Admin step-up and approval. The standard gives no retry class for these four
  // codes; `never` follows from the client behaviour it states (GAP-MOD00-15).
  approval_self: def('admin', 403, 'never', 'Approver is the requester'),
  approval_target_changed: def('admin', 409, 'never', 'Approval target changed'),
  ip_not_allowed: def('admin', 403, 'never', 'IP not allowed'),

  // ---- 4.7 Webhooks
  webhook_signature_invalid: def('webhook', 401, 'never', 'Webhook signature invalid'),
} as const satisfies Record<string, ProblemCodeDefinition>;

export type ProblemCode = keyof typeof PROBLEM_CODES;
export const PROBLEM_CODE_LIST = Object.keys(PROBLEM_CODES) as ProblemCode[];

export const isProblemCode = (value: unknown): value is ProblemCode =>
  typeof value === 'string' && Object.hasOwn(PROBLEM_CODES, value);

/** The `type` member: an identifier, never fetched (1MM-STD-13 section 2.1). */
export const PROBLEM_TYPE_PREFIX = 'tag:1minitman.com,2026:problem:';
export const problemType = (code: ProblemCode): string => `${PROBLEM_TYPE_PREFIX}${code}`;

/** Conditions a client raises itself; never sent by the API (1MM-STD-13 section 4.2). */
export const CLIENT_ERROR_CODES = ['no_connection', 'timeout', 'bad_response'] as const;
export type ClientErrorCode = (typeof CLIENT_ERROR_CODES)[number];

/** Why one field failed inside a `validation` problem (1MM-STD-13 section 4.3). */
export const FIELD_CODES = [
  'required',
  'invalid_format',
  'too_short',
  'too_long',
  'out_of_range',
  'contact_details',
  'reserved',
  'breached',
  'disposable_email',
  'voip_blocked',
  'not_allowed',
  'self',
] as const;
export type FieldCode = (typeof FIELD_CODES)[number];

export const isFieldCode = (value: unknown): value is FieldCode =>
  typeof value === 'string' && (FIELD_CODES as readonly string[]).includes(value);

/** The i18n key of a problem or client code (1MM-STD-13 section 5.2). */
export const errorMessageKey = (code: ProblemCode | ClientErrorCode) => `error.${code}` as const;
/** The i18n key of a field code; its message uses `{label}`, `{min}`, `{max}` (1MM-STD-21). */
export const fieldErrorMessageKey = (code: FieldCode) => `error.field.${code}` as const;
