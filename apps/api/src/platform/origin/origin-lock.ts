import type { Environment } from '@1minitman/contracts';
import { createMiddleware } from 'hono/factory';
import { createHash, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import type { AppEnv } from '../http/context';
import { problemResponse } from '../http/problem';

/**
 * The header Cloudflare adds to every proxied request with `ORIGIN_SHARED_SECRET` as its value
 * (a Transform Rule, `.env.example`). The sources name the secret but not the header:
 * **Recommendation** in GAP-MOD00-37.
 */
export const ORIGIN_SECRET_HEADER = 'X-Origin-Secret';

/** The address of the person calling, set by Cloudflare at its edge [TR §13.1]. */
export const CLIENT_IP_HEADER = 'CF-Connecting-IP';

export interface OriginLockOptions {
  appEnv: Environment;
  /** `ORIGIN_SHARED_SECRET`; required by `loadEnv` outside `local`. */
  secret: string;
}

const digest = (value: string) => createHash('sha256').update(value).digest();

/** Constant-time comparison; hashing first gives both sides the same length. */
const sameSecret = (presented: string, expected: string) =>
  timingSafeEqual(digest(presented), digest(expected));

/**
 * Origin lock (MOD-00 plan section 4.1 behaviour 11, section 4.3 rule 9, [TR §4.3], [TR §13.1]).
 *
 * Outside `local`, a request is served only when it carries the origin secret header with the
 * value of `ORIGIN_SHARED_SECRET` and a valid `CF-Connecting-IP`, which together show that it came
 * through Cloudflare. Anything else is refused with 404 `not_found`, so a direct caller learns
 * nothing about the origin, and the refusal is logged without the presented value. The client IP
 * is then taken from `CF-Connecting-IP` and nowhere else (GAP-MOD00-36): `X-Forwarded-For` is
 * written by whoever sends the request.
 *
 * In `local` nothing is refused, and with no `CF-Connecting-IP` the first `X-Forwarded-For`
 * address stands in, so local tools can simulate callers.
 *
 * The Cloudflare IP-range check of behaviour 11 is not built here: behind the host's proxy the
 * origin does not see Cloudflare's address (GAP-MOD00-37).
 */
export const originLock = ({ appEnv, secret }: OriginLockOptions) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const cfIp = c.req.header(CLIENT_IP_HEADER)?.trim();
    if (appEnv === 'local') {
      const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
      c.set('clientIp', cfIp || forwarded || 'unknown');
      return next();
    }

    const presented = c.req.header(ORIGIN_SECRET_HEADER);
    let refusal: 'origin_secret' | 'client_ip' | undefined;
    if (presented === undefined || secret === '' || !sameSecret(presented, secret)) {
      refusal = 'origin_secret';
    } else if (!cfIp || isIP(cfIp) === 0) {
      refusal = 'client_ip';
    }
    if (refusal) {
      c.get('logger').warn('request refused: did not come through Cloudflare', {
        reason: refusal,
        method: c.req.method,
        path: c.req.path,
      });
      return problemResponse(c, 'not_found');
    }
    c.set('clientIp', cfIp);
    return next();
  });
