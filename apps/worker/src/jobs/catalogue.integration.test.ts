import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createDatabase, type Database } from '@1minitman/db';
import { compareCatalogue, postgresCatalogue } from '../platform/catalogue';
import { databaseTestsReady, TEST_JOB_PREFIX, workerUrl } from '../platform/test-database';
import { jobs, pendingJobs } from './index';

// The catalogue test (MOD-00 plan section 4.2 rule 1, task MOD-00-WRK-01): the handler registry
// plus the pending manifest name exactly the jobs of `worker_jobs`, read as `app_worker`. Rows with
// the reserved test prefix belong to the runner test, which may be running at the same time.
describe.skipIf(!databaseTestsReady)('job catalogue against worker_jobs', () => {
  let database: Database;
  beforeAll(() => {
    database = createDatabase({ url: workerUrl ?? '', surface: 'worker', appEnv: 'local', max: 2 });
  });
  afterAll(() => database.close());

  const catalogued = async () =>
    (await postgresCatalogue(database).list()).filter(
      (row) => !row.name.startsWith(TEST_JOB_PREFIX),
    );

  test('registry and manifest equal the catalogue (70 rows: 66 baseline + 4 TRX-049)', async () => {
    const rows = await catalogued();
    expect(rows).toHaveLength(70);
    const report = compareCatalogue(
      jobs.map((job) => job.name),
      pendingJobs,
      rows.map((row) => row.name),
    );
    expect(report).toEqual({
      unclaimed: [],
      handlersWithoutRow: [],
      pendingWithoutRow: [],
      handledAndPending: [],
      duplicates: [],
    });
  });

  test('every catalogued cron has five fields, and no destructive job runs on demand', async () => {
    for (const row of await catalogued()) {
      if (row.cron !== null) expect(row.cron.trim().split(/\s+/)).toHaveLength(5);
      expect(row.runNowAllowed && row.isDestructive).toBe(false);
    }
  });

  test('a registered job reads its own row', async () => {
    const catalogue = postgresCatalogue(database);
    expect(await catalogue.get('partitions.ensure')).toEqual({
      name: 'partitions.ensure',
      cron: '0 3 1 * *',
      isActive: true,
      runNowAllowed: true,
      isDestructive: false,
    });
    expect(await catalogue.get('no_such.job')).toBeUndefined();
  });
});
