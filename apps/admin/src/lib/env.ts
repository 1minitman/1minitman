import { z } from 'zod';

/**
 * Build-time settings, validated when the app boots. Only VITE_ names reach the browser,
 * and everything in the bundle is public: never add a secret here.
 */
const EnvSchema = z.object({
  VITE_API_URL: z.url(),
});

const parsed = EnvSchema.safeParse(import.meta.env);
if (!parsed.success) {
  const names = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
  throw new Error(`Missing or invalid settings: ${names}. See .env.example.`);
}

export const env = { apiUrl: parsed.data.VITE_API_URL } as const;
