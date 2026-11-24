# 1MM-ADR-0025 · Payments: stores through RevenueCat in the apps, Flutterwave on the web

|                  |                                                                                                                        |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                                                               |
| **Date decided** | 17 Nov 2026 (stores via RevenueCat); 19–20 Nov 2026 (Flutterwave on the web)                                           |
| **Decided by**   | Owner decision OD-14 (revises baseline T6 and T13); OD-04, OD-15                                                       |
| **Sources**      | [OD-04], [OD-14], [OD-15], [OD-37], [ODT] T-2 / C-1, [TR §4.6], [TR §6.2], [TR §12], [TR §13.4], [TR §18.1] T6 and T13 |
| **Affects**      | apps/api, apps/worker, apps/mobile, apps/web, packages/db, MOD-06, MOD-10                                              |

## Context

Three things are sold: the one-off Black Badge and the Premium and Gold plans. Inside the apps
"digital features require in-app purchase (App Store guideline 3.1.1)" and external links are
not allowed in the launch markets [TR §4.6]. On the web the baseline named Stripe. The tracker
recorded that Stripe does not open accounts directly for businesses registered in Nigeria, and
asked for the route to be confirmed (T-2) [ODT]. The owner chose Flutterwave on 20 Nov 2026
(C-1) [ODT], [OD-14].

## Decision

1. **In the iOS and Android apps:** every product is sold through App Store / Google Play
   billing, via RevenueCat [TR §4.6].
2. **On the web:** Flutterwave (cards including Verve, bank transfer, USSD, 3-D Secure), under
   the account of 1MINITMAN DATING SERVICES, the name on card statements and receipts
   [OD-14], [TR §4.6]. Checkout lives only in the billing-only web app, never on the website
   [OD-15].
3. **One entitlement service is the source of truth:** RevenueCat and Flutterwave webhooks are
   verified, stored once and re-fetched from the provider before access is granted; grants are
   written to `entitlement_grants` and the role is recomputed by `refresh_member_role()`
   [TR §4.6], [TR §12].
4. `billedVia` decides every action: store plans are changed and cancelled in the store; web
   plans through our billing API over the Flutterwave API (there is no hosted customer portal)
   [TR §4.6].
5. Refund routing follows OD-04: iOS members are sent to Apple; Google Play and Flutterwave
   refunds are issued by us [OD-04], [TR §4.6].
6. No card data touches our systems (store sheets, Flutterwave hosted checkout) [TR §13.4].
7. In the schema `payment_provider_t` has `flutterwave`; `stripe` remains as a legacy value only
   [OD-14].

## Alternatives considered

- **Stripe on the web** (T6, T13): replaced by OD-14.
- **Paystack:** considered and not chosen [OD-14], [ODT].
- **Web checkout on the marketing website:** rejected by OD-15.
- **Link-out from the apps to web checkout:** listed as after-launch, "where store rules allow"
  [TR §17.1].

## Consequences

- Easier: smallest PCI scope; local payment methods on the web; one grant model whatever the
  payment route.
- Harder: three providers to reconcile; proration and failed-payment retries on the web are
  computed by our entitlement service and billing worker [TR §4.6]; plan management pages are
  ours to build; store fees apply in the apps.
- Flutterwave payment-plan ids stay `TBD:*` until web billing is set up [OD-12].

## How it is applied

- Built in [MOD-10](../execution/1MM-EXE-MOD-10-BILLING-PLANS-AND-ENTITLEMENTS.md); the Black
  Badge payment port is defined in MOD-06 and proven with real money in MOD-10 (ruling R14, [master plan](../execution/1MM-EXE-00-MASTER-PLAN.md) section 7).
- Webhooks: `/webhooks/revenuecat`, `/webhooks/flutterwave` [TR §8.2].
- Checks: webhook replay and idempotency tests; a test that a held subscription (`on_hold`)
  blocks a second purchase [OD-37]; store rules are reviewed before any US or EU launch
  [TR §4.6].

## Revisit when

Store rules in a launch market allow external purchase links, a US or EU launch is planned, or
Flutterwave cannot serve a new market.
