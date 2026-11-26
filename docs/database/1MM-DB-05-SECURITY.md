# 1MM-DB-05 · Database security

|              |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Document** | 1MM-DB-05                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Status**   | Approved baseline · v1.0 · 24 Nov 2026                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Audience** | Engineers and coding agents                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Owner**    | Engineering lead (code owners)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Sources**  | `packages/db/roles/roles.sql`, `packages/db/roles/local-logins.sql`, `packages/db/migrations/0006_partition_function_definer.sql`, [SQL] (`packages/db/migrations/0001_baseline_v3_4.sql`) sections 0, 4, 20, 22, 26, `packages/db/src/client.ts`, `packages/db/src/migrator.ts`, `packages/db/src/cli/*.ts`, `packages/db/src/roles.test.ts`, `.env.example`, `apps/api/src/config/env.ts`, `apps/worker/src/config/env.ts`, `apps/worker/src/main.ts`, `.github/workflows/ci.yml`, [TR §4.3], [TR §4.4], [TR §7.1], [TR §7.3], [TR §8.1], [TR §8.4], [TR §10.3], [TR §11], [TR §13], [TR §14], [DD §13 RLS], [ADM §1.3], [ADM A07], [ADM A10], [OD-11]                    |
| **Related**  | [1MM-DB-01](1MM-DB-01-SCHEMAS.md), [1MM-DB-02](1MM-DB-02-MIGRATIONS.md), [1MM-DB-03](1MM-DB-03-SQL-STRUCTURE.md), [1MM-DB-04](1MM-DB-04-INDEXING.md), [1MM-DB-06](1MM-DB-06-DATA-PROTECTION.md), [1MM-STD-11](../standards/1MM-STD-11-SECURITY-AND-COMPLIANCE.md), [1MM-STD-12](../standards/1MM-STD-12-DATA-HANDLING.md), [1MM-STD-16](../standards/1MM-STD-16-DEFENSIVE-PROGRAMMING.md), [MOD-00](../execution/1MM-EXE-MOD-00-FOUNDATIONS.md), [MOD-01](../execution/1MM-EXE-MOD-01-ADMIN-ACCESS-AND-GOVERNANCE.md), [MOD-16](../execution/1MM-EXE-MOD-16-LEGAL-PRIVACY-AND-DATA-OPERATIONS.md), [MOD-17](../execution/1MM-EXE-MOD-17-NETWORK-AND-SECURITY-OPERATIONS.md) |

**What this document is for and when to open it.** It states who can do what inside PostgreSQL: the
roles, the grants, row-level security, definer functions, append-only ledgers and connection rules,
as they are in the repo today and as they are planned. Open it before any change to
`packages/db/roles/`, to a policy, to a `SECURITY DEFINER` function, to a database URL, or when a
module needs a new access path. The threat model is in
[1MM-STD-11](../standards/1MM-STD-11-SECURITY-AND-COMPLIANCE.md); what the data is and how long it
is kept is in [1MM-DB-06](1MM-DB-06-DATA-PROTECTION.md).

