import { SURFACES, WEBHOOKS_BASE_PATH, type SurfaceName } from '@1minitman/contracts';
import type { MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../http/context';
import { problemResponse } from '../http/problem';

const KIB = 1024;
const MIB = 1024 * KIB;

/**
 * Largest request body per surface, in bytes (MOD-00 plan section 4.1 behaviour 12,
 * [TR §13.1] "body-size limits per surface"). The sources give no numbers: these are
 * **Recommendation** values in GAP-MOD00-37, to move into `remote_config` with the other
 * timeouts and limits. Media never travels through the API (presigned PUT into
 * `media-quarantine`, behaviour 14), so every body is JSON or a vendor event.
 *
 * `webhooks` is the cap GAP-MOD00-35 asks for; that gap stays open for the owner's value and the
 * webhook rate-limit policy.
 */
export const BODY_LIMITS: Readonly<Record<SurfaceName | 'webhooks' | 'other', number>> = {
  member: 1 * MIB,
  admin: 1 * MIB,
  /** Website forms only [WEB §5.10]. */
  public: 64 * KIB,
  webhooks: 1 * MIB,
  /** `/health`, `/ready`, the WebSocket upgrade, `/docs`: none takes a body. */
  other: 64 * KIB,
};

/** The largest of all limits, for the server's own cap (`maxRequestBodySize` in `Bun.serve`). */
export const MAX_BODY_BYTES = Math.max(...Object.values(BODY_LIMITS));

const PREFIXES: ReadonlyArray<readonly [string, keyof typeof BODY_LIMITS]> = [
  [SURFACES.admin.basePath, 'admin'],
  [SURFACES.public.basePath, 'public'],
  [SURFACES.member.basePath, 'member'],
  [WEBHOOKS_BASE_PATH, 'webhooks'],
];

/** Which limit a path falls under. `/v1` is tested after `/public/v1` and `/admin/v1`. */
export const bodyLimitFor = (
  path: string,
  limits: Readonly<Record<keyof typeof BODY_LIMITS, number>> = BODY_LIMITS,
): number => {
  for (const [prefix, name] of PREFIXES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return limits[name];
  }
  return limits.other;
};

/**
 * Refuses a body over its surface's limit with 413 `payload_too_large`, carrying the limit in
 * bytes as `limit` (1MM-STD-13 section 4.1: "say the limit"). The declared `Content-Length` is
 * checked first; a chunked body is counted as it streams and refused as soon as it passes the
 * limit, so an oversized body is never read whole.
 */
export const bodyLimits = (
  limits: Readonly<Record<keyof typeof BODY_LIMITS, number>> = BODY_LIMITS,
): MiddlewareHandler<AppEnv> => {
  const handlers = new Map<number, MiddlewareHandler<AppEnv>>();
  for (const maxSize of new Set(Object.values(limits))) {
    handlers.set(
      maxSize,
      bodyLimit({
        maxSize,
        onError: (c) => problemResponse(c, 'payload_too_large', { limit: maxSize }),
      }),
    );
  }
  return createMiddleware<AppEnv>((c, next) =>
    handlers.get(bodyLimitFor(c.req.path, limits))!(c, next),
  );
};
