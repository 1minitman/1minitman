# 1MM-ADR-0050 · The website is information-only and the web app is billing-only

|                  |                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                                          |
| **Date decided** | 19 Nov 2026                                                                                       |
| **Decided by**   | Owner decision OD-15 (tracker item T-3); Technical Reference §18.1 baseline T3 and T11            |
| **Sources**      | [OD-15], [ODT T-3], [UF §12.3 D59], [TR §6], [TR §18.1], [WEB §0.3 #2, #3], [WEB §9 DN-04, DN-05] |
| **Affects**      | apps/site, apps/web, apps/api (`/public/v1`, `/v1` billing routes); MOD-10, MOD-15                |

## Context

The sources disagreed. One payment note mentioned web payments on the website's domain, while the
brand documents said the website has no payments; the brand guide's header showed "Sign in" while
the same section said the website has no sign-in [WEB §0.3 #2, #3]. The tracker asked whether the
web app grows beyond billing into a member web app [ODT T-3].

## Decision

1. The **website** (`apps/site`) is information-only: no checkout, no account and no payment form
   [OD-15], [WEB §0.3 #3]. Its header has no "Sign in" [WEB §9 DN-04].
2. The **web app** (`apps/web`) is billing-only in v1 [OD-15].
3. Member features (chat, matching, groups) stay in the phone app [OD-15].

## Alternatives considered

- **A member web app** (the T-3 question). Not chosen for v1; the recommendation was "billing only
  in v1; website stays information-only" [ODT T-3]. The recorded rationale is a lean launch and
  simple store rules [UF §12.3 D59].
- **Checkout on the marketing site.** Not chosen; if web checkout is ever added to the site it is
  a separate project [WEB §0.3 #3].
- **Replace "Sign in" with an "Open the app" link** on phones: off until universal links ship
  [WEB §9 DN-04].

## Consequences

- Easier: the website stays static (Astro) with a small, cacheable surface and no session; the
  web app has one job and a small bundle.
- Easier: the website calls only `/public/v1`; it never holds a member token
  ([1MM-ADR-0004](1MM-ADR-0004-API-SURFACES-AND-WEBHOOKS.md)).
- Harder: a member who wants to manage billing on the web signs in to a second application, so
  links from the site to the web app must be explicit.

## How it is applied

- `apps/site` contains no authenticated route and no payment code; `apps/web` contains sign-in,
  checkout and billing pages only [TR §6.2].
- Plans: [MOD-15](../execution/1MM-EXE-MOD-15-CMS-AND-PUBLIC-WEBSITE.md) (site),
  [MOD-10](../execution/1MM-EXE-MOD-10-BILLING-PLANS-AND-ENTITLEMENTS.md) (web app checkout),
  [MOD-03](../execution/1MM-EXE-MOD-03-MEMBER-IDENTITY-AND-AUTH.md) (web app sign-in).
- Checks: `pnpm check:client-bundles`; review rejects a member feature route in `apps/web` or a
  form on `apps/site` that is not one of the public forms in the website spec.

## Revisit when

The owner decides to build a member web app or web checkout on the site. Either is a new ADR and
a new module scope.
