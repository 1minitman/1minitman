import { createRoute } from '@hono/zod-openapi';
import { HealthSchema, ReadinessSchema } from '../schemas/system';
import { NO_AUTH, problemResponses, RATE_LIMIT_POLICY_EXTENSION } from './operation';

// Probes are called by the platform's health checks: no credential and no rate-limit policy
// (none of the seeded `rate_limit_policies` names them).

export const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  tags: ['System'],
  summary: 'Liveness probe',
  security: NO_AUTH,
  [RATE_LIMIT_POLICY_EXTENSION]: null,
  responses: {
    ...problemResponses(),
    200: {
      description: 'The service is running.',
      content: { 'application/json': { schema: HealthSchema } },
    },
  },
});

export const readinessRoute = createRoute({
  method: 'get',
  path: '/ready',
  tags: ['System'],
  summary: 'Readiness probe (database and Redis)',
  security: NO_AUTH,
  [RATE_LIMIT_POLICY_EXTENSION]: null,
  responses: {
    ...problemResponses(),
    200: {
      description: 'Every dependency is reachable.',
      content: { 'application/json': { schema: ReadinessSchema } },
    },
    // A probe answers 503 with its own body, not a problem document (1MM-STD-13 section 2.2).
    503: {
      description: 'At least one dependency is down.',
      content: { 'application/json': { schema: ReadinessSchema } },
    },
  },
});
