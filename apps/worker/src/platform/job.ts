import type { Database } from '@1minitman/db';
import type { z } from 'zod';
import type { Logger } from './logger';

/** What every job handler receives. Jobs depend on this, never on concrete clients. */
export interface JobContext {
  database: Database;
  logger: Logger;
  /** Aborted when the worker stops (SIGTERM) or the attempt expires: stop at the next safe point. */
  signal?: AbortSignal;
}

/**
 * A background job. Names come from the job catalogue (`worker_jobs`, Technical Reference 11).
 * Payloads are stored in the queue tables for retries and audit: carry ids only, never secrets,
 * tokens, codes or personal data. The handler loads what it needs by id.
 *
 * The schedule is not here: `worker_jobs.cron` is the one source (TRX-049), read by the runner.
 * Every handler is idempotent: a retry or a second run must change nothing that the first did.
 */
export interface JobDefinition<Payload extends object = object> {
  name: string;
  /**
   * Shape of the payload. A payload that does not match fails the job at once, without retry
   * (REP-038). Jobs without a payload leave this out and receive `{}`.
   */
  payload?: z.ZodType<Payload>;
  handle(payload: Payload, context: JobContext): Promise<void>;
}

export const defineJob = <Payload extends object = object>(job: JobDefinition<Payload>) => job;
