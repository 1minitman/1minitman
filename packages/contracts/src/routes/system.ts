import { createRoute } from '@hono/zod-openapi';
import { HealthSchema, ReadinessSchema } from '../schemas/system';

export const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  tags: ['System'],
  summary: 'Liveness probe',
  responses: {
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
  responses: {
    200: {
      description: 'Every dependency is reachable.',
      content: { 'application/json': { schema: ReadinessSchema } },
    },
    503: {
      description: 'At least one dependency is down.',
      content: { 'application/json': { schema: ReadinessSchema } },
    },
  },
});
