# 1MM-ADR-0020 · Race-free matching inside the database (`record_reaction()`)

|                  |                                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                                     |
| **Date decided** | 18 Nov 2026                                                                                  |
| **Decided by**   | Technical Reference §3 and §8.4                                                              |
| **Sources**      | [TR §3], [TR §5.2], [TR §8.4], [TR §10.4], [TR §13.1], [TR §17.3], [SQL] `record_reaction()` |
| **Affects**      | packages/db, apps/api, MOD-07, MOD-08                                                        |

## Context

The product plan required the swipe ledger to be "ACID, no races or duplicates". Two people can
like each other in the same instant from two phones, through two API replicas; the result must be
exactly one match, and a retried request must not create a second reaction. The Technical
Reference answers in the database: "`record_reaction()`: per-pair advisory lock, partial unique
index on active matches, idempotent client ids" [TR §3].

## Decision

1. The API records a reaction by calling the SQL function
   `record_reaction(actor, target, kind, client_id, surface)` in one transaction [TR §8.4]. The
   API does not re-implement its steps.
2. The function, in order: replay check on `(actor, client_reaction_id)`; Like and Somewhat
   require ACTIVE or higher (Black Badge) while Pass is open to everyone; refuse if either person
   blocked the other; take `pg_advisory_xact_lock(hash(low_id:high_id))` so only the two people
   involved wait; upsert the reaction; read the other person's live reaction (Like + Like is a
   match; Like + Somewhat or Somewhat + Somewhat is a maybe); insert the match through the
   partial unique index on active pairs and create the intro session [TR §8.4].
3. Related rules are also functions: `undo_reaction()`, `decide_intro()`, `unmatch()` [TR §8.4].
4. Every other "only one" rule uses a unique or partial-unique constraint, and quota spends use
   `SELECT … FOR UPDATE` [TR §13.1].

## Alternatives considered

The sources record no alternatives.

**Analysis:** (a) a distributed lock in Redis would add a second system to the correctness path
and can expire mid-transaction; (b) application-level check-then-insert races between replicas;
(c) serialisable isolation for every reaction would retry unrelated transactions, while the
per-pair advisory lock makes only the two people involved wait; (d) a unique index alone prevents
the duplicate match but cannot decide match versus maybe atomically.

## Consequences

- Easier: correctness does not depend on how many API replicas run; the rule is tested in SQL
  once.
- Harder: product logic lives in PL/pgSQL, so a rule change is a migration; the function must be
  called under the right role and RLS context; errors raised in SQL must be mapped to problem
  types.
- Found in review (GAP-DB05-02): called as `app_api`, the matching functions collided with the
  row-level-security policies on `reactions` and `conversation_participants`; schema change set
  0007 addresses it by making them `SECURITY DEFINER` with a pinned `search_path` and an actor
  guard ([1MM-LOG-03](../1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md), TRX-048).
- Known limit: the schema was verified on a single-connection engine, so "the advisory lock was
  not tested under concurrency" [TR §10.4].

## How it is applied

- The function ships in `packages/db/migrations/0001_baseline_v3_4.sql`; the API endpoint
  `POST /v1/reactions` [TR §5.2] is built in
  [MOD-07](../execution/1MM-EXE-MOD-07-DISCOVERY-AND-MATCHING.md).
- **Required check before beta:** CI re-runs the schema and "a parallel-connection matching
  test on PostgreSQL 16 + PostGIS 3.4 in a container" [TR §10.4], [TR §17.3]: many concurrent
  mutual likes on one pair must yield exactly one match.
- Review: no TypeScript code inserts into `matches` or `reactions` directly.

## Revisit when

The database is distributed with Citus (advisory locks and the pair tables' distribution by
`user_a` must be re-verified), or lock waits show up in the reaction latency budget.
