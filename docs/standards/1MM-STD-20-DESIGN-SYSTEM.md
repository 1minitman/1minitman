# 1MM-STD-20 · Design system

|              |                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Document** | 1MM-STD-20                                                                                                                                                                                                                                                                                                                                                                                  |
| **Status**   | Approved baseline · v1.0 · 24 Nov 2026                                                                                                                                                                                                                                                                                                                                                      |
| **Audience** | Engineers and coding agents                                                                                                                                                                                                                                                                                                                                                                 |
| **Owner**    | Engineering lead (code owners); `packages/tokens` is a code-owned path                                                                                                                                                                                                                                                                                                                      |
| **Sources**  | [TOK], [BG §05–§11], [BG §16–§18], [ADM §1.4–§1.9], [ADM A01], [ADM A03], [ADM A04], [WEB §3], [WEB §4.0], [WEB W01–W07], [WEB W10], [TR §2.4], [TR §2.5], [TR §4.5], [TR §5.1], [TR §5.3], [CN handoff], [CN picker-rules], [CN states-rules], [INV], [SQL] `user_settings`, repo: `packages/tokens`, `packages/ui-web`, `packages/ui-native`                                              |
| **Related**  | [1MM-STD-04](1MM-STD-04-BRAND-GUIDE.md), [1MM-STD-09](1MM-STD-09-FORMATTING.md), [1MM-STD-14](1MM-STD-14-CODING-CONVENTIONS.md), [1MM-STD-13](1MM-STD-13-ERROR-CODES.md), [1MM-STD-17](1MM-STD-17-LANGUAGE-CONFIGURATION.md), [1MM-STD-01](1MM-STD-01-TESTING-STRATEGY.md), [1MM-STD-03](1MM-STD-03-MOBILE-BUILD-STRATEGY.md), [1MM-EXE-MOD-00](../execution/1MM-EXE-MOD-00-FOUNDATIONS.md) |

**What this document is for and when to open it.** It describes the one system every UI is built
from: how `tokens.json` becomes code, which components exist and which must be built, the states
every component has, and how a component is added or changed. Open it before you write any UI,
before you add a token, and when a review asks "should this be a shared component?". The brand
rules behind the values are in [1MM-STD-04](1MM-STD-04-BRAND-GUIDE.md).

## 1. Principles

1. **One source.** `packages/tokens/tokens.json` is the only place a colour, size, radius, duration
   or font is defined [BG §16].
2. **Semantic tokens in components.** Components use meaning (`bg`, `fg-2`, `border-strong`), never
   a raw value or a primitive [BG §16], [WEB §3.1].
3. **Build once, use everywhere.** A component is built once in `packages/ui-web` or
   `packages/ui-native` and assembled by the apps [BG §11], [ADM A01].
4. **Every component ships with its states** (§6) and in both themes.
5. A redesign, a new theme or a new family brand changes token values; component code does not
   change [BG §16].

## 2. The token pipeline

```
packages/tokens/tokens.json      W3C design-token format, v3.0.0
        │  node build.mjs        no dependencies; fails on an unresolved {reference}
        ▼
packages/tokens/dist/            generated, git-ignored, never edited
  tokens.css                     CSS variables (light, dark) + Tailwind v4 @theme   → admin, web, site
  index.js / index.d.ts          typed constants                                    → any TypeScript
  tailwind-preset.cjs            Tailwind v3 preset                                 → NativeWind (mobile)
```

| Fact            | Detail                                                                                                                                                                                              |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source file     | `packages/tokens/tokens.json`, identical to [TOK]. It is in `.prettierignore` and is not reformatted.                                                                                               |
| Build           | `pnpm --filter @1minitman/tokens build` runs `node build.mjs`. Turborepo runs it before any dependent `build`, `typecheck`, `test` or `dev` (`dependsOn: ["^build"]` in `turbo.json`).              |
| Check           | The package's `typecheck` script runs `node build.mjs --check`: it resolves every reference and asserts `theme.light.bg` is `#FFFFFF` and `theme.dark.bg` is `#0A0A0A`, then exits without writing. |
| Outputs         | `dist/` is git-ignored (`.gitignore`) and Prettier-ignored. It is rebuilt, never committed, never hand-edited.                                                                                      |
| Package exports | `@1minitman/tokens` (constants), `@1minitman/tokens/tokens.css`, `@1minitman/tokens/tailwind-preset`, `@1minitman/tokens/tokens.json`.                                                              |

The token file's own description and [BG §17] mention a Style Dictionary build and output names
`preset.js` and `tokens.ts`. The repo deliberately uses the dependency-free `build.mjs` and the
names above (GAP-STD20-06, document drift only).

### 2.1 Web: CSS variables for Tailwind v4

`dist/tokens.css` contains, in order:

1. `:root` with the light theme's semantic variables (`--bg`, `--fg`, … `--tier-gold`), plus
   `--art-ink`, `--art-paper`, `--font-sans-stack`, `--font-mono-stack`, `--tier-ring-width`,
   `--touch-min`, `--elevation-menu`, `--elevation-sheet`, `--duration-fast|base|slow`,
   `--easing-standard|exit` and `color-scheme: light dark`.