Each statement is marked by its state: **In place** (in the repo and tested), **Schema in place**
(in the migration, not yet exercised by application code), **Planned** (a named task), or
**Recommendation** (this document's advice where the sources are silent). Findings made by reading
the SQL, without running a database, say so; they must be confirmed by the role tests of
`MOD-00-DB-01` and `MOD-00-DB-02` on PostgreSQL 16.

## 1. Layers

| Layer     | Control                                                                                                                 | State                                                 |
| --------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Network   | TLS only; per-environment credentials; IP allow-list to Railway static outbound IPs on paid plans [TR §13.1], [TR §4.3] | Planned (MOD-00 OPS)                                  |
| Login     | One login user per program, member of exactly one group role                                                            | In place locally and in CI                            |
| Privilege | Six group roles; no DDL for any running program                                                                         | In place                                              |
| Row       | Row-level security for the member API on 10 tables                                                                      | Schema in place                                       |
| Function  | Two `SECURITY DEFINER` functions with a pinned `search_path`                                                            | In place (one), schema in place (one)                 |
| Ledger    | Triggers and revoked grants make seven tables append-only; the audit log is hash-chained                                | Schema in place                                       |
| Statement | Parameterised queries only                                                                                              | In place (scaffold); lint rule missing (GAP-STD11-02) |
| Change    | Migrations and role files are code-owned and applied by a gated step                                                    | In place in CI; deploy planned (MOD-00-OPS-03)        |

## 2. The role model

### 2.1 Group roles

`packages/db/roles/roles.sql` creates six **group** roles with `NOLOGIN`. It is idempotent and is
run by `pnpm db:roles` after every migration. Applications never log in as a group role.

| Group role      | `BYPASSRLS` | Purpose                                                               | Can                                                                                                                                                                                                           | Cannot                                                                                                                                                                                                            |
| --------------- | ----------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app_migrator`  | no          | Owns the schema; used only by `pnpm db:migrate` in a release step     | DDL; `schema_migrations`                                                                                                                                                                                      | Be used by a running service. See GAP-DB05-05: today the role is created but owns nothing                                                                                                                         |
| `app_api`       | no          | Member API (`/v1`) and public API (`/public/v1`)                      | `SELECT`, `INSERT`, `UPDATE`, `DELETE` on tables in `public`, subject to row-level security; sequences                                                                                                        | DDL; `UPDATE` or `DELETE` on the five ledgers below; anything on `admin_recovery_codes`, `vendor_settings`, `offer_codes`, `offer_claims`, `waitlist_entries`, `schema_migrations`; `ensure_monthly_partitions()` |
| `app_admin_api` | yes         | Admin API (`/admin/v1`): permissions are enforced in code and audited | The same DML on every table, not filtered by policies                                                                                                                                                         | DDL; `UPDATE` or `DELETE` on the ledgers; `schema_migrations`                                                                                                                                                     |
| `app_worker`    | yes         | Background jobs                                                       | The same DML, not filtered by policies; `EXECUTE` on `ensure_monthly_partitions(text, date, int)`                                                                                                             | Any other DDL; `UPDATE` or `DELETE` on the ledgers; `schema_migrations`                                                                                                                                           |
| `app_queue`     | no          | pg-boss                                                               | Owns schema `pgboss` and everything in it                                                                                                                                                                     | Anything in `public`: it has no `USAGE` on the schema                                                                                                                                                             |
| `app_readonly`  | no          | Analytics                                                             | `SELECT` on `mv_admin_daily_kpis`, `mv_revenue_daily`, `mv_moderation_sla`, `v_research_summary`, `mv_admin_daily_kpis_by_country`, `mv_active_users_daily`, `store_installs_daily`, `api_request_ip_rollups` | Read any other table; write anything                                                                                                                                                                              |

How the grants are built, in file order:

1. `USAGE` on schema `public` to `app_api`, `app_admin_api`, `app_worker`, `app_readonly`.
2. `SELECT, INSERT, UPDATE, DELETE` on **all** tables and `USAGE, SELECT` on all sequences to the
   three data roles, plus `ALTER DEFAULT PRIVILEGES` so tables from later migrations get the same.
3. `REVOKE UPDATE, DELETE` on `admin_audit_log`, `consent_records`, `moderation_actions`,
   `content_revisions`, `consent_receipts` from all three data roles.
4. `REVOKE ALL` on `admin_recovery_codes`, `vendor_settings`, `offer_codes`, `offer_claims`,
   `waitlist_entries` from `app_api`.
5. `REVOKE ALL` on `schema_migrations` from all three data roles.
6. `GRANT EXECUTE` on `ensure_monthly_partitions` to `app_worker`.
7. `SELECT` on the eight aggregate objects to `app_readonly`.
8. Schema `pgboss` created and handed to `app_queue`, with every table, view, sequence, enum and
   routine already in it.

Three facts about this design that every change must respect:

- **It is deny-by-exception, not allow-by-list.** A new table is readable and writable by
  `app_api`, `app_admin_api` and `app_worker` the moment it exists. A table the member API must not
  touch needs an explicit `REVOKE` in `roles.sql` in the same pull request (section 14).
- **`ALTER DEFAULT PRIVILEGES` applies to objects created by the role that ran it.** Migrations and
  `pnpm db:roles` must run as the same login, or new tables arrive without grants until the next
  `pnpm db:roles`. Running `pnpm db:roles` after every migration, as CI does, covers this.
- **`BYPASSRLS` is not inherited from a group.** It is an attribute of the login itself
  (`local-logins.sql` says so and sets it on the login). A hosted admin or worker login created
  without it is filtered by row-level security and sees no rows.

### 2.2 Access by table group

"RLS" means the member API sees only rows its policies allow (section 4). "All rows" means the
grant is not filtered and the application's own `WHERE` clause is the only limit.

| Table group                                                                                                | `app_api`                                                                                                | `app_admin_api`                             | `app_worker` | `app_readonly`                                                                                  |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------- |
| Catalogues, plans, config, i18n                                                                            | Read and write, all rows (writes are an admin action in code)                                            | Read, write                                 | Read, write  | None                                                                                            |
| Identity and auth (`users`, `password_credentials`, `sessions`, `refresh_tokens`, `otp_challenges`, …)     | Read, write, all rows                                                                                    | Read, write                                 | Read, write  | None                                                                                            |
| Profile                                                                                                    | `profiles`: RLS. Other profile tables: all rows                                                          | Read, write                                 | Read, write  | None                                                                                            |
| Verification (`liveness_sessions`, `face_templates`, …)                                                    | Read, write, all rows. `reverification_requests`: RLS, read own only                                     | Read, write                                 | Read, write  | None                                                                                            |
| Discovery and matching                                                                                     | `reactions`: RLS. Others: all rows                                                                       | Read, write                                 | Read, write  | None                                                                                            |
| Messaging                                                                                                  | `messages`, `conversation_participants`: RLS. Others: all rows                                           | Read, write                                 | Read, write  | None                                                                                            |
| Groups, meet-ups, safety                                                                                   | `trusted_contacts`: RLS. Others: all rows                                                                | Read, write                                 | Read, write  | None                                                                                            |
| Trust and safety                                                                                           | `blocks`: RLS. `moderation_actions`: read and insert only. Others: all rows                              | Same, with `moderation_actions` insert-only | Same         | None                                                                                            |
| Billing                                                                                                    | Read, write, all rows                                                                                    | Read, write                                 | Read, write  | `mv_revenue_daily` only                                                                         |
| Notifications and support                                                                                  | `inbox_items`: RLS. Others: all rows                                                                     | Read, write                                 | Read, write  | None                                                                                            |
| Legal and privacy                                                                                          | `consent_records`: RLS, read and insert only. `data_export_requests`: RLS. Others: all rows              | `consent_records` insert-only               | Same         | None                                                                                            |
| Admin identity and governance (`admin_users`, `admin_sessions`, `admin_mfa_factors`, `admin_approvals`, …) | Read, write, all rows, except `admin_recovery_codes` (none) and `admin_audit_log` (read and insert only) | Read, write; audit log insert-only          | Same         | None                                                                                            |
| Platform secrets references (`vendor_settings`)                                                            | None                                                                                                     | Read, write                                 | Read, write  | None                                                                                            |
| Offers and waitlist (`offer_codes`, `offer_claims`, `waitlist_entries`)                                    | None                                                                                                     | Read, write                                 | Read, write  | None                                                                                            |
| Website CMS                                                                                                | Read, write, all rows. `content_revisions`, `consent_receipts`: read and insert only                     | Same                                        | Same         | None                                                                                            |
| Analytics and network logs                                                                                 | Read, write, all rows                                                                                    | Read, write                                 | Read, write  | `store_installs_daily`, `api_request_ip_rollups`, the five `mv_*` objects, `v_research_summary` |
| `schema_migrations`                                                                                        | None                                                                                                     | None                                        | None         | None                                                                                            |
| Schema `pgboss`                                                                                            | None                                                                                                     | None                                        | None         | None (owner: `app_queue`)                                                                       |

The breadth of the `app_api` column is a finding: the member API's role can read and change staff
credentials, moderation records and every member's billing rows. See GAP-DB05-07 and section 4.3.

### 2.3 Login roles

`packages/db/roles/local-logins.sql` is for the docker-compose database and CI only. `pnpm db:roles`
applies it only when `APP_ENV` is `local` (the default when unset). It creates four logins with a throwaway password:

| Login             | Member of       | `BYPASSRLS` |
| ----------------- | --------------- | ----------- |
| `minitman_api`    | `app_api`       | no          |
| `minitman_admin`  | `app_admin_api` | yes         |
| `minitman_worker` | `app_worker`    | yes         |
| `minitman_queue`  | `app_queue`     | no          |

The local schema owner is the compose superuser `minitman` (`docker-compose.yml`), which is what
`DATABASE_MIGRATION_URL` points at locally. There is no local login for `app_readonly` and none for
`app_migrator` (GAP-DB05-05).

Hosted environments create their own logins with generated passwords, in the shape the file shows:
`CREATE ROLE <name> LOGIN PASSWORD '<generated>' IN ROLE app_api;`, adding `BYPASSRLS` for the
admin and worker logins. One login per program per environment; a login is a member of exactly one
group. **To verify during provisioning** (`MOD-00-OPS`): that the Neon project's administrative
role is allowed to create a login with `BYPASSRLS`. This document has not tested it.

### 2.4 How the tests prove isolation

`packages/db/src/roles.test.ts` connects as three logins (`DATABASE_URL`, `WORKER_DATABASE_URL`,
`QUEUE_DATABASE_URL`) and is skipped when any is unset. CI runs it after `pnpm db:migrate` and
`pnpm db:roles` on PostgreSQL 16 + PostGIS.

| Test                                                                      | Proves                                                                                                                            |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| The member API reads data but cannot change the schema                    | `app_api` can `SELECT` from `remote_config`; `CREATE TABLE`, `DROP TABLE`, `ALTER TABLE` are refused                              |
| The member API cannot touch admin-only tables or the migration ledger     | `SELECT` on `vendor_settings`, `admin_recovery_codes`, `schema_migrations` is refused                                             |
| Nobody can rewrite the audit log                                          | `DELETE` as the API and `UPDATE` as the worker on `admin_audit_log` are refused                                                   |
| The worker cannot run DDL, except partitions through the definer function | `CREATE TABLE` refused; `ensure_monthly_partitions('messages', current_date, 1)` succeeds as the worker and is refused as the API |
| The queue role owns `pgboss` and cannot read member data                  | Creates and drops a probe table in `pgboss`; `SELECT` on `users` and `remote_config` is refused                                   |

`packages/db/src/change-set-0007.test.ts` (added with migration `0007`) connects as four logins
(the three above and `ADMIN_DATABASE_URL`) and proves the matching functions, their actor guard,
the `profiles_read` policy and the grants on `is_blocked_pair()` as the member API login (sections
4.3 and 5).

Not yet covered, and planned with `MOD-00-DB-01` and `MOD-00-DB-02`
([MOD-00](../execution/1MM-EXE-MOD-00-FOUNDATIONS.md)): the admin login; `app_readonly`; every
row-level security policy with two members on parallel connections; the append-only triggers;
the remaining revoked tables (`offer_codes`, `offer_claims`, `waitlist_entries`, `consent_records`,
`moderation_actions`, `content_revisions`, `consent_receipts`). **Recommendation:** make the role
test table-driven from a list of (role, object, action, expected) rows so a new `REVOKE` or policy
adds one line.

## 3. Which process connects as which role

| Process                             | Variable                                                 | Role            | Connection                                                                       | State                                                                                                                                                            |
| ----------------------------------- | -------------------------------------------------------- | --------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API, member and public surfaces     | `DATABASE_URL`                                           | `app_api`       | Pooled at runtime (Neon pooler in production)                                    | In place: `apps/api/src/main.ts` opens one pool, `applicationName: 'api'`, default `max` 10                                                                      |
| API, admin surface                  | `ADMIN_DATABASE_URL`                                     | `app_admin_api` | Pooled                                                                           | In place (`MOD-00-DB-01`): validated in `apps/api/src/config/env.ts`; `main.ts` opens a second pool, `surface: 'admin'`, `applicationName: 'api-admin'`, `max` 5 |
| Worker jobs                         | `WORKER_DATABASE_URL`                                    | `app_worker`    | Pooled                                                                           | In place: `applicationName: 'worker'`, `max` 4                                                                                                                   |
| Worker queue (pg-boss)              | `QUEUE_DATABASE_URL`                                     | `app_queue`     | **Direct**, not pooled                                                           | In place: `createSchema: false`, `application_name: 'worker-queue'`                                                                                              |
| `pnpm db:migrate`, `pnpm db:status` | `DATABASE_MIGRATION_URL`, falling back to `DATABASE_URL` | schema owner    | **Direct**: the runner holds a session advisory lock, which a pooler cannot keep | In place                                                                                                                                                         |
| `pnpm db:roles`                     | `DATABASE_MIGRATION_URL` only                            | schema owner    | Direct                                                                           | In place                                                                                                                                                         |
| Analytics tools                     | none defined                                             | `app_readonly`  | –                                                                                | Planned: no variable and no login exist yet                                                                                                                      |

Rules:

1. One pool per role. Code never switches role inside a connection.
2. No running service is given `DATABASE_MIGRATION_URL`. It exists in the release step only.
3. `apps/api` validates `DATABASE_URL` and `ADMIN_DATABASE_URL` at start-up; the worker validates
   both of its URLs. A missing URL stops the process.
4. The fallback from `DATABASE_MIGRATION_URL` to `DATABASE_URL` in `src/cli/migrate.ts` is safe:
   as `app_api` the first DDL statement is refused. It is still wrong in a hosted release step,
   which must set the migration URL explicitly.
5. Every connection runs in UTC (`client.ts` sets `TimeZone`), which the schema assumes.
6. `app.env` is a per-login role setting (`ALTER ROLE … SET app.env`, TRX-056) and is not sent as
   a startup parameter, which transaction-mode poolers refuse. The three transaction helpers set
   it with `set_config(..., true)` from `APP_ENV` only when the session has no value (local and
   test databases), so the role setting always wins. API and worker start-up call
   `assertAppEnv()`, which refuses to start production unless `app_env()` reports `production`.

## 4. Row-level security

### 4.1 How the member identity reaches the database

`app_current_user_id()` returns `nullif(current_setting('app.user_id', true), '')::uuid` [SQL
section 0]. The member API sets `SET LOCAL app.user_id = '<uuid>'` at the start of each
transaction [TR §8.1], [DD §13 RLS]. Built in `MOD-00-DB-01` as `withMemberTx(database, memberId,
fn)` in `packages/db/src/transactions.ts`: one transaction on the `app_api` pool, the setting
first, and no member query outside it. It refuses a pool that is not the member pool and a member
id that is not a UUID. `withAdminTx` and `withWorkerTx` refuse any other pool and clear
`app.user_id` for their transaction.

Rules for the implementation:

1. Use `SET LOCAL` (or `set_config('app.user_id', $1, true)`) inside a transaction, never a session
   `SET`. Through a transaction-mode pooler a session setting would leak to the next request that
   gets the same server connection.
2. Pass the id as a bound parameter through `set_config`. The value comes from the verified access
   token, never from the request body or path.
3. A malformed value raises a cast error, which fails closed. An unset value is `NULL`, and a
   policy comparing with `NULL` matches nothing. `profiles_read` was the one exception until migration `0007` (section 4.3
   finding 2).
4. Table owners bypass row-level security because the schema does not use `FORCE` [SQL section 22].
   Migrations are therefore unaffected, and so is any `SECURITY DEFINER` function, which runs as
   its owner.
5. `app_admin_api` and `app_worker` bypass policies. Their protection is the admin permission check
   plus audit, and job code review.

### 4.2 Every policy

Counted by `grep -c '^CREATE POLICY'` (14) and `grep -c 'ENABLE ROW LEVEL SECURITY'` (10) on the
baseline. Policies are permissive and apply to every role without `BYPASSRLS`.

| Table                       | Policy             | Command | Predicate                                                                                                                                   |
| --------------------------- | ------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`                  | `profiles_read`    | SELECT  | A member context is set (migration `0007`), and: own row, or the profile is not hidden and `is_blocked_pair(me, profiles.user_id)` is false |
| `profiles`                  | `profiles_write`   | UPDATE  | `user_id = me`, same in `WITH CHECK`                                                                                                        |
| `reactions`                 | `reactions_own`    | SELECT  | `actor_id = me OR target_id = me`                                                                                                           |
| `reactions`                 | `reactions_insert` | INSERT  | `WITH CHECK (actor_id = me)`                                                                                                                |
| `conversation_participants` | `cp_own`           | ALL     | `user_id = me`, same in `WITH CHECK`                                                                                                        |
| `messages`                  | `messages_read`    | SELECT  | A `conversation_participants` row exists for me in that conversation with `hidden_at IS NULL`                                               |
| `messages`                  | `messages_send`    | INSERT  | `sender_id = me` and I am a participant                                                                                                     |
| `inbox_items`               | `inbox_own`        | ALL     | `user_id = me`, same in `WITH CHECK`                                                                                                        |
| `consent_records`           | `consents_own`     | SELECT  | `user_id = me`                                                                                                                              |
| `consent_records`           | `consents_add`     | INSERT  | `WITH CHECK (user_id = me)`                                                                                                                 |
| `trusted_contacts`          | `trusted_own`      | ALL     | `user_id = me`, same in `WITH CHECK`                                                                                                        |
| `blocks`                    | `blocks_own`       | ALL     | `blocker_id = me`, same in `WITH CHECK`                                                                                                     |
| `data_export_requests`      | `exports_own`      | ALL     | `user_id = me`, same in `WITH CHECK`                                                                                                        |
| `reverification_requests`   | `reverify_own`     | SELECT  | `user_id = me`                                                                                                                              |

`me` is `app_current_user_id()`.

What a missing command means: with row-level security enabled and no policy for a command, that
command is denied for the member role. So, as written, `app_api` cannot `INSERT` or `DELETE`
`profiles`, cannot `UPDATE` or `DELETE` `reactions` or `messages`, and cannot write
`reverification_requests`. Some of these are intended ("writes are admin-only" on
`reverification_requests`); others collide with the functions the API calls (finding 1 below).

### 4.3 Findings

The schema calls section 22 a "sketch" and says "Extend to every member-owned table". These four
findings are what that leaves open. Findings 1 to 3 were made by reading the SQL.

**Finding 1. The matching functions and the policies do not fit together (GAP-DB05-02). Fixed in
migration 0007.** Migration `0007_trx_schema_change_set.sql` (SC-02, SC-06, TRX-048) makes the four
functions `SECURITY DEFINER` with `search_path = public, pg_temp` and an actor guard, revokes
`EXECUTE` from `PUBLIC` and grants it to `app_api` and `app_worker` (section 5).
`change-set-0007.test.ts` runs the whole flow as the `app_api` login on PostgreSQL 16. What was
found, kept for the record: in the baseline `record_reaction()`, `undo_reaction()`,
`decide_intro()` and `unmatch()` are ordinary (`SECURITY INVOKER`) functions, so they ran with the
caller's policies. Called on the `app_api` pool:

- `record_reaction()` upserts into `reactions` with `ON CONFLICT … DO UPDATE`. There is no UPDATE
  policy on `reactions`, so a member changing an earlier reaction (a Like after an expired Pass) is
  refused.
- `undo_reaction()` runs `UPDATE reactions`. With no UPDATE policy it matches no row and raises
  "nothing to undo".
- `decide_intro()` inserts both members' rows into `conversation_participants`. `cp_own` allows
  only the caller's own row, so creating the chat on a both-keep decision is refused.
- `record_reaction()` checks `blocks` in both directions, but `blocks_own` shows the caller only
  the blocks they placed. A block placed by the target is invisible to the function, so a blocked
  member's reaction is not refused. The definer change proposed in GAP-DB05-02 also closes this.

[TR §10.4] records these behaviours as tested, but on PGlite with a single connection, which is not
the `app_api` role. Until migration `0007` the "race-free matching" path of [TR §8.4] could not run
as the member role.

**Finding 2. An unauthenticated session can read every visible profile (GAP-DB05-03). Fixed in
migration 0007.** The policy now begins with `app_current_user_id() IS NOT NULL` (SC-05, TRX-047),
so a session with no member context reads no profile; tested as the `app_api` login. What was
found: in
`profiles_read`, when `app.user_id` is unset the first branch is `NULL`, but the second branch is
true for every profile that is not hidden, because `is_blocked_pair(NULL, x)` returns false. The
public surface runs as `app_api` with no member id, so the policy does not stop a public query from
reading `profiles`. The other nine tables do return nothing in that case.

**Finding 3. `profiles_read` is a visibility rule, not a discovery rule.** Any signed-in member's
transaction may read any non-hidden, non-blocked profile. Incognito, restricted accounts, distance,
preferences and the daily cap are enforced by the discovery query and `spend_spec_view()`
[TR §8.5], not by the policy. That is by design, and it means a profile endpoint must still check
that the caller is entitled to see that profile.

**Finding 4. Most member-owned tables have no policy (GAP-DB05-01).** Of the 79 tables with a
`user_id` foreign key to `users`, 7 have row-level security and 72 do not (counted with script B of
[1MM-DB-04](1MM-DB-04-INDEXING.md); the other three protected tables key on `actor_id`,
`blocker_id` and the conversation). Unprotected member-owned tables include the following; a few
(`support_messages`, `group_messages`, `group_invites`) key the member on a differently named
column and are outside the 72:

| Group                       | Tables without a policy                                                                                                                                 | Already noted by                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Billing                     | `subscriptions`, `transactions`, `invoices`, `payment_methods`, `billing_customers`, `trials`, `entitlement_grants`, `billing_credits`, `lapse_choices` | [MOD-10](../execution/1MM-EXE-MOD-10-BILLING-PLANS-AND-ENTITLEMENTS.md) risk table   |
| Notifications               | `notifications`, `push_tokens`, `notification_preferences`                                                                                              | [MOD-11](../execution/1MM-EXE-MOD-11-NOTIFICATIONS-AND-COMMUNICATIONS.md) risk table |
| Support                     | `support_tickets`, `support_messages`, `feedback`                                                                                                       | [MOD-14](../execution/1MM-EXE-MOD-14-SUPPORT-AND-HELP.md) rule 6 and risk table      |
| Groups                      | `group_members`, `group_messages`, `group_invites`                                                                                                      | [MOD-12](../execution/1MM-EXE-MOD-12-GROUPS.md) §3.1                                 |
| Identity and credentials    | `password_credentials`, `sessions`, `devices`, `phone_numbers`, `oauth_identities`, `otp_challenges`                                                    | this document                                                                        |
| Verification and biometrics | `liveness_sessions`, `face_templates`, `badge_applications`, `verification_records`                                                                     | this document                                                                        |
| Profile detail              | `profile_answers` (genotype and faith), `partner_preferences`, `media_assets`, `prompt_answers`, `user_settings`                                        | this document                                                                        |
| Safety                      | `safety_checkins`, `safety_escalations`, `meetup_shares`, `appeals`, `account_restrictions`                                                             | this document                                                                        |

Is that intended? Partly. The sources say the member API is subject to row-level security "for
member reads" [TR §13.1] and tell the builder to extend the sketch; they do not list which tables
are exempt. Tables that only the admin API and the worker use (the network tables in
[MOD-17](../execution/1MM-EXE-MOD-17-NETWORK-AND-SECURITY-OPERATIONS.md), catalogues in MOD-02)
need a `REVOKE`, not a policy. For member-owned tables, today's only protection is the `WHERE
user_id = $me` in each query, which those module plans cover with a test per route. No earlier
document raised a gap id for this; it is raised here as GAP-DB05-01.

The order of work (**Recommendation**): finding 1 came first, because every new policy on a
table that a function writes repeats the same collision, and is fixed in migration `0007`. Still
open: add policies module by module (finding 4, GAP-DB05-01, TRX-054), each with a two-member
isolation test, starting with billing, credentials, biometrics and the sensitive profile answers.
A function that writes a newly protected table for a member needs the same definer-and-guard
treatment (`spend_spec_view()` and `redeem_beta_invite()` are not yet reviewed).

## 5. `SECURITY DEFINER` functions

Of the 40 functions in the schema, six run with their owner's rights after migration `0007` (two
before it; counted with `SELECT count(*) FROM pg_proc WHERE prosecdef` over the schema's own
functions).

| Function                                                                                                                                                                | Why                                                                                                                                                                                  | `search_path`                                         | Who may execute                                                                                | State                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `ensure_monthly_partitions(text, date, int)`                                                                                                                            | Lets the worker create monthly partitions without DDL rights. Migration `0006_partition_function_definer.sql` sets `SECURITY DEFINER`                                                | `public, pg_temp` (set by 0006)                       | `PUBLIC` revoked by 0006; `app_worker` granted by `roles.sql`                                  | In place; tested as the worker and as the API                                                                           |
| `is_blocked_pair(uuid, uuid)`                                                                                                                                           | Lets the `profiles_read` policy see blocks in both directions although `blocks` has its own policy                                                                                   | `public, pg_temp` (set by 0007; `public` only before) | `PUBLIC` revoked by 0007; `app_api`, `app_admin_api`, `app_worker` granted by `roles.sql`      | In place; tested as the API, the admin and the queue login (refused)                                                    |
| `record_reaction(uuid, uuid, reaction_t, uuid, feed_surface_t)`, `undo_reaction(uuid, uuid, text)`, `decide_intro(uuid, uuid, intro_decision_t)`, `unmatch(uuid, uuid)` | The member role cannot run them under its own policies (section 4.3 finding 1). Migration `0007_trx_schema_change_set.sql` re-creates them as `SECURITY DEFINER` with an actor guard | `public, pg_temp` (set by 0007)                       | `PUBLIC` revoked by 0007; `app_api`, `app_worker` granted by `roles.sql` (not `app_admin_api`) | In place; tested as the API (with, without and with another member's context), the worker and the admin login (refused) |

Rules for any definer function:

1. Pin `SET search_path = public, pg_temp`, with `pg_temp` last and explicit. If `pg_temp` is not
   listed, PostgreSQL searches it first for tables, so a caller's temporary table named like a real
   one would be read instead. `is_blocked_pair()` lists only `public` and reads `blocks`.
2. `REVOKE EXECUTE … FROM PUBLIC` in the migration that creates it, then grant to the one role that
   needs it in `roles.sql`. Functions are executable by everyone by default.
3. Identifiers that come from arguments go through `format('%I', …)`, as
   `ensure_monthly_partitions()` does. Never concatenate.
4. Keep the body to the one privileged action. Validate arguments against an allow-list where the
   action is DDL. **Recommendation:** `ensure_monthly_partitions()` accepts any table name; add a
   check against the nine partitioned tables when the function is next touched, so a compromised
   worker cannot attach partitions to an arbitrary partitioned table.
5. The function runs as its owner. Locally the owner is a superuser, which makes rule 4 matter more
   (GAP-DB05-05).
6. A definer function bypasses row-level security. If it acts for a member, it must check the
   member itself: compare its actor argument with `app_current_user_id()`. It must also decide
   what happens when no member context is set, and must not simply let the call through, or the
   member role could act as anyone by leaving `app.user_id` unset. The matching functions
   (migration `0007`) allow a call with no member context only when the session's login has
   `BYPASSRLS` or is, or belongs to, the function's owner; they read `session_user`, because
   inside a definer function `current_user` is the owner.
7. One test as the granted role (succeeds) and one as another role (refused), as `roles.test.ts`
   does for partitions.

The worker needs two more privileged actions that have no function yet: refreshing materialised
views and detaching partitions (GAP-DB05-04).

## 6. Append-only and hash-chained tables

### 6.1 The triggers

`forbid_mutation()` raises SQLSTATE `42501` with "`<table>` is append-only". It is attached as a
`BEFORE` row trigger:

| Table                       | Trigger                          | Blocks                                                 | Grant also revoked in `roles.sql` |
| --------------------------- | -------------------------------- | ------------------------------------------------------ | --------------------------------- |
| `admin_audit_log`           | `trg_audit_immutable`            | UPDATE, DELETE                                         | yes                               |
| `consent_records`           | `trg_consents_immutable`         | UPDATE, DELETE                                         | yes                               |
| `moderation_actions`        | `trg_mod_actions_immutable`      | UPDATE, DELETE                                         | yes                               |
| `content_revisions`         | `trg_revisions_immutable`        | UPDATE, DELETE                                         | yes                               |
| `consent_receipts`          | `trg_consent_receipts_immutable` | UPDATE, DELETE                                         | yes                               |
| `safety_escalation_updates` | `trg_esc_updates_immutable`      | UPDATE, DELETE                                         | **no**                            |
| `intro_decisions`           | `trg_intro_decisions_final`      | UPDATE only (decisions are final; rows can be deleted) | no                                |

Two layers on purpose: the revoked grant stops the three data roles before the trigger runs, and
the trigger stops everyone else who is not the owner acting with triggers disabled. `TRUNCATE` is
never granted to a data role.

Related guards that are not `forbid_mutation()`: `legal_published_immutable()` (a published legal
document cannot be edited), `enforce_config_approval()` (four-eyes on production config, section
10.3) and `refund_approval_guard()` [SQL].

**Recommendation:** add `safety_escalation_updates` to the `REVOKE UPDATE, DELETE` line in
`roles.sql` so it has both layers like the other ledgers (part of GAP-DB05-07).

### 6.2 The audit chain

`admin_audit_log` records every admin write and every PII reveal: who, what, target, reason, before
and after, IP, request id, approval id [TR §7.1], [SQL].

- Trigger `trg_audit_chain` (`BEFORE INSERT`) takes `pg_advisory_xact_lock(7240001)` so inserts are
  serialised, draws `chain_seq` from `admin_audit_chain_seq` after the lock, reads the newest
  `row_hash`, and sets `prev_hash` and `row_hash`.
- `admin_audit_row_hash(prev, row)` is SHA-256 (pgcrypto `digest`) over the previous hash and a
  canonical JSON array tagged `'v2'` of every audited field. The formula is fixed before the first
  row; a change needs a new version tag [SQL].
- Job `audit.verify_chain` walks the log nightly by `chain_seq`, recomputes each hash and stores
  the run in `admin_audit_chain_runs`; a break opens a security incident [TR §11]. A broken chain
  is an alert [TR §14].
- The table is partitioned monthly and kept 7 years, then moved to cold storage [SQL comment].

What the chain proves and does not: it detects a changed, removed or reordered row. It does not
stop a party who can disable triggers (the table owner) from rewriting history and recomputing the
whole chain. **Recommendation:** have `audit.verify_chain` also write the latest `chain_seq` and
`row_hash` somewhere the database owner cannot change (a log line shipped off-host, or an object in
R2 under a separate credential), so a full rewrite is detectable. Ownership:
[MOD-01](../execution/1MM-EXE-MOD-01-ADMIN-ACCESS-AND-GOVERNANCE.md).

### 6.3 Ledgers and retention

Three ledgers must lose rows eventually: `consent_receipts` has `retention_until` and is named in
the `retention.purge` job; `consent_records` are kept for the account plus 6 years; audit
partitions go to cold storage after 7 years [TR §16.1], [TR §11]. The trigger and the revoked
grants forbid all three for `app_worker`. The comment on `forbid_mutation()` says "the erasure job
uses a dedicated role that disables it per statement with `session_replication_role`"; no such role
exists in `roles.sql`. This is part of GAP-DB05-04.

## 7. Injection defence

| Control                                                                                                        | State                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Queries go through Drizzle or the `postgres` tagged template, which send values as bound parameters [TR §13.1] | In place in the scaffold (`packages/db/src/client.ts`, `apps/worker/src/jobs/partitions-ensure.ts`)                                     |
| No running role can execute DDL, so an injected statement cannot change the schema [TR §13.1]                  | In place, tested                                                                                                                        |
| "Lint bans string-built SQL" [TR §13.1]                                                                        | **Not in place**: no such rule in `eslint.config.mjs`. GAP-STD11-02 in [1MM-STD-11](../standards/1MM-STD-11-SECURITY-AND-COMPLIANCE.md) |
| Request input is validated with zod before it reaches a query [TR §13.1]                                       | In place as a pattern (`packages/contracts`)                                                                                            |

Rules:

1. `sql.unsafe()` and `sql.raw()` are allowed in exactly two places: the migration runner and the
   roles CLI, which execute repository files. Nowhere else.
2. A sort column, direction or filter name from a request is mapped through an allow-list to a
   fixed identifier. It is never interpolated. Sorting is offered only on indexed columns anyway
   ([1MM-DB-04](1MM-DB-04-INDEXING.md)).
3. `LIKE` patterns escape `%` and `_` in user input.
4. Dynamic SQL inside PL/pgSQL uses `format()` with `%I` and `%L` and never takes its text from a
   table that staff can edit.
5. JSON stored from input (`payload`, `before`, `after`, `settings`) is data. It is never evaluated
   and never used to build a query. `vendor_settings.settings` additionally refuses secret-shaped
   keys through `jsonb_has_secret_keys()` [SQL].
6. The migration runner builds one statement from a file name and a checksum
   (`INSERT INTO schema_migrations …`). Both come from the repository and match
   `^\d{4}_.+\.sql$`; keep migration file names to letters, digits and underscores.

## 8. Connection security

| Topic                       | Source facts                                                                                                                                | State and recommendation                                                                                                                                                                                                                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TLS                         | Neon is TLS only; Upstash over TLS; per-environment credentials [TR §4.3], [TR §13.1]                                                       | `client.ts` passes no `ssl` option; TLS depends on the URL. **Recommendation:** hosted URLs carry `sslmode=require` (or stricter), and start-up refuses a non-local database host without it. GAP-DB05-06                                                                                                                        |
| Pooling                     | Neon's built-in pooler (PgBouncer) [TR §4.3], [TR §15.2]; the client comment says to use the pooled URL at runtime                          | API and worker data pools use the pooled URL. pg-boss and migrations use the direct URL (`.env.example`). `SET LOCAL` and `pg_advisory_xact_lock` are transaction-scoped and safe through a transaction-mode pooler; session `SET`, session advisory locks and `LISTEN` are not                                                  |
| Connection limits           | `createDatabase` defaults to `max: 10`; the worker uses 4; the migrator 1. The API runs at least 2 replicas and the worker 1 to 2 [TR §4.3] | **Recommendation:** set `max` per service from configuration and keep the sum under the pooler's limit for the plan; set `CONNECTION LIMIT` on each login so one program cannot exhaust the server                                                                                                                               |
| Statement timeout           | None in the sources or the repo                                                                                                             | **Recommendation**, to be confirmed: `statement_timeout` 5 s for the API logins, 60 s for the worker login, none for the migration login. GAP-DB05-06                                                                                                                                                                            |
| Idle-in-transaction timeout | None                                                                                                                                        | **Recommendation:** `idle_in_transaction_session_timeout` 15 s for the API logins and 60 s for the worker, so a stuck request cannot hold locks or block vacuum. GAP-DB05-06                                                                                                                                                     |
| Lock timeout                | None                                                                                                                                        | **Recommendation:** `lock_timeout` 3 s for the API; set per migration when it touches a hot table ([1MM-DB-04](1MM-DB-04-INDEXING.md) section 10.3)                                                                                                                                                                              |
| Network allow-list          | IP allow-lists set to Railway static outbound IPs once on paid plans [TR §4.3]                                                              | Planned before public launch                                                                                                                                                                                                                                                                                                     |
| Environment marker          | `app_env()` reads the `app.env` setting; unset means development, which switches four-eyes enforcement off [SQL]                            | Planned (MOD-00 behaviour 6). **Recommendation:** set it with `ALTER ROLE <login> SET app.env = 'production'` on each hosted login, not per connection: a session `SET` is unreliable through the pooler, and role settings are not inherited from the group role. Production start-up asserts `SELECT app_env() = 'production'` |
| Application name            | `applicationName` is set per pool and shows in `pg_stat_activity`                                                                           | In place                                                                                                                                                                                                                                                                                                                         |

Timeouts belong on the login role (`ALTER ROLE … SET`), so they hold whatever client connects.

## 9. Secrets handling for database URLs

1. `.env.example` is the list of names. Its database URLs are the local compose defaults with the
   throwaway password; they are not secrets. `.env.development` is never committed.
2. Hosted values live in Railway sealed variables, one set per environment [TR §13.1], [TR §13.4].
   Staging and production are separate Neon projects with separate credentials [TR §4.4].
3. A database URL never has a client prefix (`VITE_`, `PUBLIC_`, `EXPO_PUBLIC_`).
   `pnpm check:client-bundles` fails a build that contains a server-only name or value.
4. gitleaks runs in CI and, when installed, in the pre-commit hook.
5. URLs are never logged. Error messages from the driver can contain the host and user; do not log
   the connection options object.
6. `vendor_settings` holds references (`vault://…`), a version and the last four characters, never
   a secret; its `CHECK` refuses secret-shaped keys [SQL]. A database URL is not stored there.
7. Rotation (**Recommendation**): create a second login in the same group, switch the variable,
   deploy, then drop the old login. No downtime and no shared password between programs. Rotate on
   staff departure, on any suspected leak and at least yearly.
8. Job payloads in `pgboss` are plain text: pass ids, never secrets or personal data
   (`apps/worker/src/main.ts`).

## 10. Least privilege for change

### 10.1 Migrations in CI and production

| Step                   | Today                                                                                                                                                                                                    | Planned                                                                                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| CI `verify`            | Copies `.env.example`, runs `pnpm db:migrate` then `pnpm db:roles` against a disposable PostgreSQL 16 + PostGIS service as the compose superuser, then the tests. The workflow token is `contents: read` | Unchanged                                                                                                                                            |
| Staging and production | Not built                                                                                                                                                                                                | `MOD-00-OPS-03`: `pnpm db:migrate` as a gated step with the `app_migrator` URL, then `pnpm db:roles`; a failed migration stops the deploy [TR §10.3] |

Rules:

1. The migration URL is available to the release step only, as a protected environment secret. It
   is not in the API or worker service variables.
2. The runner takes an advisory lock, so two deploys cannot migrate at once, and refuses to
   continue if an applied file changed (`migrator.ts`).
3. `pnpm db:roles` runs after every migration. A migration that creates a table the member API must
   not see ships the `REVOKE` in `roles.sql` in the same pull request.
4. `/packages/db/` is code-owned; a change needs a code-owner review
   ([1MM-STD-11](../standards/1MM-STD-11-SECURITY-AND-COMPLIANCE.md) THR-68).
5. The migration login should not be a superuser and should not be the cloud project's
   administrative role. See GAP-DB05-05.

### 10.2 People

No person queries production with a write role outside the break-glass procedure
([1MM-STD-11](../standards/1MM-STD-11-SECURITY-AND-COMPLIANCE.md) THR-59). Read access for
investigation goes through the admin console, which masks and audits (section 11). A direct
read-only login for engineers is not defined in the sources; `app_readonly` sees aggregates only,
by design.

### 10.3 Four-eyes on configuration, in the database

`enforce_config_approval()` enforces an approved `admin_approvals` row for changes to
`feature_flags`, `remote_config`, `rate_limit_policies`, `vendor_settings`, `countries`, `cities`
and sensitive `site_settings` keys when `app_env()` is `production`; switching a kill switch off is exempt [SQL].
It depends on the environment marker in section 8: if `app.env` is unset on a production
connection, the rule is silently off.

## 11. Admin read paths and PII reveal auditing

The admin API bypasses row-level security, so every control here is in application code and the
audit log.

| Control                                                                                      | Source                            | Database object                                                                                                                                  |
| -------------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Permission and scope check on every request                                                  | [TR §7.1], [ADM §1.1]             | `v_admin_effective_permissions`, `admin_user_roles` (scoped: global, country, city, queue)                                                       |
| Mandatory MFA                                                                                | [TR §13.4]                        | `admin_mfa_factors`, `v_admin_mfa_gaps`                                                                                                          |
| PII masked by default; revealed only with a logged reason and step-up                        | [TR §13.4], [ADM §1.3], [ADM A10] | Permission `users.pii.read`; audit action `member.pii.reveal` naming the fields ([MOD-05](../execution/1MM-EXE-MOD-05-MEMBER-ADMINISTRATION.md)) |
| Identifier searches (e-mail, phone) are exact-match only and audited with a masked query     | [ADM A04]                         | Audit action `member.search.identifier`                                                                                                          |
| Every write and every reveal writes the audit log in the same transaction                    | [TR §7.1]                         | `admin_audit_log`                                                                                                                                |
| Exports are rows, built by a job, expire, and need approval where the permission requires it | [SQL comment on `admin_exports`]  | `admin_exports`, `admin_approvals`                                                                                                               |
| Biometric templates and liveness video are never returned, only counts                       | [ADM A36]                         | –                                                                                                                                                |

Rules for the admin data layer (`withAdminTx`, built in `MOD-00-DB-01`):

1. The reveal endpoint is the only code path that selects the clear value of a masked field. List
   and detail queries select masked projections, so a serialisation mistake cannot leak.
2. The audit insert is in the same transaction as the read or write it records. If the audit insert
   fails, the action fails.
3. `before` and `after` in the audit row hold masked values where possible [SQL comment]; never
   credentials, tokens, message bodies or face data.
4. Member 360 never shows message content or sensitive answers [ADM A10].

## 12. Protection against mass reads

| Control                                                                          | Where                                                                                             | State                                                                              |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Page size 25, 50 or 100; keyset only, never OFFSET                               | [TR §8.1], [ADM §1.4]                                                                             | Planned (MOD-00 behaviour 9)                                                       |
| Rate limits per IP, device, account, phone and e-mail                            | `rate_limit_policies` (15 seeded), Redis sliding windows [TR §13.3]                               | Scaffold in place; policy loader planned (MOD-00-API-03)                           |
| Discovery quota counted server-side                                              | `spend_spec_view()`, `usage_counters` [TR §8.5]                                                   | Schema in place                                                                    |
| Member data export once a day, re-auth required                                  | `UNIQUE (user_id, requested_on)`, policy `export.user`                                            | Schema in place                                                                    |
| Admin bulk selection limited to the page; larger sets only through an export job | [ADM §1.4]                                                                                        | Planned                                                                            |
| Scraping and enumeration detections                                              | `security_detections`, `security.detect.*` thresholds (all `null` until GAP-MOD17-07 is answered) | Planned ([MOD-17](../execution/1MM-EXE-MOD-17-NETWORK-AND-SECURITY-OPERATIONS.md)) |
| Aggregates-only analytics role                                                   | `app_readonly`                                                                                    | In place (grants); no login yet                                                    |
| Statement timeout as a backstop against a runaway `SELECT`                       | section 8                                                                                         | Recommendation                                                                     |

A database cannot tell a legitimate bulk read from theft on its own. The backstops are the
statement timeout, row-level security (a member's connection cannot read others' protected rows
even with a missing `WHERE`), and the alerts in section 13.

## 13. Backups access and monitoring

### 13.1 Backups

Neon point-in-time restore, a nightly `pg_dump` to the R2 `backups` bucket kept 30 days and a
monthly copy kept 12 months, with a quarterly restore drill [TR §10.3]. A dump holds every table,
including those no application role may read, so:

1. The `backups` bucket credentials are separate from the media credentials and are held by the
   worker's dump job and the restore procedure only (**Recommendation**; GAP-STD11-09 asks the
   Technical Reference to state it together with client-side encryption of dumps).
