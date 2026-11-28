/**
 * The logger's redaction backstop (MOD-00 plan section 4.1 behaviour 16, GAP-STD16-05, REP-035).
 * The method is not passing the value (1MM-STD-16 section 11); this catches the slip.
 *
 * A field is dropped when one word of its name is sensitive: the name is split on anything that
 * is not a letter or digit and on camelCase, so `access_token`, `refreshToken`, `Set-Cookie` and
 * `recovery_code` all match, unless the name ends in `id`, `ids` or `count` (`phone_number_id`,
 * `otp_challenge_id`: log ids, not values). The words come from [TR §14] (message bodies, passwords, codes,
 * tokens, face data, card data) and 1MM-STD-16 section 11 (e-mail addresses, phone numbers, birth
 * dates, precise location, request and response bodies, query strings, vendor payloads,
 * `Authorization` and `Cookie`). Log a registry code as `reason` and an HTTP status as `status`:
 * a field named `code` is always dropped.
 *
 * String values anywhere are also scrubbed of bearer credentials, JSON Web Tokens and e-mail
 * addresses, so an error message that quotes one does not carry it into the log.
 *
 * The worker keeps a copy (`apps/worker/src/platform/redact.ts`); change both together.
 */

export const REDACTED = '[redacted]';

const SENSITIVE_WORDS = new Set([
  // [TR §14]
  'body',
  'password',
  'passwd',
  'passphrase',
  'code',
  'codes',
  'otp',
  'pin',
  'token',
  'tokens',
  'jwt',
  'secret',
  'face',
  'selfie',
  'biometric',
  'card',
  'pan',
  'cvv',
  'cvc',
  // 1MM-STD-16 section 11
  'authorization',
  'cookie',
  'cookies',
  'email',
  'phone',
  'msisdn',
  'e164',
  'birth',
  'birthdate',
  'dob',
  'latitude',
  'longitude',
  'lat',
  'lng',
  'location',
  'query',
  'payload',
]);

/** Word pairs that name a credential although neither word does alone. */
const SENSITIVE_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['api', 'key'],
  ['private', 'key'],
  ['secret', 'key'],
  ['access', 'key'],
  ['session', 'key'],
];

const words = (key: string): string[] =>
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/** A name ending in one of these words carries a reference or a number, not the value. */
const SAFE_LAST_WORDS = new Set(['id', 'ids', 'count']);

/** True when a field of this name must never be logged. */
export const isSensitiveKey = (key: string): boolean => {
  const parts = words(key);
  if (parts.length > 1 && SAFE_LAST_WORDS.has(parts[parts.length - 1] ?? '')) return false;
  if (parts.some((part) => SENSITIVE_WORDS.has(part))) return true;
  // `apikey`, `privatekey` written as one word.
  if (parts.some((part) => SENSITIVE_PAIRS.some(([a, b]) => part === `${a}${b}`))) return true;
  return parts.some((part, i) =>
    SENSITIVE_PAIRS.some(([a, b]) => part === a && parts[i + 1] === b),
  );
};

const VALUE_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, `Bearer ${REDACTED}`],
  [/\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g, REDACTED],
  [/[^\s@"'<>(),;:]+@[^\s@"'<>(),;:]+\.[A-Za-z]{2,}/g, REDACTED],
];

/** Scrubs credentials and e-mail addresses out of free text. */
export const redactText = (text: string): string =>
  VALUE_PATTERNS.reduce((out, [pattern, replacement]) => out.replace(pattern, replacement), text);

const MAX_DEPTH = 8;

const hasToJSON = (value: object): value is { toJSON: () => unknown } =>
  typeof (value as { toJSON?: unknown }).toJSON === 'function';

const redactValue = (value: unknown, depth: number, seen: WeakSet<object>): unknown => {
  if (typeof value === 'string') return redactText(value);
  if (value instanceof Error) {
    return { name: value.name, message: redactText(value.message) };
  }
  if (value === null || typeof value !== 'object' || value instanceof Date) return value;
  // Any other object is walked too, not only plain ones: `JSON.stringify` writes a class
  // instance's own fields and whatever `toJSON()` returns (a `URL`, a vendor SDK object), so
  // passing them through unwalked would log a `password` field verbatim.
  if (seen.has(value)) return '[circular]';
  if (depth >= MAX_DEPTH) return '[truncated]';
  if (!Array.isArray(value) && hasToJSON(value)) {
    seen.add(value);
    const out = redactValue(value.toJSON(), depth + 1, seen);
    seen.delete(value);
    return out;
  }
  seen.add(value);
  const out = Array.isArray(value)
    ? value.map((item) => redactValue(item, depth + 1, seen))
    : redactFieldsAt(value as Record<string, unknown>, depth + 1, seen);
  seen.delete(value);
  return out;
};

const redactFieldsAt = (
  fields: Record<string, unknown>,
  depth: number,
  seen: WeakSet<object>,
): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    out[key] = isSensitiveKey(key) ? REDACTED : redactValue(value, depth, seen);
  }
  return out;
};

/** A copy of `fields` that is safe to log; the input is not changed. */
export const redactFields = (fields: Record<string, unknown>): Record<string, unknown> =>
  redactFieldsAt(fields, 0, new WeakSet());
