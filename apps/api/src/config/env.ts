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

/** `openssl rand -hex 32` gives 64; anything under 32 characters is too easy to guess. */
const ORIGIN_SECRET_MIN_LENGTH = 32;

/** Everything the API reads from the environment, validated once at start-up. */
const EnvSchema = z
  .object({
    /**
     * Required, with no default: a hosted deploy that forgot it would otherwise run as `local`,
     * where `originLock()` refuses nothing (MOD-00 rule 9).
     */
    APP_ENV: EnvironmentSchema,
    APP_VERSION: z.string().default('0.1.0'),
    API_PORT: z.coerce.number().int().default(4000),
    /** Member surface (/v1): the app_api login, subject to row-level security. */
    DATABASE_URL: z.url(),
    /** Admin surface (/admin/v1): the app_admin_api login, bypasses row-level security. */
    ADMIN_DATABASE_URL: z.url(),
    REDIS_URL: z.url(),
    /** Browser origins allowed to call the API (admin console, web app, website). */
    CORS_ALLOWED_ORIGINS: csv,
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    /**
     * The value Cloudflare sends in the origin secret header (`originLock()`, MOD-00 rule 9).
     * Required outside `local`, where the API refuses to start without it.
     */
    ORIGIN_SHARED_SECRET: z.string().default(''),
  })
  .superRefine((env, ctx) => {
    if (env.APP_ENV !== 'local' && env.ORIGIN_SHARED_SECRET.length < ORIGIN_SECRET_MIN_LENGTH) {
      ctx.addIssue({
        code: 'custom',
        path: ['ORIGIN_SHARED_SECRET'],
        message: `required outside local, at least ${ORIGIN_SECRET_MIN_LENGTH} characters (openssl rand -hex 32)`,
      });
    }
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
