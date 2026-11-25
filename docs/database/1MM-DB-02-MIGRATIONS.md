# 1MM-DB-02 · Migrations

|              |                                                                                                                                                                                                                                                                                                                                                                             |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Document** | 1MM-DB-02                                                                                                                                                                                                                                                                                                                                                                   |
| **Status**   | Approved baseline · v1.0 · 24 Nov 2026                                                                                                                                                                                                                                                                                                                                      |
| **Audience** | Engineers and coding agents                                                                                                                                                                                                                                                                                                                                                 |
| **Owner**    | Engineering lead (code owners of `packages/db`)                                                                                                                                                                                                                                                                                                                             |
| **Sources**  | `packages/db/src/migrator.ts`, `packages/db/src/cli/migrate.ts`, `packages/db/src/cli/roles.ts`, `packages/db/roles/*.sql`, `packages/db/migrations/*`, `packages/db/package.json`, `drizzle.config.ts`, `.github/workflows/ci.yml`, `docs/USAGE.md`, [SQL], [TR §4.3], [TR §4.4], [TR §10.3], [TR §10.4], [TR §17.3], [DD §13B.6]                                          |
| **Related**  | [1MM-DB-01](1MM-DB-01-SCHEMAS.md), [1MM-DB-03](1MM-DB-03-SQL-STRUCTURE.md), [1MM-DB-04](1MM-DB-04-INDEXING.md), [1MM-DB-05](1MM-DB-05-SECURITY.md), [1MM-DB-06](1MM-DB-06-DATA-PROTECTION.md), [1MM-STD-06](../standards/1MM-STD-06-API-FIRST.md), [1MM-STD-01](../standards/1MM-STD-01-TESTING-STRATEGY.md), [1MM-LOG-03](../1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md) |

**What this document is for and when to open it.** It describes the migration system exactly as
the repo implements it, and the rules for writing, testing and releasing a schema change. Open it
before you add a file to `packages/db/migrations/`, when a migration fails, and when you plan a
deploy that includes one.

## 1. The system in one page

| Fact            | Value                                                                                                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Form            | Plain SQL files, `packages/db/migrations/NNNN_lower_snake_title.sql`                                                                                                                              |
| Direction       | Forward only. There are no down files and no rollback command                                                                                                                                     |
| Source of truth | The SQL files. Drizzle models are hand-curated from them; `drizzle-kit` never generates or pushes a migration (`drizzle.config.ts`)                                                               |
| Runner          | `packages/db/src/migrator.ts` (about 110 lines, no dependency besides `postgres`), driven by `src/cli/migrate.ts`                                                                                 |
| Bookkeeping     | Table `schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())` in `public`                                                              |
| Atomicity       | Each file runs as one transaction together with its ledger row                                                                                                                                    |
| Safety          | SHA-256 checksum per file; a session advisory lock against concurrent runners                                                                                                                     |
| Role            | The migration role (group `app_migrator`), through `DATABASE_MIGRATION_URL`, a direct (non-pooled) connection. No running app uses it                                                             |
| Files today     | `0001_baseline_v3_4.sql` (schema v3.4: 221 tables, copied as-is from the specification pack), `0006_partition_function_definer.sql` and `0007_trx_schema_change_set.sql` (schema change set 0007) |
| Next number     | `0008`                                                                                                                                                                                            |

The rules "numbered SQL in `packages/db`, expand-then-contract only, never edit an applied
migration, run as a gated step with the `app_migrator` role" come from [TR §10.3].

## 2. Numbering

1. A file name matches `^\d{4}_.+\.sql$`. Anything else in the folder is ignored by the runner
   (`README.md`, for example).
2. Files are applied in the order of a plain string sort of their names, so the four-digit number
   decides the order. The title after the number is `lower_snake_case` and says what the file does
   ([1MM-STD-14](../standards/1MM-STD-14-CODING-CONVENTIONS.md)).
3. One number, one file. Take the next free number when you open the pull request; if another
   pull request merges first with the same number, renumber yours before merging. The runner does
   not detect two files with the same number (GAP-DB02-04), so the reviewer checks it.
4. **Why `0002`–`0005` do not exist.** During the design stage each schema version shipped a delta
   beside the full file: `0002_v3_1_admin_cms.sql`, `0003_v3_2_owner_decisions.sql`,
   `0004_v3_3_owner_decisions.sql` and `0005_v3_4_design_review.sql` [TR §10.3]. The repo starts
   from the full v3.4 file as `0001`, which already contains all four deltas, so they are never run
   here and their numbers stay unused (`packages/db/migrations/README.md`). The first migration
   written in the repo therefore took `0006`.
5. `docs/USAGE.md` and `packages/db/migrations/README.md` said the next number was `0006` after
   that file existed (GAP-STD05-03 in
   [1MM-STD-05](../standards/1MM-STD-05-README-STANDARD.md), GAP-STD06-04 in
   [1MM-STD-06](../standards/1MM-STD-06-API-FIRST.md)). Both were corrected with migration `0007`
   and now say `0008`.
6. `0007_trx_schema_change_set.sql` is schema change set 0007 of the extensions log
   ([1MM-LOG-03](../1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md) section 3, SC-01 to SC-11):
   partitions for `edge_security_events`, the check-in window CHECK, the matching functions as
   definer with an actor guard, the `profiles_read` fix, 12 indexes, 11 config keys and 4 job
   rows. `pnpm db:roles` must follow it, because it revokes `EXECUTE` from `PUBLIC` on five
   functions.

## 3. The runner's algorithm

`migrate(url, { dir, log })` does this, in this order:

1. **Connect** with one connection (`max: 1`); server notices are discarded.
2. **Lock**: `SELECT pg_advisory_lock(1646974)`. This is a session-level lock with a constant
   key. A second runner started against the same database waits here until the first finishes, so
   two deploys cannot migrate at once.
