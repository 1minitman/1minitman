import { EnvironmentSchema } from '@1minitman/contracts';
import { z } from 'zod';

const EnvSchema = z.object({
  APP_ENV: EnvironmentSchema.default('local'),
  /** pg-boss holds LISTEN connections and locks: use the direct URL, not a pooler. */
  DATABASE_MIGRATION_URL: z.url().optional(),
  DATABASE_URL: z.url(),
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
  return {
    ...parsed.data,
    queueUrl: parsed.data.DATABASE_MIGRATION_URL ?? parsed.data.DATABASE_URL,
  };
};
