# 1MM-ADR-0014 · Least-privilege database roles, one per program

|                  |                                                                                                                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                                                                                                                         |
| **Date decided** | 18 Nov 2026 (roles); 23 Nov 2026 (`app_queue` and the worker DDL rule, commit `3ae6870`)                                                                                         |
| **Decided by**   | Technical Reference §10.3; repository hardening (pull request #6)                                                                                                                |
| **Sources**      | [TR §10.3], [TR §13.1], `packages/db/roles/roles.sql`, `packages/db/migrations/0006_partition_function_definer.sql`, `packages/db/src/roles.test.ts`, `docs/USAGE.md`, `git log` |
| **Affects**      | packages/db, apps/api, apps/worker, MOD-00, hosted environments                                                                                                                  |

## Context

"Strict database protection" is the first item in the product plan's security list; the answer
includes "separate DB roles" and "the API role can't run DDL" [TR §13.1]. The Technical
Reference names five roles: `app_migrator` (DDL), `app_api` (DML, subject to RLS), `app_worker`
and `app_admin_api` (BYPASSRLS), `app_readonly` (analytics, no PII), with UPDATE and DELETE
revoked on append-only ledgers [TR §10.3]. The repository hardening added a sixth role for the
job queue and removed the worker's need for DDL rights.

## Decision

1. Six group roles that cannot log in; each environment creates its own login users as members
   of exactly one group:

   | Role            | Used by                | Rights                                                      |
   | --------------- | ---------------------- | ----------------------------------------------------------- |
   | `app_migrator`  | `pnpm db:migrate` only | Owns the schema; DDL                                        |
   | `app_api`       | Member and public API  | Read and write rows under RLS; no DDL; no admin-only tables |
   | `app_admin_api` | Admin API              | Read and write rows; bypasses RLS                           |
   | `app_worker`    | Worker jobs            | Read and write rows; bypasses RLS; no DDL                   |
   | `app_queue`     | pg-boss                | Owns the `pgboss` schema; no rights on business tables      |
   | `app_readonly`  | Analytics              | Named aggregate views only; no personal data                |

2. UPDATE and DELETE are revoked from every application role on the append-only ledgers
   (`admin_audit_log`, `consent_records`, `moderation_actions`, `content_revisions`,
   `consent_receipts`).
3. The worker's one DDL action, creating monthly partitions, goes through
   `ensure_monthly_partitions()` as a `SECURITY DEFINER` function with a pinned `search_path`
   (migration `0006`).
4. `schema_migrations` belongs to the migration role alone.

## Alternatives considered

- **Five roles as in the Technical Reference, with pg-boss sharing the worker's role:** replaced
  at hardening so that "a compromised queue connection cannot read or change member data"
  (`roles.sql`).
- **Granting the worker DDL for partitions:** replaced by the definer function.
- **One application role:** the sources record no such option. **Analysis:** it would make every
  injection or leaked credential a full-database compromise.

## Consequences

- Easier: a compromised program is contained; append-only history cannot be rewritten by the
  application.
- Harder: several connection strings per environment; `app_admin_api` and `app_worker` bypass
  RLS, so their checks are in code and in the audit log.
- The Technical Reference lists five roles; `app_queue` is a repository addition to carry into
  its extensions log.

## How it is applied

- `pnpm db:roles` applies `packages/db/roles/roles.sql` (idempotent) after every migration; CI
  runs it in `verify`. `packages/db/roles/local-logins.sql` creates local logins.
- `packages/db/src/roles.test.ts` proves the limits on a real database.
- Detail: [1MM-DB-05 Security](../database/1MM-DB-05-SECURITY.md).

## Revisit when

A new program connects to the database (it gets its own role), or the admin API is given RLS
policies of its own.
