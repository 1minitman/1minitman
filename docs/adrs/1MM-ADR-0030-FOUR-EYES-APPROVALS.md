# 1MM-ADR-0030 · Four-eyes approvals for sensitive admin actions, enforced in the database

|                  |                                                                                                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Status**       | Accepted                                                                                                                                                                                   |
| **Date decided** | 18 Nov 2026 (mechanism and OD-05); 19 Nov 2026 (OD-29, AD-05)                                                                                                                              |
| **Decided by**   | Technical Reference §7.1 and §18.1 baseline (T9: "approvals"); owner decisions OD-05, OD-29, OD-31 (AD-05)                                                                                 |
| **Sources**      | [TR §4.6], [TR §7.1], [TR §10.4], [TR §13.4], [OD-05], [OD-29], [OD-31], [ODT] AD-05, [SQL] `admin_approvals`, `admin_permissions`, `refund_approval_guard()`, `enforce_config_approval()` |
| **Affects**      | packages/db, apps/api (admin surface), apps/admin, MOD-01 and every module with a sensitive admin action                                                                                   |

## Context

One compromised or mistaken admin account must not be able to refund money, ban a member, erase
data or change a price alone. The Technical Reference sets the rule: "permissions marked
`requires_approval` create an `admin_approvals` request. A second admin must approve it, and the
requester can never self-approve" [TR §7.1]. The owner then decided that every admin-initiated
refund needs a second admin "whatever the amount, until a threshold is decided later" [OD-05].

## Decision

1. Whether an action needs approval is data: the flag `requires_approval` on the permission in
   `admin_permissions` [SQL].
2. Such an action creates an `admin_approvals` request; a different admin approves or rejects
   it; the requester can never approve their own request [TR §7.1].
3. The actions covered are: ban, erasure, every admin refund, price or entitlement change, role
   and admin management, legal publishing, maintenance mode, rate limits and IP lists, abuse
   rules, broadcast [TR §7.1].
4. **Refunds:** `billing.refund_approval_threshold_usd_cents = 0`, meaning all refunds; the
   database enforces it with `refund_approval_guard()` [OD-05], [TR §4.6].
5. **Configuration:** in production, a change to a feature flag or remote config needs an
   approved request, except turning a kill switch off (`enforce_config_approval()`, AD-05)
   [ODT], [SQL].
6. **Early admin unlock** needs a second admin while a linked security incident is open [OD-29].
7. The approval id is written to the audit row of the action [TR §7.1].

## Alternatives considered

- **A refund threshold above zero:** deferred by the owner; the key exists so a threshold can be
  set later without a release [OD-05].
- **Approval enforced only in the API or the console:** the sources chose database guards for
  refunds and configuration. **Analysis:** a guard in the database also holds when a second code
  path, a job or a console bug reaches the table.
- **No exemption for kill switches:** not chosen; turning a kill switch off is exempt so an
  incident can be stopped by one person (AD-05) [ODT].

## Consequences

- Easier: no single account can complete a sensitive action; the rule is visible and auditable
  as data.
- Harder: at least two staff with the permission must be available; every approvable action
  needs a pending state, an expiry and a way to show the request to approvers; with a team of
  one, approvable actions cannot be done at all.
- Cost: staff time per approval.

## How it is applied

- The approvals API and console pages are built in
  [MOD-01](../execution/1MM-EXE-MOD-01-ADMIN-ACCESS-AND-GOVERNANCE.md); refunds in
  [MOD-10](../execution/1MM-EXE-MOD-10-BILLING-PLANS-AND-ENTITLEMENTS.md); configuration in
  [MOD-02](../execution/1MM-EXE-MOD-02-PLATFORM-CONFIG-AND-CATALOGUES.md).
- Checks: the schema behaviour tests cover the four-eyes rule, including on every admin refund
  [TR §10.4]; an API test per approvable action that (a) it does not execute without an approved
  request and (b) the requester's own approval is refused.

## Revisit when

The owner sets a refund threshold (OD-05), or the staff count makes two-person availability a
real obstacle to safety work.
