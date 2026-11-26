import type { Catalogue } from './catalogue';
import type { FailureNotifier, JobFailureReason } from './failure-notifier';
import type { JobContext, JobDefinition } from './job';
import type { ErrorReporter } from './reporter';

/** One claimed attempt, as pg-boss hands it over (`includeMetadata`). */
export interface Attempt {
  id: string;
  data: unknown;
  /** 0 on the first attempt, then one more per retry. */
  retryCount: number;
  retryLimit: number;
  signal?: AbortSignal;
}

/** What the attempt became. `status` is what pg-boss is told. */
export type AttemptOutcome =
  | { status: 'completed'; outcome: 'done' | 'skipped_inactive' }
  | { status: 'failed'; outcome: 'retry' | 'exhausted' }
  | { status: 'deadletter'; outcome: 'invalid_payload' };

export interface AttemptDeps {
  catalogue: Pick<Catalogue, 'get'>;
  context: Omit<JobContext, 'signal'>;
  reporter: ErrorReporter;
  notifier: FailureNotifier;
}

/** A payload that does not match the job's schema. Never retried. */
export class InvalidPayloadError extends Error {
  override readonly name = 'InvalidPayloadError';
}

const raiseFailure = async (
  deps: AttemptDeps,
  job: string,
  jobId: string,
  reason: JobFailureReason,
) => {
  try {
    const { notified } = await deps.notifier.jobFailed({ job, jobId, reason });
    deps.context.logger.info('job failure notified', { job, id: jobId, reason, notified });
  } catch (error) {
    // The failure itself is already logged and reported; a lost notification must not hide it.
    deps.context.logger.error('job failure notification not written', {
      job,
      id: jobId,
      error: error instanceof Error ? error.message : String(error),
    });
    deps.reporter.capture(error, { job, job_id: jobId, attempt: 0 });
  }
};

/**
 * Runs one attempt of a job under the catalogue's rules (MOD-00 plan section 4.2):
 * 1. only when `worker_jobs.is_active` is true (checked when the attempt starts);
 * 2. a malformed payload fails at once, without retry (REP-038);
 * 3. a thrown error is logged, sent to Sentry and retried with backoff by the queue;
 * 4. the attempt that exhausts the retries raises the `job.failed` console notification.
 */
export const runAttempt = async (
  job: JobDefinition,
  attempt: Attempt,
  deps: AttemptDeps,
): Promise<AttemptOutcome> => {
  const { logger } = deps.context;
  const fields = { job: job.name, id: attempt.id, attempt: attempt.retryCount };
  const tags = { job: job.name, job_id: attempt.id, attempt: attempt.retryCount };

  const row = await deps.catalogue.get(job.name);
  if (!row?.isActive) {
    logger.info('job skipped: not active in the catalogue', fields);
    return { status: 'completed', outcome: 'skipped_inactive' };
  }

  let payload: object = {};
  if (job.payload) {
    const parsed = job.payload.safeParse(attempt.data ?? {});
    if (!parsed.success) {
      // Paths only: the values may be what must never be logged.
      const paths = parsed.error.issues.map((issue) => issue.path.join('.') || '(root)');
      const error = new InvalidPayloadError(`Invalid payload for ${job.name}: ${paths.join(', ')}`);
      logger.error('job payload rejected', { ...fields, paths });
      deps.reporter.capture(error, tags);
      await raiseFailure(deps, job.name, attempt.id, 'invalid_payload');
      return { status: 'deadletter', outcome: 'invalid_payload' };
    }
    payload = parsed.data;
  }

  const started = performance.now();
  try {
    await job.handle(payload, { ...deps.context, signal: attempt.signal });
  } catch (error) {
    const exhausted = attempt.retryCount >= attempt.retryLimit;
    logger.error(exhausted ? 'job failed: retries exhausted' : 'job failed: will retry', {
      ...fields,
      retry_limit: attempt.retryLimit,
      error: error instanceof Error ? error.message : String(error),
    });
    deps.reporter.capture(error, tags);
    if (!exhausted) return { status: 'failed', outcome: 'retry' };
    await raiseFailure(deps, job.name, attempt.id, 'retries_exhausted');
    return { status: 'failed', outcome: 'exhausted' };
  }
  logger.info('job done', { ...fields, duration_ms: Math.round(performance.now() - started) });
  return { status: 'completed', outcome: 'done' };
};
