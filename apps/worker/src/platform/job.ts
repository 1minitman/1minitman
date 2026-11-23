import type { Database } from '@1minitman/db';

/** What every job handler receives. Jobs depend on this, never on concrete clients. */
export interface JobContext {
  database: Database;
  log: (message: string, fields?: Record<string, unknown>) => void;
}

/**
 * A background job. Names come from the job catalogue in the Technical Reference (section 11).
 * `cron` jobs are scheduled by the worker itself (UTC); the others run when the API enqueues them.
 */
export interface JobDefinition<Payload extends object = object> {
  name: string;
  cron?: string;
  handle(payload: Payload, context: JobContext): Promise<void>;
}

export const defineJob = <Payload extends object = object>(job: JobDefinition<Payload>) => job;
