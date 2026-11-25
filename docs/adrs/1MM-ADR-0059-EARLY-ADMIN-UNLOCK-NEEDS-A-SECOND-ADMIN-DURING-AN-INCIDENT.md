# 1MM-ADR-0059 · Early unlock of a locked admin needs a second admin while a linked incident is open

|                  |                                                                                 |
| ---------------- | ------------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                        |
| **Date decided** | 19 Nov 2026                                                                     |
| **Decided by**   | Owner decision OD-29                                                            |
| **Sources**      | [OD-29], [TR §18.2a], [ADM §1.2], [ADM A08], [ADM A32], [DDR], [SQL]            |
| **Affects**      | apps/api (`/admin/v1`), apps/admin (A08, A06, A32), packages/db; MOD-01, MOD-17 |

## Context

An admin account can be locked for failed sign-ins, a security alert, an admin action or the
close of a break-glass session (`admin_users.lock_reason`) [SQL]. A lock may be tied to a
security incident (reference `SI-`). Unlocking the account early, while that incident is still
open, could hand access back to an attacker.

## Decision

1. While a security incident linked to a locked admin is open, an **early unlock needs a second
   admin's approval** [OD-29].
2. The link is `admin_users.lock_incident_id`; the action is the permission `admins.unlock`,
   which carries the reason, re-authentication and approval flags [SQL `admin_permissions` seed].
3. The approval uses the standard mechanism: the action does not execute, an `admin_approvals`
   row stores the exact change, and the server executes the stored payload when a second admin
   approves [ADM §1.2].

## Alternatives considered

The sources record no alternatives.

**Analysis:** (a) no early unlock at all while an incident is open would be safest, but with a
small team it could lock out the only person able to resolve the incident; (b) a single super
admin unlocking alone removes the control exactly when one account may be compromised.

## Consequences

- Easier: the rule reuses approvals, audit and step-up; no new mechanism.
- Harder: with few admins, an incident that locks one of them needs two others available: one to
  request and one to approve. Break-glass custody (two named custodians at separate sites
  [ADM App. D AD-04]) is the backstop.
- Harder: the API must evaluate the incident's state at unlock time, not only when the lock was
  set.

## How it is applied

- Admin lifecycle and approvals: [MOD-01](../execution/1MM-EXE-MOD-01-ADMIN-ACCESS-AND-GOVERNANCE.md);
  incidents: [MOD-17](../execution/1MM-EXE-MOD-17-NETWORK-AND-SECURITY-OPERATIONS.md). MOD-01
  runs first, so it depends on an incident-state port that MOD-17 fulfils (ruling R7, [master plan](../execution/1MM-EXE-00-MASTER-PLAN.md) section 7).
- An unlock that needs approval answers `202` with the approval reference
  ([1MM-STD-13 §4.6](../standards/1MM-STD-13-ERROR-CODES.md)); every step writes
  `admin_audit_log`.
- Checks: API tests for an unlock with no incident, with an open incident (approval required,
  requester cannot approve their own request) and with a closed incident.

## Revisit when

The team grows enough for a stricter rule (no early unlock during an incident), or an incident
review shows the approval was not enough.