3. **Ensure the ledger**: `CREATE TABLE IF NOT EXISTS schema_migrations (...)`.
4. **List the files**: read the folder, keep names that match the pattern, sort them, read each
   file as UTF-8 and compute `sha256(file text)` as a hex string.
5. **Read the ledger**: `SELECT name, checksum, applied_at FROM schema_migrations ORDER BY name`.
6. **Check for edits**: for every file on disk that has a ledger row, compare checksums. On the
   first difference the runner throws `Migration <name> was edited after it was applied. Restore it
and add a new numbered file instead.` and applies nothing.
7. **Apply each pending file** (on disk, not in the ledger), in name order. The file text and the
   statement `INSERT INTO schema_migrations (name, checksum) VALUES (...)` are concatenated and
   sent as one simple-protocol query. PostgreSQL runs a multi-statement simple query as a single
   implicit transaction, so the file and its ledger row commit together or not at all.
8. **Log** `applied <name> in <n> ms` per file, or `database is up to date` when nothing was
   pending. Return the list of applied names.
9. **Always**: release the advisory lock (errors ignored) and close the connection.

What follows from that:

| Behaviour                                                         | Detail                                                                                                                                                                                                                         |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A failing file changes nothing                                    | Its transaction rolls back, including the ledger row. Files applied earlier in the same run stay applied. The run stops at the first failure                                                                                   |
| A file is applied exactly once per database                       | The ledger decides, by file name                                                                                                                                                                                               |
| Any byte change to an applied file is fatal                       | The checksum covers the whole text, comments and whitespace included. `.prettierignore` excludes `packages/db/migrations`, so formatting never touches these files                                                             |
| A new enum value cannot be used in the file that adds it          | The whole file is one transaction, and a value added by `ALTER TYPE ... ADD VALUE` is usable only after commit                                                                                                                 |
| Statements that refuse to run inside a transaction cannot be used | `CREATE INDEX CONCURRENTLY`, `DROP INDEX CONCURRENTLY`, `REINDEX CONCURRENTLY`, `VACUUM`. Because the runner always appends the ledger insert, even a file with a single statement is a multi-statement query (GAP-DB02-01)    |
| The connection must be direct                                     | A session advisory lock does not survive a transaction-pooled connection. `src/cli/migrate.ts` uses `DATABASE_MIGRATION_URL` and falls back to `DATABASE_URL`; on Neon the migration URL is the un-pooled one (`.env.example`) |
| Session settings inside a file persist for the run                | The baseline sets `client_min_messages` and `TimeZone = 'UTC'`. A file must not change `search_path` or `session_replication_role` at session level                                                                            |

What the runner does **not** do, so people must:

- It has no down direction and no "mark as applied" command.
- It does not notice a ledger row whose file has been deleted, a pending file that sorts before an
  applied one, or two files sharing a number (GAP-DB02-04).
- It sets no `lock_timeout` or `statement_timeout`; a file sets its own (section 5.3).
- It has no dry run. `migrationStatus()` is the read-only view, and it too creates the ledger table
  if it is missing.
- A file must never contain `BEGIN`, `COMMIT` or `ROLLBACK`: an explicit `COMMIT` would end the
  implicit transaction and break the all-or-nothing guarantee.

## 4. Commands

All are root scripts (`package.json`) that call `packages/db` scripts; locally they read
`.env.development`.

| Command                              | What it does                                                                                                                                                                                                                             | Needs                                        |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `pnpm db:migrate`                    | `src/cli/migrate.ts up`: applies pending files as in section 3                                                                                                                                                                           | `DATABASE_MIGRATION_URL` (or `DATABASE_URL`) |
| `pnpm db:status`                     | `src/cli/migrate.ts status`: prints `applied  <name>` or `pending  <name>` for each file on disk                                                                                                                                         | The same URL                                 |
| `pnpm db:roles`                      | `src/cli/roles.ts`: runs `roles/roles.sql` (group roles, grants, default privileges, the `pgboss` schema). When `APP_ENV` is `local` it also runs `roles/local-logins.sql` (throwaway login users for docker compose and CI). Idempotent | `DATABASE_MIGRATION_URL` (no fallback)       |
| `pnpm db:pull`                       | `drizzle-kit pull` then `scripts/post-pull.mjs`: writes reference models to the git-ignored `packages/db/.introspected/`                                                                                                                 | A migrated database                          |
| `pnpm services:up` / `services:down` | Start or stop the local PostgreSQL 16 + PostGIS and Redis containers                                                                                                                                                                     | Docker                                       |
| `pnpm services:reset`                | `docker compose down -v && docker compose up -d --wait`: destroys the local database volume and starts empty. Local data is disposable                                                                                                   | Docker                                       |
| `pnpm dev`                           | Starts services and runs `pnpm db:migrate`, then `pnpm db:roles`, before the apps (`scripts/dev.mjs`)                                                                                                                                    | –                                            |

A fresh local database: `pnpm services:reset`, then `pnpm db:migrate`, then `pnpm db:roles`.

## 5. Authoring rules

### 5.1 Before you write SQL

1. The change exists as an accepted Technical Reference extension (section 12). No migration
   without one.
2. Read the table's block in the baseline, its `COMMENT`, and its entry in
   `packages/db/SCHEMA_DATA_DICTIONARY.md`. Check every trigger on the table (grep
   `ON <table> `): several tables refuse updates or need approvals (section 5.5).
3. Decide which phase the file is: **expand** (adds things old code ignores) or **contract**
   (removes things no deployed code uses). One file is one phase.

### 5.2 Rules that always apply