2. The dump needs a login that can read everything. `app_worker` cannot read `schema_migrations`,
   and the job has no seeded catalogue row (GAP-MOD00-01). **Recommendation:** a dedicated
   read-only dump login, used by that job only, not the migration login.
3. A restore goes into an isolated environment with production-grade access control, never staging
   ([1MM-STD-12](../standards/1MM-STD-12-DATA-HANDLING.md) §7.8).
4. Point-in-time restore and branching are console actions on the Neon project. Access to the
   project is limited to named people with MFA, and every restore is recorded as an incident or
   drill entry (**Recommendation**).

Erasure and backups are covered in [1MM-DB-06](1MM-DB-06-DATA-PROTECTION.md) section 10.

### 13.2 What to monitor

The sources list alerts for a broken audit chain, MFA gaps, error-rate spikes and webhook failures
[TR §14]. The database signals below are **Recommendations** for `MOD-00-API-09` and
[MOD-17](../execution/1MM-EXE-MOD-17-NETWORK-AND-SECURITY-OPERATIONS.md).

| Signal                                                                       | Where it shows                                                                           | Why it matters                                                                                                                      |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Failed database logins (SQLSTATE `28P01`, `28000`)                           | Provider logs                                                                            | A leaked or guessed credential; a mis-deployed secret                                                                               |
| Permission denied (`42501`) from an application role                         | API and worker error logs, Sentry                                                        | In a correct build this never happens. It means a missing grant after a migration, or an injection attempt reaching DDL or a ledger |
| Row-level security violations ("new row violates row-level security policy") | Same                                                                                     | A code path writing for another member                                                                                              |
| Long transactions and idle-in-transaction sessions                           | `pg_stat_activity` (`xact_start`, `state`)                                               | Lock pile-ups, vacuum blocked                                                                                                       |
| Connections per `application_name` and per role                              | `pg_stat_activity`                                                                       | A pool leak; an unexpected client using a service login                                                                             |
| Statement and lock timeouts (`57014`, `55P03`)                               | Error logs                                                                               | A missing index or a blocking migration                                                                                             |
| Rows in any `*_default` partition                                            | Count query                                                                              | `partitions.ensure` failed ([1MM-DB-04](1MM-DB-04-INDEXING.md) section 8)                                                           |
| `audit.verify_chain` result                                                  | `admin_audit_chain_runs`                                                                 | Tampering [TR §14]                                                                                                                  |
| `v_role_drift` not empty; `v_admin_mfa_gaps` not empty                       | Views                                                                                    | Entitlement drift; an active admin without MFA [TR §14]                                                                             |
| A role or grant that differs from `roles.sql`                                | Scheduled diff of `pg_roles` and `information_schema.role_table_grants` against the file | Privilege drift made by hand                                                                                                        |

