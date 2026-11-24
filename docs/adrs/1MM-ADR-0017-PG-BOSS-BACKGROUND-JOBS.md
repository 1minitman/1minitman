# 1MM-ADR-0017 · Background jobs on pg-boss, in PostgreSQL

|                  |                                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Status**       | Accepted                                                                                                                 |
| **Date decided** | 16 Nov 2026 (MVP baseline T5); kept in v3 on 18 Nov 2026                                                                 |
| **Decided by**   | Technical Reference §18.1 baseline (T5)                                                                                  |
| **Sources**      | [TR §4.1], [TR §4.2], [TR §4.3], [TR §11], [TR §18.1] T5, `packages/db/roles/roles.sql`, `docs/USAGE.md`, `apps/worker/` |
| **Affects**      | apps/worker, apps/api, packages/db, every module with a `WRK` task                                                       |

## Context

The product needs scheduled and triggered work: the media pipeline, badge decisions and refunds,
intro expiry, billing sync, notification delivery, retention and erasure [TR §11]. The baseline
chose pg-boss (T5, "Kept") [TR §18.1]: the queue is tables in the same PostgreSQL database, run
by a separate worker service on Railway (1 replica, 2 at peak) [TR §4.3]. The request model
relies on it: notifications and outgoing webhooks are rows "written in the same transaction as
the change. A worker delivers them, so nothing is ever sent for a rolled-back change" [TR §4.2].

## Decision

1. `apps/worker` runs pg-boss on Bun. It is the only place background jobs execute.
2. The queue lives in its own `pgboss` schema, owned by the role `app_queue`, which has no
   rights on business tables. Job handlers do their data work as `app_worker`.
3. Job payloads carry ids only: never secrets, codes or personal data.
4. Side effects that must follow a committed change use the outbox pattern: the row is written
   in the change's transaction and a job delivers it [TR §4.2].
5. Job names and schedules are those of the Technical Reference job table [TR §11]; schedules
   are data (each module seeds the `worker_jobs.cron` values for its own jobs, ruling R20, [master plan](../execution/1MM-EXE-00-MASTER-PLAN.md) section 7).

## Alternatives considered

The sources record no alternatives to pg-boss.

**Analysis:** (a) a Redis-based queue (for example BullMQ) would put durable work on Upstash,
whose free tier has a small command quota and is planned for cache and fan-out [TR §4.3], and
would lose the same-transaction guarantee; (b) a managed queue (SQS) is excluded by OD-11, which
keeps AWS to Rekognition and KMS; (c) in-process timers in the API would run once per replica
and die with a deploy.

## Consequences

- Easier: enqueueing is transactional with the data change; no extra vendor; jobs are visible
  with SQL.
- Harder: queue load shares the primary database; the always-on worker keeps Neon awake and
  uses compute hours [TR §4.3]; very high job throughput would need a different queue.
- Cost: none beyond the worker service.

## How it is applied

- `apps/worker/src/jobs/` holds handlers; `packages/db/roles/roles.sql` creates the `pgboss`
  schema and `app_queue`.
- Runtime, job-run records and scheduling are delivered in
  [MOD-00](../execution/1MM-EXE-MOD-00-FOUNDATIONS.md); each module adds its own jobs.
- Checks: the roles test proves `app_queue` cannot read member tables; review rejects payloads
  with anything but ids; job tests cover retry and idempotent re-run
  ([1MM-STD-01](../standards/1MM-STD-01-TESTING-STRATEGY.md)).

## Revisit when

Queue traffic measurably harms API query latency, or a job class (for example media transcoding)
needs a dedicated worker pool or an external queue.
