import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../http/context';
import { problemResponse } from '../http/problem';
import type { RateLimiter } from './rate-limiter';

export interface RateLimitPolicy {
  /** Policy name, as seeded in `rate_limit_policies` (for example "login.ip", "otp.send"). */
  policy: string;
  limit: number;
  windowSeconds: number;
  /** Who is being limited. Defaults to the caller's IP address. */
  subject?: (c: Context<AppEnv>) => string | undefined;
}

/**
 * The caller's address. Production traffic arrives only through Cloudflare, which sets
 * CF-Connecting-IP; it is trustworthy once the origin accepts Cloudflare traffic alone.
 */
export const clientIp = (c: Context<AppEnv>): string =>
  c.req.header('cf-connecting-ip') ??
  c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
  'unknown';

/**
 * Attach to a route or a group of routes:
 *   router.use('/auth/*', rateLimit(limiter, { policy: 'login.ip', limit: 50, windowSeconds: 900 }))
 * Limits come from the product's rate-limit table (Technical Reference 13.3); never invent one.
 * If Redis is unreachable the request is allowed and the failure is logged: an outage of the
 * limiter must not become an outage of the product.
 */
export const rateLimit = (limiter: RateLimiter, policy: RateLimitPolicy) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const subject = policy.subject?.(c) ?? clientIp(c);
    let decision;
    try {
      decision = await limiter.hit(
        `rl:${policy.policy}:${subject}`,
        policy.limit,
        policy.windowSeconds,
      );
    } catch (error) {
      c.get('logger').warn('rate limiter unavailable, allowing request', {
        policy: policy.policy,
        error: error instanceof Error ? error.message : String(error),
      });
      return next();
    }
    c.header('RateLimit-Limit', String(policy.limit));
    c.header('RateLimit-Remaining', String(decision.remaining));
    if (!decision.allowed) {
      c.header('Retry-After', String(decision.retryAfterSeconds));
      return problemResponse(c, 429, 'Too many requests', {
        reason: 'rate_limited',
        retry_after_seconds: decision.retryAfterSeconds,
      });
    }
    return next();
  });
