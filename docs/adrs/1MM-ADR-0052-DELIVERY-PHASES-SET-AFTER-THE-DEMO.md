# 1MM-ADR-0052 · Delivery phase dates are set after the demo; the plan is ordered by module, not by date

|                  |                                                                |
| ---------------- | -------------------------------------------------------------- |
| **Status**       | Accepted                                                       |
| **Date decided** | 19 Nov 2026                                                    |
| **Decided by**   | Owner decision OD-17 (tracker item T-5)                        |
| **Sources**      | [OD-17], [ODT T-5], [TR §17], [TR §18.3]                       |
| **Affects**      | docs/execution (all module plans), docs/1MM-LOG-01-PROGRESS.md |

## Context

The Technical Reference carries a four-phase delivery plan from the earlier, smaller scope. The
v3 scope adds groups, meet-ups and safety, support chat, research, the CMS and full role-based
access [TR §17]. The tracker asked for the timeline to be re-planned [ODT T-5].

## Decision

1. Phase dates are set **right after the demo** [OD-17].
2. Until then the working plan is the existing four phases [OD-17], [TR §17].
3. **Consequence for this repository (Recommendation):** the execution plan carries no calendar
   dates. Work is ordered by module (MOD-00 to MOD-19) and by gates, and progress is recorded as
   module states, not as dates met.

## Alternatives considered

- **Re-plan dates now.** Not chosen: the recommendation was to set them after the demo [ODT T-5].

The sources record no other alternatives.

## Consequences

- Easier: the plan stays valid whatever the dates turn out to be; a module is "done" when its
  exit gate passes, which is checkable.
- Harder: nobody can read a delivery date from the repository. Capacity planning happens outside
  it, and the Technical Reference phases [TR §17] no longer map one-to-one to the module order.
- Cost: none.

## How it is applied

- [1MM-EXE-00 Master plan](../execution/1MM-EXE-00-MASTER-PLAN.md) gives the order, dependencies
  and gates; [1MM-ADR-0074](1MM-ADR-0074-MODULE-EXECUTION-ORDER-AND-SHARED-ENDPOINT-RULINGS.md)
  records the ordering rulings.
- [1MM-LOG-01 Progress log](../1MM-LOG-01-PROGRESS.md) tracks each module's state
  ([1MM-STD-07](../standards/1MM-STD-07-PROGRESS-UPDATES.md)).
- Check: review. Dates, staffing and budget do not appear in the repository (it is public).

## Revisit when

The owner sets the phase dates. If phases then need to cut across modules (for example a beta
that needs only some modules), the master plan is revised and this ADR is superseded.