Long-transaction check:

```sql
SELECT pid, usename, application_name, state, now() - xact_start AS xact_age, left(query, 80) AS query
FROM pg_stat_activity
WHERE xact_start IS NOT NULL AND now() - xact_start > interval '30 seconds'
ORDER BY xact_age DESC;
```

Admin sign-in failures are an application signal, not a database one: `admin_login_attempts`,
`admin_security_alerts` and policy `admin.login` ([MOD-01](../execution/1MM-EXE-MOD-01-ADMIN-ACCESS-AND-GOVERNANCE.md)).

## 14. Checklist for a change that touches roles, grants or policies

- [ ] The change is in `packages/db/roles/roles.sql` or a numbered migration, never applied by
      hand. `roles.sql` stays idempotent.
- [ ] A new table: decided which of `app_api`, `app_admin_api`, `app_worker` may touch it. If the
      member API must not, `REVOKE ALL … FROM app_api` is in `roles.sql`.
- [ ] A new member-owned table: row-level security enabled with a policy per command the member API
      needs, written with `app_current_user_id()`, and an isolation test with two members.
- [ ] A new policy: every function and query that writes the table as `app_api` was checked against
      it (section 4.3 finding 1). No policy is true when `app.user_id` is unset.
- [ ] A new append-only table: `forbid_mutation()` trigger and `REVOKE UPDATE, DELETE` in
      `roles.sql`; its retention path is stated ([1MM-DB-06](1MM-DB-06-DATA-PROTECTION.md)).
