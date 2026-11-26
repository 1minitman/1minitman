// Test support for the database behaviour tests (GAP-STD01-09). Away from CI a test file skips
// itself when its connection variables are absent; in CI that would let a mis-configured run pass
// with the database tests never run, so there a missing variable fails the test file instead.

const isCi = (env: Record<string, string | undefined>) => {
  const value = env.CI?.trim().toLowerCase();
  return Boolean(value) && value !== 'false' && value !== '0';
};

/**
 * True when every connection URL is set. When one is missing it returns false, so the caller can
 * `describe.skipIf(!ready)`, except in CI, where it throws and names the missing variables.
 */
export const databaseReady = (
  urls: Record<string, string | undefined>,
  env: Record<string, string | undefined> = process.env,
): boolean => {
  const missing = Object.entries(urls)
    .filter(([, url]) => !url)
    .map(([name]) => name);
  if (missing.length === 0) return true;
  if (isCi(env)) {
    throw new Error(
      `Database tests cannot run in CI: no connection URL for ${missing.join(', ')}. ` +
        'CI copies .env.example to .env.development; check that step and the variables.',
    );
  }
  return false;
};
