# 1MM-ADR-0012 · Forward-only numbered SQL migrations from the schema v3.4 baseline

|                  |                                                                                                                                   |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                                                                          |
| **Date decided** | 18 Nov 2026 (rule); 23 Nov 2026 (baseline and runner in the repository)                                                           |
| **Decided by**   | Technical Reference §10.3; repository set-up                                                                                      |
| **Sources**      | [TR §10.3], [TR §10.1], [TR §17.3], `packages/db/migrations/README.md`, `packages/db/src/migrator.ts`, `.github/workflows/ci.yml` |
| **Affects**      | packages/db, apps/api, apps/worker, every module with a `DB` task                                                                 |

## Context

The schema was designed and verified before any application code: v3.4 has 221 tables and its
behaviour tests pass [TR §10.1], [TR §10.4]. The Technical Reference sets the migration rule:
"numbered SQL in `packages/db`, expand-then-contract only, never edit an applied migration. They
run as a gated CI step with the `app_migrator` role" [TR §10.3]. The pack's design-stage deltas
(0002 to 0005) were already folded into the v3.4 file before the repository was created.

## Decision

1. The source of truth for the database structure is SQL in `packages/db/migrations/`.
   `0001_baseline_v3_4.sql` is the full schema v3.4, copied as-is from the pack.
2. Every later change is the next numbered file. Numbers 0002 to 0005 are never used in the
   repository; the first repository migration is `0006`.
3. Migrations only go forward: expand, then contract. There are no down migrations.
4. An applied file never changes. The runner records a SHA-256 checksum per file in
   `schema_migrations` and refuses to continue if one differs.
5. Each file runs as one transaction. A new enum value goes in its own file, because it cannot
   be used in the transaction that adds it.
6. Migrations run as the migration role, as a gated release step, never from the API at start-up.

## Alternatives considered

- **ORM-generated migrations** (Drizzle Kit generating DDL from TypeScript models): not chosen.
  The schema is "SQL-first" [TR §3] and carries functions, triggers, policies, partitions and
  seeds that a model diff does not express; see
  [1MM-ADR-0013](1MM-ADR-0013-DRIZZLE-ORM-HAND-CURATED-MODELS.md).
- **Down migrations:** the sources record no such option. **Analysis:** a rollback that drops
  data is not safe in production; expand-then-contract gives a safe path in both directions.

## Consequences

- Easier: the database can be rebuilt from files alone; review sees exact DDL; history cannot be
  rewritten unnoticed.
- Harder: a mistake is fixed by a new migration, never an edit; contract steps need a second
  release.
- A schema change that the Technical Reference lacks is first raised as a `SCHEMA` gap with exact
  DDL, then written as a migration.

## How it is applied

- `pnpm db:migrate`, `pnpm db:status`, then `pnpm db:roles` and `pnpm db:pull`.
- CI job `verify` applies every migration to PostgreSQL 16 + PostGIS on each run.
- Procedure and review checklist: [1MM-DB-02 Migrations](../database/1MM-DB-02-MIGRATIONS.md).

## Revisit when

A change cannot be expressed as expand-then-contract inside the release process, or zero-downtime
needs (after public launch) require online schema-change tooling.
