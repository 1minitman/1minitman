# 1MM-ADR-0040 · Three plans, and the Black Badge as a one-off verification

|                  |                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                                 |
| **Date decided** | 18 Nov 2026                                                                              |
| **Decided by**   | Product decisions D25, D26 and D28 [UF §12.2]; Technical Reference §18.1 baseline T14    |
| **Sources**      | [CB §2], [UF §12.2], [TR §2.1], [TR §9], [TR §18.1], `packages/entitlements/src/keys.ts` |
| **Affects**      | packages/entitlements, packages/db, apps/api, every client; MOD-03, MOD-06, MOD-10       |

## Context

The earlier design had five plans, one of which was the verification itself sold as a recurring
plan. The change brief merged them: the two top tiers overlapped heavily, and a recurring fee for
proof of identity confused both members and the safety logic [UF §12.2 D25, D26]. Every gate in
the product (reactions, chat, groups, media limits) hangs off the plan a member holds, so the
plan model is an engineering contract, not only a price list.

## Decision

1. There are exactly three plans: **Free**, **Premium** and **Gold**. Gold carries every perk of
   the retired fifth plan [CB §2], [UF §12.2 D28].
2. The **Black Badge** is a one-off verification product inside Free. It never renews, never
   lapses and has no cancel control. Payment happens before review; a badge that is not approved
   is refunded, except for fraud [TR §2.1].
3. Verification is permanent and survives a lapsed plan [TR §2.1].
4. The role ladder is `BASIC` → `PENDING_REVIEW` → `ACTIVE` (verified) → `CLASSIC` (Premium) →
   `SUPER` (Gold) [CB §2], [TR §2.1]. The retired plan and its role do not exist in the schema and
   the API rejects them [TR §2.1].
5. D15 is the only plans page; the retired plan screens have no route, deep link or notification
   [TR §2.1]. An upgrade from Premium to Gold is prorated; downgrades and cancellations take
   effect at period end [TR §2.1].

## Alternatives considered

- **Keep five plans** (the earlier decision D1): superseded because three plans compare on one
  page and the two top tiers overlapped [UF §12.2 D25].
- **Black Badge as a subscription**: rejected because verification is identity, not a membership
  [UF §12.2 D26].

## Consequences

- Easier: one entitlement value per role and key; the verified mark never has to be withdrawn for
  a billing reason.
- Harder: the Black Badge needs its own purchase, refund and grant path that is not a
  subscription (no renew, no lapse, no `on_hold`), alongside the subscription lifecycle.
- Cost: none beyond the two code paths.

## How it is applied

- `packages/entitlements/src/keys.ts` and the seeded entitlement matrix [TR §9]; the resolver is
  delivered in MOD-03 and purchases in MOD-10 (coordinator rulings R2, R14, see
  [1MM-ADR-0074](1MM-ADR-0074-MODULE-EXECUTION-ORDER-AND-SHARED-ENDPOINT-RULINGS.md)).
- Module plans: [MOD-06](../execution/1MM-EXE-MOD-06-BLACK-BADGE-VERIFICATION.md),
  [MOD-10](../execution/1MM-EXE-MOD-10-BILLING-PLANS-AND-ENTITLEMENTS.md).
- Checks: `pnpm check:banned-terms` keeps the retired plan's name out of the repository; API tests
  prove the retired codes are rejected and that a badge has no renewal or lapse transition.

## Revisit when

The owner changes the plan ladder, or a market requires a different verification product.