2. The dark values twice: under `@media (prefers-color-scheme: dark)` for
   `:root:not([data-theme='light'])`, and under `:root[data-theme='dark']`.
3. A Tailwind v4 `@theme inline` block that **clears Tailwind's defaults** (`--color-*: initial`,
   `--radius-*: initial`, `--breakpoint-*: initial`, `--shadow-*: initial`) and then defines only
   the semantic colours, the two font stacks, the four radii (`sm`, `md`, `sheet`, `full`; default
   4 px), the breakpoints (§7), `--container-page` (1200 px), the two shadows and `--ease-standard`.

Result: `bg-fg`, `text-fg-2`, `border-border-strong`, `rounded-sm`, `shadow-menu`,
`max-w-(--container-page)` exist; `bg-red-500` and `rounded-xl` do not.

`packages/ui-web/src/styles.css` is the single stylesheet for the React web apps
(`@import '@1minitman/ui-web/styles.css'` in `apps/admin` and `apps/web`). It imports Tailwind, the
tokens and the Manrope variable font, maps the shadcn/ui variable names onto the tokens, and sets
the base layer: border colour, Manrope at weight 500, the 2 px focus outline and the
reduced-motion rule. `apps/site/src/styles/global.css` imports the tokens directly (the site is
Astro, not React) and repeats the base layer plus the `.art-light` / `.art-dark` illustration swap.

| shadcn name                         | Token it maps to (`packages/ui-web/src/styles.css`) |
| ----------------------------------- | --------------------------------------------------- |
| `background` / `foreground`         | `bg` / `fg`                                         |
| `card`, `popover` (+ `-foreground`) | `raised` / `fg`                                     |
| `primary` / `primary-foreground`    | `inverse-bg` / `inverse-fg`                         |
| `secondary`, `muted`                | `surface` (`muted-foreground` = `fg-2`)             |
| `accent`                            | `sunken`                                            |
| `destructive`                       | `error`                                             |
| `input`                             | `border-strong`                                     |
| `ring`                              | `fg`                                                |

This mapping differs in three places from the one printed in [BG §17] (GAP-STD20-03).

### 2.2 TypeScript constants

`import { themes, space, radius, size, breakpoint, duration, easing, fontFamily, fontWeight,
fontSizes, typography, shadow, haptic, sound, palette } from '@1minitman/tokens'`. Dimensions are
numbers (px or ms). Types: `Tokens`, `ThemeName` (`light`, `dark`, `oled`), `SemanticColor`,
`HapticKind`, `SoundName`. Use the constants where a class name cannot reach: navigation bars,
icon colours, charts, native modules, animation timings. `palette` (primitives) is exported for
tooling and tests; components do not import it.

### 2.3 Native: the NativeWind preset

`dist/tailwind-preset.cjs` **replaces** (not extends) `theme.colors` (semantic names pointing at
`var(--name)`), `theme.borderRadius`, `theme.spacing` (the token scale plus `px` and `touch` =
44 px), `theme.fontSize` (keys `12`…`40`) and `theme.screens` (`sm` 600 px, `md` 1024 px).
`apps/mobile/tailwind.config.js` loads it after `nativewind/preset` and adds only the four Manrope
weight families (`font-body`, `font-caption`, `font-title`, `font-display`).
`ThemeProvider` in `packages/ui-native` sets the CSS variables for the active scheme with
NativeWind `vars()`, so `bg-bg` and `text-fg` follow the device theme.

## 3. Token tiers as they exist

| Tier      | In `tokens.json`                                                                                                                                                                                                                                                                                                      | Reaches code as                                                                                                                                | Rule                                                                                                   |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Primitive | `color.*` (Ink, Paper, black, N50–N950, signal light/dark, reserved `accent`), `tier.*` values, `font.family.*`, `font.weight.*`, `space.*`, `radius.*`, `border.width.*`, `shadow.*`, `motion.duration.*`, `motion.easing.*`, `breakpoint.*`                                                                         | `palette` and the scale constants in TypeScript; **not** as CSS colour variables                                                               | Never referenced by a component for colour. Scales (space, radius, motion) are used through utilities. |
| Semantic  | `theme.light.*`, `theme.dark.*`, `theme.oled.*` (19 names: `bg`, `surface`, `sunken`, `raised`, `fg`, `fg-2`, `fg-3`, `border`, `border-strong`, `inverse-bg`, `inverse-fg`, `error`, `success`, `warning`, `info`, `tier-basic`, `tier-black-badge`, `tier-premium`, `tier-gold`); `typography.*` (nine text styles) | CSS variables and Tailwind colour utilities; preset colours; `themes` and `typography` in TypeScript                                           | What components use.                                                                                   |
| Component | `size.*` (`touch-min`, `button-height`, `input-height`, `reaction`, `tabbar-height`, `icon`, `screen-gutter`, `tabbar-items`), `tier.ring-width`, `logo.*`, `haptic.*`, `sound.*`, `motion.duration.intro`, `undo-toast`, `reduced-step`, `motion.reduced.*`                                                          | `size`, `tierRingWidth`, `haptic`, `sound`, `duration` in TypeScript; `--touch-min`, `--tier-ring-width` in CSS; `touch` spacing in the preset | Only where a component needs a fixed number [BG §16].                                                  |

