import type { Database } from '@1minitman/db';

/** Why a job ended without completing. */
export type JobFailureReason = 'retries_exhausted' | 'invalid_payload';

export interface JobFailure {
  job: string;
  /** pg-boss job id: one notification per failed job, however often this is called. */
  jobId: string;
  reason: JobFailureReason;
}

/** Raises the `job.failed` console notification [ADM A04], [SQL admin_notifications]. */
export interface FailureNotifier {
  jobFailed(failure: JobFailure): Promise<{ notified: number }>;
}

/**
 * The permission whose holders receive `job.failed`: the one that opens the A31 Jobs page
 * (`jobs.read`, "View background jobs and queues" [SQL]). The recipient rule is not stated in a
 * source; GAP-MOD00-31 asks the owner to confirm it.
 */
export const JOB_FAILED_PERMISSION = 'jobs.read';
export const JOB_FAILED_TYPE = 'job.failed';

/**
 * Writes one `admin_notifications` row per active admin who holds `jobs.read` through a role
 * that is not archived, revoked or expired. The title is the job name (an identifier, not copy);
 * the console renders the type. The dedupe key makes a repeated call a no-op.
 */
export const postgresFailureNotifier = (database: Database): FailureNotifier => ({
  async jobFailed({ job, jobId }) {
    const dedupeKey = `${JOB_FAILED_TYPE}:${job}:${jobId}`;
    const rows = await database.sql<{ admin_id: string }[]>`
      INSERT INTO admin_notifications (admin_id, type, title, dedupe_key)
      SELECT DISTINCT u.id, ${JOB_FAILED_TYPE}, ${job}, ${dedupeKey}
        FROM admin_users u
        JOIN admin_user_roles ur ON ur.admin_id = u.id
                                AND ur.revoked_at IS NULL
                                AND (ur.expires_at IS NULL OR ur.expires_at > now())
        JOIN admin_roles r ON r.id = ur.role_id AND r.archived_at IS NULL
        JOIN admin_role_permissions rp ON rp.role_id = r.id
                                      AND rp.permission_key = ${JOB_FAILED_PERMISSION}
       WHERE u.status = 'active'
      ON CONFLICT (admin_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
      RETURNING admin_id`;
    return { notified: rows.length };
  },
});
