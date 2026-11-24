# 1MM-ADR-0032 · Admin console and billing web app on Vite + React

|                  |                                                                                                                                                |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                                                                                       |
| **Date decided** | 18 Nov 2026 (stack); 19 Nov 2026 (web app billing-only, OD-15)                                                                                 |
| **Decided by**   | Technical Reference §3 and §18.1 baseline (T3, T11); owner decision OD-15                                                                      |
| **Sources**      | [TR §3], [TR §4.5], [TR §6.2], [TR §7.1], [TR §18.1] T3 and T11, [OD-15], [ODT] T-3, `apps/admin/package.json`, `apps/web/`, `packages/ui-web` |
| **Affects**      | apps/admin, apps/web, packages/ui-web, packages/tokens, every module with `ADM` or `WEB` tasks                                                 |

## Context

The product plan said "Web: Vite, Tailwind, shadcn". The Technical Reference split the web into
three and gave the reason: "Static pages rank and load best. Checkout must be a signed-in
single-page app" [TR §3]. So the admin console and the checkout are client-rendered apps, and
the marketing website is a separate static site
([1MM-ADR-0033](1MM-ADR-0033-WEBSITE-ASTRO-STATIC.md)). The owner then fixed the web app's
scope: billing only in v1; member features stay in the phone app [OD-15].

## Decision

1. **`apps/admin`:** Vite + React + TypeScript, Tailwind v4, shadcn/ui, TanStack Router, Query
   and Table [TR §3], [TR §7.1]. Routes live in `apps/admin/src/routes/`.
2. **`apps/web`:** Vite + React, for checkout and billing only: the Black Badge pay step,
   Premium and Gold pay with a proration preview, billing pages for web-billed members, change
   or cancel plan and update payment method [TR §6.2], [OD-15].
3. Both are static builds on Cloudflare Pages [TR §4.5]. Neither has a server; each talks to
   the API through the generated client for its surface.
4. Shared web components live in `packages/ui-web` ("shadcn components themed with tokens"
   [TR §4.5]).
5. The web app signs in with the same auth as the mobile app, using a secure HttpOnly cookie
   session [TR §6.2].

## Alternatives considered

- **Billing inside the marketing website:** rejected. T11 was revised so that "the website
  stays information-only; billing moves to the web app" [TR §18.1], [OD-15].
- **A full member web app:** asked in the tracker (T-3); the answer was billing only in v1
  [ODT], [OD-15].
- **A server-rendered React framework (for example Next.js):** the sources record no such
  option. **Analysis:** it needs a Node server or edge functions, while both apps are signed-in
  tools with no search-ranking need and the hosting decision keeps compute to the API and the
  worker.

## Consequences

- Easier: static hosting at no cost; preview deployments per pull request [TR §4.4]; one
  component kit for both web apps; the same React skills as the mobile app.
- Harder: everything is client-rendered, so first load depends on bundle size; two separate
  auth models in the browser (admin cookie session with MFA, member cookie session) must not
  be mixed; the web app must stay small and not grow member features without a new decision.
- Cost: none (Cloudflare Pages free plan).

## How it is applied

- `apps/admin/` (TanStack Router with a generated route tree, `routeTree.gen.ts`, never
  hand-edited), `apps/web/`, `packages/ui-web`.
- Only `VITE_`-prefixed settings can reach these builds; each app validates its settings at
  start, and `pnpm check:client-bundles` scans the built bundles for server-only names and
  values (`docs/USAGE.md`).
- Checks: Playwright for web and admin, axe and bundle budgets in CI [TR §17.3]; design rules in
  [1MM-STD-20 Design system](../standards/1MM-STD-20-DESIGN-SYSTEM.md).

## Revisit when

The owner approves a member web app beyond billing (reopens OD-15), or the admin console needs
server-side work that a static app cannot do.