Not emitted by the build today: `border.width.*`, `logo.*`, `motion.reduced.*`, the typography
styles as web utilities, and `--art-plate` (GAP-STD20-01, GAP-STD20-02).

## 4. Theming

| Surface        | Themes                      | How it is chosen                                                                                                             | Stored                                                                                                                                    |
| -------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Admin, web app | Light, Dark, System         | `initTheme()` before first render; `useTheme()` returns `{ theme, setTheme }` and sets `data-theme` on `<html>`              | `localStorage` key `mm-theme` (absent = System); storage failures fall back to System (`packages/ui-web/src/theme/theme.ts`)              |
| Website        | Light, Dark, System         | Inline script in `<head>` sets `data-theme` before first paint; the header control updates it (W05)                          | `mm-theme`, same rule [WEB §3.1]                                                                                                          |
| Member app     | Light, Dark from the device | `useScheme()` reads the device scheme; `ThemeProvider` applies it; `useThemeColor(name)` returns a raw value for native APIs | Device setting. The member's own choice is `user_settings.theme` (`system`, `light`, `dark`) [SQL]; wiring it is settings work in MOD-03. |

- The OLED values exist in `themes.oled`; no surface selects them, and `theme_t` has no `oled`
  value. It stays an optional app theme [BG §05] and is not part of v1.
- Member photos stay full colour in both themes; illustrations stay Ink on Paper on a Paper plate
  in dark [ADM §1.8].
- Native system components (sheets, tab bars, menus) may adopt platform materials; brand-owned
  surfaces stay flat Ink and Paper [BG §18].

### 4.1 Admin densities

| Mode                  | Table row | Input                       | Body              | Applies                                            |
| --------------------- | --------- | --------------------------- | ----------------- | -------------------------------------------------- |
| Comfortable (default) | 48 px     | 48 px (`size.input-height`) | Default (`body`)  | Always on touch layouts (< 1024 px)                |
| Compact               | 36 px     | 36 px                       | 14 px (`body-sm`) | Desktop only, per-browser setting in the user menu |

Source: [ADM A01]. Density is not built yet: `Button` has a `compact` size, but there is no
density provider or stored setting (§5.1). **Recommendation:** implement density as a
`data-density` attribute on `<html>`, set and stored the same way as the theme, with components
reading it through CSS variables so no component takes a density prop.

## 5. Component inventories

Status values: **Exists** (in the repo today), **Build** (required by a source, not in the repo).
Build work is scheduled in [1MM-EXE-MOD-00](../execution/1MM-EXE-MOD-00-FOUNDATIONS.md) (A01,
site foundations, the app shell) unless a module is named.

### 5.1 Web: `packages/ui-web` (admin console and billing web app)

shadcn/ui style: components are copied into `src/components/` and restyled once
(`components.json`: style `new-york`, CSS variables on, icon library `lucide`), built on Radix
primitives, `class-variance-authority` for variants and `cn()` (`clsx` + `tailwind-merge`).

