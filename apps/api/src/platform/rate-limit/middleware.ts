import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { createHash } from 'node:crypto';
import type { AppEnv } from '../http/context';
import { problemResponse } from '../http/problem';
import type { Logger } from '../logger';
import { failsClosed, type PolicyStore, type RateLimitPolicy } from './policies';
import type { RateLimiter } from './rate-limiter';

/** What every rate-limited route needs: the policies from the table and the limiter. */
export interface RateLimits {
  policies: PolicyStore;
  limiter: RateLimiter;
}

/**
 * The caller's address. Production traffic arrives only through Cloudflare, which sets
 * CF-Connecting-IP; it is trustworthy once the origin accepts Cloudflare traffic alone.
 */
export const clientIp = (c: Context<AppEnv>): string =>
  c.req.header('cf-connecting-ip') ??
  c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
  'unknown';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/** `rl:{policy}:{subject}` and `lock:{policy}:{subject}` [DD §14]. */
export const rateLimitKeys = (policy: string, subject: string) => ({
  counter: `rl:${policy}:${subject}`,
  lock: `lock:${policy}:${subject}`,
});

/**
 * The subject a policy counts, from its scope. `identity` is what the route supplies: the device
 * id for `device`, the number for `phone`, the address for `email`, and the account for
 * `account` or `account_ip` when no one is signed in yet (for example the e-mail typed at an
 * admin sign-in). Without it, `account` uses the signed-in member or staff member, and `ip` the
 * caller's address. Phone numbers, e-mail addresses and `account_ip` pairs are stored hashed, so
 * no direct identifier sits in a Redis key. Returns undefined when the scope cannot be resolved.
 */
export const resolveSubject = (
  policy: Pick<RateLimitPolicy, 'scope'>,
  c: Context<AppEnv>,
  identity?: string,
): string | undefined => {
  const account = identity ?? c.get('member')?.memberId ?? c.get('admin')?.adminId;
  switch (policy.scope) {
    case 'ip':
      return clientIp(c);
    case 'account':
      return account;
    case 'account_ip':
      return account === undefined ? undefined : sha256(`${account}|${clientIp(c)}`);
    case 'device':
      return identity;
    case 'phone':
    case 'email':
      return identity === undefined ? undefined : sha256(identity);
  }
};

export type RateLimitCheck =
  /** No active row for the key: nothing is counted. */
  | { outcome: 'skipped' }
  | { outcome: 'allowed'; policy: RateLimitPolicy; remaining: number }
  | { outcome: 'limited' | 'locked'; policy: RateLimitPolicy; retryAfterSeconds: number }
  /** Redis did not answer: refuse if `refuse` (DEC-002), otherwise let the request through. */
  | { outcome: 'unavailable'; policy: RateLimitPolicy; refuse: boolean };

/**
 * Counts one hit of `policyKey` for `subject` and decides. Handlers that count only some events
 * (MOD-03 counts wrong passwords and codes, not every sign-in) call this directly; routes that
 * count every request use `rateLimit()`. A key with no row, or an inactive row, is not enforced;
 * a missing row is logged as an error because every key in code must be seeded [TR §13.3].
 */
export const checkRateLimit = async (
  rateLimits: RateLimits,
  policyKey: string,
  subject: string,
  logger: Logger,
): Promise<RateLimitCheck> => {
  const policy = rateLimits.policies.get(policyKey);
  if (!policy) {
    logger.error('rate-limit policy is not in rate_limit_policies, not enforced', {
      policy: policyKey,
    });
    return { outcome: 'skipped' };
  }
  if (!policy.isActive) return { outcome: 'skipped' };
  try {
    const decision = await rateLimits.limiter.consume(rateLimitKeys(policy.key, subject), {
      limit: policy.maxRequests,
      windowSeconds: policy.windowSeconds,
      algorithm: policy.algorithm,
      lockoutSeconds: policy.lockoutSeconds,
    });
    if (decision.outcome === 'allowed') {
      return { outcome: 'allowed', policy, remaining: decision.remaining };
    }
    return { outcome: decision.outcome, policy, retryAfterSeconds: decision.retryAfterSeconds };
  } catch (error) {
    const refuse = failsClosed(policy);
    const details = {
      policy: policy.key,
      error: error instanceof Error ? error.message : String(error),
    };
    // Both are alert-worthy (rule 5); a refusal is an error because members are turned away.
    if (refuse) logger.error('rate limiter unavailable, refusing request (fail closed)', details);
    else logger.warn('rate limiter unavailable, allowing request (fail open)', details);
    return { outcome: 'unavailable', policy, refuse };
  }
};

export interface RateLimitOptions {
  /** The identity the policy's scope names; see `resolveSubject`. */
  identity?: (c: Context<AppEnv>) => string | undefined;
}

/**
 * Attach to a route or a group of routes with a key seeded in `rate_limit_policies`:
 *   router.use('/auth/password/login', rateLimit(deps.rateLimits, 'login.ip'))
 * Limits, window, scope, algorithm and lockout come only from the table, and an edit there
 * applies without a restart (MOD-00 plan section 4.3 rule 4). Over the limit: 429 `rate_limited`;
 * during a lockout: 423 `locked` with `until`; Redis down: see `checkRateLimit`. A route whose
 * scope cannot be resolved (no identity, nobody signed in) is a programming error and fails.
 */
export const rateLimit = (
  rateLimits: RateLimits,
  policyKey: string,
  options: RateLimitOptions = {},
) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const logger = c.get('logger');
    const policy = rateLimits.policies.get(policyKey);
    let subject = 'unused';
    if (policy?.isActive) {
      const resolved = resolveSubject(policy, c, options.identity?.(c));
      if (resolved === undefined) {
        throw new Error(`rate-limit policy ${policyKey} (scope ${policy.scope}) has no subject`);
      }
      subject = resolved;
    }
    const check = await checkRateLimit(rateLimits, policyKey, subject, logger);
    switch (check.outcome) {
      case 'skipped':
        return next();
      case 'unavailable':
        return check.refuse ? problemResponse(c, 'dependency_unavailable') : next();
      case 'allowed':
        c.header('RateLimit-Limit', String(check.policy.maxRequests));
        c.header('RateLimit-Remaining', String(check.remaining));
        return next();
      case 'limited':
        c.header('RateLimit-Limit', String(check.policy.maxRequests));
        c.header('RateLimit-Remaining', '0');
        return problemResponse(c, 'rate_limited', {
          retry_after_seconds: check.retryAfterSeconds,
        });
      case 'locked':
        c.header('Retry-After', String(check.retryAfterSeconds));
        return problemResponse(c, 'locked', {
          until: new Date(Date.now() + check.retryAfterSeconds * 1000).toISOString(),
        });
    }
  });
