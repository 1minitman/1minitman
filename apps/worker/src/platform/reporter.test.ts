import { afterAll, expect, test } from 'bun:test';
import * as Sentry from '@sentry/bun';
import { createSentryReporter, noopReporter } from './reporter';

test('no DSN means no reporting', async () => {
  const reporter = createSentryReporter({ environment: 'local', release: '0.1.0' });
  expect(reporter).toBe(noopReporter);
  reporter.capture(new Error('ignored'), { job: 'a.b', job_id: '1', attempt: 0 });
  expect(await reporter.flush(10)).toBe(true);
});

const envelopes: string[] = [];
afterAll(() => Sentry.close(100));

test('an error reaches Sentry with the job tags and nothing personal', async () => {
  const reporter = createSentryReporter({
    dsn: 'https://publickey@sentry.example.invalid/1',
    environment: 'staging',
    release: '1.2.3',
    transport: (options) =>
      Sentry.createTransport(options, (request) => {
        envelopes.push(
          typeof request.body === 'string' ? request.body : new TextDecoder().decode(request.body),
        );
        return Promise.resolve({ statusCode: 200 });
      }),
  });
  expect(reporter).not.toBe(noopReporter);
  // Built at run time so the value is not in the source lines Sentry attaches as context.
  const userEmail = ['member', 'example.com'].join('@');
  const failing = (_email: string) => {
    throw new Error('vendor unavailable');
  };
  try {
    failing(userEmail);
  } catch (error) {
    reporter.capture(error, { job: 'billing.sync', job_id: 'abc', attempt: 2 });
  }
  expect(await reporter.flush(2_000)).toBe(true);

  const events = envelopes
    .flatMap((envelope) => envelope.split('\n'))
    .filter((line) => line.startsWith('{'))
    .map((line) => JSON.parse(line) as Record<string, unknown>)
    .filter((item) => 'exception' in item);
  expect(events).toHaveLength(1);
  const event = events[0] as {
    tags: Record<string, unknown>;
    environment: string;
    release: string;
    user?: unknown;
  };
  expect(event.tags).toMatchObject({ job: 'billing.sync', job_id: 'abc', attempt: 2 });
  expect(event.environment).toBe('staging');
  expect(event.release).toBe('1.2.3');
  expect(event.user).toBeUndefined();
  // Local variables of the throwing frame are not collected (`stackFrameVariables: false`).
  expect(envelopes.join('')).not.toContain(userEmail);
});
