import {
  HEADER,
  IdempotencyKeySchema,
  PROBLEM_CODES,
  type ProblemCode,
} from '@1minitman/contracts';
import { PROBLEM_CONTENT_TYPE } from '@1minitman/contracts/routes';
import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { routePath } from 'hono/route';
import type { ContentfulStatusCode, StatusCode } from 'hono/utils/http-status';
import { ProblemError } from '../errors';
import type { AppEnv } from '../http/context';
import type { IdempotencyStore, StoredResponse } from './store';

/*
 * `idempotent()` (MOD-00 plan behaviour 8, rule 6) [TR §8.1], [TR §13.1], [DD §14],
 * [1MM-STD-16 §4]: the first request with an `Idempotency-Key` runs the handler and its response
 * is kept under `idem:{route}:{idempotency_key}` for 24 h; a replay with the same body gets that
 * response without running the handler again; the same key with a different body is 409
 * `idempotency_key_reused`; a replay while the first is still running is 409
 * `idempotency_in_progress` (1MM-STD-13).
 *
 * Fails closed: if the store cannot answer, the request is 503 `dependency_unavailable` and the
 * handler does not run, because running it could run it twice. DEC-002 (fail open) covers the
 * rate limiter only. The durable guard of each write is still in PostgreSQL (1MM-STD-16 §4 rule 3).
 *
 * Attach it per route, after the auth guard, so the principal is part of the fingerprint and a
 * key replayed by someone else is refused instead of answered with another person's response.
 */

/** How long a response is kept for replay [DD §14]. */
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * How long a running request holds its key. Coded default, a **Recommendation** (GAP-MOD00-23):
 * long enough for any handler (outbound calls have their own shorter timeouts), short enough that
 * a crashed instance frees the key within a minute.
 */
export const IDEMPOTENCY_LEASE_MS = 60_000;

/** Longest `Idempotency-Key` read; a UUID is 36 characters, so anything longer is malformed. */
const KEY_MAX_LENGTH = 64;

/** Headers that describe this one exchange, not the stored result, so they are never replayed. */
const NOT_REPLAYED = new Set([
  'x-request-id',
  'set-cookie',
  'date',
  'content-length',
  'retry-after',
  'ratelimit-limit',
  'ratelimit-remaining',
  'ratelimit-reset',
  'ratelimit-policy',
]);

/** CORS headers belong to the caller's origin; the CORS middleware sets them on every response. */
const isReplayed = (name: string) => {
  const lower = name.toLowerCase();
  return !NOT_REPLAYED.has(lower) && !lower.startsWith('access-control-') && lower !== 'vary';
};

export interface IdempotentOptions {
  /** False on a route where the header is optional; a sent key is still honoured. Default true. */
  required?: boolean;
  leaseMs?: number;
  ttlMs?: number;
}

const hex = (bytes: ArrayBuffer) => Buffer.from(bytes).toString('hex');

const fingerprintOf = async (c: Context<AppEnv>, route: string, body: ArrayBuffer) => {
  const principal = c.get('member')?.memberId ?? c.get('admin')?.adminId ?? '';
  const head = new TextEncoder().encode(
    `${route}\n${c.req.path}\n${principal}\n${c.req.header('content-type') ?? ''}\n`,
  );
  const all = new Uint8Array(head.byteLength + body.byteLength);
  all.set(head, 0);
  all.set(new Uint8Array(body), head.byteLength);
  return hex(await crypto.subtle.digest('SHA-256', all));
};

/**
 * Whether a response is the result of running the request, kept for replay. 2xx and 3xx are, and
 * a problem whose retry class is `never` (the same request can never succeed: a conflict, a
 * refusal). Not kept, so the key is freed: 5xx (the transaction rolled back), and problems the
 * client answers by resending, with the same key (`auth` after sign-in or step-up, `backoff` when
 * limited or busy) or after a change (`fix` a field, `refresh` a stale version) [1MM-STD-13 §3].
 */
