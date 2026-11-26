import { describe, expect, test } from 'bun:test';
import { readMigrations } from '../test-support/sources';
import {
  IdempotencyKeySchema,
  IfMatchSchema,
  REQUEST_ID_PATTERN,
  RequestIdSchema,
} from './headers';
import {
  APP_LOCALES,
  AppLocaleSchema,
  CalendarDateSchema,
  CursorSchema,
  E164_PATTERN,
  E164Schema,
  ETagSchema,
  HEX_COLOUR_PATTERN,
  HexColourSchema,
  IdSchema,
  ISO_COUNTRY_PATTERN,
  IsoCountrySchema,
  TimestampSchema,
  UsdCentsSchema,
} from './primitives';

const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown) =>
  schema.safeParse(value).success;

describe('domains match the migrations (1MM-STD-15 section 2.2)', () => {
  const sql = readMigrations();
  const domain = (name: string) => {
    const match = new RegExp(`CREATE DOMAIN ${name}\\s+AS[^\\n]*CHECK \\((.*)\\);`).exec(sql);
    if (!match?.[1]) throw new Error(`domain ${name} not found`);
    return match[1];
  };
  const pattern = (name: string) => /VALUE ~ '(.*)'/.exec(domain(name))?.[1];

  test('e164, iso_country and hex_colour use the same pattern', () => {
    expect(pattern('e164')?.replaceAll('\\+', '+')).toBe(
      E164_PATTERN.source.replaceAll('\\+', '+'),
    );
    expect(pattern('iso_country')).toBe(ISO_COUNTRY_PATTERN.source);
    expect(pattern('hex_colour')).toBe(HEX_COLOUR_PATTERN.source);
  });

  test('app_locale lists the same values', () => {
    const values = [...domain('app_locale').matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
    expect(values).toEqual([...APP_LOCALES]);
  });

  test('usd_cents is a non-negative bigint', () => {
    expect(domain('usd_cents')).toBe('VALUE >= 0');
  });
});

describe('primitives', () => {
  test('id is a UUID v7', () => {
    expect(ok(IdSchema, '01938a6e-7c1b-7d2e-8f00-0123456789ab')).toBe(true);
    expect(ok(IdSchema, '01938A6E-7C1B-7D2E-BF00-0123456789AB')).toBe(true);
    expect(ok(IdSchema, '3f1e9d2c-4b5a-4c3d-9e8f-0123456789ab')).toBe(false); // v4
    expect(ok(IdSchema, '01938a6e-7c1b-7d2e-cf00-0123456789ab')).toBe(false); // bad variant
    expect(ok(IdSchema, 'not-a-uuid')).toBe(false);
  });

  test('cursor is an opaque non-empty string', () => {
    expect(ok(CursorSchema, 'eyJpZCI6MX0')).toBe(true);
    expect(ok(CursorSchema, '')).toBe(false);
  });

  test('money is whole, non-negative US cents', () => {
    expect(ok(UsdCentsSchema, 0)).toBe(true);
    expect(ok(UsdCentsSchema, 975)).toBe(true);
    expect(ok(UsdCentsSchema, -1)).toBe(false);
    expect(ok(UsdCentsSchema, 9.75)).toBe(false);
    expect(ok(UsdCentsSchema, '975')).toBe(false);
    expect(ok(UsdCentsSchema, Number.MAX_SAFE_INTEGER + 1)).toBe(false);
  });

  test('locale, country, phone and colour', () => {
    expect(APP_LOCALES.map((l) => ok(AppLocaleSchema, l))).toEqual([true, true, true]);
    expect(ok(AppLocaleSchema, 'de')).toBe(false);
    expect(ok(IsoCountrySchema, 'NG')).toBe(true);
    expect(ok(IsoCountrySchema, 'ng')).toBe(false);
    expect(ok(IsoCountrySchema, 'NGA')).toBe(false);
    expect(ok(E164Schema, '+2348031234567')).toBe(true);
    expect(ok(E164Schema, '+0123456789')).toBe(false);
    expect(ok(E164Schema, '+123456')).toBe(false);
    expect(ok(E164Schema, `+1${'2'.repeat(15)}`)).toBe(false);
    expect(ok(HexColourSchema, '#A1b2C3')).toBe(true);
    expect(ok(HexColourSchema, '#abc')).toBe(false);
  });

  test('timestamps are ISO 8601 UTC; dates are YYYY-MM-DD', () => {
    expect(ok(TimestampSchema, '2026-11-26T08:30:00Z')).toBe(true);
    expect(ok(TimestampSchema, '2026-11-26T08:30:00.123Z')).toBe(true);
    expect(ok(TimestampSchema, '2026-11-26T08:30:00+01:00')).toBe(false);
    expect(ok(TimestampSchema, '2026-11-26')).toBe(false);
    expect(ok(CalendarDateSchema, '2026-02-28')).toBe(true);
    expect(ok(CalendarDateSchema, '2026-02-30')).toBe(false);
  });

  test('ETag and If-Match are entity tags', () => {
    expect(ok(ETagSchema, '"7"')).toBe(true);
    expect(ok(ETagSchema, 'W/"2026-11-26T08:30:00Z"')).toBe(true);
    expect(ok(ETagSchema, '7')).toBe(false);
    expect(ok(ETagSchema, '"a"b"')).toBe(false);
    expect(ok(IfMatchSchema, '"3"')).toBe(true);
  });
});

describe('headers', () => {
  test('Idempotency-Key is a UUID; malformed or oversized keys are refused', () => {
    expect(ok(IdempotencyKeySchema, '3f1e9d2c-4b5a-4c3d-9e8f-0123456789ab')).toBe(true);
    expect(ok(IdempotencyKeySchema, 'abc')).toBe(false);
    expect(ok(IdempotencyKeySchema, `3f1e9d2c-4b5a-4c3d-9e8f-0123456789ab${'0'.repeat(500)}`)).toBe(
      false,
    );
  });

  test('X-Request-Id is 8 to 64 safe characters', () => {
    expect(REQUEST_ID_PATTERN.test('req_12345678')).toBe(true);
    expect(ok(RequestIdSchema, 'short')).toBe(false);
    expect(ok(RequestIdSchema, 'a'.repeat(65))).toBe(false);
    expect(ok(RequestIdSchema, 'has space 123')).toBe(false);
  });
});