| Component                                                                 | Status                                                                                                             | Rules that matter                                                                                                                | Source                            |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `Button`                                                                  | Exists (`primary`, `secondary`, `ghost`, `destructive`; sizes `default` 48 px, `compact` 36 px, `icon`; `asChild`) | Loading state (keeps label, adds spinner) is still to add                                                                        | [BG §11], [ADM A01]               |
| `StatusBadge`                                                             | Exists (tones `neutral`, `success`, `warning`, `error`; text always present)                                       | Form per state family (solid, outline, dashed) still to add                                                                      | [ADM A01]                         |
| `cn`, `initTheme`, `useTheme`                                             | Exists                                                                                                             | —                                                                                                                                | repo                              |
| `DataTable`                                                               | Build                                                                                                              | TanStack Table; sticky header; column chooser; sort only on indexed fields with `aria-sort`; cursor pager; keyboard row focus    | [ADM A01], [ADM §1.4]             |
| `FilterBar`                                                               | Build                                                                                                              | Search + chips + "More filters"; every filter is a URL parameter; date presets                                                   | [ADM A01]                         |
| `DetailDrawer`                                                            | Build                                                                                                              | 480 px right drawer, full screen below 1024 px; `Esc` closes; URL carries `?open=<id>`                                           | [ADM A01]                         |
| `Form`                                                                    | Build                                                                                                              | react-hook-form + zod schemas from `packages/contracts`; labels above; counters; "Required" in text; first invalid field focused | [ADM A01]                         |
| `ConfirmDialog`                                                           | Build                                                                                                              | Names action and target; reason field when `requires_reason`; typed target for irreversible actions; default focus on Cancel     | [ADM A01]                         |
| `StepUpDialog`                                                            | Build (with A03, MOD-01)                                                                                           | Fresh MFA for `requires_reauth`                                                                                                  | [ADM A01], [ADM A03]              |
| `ApprovalNotice`                                                          | Build                                                                                                              | Inline banner after an approval-gated action                                                                                     | [ADM A01]                         |
| `Toast`                                                                   | Build                                                                                                              | Bottom-left, 4 px radius, polite live region; success 6 s; Undo toasts 10 s, pause on hover and focus; errors persist            | [ADM A01]                         |
| `EmptyState`                                                              | Build                                                                                                              | Title, body, up to two actions; optional cast illustration                                                                       | [ADM A01], [ADM §1.5]             |
| `Skeleton`                                                                | Build                                                                                                              | Matches the real shape; appears after 300 ms; pulse off under reduced motion                                                     | [ADM A01]                         |
| `StatTile`                                                                | Build                                                                                                              | Label, value, comparison in text, "as of" time, link to records                                                                  | [ADM A01]                         |
| `Chart`                                                                   | Build                                                                                                              | Line, bar, stacked bar, funnel, cohort heatmap; "Show as table" for every chart; never hue alone                                 | [ADM A01], [ADM §1.8]             |
| `SLATimer`                                                                | Build                                                                                                              | Neutral, `warning`, `error` with icon and text                                                                                   | [ADM A01]                         |
| `TierBadge`                                                               | Build                                                                                                              | Plan name + `tier-*` ring tint, dashed for Basic; always text                                                                    | [ADM A01]                         |
| `MaskedValue`                                                             | Build                                                                                                              | Reveal needs permission, reason and step-up; visible 5 minutes                                                                   | [ADM A01]                         |
| `MediaViewer`                                                             | Build                                                                                                              | Short-lived presigned URLs; keyboard controls; watermark on evidence                                                             | [ADM A01]                         |
| `JsonDiff`, `CodeBlock`, `KeyValueList`, `Timeline`                       | Build                                                                                                              | As specified                                                                                                                     | [ADM A01]                         |
| Density setting                                                           | Build                                                                                                              | §4.1                                                                                                                             | [ADM A01]                         |
| Offline bar, "Live updates paused", no-access page, session-ending dialog | Build (shell, A04)                                                                                                 | Standard states in §6                                                                                                            | [ADM §1.5], [ADM §1.6], [ADM A04] |

The gallery route `/_design` (staging only, hidden from navigation, any signed-in admin) shows
every component in light and dark, comfortable and compact, with focus, disabled, loading, error,
empty and offline variants [ADM A01]. It does not exist yet.

The billing web app (`apps/web`) uses the same package: `Button`, `Form`, `Toast`, `EmptyState`,
`Skeleton`, `TierBadge` and the pay-step surfaces are assembled from it (MOD-10).

### 5.2 Web: the website (`apps/site`)

The site is static Astro and does not import `packages/ui-web` (which is React). It shares the
tokens, the base layer and the rules, and keeps its components as `.astro` files in
`apps/site/src/components/`. **Recommendation:** keep it that way; a site component that needs
client behaviour uses a small inline script, not a React island, to hold the budgets in
[WEB §3.7].

