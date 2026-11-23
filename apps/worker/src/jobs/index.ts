import type { JobDefinition } from '../platform/job';
import { partitionsEnsure } from './partitions-ensure';

/**
 * The job registry. To add a job: create a file next to this one with defineJob(),
 * then add it to this list. Nothing else changes (the runner is closed to modification).
 */
export const jobs: JobDefinition[] = [partitionsEnsure];
