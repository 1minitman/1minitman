import { EnvironmentSchema } from '@1minitman/contracts';
import { z } from 'zod';

const EnvSchema = z.object({
  APP_ENV: EnvironmentSchema.default('local'),
  /** Business data, as the app_worker role (no schema changes). */
  WORKER_DATABASE_URL: z.url(),
  /** pg-boss queue, as the app_queue role: owns the pgboss schema and nothing else. Direct connection. */
  QUEUE_DATABASE_URL: z.url(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export const loadEnv = (source: Record<string, string | undefined> = process.env) => {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
    throw new Error(
      `Invalid environment. Check .env.development against .env.example:\n${lines.join('\n')}`,
    );
  }
  return parsed.data;
};
