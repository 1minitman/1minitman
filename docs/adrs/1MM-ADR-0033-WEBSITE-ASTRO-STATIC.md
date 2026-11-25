# 1MM-ADR-0033 · The public website is a static Astro site, information-only

|                  |                                                                                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                                                                                             |
| **Date decided** | 16 Nov 2026 (MVP baseline T3); 19 Nov 2026 (information-only, OD-15)                                                                                 |
| **Decided by**   | Technical Reference §18.1 baseline (T3, T11); owner decisions OD-15, OD-21                                                                           |
| **Sources**      | [TR §3], [TR §4.5], [TR §6.1], [TR §18.1] T3 and T11, [OD-01], [OD-15], [OD-21], [ODT] DN-11, `apps/site/astro.config.mjs`, `apps/site/package.json` |
| **Affects**      | apps/site, apps/api (public surface), apps/admin (CMS), MOD-15, MOD-14                                                                               |

## Context

The website explains the product, carries the legal pages and sends people to the stores. The
baseline chose "Astro for the marketing site" (T3, kept) because "static pages rank and load
best" [TR §3], [TR §18.1]. Its budgets are strict: LCP under 2.5 s on 4G, above-the-fold under
500 KB, Lighthouse 95+ in all four categories [TR §6.1]. The owner decided that the website is
information-only, with no web checkout on the marketing site [OD-15], and that its CMS is built
inside the admin console, with no paid headless CMS [OD-21].

## Decision

1. `apps/site` is an Astro site built to static files and hosted on Cloudflare Pages
   [TR §4.5], [TR §6.1]. The repository pins Astro 7.
2. It is information-only: no sign-in, no checkout, no member features [OD-15]. The hero shows
   plain download calls to action through our own `/get` redirect [OD-01], [TR §6.1].
3. Content is not hard-coded: pages are rendered from the CMS tables (`site_pages`,
   `site_blocks`, `site_page_sections`, `media_library`), legal pages from the published
   `legal_documents` row, and the plans block from `prices`, all read through `/public/v1`
   [TR §6.1].
4. Publishing in the admin console triggers a rebuild webhook; the published snapshot keeps
   serving while a newer draft is edited (job `site.publish`, with rollback on a failed smoke
   test) [TR §6.1].
5. Locales: English at the root, `/pcm/` and `/fr/` beside it, with hreflang; never an
   automatic redirect (DN-11) [ODT], [TR §6.1].
6. Forms post to `/public/v1`, rate-limited and bot-checked; the consent banner declines
   analytics by default [TR §6.1].

## Alternatives considered

- **A paid headless CMS:** rejected by OD-21 in favour of the admin console (A28 to A30).
- **Checkout on the website:** rejected by OD-15 (T11 revised).
- **Rendering the site per request from the API:** the sources record no such option.
  **Analysis:** it would need compute at the edge or the origin and would tie page speed in
  Lagos to the EU origin; a static build is served entirely from Cloudflare's edge.

## Consequences

- Easier: the fastest possible pages at no hosting cost; the site stays up when the API is
  down; almost no attack surface.
- Harder: a content change is visible only after a rebuild, so publishing needs a reliable
  pipeline (`cms_publish_runs`) [TR §6.1]; anything live (forms, the trusted-contact page) needs
  client-side calls to the public API; build time grows with content.
- Cost: none (Cloudflare Pages free plan).

## How it is applied

- `apps/site/` (`astro.config.mjs` sets the locales `en`, `pcm`, `fr`); pages in
  `apps/site/src/pages/`.
- CMS, public API and the publish pipeline are built in
  [MOD-15](../execution/1MM-EXE-MOD-15-CMS-AND-PUBLIC-WEBSITE.md); the shared public form
  pipeline in [MOD-14](../execution/1MM-EXE-MOD-14-SUPPORT-AND-HELP.md) (ruling R24, [master plan](../execution/1MM-EXE-00-MASTER-PLAN.md) section 7).
- Checks: `astro check` runs under `pnpm typecheck`; Playwright, axe and bundle budgets in CI
  [TR §17.3]; the Lighthouse and LCP budgets above are exit-gate items.

## Revisit when

Content volume or publishing frequency makes full rebuilds too slow, or the owner reopens OD-15
to put sign-in or checkout on the website.
