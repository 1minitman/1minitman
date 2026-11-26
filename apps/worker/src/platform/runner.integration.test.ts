import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createDatabase, type Database } from '@1minitman/db';
import { PgBoss } from 'pg-boss';
import { z } from 'zod';
import { partitionsEnsure } from '../jobs/partitions-ensure';
import { postgresCatalogue } from './catalogue';
import { postgresFailureNotifier } from './failure-notifier';
import { defineJob } from './job';
import { runNow, startRunner, syncSchedules } from './runner';
import { databaseTestsReady, queueUrl, testJobName, workerUrl } from './test-database';
import { recordingLogger, recordingReporter } from './test-support';

// One pg-boss round trip per behaviour (1MM-STD-01 section 3.2): the runner on the local queue as
// `app_queue`, the catalogue and the notifications as `app_worker`. Every catalogue row, queue,
// admin and notification made here has a random name and is removed afterwards.
const DEADLINE_MS = 15_000;

describe.skipIf(!databaseTestsReady)('job runner on PostgreSQL and pg-boss', () => {
  let database: Database;
  let boss: PgBoss;
  let started = false;
  const logger = recordingLogger();
  const reporter = recordingReporter();
  const names = {
    flaky: testJobName('flaky'),
    broken: testJobName('broken'),
    inactive: testJobName('inactive'),
    payload: testJobName('payload'),
    scheduled: testJobName('scheduled'),
  };
  const runs: Record<string, number> = {};
  const count = (name: string) => {
    runs[name] = (runs[name] ?? 0) + 1;
    return runs[name];
  };
  const jobs = [
    defineJob({
      name: names.flaky,
      handle: () =>
        count(names.flaky) === 1 ? Promise.reject(new Error('first try fails')) : Promise.resolve(),
    }),
    defineJob({
      name: names.broken,
      handle: () => {
        count(names.broken);
        return Promise.reject(new Error('always fails'));
      },
    }),
    defineJob({
      name: names.inactive,
      handle: () => {
        count(names.inactive);
        return Promise.resolve();
      },
    }),
    defineJob({
      name: names.payload,
      payload: z.strictObject({ id: z.uuid() }),
      handle: () => {
        count(names.payload);
        return Promise.resolve();
      },
    }),
    defineJob({ name: names.scheduled, handle: () => Promise.resolve() }),
  ];
  const admins = { active: crypto.randomUUID(), suspended: crypto.randomUUID() };

  const settled = async (name: string, id: string) => {
    const until = Date.now() + DEADLINE_MS;
    for (;;) {
      const [job] = await boss.findJobs(name, { id });
      if (job && ['completed', 'failed', 'cancelled'].includes(job.state)) return job;
      if (Date.now() > until) throw new Error(`${name} did not settle: ${job?.state}`);
      await Bun.sleep(100);
    }
  };

  beforeAll(async () => {
    database = createDatabase({ url: workerUrl ?? '', surface: 'worker', appEnv: 'local', max: 4 });
    const rows = [
      [names.flaky, true, null, true],
      [names.broken, true, null, false],
      [names.inactive, false, null, true],
      [names.payload, true, null, false],
      [names.scheduled, true, '0 3 1 * *', false],
    ] as const;
    for (const [name, active, cron, runNowAllowed] of rows) {
      await database.sql`
        INSERT INTO worker_jobs (name, schedule, description, run_now_allowed, is_active, cron)
        VALUES (${name}, 'test', 'MOD-00-WRK-01 runner test', ${runNowAllowed}, ${active}, ${cron})`;
    }
    for (const [id, status] of [
      [admins.active, 'active'],
      [admins.suspended, 'suspended'],
    ] as const) {
      await database.sql`
        INSERT INTO admin_users (id, email, full_name, display_name, status, password_hash)
        VALUES (${id}, ${`wrk-${id}@example.com`}, 'Test Admin', 'Tester', ${status},
                'not-a-real-hash')`;
      await database.sql`
        INSERT INTO admin_user_roles (admin_id, role_id)
        SELECT ${id}, id FROM admin_roles WHERE key = 'admin'`;
    }

    boss = new PgBoss({
      connectionString: queueUrl ?? '',
      createSchema: false,
      schedule: false,
      supervise: false,
    });
    await boss.start();
    started = true;
    await startRunner(boss, jobs, {
      catalogue: postgresCatalogue(database),
      pending: [],
      context: { database, logger },
      reporter,
      notifier: postgresFailureNotifier(database),
      pollingIntervalSeconds: 0.5,
    });
  });

  afterAll(async () => {
    if (started) {
      for (const name of Object.values(names)) {
        await boss.offWork(name);
        await boss.unschedule(name);
        await boss.deleteQueue(name);
      }
      await boss.stop({ graceful: false, timeout: 2_000 });
    }
    const ids = Object.values(admins);
    await database.sql`DELETE FROM admin_notifications WHERE admin_id = ANY(${ids}::uuid[])`;
    await database.sql`DELETE FROM admin_user_roles WHERE admin_id = ANY(${ids}::uuid[])`;
    await database.sql`DELETE FROM admin_users WHERE id = ANY(${ids}::uuid[])`;
    await database.sql`DELETE FROM worker_jobs WHERE name = ANY(${Object.values(names)})`;
    await database.close();
  });

  const notificationsFor = (admin: string, job: string) =>
    database.sql<{ type: string; title: string; dedupe_key: string }[]>`
      SELECT type, title, dedupe_key FROM admin_notifications
       WHERE admin_id = ${admin} AND title = ${job}`;

  test('a job that fails once is retried with backoff and then completes', async () => {
    const id = await boss.send(names.flaky, {});
    const job = await settled(names.flaky, id ?? '');
    expect(job.state).toBe('completed');
    expect(job.retryCount).toBe(1);
    expect(job.retryBackoff).toBe(true);
    expect(runs[names.flaky]).toBe(2);
    expect(await notificationsFor(admins.active, names.flaky)).toHaveLength(0);
  }, 20_000);

  test('a job that always fails stops at the retry limit and raises job.failed', async () => {
    const id = (await boss.send(names.broken, {})) ?? '';
    const job = await settled(names.broken, id);
    expect(job.state).toBe('failed');
    expect(runs[names.broken]).toBe(job.retryLimit + 1);
    expect([...(await notificationsFor(admins.active, names.broken))]).toEqual([
      { type: 'job.failed', title: names.broken, dedupe_key: `job.failed:${names.broken}:${id}` },
    ]);
    // A suspended admin is not notified, even with the role.
    expect(await notificationsFor(admins.suspended, names.broken)).toHaveLength(0);
    expect(reporter.captured.filter((c) => c.tags.job === names.broken)).toHaveLength(
      job.retryLimit + 1,
    );
  }, 20_000);

  test('the notification is written once per failed job', async () => {
    const notifier = postgresFailureNotifier(database);
    const failure = { job: names.broken, jobId: crypto.randomUUID(), reason: 'retries_exhausted' };
    const first = await notifier.jobFailed({ ...failure, reason: 'retries_exhausted' });
    const second = await notifier.jobFailed({ ...failure, reason: 'retries_exhausted' });
    expect(first.notified).toBeGreaterThanOrEqual(1);
    expect(second.notified).toBe(0);
  });

  test('an inactive job is completed without running', async () => {
    const id = await boss.send(names.inactive, {});
    expect((await settled(names.inactive, id ?? '')).state).toBe('completed');
    expect(runs[names.inactive]).toBeUndefined();
  }, 20_000);

  test('a malformed payload fails at once, without retry', async () => {
    const id = (await boss.send(names.payload, { id: 'nope' })) ?? '';
    const job = await settled(names.payload, id);
    expect(job.state).toBe('failed');
    expect(job.retryCount).toBe(0);
    expect(runs[names.payload]).toBeUndefined();
    expect(await notificationsFor(admins.active, names.payload)).toHaveLength(1);
  }, 20_000);

  test('the catalogue cron is the schedule, and turning a job off removes it', async () => {
    const schedules = await boss.getSchedules(names.scheduled);
    expect(schedules.map((s) => [s.cron, s.timezone])).toEqual([['0 3 1 * *', 'UTC']]);

    // A second replica applying the same catalogue keeps one schedule (one job per occurrence).
    const catalogue = postgresCatalogue(database);
    await syncSchedules(boss, jobs, await catalogue.list());
    expect(await boss.getSchedules(names.scheduled)).toHaveLength(1);

    await database.sql`UPDATE worker_jobs SET cron = '0 4 1 * *' WHERE name = ${names.scheduled}`;
    await syncSchedules(boss, jobs, await catalogue.list());
    expect((await boss.getSchedules(names.scheduled)).map((s) => s.cron)).toEqual(['0 4 1 * *']);

    await database.sql`UPDATE worker_jobs SET is_active = false WHERE name = ${names.scheduled}`;
    await syncSchedules(boss, jobs, await catalogue.list());
    expect(await boss.getSchedules(names.scheduled)).toHaveLength(0);
  });

  test('run now sends an allowed job and refuses the others', async () => {
    const catalogue = postgresCatalogue(database);
    const id = await runNow(boss, catalogue, names.flaky);
    expect((await settled(names.flaky, id ?? '')).state).toBe('completed');
    await expect(runNow(boss, catalogue, names.broken)).rejects.toThrow(/cannot be run on demand/);
    await expect(runNow(boss, catalogue, names.inactive)).rejects.toThrow(/not active/);
  }, 20_000);

  test('partitions.ensure is idempotent: a second run creates nothing', async () => {
    const lines = recordingLogger();
    await partitionsEnsure.handle({}, { database, logger: lines });
    lines.lines.length = 0;
    await partitionsEnsure.handle({}, { database, logger: lines });
    expect(lines.lines).toHaveLength(9);
    for (const line of lines.lines) expect(line.fields?.created).toBe(0);
  });
});
