/** Build-time settings. Only VITE_ names exist here; none of them is a secret. */
export const env = {
  apiUrl: (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000',
} as const;
