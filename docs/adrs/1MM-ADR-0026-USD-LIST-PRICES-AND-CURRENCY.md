# 1MM-ADR-0026 · USD list prices, versioned; revenue in US cents

|                  |                                                                                                                        |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                                                               |
| **Date decided** | 18 Nov 2026                                                                                                            |
| **Decided by**   | Technical Reference §4.6 and §18.1 baseline (T6: "USD list prices")                                                    |
| **Sources**      | [TR §4.6], [TR §6.1], [TR §10.1], [TR §18.1] T6, [OD-05], [OD-12], [SQL] `usd_cents`, `prices`, `v_public_plan_prices` |
| **Affects**      | packages/db, apps/api, apps/admin, apps/site, apps/web, apps/mobile, MOD-10, MOD-15                                    |

## Context

Members pay through three routes (App Store, Google Play, Flutterwave) and in more than one
local currency, while the business needs one set of numbers. The Technical Reference fixes the
rule in one line: "prices are USD list prices, versioned in `prices`. Stores show local currency.
Revenue is aggregated in US cents" [TR §4.6]. The public list prices are Premium $2.50 a month,
Gold $9.75 a month and the Black Badge as a $1.00 one-off [TR §6.1].

## Decision

1. The list price of every product is held in USD, as integer US cents (domain `usd_cents`
   [TR §10.1]), in the table `prices`.
2. Prices are versioned: a changed price is entered as a new price version, never an edit of
   the old row [OD-12]. Each version carries its real store id; `TBD:*` is used only for a
   product not yet created in its store or provider [OD-12].
3. Stores show local currency [TR §4.6]; the list price we hold is the USD one.
4. Revenue reporting aggregates in US cents [TR §4.6].
5. Money thresholds in configuration are also US cents (for example
   `billing.refund_approval_threshold_usd_cents`) [OD-05].
6. The website plans block reads `prices` [TR §6.1]; schema v3.4 adds the view
   `v_public_plan_prices` for it [TR §10.1]. **Recommendation:** no client hard-codes a price;
   the apps show the price returned by the store or the API.

## Alternatives considered

The sources record no alternatives.

**Analysis:** (a) local-currency list prices per market (for example naira) would need a price
table per currency and a policy for exchange-rate moves, for a launch in one market; (b) decimal
or floating-point amounts invite rounding errors that integer cents avoid; (c) editing a price in
place would break the link between a past transaction and the price it was sold at.

## Consequences

- Easier: one number per product; revenue totals need no currency conversion table; invoices
  and proration are integer arithmetic (the schema test proves $9.75 − $1.67 = $8.08)
  [TR §10.4].
- Harder: what a member pays in local currency is set by the store or the payment provider and
  can differ from a direct conversion; receipts must show the charged currency from the
  provider's record.
- Cost: none.

## How it is applied

- Schema: `plans`, `products`, `prices`, `transactions`, `invoices` [TR §10.1]. A price or
  entitlement change in the admin console needs a second admin's approval
  ([1MM-ADR-0030](1MM-ADR-0030-FOUR-EYES-APPROVALS.md)).
- Built in [MOD-10](../execution/1MM-EXE-MOD-10-BILLING-PLANS-AND-ENTITLEMENTS.md); the website
  plans block in [MOD-15](../execution/1MM-EXE-MOD-15-CMS-AND-PUBLIC-WEBSITE.md).
- Checks: review rejects money as a float and any price literal in client code; a test that a
  new price version leaves earlier transactions unchanged.

## Revisit when

A second live market needs its own local list price on the web, or counsel or a store requires
prices to be shown in local currency by us rather than by the store.
