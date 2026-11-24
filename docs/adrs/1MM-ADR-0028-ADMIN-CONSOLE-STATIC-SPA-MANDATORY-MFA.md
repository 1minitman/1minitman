# 1MM-ADR-0028 · The admin console is a static SPA on its own domain, with mandatory MFA

|                  |                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                                  |
| **Date decided** | 16 Nov 2026 (MVP baseline T9); kept and extended in v3 on 18 Nov 2026                     |
| **Decided by**   | Technical Reference §18.1 baseline (T9); password length by owner decision OD-07          |
| **Sources**      | [TR §4.3], [TR §7.1], [TR §13.1], [TR §13.3], [TR §13.4], [TR §18.1] T9, [OD-06], [OD-07] |
| **Affects**      | apps/admin, apps/api (admin surface), MOD-00, MOD-01, MOD-17                              |

## Context

The admin console can ban members, issue refunds, reveal personal data and change prices. The
baseline (T9) set "Admin MFA + IP allow list", kept in v3 "plus scoped roles, approvals,
hash-chained audit" [TR §18.1]. The console has no server of its own: it is a "static app at
admin.1minit.com on Cloudflare Pages behind the Cloudflare WAF" [TR §7.1], so every rule must be
enforced by the admin API, not by the page.

## Decision

1. `apps/admin` is a static single-page app (Vite + React), hosted on Cloudflare Pages on a
   domain separate from the member product (`admin.1minit.com`) [TR §4.3], [TR §7.1].
2. It talks only to `/admin/v1`. It holds no secrets and no business rules.
3. **Sign-in:** e-mail and password (minimum 12 characters, OD-07) **plus mandatory MFA**, a
   WebAuthn passkey or TOTP (`admin_mfa_factors`). An admin without a confirmed factor cannot
   sign in; `v_admin_mfa_gaps` must be empty [TR §7.1].
4. **Session:** HttpOnly, Secure, SameSite=Strict cookie; 30 minutes idle, 8 hours absolute.
   Permissions marked `requires_reauth` need fresh MFA within 5 minutes [TR §7.1].
5. **Authorisation is server-side on every request** (`v_admin_effective_permissions`). "The UI
   hides what a role can't do, but never relies on hiding" [TR §7.1].
6. **Network:** the production IP allow list lives in `ip_access_rules` and is synced to
   Cloudflare WAF IP lists [TR §7.1].

## Alternatives considered

The sources record no alternatives.

**Analysis:** (a) a server-rendered admin application would need its own compute, against the
lean hosting decision (OD-06, OD-11); (b) optional MFA leaves the highest-privilege accounts
protected by a password alone; (c) bearer tokens in browser storage, as a member-style JWT,
would be readable by injected script, where an HttpOnly cookie is not; (d) serving the console
from the member domain would share cookies and CSP scope with public pages.

## Consequences

- Easier: no admin server to run or patch; the whole attack surface for staff actions is the
  admin API; a stolen password alone is useless.
- Harder: the cookie session needs CSRF defence, and the admin API must be routed at the edge on
  the console's own origin so that the SameSite=Strict cookie is sent (TRX-009; no cross-origin
  calls); passkey and TOTP enrolment, recovery codes and lock-out flows must exist before the
  first admin signs in; staff outside the allow list cannot work.
- Cost: none (Cloudflare Pages free plan).

## How it is applied

- Admin authentication, MFA, sessions and RBAC are built in
  [MOD-01](../execution/1MM-EXE-MOD-01-ADMIN-ACCESS-AND-GOVERNANCE.md); the shell frame in
  [MOD-00](../execution/1MM-EXE-MOD-00-FOUNDATIONS.md) (ruling R20, [master plan](../execution/1MM-EXE-00-MASTER-PLAN.md) section 7); the IP list in
  [MOD-17](../execution/1MM-EXE-MOD-17-NETWORK-AND-SECURITY-OPERATIONS.md).
- Rate limit on admin sign-in: 10 per 15 minutes then 30 minutes [TR §13.3].
- Checks: an alert on MFA gaps [TR §14]; an API test per admin route that a session without the
  permission is refused even when called directly; `pnpm check:client-bundles` proves no
  server-only setting is in the admin build.

## Revisit when

The console needs server-side rendering or a backend-for-frontend (for example to hold
long-running exports), or the organisation adopts single sign-on for staff.
