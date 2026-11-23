/** Build-time settings. Only EXPO_PUBLIC_ names exist in the app; none of them is a secret. */
export const env = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000',
} as const;