const isFinal = (status: number, contentType: string | null, body: Uint8Array): boolean => {
  if (status >= 500) return false;
  if (status < 400) return true;
  if (!contentType?.startsWith(PROBLEM_CONTENT_TYPE)) return false;
  try {
    const reason = (JSON.parse(new TextDecoder().decode(body)) as { reason?: unknown }).reason;
    return typeof reason === 'string' && Object.hasOwn(PROBLEM_CODES, reason)
      ? PROBLEM_CODES[reason as ProblemCode].retry === 'never'
      : false;
  } catch {
    return false;
  }
};

const unavailable = () =>
  new ProblemError('dependency_unavailable', {
    detail: 'The request could not be checked for a replay; resend it with the same key.',
  });

export const idempotent = (store: IdempotencyStore, options: IdempotentOptions = {}) => {
  const { required = true, leaseMs = IDEMPOTENCY_LEASE_MS, ttlMs = IDEMPOTENCY_TTL_MS } = options;
  return createMiddleware<AppEnv>(async (c, next) => {
    const raw = c.req.header(HEADER.idempotencyKey);
    if (raw === undefined) {
      if (required) throw new ProblemError('idempotency_key_required');
      return next();
    }
    if (raw.length > KEY_MAX_LENGTH || !IdempotencyKeySchema.safeParse(raw).success) {
      throw new ProblemError('idempotency_key_required', {
        detail: 'Idempotency-Key must be a UUID.',
      });
    }
    // The route pattern of the handler (the last matched route), not the concrete path.
    const route = `${c.req.method} ${routePath(c, -1)}`;
    const key = `idem:${route}:${raw.toLowerCase()}`;
    // Hono keeps the body, so the validator and the handler can still read it afterwards.
    const fingerprint = await fingerprintOf(c, route, await c.req.arrayBuffer());
    const owner = crypto.randomUUID();
    const logger = c.get('logger');

    let begun;
    try {
      begun = await store.begin(key, fingerprint, owner, leaseMs);
    } catch (error) {
      logger.error('idempotency store unavailable', { error: String(error) });
      throw unavailable();
    }

    if (!begun.claimed) {
      const { record } = begun;
      if (record.fingerprint !== fingerprint) throw new ProblemError('idempotency_key_reused');
      if (record.state === 'in_progress') throw new ProblemError('idempotency_in_progress');
      const { status, headers, body } = record.response;
      const replayHeaders = Object.fromEntries(headers);
      // A 204 or 304 has no body (RFC 9110); anything else gets the stored bytes back.
      if (status === 204 || status === 304) {
        return c.body(null, status as StatusCode as 204, replayHeaders);
      }
      return c.body(
        new Uint8Array(Buffer.from(body, 'base64')),
        status as ContentfulStatusCode,
        replayHeaders,
      );
    }

    try {
      await next();
    } catch (error) {
      // Only reached when no error handler turned the error into a response.
      await store.release(key, owner).catch(() => {});
      throw error;
    }

    const bytes = new Uint8Array(await c.res.clone().arrayBuffer());
    const contentType = c.res.headers.get('content-type');
    try {
      if (!isFinal(c.res.status, contentType, bytes)) {
        await store.release(key, owner);
        return;
      }
      const response: StoredResponse = {
        status: c.res.status,
        headers: [...c.res.headers].filter(([name]) => isReplayed(name)),
        body: Buffer.from(bytes).toString('base64'),
      };
      const stored = await store.complete(key, fingerprint, owner, response, ttlMs);
      if (!stored)
        logger.warn('idempotency lease lapsed before the response was stored', { route });
    } catch (error) {
      // The handler has run; its response stands. A replay may run it again, which the
      // write's PostgreSQL guard refuses (1MM-STD-16 §4 rule 3).
      logger.error('idempotency response not stored', { route, error: String(error) });
    }
  });
};
