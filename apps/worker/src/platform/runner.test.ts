import { describe, expect, test } from 'bun:test';
import type { JobResult, JobWithMetadata } from 'pg-boss';
import { defineJob } from './job';
import {
  CatalogueMismatchError,
  RETRY_POLICY,
  runNow,
  RunNowRefusedError,
  startRunner,
  syncSchedules,
  type Queue,
} from './runner';
import { catalogueRow, fakeDeps, memoryCatalogue } from './test-support';

type Handler = (batch: Partial<JobWithMetadata>[]) => Promise<JobResult[]>;

/** Records every pg-boss call; `existing` names queues that already exist. */
const fakeQueue = (existing: string[] = []) => {
  const calls: unknown[][] = [];
  const handlers = new Map<string, Handler>();
  const record =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push([name, ...args]);
      return Promise.resolve();
    };
  const queue = {
    createQueue: record('createQueue'),
    updateQueue: record('updateQueue'),
    getQueue: (name: string) => Promise.resolve(existing.includes(name) ? { name } : null),
    work: (name: string, options: unknown, handler: Handler) => {
      calls.push(['work', name, options]);
      handlers.set(name, handler);
      return Promise.resolve('worker-id');
    },
    schedule: record('schedule'),
    unschedule: record('unschedule'),
    send: (name: string, data: unknown) => {
      calls.push(['send', name, data]);
      return Promise.resolve('sent-id');
    },
  } as unknown as Queue;
  return { queue, calls, handlers };
};

const ok = defineJob({ name: 'test.ok', handle: () => Promise.resolve() });
const other = defineJob({ name: 'test.other', handle: () => Promise.resolve() });

describe('startRunner()', () => {
  test('refuses to start when a handler has no catalogue row', async () => {
    const { deps } = fakeDeps([]);
    const { queue } = fakeQueue();
    await expect(
      startRunner(queue, [ok], { ...deps, catalogue: memoryCatalogue([]), pending: [] }),
    ).rejects.toBeInstanceOf(CatalogueMismatchError);
  });

  test('refuses to start when a job is registered twice', async () => {
    const rows = [catalogueRow(ok.name)];
    const { deps } = fakeDeps(rows);
    const { queue } = fakeQueue();
    await expect(
      startRunner(queue, [ok, ok], { ...deps, catalogue: memoryCatalogue(rows), pending: [] }),
    ).rejects.toThrow(/duplicated \[test\.ok\]/);
  });

  test('creates or updates each queue with backoff, works it and applies the schedule', async () => {
    const rows = [
      catalogueRow(ok.name, { cron: '0 3 1 * *' }),
      catalogueRow(other.name, { cron: '0 * * * *', isActive: false }),
      catalogueRow('test.unclaimed'),
    ];
    const { deps, logger } = fakeDeps(rows);
    const { queue, calls, handlers } = fakeQueue([other.name]);
    await startRunner(queue, [ok, other], {
      ...deps,
      catalogue: memoryCatalogue(rows),
      pending: [],
      pollingIntervalSeconds: 1,
    });
    expect(calls).toEqual([
      ['createQueue', ok.name, RETRY_POLICY],
      ['work', ok.name, { includeMetadata: true, perJobResults: true, pollingIntervalSeconds: 1 }],
      ['updateQueue', other.name, RETRY_POLICY],
      [
        'work',
        other.name,
        { includeMetadata: true, perJobResults: true, pollingIntervalSeconds: 1 },
      ],
      ['schedule', ok.name, '0 3 1 * *', undefined, { tz: 'UTC' }],
      ['unschedule', other.name],
    ]);
    expect(logger.lines.find((line) => line.level === 'warn')?.fields).toEqual({
      jobs: ['test.unclaimed'],
    });
    expect(logger.lines.at(-1)?.fields).toEqual({
      jobs: [ok.name, other.name],
      scheduled: [ok.name],
      pending: 0,
    });

    // The registered handler settles each job of a batch on its own.
    const handler = handlers.get(other.name);
    const results = await handler?.([
      { id: 'a', data: {}, retryCount: 0, retryLimit: 2 },
      { id: 'b', data: {}, retryCount: 0, retryLimit: 2 },
    ]);
    // `other` is inactive in the catalogue: both are completed without running.
    expect(results).toEqual([
      { id: 'a', status: 'completed' },
      { id: 'b', status: 'completed' },
    ]);
  });

  test('works with the pg-boss polling default when none is given', async () => {
    const rows = [catalogueRow(ok.name)];
    const { deps } = fakeDeps(rows);
    const { queue, calls } = fakeQueue();
    await startRunner(queue, [ok], { ...deps, catalogue: memoryCatalogue(rows), pending: [] });
    expect(calls[1]).toEqual(['work', ok.name, { includeMetadata: true, perJobResults: true }]);
  });
});

test('syncSchedules() schedules only active rows with a cron', async () => {
  const { queue, calls } = fakeQueue();
  const scheduled = await syncSchedules(
    queue,
    [ok, other],
    [catalogueRow(ok.name, { cron: '*/5 * * * *' }), catalogueRow(other.name)],
  );
  expect(scheduled).toEqual([ok.name]);
  expect(calls).toEqual([
    ['schedule', ok.name, '*/5 * * * *', undefined, { tz: 'UTC' }],
    ['unschedule', other.name],
  ]);
});

describe('runNow() (rule 3)', () => {
  const catalogue = memoryCatalogue([
    catalogueRow('test.safe', { runNowAllowed: true }),
    catalogueRow('test.unsafe'),
    catalogueRow('test.destructive', { isDestructive: true, runNowAllowed: true }),
    catalogueRow('test.off', { runNowAllowed: true, isActive: false }),
  ]);

  test('sends a job with an empty payload when the row allows it', async () => {
    const { queue, calls } = fakeQueue();
    expect(await runNow(queue, catalogue, 'test.safe')).toBe('sent-id');
    expect(calls).toEqual([['send', 'test.safe', {}]]);
  });

  test.each([
    ['test.unsafe', /cannot be run on demand/],
    ['test.destructive', /cannot be run on demand/],
    ['test.off', /not active/],
    ['test.missing', /No catalogue row/],
  ])('refuses %s', async (name, message) => {
    const { queue, calls } = fakeQueue();
    const refusal = runNow(queue, catalogue, name);
    await expect(refusal).rejects.toBeInstanceOf(RunNowRefusedError);
    await expect(refusal).rejects.toThrow(message);
    await refusal.catch(() => undefined);
    expect(calls).toHaveLength(0);
  });
});
