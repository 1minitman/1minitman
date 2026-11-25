# 1MM-ADR-0029 · Append-only, hash-chained admin audit log

|                  |                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------ |
| **Status**       | Accepted                                                                                                     |
| **Date decided** | 18 Nov 2026 (log); 21 Nov 2026 (chain v2, schema v3.4)                                                       |
| **Decided by**   | Technical Reference §7.1 and §18.1 baseline (T9: "hash-chained audit")                                       |
| **Sources**      | [TR §7.1], [TR §10.1], [TR §10.3], [TR §10.4], [TR §14], [TR §18.1] T9, [DDR], `packages/db/roles/roles.sql` |
| **Affects**      | packages/db, apps/api (admin surface), apps/worker, MOD-01                                                   |

## Context

Staff can read private data and take irreversible actions, so the record of who did what must be
complete and must not be alterable, even by an administrator of the application. The Technical
Reference requires that "every write and every PII reveal writes `admin_audit_log`: who, what,
target, required reason, before/after, IP, request id, approval id", and that the log is
"append-only (enforced by a trigger), hash-chained and partitioned monthly, and kept for 7 years"
[TR §7.1]. Schema v3.4, which applies the design data review, replaced the first chain with chain v2
[TR §10.1], [DDR].

## Decision

1. Every admin write and every reveal of personal data inserts a row in `admin_audit_log` in
   the same transaction as the action [TR §7.1].
2. The table is append-only: a trigger refuses changes, and UPDATE and DELETE are revoked from
   every application role [TR §7.1], [TR §10.3].
3. **Chain v2:** `admin_audit_chain()` takes an advisory lock and then draws `chain_seq`, which
   is the true chaining order. `row_hash = admin_audit_row_hash(prev_hash, to_jsonb(row))` covers
   every audited field as canonical JSON. The trigger and the verifier use the same function
   [TR §7.1].
4. The chain is verified nightly by the job `audit.verify_chain` (or manually for up to 7 days);
   each run is stored in `admin_audit_chain_runs`; a break opens a security incident [TR §7.1].
5. The log is partitioned monthly and kept for 7 years [TR §7.1].

## Alternatives considered

- **The first chain design:** replaced by v2 in schema v3.4. The sources describe v2 by what it
  fixes: `chain_seq` is drawn after the lock and the verifier walks it, "not `created_at` or
  `id`", and the hash covers every audited field [TR §7.1].
- **Application logs or a log vendor as the audit record:** the sources record no such option.
  **Analysis:** logs are retained 30 days hot and one year archived [TR §14], are not
  transactional with the action, and can be edited by whoever runs the log store.
- **An external write-once store:** not in the sources. **Analysis:** it would add a vendor and
  break the same-transaction guarantee.

## Consequences

- Easier: tampering with one row breaks every later hash and is found within a day; an action
  and its audit row commit or fail together.
- Harder: every audited insert takes the chain lock, so audit writes are serialised; the hash
  formula can never change without a versioned migration (migration 0005 had to run "before the
  first `admin_audit_log` row is written" [TR §10.3]); 7 years of partitions must be archived,
  not dropped.
- Cost: storage for 7 years.

## How it is applied

- The schema objects ship in `packages/db/migrations/0001_baseline_v3_4.sql`; the revokes are in
  `packages/db/roles/roles.sql`.
- The audit writer, the read and export views and the verify job are built in
  [MOD-01](../execution/1MM-EXE-MOD-01-ADMIN-ACCESS-AND-GOVERNANCE.md); every module's admin
  endpoint table names its audit event (module plan §4.1).
- Checks: the behaviour tests cover the chain v2 and its verifier [TR §10.4]; an alert on a
  broken chain [TR §14]; a roles test that `app_admin_api` cannot update or delete an audit row;
  a test per admin write that an audit row exists.

## Revisit when

Audit write volume makes the chain lock a bottleneck, or a regulator requires the audit record
to be held by an independent party.