| Component                                              | Status                                                                                     | Source                 |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ---------------------- |
| `BaseLayout` (head, theme script, skip link, hreflang) | Exists                                                                                     | [WEB §3.1], [WEB §3.6] |
| `Header`, `Footer`, `BrandMark`, `HomePage`            | Exists (scaffold level)                                                                    | [WEB W01], [WEB W02]   |
| Theme control                                          | Exists as a select in `Header`; W05 asks for a cycling button or menu with an announcement | [WEB W05]              |
| Cookie consent manager                                 | Build (MOD-16)                                                                             | [WEB W03]              |
| Language switcher                                      | Build (MOD-02)                                                                             | [WEB W04]              |
| Site banner                                            | Build (MOD-02, [ruling R13](../execution/1MM-EXE-00-MASTER-PLAN.md#7-coordinator-rulings)) | [WEB W06]              |
| Store CTA and QR                                       | Build (MOD-15)                                                                             | [WEB W07]              |
| `EmptyState`, `Skeleton`, inline error with Retry      | Build                                                                                      | [WEB §3.13]            |
| Ring motif (the 1-Minute ring with text time)          | Build (MOD-15)                                                                             | [WEB §3.5], [WEB W10]  |
| Illustration frame (light/dark art, Paper plate)       | Build; `.art-light` / `.art-dark` classes exist                                            | [WEB §3.4]             |

### 5.3 Native: `packages/ui-native` (member app)

| Component                                     | Status                                                       | Rules that matter                                                                                                                                    | Source                           |
| --------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `Text`                                        | Exists (nine variants, `muted`, `maxFontSizeMultiplier={2}`) | The only way to render text                                                                                                                          | [TOK], [TR §2.4]                 |
| `Button`                                      | Exists (`primary`, `secondary`; 48 px; `testID` required)    | Loading, destructive and ghost variants to add                                                                                                       | [BG §11]                         |
| `EmptyState`                                  | Exists (title, message, one action)                          | Art slot and second action to add                                                                                                                    | [CN states-rules]                |
| `ThemeProvider`, `useScheme`, `useThemeColor` | Exists                                                       | —                                                                                                                                                    | repo                             |
| `Skeleton`                                    | Build                                                        | One primitive; opacity pulse; after 300 ms; respects reduced motion                                                                                  | [TR §4.5], [CN states-rules]     |
| `SearchPicker`                                | Build                                                        | Rows or chips; single or multi with a maximum; accent-insensitive search; selected tray; paged; "Browse all" sheet. Used on GD2, P1, P2, B7, GC3     | [TR §4.5], [CN picker-rules]     |
| `PaymentSheet`                                | Build (MOD-10)                                               | The pay step on B9, P5, GD5 with the platform switch: App Store on iOS, Google Play on Android. The canvas note that describes a card form is stale. | [TR §4.5], [TR §4.6]             |
| `Ring`                                        | Build                                                        | The 1-Minute countdown ring and the avatar tier ring geometry; reduced-motion number mode                                                            | [TR §4.5], [BG §10]              |
| LogoRing loader                               | Build                                                        | Splash and loader (A0, C1); respects reduce-motion                                                                                                   | [INV A0], [INV C1], [CN handoff] |
| Input, code input                             | Build                                                        | 48 px; label above; helper and error text                                                                                                            | [BG §11]                         |
| Chip, Badge (Verified, tier)                  | Build                                                        | Badges keep their form and always carry their name                                                                                                   | [BG §11]                         |
| Avatar with tier ring                         | Build                                                        | Ring width 2 or 3 px by avatar size; dashed for Basic                                                                                                | [BG §05], [TOK]                  |
| Spec card                                     | Build (MOD-07)                                               | Full-colour photo, bottom scrim, verified mark                                                                                                       | [BG §11]                         |
| Reaction bar                                  | Build (MOD-07)                                               | Pass · Somewhat · Like only; 60 px circles; Like solid; each has a button and a gesture                                                              | [BG §11]                         |
| Toast with Undo                               | Build                                                        | Ink toast, 6 s, Undo with a 44 px target and `selection` haptic                                                                                      | [BG §11]                         |
| Confirm sheet                                 | Build                                                        | 16 px top corners; question, consequence, named action, safe exit; `warning` haptic on open                                                          | [BG §11]                         |
| Scarcity card                                 | Build (MOD-07)                                               | Real counts only; one action                                                                                                                         | [BG §11]                         |
| Safe-date bar                                 | Build (MOD-13)                                               | Slim bar under the D9 header                                                                                                                         | [BG §11]                         |
| Prompt answer (text or voice)                 | Build (MOD-04)                                               | Play/pause, waveform, duration; play button labelled in context                                                                                      | [BG §11]                         |
| Blurred preview with lock label               | Build                                                        | 24 px blur plus a solid lock label, never blur alone                                                                                                 | [BG §11]                         |
| Offline banner                                | Build                                                        | ES5                                                                                                                                                  | [CN states-rules]                |

Only `SearchPicker`, `EmptyState`, `Skeleton`, `PaymentSheet` and `Ring` are named by a source
[TR §4.5]; the other names are descriptive and are fixed when each component is built. Tab bar,
sheets and menus use the platform components through Expo Router and are styled with
`useThemeColor`.

## 6. Standard states

Every list, detail, form and component that shows data supports these states. A screen is not
done until each one has been seen.

| State         | Web (admin, web app, site)                                                                                                                                                               | Native                                                                                                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loading       | Skeleton matching the real layout, shown only after 300 ms; buttons keep their label and add a spinner [ADM §1.5], [WEB §3.13]                                                           | Same; no spinners for content [BG §11], [TR §5.3]                                                                                                                         |
| Empty         | One `EmptyState`: title, one line, up to two actions; copy names the active filters. On the site, an empty CMS section is hidden with its heading [WEB §3.13]                            | One `EmptyState` with art, title, body, up to two actions [CN states-rules]                                                                                               |
| Error         | Inline panel with the message for `error.<reason>` (never the problem `title`), copyable `request_id` and Retry; field errors under the field, linked with `aria-describedby` [ADM §1.5] | Inline retry; never "Something went wrong" alone. Presentation follows [1MM-STD-13](1MM-STD-13-ERROR-CODES.md)                                                            |
| Offline       | Admin: a top bar, writes disabled with the reason, last data with its time; nothing is queued. Site: the service worker serves `/offline` [ADM §1.5], [WEB §3.13]                        | ES5 banner; reactions, reads and status changes go to the offline outbox; messages show as failed, never silently queued [CN states-rules]                                |
| Restricted    | No permission: the route is absent from navigation and a direct link shows the no-access page with the permission key [ADM §1.5]                                                         | Entitlement or account gating from the API's problem `reason` and upsell target; a blurred preview carries a lock label [BG §11], [1MM-STD-13](1MM-STD-13-ERROR-CODES.md) |
| Disabled      | Control is disabled and the reason is stated nearby [BG §11]                                                                                                                             | Same; `accessibilityState.disabled` set                                                                                                                                   |
| Stale (admin) | Row shows "Updated · Refresh" instead of jumping [ADM §1.5]                                                                                                                              | Not applicable                                                                                                                                                            |

Interactive components also carry: default, hover (web), pressed, focus-visible, selected.

## 7. Layout grids and breakpoints (web)

| Tailwind name | Width     | Token                | Grid               | Gutter                       |
| ------------- | --------- | -------------------- | ------------------ | ---------------------------- |
| base          | < 600 px  | —                    | 4 columns          | 16 px (`size.screen-gutter`) |
| `sm`          | ≥ 600 px  | `breakpoint.tablet`  | 8 columns          | 24 px                        |
| `md`          | ≥ 1024 px | `breakpoint.desktop` | 12 columns         | 24 px                        |
| `lg`          | ≥ 1280 px | set in `build.mjs`   | Admin desktop step | 24 px                        |
| `xl`          | ≥ 1440 px | set in `build.mjs`   | Dashboard maximum  | 24 px                        |

Sources: [BG §07], [WEB §3.3], [ADM §1.7], `dist/tokens.css`.

- **Website:** content maximum 1200 px (`--container-page`), centred; section padding 64 px on
  mobile and 96 px on desktop; test widths 360, 390, 600, 768, 1024, 1280, 1440 [WEB §3.3].
- **Admin:** ≥ 1280 px full layout (navigation 256 px, optional 480 px drawer); 1024–1279 px icon
  rail (64 px); 600–1023 px modal navigation and priority columns; < 600 px read-mostly cards with
  the short list of allowed writes. Dashboards cap at 1440 px; tables are full width
  [ADM §1.7], [ADM A01].
- **Native:** the preset's `sm` and `md` exist for tablets; tablet behaviour is defined in
  [1MM-STD-03](1MM-STD-03-MOBILE-BUILD-STRATEGY.md).
- Forms on tablet cap at 640 px [BG §07].

## 8. Iconography

| Platform | Library                          | In the repo                                                                                  |
| -------- | -------------------------------- | -------------------------------------------------------------------------------------------- |
| Web      | Lucide                           | `lucide-react` is a dependency of `apps/admin`; `components.json` sets `iconLibrary: lucide` |
| Native   | Feather via `@expo/vector-icons` | Used by the tab layout in `apps/mobile`                                                      |

24 px grid, 2 px stroke; sizes 16, 20, 24 (default, `size.icon`), 32; outline = available, filled
= active; icon-only buttons need a label in context [BG §08]. Custom brand icons (Pass, Somewhat,
Like, Verified, tier marks, the Pair) belong in one shared icon package; it does not exist
(GAP-STD20-04). Until it does, no app draws its own copy of a brand icon.

## 9. Motion tokens

| Where         | Use                                                                                                                                                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web utilities | `duration-150`, `duration-200`, `duration-250` match the three tokens; easing `ease-standard`; raw CSS uses `var(--duration-fast)`, `var(--duration-base)`, `var(--duration-slow)`, `var(--easing-standard)` and `var(--easing-exit)` |
| Native        | `duration.fast`, `duration.base`, `duration.slow`, `easing.standard` and `easing.exit` from `@1minitman/tokens`, passed to Reanimated                                                                                                 |
| Special       | `duration.intro` (60 s ring), `duration['undo-toast']` (6 s), `duration['reduced-step']` (10 s)                                                                                                                                       |

Rules are in [1MM-STD-04 §10](1MM-STD-04-BRAND-GUIDE.md). The web base layers already cap
transitions at 150 ms and stop animations under `prefers-reduced-motion`. A native component reads
the OS setting (and `user_settings.reduce_motion` once settings exist) and renders its
reduced variant.

## 10. Accessibility requirements per component

| Component kind        | Requirement                                                                                                                            | Source                  |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Any control           | A real control; at least 44 × 44 px on touch (24 × 24 px for desktop admin pointer targets); visible 2 px focus ring; label in context | [TR §2.4], [ADM §1.9]   |
| Text                  | Scales to 200%; reflows; never below 12 px                                                                                             | [TR §2.4]               |
| Button                | Loading keeps the label; disabled states why                                                                                           | [BG §11]                |
| Form field            | Visible label (never placeholder-only); error text linked with `aria-describedby`; input kept on error; paste allowed                  | [WEB §3.6], [ADM A01]   |
| Table                 | `<table>` semantics, `scope` headers, `aria-sort`, a caption naming the list and filters; row actions labelled in context              | [ADM §1.9]              |
| Dialog, drawer, sheet | Traps focus, restores it on close, has a programmatic title; `Esc` closes                                                              | [ADM §1.9]              |
| Toast                 | Polite live region; errors assertive; Undo reachable by keyboard for its whole lifetime                                                | [ADM §1.9]              |
| Drag and drop         | A keyboard alternative (Move up / Move down)                                                                                           | [ADM §1.9]              |
| Status, tier, SLA     | Icon or form plus text; never colour alone                                                                                             | [BG §13]                |
| Chart                 | "Show as table"; series told apart without hue                                                                                         | [ADM A01]               |
| Image                 | Alt text from the catalogue or CMS; decorative images have an empty alt                                                                | [WEB §3.6]              |
| Gesture               | A button alternative for every swipe                                                                                                   | [BG §13]                |
| Animated component    | A reduced-motion variant                                                                                                               | [BG §13]                |
| Native component      | `accessibilityRole`, `accessibilityLabel`, `accessibilityState` set; `testID` from the design's `data-testid`                          | [TR §2.4], [CN handoff] |

## 11. Naming and file conventions

| Thing                  | Convention                                                                                                                                  | Example in the repo                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Component file         | kebab-case `.tsx`, one component per file                                                                                                   | `packages/ui-web/src/components/status-badge.tsx`, `packages/ui-native/src/empty-state.tsx` |
| Astro component        | PascalCase `.astro`                                                                                                                         | `apps/site/src/components/BrandMark.astro`                                                  |
| Component name         | PascalCase named export; no default exports in packages                                                                                     | `export const StatusBadge`                                                                  |
| Props type             | `<Name>Props`, exported with the component                                                                                                  | `ButtonProps`, `EmptyStateProps`                                                            |
| Variants               | `cva` on the web with `variant` and `size`; a `variant` union on native                                                                     | `Button`                                                                                    |
| Public surface         | Everything is re-exported from the package's `src/index.ts`; apps import `@1minitman/ui-web` or `@1minitman/ui-native`, never a file inside | `packages/ui-web/src/index.ts`                                                              |
| Class merging          | `cn()` on the web; `className` passed through last so callers can extend layout, not restyle                                                | `button.tsx`                                                                                |
| Test id                | Dotted, from the design: `<screen-or-area>.<group>.<element>`; screen roots `screen.<ID>`                                                   | `welcome.cta.getStarted`, `shell.theme.select`, `screen.D1`                                 |
| Token name             | Lower kebab-case inside its group                                                                                                           | `border-strong`, `tier-black-badge`, `touch-min`                                            |
| Haptic and sound names | From `HapticKind` and `SoundName` only                                                                                                      | `double-soft`, `match-chime`                                                                |

## 12. Adding or changing a component

1. **Design board.** Start from the approved board: the screen id in [INV], the admin module in
   [ADM] or the website module in [WEB]. If the board needs something the system does not have,
   raise a `UI` gap; do not improvise.
2. **Token check.** Every value on the board must map to an existing token. If one does not:
   - it is a mistake on the board → `UI` gap; or
   - a new token is justified → change `packages/tokens/tokens.json` in its own pull request, with
     before and after, contrast results and screenshots in both themes [BG §18]. A new token is a
     minor version; a change to anything fixed needs Product Owner sign-off
     ([1MM-STD-04 §2](1MM-STD-04-BRAND-GUIDE.md)). `packages/tokens/` is code-owned.
3. **Search first.** Check §5: extend an existing component with a variant before adding a new one.
4. **Component.** Build it in `packages/ui-web` or `packages/ui-native` with all states (§6), both
   themes, the accessibility rows in §10, and no copy of its own (labels arrive as props from the
   i18n catalogue). On the web, `pnpm dlx shadcn@latest add <name>` from `packages/ui-web` is the
   starting point where a shadcn component exists; restyle it to the tokens.
5. **Export** it from the package's `src/index.ts`.
6. **Preview.** Web: add it to the admin gallery `/_design` with every variant and state
   [ADM A01]. Native: no preview surface is defined by a source; **Recommendation:** a
   development-only gallery route in `apps/mobile`, excluded from release builds (GAP-STD20-07).
7. **Checks.** `pnpm check`; the automated accessibility and visual checks once they exist
   (GAP-STD04-02, GAP-STD04-03 in [1MM-STD-04](1MM-STD-04-BRAND-GUIDE.md)).
8. **Review.** The reviewer uses the checklist in
   [1MM-STD-04 §17](1MM-STD-04-BRAND-GUIDE.md) and confirms the inventory row in §5 is updated in
   the same pull request.

## 13. What is forbidden

1. Raw hex, `rgb()` or named colours in a component, style object or class name. The only allowed
   places are `tokens.json`, `apps/mobile/app.config.ts` (the Expo config cannot read a variable)
   and the `theme-color` metas in the site layout [WEB §3.1].
2. Arbitrary values where a token exists: `rounded-[6px]`, `p-[13px]`, `duration-[180ms]`, a font
   size outside the scale.
3. Ad-hoc spacing off the 4-point grid.
4. One-off components in an app. Anything used on two screens, or named in §5, lives in a UI
   package. App folders hold screens and screen-specific composition only.
5. Importing a UI package's inner files, or one app importing another (lint-enforced, see
   [1MM-STD-14](1MM-STD-14-CODING-CONVENTIONS.md)).
6. A second stylesheet, CSS-in-JS library, icon set, font or component library.
7. Editing anything in `packages/tokens/dist/`.
8. New shadows, gradients, or colours for decoration; tier colour outside rings and tier marks.
9. Hard-coded copy inside a shared component.
10. A component without its loading, empty, error and disabled behaviour where those apply.
11. Calling `expo-haptics` directly instead of `useHaptic`.

Existing scaffold code breaks rule 2 for type sizes (`text-[32px] leading-[38px]` in the admin and
web shells) because the web has no type utilities yet; that is GAP-STD20-01, and those lines are
replaced when it closes.

## 14. Gaps raised

Dispositions are recorded in [1MM-LOG-03](../1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md)
(Technical Reference and schema), [1MM-LOG-02](../1MM-LOG-02-UI-UPDATES.md) (UI) and
[1MM-LOG-04](../1MM-LOG-04-OPEN-DECISIONS-AND-FOLLOW-UPS.md) (owner decisions and repository
follow-ups).

| Gap id       | Type | Where found                                                                                                  | What is missing or conflicting                                                                                                                                                                                                                                                                                                          | Proposed resolution                                                                                                                                                                                                                                                                                           | Blocks                               |
| ------------ | ---- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| GAP-STD20-01 | REPO | `packages/tokens/build.mjs`; [BG §17], [WEB §4.0] ("no px font sizes")                                       | The build emits no web utilities for the nine `typography.*` styles, so web code writes `text-[32px] leading-[38px] tracking-[-0.03em]` by hand, which the required lint rule would reject.                                                                                                                                             | Emit Tailwind v4 `--text-<name>` variables with their `--line-height`, `--letter-spacing` and `--font-weight` companions for `display`, `h1`, `h2`, `h3`, `title`, `body`, `body-sm`, `caption`, `label`, after `--text-*: initial`; replace the hand-written sizes in `apps/admin`, `apps/web`, `apps/site`. | GAP-STD04-01; A01                    |
| GAP-STD20-02 | REPO | `packages/tokens/build.mjs`; [TOK] `border.width.*`, `motion.reduced.*`, `space.*`; [WEB §3.4] `--art-plate` | (a) `border.width.*` and `motion.reduced.*` are not emitted (components write `border-[1.5px]`). (b) On the web Tailwind v4's open spacing multiplier is left on, so off-scale values such as `p-7` compile. (c) [WEB §3.4] binds inline illustrations to `--art-ink`, `--art-paper` and `--art-plate`; only the first two are emitted. | (a) Emit `--border-hairline`, `--border-control` and `--border-focus`. (b) Set `--spacing-*: initial` and emit the 13 `space.*` steps. (c) Emit `--art-plate` (Paper in both themes).                                                                                                                         | A01; W08 and W10 illustrations       |
| GAP-STD20-03 | REPO | `packages/ui-web/src/styles.css` against [BG §17] shadcn mapping                                             | The repo maps `card` and `popover` to `raised`, and `secondary` and `muted` to `surface`. [BG §17] prints `card` = N50 (`surface`), `secondary`, `muted` and `accent` = N100 (`sunken`) in light, with different dark values.                                                                                                           | Design to confirm which mapping stands; then align the file or record the deviation in an ADR.                                                                                                                                                                                                                | A01 visual sign-off                  |
| GAP-STD20-04 | REPO | [BG §08]                                                                                                     | "Custom brand icons … live in one shared icon package." No such package or folder exists; the Pair mark is redrawn in three app-local `BrandMark` components.                                                                                                                                                                           | Add brand icons (Pair, Pass, Somewhat, Like, Verified, tier marks) to `packages/ui-web` and `packages/ui-native` from one SVG source under `assets/brand/`, or a small `packages/icons`; decide in an ADR.                                                                                                    | MOD-07 reaction bar; A01 `TierBadge` |
| GAP-STD20-05 | UI   | [WEB §3.5] and [WEB §3.3] against [TOK] and [BG §07], [BG §10]                                               | The website spec lists motion durations of 120 and 320 ms and gives toasts an 8 px radius. Tokens v3.0.0 and the brand guide set 150 and 250 ms and say toasts use 4 px.                                                                                                                                                                | The tokens win (newer). Correct [WEB §3.3] and [WEB §3.5].                                                                                                                                                                                                                                                    | none                                 |
| GAP-STD20-06 | TR   | [TOK] `$description`, [BG §17], [TR §4.5]                                                                    | The sources name Style Dictionary and outputs `preset.js` / `tokens.ts`; the repo builds with `build.mjs` into `tokens.css`, `index.js`, `index.d.ts`, `tailwind-preset.cjs`.                                                                                                                                                           | Record the repo's pipeline in the Technical Reference extensions log.                                                                                                                                                                                                                                         | none                                 |
| GAP-STD20-07 | REPO | [ADM A01] `/_design`; no native equivalent in [TR §5] or [INV]                                               | The web has a specified preview surface; native components have none, so states and themes cannot be reviewed in one place.                                                                                                                                                                                                             | Add a development-only gallery route to `apps/mobile` (excluded from release builds).                                                                                                                                                                                                                         | Review of every native component     |

## Change log

| Version | Date        | Change                                                                                                                |
| ------- | ----------- | --------------------------------------------------------------------------------------------------------------------- |
| v1.0    | 24 Nov 2026 | First issue, from tokens v3.0.0, the admin design system (A01), the website global system and the repo as scaffolded. |
