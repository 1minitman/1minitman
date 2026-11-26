import type { JobDefinition } from '../platform/job';
import { partitionsEnsure } from './partitions-ensure';

export { pendingJobs } from './pending';

/**
 * The job registry. To add a job: create a file next to this one with defineJob(), add it to
 * this list and remove its name from `./pending.ts`. The schedule and the on/off switch live in
 * `worker_jobs` (A31), not here. Nothing else changes (the runner is closed to modification).
 */
export const jobs: JobDefinition[] = [partitionsEnsure];
