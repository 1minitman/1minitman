import type { Environment } from '@1minitman/contracts';
import { healthRoute, readinessRoute } from '@1minitman/contracts/routes';
import { createRouter } from '../../../platform/http/router';
import type { CheckReadiness } from '../application/check-readiness';

export interface SystemRouterDeps {
  service: string;
  version: string;
  environment: Environment;
  checkReadiness: CheckReadiness;
}

export const createSystemRouter = (deps: SystemRouterDeps) =>
  createRouter()
    .openapi(healthRoute, (c) =>
      c.json(
        {
          status: 'ok' as const,
          service: deps.service,
          version: deps.version,
          environment: deps.environment,
          time: new Date().toISOString(),
        },
        200,
      ),
    )
    .openapi(readinessRoute, async (c) => {
      const report = await deps.checkReadiness();
      return c.json(report, report.status === 'ready' ? 200 : 503);
    });
