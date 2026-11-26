import { expect, test } from 'bun:test';
import { compareCatalogue } from '../platform/catalogue';
import { jobs, pendingJobs } from './index';

const NAME = /^[a-z_]+(\.[a-z_]+)+$/; // the worker_jobs.name CHECK

test('job names are unique and follow area.action', () => {
  const names = jobs.map((job) => job.name);
  expect(new Set(names).size).toBe(names.length);
  for (const name of names) expect(name).toMatch(NAME);
});

test('the pending manifest names an owner module for every entry', () => {
  for (const job of pendingJobs) {
    expect(job.name).toMatch(NAME);
    expect(job.owner).toMatch(/^MOD-[0-9]{2}$/);
    if (job.task)
      expect(job.task).toMatch(/^(MOD-[0-9]{2}-[A-Z]{3}-[0-9]{2}|GAP-[A-Z0-9]+-[0-9]{2})/);
  }
});

test('no job is both handled and pending, and none is listed twice', () => {
  const names = [...jobs.map((job) => job.name), ...pendingJobs.map((job) => job.name)];
  const report = compareCatalogue(
    jobs.map((job) => job.name),
    pendingJobs,
    names,
  );
  expect(report.handledAndPending).toEqual([]);
  expect(report.duplicates).toEqual([]);
  // 66 baseline rows + 4 from migration 0007 (TRX-049); the database test checks the rows.
  expect(names).toHaveLength(70);
});
