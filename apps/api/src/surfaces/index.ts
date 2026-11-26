import { SURFACES, WEBHOOKS_BASE_PATH, type SurfaceName } from '@1minitman/contracts';
import type { AdminGuards, MemberGuards } from '../platform/auth';
import { createRouter, type Router } from '../platform/http/router';
import type { IdempotencyStore } from '../platform/idempotency';
import type { RateLimits } from '../platform/rate-limit';

/**
 * One router per API surface. A feature module adds its routes to the surface it serves:
 *
 *   member   /v1          member access token          (app, billing web app)
 *   public   /public/v1   no auth, rate limited        (website)
 *   admin    /admin/v1    staff session + permission   (admin console)
 *
 * Build order for every feature: API route here -> admin console -> website -> app.
 * Register module routers inside the matching function below.
 */
/** What modules receive. It grows as modules are added (database, use cases, ...). */
export interface SurfaceDeps {
  /**
   * Policies from `rate_limit_policies` and the Redis limiter. Attach with
   * `rateLimit(deps.rateLimits, '<policy key>')`, or call `checkRateLimit()` from a handler.
   */
  rateLimits: RateLimits;
  /**
   * Route guards. Member routes use `auth.member.requireMember()` (and `requireRecentAuth()` for
   * M+); admin routes use `auth.admin.requireAdmin('<permission key>')`. Attach them per route:
   * sign-in routes on both surfaces stay open.
   */
  auth: { member: MemberGuards; admin: AdminGuards };
  /**
   * Store for `Idempotency-Key` replays. Attach `idempotent(deps.idempotency)` per write route,
   * after the auth guard: required on payments, badge submit, exports, every admin write and every
   * website form (TRX-012). Lists use `defineKeysetList()` (platform/pagination); versioned writes
   * use `requireIfMatch()` and `settleConditionalWrite()` (platform/concurrency).
   */
  idempotency: IdempotencyStore;
}

const builders: Record<SurfaceName, (router: Router, deps: SurfaceDeps) => Router> = {
  member: (router) => router,
  public: (router) => router,
  admin: (router) => router,
};

export const createSurfaceRouter = (name: SurfaceName, deps: SurfaceDeps): Router =>
  builders[name](createRouter().basePath(SURFACES[name].basePath) as Router, deps);

/** Vendor webhooks: signature verified, stored once, never part of a client SDK. */
export const createWebhooksRouter = (_deps: SurfaceDeps): Router =>
  createRouter().basePath(WEBHOOKS_BASE_PATH) as Router;