- [ ] A new `SECURITY DEFINER` function: `search_path = public, pg_temp`; `EXECUTE` revoked from
      `PUBLIC` and granted to one role; arguments validated; tests for the granted and a refused
      role (section 5).
- [ ] A new aggregate for analytics: no personal data in it before it is granted to
      `app_readonly`.
- [ ] No grant to `PUBLIC`. No new role with `BYPASSRLS`, `CREATEROLE` or superuser.
- [ ] A new login or variable: added to `.env.example` with a comment, to the service's `env.ts`,
      and to section 3 of this document.
- [ ] `roles.test.ts` has a case for the change, and `pnpm db:migrate && pnpm db:roles && pnpm test`
      is green locally on PostgreSQL 16.
- [ ] The pull request names the threat or rule the change serves and has a code-owner review.

## 15. Gaps raised

Dispositions are recorded in [1MM-LOG-03](../1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md) (Technical Reference and schema), [1MM-LOG-02](../1MM-LOG-02-UI-UPDATES.md) (UI) and [1MM-LOG-04](../1MM-LOG-04-OPEN-DECISIONS-AND-FOLLOW-UPS.md) (owner decisions and repository follow-ups).

| Gap id      | Type   | Where found                                                                                                                                      | What is missing or conflicting                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Proposed resolution                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Blocks                                                          |
| ----------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| GAP-DB05-01 | SCHEMA | [SQL] section 22 ("sketch … Extend to every member-owned table"); [TR §13.1]; risk tables of MOD-10, MOD-11, MOD-12, MOD-14                      | 72 of the 79 tables with a `user_id` foreign key to `users` have no row-level security, including billing, notifications, support, credentials, biometrics and the sensitive profile answers. The sources do not say which are exempt                                                                                                                                                                                                                                                                       | Add policies by migration, module by module, in the shape `ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY; CREATE POLICY subscriptions_own ON subscriptions FOR SELECT USING (user_id = app_current_user_id());` (read-only where only the worker or a webhook writes; `FOR ALL … WITH CHECK` where the member writes). First set: `subscriptions`, `transactions`, `invoices`, `payment_methods`, `entitlement_grants`, `notifications`, `push_tokens`, `notification_preferences`, `support_tickets`, `support_messages`, `sessions`, `devices`, `profile_answers`, `media_assets`, `face_templates`, `liveness_sessions`. Each needs GAP-DB05-02 resolved for the code paths that write it, and a statement of which pool inbound webhooks use                        | API gates of MOD-10, MOD-11, MOD-14; DPIA in MOD-19             |
| GAP-DB05-02 | SCHEMA | [SQL] `record_reaction()`, `undo_reaction()`, `decide_intro()`, `unmatch()` against policies `reactions_insert`, `cp_own`; [TR §8.4], [TR §10.4] | The matching functions run with the caller's policies. As `app_api`, the reaction upsert and the undo have no UPDATE policy, and `decide_intro()` inserts the other member's participant row, which `cp_own` refuses. Found by reading; the PGlite run did not use the member role                                                                                                                                                                                                                          | Make the four functions (and `spend_spec_view()`, `redeem_beta_invite()` after review) `SECURITY DEFINER SET search_path = public, pg_temp`, add `IF app_current_user_id() IS NOT NULL AND p_actor IS DISTINCT FROM app_current_user_id() THEN RAISE EXCEPTION … USING ERRCODE = '42501'` at the top, `REVOKE EXECUTE … FROM PUBLIC`, `GRANT EXECUTE … TO app_api, app_worker`. Add behaviour tests that call each as the `app_api` login on PostgreSQL 16                                                                                                                                                                                                                                                                                                                    | MOD-07 and MOD-08 API gates                                     |
| GAP-DB05-03 | SCHEMA | [SQL] policy `profiles_read`, function `is_blocked_pair()`                                                                                       | (a) With `app.user_id` unset the policy returns every non-hidden profile, so the public surface is not confined. (b) `is_blocked_pair()` is `SECURITY DEFINER` with `search_path = public` (no explicit `pg_temp`) and is executable by `PUBLIC`, so any role can test whether two members blocked each other                                                                                                                                                                                               | `ALTER POLICY profiles_read ON profiles USING (app_current_user_id() IS NOT NULL AND (user_id = app_current_user_id() OR (NOT is_hidden AND NOT is_blocked_pair(app_current_user_id(), profiles.user_id))));` `ALTER FUNCTION is_blocked_pair(uuid, uuid) SET search_path = public, pg_temp;` `REVOKE EXECUTE ON FUNCTION is_blocked_pair(uuid, uuid) FROM PUBLIC;` and in `roles.sql` `GRANT EXECUTE ON FUNCTION is_blocked_pair(uuid, uuid) TO app_api, app_admin_api, app_worker;`                                                                                                                                                                                                                                                                                         | MOD-00-DB-01 isolation tests                                    |
| GAP-DB05-04 | SCHEMA | [TR §11] jobs `stats.refresh`, `partitions.retain`, `retention.purge`; `roles.sql`; comment on `forbid_mutation()`                               | The worker lacks the rights three seeded jobs need. `REFRESH MATERIALIZED VIEW` and `ALTER TABLE … DETACH PARTITION` require ownership in PostgreSQL 16. Deleting expired `consent_receipts` and `consent_records` is blocked by the trigger and the revoked grant, and the "dedicated role" the comment describes does not exist                                                                                                                                                                           | Two definer functions owned by the schema owner, in the pattern of migration 0006: `refresh_stats_view(p_view text)` (allow-list of the six `mv_*` names, `REFRESH MATERIALIZED VIEW CONCURRENTLY`) and `detach_monthly_partition(p_parent text, p_month date)` (allow-list of the nine parents), `EXECUTE` granted to `app_worker` only. For ledgers: a definer function per ledger that deletes only rows past their stated retention and not under legal hold (for example `purge_consent_receipts()` deleting `WHERE retention_until < now()`), with the trigger rewritten to allow a delete only when a transaction-local flag set by that function is present. Owner and counsel confirm the retention of each ledger first ([1MM-DB-06](1MM-DB-06-DATA-PROTECTION.md)) | MOD-18 `stats.refresh`; MOD-00-WRK-02; MOD-16 `retention.purge` |
| GAP-DB05-05 | REPO   | `roles.sql`, `local-logins.sql`, `.env.example`, `docker-compose.yml`, `roles.test.ts`, [TR §10.3]                                               | `app_migrator` is created but owns nothing: the schema is owned by whichever login ran the migrations (locally the compose superuser), so the definer function runs as a superuser locally and "migrations run as `app_migrator`" is not true as implemented. There is no login for `app_migrator` or `app_readonly`, and the tests cover neither them nor the admin login                                                                                                                                  | Create a migration login `IN ROLE app_migrator`; have `migrate.ts` and `roles.ts` issue `SET ROLE app_migrator` before running files so every object is owned by the group; one-off `REASSIGN OWNED` for existing databases; add `minitman_migrator` and `minitman_readonly` to `local-logins.sql`, a `READONLY_DATABASE_URL` to `.env.example`, and test cases for the admin, read-only and migrator logins. Related: GAP-STD10-04                                                                                                                                                                                                                                                                                                                                           | MOD-00-OPS-03, MOD-00-DB-01                                     |
| GAP-DB05-06 | TR     | [TR §4.3], [TR §13.1]; `packages/db/src/client.ts`                                                                                               | No source or code sets `statement_timeout`, `idle_in_transaction_session_timeout` or `lock_timeout`, requires TLS in the client for hosted databases, or says how `app.env` is set through the pooler                                                                                                                                                                                                                                                                                                       | Add to [TR §13.1]: hosted URLs require TLS and start-up refuses otherwise; per-login `ALTER ROLE … SET` for the three timeouts (starting values in section 8, confirmed by the engineering lead after a staging baseline) and for `app.env`; production start-up asserts `app_env() = 'production'`                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | MOD-00-DB-01, MOD-00-OPS-03                                     |
| GAP-DB05-07 | REPO   | `roles.sql` grants to `app_api`; [TR §13.1] "separate DB roles"                                                                                  | The member API role has full DML on tables it has no reason to touch, including staff credentials (`admin_mfa_factors`, `admin_sessions`, `admin_trusted_devices`, `admin_login_attempts`), governance (`admin_user_roles`, `admin_role_permissions`, `admin_approvals`, `admin_exports`), privacy and security operations (`legal_holds`, `security_incidents`, `security_detections`, `ip_access_rules`) and moderation internals. `safety_escalation_updates` is append-only by trigger but not by grant | Extend the `REVOKE ALL … FROM app_api` list in `roles.sql` with the tables above, each confirmed by its owning module (MOD-01, MOD-09, MOD-16, MOD-17) against the member endpoints it serves; add `safety_escalation_updates` to the `REVOKE UPDATE, DELETE` line; MOD-09 has already proposed insert-only on `report_evidence`                                                                                                                                                                                                                                                                                                                                                                                                                                              | Exit gates of MOD-01, MOD-09, MOD-17                            |

