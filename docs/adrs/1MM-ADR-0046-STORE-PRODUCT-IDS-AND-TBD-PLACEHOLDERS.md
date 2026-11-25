# 1MM-ADR-0046 · Real store product ids on price versions; `TBD:*` only for products not yet created

|                  |                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                              |
| **Date decided** | 18 Nov 2026 (OD-08), updated 19 Nov 2026 (OD-12)                                      |
| **Decided by**   | Owner decisions OD-08 and OD-12                                                       |
| **Sources**      | [OD-08], [OD-12], [OD-14], [UF §12.3 D52, D56], [TR §18.3], [ADM App. D AD-34], [SQL] |
| **Affects**      | packages/db (seeds), apps/api, apps/admin (A19), apps/mobile, apps/web; MOD-10        |

## Context

Purchases are reconciled by the provider's product id on each price. On 18 Nov 2026 the ids were
taken not to exist, so the seed used placeholders [OD-08]. A day later the owner recorded that
the App Store and Google Play products have been live since 1 Jul 2026 [OD-12].

## Decision

1. Each price version carries its **real** store product id [OD-12].
2. `TBD:*` (shown as "Not set") is used only for a product not yet created in its store or
   provider. This includes the Flutterwave payment plans until web billing is set up [OD-12],
   [OD-14].
3. The seed writes placeholders in the form `TBD:<product>:<provider>` in
   `prices.provider_product_id` [SQL].
4. A changed price is entered as a **new price version**, never an edit of the old one [OD-12].

## Alternatives considered

- **Keep placeholders everywhere until all products exist** (OD-08 as first written). Superseded:
  the products exist, and real ids let purchases be reconciled [UF §12.3 D56].

The sources record no other alternatives.

## Consequences

- Easier: price history is append-only, so a receipt always points at the price that applied.
- Harder: a `TBD:*` id must never reach a purchase call. The API and the admin console must treat
  it as "not purchasable".
- Open: the design data review notes the real App Store and Google Play ids for the seed have not
  yet been supplied (closing note of the owner decisions log, after [OD-40]). Until they are, the seed still carries placeholders
  and the real-money run cannot pass.

## How it is applied

- The mobile bundle identifier and package are set to the existing listings before the first
  build ([1MM-STD-03 §2](../standards/1MM-STD-03-MOBILE-BUILD-STRATEGY.md)).
- Prices are managed in A19 and served to clients by the billing endpoints
  ([MOD-10](../execution/1MM-EXE-MOD-10-BILLING-PLANS-AND-ENTITLEMENTS.md)).
- Checks: an API test that a purchase against a `TBD:*` price is refused; a launch-gate item in
  [MOD-19](../execution/1MM-EXE-MOD-19-HARDENING-AND-LAUNCH.md) that no live price is a
  placeholder.

## Revisit when

The real ids are supplied (replace the seed values), the Flutterwave payment plans are created,
or a store requires a product to be re-created.
