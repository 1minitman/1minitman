import { ETAG_PATTERN, HEADER } from '@1minitman/contracts';
import type { ConditionalUpdate } from '@1minitman/db';
import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { ProblemError } from '../errors';
import type { AppEnv } from '../http/context';

/*
 * Optimistic concurrency over HTTP (MOD-00 plan behaviour 10, rule 8) [TR §8.1], [ADM §1.4]:
 * a read sends the row version as a strong `ETag`; a write sends it back in `If-Match`; a write
 * without one is 428 `precondition_required`, and one whose tag no longer matches changes nothing
 * and is 412 `precondition_failed` (1MM-STD-13). The version token comes from `versionToken()` and
 * the write from `updateIfMatch()` in `@1minitman/db`.
 */

/** The strong entity tag of a version token. */
export const etagOf = (token: string): string => `"${token}"`;

/** Sends the version of the row just read or written as its `ETag`. */
export const setETag = (c: Context<AppEnv>, token: string): void => {
  c.header(HEADER.etag, etagOf(token));
};

/**
 * Route middleware for a write that must name the version it read. A missing header is 428; a
 * value that is not one entity tag is 422 on `if-match` (a list or `*` never names a version).
 */
export const requireIfMatch = () =>
  createMiddleware<AppEnv>(async (c, next) => {
    const raw = c.req.header(HEADER.ifMatch)?.trim();
    if (!raw) throw new ProblemError('precondition_required');
    if (!ETAG_PATTERN.test(raw)) {
      throw new ProblemError('validation', {
        errors: [{ path: 'if-match', code: 'invalid_format', message: 'Expected one entity tag' }],
      });
    }
    c.set('ifMatch', raw);
    await next();
  });

/**
 * The version token the client expects, from `If-Match`. `If-Match` uses the strong comparison
 * (RFC 9110 section 13.1.1), so a weak tag matches nothing: it comes back as an empty token, which
 * `updateIfMatch()` reports as stale.
 */
export const expectedVersion = (c: Context<AppEnv>): string => {
  const tag = c.get('ifMatch');
  if (tag === undefined) throw new Error('expectedVersion needs requireIfMatch() on the route');
  return tag.startsWith('W/') ? '' : tag.slice(1, -1);
};

/**
 * Turns the outcome of `updateIfMatch()` into the response rule: updated sets the new `ETag` and
 * returns the token; stale is 412 and missing is 404, both with nothing changed.
 */
export const settleConditionalWrite = (c: Context<AppEnv>, result: ConditionalUpdate): string => {
  if (result.outcome === 'missing') throw new ProblemError('not_found');
  if (result.outcome === 'stale') {
    throw new ProblemError('precondition_failed', {
      detail: 'The resource changed since it was read.',
    });
  }
  setETag(c, result.token);
  return result.token;
};
