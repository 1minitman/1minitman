import type { JobResult, PgBoss } from 'pg-boss';
import { runAttempt, type AttemptDeps } from './attempt';
import { compareCatalogue, type Catalogue, type CatalogueRow, type PendingJob } from './catalogue';
import type { JobDefinition } from './job';

/** The pg-boss calls the runner uses (a narrow port, so tests can pass a real or a fake queue). */
export type Queue = Pick<
  PgBoss,
  'createQueue' | 'updateQueue' | 'getQueue' | 'work' | 'schedule' | 'unschedule' | 'send'
>;

export interface RunnerDeps extends AttemptDeps {
  catalogue: Catalogue;
  pending: readonly PendingJob[];
  /** Idle poll of each queue, seconds (pg-boss default when absent). Tests shorten it. */
  pollingIntervalSeconds?: number;
}

/** Raised at start when a handler has no catalogue row: the A31 page could not show it. */
export class CatalogueMismatchError extends Error {
  override readonly name = 'CatalogueMismatchError';
}

/**
 * Retries use exponential backoff (MOD-00 plan section 4.2 rule 5). The retry count and delays
 * are pg-boss defaults: no source gives numbers and `worker_jobs` has no column for them
 * (GAP-MOD00-32).
 */
export const RETRY_POLICY = { retryBackoff: true } as const;

/**
 * Applies the catalogue schedule of every registered job: `cron` when the row is active and has
 * one (UTC), otherwise no schedule. pg-boss keeps one schedule per queue in PostgreSQL, so two
 * replicas create one job per occurrence.
 */
export const syncSchedules = async (
  queue: Queue,
  jobs: readonly JobDefinition[],
  rows: readonly CatalogueRow[],
) => {
  const byName = new Map(rows.map((row) => [row.name, row]));
  const scheduled: string[] = [];
  for (const job of jobs) {
    const row = byName.get(job.name);
    if (row?.isActive && row.cron) {
      await queue.schedule(job.name, row.cron, undefined, { tz: 'UTC' });
      scheduled.push(job.name);
    } else {
      await queue.unschedule(job.name);
    }
  }
  return scheduled;
};

/**
 * Registers every job with pg-boss: its queue (with the retry policy), its handler and its
 * schedule from the catalogue. Refuses to start when a handler has no `worker_jobs` row; logs
 * catalogue rows that nobody claims (the catalogue test fails on those).
 */
export const startRunner = async (
  queue: Queue,
  jobs: readonly JobDefinition[],
  deps: RunnerDeps,
) => {
  const { logger } = deps.context;
  const rows = await deps.catalogue.list();
  const report = compareCatalogue(
    jobs.map((job) => job.name),
    deps.pending,
    rows.map((row) => row.name),
  );
  if (report.handlersWithoutRow.length > 0 || report.duplicates.length > 0) {
    throw new CatalogueMismatchError(
      `Job registry does not match worker_jobs: no row for [${report.handlersWithoutRow.join(', ')}]` +
        `, duplicated [${report.duplicates.join(', ')}]`,
    );
  }
  if (report.unclaimed.length > 0) {
    logger.warn('catalogue jobs with no handler and no pending entry', {
      jobs: report.unclaimed,
    });
  }

  for (const job of jobs) {
    if (await queue.getQueue(job.name)) await queue.updateQueue(job.name, RETRY_POLICY);
    else await queue.createQueue(job.name, RETRY_POLICY);
    await queue.work(
      job.name,
      {
        includeMetadata: true,
        perJobResults: true,
        ...(deps.pollingIntervalSeconds
          ? { pollingIntervalSeconds: deps.pollingIntervalSeconds }
          : {}),
      },
      async (batch) => {
        const results: JobResult[] = [];
        for (const item of batch) {
          const { status } = await runAttempt(job, item, deps);
          results.push({ id: item.id, status });
        }
        return results;
      },
    );
  }
  const scheduled = await syncSchedules(queue, jobs, rows);
  logger.info('worker ready', {
    jobs: jobs.map((job) => job.name),
    scheduled,
    pending: deps.pending.length,
  });
};

/** Raised when "Run now" is refused by the catalogue (MOD-00 plan section 4.2 rule 3). */
export class RunNowRefusedError extends Error {
  override readonly name = 'RunNowRefusedError';
}

/**
 * "Run now" (A31, `jobs.run`): only for an active job whose row allows it. The CHECK on
 * `worker_jobs` already forbids `run_now_allowed` on destructive jobs; this checks both again.
 */
export const runNow = async (queue: Pick<Queue, 'send'>, catalogue: Catalogue, name: string) => {
  const row = await catalogue.get(name);
  if (!row) throw new RunNowRefusedError(`No catalogue row for ${name}`);
  if (!row.runNowAllowed || row.isDestructive) {
    throw new RunNowRefusedError(`${name} cannot be run on demand`);
  }
  if (!row.isActive) throw new RunNowRefusedError(`${name} is not active`);
  return queue.send(name, {});
};
