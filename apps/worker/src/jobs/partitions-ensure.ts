import { defineJob } from '../platform/job';

/** Monthly-partitioned tables in schema v3.4 (Technical Reference 10.2). */
export const PARTITIONED_TABLES = [
  'messages',
  'group_messages',
  'analytics_events',
  'admin_audit_log',
  'feed_impressions',
  'api_request_rollups',
  'api_request_samples',
  'api_request_ip_rollups',
  'edge_security_events',
] as const;

const MONTHS_AHEAD = 3;

/** `partitions.ensure`: create the next three monthly partitions of every partitioned table. */
export const partitionsEnsure = defineJob({
  name: 'partitions.ensure',
  // Schedule: `worker_jobs.cron` ('0 3 1 * *', 03:00 UTC on the 1st of each month, TRX-049).
  async handle(_payload, { database, logger }) {
    for (const table of PARTITIONED_TABLES) {
      const [row] = await database.sql<{ made: number }[]>`
        SELECT ensure_monthly_partitions(${table}, current_date, ${MONTHS_AHEAD}) AS made`;
      logger.info('partitions ensured', { table, created: row?.made ?? 0 });
    }
  },
});
