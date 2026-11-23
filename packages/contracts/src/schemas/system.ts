import { z } from 'zod';

export const EnvironmentSchema = z.enum(['local', 'dev', 'demo', 'staging', 'production']);
export type Environment = z.infer<typeof EnvironmentSchema>;

/** Liveness: the process is up. Never touches a dependency. */
export const HealthSchema = z
  .object({
    status: z.literal('ok'),
    service: z.string(),
    version: z.string(),
    environment: EnvironmentSchema,
    time: z.string(),
  })
  .meta({ id: 'Health' });
export type Health = z.infer<typeof HealthSchema>;

export const DependencyCheckSchema = z.object({
  status: z.enum(['up', 'down']),
  latency_ms: z.number().optional(),
  detail: z.string().optional(),
});

/** Readiness: the dependencies this instance needs to serve traffic. */
export const ReadinessSchema = z
  .object({
    status: z.enum(['ready', 'degraded']),
    checks: z.object({ database: DependencyCheckSchema, redis: DependencyCheckSchema }),
  })
  .meta({ id: 'Readiness' });
export type Readiness = z.infer<typeof ReadinessSchema>;
