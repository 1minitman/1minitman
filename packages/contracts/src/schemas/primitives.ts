import { z } from 'zod';

/*
 * Shared primitives (MOD-00 plan section 4.4). A field that maps to a database domain uses the
 * schema of that domain, so the API refuses what PostgreSQL would refuse (1MM-STD-15 section 2.2).
 * The domain rules are checked against the baseline migration by `primitives.test.ts`.
 */

/** Entity id: a UUID v7, as made by `uuid_v7()` (1MM-STD-15 section 2.1). */
export const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const IdSchema = z.string().regex(UUID_V7_PATTERN, 'Expected a UUID v7');
export type Id = z.infer<typeof IdSchema>;

/**
 * Keyset cursor: opaque to clients, sent back exactly as received. Its encoding and the check
 * that it belongs to the list that issued it are the API's (MOD-00-API-04).
 */
export const CursorSchema = z.string().min(1);
export type Cursor = z.infer<typeof CursorSchema>;

/** Domain `usd_cents`: whole US cents, never negative, never a float (1MM-STD-15 section 2.4). */
export const UsdCentsSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export type UsdCents = z.infer<typeof UsdCentsSchema>;

/** Domain `app_locale`. */
export const APP_LOCALES = ['en', 'pcm', 'fr'] as const;
export const AppLocaleSchema = z.enum(APP_LOCALES);
export type AppLocale = z.infer<typeof AppLocaleSchema>;

/** Domain `iso_country`: ISO 3166-1 alpha-2, upper case. */
export const ISO_COUNTRY_PATTERN = /^[A-Z]{2}$/;
export const IsoCountrySchema = z
  .string()
  .regex(ISO_COUNTRY_PATTERN, 'Expected ISO 3166-1 alpha-2');
export type IsoCountry = z.infer<typeof IsoCountrySchema>;

/** Domain `e164`: `+` and 7 to 15 digits. */
export const E164_PATTERN = /^\+[1-9][0-9]{6,14}$/;
export const E164Schema = z.string().regex(E164_PATTERN, 'Expected a phone number in E.164');
export type E164 = z.infer<typeof E164Schema>;

/** Domain `hex_colour`. */
export const HEX_COLOUR_PATTERN = /^#[0-9A-Fa-f]{6}$/;
export const HexColourSchema = z.string().regex(HEX_COLOUR_PATTERN, 'Expected #RRGGBB');
export type HexColour = z.infer<typeof HexColourSchema>;

/** An instant: ISO 8601 in UTC (1MM-STD-15 section 2.3). */
export const TimestampSchema = z.iso.datetime();
export type Timestamp = z.infer<typeof TimestampSchema>;

/** A calendar date with no time, `YYYY-MM-DD` (1MM-STD-15 section 2.3). */
export const CalendarDateSchema = z.iso.date();
export type CalendarDate = z.infer<typeof CalendarDateSchema>;

/** An entity tag, strong or weak (RFC 9110 section 8.8.3). Sent in `ETag`, returned in `If-Match`. */
export const ETAG_PATTERN = /^(W\/)?"[\x21\x23-\x7E]*"$/;
export const ETagSchema = z.string().regex(ETAG_PATTERN, 'Expected an entity tag');
export type ETag = z.infer<typeof ETagSchema>;