Status after migration `0007` (24 Nov 2026): GAP-DB05-02 and GAP-DB05-03 are fixed for the four
matching functions, `profiles_read` and `is_blocked_pair()` (the review of `spend_spec_view()` and
`redeem_beta_invite()` named in GAP-DB05-02 is still open). GAP-DB05-01, the per-module row-level
security work, and GAP-DB05-04 to GAP-DB05-07 are open.

Gaps owned elsewhere and referenced here: GAP-STD11-02 (lint rule for string-built SQL),
GAP-STD11-09 (encryption and access for dumps), GAP-STD10-04 (who creates the local logins),
GAP-MOD00-01 (no catalogue row for the nightly dump), GAP-MOD17-07 (detection thresholds),
GAP-DB02-01 and GAP-DB04-04 (non-transactional migrations, one change).

## Change log

| Version | Date        | Change                                                                                                                                                                                                                                                                                                                                  |
| ------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v1.0    | 24 Nov 2026 | First issue: role model, connection map, the 14 policies and four findings, definer functions, ledgers, connection rules, monitoring, checklist                                                                                                                                                                                         |
| v1.1    | 24 Nov 2026 | Migration `0007`: findings 1 and 2 marked fixed (matching functions as definer with an actor guard; `profiles_read` denies without a member context; `is_blocked_pair()` hardened); six definer functions; rule 6 extended; `change-set-0007.test.ts` added to the test section. Per-module row-level security (GAP-DB05-01) still open |
| v1.2    | 26 Nov 2026 | `MOD-00-DB-01`: `ADMIN_DATABASE_URL` wired, `withMemberTx`, `withAdminTx`, `withWorkerTx` and the `app.env` connection setting in place (sections 3, 4.1, 11)                                                                                                                                                                           |
