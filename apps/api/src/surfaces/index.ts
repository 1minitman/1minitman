import { SURFACES, WEBHOOKS_BASE_PATH, type SurfaceName } from '@1minitman/contracts';
import { createRouter, type Router } from '../platform/http/router';
import type { RateLimiter } from '../platform/rate-limit';

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
  /** Redis-backed limiter. Use it with rateLimit() on auth, billing and form routes. */
  rateLimiter: RateLimiter;
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
