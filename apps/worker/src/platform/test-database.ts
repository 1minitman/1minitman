// Connection settings for the worker's database tests (1MM-STD-01 section 3.2). Away from CI a
// file skips itself when a URL is missing; in CI a missing URL fails the file instead, so the
// database tests can never be skipped silently (GAP-STD01-09).
const ci = !['', 'false', '0'].includes(process.env.CI?.trim().toLowerCase() ?? '');

export const workerUrl = process.env.WORKER_DATABASE_URL;
export const queueUrl = process.env.QUEUE_DATABASE_URL;
export const databaseTestsReady = Boolean(workerUrl && queueUrl);
if (ci && !databaseTestsReady) {
  throw new Error('Worker database tests need WORKER_DATABASE_URL and QUEUE_DATABASE_URL in CI');
}

/** Prefix reserved for catalogue rows that tests insert and delete again. No seed uses it. */
export const TEST_JOB_PREFIX = 'test_wrk_';

/** A catalogue name no seed uses: lower-case letters only, as the `worker_jobs.name` CHECK wants. */
export const testJobName = (action: string) => {
  const letters = crypto
    .randomUUID()
    .replaceAll('-', '')
    .slice(0, 12)
    .replace(/[0-9]/g, (digit) => 'ghijklmnop'[Number(digit)] ?? 'g');
  return `${TEST_JOB_PREFIX}${letters}.${action}`;
};
