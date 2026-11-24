# 1MM-ADR-0066 · A subscription `on_hold` counts as the member's one live subscription

|                  |                                                                                                 |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                                        |
| **Date decided** | 21 Nov 2026                                                                                     |
| **Decided by**   | Owner decision OD-37 (default under the standing instruction)                                   |
| **Sources**      | [OD-37], [DDR B70], [UF §12.3 D70], [TR §18.2b], [ADM §0.4 #6], [ADM App. D AD-25], [SQL]       |
| **Affects**      | apps/api, apps/worker (billing webhooks), packages/db, apps/mobile (BL1, BL5), apps/web; MOD-10 |

## Context

A member may hold at most one live subscription; a partial unique index enforces it. A store can
put a subscription on account hold: access is paused while the store keeps retrying the payment.
The design data review asked whether a held subscription still counts as live [DDR B70]. If it
does not, the member can buy a second plan, and the first can then recover and bill as well.

## Decision

1. A store subscription in status **`on_hold` counts as the member's one live subscription**
   [OD-37].
2. A new purchase is refused while it is held. The index `uq_subs_one_live` covers the statuses
   `trialing`, `active`, `grace`, `on_hold`, `cancelled` and `paused` [SQL].
3. The held subscription can resume without double billing [OD-37].

Related rule from the admin register: a suspended member's web subscription is paused; a store
subscription cannot be paused by our server, so it keeps billing and the lost days are credited
if the suspension is overturned [ADM §0.4 #6], [ADM App. D AD-25].

## Alternatives considered

- **Treat `on_hold` as not live**, allowing a new purchase. Not chosen: it risks double billing
  when the store recovers the payment [UF §12.3 D70].

## Consequences

- Easier: the database refuses the second subscription whatever path the purchase takes (app,
  web, webhook replay).
- Harder: a member on hold has no access and cannot buy again. The app must explain the state
  and send the member to fix the payment method in the store, not to the plans page.
- Harder: entitlement and "live" are different questions. `on_hold` is live for uniqueness but
  grants no paid access, so the resolver and the index must not share one status list.

## How it is applied

- Billing lifecycle and webhooks: [MOD-10](../execution/1MM-EXE-MOD-10-BILLING-PLANS-AND-ENTITLEMENTS.md);
  the read-only resolver comes from MOD-03 (ruling R2, [master plan](../execution/1MM-EXE-00-MASTER-PLAN.md) section 7).
- The refused purchase is a `409` with a specific code
  ([1MM-STD-13 §2.2](../standards/1MM-STD-13-ERROR-CODES.md)); payment writes carry an
  idempotency key ([1MM-ADR-0008](1MM-ADR-0008-IDEMPOTENCY-KEYS-AND-CLIENT-IDS.md)).
- Checks: a database test that a second live row is refused for each status in the index; API
  tests for hold, recover, expire-from-hold and a purchase attempt during hold; a webhook test
  with events arriving out of order.

## Revisit when

A store changes its account-hold behaviour, or a provider is added whose hold cannot resume.
