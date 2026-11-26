import type { ProblemCode } from '@1minitman/contracts';
import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { ProblemError, type ProblemDetails } from '../errors';
import type { AppEnv } from '../http/context';
import { problemResponse } from '../http/problem';
import { clientIp } from '../rate-limit';
import type { AdminPrincipal } from './principals';

/*
 * Admin auth skeleton (MOD-00 plan section 4.1, behaviour 4; [ADM §1.1], [TR §7.1]).
 * `requireAdmin(permission)` runs the authorisation pipeline in the order of [ADM §1.1]
 * (MOD-01 plan section 4.3 rule 1): session live, admin status active, permission held now,
 * scope matches the target, IP allowed, fresh MFA for `requires_reauth` permissions. The first
 * check that refuses ends the request; later checks never run.
 *
 * Every check is a port. MOD-01 (MOD-01-API-02, MOD-01-API-03) supplies the implementations;
 * until then the composition root wires `denyAllAdminAuthPorts()` and every guarded route
 * answers 401. The admin cookie is the only credential: a member token is never accepted here
 * (MOD-01 rule 4), because nothing in this pipeline reads one.
 */

/** What a check sees of the request. Framework-free, so MOD-01 can test checks without Hono. */
export interface AdminRequest {
  method: string;
  /** Path without the query string. */
  path: string;
  headers: Headers;
  /** Caller address, as the rate limiter and origin lock see it. */
  ip: string;
}

/** A refusal: a registry code (1MM-STD-13 sections 4.1 and 4.6) and its extension members. */
export interface AdminRefusal {
  allow: false;
  code: ProblemCode;
  details?: ProblemDetails;
}
export type AdminCheckResult = { allow: true } | AdminRefusal;
export type AdminSessionResult = { allow: true; principal: AdminPrincipal } | AdminRefusal;

export interface AdminCheckInput {
  principal: AdminPrincipal;
  /** The `admin_permissions.key` the route requires. */
  permission: string;
  request: AdminRequest;
}
export type AdminCheck = (input: AdminCheckInput) => Promise<AdminCheckResult>;

export interface AdminAuthPorts {
  /**
   * Resolves the session cookie: `revoked_at IS NULL`, `idle_expires_at > now()`,
   * `expires_at > now()`. Refuse with `unauthenticated` (no or unknown cookie) or
   * `session_expired` (revoked, idle or past absolute expiry).
   */
  session: (request: AdminRequest) => Promise<AdminSessionResult>;
  /** `admin_users.status = 'active'`. */
  status: AdminCheck;
  /** Held now in `v_admin_effective_permissions`; refuse with `permission` and the key. */
  permission: AdminCheck;
  /**
   * The admin's scope matches the target; refuse with `not_found`, never `permission`, so scope
   * cannot be probed. Lists filter by scope in the query instead.
   */
  scope: AdminCheck;
  /** `ip_access_rules` allow-list; refuse with `ip_not_allowed`. */
  ip: AdminCheck;
  /** For `requires_reauth` permissions, MFA verified within the window; else `reauth_required`. */
  reauth: AdminCheck;
}

/** The checks after the session, in pipeline order ([ADM §1.1]). */
export const ADMIN_PIPELINE = ['status', 'permission', 'scope', 'ip', 'reauth'] as const;

const refuse = (code: ProblemCode, details?: ProblemDetails): AdminRefusal => ({
  allow: false,
  code,
  ...(details ? { details } : {}),
});

/** Deny by default: every check refuses with the code its own refusal uses. */
export const denyAllAdminAuthPorts = (): AdminAuthPorts => ({
  session: () => Promise.resolve(refuse('unauthenticated')),
  status: () => Promise.resolve(refuse('suspended')),
  permission: ({ permission }) => Promise.resolve(refuse('permission', { permission })),
  scope: () => Promise.resolve(refuse('not_found')),
  ip: () => Promise.resolve(refuse('ip_not_allowed')),
  reauth: () => Promise.resolve(refuse('reauth_required')),
});

const adminRequest = (c: Context<AppEnv>): AdminRequest => ({
  method: c.req.method,
  path: c.req.path,
  headers: c.req.raw.headers,
  ip: clientIp(c),
});

export interface AdminGuards {
  /** Runs the pipeline for `permission` and puts the principal in context (`currentAdmin(c)`). */
  requireAdmin: (permission: string) => ReturnType<typeof createMiddleware<AppEnv>>;
}

export const createAdminGuards = (ports: AdminAuthPorts): AdminGuards => ({
  requireAdmin: (permission) => {
    if (!permission) throw new Error('requireAdmin needs a permission key');
    return createMiddleware<AppEnv>(async (c, next) => {
      const request = adminRequest(c);
      const session = await ports.session(request);
      if (!session.allow) return problemResponse(c, session.code, session.details);

      const input: AdminCheckInput = { principal: session.principal, permission, request };
      for (const step of ADMIN_PIPELINE) {
        const result = await ports[step](input);
        if (!result.allow) return problemResponse(c, result.code, result.details);
      }
      c.set('admin', session.principal);
      return next();
    });
  },
});

/** The admin `requireAdmin()` put in context. Throws 401 on a route without the guard. */
export const currentAdmin = (c: Context<AppEnv>): AdminPrincipal => {
  const principal = c.get('admin');
  if (!principal) throw new ProblemError('unauthenticated');
  return principal;
};
