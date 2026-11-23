import { EnvironmentSchema } from '@1minitman/contracts';
import { z } from 'zod';

const csv = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );

/** Everything the API reads from the environment, validated once at start-up. */
const EnvSchema = z.object({
  APP_ENV: EnvironmentSchema.default('local'),
  APP_VERSION: z.string().default('0.1.0'),
  API_PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  /** Browser origins allowed to call the API (admin console, web app, website). */
  CORS_ALLOWED_ORIGINS: csv,
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type Env = z.infer<typeof EnvSchema>;

export const loadEnv = (source: Record<string, string | undefined> = process.env): Env => {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
    throw new Error(
      `Invalid environment. Check .env.development against .env.example:\n${lines.join('\n')}`,
    );
  }
  return parsed.data;
};
