# 1MM-ADR-0048 · Staged legal minimum: no real personal data before review, interim DPO and registration

|                  |                                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                                             |
| **Date decided** | 18 Nov 2026                                                                                          |
| **Decided by**   | Owner decision OD-10 (extended by OD-11 for the cross-border transfer)                               |
| **Sources**      | [OD-10], [OD-11], [UF §12.1 D13], [UF §12.3 D54], [TR §4.4], [TR §16.2], [ADM §0.4 #12], [WEB §3.10] |
| **Affects**      | Every environment; apps/api, apps/site forms, test data; MOD-00, MOD-16, MOD-19                      |

## Context

The product processes biometric data (face checks) and other sensitive personal data. The earlier
decision D13 required a DPO, a DPIA, regulator registration and retention rules without saying
what must be in place by when [UF §12.1]. Engineering needed a rule for which environments may
hold real people's data, and from which point.

## Decision

1. **The demo environment uses test accounts and dummy data only.** No real personal data
   [OD-10], [TR §4.4].
2. **No real personal data enters any environment, including the closed beta and the production
   website's forms, until three steps are done** [ADM §0.4 #12], [WEB §3.10]:
   - a review of the drafted Terms, Privacy Policy and Community Guidelines by a Nigerian lawyer;
   - the founder/CTO is named **interim DPO**, reachable at the privacy@ mailbox;
   - the NDPC data-controller registration is filed, with the tier confirmed by the lawyer.
3. The same review covers the transfer of members' data to the EU origin [OD-11].
4. No prize draws or lotteries in any module [OD-10].
5. Later: the DPO role is outsourced, and a per-market legal review happens only when a market
   opens [OD-10].

## Alternatives considered

The sources record no alternatives, only the earlier unstaged requirement (D13). The recorded
rationale is that the minimum must be in place before real people's data, especially biometrics,
enters the system [UF §12.3 D54].

**Analysis:** completing the whole compliance programme before any build work would block
engineering for no added protection, since no real data exists until the beta.

## Consequences

- Easier: engineering can build and demonstrate end to end on synthetic data without waiting for
  the legal steps.
- Harder: every screen state must be reachable from fixtures, because no environment has real
  members before the gate ([1MM-STD-06 §4](../standards/1MM-STD-06-API-FIRST.md), "Fixtures").
- Harder: the first Terms, Privacy Policy and Guidelines are seeded as non-production drafts and
  must be replaced through A30 before real users (ruling R12, [master plan](../execution/1MM-EXE-00-MASTER-PLAN.md) section 7).

## How it is applied

- Data-protection rules for environments: [1MM-STD-12](../standards/1MM-STD-12-DATA-HANDLING.md)
  and [1MM-DB-06](../database/1MM-DB-06-DATA-PROTECTION.md).
- Legal authoring, privacy requests and the DPO contact:
  [MOD-16](../execution/1MM-EXE-MOD-16-LEGAL-PRIVACY-AND-DATA-OPERATIONS.md).
- The three steps are launch-gate items in
  [MOD-19](../execution/1MM-EXE-MOD-19-HARDENING-AND-LAUNCH.md); provisional values that wait for
  the review are in [1MM-ADR-0065](1MM-ADR-0065-LEGAL-SHORT-VERSION-AND-PROVISIONAL-PRIVACY-DEADLINES.md).
- Check: a review item on every seed and fixture change that it contains no real personal data.

## Revisit when

The lawyer's review returns changes, a new market opens, or the DPO role is outsourced.
