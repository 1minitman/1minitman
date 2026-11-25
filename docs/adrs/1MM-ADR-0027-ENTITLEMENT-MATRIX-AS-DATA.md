# 1MM-ADR-0027 · The entitlement matrix is data, enforced by the API and shared with clients

|                  |                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                                                      |
| **Date decided** | 18 Nov 2026                                                                                                   |
| **Decided by**   | Technical Reference §9 and §18.1 baseline (T14: 3 plans, role ladder, Black Badge one-off)                    |
| **Sources**      | [TR §4.5], [TR §4.6], [TR §8.1], [TR §8.3], [TR §9], [TR §10.2], [TR §18.1] T14, `packages/entitlements/src/` |
| **Affects**      | packages/entitlements, packages/db, apps/api, apps/mobile, apps/web, apps/admin, MOD-03, MOD-10               |

## Context

What a member may do depends on a role ladder (BASIC, PENDING_REVIEW, ACTIVE, CLASSIC, SUPER)
derived from verification and live grants [TR §10.2], across more than twenty entitlements
[TR §9]. Plans and limits have already changed several times in the pack, and the owner's rule is
that nothing a member meets is hard-coded when it can change. The Technical Reference puts the
matrix in the database: "The source of truth is `role_entitlements` (seeded in `schema.sql`). It
is served by `GET /v1/me/entitlements` and enforced in the API" [TR §9].

## Decision

1. The matrix lives in the tables `entitlements` and `role_entitlements`, seeded by the schema
   and editable through the admin console (a price or entitlement change needs a second admin's
   approval) [TR §9], [TR §7.1].
2. The member's role is derived by `compute_member_role()`; `users.role` and `users.plan` are
   caches refreshed by `refresh_member_role()`; `v_role_drift` must return no rows [TR §10.2].
3. **The API enforces.** A refused action returns a problem with the machine reason, the
   entitlement key and the upsell target [TR §8.1].
4. **Clients only hint.** They read `GET /v1/me/entitlements` and use `packages/entitlements`
   ("entitlement keys + matrix loader (shared by API and app UI hints)" [TR §4.5]) to show locks
   and upsells; they never decide access.
5. The resolved set is cached in Redis `ent:{user_id}` [TR §4.6]; a change is pushed to the
   device as `entitlements.changed` [TR §8.3].
6. Tunable numbers behind entitlements (for example the daily spec caps) are remote config
   [TR §9].

## Alternatives considered

The sources record no alternatives.

**Analysis:** (a) plan checks written in code (`if plan === 'gold'`) would need a release for
every change and would drift between API and clients; (b) letting the client decide from the
plan name is not a security boundary; (c) a third-party feature-flag service would add a vendor
for what is a seeded table and a cache.

## Consequences

- Easier: a matrix change is an audited data change, live without a release; API and clients use
  the same keys; the upsell target travels with the refusal.
- Harder: every gated use case must ask the resolver, not the plan; the cache must be cleared on
  every grant change (`billing.sync` clears `ent:*` [TR §11]); the key list in
  `packages/entitlements` must stay identical to the seed.
- Cost: none.

## How it is applied

- `packages/entitlements/src/keys.ts` (keys and value types), `roles.ts`, `rules.ts`
  (`isGranted`, `limitOf`, `hasRoom`).
- The read-only resolver and `GET /v1/me/entitlements` are delivered in
  [MOD-03](../execution/1MM-EXE-MOD-03-MEMBER-IDENTITY-AND-AUTH.md); purchases and everything
  that changes entitlements in
  [MOD-10](../execution/1MM-EXE-MOD-10-BILLING-PLANS-AND-ENTITLEMENTS.md) (ruling R2, [master plan](../execution/1MM-EXE-00-MASTER-PLAN.md) section 7).
- Checks: a test compares the key list with the seeded `entitlements` table; an alert fires
  when `v_role_drift` is not empty [TR §14]; review rejects a plan-name comparison in a use case
  or a screen.

## Revisit when

Entitlements need to vary by market or by experiment beyond what `role_entitlements` and remote
config express.
