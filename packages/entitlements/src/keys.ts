/**
 * Entitlement keys seeded in schema v3.4 (table `entitlements`).
 * Keep this list identical to the seed; the API test suite compares the two.
 */
export const ENTITLEMENTS = {
  'discovery.specs_per_day': 'int_or_unlimited',
  'discovery.international': 'bool',
  'discovery.international_countries': 'int',
  'discovery.rewind': 'bool',
  'react.like_somewhat': 'bool',
  'likes.see_who': 'bool',
  'likes.sort_filter': 'bool',
  'intro.one_minute': 'bool',
  'chat.full': 'bool',
  'chat.open_conversations': 'int_or_unlimited',
  'chat.skip_intro': 'bool',
  'chat.message_effects': 'bool',
  'chat.read_receipts': 'bool',
  'direct_specs.per_week': 'int',
  'presence.invisible': 'bool',
  'spotlight.turns_per_week': 'int',
  'spotlight.priority': 'bool',
  'calls.audio_video': 'bool',
  'groups.post': 'bool',
  'groups.own_max': 'int',
  'profile.premium_sections': 'bool',
  'media.photos_max': 'int',
  'media.clips_max': 'int',
  'verification.carrier_check': 'bool',
  'safety.cross_border_briefing': 'bool',
} as const;

export type EntitlementKey = keyof typeof ENTITLEMENTS;
export type EntitlementValueType = (typeof ENTITLEMENTS)[EntitlementKey];

/** `null` means unlimited (only for int_or_unlimited keys). */
export type EntitlementValue = boolean | number | null;

/** What `GET /v1/me/entitlements` returns: one value per key for the member's role. */
export type EntitlementSet = Record<EntitlementKey, EntitlementValue>;

export const ENTITLEMENT_KEYS = Object.keys(ENTITLEMENTS) as EntitlementKey[];
