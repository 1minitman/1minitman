# 1MM-ADR-0041 · No launch offer; the offers module is built but switched off

|                  |                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                                    |
| **Date decided** | 18 Nov 2026                                                                                 |
| **Decided by**   | Owner decision OD-01                                                                        |
| **Sources**      | [OD-01], [UF §12.3 D45], [TR §2.6], [WEB §9 DN-01, DN-26, DN-28], [ADM App. D AD-22], [SQL] |
| **Affects**      | apps/api, apps/admin (A22), apps/site (W24), packages/db; MOD-10, MOD-15                    |

## Context

The website spec asked which launch inducement to run and listed three options, each with a trial
length, cap, dates and eligible markets to settle, plus per-market promotion terms
[WEB §9 DN-01, DN-28]. The admin spec needed the offer type before building A22
[ADM App. D AD-22].

## Decision

1. There is no launch offer. The website hero and landing page show plain download actions (store
   buttons and a QR code): no inducement, no promo codes, no fee waiver [OD-01].
2. The offer tables, admin module A22 and website module W24 stay in the design and are built,
   but are off: feature flag `offers.enabled = false` [OD-01], [TR §2.6].
3. The database refuses to take an offer live while the flag is off (`offer_campaign_guard()`)
   [SQL], [TR §2.6].
4. Offer fine print is out of launch scope; it is required before any offer is enabled later, per
   open market, and there are no prize draws or lotteries [WEB §9 DN-28], [OD-10].

## Alternatives considered

From [WEB §9 DN-01]:

- **O1** Black Badge fee waived for a launch window, no code.
- **O2** Premium free trial through store codes.
- **O3** Black Badge free through store one-time codes.

All three were set aside. The recorded reason is that no offer keeps launch simple and removes
offer terms from the pre-launch legal work [UF §12.3 D45]; the fraud trade-off of a free badge
became moot [WEB §9 DN-26].

## Consequences

- Easier: launch has no offer eligibility, redemption or expiry paths to verify in production.
- Harder: a module that is built but dark must still be tested, or it rots before first use.
- Cost: the build effort for A22 and W24 is spent before they are used.

## How it is applied

- The flag is a seeded `feature_flags` row; clients read it from the config bootstrap and render
  no offer surface while it is off.
- A22 belongs to [MOD-10](../execution/1MM-EXE-MOD-10-BILLING-PLANS-AND-ENTITLEMENTS.md) ("offers,
  off at launch"); W24 to [MOD-15](../execution/1MM-EXE-MOD-15-CMS-AND-PUBLIC-WEBSITE.md).
- Checks: a database test that publishing an offer fails while the flag is off; client tests for
  both flag states (the "variables change" condition in
  [1MM-STD-01](../standards/1MM-STD-01-TESTING-STRATEGY.md)).

## Revisit when

The owner decides to run an offer. The type is chosen then [ADM App. D AD-22], and the offer terms
are reviewed for each open market first.
