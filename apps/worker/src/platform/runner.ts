import { type PgBoss } from 'pg-boss';
import type { JobContext, JobDefinition } from './job';

/** Registers every job with pg-boss: a queue, its handler and, if set, its schedule. */
export const startRunner = async (boss: PgBoss, jobs: JobDefinition[], context: JobContext) => {
  for (const job of jobs) {
    await boss.createQueue(job.name);
    await boss.work(job.name, async (batch) => {
      for (const item of batch) {
        const started = performance.now();
        await job.handle((item.data ?? {}) as object, context);
        context.log('job done', {
          job: job.name,
          id: item.id,
          duration_ms: Math.round(performance.now() - started),
        });
      }
    });
    if (job.cron) await boss.schedule(job.name, job.cron, undefined, { tz: 'UTC' });
  }
  context.log('worker ready', { jobs: jobs.map((job) => job.name) });
};
