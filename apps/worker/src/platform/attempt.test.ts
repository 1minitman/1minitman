import { describe, expect, test } from 'bun:test';
import { z } from 'zod';
import { runAttempt, type Attempt } from './attempt';
import { defineJob, type JobContext } from './job';
import { catalogueRow, fakeDeps } from './test-support';

const attempt = (overrides: Partial<Attempt> = {}): Attempt => ({
  id: 'job-1',
  data: {},
  retryCount: 0,
  retryLimit: 2,
  ...overrides,
});

const counting = () => {
  const calls: { payload: object; context: JobContext }[] = [];
  const job = defineJob({
    name: 'test.counting',
    handle: (payload, context) => {
      calls.push({ payload, context });
      return Promise.resolve();
    },
  });
  return { job, calls };
};

const throwing = defineJob({
  name: 'test.throwing',
  handle: () => Promise.reject(new Error('vendor unavailable')),
});

describe('runAttempt()', () => {
  test('an active job runs and completes', async () => {
    const { job, calls } = counting();
    const { deps, logger } = fakeDeps([catalogueRow(job.name)]);
    expect(await runAttempt(job, attempt(), deps)).toEqual({
      status: 'completed',
      outcome: 'done',
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.payload).toEqual({});
    expect(logger.lines.at(-1)?.message).toBe('job done');
  });

  test('a job whose row is inactive is not started (rule 2)', async () => {
    const { job, calls } = counting();
    const { deps, logger } = fakeDeps([catalogueRow(job.name, { isActive: false })]);
    expect(await runAttempt(job, attempt(), deps)).toEqual({
      status: 'completed',
      outcome: 'skipped_inactive',
    });
    expect(calls).toHaveLength(0);
    expect(logger.lines[0]?.message).toContain('not active');
  });

  test('a job with no catalogue row is not started', async () => {
    const { job, calls } = counting();
    const { deps } = fakeDeps([]);
    expect((await runAttempt(job, attempt(), deps)).outcome).toBe('skipped_inactive');
    expect(calls).toHaveLength(0);
  });

  test('the abort signal reaches the handler', async () => {
    const { job, calls } = counting();
    const { deps } = fakeDeps([catalogueRow(job.name)]);
    const controller = new AbortController();
    await runAttempt(job, attempt({ signal: controller.signal }), deps);
    expect(calls[0]?.context.signal).toBe(controller.signal);
  });

  describe('payload schema (REP-038)', () => {
    const received: object[] = [];
    const withPayload = defineJob({
      name: 'test.payload',
      payload: z.strictObject({ userId: z.uuid() }),
      handle: (payload) => {
        received.push(payload);
        return Promise.resolve();
      },
    });
    const userId = '0195f0c2-7b3a-7c3e-9a1b-2c3d4e5f6a7b';

    test('a valid payload is parsed and passed on', async () => {
      const { deps } = fakeDeps([catalogueRow(withPayload.name)]);
      const result = await runAttempt(withPayload, attempt({ data: { userId } }), deps);
      expect(result.status).toBe('completed');
      expect(received.at(-1)).toEqual({ userId });
    });

    test('a malformed payload fails at once, without retry, and is notified', async () => {
      const { deps, reporter, notifier, logger } = fakeDeps([catalogueRow(withPayload.name)]);
      const before = received.length;
      const result = await runAttempt(
        withPayload,
        attempt({ data: { userId: 'not-an-id', phone: '+10000000000' } }),
        deps,
      );
      expect(result).toEqual({ status: 'deadletter', outcome: 'invalid_payload' });
      expect(received).toHaveLength(before);
      expect(notifier.failures).toEqual([
        { job: 'test.payload', jobId: 'job-1', reason: 'invalid_payload' },
      ]);
      expect(reporter.captured[0]?.tags).toEqual({
        job: 'test.payload',
        job_id: 'job-1',
        attempt: 0,
      });
      // Values are never logged, only the paths that failed.
      expect(JSON.stringify(logger.lines)).not.toContain('+10000000000');
      expect(JSON.stringify(logger.lines)).not.toContain('not-an-id');
    });

    test('an absent payload is checked as an empty object', async () => {
      const { deps } = fakeDeps([catalogueRow(withPayload.name)]);
      const result = await runAttempt(withPayload, attempt({ data: null }), deps);
      expect(result.outcome).toBe('invalid_payload');
    });
  });

  test('a failure with retries left is retried and not notified', async () => {
    const { deps, reporter, notifier } = fakeDeps([catalogueRow(throwing.name)]);
    const result = await runAttempt(throwing, attempt({ retryCount: 1, retryLimit: 2 }), deps);
    expect(result).toEqual({ status: 'failed', outcome: 'retry' });
    expect(reporter.captured).toHaveLength(1);
    expect(reporter.captured[0]?.tags.attempt).toBe(1);
    expect(notifier.failures).toHaveLength(0);
  });

  test('the attempt that exhausts the retries raises job.failed (rule 5)', async () => {
    const { deps, notifier, logger } = fakeDeps([catalogueRow(throwing.name)]);
    const result = await runAttempt(throwing, attempt({ retryCount: 2, retryLimit: 2 }), deps);
    expect(result).toEqual({ status: 'failed', outcome: 'exhausted' });
    expect(notifier.failures).toEqual([
      { job: 'test.throwing', jobId: 'job-1', reason: 'retries_exhausted' },
    ]);
    expect(logger.lines.some((line) => line.message === 'job failed: retries exhausted')).toBe(
      true,
    );
  });

  test('a lost notification is logged and reported, and the job still fails', async () => {
    const { deps, reporter, logger } = fakeDeps([catalogueRow(throwing.name)], {
      notifierFails: true,
    });
    const result = await runAttempt(throwing, attempt({ retryCount: 2, retryLimit: 2 }), deps);
    expect(result.outcome).toBe('exhausted');
    expect(reporter.captured).toHaveLength(2);
    expect(logger.lines.at(-1)?.message).toBe('job failure notification not written');
  });

  test('a non-Error throw is reported as well', async () => {
    const odd = defineJob({
      name: 'test.odd',
      handle: () => Promise.reject('plain string'),
    });
    const { deps, reporter, logger } = fakeDeps([catalogueRow(odd.name)]);
    await runAttempt(odd, attempt({ retryLimit: 0 }), deps);
    expect(reporter.captured[0]?.error).toBe('plain string');
    expect(logger.lines.find((line) => line.level === 'error')?.fields?.error).toBe('plain string');
  });

  test('a catalogue read error propagates, so the queue retries the attempt', async () => {
    const { job } = counting();
    const { deps } = fakeDeps([]);
    deps.catalogue = { get: () => Promise.reject(new Error('database down')) };
    await expect(runAttempt(job, attempt(), deps)).rejects.toThrow('database down');
  });
});
