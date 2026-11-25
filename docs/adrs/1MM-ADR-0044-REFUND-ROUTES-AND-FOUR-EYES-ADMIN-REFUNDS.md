# 1MM-ADR-0044 · Refund routes per provider, and four-eyes approval for admin refunds

|                  |                                                                                                                      |
| ---------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                                                             |
| **Date decided** | 18 Nov 2026 (web provider updated 20 Nov 2026, OD-14)                                                                |
| **Decided by**   | Owner decisions OD-04 and OD-05                                                                                      |
| **Sources**      | [OD-04], [OD-05], [OD-14], [UF §12.3 D48, D49], [TR §4], [ADM §0.4 #7], [ADM App. D AD-07, AD-08], [ADM §1.2], [SQL] |
| **Affects**      | apps/api, apps/worker, apps/admin (A20), apps/mobile (B9, BL screens), packages/db; MOD-06, MOD-10, MOD-01           |

## Context

A Black Badge that is not approved is refunded "through the original provider". Apple offers
developers no API to issue App Store refunds; Google Play and the web provider do
[ADM §0.4 #7]. Separately, the admin spec asked for a large-refund threshold above which a second
admin must approve [ADM App. D AD-07].

## Decision

1. **Google Play and web (Flutterwave, OD-14)** refunds are issued automatically by us, including
   the Black Badge refund when verification is not approved, never for fraud [OD-04], [SQL].
2. **iOS** members are sent to Apple through a guided "Request a refund from Apple" step in the
   app. The Apple refund arrives as a RevenueCat event and is mirrored into `refunds` [OD-04],
   [TR §4].
3. **Every admin-initiated refund needs a second admin's approval**, whatever the amount, until a
   threshold is decided: `billing.refund_approval_threshold_usd_cents = 0`, meaning all refunds
   [OD-05]. The database enforces it with `refund_approval_guard()` [SQL], [TR §4].

## Alternatives considered

- **A refund threshold above zero** (the original AD-07 question): deferred. Zero is the stated
  control against fraud and error on money leaving the system until a threshold is set
  [UF §12.3 D49].
- **Server-issued App Store refunds**: not possible; only Apple can refund App Store purchases
  [TR §2.1].

The sources record no other alternatives.

## Consequences

- Easier: the refund rule is enforced in the database, so no API path can skip the approval.
- Harder: the iOS path is not under our control. The app must show a pending state until the
  RevenueCat event arrives, and the console records the outcome only then [ADM §0.4 #7].
- Harder: an admin refund is asynchronous (request, approval, execution of the stored payload
  [ADM §1.2]); with a small team a second admin must be available.

## How it is applied

- The job `badge.refund` issues the automatic refund and routes iOS members to the guided step
  [SQL `worker_jobs` seed].
- An admin refund returns `202` with the approval reference
  ([1MM-STD-13 §4.6](../standards/1MM-STD-13-ERROR-CODES.md)); approvals are built in
  [MOD-01](../execution/1MM-EXE-MOD-01-ADMIN-ACCESS-AND-GOVERNANCE.md).
- MOD-06 defines the payment, refund and grant port and tests against a fake; the real-money run
  is in MOD-10's exit gate (ruling R14, [master plan](../execution/1MM-EXE-00-MASTER-PLAN.md) section 7).
- Checks: schema tests cover the four-eyes rule on every admin refund [TR §10]; API tests cover
  each provider route and the fraud exception.

## Revisit when

The owner sets a threshold above zero, Apple offers a developer refund API, or the web provider
changes.
