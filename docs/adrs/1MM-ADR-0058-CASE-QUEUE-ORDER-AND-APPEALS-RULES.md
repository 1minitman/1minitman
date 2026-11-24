# 1MM-ADR-0058 · Case queue ordered by priority then due time; appeals decided within 48 hours, warnings included

|                  |                                                                                                 |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                                        |
| **Date decided** | 19 Nov 2026 (OD-27, OD-28); 21 Nov 2026 (OD-35)                                                 |
| **Decided by**   | Owner decisions OD-27, OD-28 and OD-35                                                          |
| **Sources**      | [OD-27], [OD-28], [OD-35], [UF §12.3 D68], [TR §7], [TR §8.2], [ADM App. D AD-26], [DDR], [SQL] |
| **Affects**      | apps/api, apps/admin (A14, A16), apps/mobile (H6, AS1), packages/db; MOD-04, MOD-05, MOD-09     |

## Context

One moderation queue carries reports, media reviews, appeals, restriction reviews and more
[TR §7]. Its sort order decides which case a reviewer sees next. Appeals had no deadline, and the
design data review found that the boards let a member contest a warning while the schema tied an
appeal to a restriction only [DDR].

## Decision

1. **Queue order: priority, then due time** (`priority` descending, `sla_due_at` ascending).
   Overdue cases rise within their priority band but never above a higher-priority safety case; a
   possible-minor or safety case is always worked first [OD-27]. The index `idx_cases_queue`
   matches this order [SQL].
2. **An appeal is decided within 48 hours** of submission (`appeals.sla_hours = 48`); an overdue
   appeal shows "Overdue by …" [OD-28].
3. **A warning can be appealed**, like a restriction or a suspension. An appeal has exactly one
   target: `appeals.restriction_id` or `appeals.moderation_action_id`, enforced by
   `ck_appeal_target` [OD-35], [SQL].
4. One appeal per decision, within `appeals.window_days` = 30 of the decision [OD-35].
5. A claimed case with no decision is released after `cases.claim_timeout_minutes` = 30
   [ADM App. D AD-26].

## Alternatives considered

The sources record no alternatives for the queue order or the 48-hour target.

**Analysis:** sorting by due time alone would let an overdue low-priority case sit above a safety
case; sorting by age alone ignores the deadline. For OD-35 the alternative was the earlier schema
(restrictions and suspensions only); it was dropped because warnings count on the sanctions
ladder, so members need a way to contest them [UF §12.3 D68].

## Consequences

- Easier: one order for every queue view, served by one index; the API, not the console, sorts.
- Harder: an appeal now has two possible targets, so every query and Member 360 view must handle
  both.
- Harder: the 48-hour target and the 30-day window are config values; expired windows answer
  `410` ([1MM-STD-13 §2.2](../standards/1MM-STD-13-ERROR-CODES.md)).

## How it is applied

- Claim and release mechanics are built once in MOD-04 and reused (ruling R16, [master plan](../execution/1MM-EXE-00-MASTER-PLAN.md) section 7); appeal submission
  is first built in MOD-05 and the workflow in
  [MOD-09](../execution/1MM-EXE-MOD-09-TRUST-AND-SAFETY.md) (ruling R5).
- Lists use keyset pagination on `(priority, sla_due_at, id)`
  ([1MM-ADR-0009](1MM-ADR-0009-KEYSET-PAGINATION-AND-OPTIMISTIC-CONCURRENCY.md)).
- Checks: API tests that an overdue low-priority case stays below a safety case; that a second
  appeal on one decision is refused; that an appeal after the window is refused; that changing
  `appeals.sla_hours` moves the due time.

## Revisit when

Queue data shows low-priority cases starving, or counsel requires a different appeal deadline.
