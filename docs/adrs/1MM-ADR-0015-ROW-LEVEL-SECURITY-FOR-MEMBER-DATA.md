# 1MM-ADR-0015 · Row-level security for member reads and writes

|                  |                                                                                                                       |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                                                              |
| **Date decided** | 18 Nov 2026                                                                                                           |
| **Decided by**   | Technical Reference §18.1 baseline (T15, new in schema v3)                                                            |
| **Sources**      | [TR §8.1], [TR §10.1], [TR §10.3], [TR §10.4], [TR §13.1], [TR §18.1] T15, [SQL] `app_current_user_id()` and policies |
| **Affects**      | packages/db, apps/api (member surface), MOD-00 and every module with member data                                      |

## Context

A dating app holds private profiles, messages, blocks and trusted contacts. A missing `WHERE`
clause in one query must not expose another member's rows. The Technical Reference adds a second
line of defence under the application's own checks: "RLS for member reads" [TR §13.1], listed as
T15 [TR §18.1], with the mechanism "the member API sets `SET LOCAL app.user_id` for each
transaction" [TR §8.1] (v3.5 wording; v3.6 binds it with `set_config`, TRX-033). Schema v3.4 ships 14 policies [TR §10.1] and "RLS isolation" is one of
the behaviour tests [TR §10.4].

## Decision

1. The member API connects as `app_api`, which is subject to RLS [TR §10.3].
2. Every member request runs its queries in a transaction that first sets `app.user_id` with
   `SELECT set_config('app.user_id', $1, true)`, the transaction-local form that takes a bind
   parameter (the effect of `SET LOCAL`; TRX-033). Policies read it through `app_current_user_id()` [SQL].
3. The 14 baseline policies cover `profiles`, `reactions`, `conversation_participants`,
   `messages`, `inbox_items`, `consent_records`, `trusted_contacts`, `blocks`,
   `data_export_requests` and `reverification_requests` [SQL].
4. The admin API and the worker use roles with BYPASSRLS; for them `app_current_user_id()` is
   NULL [SQL]. Their access is controlled by permissions in code and the audit log.
5. RLS is a backstop, not the authorisation model: the API still checks ownership, blocks and
   entitlements itself.

## Alternatives considered

The sources record no alternatives.

**Analysis:** (a) authorisation in application code only is the common approach and remains in
place here, but a single forgotten filter leaks data; (b) a separate database or schema per
member does not fit a product whose core queries join members to each other; (c) RLS on every
table, including admin and worker access, would need a policy language for staff permissions
that the schema instead expresses through `v_admin_effective_permissions` [TR §7.1].

## Consequences

- Easier: a query bug on the member surface returns no rows instead of someone else's rows.
- Harder: every member query must run inside the transaction that set the context; connection
  pooling must be transaction-scoped (`SET LOCAL`, never `SET`); policies add planning cost to
  hot queries; new member-owned tables need a decision on a policy.
- Found in review (GAP-DB05-02): under the member role the policies `reactions_insert` and
  `cp_own` refused the writes that the matching functions make for both people of a pair; schema
  change set 0007 addresses it by running those functions as `SECURITY DEFINER` with an actor
  guard ([1MM-LOG-03](../1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md), TRX-048).
- Cost: none.

## How it is applied

- The RLS context is a cross-cutting deliverable of
  [MOD-00](../execution/1MM-EXE-MOD-00-FOUNDATIONS.md): one helper opens the transaction and sets
  the member id; use cases cannot query outside it.
- Policies are in `packages/db/migrations/0001_baseline_v3_4.sql`; new ones arrive by migration.
- Checks: an isolation test per member-owned table (member A cannot read or write member B's
  row as `app_api`); `packages/db/src/roles.test.ts`. Detail:
  [1MM-DB-05 Security](../database/1MM-DB-05-SECURITY.md).

## Revisit when

The database moves to Citus (policies must be re-verified on distributed tables), or a hot query
misses its budget [TR §15] because of policy overhead.
