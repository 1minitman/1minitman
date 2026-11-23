import { SURFACES, SURFACE_NAMES, type SurfaceName } from '@1minitman/contracts';
import { Scalar } from '@scalar/hono-api-reference';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import type { Env } from './config/env';
import { createSystemRouter, type CheckReadiness } from './modules/system';
import { requestContext } from './platform/http/middleware';
import { errorHandler, notFoundHandler } from './platform/http/problem';
import { createRouter } from './platform/http/router';
import type { Logger } from './platform/logger';
import { createSurfaceRouter, createWebhooksRouter, type SurfaceDeps } from './surfaces';

export interface AppDeps {
  env: Pick<Env, 'APP_ENV' | 'APP_VERSION' | 'CORS_ALLOWED_ORIGINS'>;
  logger: Logger;
  checkReadiness: CheckReadiness;
  surfaces: SurfaceDeps;
}

const SERVICE = '1minitman-api';

/** OpenAPI document for one surface: its own routes plus the shared system routes. */
export const buildOpenApiDocument = (deps: AppDeps, surface: SurfaceName) =>
  createRouter()
    .route('/', systemRouter(deps))
    .route('/', createSurfaceRouter(surface, deps.surfaces))
    .getOpenAPI31Document({
      openapi: '3.1.0',
      info: { title: SURFACES[surface].title, version: deps.env.APP_VERSION },
    });

const systemRouter = (deps: AppDeps) =>
  createSystemRouter({
    service: SERVICE,
    version: deps.env.APP_VERSION,
    environment: deps.env.APP_ENV,
    checkReadiness: deps.checkReadiness,
  });

/** Composition root for HTTP: pure function of its dependencies, so tests can build an app in memory. */
export const createApp = (deps: AppDeps) => {
  const app = createRouter();
  const surfaceDeps = deps.surfaces;

  app.use('*', requestContext(deps.logger));
  app.use('*', secureHeaders());
  app.use(
    '*',
    cors({
      origin: deps.env.CORS_ALLOWED_ORIGINS,
      credentials: true,
      allowHeaders: [
        'Content-Type',
        'Authorization',
        'Idempotency-Key',
        'If-Match',
        'X-Request-Id',
      ],
      exposeHeaders: ['X-Request-Id', 'ETag'],
      maxAge: 600,
    }),
  );
  app.onError(errorHandler);
  app.notFound(notFoundHandler);

  app.route('/', systemRouter(deps));
  for (const name of SURFACE_NAMES) app.route('/', createSurfaceRouter(name, surfaceDeps));
  app.route('/', createWebhooksRouter(surfaceDeps));

  // API reference: never served in production.
  if (deps.env.APP_ENV !== 'production') {
    for (const name of SURFACE_NAMES) {
      app.get(`/openapi/${name}.json`, (c) => c.json(buildOpenApiDocument(deps, name)));
    }
    app.get(
      '/docs',
      Scalar({
        sources: SURFACE_NAMES.map((name) => ({
          title: SURFACES[name].title,
          url: `/openapi/${name}.json`,
        })),
      }),
    );
  }
  return app;
};
