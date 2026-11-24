# 1MM-ADR-0010 · PostgreSQL 16 with PostGIS is the single system of record

|                  |                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                                                            |
| **Date decided** | 18 Nov 2026                                                                                                         |
| **Decided by**   | Technical Reference §3 and §18.1 (T4); provider by owner decision OD-11                                             |
| **Sources**      | [TR header], [TR §3], [TR §4.3], [TR §10], [TR §18.1] T4, [OD-11], `docker-compose.yml`, `.github/workflows/ci.yml` |
| **Affects**      | packages/db, apps/api, apps/worker, every module                                                                    |

## Context

The product plan asked for "PostgreSQL scaled with Citus, plus Redis". The Technical Reference
kept PostgreSQL and deferred Citus: "One well-indexed primary first" [TR §3], under its rule "one
database, managed services" [TR header]. Discovery is a distance search, which PostGIS serves
with GiST indexes [TR §8.5]. Schema v3.4 holds 221 tables, 40 functions and 14 RLS policies, and
several product rules live in the database itself (matching, the audit chain, four-eyes guards)
[TR §10.1].

## Decision

1. PostgreSQL 16 with the extensions PostGIS, citext and pgcrypto ("the only extensions the
   schema needs") is the system of record for every durable fact [TR §4.3].
2. Nothing else is authoritative. Redis holds only derived or short-lived data
   ([1MM-ADR-0018](1MM-ADR-0018-REDIS-CACHE-RATE-LIMITS-FAN-OUT.md)); the job queue lives in the
   same database ([1MM-ADR-0017](1MM-ADR-0017-PG-BOSS-BACKGROUND-JOBS.md)).
3. The schema avoids features newer than PostgreSQL 16 [TR §10.4].
4. Only the API and the worker connect to the database. No client does.
5. Hosted on Neon (OD-11); the code uses standard PostgreSQL so the provider can change
   ([1MM-ADR-0022](1MM-ADR-0022-LEAN-HOSTING-EU-ORIGIN.md)).

## Alternatives considered

- **Citus from the start** (product plan): deferred as T4, "schema v3 is distribution-ready"
  [TR §18.1]; see [1MM-ADR-0016](1MM-ADR-0016-PARTITIONED-TABLES-AND-CITUS-GROWTH-PATH.md).
- **Supabase** as provider: the owner preferred Neon [OD-11].
- **AWS RDS in af-south-1:** the original T1, revised by OD-06 and OD-11 and kept as the growth
  path [TR §18.1].
- **Analysis:** a document database or a separate search or geo store would split the
  transactional rules (one match per pair, one live subscription) across systems.

## Consequences

- Easier: one transaction covers a change, its outbox rows and its audit row [TR §4.2]; one
  backup and restore story [TR §10.3].
- Harder: all write load is on one primary until the growth path is taken; rules in SQL
  functions need SQL-level tests.
- Cost: Neon free tier for demo and beta, a paid plan before public launch [TR §4.3].

## How it is applied

- `packages/db` (migrations, roles, client). Local and CI run the same engine: `postgis/postgis`
  16 in `docker-compose.yml` and in the CI job `verify`, which applies the schema and the roles.
- Schema behaviour tests, including a parallel-connection matching test, must run on PostgreSQL
  16 + PostGIS 3.4 in a container before beta [TR §10.4].
- Design documents: [1MM-DB-01 Schemas](../database/1MM-DB-01-SCHEMAS.md),
  [1MM-DB-03 SQL structure](../database/1MM-DB-03-SQL-STRUCTURE.md).

## Revisit when

Writes exceed one primary (step 4 of the growth path) [TR §10.3], or Neon drops a required
extension or PostgreSQL 16.
