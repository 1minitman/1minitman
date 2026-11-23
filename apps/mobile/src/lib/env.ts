import { z } from 'zod';

/**
 * Build-time settings, validated when the app boots. Only EXPO_PUBLIC_ names reach the app,
 * and everything in the app bundle can be read by anyone: never add a secret here.
 * Tokens issued at sign-in belong in expo-secure-store (Keychain / Keystore), nowhere else.
 */
const EnvSchema = z.object({
  EXPO_PUBLIC_API_URL: z.url(),
});

// Expo only inlines variables that are written out in full, so each one is listed by name.
const parsed = EnvSchema.safeParse({
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
});
if (!parsed.success) {
  const names = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
  throw new Error(`Missing or invalid settings: ${names}. See .env.example.`);
}

export const env = { apiUrl: parsed.data.EXPO_PUBLIC_API_URL } as const;
