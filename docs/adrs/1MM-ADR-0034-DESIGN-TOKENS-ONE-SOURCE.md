# 1MM-ADR-0034 · Design tokens come from one source file

|                  |                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                                                                  |
| **Date decided** | 18 Nov 2026 (package in the layout); 23 Nov 2026 (build in the repository)                                                |
| **Decided by**   | Technical Reference §4.5; repository set-up                                                                               |
| **Sources**      | [TR §4.5], [TR §5.1], [TR §6.1], [TOK], `packages/tokens/package.json`, `packages/tokens/build.mjs`, `.github/CODEOWNERS` |
| **Affects**      | packages/tokens, packages/ui-web, packages/ui-native, apps/admin, apps/web, apps/site, apps/mobile, MOD-00                |

## Context

Four user interfaces on three rendering stacks (React Native with NativeWind, React with
Tailwind, Astro with Tailwind) must look like one product in light and dark themes. The brand
pack ships its tokens as one file, `1minitman.tokens.json` v3.0.0 [TOK]. The Technical Reference
places it in the layout: "`packages/tokens`: brand tokens incl. tier-* tokens -> css, NativeWind,
ts" [TR §4.5]; the member app styles with "NativeWind + tokens; light and dark themes; tier
tokens" [TR §5.1] and the website uses "the same tokens" [TR §1].

## Decision

1. `packages/tokens/tokens.json` (brand tokens v3.0.0) is the only source of colour, type,
   spacing and tier values in the repository.
2. `packages/tokens/build.mjs` generates every consumable form from it: a TypeScript module, a
   CSS file (`tokens.css`) and a Tailwind / NativeWind preset (`tailwind-preset`).
3. Apps and UI packages consume only the generated outputs through the package's exports. No
   component carries a literal brand value.
4. The file is copied from the brand pack; a change to a token is a change to the brand and
   goes through code-owner review (`/packages/tokens/` is listed in `.github/CODEOWNERS`).

## Alternatives considered

The sources record no alternatives.

**Analysis:** (a) a theme file per app would let the four interfaces drift apart and would need
every brand change made four times; (b) a hosted design-token service or a runtime theme fetched
from the API would let brand values change without a release, but tokens are compile-time inputs
to Tailwind and NativeWind, and the brand is not something the admin console manages; (c) taking
values by hand from the design boards has no single point of review.

## Consequences

- Easier: one change updates every interface; light and dark themes and tier colours stay
  consistent; the retired plan cannot return as a tier token because it is not in the source.
- Harder: `packages/tokens` must be built before any app (`^build` in `turbo.json`); token names
  are a contract for every component, so a rename is a breaking change across four apps.
- Cost: none.

## How it is applied

- `packages/tokens/` exports `.`, `./tokens.css`, `./tailwind-preset` and `./tokens.json`;
  `pnpm typecheck` runs `node build.mjs --check` for this package.
- Usage rules for engineers: [1MM-STD-20 Design system](../standards/1MM-STD-20-DESIGN-SYSTEM.md)
  and [1MM-STD-04 Brand guide for engineers](../standards/1MM-STD-04-BRAND-GUIDE.md).
- Checks: review rejects a hex colour or a raw spacing or type value in a component;
  `pnpm check:banned-terms` keeps retired product terms out of the repository. The design-system
  module A01 and the site foundations are in
  [MOD-00](../execution/1MM-EXE-MOD-00-FOUNDATIONS.md).

## Revisit when

The brand pack publishes a new token version (the file is replaced as a whole and the diff
reviewed), or per-market or per-campaign theming is required at runtime.