| #   | Rule                                                                                                                                                                                                                                                            | Why                                                                                                                                                                                                          |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Never edit, rename or delete a file that has been merged to `develop`. Fix forward with a new file                                                                                                                                                              | Staging migrates on merge [TR §17.3]; the checksum check then refuses the edited file                                                                                                                        |
| 2   | One concern per file, and the file is one transaction. No `BEGIN` / `COMMIT`                                                                                                                                                                                    | Section 3                                                                                                                                                                                                    |
| 3   | Expand, then contract [TR §10.3]. A contract file ships at least one release after the code stopped using the object                                                                                                                                            | Old API and worker processes keep running during a deploy                                                                                                                                                    |
| 4   | `ALTER TYPE ... ADD VALUE` goes in its own file, before the file that uses the value                                                                                                                                                                            | Section 3                                                                                                                                                                                                    |
| 5   | Write statements so that a second execution would be harmless where SQL allows it: `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `DROP ... IF EXISTS`, `ADD VALUE IF NOT EXISTS`, `INSERT ... ON CONFLICT DO NOTHING` | The runner applies a file once, but the same file is rehearsed on scratch databases and may meet an environment that was repaired by hand. The v3.4 delta followed the same rule ("idempotent", [DD §13B.6]) |
| 6   | Schema-qualify nothing; everything is in `public`                                                                                                                                                                                                               | [1MM-DB-01](1MM-DB-01-SCHEMAS.md) section 3                                                                                                                                                                  |
| 7   | Start the file with a header comment: number, one-line purpose, the gap id or decision that authorises it, phase (expand or contract), and any run note                                                                                                         | `0006_partition_function_definer.sql` is the model                                                                                                                                                           |
| 8   | Follow the naming, key, timestamp and `COMMENT ON` conventions of [1MM-DB-01](1MM-DB-01-SCHEMAS.md) and [1MM-DB-03](1MM-DB-03-SQL-STRUCTURE.md)                                                                                                                 | Uniformity                                                                                                                                                                                                   |
| 9   | Never write the retired plan's name, secrets, or real personal data in a migration, comment or seed                                                                                                                                                             | Public repo                                                                                                                                                                                                  |
| 10  | A file that adds a table also states its grants: nothing if the standard grants are right, otherwise a `REVOKE` added to `packages/db/roles/roles.sql` in the same pull request                                                                                 | Section 8                                                                                                                                                                                                    |

### 5.3 Lock-safe DDL

At launch the tables are empty and any DDL is instant. The rules below are for a database with
members in it, and are **Recommendation** unless a source is cited: the sources fix the principles
(expand then contract, gated step) but not the statement-level technique.

Start every file that alters an existing table with:

```sql
SET LOCAL lock_timeout = '5s';
```

so that a migration waiting behind a long transaction fails fast and can be retried, instead of
queueing every other query behind its lock request.

| Change                                 | Safe form                                                                                                                                                                                                                                                                                                              | Avoid                                                                                                         |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Add a column                           | `ADD COLUMN ... NULL`, or `NOT NULL DEFAULT <constant>` (no table rewrite on PostgreSQL 11 and later)                                                                                                                                                                                                                  | A volatile default such as `DEFAULT uuid_v7()` or `clock_timestamp()` on a large table: it rewrites the table |
| Make a column `NOT NULL`               | File 1: `ADD CONSTRAINT ck_<table>_<col>_nn CHECK (<col> IS NOT NULL) NOT VALID`. File 2: `VALIDATE CONSTRAINT`. File 3: `SET NOT NULL`, then drop the check                                                                                                                                                           | `SET NOT NULL` directly: a full scan under an exclusive lock                                                  |
| Add a `CHECK`                          | `ADD CONSTRAINT ... NOT VALID` in one file, `VALIDATE CONSTRAINT` in a later file                                                                                                                                                                                                                                      | Adding it validated in one step on a large table                                                              |
| Add a foreign key                      | `ADD CONSTRAINT ... FOREIGN KEY ... NOT VALID`, validate in a later file; index the referencing column first                                                                                                                                                                                                           | A validated foreign key in one step                                                                           |
| Add an index on a small or new table   | `CREATE INDEX IF NOT EXISTS` in the file                                                                                                                                                                                                                                                                               | –                                                                                                             |
| Add an index on a large table          | `CREATE INDEX CONCURRENTLY`, which the runner cannot execute today (GAP-DB02-01: the proposed opt-out is a first-line comment `-- migrate: no-transaction`). Until the runner supports it, a large-table index is built in a reviewed manual step and recorded as an extension; see [1MM-DB-04](1MM-DB-04-INDEXING.md) | Plain `CREATE INDEX` on a large hot table: it blocks writes for the whole build                               |
| Add an index on a partitioned table    | `CREATE INDEX ... ON ONLY <parent>`, build each partition's index, then `ALTER INDEX ... ATTACH PARTITION`; new partitions inherit it                                                                                                                                                                                  | `CREATE INDEX` on the parent of a large table: it locks every partition                                       |
| Rename a column or table               | Never in place. Add the new one, write both, backfill, switch readers, drop the old one in a contract file                                                                                                                                                                                                             | `RENAME`: old code breaks at once                                                                             |
| Change a column type                   | Add a new column, backfill, switch, drop                                                                                                                                                                                                                                                                               | `ALTER COLUMN ... TYPE` with a rewrite                                                                        |
| Drop a column, table, enum-backed rule | A contract file, after the release that stopped using it; confirm with a search of the codebase and a backup point (section 10)                                                                                                                                                                                        | Dropping in the same release                                                                                  |
| Replace a function                     | `CREATE OR REPLACE FUNCTION` with the same signature. A changed signature is a new function (expand), with the old one dropped later (contract)                                                                                                                                                                        | `DROP FUNCTION` then `CREATE`                                                                                 |
| Replace a view                         | `CREATE OR REPLACE VIEW` only appends columns. Anything else is drop and create, inside the one file                                                                                                                                                                                                                   | Leaving a moment with no view                                                                                 |
| Change a materialised view             | Drop and create, recreate its unique index, populate it once without `CONCURRENTLY`, and re-run `pnpm db:roles` (the `app_readonly` grants are per object)                                                                                                                                                             | Forgetting the unique index: `stats.refresh` refreshes concurrently and needs it                              |

Two details that are easy to miss:

- `CREATE OR REPLACE FUNCTION` keeps the owner and the grants but **resets every other property**
  to what the new statement says. A later migration that redefines `ensure_monthly_partitions()`
  or `is_blocked_pair()` must restate `SECURITY DEFINER` and `SET search_path`, or the worker loses
  its one DDL action (migration `0006`) and the profile policy stops seeing blocks.
- DDL on a partitioned parent takes its lock on every partition. Keep such files small.

### 5.4 Data changes and backfills

1. A migration may change **reference data**: seeds, catalogue rows, config keys (section 7.3).
2. A migration does not backfill **member data**. One file is one transaction; a large `UPDATE`
   would hold locks, bloat the table and block the deploy. A backfill is a worker job that walks
   the table by primary key in small batches, commits each batch, can be stopped and resumed, and
   is idempotent. The job is defined with `defineJob()` in `apps/worker/src/jobs/`, takes a name
   from the job catalogue [TR §11] (a new name is a Technical Reference extension) and gets a row
   in `worker_jobs`. **Recommendation:** batch size and pause are job parameters, not constants.
3. The order for a column that needs a backfill: expand file (nullable column) → release code that
   writes it → backfill job runs to completion → file that validates the constraint → release code
   that reads it → contract file for whatever it replaced.

### 5.5 Tables with their own rules

| Table or object                                                                                                                                     | What a migration must respect                                                                                                                                                                                                                                                                                                                                              | Source                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `admin_audit_log`, `consent_records`, `moderation_actions`, `content_revisions`, `consent_receipts`, `safety_escalation_updates`, `intro_decisions` | `forbid_mutation()` refuses `UPDATE` (and `DELETE`, except on `intro_decisions`, where only updates are refused). History is never rewritten by a migration                                                                                                                                                                                                                | [SQL] triggers          |
| `admin_audit_log` hash chain                                                                                                                        | Changing `admin_audit_row_hash()` or the set of audited fields invalidates every existing hash. It may only happen before the first audit row is written; afterwards the chain must be re-based by a separate, reviewed step                                                                                                                                               | [DD §13B.6], [TR §10.3] |
| `feature_flags`, `remote_config`, `rate_limit_policies`, `vendor_settings`, `site_settings`, `countries`, `cities`                                  | `enforce_config_approval()` runs on insert and update when `app_env()` is `production`. `app_env()` reads the connection setting `app.env` and treats unset as development. The migration role must therefore run without `app.env = 'production'`; seeds are authorised by the pull-request review and the Technical Reference extension, not by an `admin_approvals` row | [SQL] section 18.4      |
| `refunds`                                                                                                                                           | `refund_approval_guard()` is enforced in every environment; a migration never inserts admin refunds                                                                                                                                                                                                                                                                        | [SQL]                   |
| The ten CMS workflow tables                                                                                                                         | `content_workflow_guard()` and `content_snapshot()` fire on every insert and update; a seed must be a valid workflow state (drafts are simplest)                                                                                                                                                                                                                           | [SQL] section 18.3      |
| `legal_documents`                                                                                                                                   | A published row is immutable (`legal_published_immutable()`); publish a new version instead                                                                                                                                                                                                                                                                                | [SQL]                   |
| Partitioned tables                                                                                                                                  | Unique keys include the partition key; partitions are created by `ensure_monthly_partitions()`, never by hand-written `CREATE TABLE ... PARTITION OF`                                                                                                                                                                                                                      | [TR §10.2]              |
| Tables with row-level security                                                                                                                      | A new member-owned table enables RLS and adds its policies in the same file ([1MM-DB-05](1MM-DB-05-SECURITY.md))                                                                                                                                                                                                                                                           | [SQL] section 22        |

### 5.6 A new table: checklist

- [ ] `id uuid PRIMARY KEY DEFAULT uuid_v7()` (or the key kind from [1MM-DB-01](1MM-DB-01-SCHEMAS.md) section 6).
- [ ] `created_at`, and `updated_at` with a `trg_<table>_upd` trigger if rows are updated.
- [ ] Foreign keys with an explicit `ON DELETE` action, and an index on each referencing column
      that is searched or cascaded ([1MM-DB-04](1MM-DB-04-INDEXING.md)).
- [ ] State invariants as `CHECK` constraints; "only one" rules as unique or partial unique
      indexes ([1MM-DB-03](1MM-DB-03-SQL-STRUCTURE.md) section 4).
- [ ] `COMMENT ON TABLE` with purpose, screens, retention, PII class and the Citus note.
- [ ] RLS and grants decided ([1MM-DB-05](1MM-DB-05-SECURITY.md)); `roles.sql` updated if needed.
- [ ] Registered in the erasure and export manifests owned by MOD-16 (ruling R23) and given a
      retention rule ([1MM-DB-06](1MM-DB-06-DATA-PROTECTION.md)).
- [ ] Data dictionary entry, the counts in [1MM-DB-01](1MM-DB-01-SCHEMAS.md), and a Drizzle model
      if code reads it.

## 6. Partitions

Partitions are data-driven objects, not migrations.

1. The baseline created the first 14 months (November 2026 to December 2027) for eight parents;
   migration `0007` created the same 14 months for the ninth, `edge_security_events`.
2. The worker job `partitions.ensure` calls `ensure_monthly_partitions(<parent>, current_date, 3)`
   for the nine parents listed in `apps/worker/src/jobs/partitions-ensure.ts` at 03:00 UTC on the
   1st of each month. The function is `SECURITY DEFINER` (migration `0006`) and `app_worker` holds
   `EXECUTE` (`roles.sql`); `roles.test.ts` proves the worker can call it and `app_api` cannot.
3. A **new partitioned table** needs, in its migration: the parent, its `<parent>_default`
   partition, a call to `ensure_monthly_partitions()` for the current and following months, and a
   pull request that adds the table to `PARTITIONED_TABLES` in the worker. `edge_security_events`
   missed the third step in the baseline (GAP-DB01-01 in [1MM-DB-01](1MM-DB-01-SCHEMAS.md)); migration
   `0007` made the call.
4. Dropping old data is `partitions.retain` (detach, archive, drop), never a migration
   ([1MM-DB-06](1MM-DB-06-DATA-PROTECTION.md)).
5. Rows must not accumulate in a `DEFAULT` partition: PostgreSQL refuses to create a partition for
   a range that the default partition already holds rows for. **Recommendation:** alert when any
   `<parent>_default` is not empty.

## 7. Walkthroughs

The three examples use changes that module plans have proposed as gaps. They are shown to teach
the procedure; none is accepted until it appears in
[1MM-LOG-03](../1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md). File numbers are illustrative: use
the next free number.

### 7.1 Add a column

Example: `notification_templates.throttle` (proposed in GAP-MOD11-01,
[MOD-11](../execution/1MM-EXE-MOD-11-NOTIFICATIONS-AND-COMMUNICATIONS.md)).

1. Confirm the extension is recorded and the column name, type and default are final.
2. Create `packages/db/migrations/0007_notification_template_throttle.sql`:

   ```sql
   -- 0007 · notification_templates.throttle: machine-readable throttle (GAP-MOD11-01). Expand.
   SET LOCAL lock_timeout = '5s';
   ALTER TABLE notification_templates
     ADD COLUMN IF NOT EXISTS throttle jsonb NOT NULL DEFAULT '{"kind":"instant"}'::jsonb;
   ALTER TABLE notification_templates
     ADD CONSTRAINT ck_notification_templates_throttle CHECK (jsonb_typeof(throttle) = 'object');
   COMMENT ON COLUMN notification_templates.throttle IS
     'Machine-readable throttle read by notifications.deliver; throttle_rule stays as the label.';
   ```

   The table is a small catalogue (44 rows), so the constraint is added validated. On a large
   table it would be `NOT VALID` here and validated in a later file (section 5.3).

3. If existing rows need values, add the `UPDATE` to the same file only because this is reference
   data; member data would be a worker backfill (section 5.4).
4. `pnpm db:migrate`, then `pnpm db:roles`. Run `pnpm db:migrate` again: it must print
   `database is up to date`.
5. `pnpm db:pull`; copy the new column into the model in `packages/db/src/schema/` and tidy it.
6. Update the dictionary entry and the code that reads the column, add tests (section 11), and put
   all of it in one pull request.
7. Release order: this file is an expand, so it deploys before the code that uses the column.

### 7.2 Add an enum value

Example: `list_kind_t` value `challenge` with the rule that it applies only to scope `web`
(proposed in GAP-MOD17-01,
[MOD-17](../execution/1MM-EXE-MOD-17-NETWORK-AND-SECURITY-OPERATIONS.md)).

1. File one adds the value and nothing else:

   ```sql
   -- 0007 · list_kind_t + 'challenge' (GAP-MOD17-01). Expand. Own file: the value is usable only after commit.
   ALTER TYPE list_kind_t ADD VALUE IF NOT EXISTS 'challenge';
   ```

2. File two uses it:

   ```sql
   -- 0008 · ip_access_rules: challenge rules apply to the web scope only (GAP-MOD17-01). Expand.
   SET LOCAL lock_timeout = '5s';
   ALTER TABLE ip_access_rules
     DROP CONSTRAINT IF EXISTS ip_access_rules_scope_check,
     ADD CONSTRAINT ck_ip_access_rules_scope CHECK (scope IN ('admin','api','webhooks','web','all')),
     ADD CONSTRAINT ck_ip_access_rules_challenge_scope CHECK (list <> 'challenge' OR scope = 'web');
   ```

   The inline scope check in the baseline is unnamed, so it carries PostgreSQL's generated name
   (`<table>_<column>_check`); confirm the name on a migrated database before relying on it.

   Had both statements been in one file, the second would fail with "unsafe use of new value" and
   the whole file would roll back.

3. Enum values are append-only: a value cannot be removed or renamed without rebuilding the type.
   Check the spelling against the contract in `packages/contracts` before merging. A value that is
   no longer written stays as a documented legacy value, as `stripe` does in `payment_provider_t`.
4. Update the zod schema in `packages/contracts`, the Drizzle model, every exhaustive `switch` over
   the enum ([1MM-STD-16](../standards/1MM-STD-16-DEFENSIVE-PROGRAMMING.md)) and the enum list in
   [1MM-DB-01](1MM-DB-01-SCHEMAS.md) section 7.1.
5. Release order: both files before the code that writes the value. Clients that do not know the
   value must already tolerate it (generated clients are regenerated with
   `pnpm contracts:generate`).

### 7.3 Add a seeded config key

Example: `offline.cached_specs_max` (proposed in GAP-MOD00-05,
[MOD-00](../execution/1MM-EXE-MOD-00-FOUNDATIONS.md)).

1. Choose the key by the convention (dotted, domain first) and check it does not exist:
   grep the `remote_config` seed in the baseline and later migrations.
2. Create the file:

   ```sql
   -- 0007 · remote_config: offline.cached_specs_max (GAP-MOD00-05). Expand.
   INSERT INTO remote_config (key, value, value_type, description, is_public, source_ref) VALUES
     ('offline.cached_specs_max', '20', 'int', 'Deck cards kept for offline viewing (ES5)', true, 'CANVAS states-rules')
   ON CONFLICT (key) DO NOTHING;
   UPDATE remote_config
      SET min_value = 1, max_value = 50, unit = 'cards', group_key = 'discovery'
    WHERE key = 'offline.cached_specs_max' AND min_value IS NULL;
   ```

   The bounds in the `UPDATE` are placeholders for the walkthrough: real bounds come from the
   accepted extension. `permission_key` defaults to `config.remote`; set another permission only
   when the extension says so, as the baseline does for `safety.sanctions_ladder`.

3. `ON CONFLICT (key) DO NOTHING` is mandatory. A migration must never overwrite a value an admin
   has changed in the console. Changing the seeded value of an existing key is an owner decision
   and is written as `UPDATE ... WHERE key = '<key>' AND value = '<old seeded value>'`, so an
   edited value survives.
4. The insert is not blocked by the four-eyes trigger because the migration role runs without
   `app.env = 'production'` (section 5.5).
5. If code reads the key, add it to the typed config reader and, when `is_public`, to the config
   bootstrap contract (MOD-02); add or extend a seed assertion like the ones in
   `packages/db/src/schema/schema.test.ts`.
6. A database-side reader uses `config_int('<key>', <default>)` with the seeded value as the
   default ([1MM-DB-03](1MM-DB-03-SQL-STRUCTURE.md) section 3.6). If a `CHECK` constraint fixes the
   same number, the key cannot be editable beyond it: resolve that in the extension, not in code
   (see the open cases in [1MM-DB-03](1MM-DB-03-SQL-STRUCTURE.md) section 9).

The same pattern covers the other seeded catalogues: `feature_flags`, `rate_limit_policies`,
`site_settings`, `notification_templates`, `worker_jobs`, `admin_permissions` (with its grants in
`admin_role_permissions`), `entitlements` and `role_entitlements`.

## 8. Roles and grants after migrations

`pnpm db:roles` runs after every `pnpm db:migrate`, in every environment, as the same migration
role. `packages/db/roles/roles.sql` is idempotent and does five things:

1. Creates the six group roles if missing (`NOLOGIN`): `app_migrator`, `app_api`, `app_admin_api`
   (BYPASSRLS), `app_worker` (BYPASSRLS), `app_queue`, `app_readonly`.
2. Grants `USAGE` on `public` and `SELECT, INSERT, UPDATE, DELETE` on all tables (and sequence use)
   to `app_api`, `app_admin_api` and `app_worker`, and sets default privileges so that tables
   created by later migrations get the same grants.
3. Revokes: `UPDATE, DELETE` on the append-only ledgers (`admin_audit_log`, `consent_records`,
   `moderation_actions`, `content_revisions`, `consent_receipts`); every privilege of `app_api` on
   `admin_recovery_codes`, `vendor_settings`, `offer_codes`, `offer_claims`, `waitlist_entries`;
   every privilege of the three app roles on `schema_migrations`.
4. Grants `EXECUTE` on `ensure_monthly_partitions(text, date, int)` to `app_worker`; on
   `is_blocked_pair(uuid, uuid)` to `app_api`, `app_admin_api` and `app_worker`; on the four
   matching functions (`record_reaction`, `undo_reaction`, `decide_intro`, `unmatch`) to `app_api`
   and `app_worker` (migration `0007` revoked these five from `PUBLIC`); and `SELECT` on the
   aggregate views to `app_readonly`.
5. Creates the `pgboss` schema, makes `app_queue` its owner, and hands over any object pg-boss
   created earlier.

Rules for a migration author:

- A new table that the member API must not see, or that is append-only, needs its `REVOKE` line in
  `roles.sql` in the same pull request. The broad `GRANT ... ON ALL TABLES` runs first on every
  execution, so the revokes below it are what keep a table closed.
- A new `SECURITY DEFINER` function follows migration `0006`: pin `search_path`, `REVOKE EXECUTE
... FROM PUBLIC` in the migration, and grant `EXECUTE` to the one role that needs it in
  `roles.sql`.
- A new aggregate for analytics is granted to `app_readonly` by name in `roles.sql`.
- Login users are per environment and are not in the repo. `roles/local-logins.sql` creates the
  local ones (`minitman_api`, `minitman_admin`, `minitman_worker`, `minitman_queue`) only when
  `APP_ENV` is `local`; a hosted release step must set `APP_ENV` to its environment name
  (GAP-DB02-03).
- `packages/db/src/roles.test.ts` proves the separation on a real database: the member API cannot
  run DDL, read admin-only tables or the ledger; nobody can rewrite the audit log; the worker can
  create partitions only through the function; the queue role cannot read member data. Extend it
  when you add a revoke.
- `packages/db/src/change-set-0007.test.ts` is the behaviour test of migration `0007` and the
  model for the next one: it connects as the member API, worker, admin and queue logins, creates
  synthetic members, and removes or rolls back everything it writes.

The security model behind these roles is in [1MM-DB-05](1MM-DB-05-SECURITY.md).

## 9. Migrations in CI and in deployment

### 9.1 CI (`verify` in `.github/workflows/ci.yml`)

Every pull request gets a fresh `postgis/postgis:16-3.4` service container. The job copies
`.env.example` to `.env.development` and then runs, among its steps:

1. `pnpm db:migrate`: the whole chain on an empty PostgreSQL 16 + PostGIS.
2. `pnpm db:roles`: roles, grants and the local login users.
3. `pnpm test`: includes `roles.test.ts` and `schema/schema.test.ts` against that database.

This satisfies "CI must re-run the schema on PostgreSQL 16 + PostGIS 3.4 in a container"
[TR §10.4]. Still to build, tracked as `MOD-00-DB-02` in
[MOD-00](../execution/1MM-EXE-MOD-00-FOUNDATIONS.md): the parallel-connection behaviour tests
[TR §17.3] and the schema lint for Drizzle models. The database tests skip silently when their
URLs are missing (GAP-STD01-09 in
[1MM-STD-01](../standards/1MM-STD-01-TESTING-STRATEGY.md)).

### 9.2 Deployment

Migrations are a gated release step that runs before the new API and worker start
[TR §10.3], [TR §17.3], `docs/USAGE.md` section 9. Nothing in the service image runs them: the
container command is `bun dist/main.js` and the Railway configuration has no migration hook, by
design.

Order of a release that contains a migration (task `MOD-00-OPS-03` builds the pipeline):

1. The pull request merges to `develop` with `verify` green.
2. The release job runs `pnpm db:migrate` with the environment's `DATABASE_MIGRATION_URL` (direct
   connection, a login in group `app_migrator`), then `pnpm db:roles`.
3. If either fails, the release stops. The old services keep running against the unchanged (or
   expand-only) schema.
4. The API and worker deploy.
5. Staging runs on merge; production runs after approval, as an approved merge from `develop` to
   `production`.

Because every file is an expand or a late contract, step 2 is always compatible with the code that
is still running in step 3 and 4.

**Recommendation:** after step 2 the job runs `pnpm db:status` and fails if any line starts with
`pending`; and a migration pull request states in its description which phase it is and which
release may follow it.

### 9.3 Previews

**Recommendation:** rehearse a migration on a Neon branch before it reaches staging. A branch is a
copy-on-write copy of a database, created in seconds; the pull request's job creates a branch of
the **staging** project, runs `pnpm db:migrate` and `pnpm db:roles` against the branch's direct
URL, runs the database tests, and deletes the branch. This shows how the file behaves on
staging-sized tables (lock time, duration), which the empty CI container cannot.

Limits that the sources set: staging is a separate Neon project and never a branch of production
[TR §4.3]; no production data in lower environments [TR §4.4]. A preview branch is therefore never
taken from production. The web and admin preview deployments created per pull request [TR §4.4]
point at the shared lower environment, not at a migrated branch, unless the pull request says
otherwise.

## 10. Rollback: roll forward

There is no down migration. A bad change is corrected by a new file.

| Situation                                      | Action                                                                                                                                                                                                                                         |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The file failed to apply                       | Nothing changed (one transaction). If the file has not been merged, fix it. If it is merged, add a corrected file and leave the failing one in place only if it can never succeed anywhere; otherwise supersede it before the next environment |
| The file applied and the code is wrong         | Redeploy the previous service version. Expand-only files leave the old code working                                                                                                                                                            |
| The file applied and the schema is wrong       | A new file that reverses or corrects it (drop the column, restore the function body). Additive mistakes cost nothing to leave for one release                                                                                                  |
| A contract file removed something still needed | Restore from backup into a side database and copy the data back with a forward migration and a worker job. This is why a contract file waits one release and why the checklist asks for a backup point                                         |
| Data was damaged                               | Point-in-time restore                                                                                                                                                                                                                          |

Backups behind this [TR §10.3]: Neon point-in-time restore (window per plan); a nightly `pg_dump`
to the R2 `backups` bucket kept 30 days and a monthly copy kept 12 months; a restore drill every
quarter with targets RTO under 1 hour and RPO under 5 minutes. The nightly dump has no row in
`worker_jobs` yet (GAP-MOD00-01). Restore procedure and ownership:
[1MM-DB-06](1MM-DB-06-DATA-PROTECTION.md).

## 11. Testing a migration

| #   | Check                                               | How                                                                                                                                                                                                                                     |
| --- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Applies to an empty database                        | `pnpm services:reset`, `pnpm db:migrate`, `pnpm db:roles`                                                                                                                                                                               |
| 2   | The runner is stable when run twice                 | `pnpm db:migrate` again prints `database is up to date`; `pnpm db:roles` again succeeds unchanged; `pnpm db:status` shows every file `applied`                                                                                          |
| 3   | Applies on top of the previous head with data in it | Migrate a database to the previous head, load representative rows (the synthetic seed of GAP-STD01-08 when it exists), then apply the new file. An empty database hides `NOT NULL`, `CHECK` and unique violations                       |
| 4   | The statements are re-runnable where rule 5 says so | Execute the file's SQL a second time on a scratch database: it must succeed or fail only on statements that cannot be made idempotent. The v3.4 delta was verified this way: "applied twice equals a fresh v3.4" [TR §10.4]             |
| 5   | Behaviour                                           | A `bun test` beside the model that exercises the new rule on a real database: the constraint refuses what it should, the function returns what the contract says, the seed is present. Concurrency rules use two connections [TR §17.3] |
| 6   | Roles                                               | Extend `roles.test.ts` for any new revoke or definer function                                                                                                                                                                           |
| 7   | Models                                              | `pnpm db:pull`, compare with `src/schema/`; `pnpm typecheck`                                                                                                                                                                            |
| 8   | Plans                                               | For a new index or a query change on a hot path, the EXPLAIN check of [1MM-DB-04](1MM-DB-04-INDEXING.md)                                                                                                                                |
| 9   | Lock behaviour (existing tables with rows)          | On a staging-sized copy (section 9.3): duration and the lock taken                                                                                                                                                                      |
| 10  | Whole gate                                          | `pnpm check` locally before the pull request                                                                                                                                                                                            |

The schema's own behaviour tests (37 + 22 + 4 + 15 cases on PGlite, [TR §10.4]) lived with the
specification pack. Their subjects are listed in [DD §15]; re-creating them against PostgreSQL 16
with parallel connections is `MOD-00-DB-02`, and each module adds the tests for the functions it
calls ([1MM-STD-01](../standards/1MM-STD-01-TESTING-STRATEGY.md)).

## 12. From need to merged change

1. **Gap.** The need is written as a gap row of type `SCHEMA` with the exact proposed DDL or seed,
   in the document that found it.
2. **Extension.** The coordinator records it in
   [1MM-LOG-03](../1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md). The entry is the authority the
   migration header cites. An owner decision is needed when the gap is of type `DECISION`.
3. **Migration.** The next numbered file, written to this document.
4. **Roles.** `packages/db/roles/roles.sql` if grants change.
5. **Dictionary.** `packages/db/SCHEMA_DATA_DICTIONARY.md`: the table entry, the changelog line,
   and the totals if an object count changed.
6. **Database documents.** The counts and lists in [1MM-DB-01](1MM-DB-01-SCHEMAS.md); the function
   and trigger catalogue in [1MM-DB-03](1MM-DB-03-SQL-STRUCTURE.md); the index register in
   [1MM-DB-04](1MM-DB-04-INDEXING.md); retention in [1MM-DB-06](1MM-DB-06-DATA-PROTECTION.md).
7. **Model, contract, code, tests.** In the API-first order of
   [1MM-STD-06](../standards/1MM-STD-06-API-FIRST.md).
8. **Review.** `packages/db` has code owners; a migration needs their review like any other
   change, and the reviewer walks the checklist below.

## 13. Zero-downtime checklist

A reviewer ticks these for every migration that will run against a database with members in it.

- [ ] The file is an expand, or a contract whose object has been unused for at least one release.
- [ ] No `BEGIN` / `COMMIT`; no statement that needs to run outside a transaction.
- [ ] No use of an enum value added in the same file.
- [ ] `SET LOCAL lock_timeout` is present when an existing table is altered.
- [ ] No table rewrite: no volatile default, no in-place type change, no direct `SET NOT NULL` on a
      large table.
- [ ] New constraints on large tables are `NOT VALID`, with validation in a later file.
- [ ] No plain `CREATE INDEX` on a large hot table.
- [ ] No backfill of member data in the file.
- [ ] No rename in place.
- [ ] Functions are replaced with the same signature; `SECURITY DEFINER` and `search_path` are
      restated where they applied.
- [ ] Seeds use `ON CONFLICT DO NOTHING`; no admin-edited value is overwritten.
- [ ] Append-only and approval-guarded tables are respected (section 5.5).
- [ ] `roles.sql`, the dictionary, the models and the tests are in the same pull request.
- [ ] The old API and worker versions run correctly against the new schema (stated in the pull
      request).
- [ ] For a contract file: the backup point is noted and the restore path is known.

## 14. Gaps raised

Dispositions are recorded in [1MM-LOG-03](../1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md) (Technical Reference and schema), [1MM-LOG-02](../1MM-LOG-02-UI-UPDATES.md) (UI) and [1MM-LOG-04](../1MM-LOG-04-OPEN-DECISIONS-AND-FOLLOW-UPS.md) (owner decisions and repository follow-ups).

| Gap id      | Type | Where found                                                                                                                    | What is missing or conflicting                                                                                                                                                                                                                                                                                                | Proposed resolution                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Blocks                                                                                                   |
| ----------- | ---- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| GAP-DB02-01 | REPO | `packages/db/src/migrator.ts` (`sql.unsafe(file + ledger).simple()`) against [TR §15.2] (indexes on large, partitioned tables) | Every file is sent as a multi-statement query with the ledger insert appended, so PostgreSQL treats it as a transaction block. `CREATE INDEX CONCURRENTLY`, `DROP INDEX CONCURRENTLY` and `REINDEX CONCURRENTLY` cannot run through the runner at all, and there is no sanctioned way to build an index on a large live table | Add an opt-out to the runner: a file whose first line is `-- migrate: no-transaction` must contain exactly one statement; the runner executes it alone, then writes the ledger row in a second statement. Such a file must be re-runnable (`IF NOT EXISTS`), and the runner drops an `INVALID` index left by a failed concurrent build before retrying. Cover it with a test                                                                                         | Any index added after launch on `messages`, `reactions`, `notifications`, `analytics_events` and similar |
| GAP-DB02-02 | REPO | `packages/db/migrations/README.md` last line against `drizzle.config.ts` and `scripts/post-pull.mjs`                           | The README says `pnpm db:pull` "refresh[es] the Drizzle models in `src/schema/`". The command writes reference output to the git-ignored `.introspected/` and never touches `src/schema/`                                                                                                                                     | Reword: "then `pnpm db:pull` and copy the changed tables from `.introspected/` into `src/schema/`". Fix the stale "next number" sentence at the same time (GAP-STD05-03)                                                                                                                                                                                                                                                                                             | none                                                                                                     |
| GAP-DB02-03 | REPO | `packages/db/src/cli/roles.ts` (`(process.env.APP_ENV ?? 'local') === 'local'`)                                                | When `APP_ENV` is not set, `pnpm db:roles` assumes a local database and runs `roles/local-logins.sql`, which creates four login users with a published throwaway password, two of them with `BYPASSRLS`. A hosted release step that forgets `APP_ENV` would create them                                                       | Fail closed: require `APP_ENV` to be set; create the local logins only when it is `local` **and** the database host is `localhost` or `127.0.0.1` (or the CI service), otherwise exit with an error. Add a test                                                                                                                                                                                                                                                      | Hosted release pipeline (`MOD-00-OPS-03`)                                                                |
| GAP-DB02-04 | REPO | `packages/db/src/migrator.ts`; `scripts/check-repo-rules.mjs`                                                                  | The runner and the repo checks do not detect: two files with the same number, a pending file that sorts before an already applied one (a late-merged branch), or a ledger row whose file is gone. The runner also has no automated test (only `roles.test.ts` and `schema/schema.test.ts` exist in `packages/db`)             | (a) `pnpm check:repo` fails on duplicate numbers and on a number that is not greater than every number on the base branch, with `0002`–`0005` as the one documented hole. (b) `migrate()` refuses a pending file that sorts before the last applied name and warns on a ledger row without a file. (c) Add `migrator.test.ts`: applies once, second run is a no-op, an edited file is refused, a failing file leaves no ledger row, two concurrent runners serialise | none; needed before more than one contributor writes migrations                                          |

Status after migration `0007` (24 Nov 2026): GAP-DB02-02 is closed (the README now says that
`pnpm db:pull` writes to `.introspected/` and that the models are hand-curated, and gives the
right next number). In GAP-DB02-04, `packages/db` now has a third test file,
`change-set-0007.test.ts`; the runner itself still has no test. The other gaps are open.

## Change log

| Version | Date        | Change                                                                                                                                                                                                        |
| ------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v1.0    | 24 Nov 2026 | First issue, describing the runner at `packages/db/src/migrator.ts` and migrations `0001` and `0006`                                                                                                          |
| v1.1    | 24 Nov 2026 | Migration `0007_trx_schema_change_set.sql` added: files today, next number `0008`, partitions for `edge_security_events`, the new function grants in `roles.sql`, the behaviour test file; GAP-DB02-02 closed |
