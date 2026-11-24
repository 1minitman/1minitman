# 1MM-ADR-0011 · uuid v7 primary keys everywhere

|                  |                                                                       |
| ---------------- | --------------------------------------------------------------------- |
| **Status**       | Accepted                                                              |
| **Date decided** | 18 Nov 2026                                                           |
| **Decided by**   | Technical Reference §18.1 baseline (T15, new in schema v3)            |
| **Sources**      | [TR §10.2], [TR §18.1] T15, [TR §4.2], [SQL] preamble and `uuid_v7()` |
| **Affects**      | packages/db, packages/contracts, apps/api, apps/worker, apps/mobile   |

## Context

Schema v3 chose its key type once, for every table: "Primary keys: uuid v7 everywhere
(`uuid_v7()`, PG16-compatible). Ids are time-ordered, so B-tree locality is good. They are unique
across shards and devices (the offline outbox), and can't be guessed" [TR §10.2]. Three needs
meet in that sentence: index performance, the later move to Citus, and ids that a phone can
create while offline [TR §4.2]. The decision is listed as T15 in the approved baseline
[TR §18.1].

## Decision

1. Every entity row has a `uuid` primary key defaulting to `uuid_v7()` [SQL].
2. `uuid_v7()` is a SQL function in the schema, kept so the schema runs on PostgreSQL 16;
   PostgreSQL 18 has a native `uuidv7()` [SQL].
3. Ids generated on a client (reactions, messages, the offline outbox) are client ids used for
   idempotency ([1MM-ADR-0008](1MM-ADR-0008-IDEMPOTENCY-KEYS-AND-CLIENT-IDS.md)); they do not
   replace the server's primary key.
4. Ids shown to people are separate human references in the `PREFIX-n` pattern (OD-40), never
   the uuid.

## Alternatives considered

The sources record no alternatives.

**Analysis:** (a) `bigserial` keys are small and ordered but can be guessed and enumerated, and
collide across shards; (b) uuid v4 cannot be guessed but is random, which scatters B-tree inserts
and hurts cache locality on large tables such as messages; (c) application-generated ids (ULID,
Snowflake) need a generator service or library in every writer.

## Consequences

- Easier: ordered inserts; keyset pagination can use the id as the tie-breaker
  ([1MM-ADR-0009](1MM-ADR-0009-KEYSET-PAGINATION-AND-OPTIMISTIC-CONCURRENCY.md)); no id clash when
  tables are distributed.
- Harder: 16-byte keys and foreign keys are larger than integers; a uuid v7 reveals its creation
  time, so it must not be used where the time of creation is itself sensitive; ids are unreadable
  to staff, hence the human references.
- Cost: none.

## How it is applied

- `packages/db/migrations/0001_baseline_v3_4.sql` defines `uuid_v7()` and uses it as the default
  on entity tables. New tables in later migrations follow the same default.
- Contract schemas type ids as uuid strings.
- Check: migration review ([1MM-DB-02](../database/1MM-DB-02-MIGRATIONS.md)) rejects a new entity
  table whose key is not `uuid DEFAULT uuid_v7()`; structure rules in
  [1MM-DB-03](../database/1MM-DB-03-SQL-STRUCTURE.md).

## Revisit when

The database moves to PostgreSQL 18 or later: `uuid_v7()` can then be replaced by the native
function in a forward migration, with no change to stored ids.
