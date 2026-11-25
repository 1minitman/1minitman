# 1MM-ADR-0063 · A possible minor can be asked for an age check before any ban

|                  |                                                                                                 |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                                        |
| **Date decided** | 21 Nov 2026                                                                                     |
| **Decided by**   | Owner decision OD-33 (default under the standing instruction)                                   |
| **Sources**      | [OD-33], [OD-27], [DDR A23], [UF §12.3 D69], [TR §13], [TR §18.2b], [ADM App. D AD-29], [SQL]   |
| **Affects**      | apps/api, apps/admin (A14), apps/mobile (AS1), apps/worker, packages/db; MOD-09, MOD-05, MOD-04 |

## Context

Sign-up blocks under-18s at the birthday step
([1MM-ADR-0069](1MM-ADR-0069-TEN-STEP-ONBOARDING-AND-UNDER-18-BLOCK.md)), but a date of birth can
be false. When a report or a reviewer suggests a member may be a minor, the sanctions ladder says
`minor` is always a ban [ADM App. D AD-29]. The admin boards showed a third action, asking for
proof of age, which the schema did not support [DDR A23].

## Decision

1. An admin can **ask for an age check** instead of banning at once [OD-33].
2. While it is pending, the profile is hidden (`profiles.hidden_reason = age_check`) and the case
   waits in status `awaiting_member`. The action is `request_age_check` in `moderation_action_t`;
   the request is a row in `age_verification_requests` [OD-33], [SQL].
3. The case reopens when the member sends ID [OD-33].
4. A confirmed minor is banned with reason `minor`. Minor cases are still worked first
   ([1MM-ADR-0058](1MM-ADR-0058-CASE-QUEUE-ORDER-AND-APPEALS-RULES.md)) [OD-33], [OD-27].

## Alternatives considered

- **Ban at once on suspicion** (the only path before the review). Kept as an available action,
  but no longer the only one: the recorded rationale is to avoid banning an adult on a guess
  while keeping a possible minor out of discovery [UF §12.3 D69].

**Analysis:** leaving the profile visible while waiting would expose a possible minor; that is
why hiding is part of the request, not a separate step.

## Consequences

- Easier: reviewers have a proportionate action, and the hidden state protects in the meantime.
- Harder: an identity document is sensitive personal data. Its upload, storage, access, retention
  and deletion need the strictest handling
  ([1MM-STD-12](../standards/1MM-STD-12-DATA-HANDLING.md),
  [1MM-DB-06](../database/1MM-DB-06-DATA-PROTECTION.md)), and the table must be registered in the
  erasure and export manifests (ruling R23, [master plan](../execution/1MM-EXE-00-MASTER-PLAN.md) section 7).
- Harder: a case can now wait on the member, so the queue, the due time and the member-facing
  state (what the member sees while hidden) all need an `awaiting_member` path.

## How it is applied

- The case action and workflow are in [MOD-09](../execution/1MM-EXE-MOD-09-TRUST-AND-SAFETY.md);
  the member-facing account state in [MOD-05](../execution/1MM-EXE-MOD-05-MEMBER-ADMINISTRATION.md);
  the upload reuses the media pipeline from MOD-04 (ruling R1).
- Checks: API tests that a hidden profile leaves discovery at once, that the case reopens on
  upload, that a confirmed minor is banned with reason `minor`, and that a reviewer without the
  permission cannot open the document.

## Revisit when

Counsel's review ([1MM-ADR-0048](1MM-ADR-0048-STAGED-LEGAL-MINIMUM-AND-INTERIM-DPO.md)) sets
rules for collecting identity documents, or an age-assurance vendor replaces the manual check.
