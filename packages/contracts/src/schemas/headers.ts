import { z } from 'zod';
import { ETagSchema } from './primitives';

/*
 * Request headers shared by every surface (MOD-00 plan section 4.4). Route definitions use these
 * schemas; the middleware that enforces them is MOD-00-API-04.
 */

export const HEADER = {
  idempotencyKey: 'Idempotency-Key',
  ifMatch: 'If-Match',
  requestId: 'X-Request-Id',
  etag: 'ETag',
} as const;

/** `Idempotency-Key`: a UUID made by the client when the action starts (1MM-STD-14, 1MM-STD-16). */
export const IdempotencyKeySchema = z.uuid();

/** `If-Match`: the entity tag the client last read (ADM 1.4). */
export const IfMatchSchema = ETagSchema;

/** `X-Request-Id`: 8 to 64 of `A-Z a-z 0-9 _ -`; anything else is replaced (1MM-STD-13 section 7). */
export const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
export const RequestIdSchema = z.string().regex(REQUEST_ID_PATTERN);

/** Header object fragments for route definitions (header names are matched lower-case). */
export const IdempotencyHeadersSchema = z.object({ 'idempotency-key': IdempotencyKeySchema });
export const IfMatchHeadersSchema = z.object({ 'if-match': IfMatchSchema });
