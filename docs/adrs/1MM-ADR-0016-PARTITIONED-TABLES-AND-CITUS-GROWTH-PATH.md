# 1MM-ADR-0016 · Monthly partitions now; Citus deferred as the last step of the growth path

|                  |                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                                |
| **Date decided** | 18 Nov 2026                                                                             |
| **Decided by**   | Technical Reference §18.1 baseline (T4 Citus deferred; T15 monthly partitions)          |
| **Sources**      | [TR §3], [TR §10.1], [TR §10.2], [TR §10.3], [TR §17.1], [TR §18.1] T4 and T15, [OD-11] |
| **Affects**      | packages/db, apps/worker (`partitions.ensure`), MOD-00, MOD-08, MOD-18                  |

## Context

The product plan asked for PostgreSQL "scaled with Citus". The Technical Reference answered:
"Citus later: schema v3 is distribution-ready" and "One well-indexed primary first" [TR §3].
Meanwhile a few tables grow by time without limit (messages, analytics, audit, request logs) and
need cheap retention. Both needs are met in the schema design rather than in infrastructure.

## Decision

1. **Partitions.** Nine tables are partitioned by month [TR §10.1], including `messages`,
   `group_messages`, `analytics_events`, `admin_audit_log`, `feed_impressions`,
   `api_request_rollups`, `api_request_samples` and, from v3.4, `edge_security_events`.
   Partitions are created by `ensure_monthly_partitions()` (job `partitions.ensure`), with DEFAULT
   partitions as a safety net [TR §10.2].
2. Unique keys on partitioned tables include the partition key; message idempotency therefore
   uses `message_client_ids` [TR §10.2].
3. **Citus is deferred, not deployed** (baseline item T4 [TR §18.1]): it is the last step of the
   growth path in item 4 and is adopted only when that step is reached. The schema stays distribution-ready: member-owned tables
   distribute by `user_id`, messaging by `conversation_id`, groups by `group_id`, meet-ups by
   `meetup_id`, pair tables by `user_a`; catalogues and config are reference tables; the audit
   log, analytics and request logs stay on the coordinator; cross-shard foreign keys are enforced
   in the API in Citus mode [TR §10.2].
4. **Growth path, in order:** indexes and tuning; a bigger instance plus a read replica for
   discovery and analytics; partition retention and archiving; Citus when writes exceed one
   primary [TR §10.3].

## Alternatives considered

- **Citus from day one** (product plan): deferred as T4 [TR §18.1]. It needs self-managed or
  AWS-hosted PostgreSQL; the origin moves to AWS af-south-1 "(RDS, later Citus)" only if a market
  requires local hosting or load outgrows the lean tiers [OD-11].
- **No partitioning:** the sources record no such option. **Analysis:** retention would then be
  large `DELETE` runs on the busiest tables instead of dropping a partition.

## Consequences

- Easier: retention by dropping or archiving a month; BRIN and per-partition indexes on time
  series; no distributed-database cost or operations at launch.
- Harder: every new table must name its distribution key; a missed `partitions.ensure` run sends
  rows to the DEFAULT partition; queries on partitioned tables must include the time key.
- Cost: none now; Citus brings a hosting move when triggered.

## How it is applied

- The worker calls `ensure_monthly_partitions()` through its definer grant
  ([1MM-ADR-0014](1MM-ADR-0014-LEAST-PRIVILEGE-DATABASE-ROLES.md)); the job is scheduled in
  [MOD-00](../execution/1MM-EXE-MOD-00-FOUNDATIONS.md).
- Checks: an alert when a DEFAULT partition holds rows; migration review asks for the
  distribution key of each new table ([1MM-DB-03](../database/1MM-DB-03-SQL-STRUCTURE.md),
  [1MM-DB-04](../database/1MM-DB-04-INDEXING.md)). "Citus, read replicas" are listed as
  after-launch scope [TR §17.1].

## Revisit when

Steps 1 to 3 of the growth path are exhausted and writes exceed one primary [TR §10.3].
