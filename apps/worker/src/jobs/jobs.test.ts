import { expect, test } from 'bun:test';
import { jobs } from './index';

test('job names are unique and follow area.action', () => {
  const names = jobs.map((job) => job.name);
  expect(new Set(names).size).toBe(names.length);
  for (const name of names) expect(name).toMatch(/^[a-z_]+(\.[a-z_]+)+$/);
});
