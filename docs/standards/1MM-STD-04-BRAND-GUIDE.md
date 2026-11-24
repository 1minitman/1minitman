# 1MM-STD-04 · Brand guide for engineers

|              |                                                                                                                                                                                                                                                                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Document** | 1MM-STD-04                                                                                                                                                                                                                                                                                                                                       |
| **Status**   | Approved baseline · v1.0 · 24 Nov 2026                                                                                                                                                                                                                                                                                                           |
| **Audience** | Engineers and coding agents                                                                                                                                                                                                                                                                                                                      |
| **Owner**    | Engineering lead (code owners), with the brand custodian for anything in §2 "fixed"                                                                                                                                                                                                                                                              |
| **Sources**  | [BG §01–§18] (Brand Guide v3.1), [BS §7], [BS §8], [BS §9], [BS §10], [BS §15], [TOK] (tokens v3.0.0), illustration set and `LICENCE_LOG.csv`, logo pack file names, [TR §2.4], [TR §2.5], [ADM §1.8–§1.10], [ADM A01], [WEB §3], [INV], [SQL] `user_settings`, [OD-01], [OD-03], [OD-09], [OD-18], [OD-24], [OD-25], [OD-31], [CN brand-review] |
| **Related**  | [1MM-STD-20](1MM-STD-20-DESIGN-SYSTEM.md), [1MM-STD-17](1MM-STD-17-LANGUAGE-CONFIGURATION.md), [1MM-STD-09](1MM-STD-09-FORMATTING.md), [1MM-STD-14](1MM-STD-14-CODING-CONVENTIONS.md), [1MM-STD-01](1MM-STD-01-TESTING-STRATEGY.md), [1MM-STD-03](1MM-STD-03-MOBILE-BUILD-STRATEGY.md)                                                           |

**What this document is for and when to open it.** It is the brand, restated as rules that code
must obey. Open it before you build or review any screen, component, e-mail, illustration slot or
piece of UI text, and use the checklist in §17 on every UI pull request. The values themselves live
in `packages/tokens/tokens.json`; [1MM-STD-20](1MM-STD-20-DESIGN-SYSTEM.md) explains how they reach
the apps. Where this document and an owner decision disagree, the owner decision wins.

## 1. Brand essence

1minitman promises: "Meet real people who won't waste your time." The brand line is "Don't waste
my time." and the short line is "Real people. No time wasted." [BG §01], [BS §8], [OD-31]. The
product proves the promise three ways, on every screen: **Real** (phone and face verified, with the
verified mark wherever a person appears), **Intentional** (matched on stated intentions and specs)
and **Respect for time** (the 1-Minute Intro, honest daily limits, fast exits). The personality is
calm, direct, respectful and a little warm; the look is Ink and Paper, bright, with a lot of space.
Members' photos supply the colour and the tier ring is the only coloured chrome [BG §01].

Four ideas explain every rule below [BG §01]:

| Idea                     | What it means in code                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Colour belongs to people | The interface is monochrome. Only member photos and the tier ring carry colour.                                    |
| Solid and open           | Filled means chosen or active; outlined means available. This holds for icons, buttons, chips and tabs.            |
| One minute               | A screen is understood at a glance and finished in under a minute. The countdown ring is the one signature motion. |
| Trust is visible         | Verification ticks, tier names and safety prompts are designed elements, never small print.                        |

## 2. What is fixed and what is adjustable

| Class                        | Items                                                                                                      | How it changes                                                              |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Fixed                        | The Pair symbol and wordmark construction; Ink and Paper; Manrope; solid = chosen, open = available        | Only with a full rebrand and Product Owner sign-off [BG §18], [BS §15]      |
| Adjustable                   | Neutral ramp, signal colours, extra themes, type scale, spacing, radius, motion timings, component visuals | Through `packages/tokens/tokens.json` and the design-system review [BG §18] |
| Plan model and use of colour | Plans, tier rings, any new colour                                                                          | Product Owner sign-off [BS §15]                                             |

Versioning: the guide and the tokens share a version (now v3 / tokens 3.0.0). Patch = value fix;
minor = new token or component; major = a change to anything fixed or to the plan model [BG §18].

## 3. Plans and tier identity

There are three plans: **Free, Premium, Gold**. **Black Badge** is a one-off verification. It never
renews and never lapses, so it has no renew or cancel control, and it is never described as a
plan or a membership [BG §11], [BS §8].

| Thing                           | Member role (`member_role_t`) | Ring                      | Public price format |
| ------------------------------- | ----------------------------- | ------------------------- | ------------------- |
| Free, not yet verified          | `BASIC`, `PENDING_REVIEW`     | Basic, dashed             | $0                  |
| Black Badge (verified, on Free) | `ACTIVE`                      | Black Badge, solid        | $1.00 one-off       |
| Premium                         | `CLASSIC`                     | Premium (Platinum), solid | $2.50 / month       |
| Gold                            | `SUPER`                       | Gold, solid               | $9.75 / month       |

Sources: [TOK] `tier.$description`, [BG §05], [BG §11]. Prices are shown here only to fix their
format; code reads them from the `prices` table through the API and never hard-codes them.

### 3.1 Tier rings (WCAG-checked)

| Tier        | Light             | vs Paper / N50 | Dark              | vs Ink / N900 | Rule                                                                           |
| ----------- | ----------------- | -------------- | ----------------- | ------------- | ------------------------------------------------------------------------------ |
| Basic       | `#858583`, dashed | 3.70 / 3.45    | `#737371`, dashed | 4.17 / 3.78   | Passes 3:1 for UI graphics only. Never text. The dash carries the meaning too. |
| Black Badge | `#0A0A0A`         | 19.8 / 18.5    | `#FFFFFF`         | 19.8 / 17.9   | Passes AAA.                                                                    |
| Premium     | `#6E737B`         | 4.77 / 4.45    | `#B4B9C1`         | 10.0 / 9.1    | 4.45:1 on N50 is under 4.5:1, so tier text stays in `fg`.                      |
| Gold        | `#8A6414`         | 5.37 / 5.00    | `#D4A64A`         | 8.82 / 7.99   | Passes 3:1 for graphics and 4.5:1 for text.                                    |

Source: [BG §05], [TOK] `tier.*`. Rules:

1. Tier colour is used for the avatar ring and the tier badge mark only. Never for a button fill,
   background, text block, illustration or decoration [BG §05], [BS §9].
2. A ring is always paired with the tier name in text [BG §05].
3. Ring stroke is 3 px on avatars of 40 px and larger and 2 px on avatars up to 32 px [TOK]
   `tier.ring-width`, [OD-31].
4. A "Get Gold" button is a monochrome button carrying the Gold mark, never a gold-filled button
   [BG §05].
5. Use the semantic classes `tier-basic`, `tier-black-badge`, `tier-premium`, `tier-gold`; they
   switch with the theme.

## 4. Colour

### 4.1 Primitive tokens (never used directly in components)

| Token                       | Value                                      | Allowed use                                                                       |
| --------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------- |
| `color.ink`                 | `#0A0A0A`                                  | Brand black. 19.8:1 on Paper.                                                     |
| `color.paper`               | `#FFFFFF`                                  | Brand white.                                                                      |
| `color.black`               | `#000000`                                  | OLED theme background only. Never the logo, never text.                           |
| `color.n50` – `color.n300`  | `#F7F7F5`, `#EDEDEB`, `#E3E3E1`, `#D1D1CF` | Light surfaces and dividers; N300 is secondary text on dark.                      |
| `color.n400`                | `#A3A3A1`                                  | Dark theme tertiary text and placeholder (7.84:1 on Ink). Fails as text on Paper. |
| `color.n500`                | `#737371`                                  | Light tertiary text (4.75:1), control borders in both themes (≥ 3:1).             |
| `color.n600`                | `#575755`                                  | Light theme secondary text (7.24:1).                                              |
| `color.n700` – `color.n950` | `#3F3F3D`, `#262625`, `#171716`, `#050505` | Dark surfaces (N800 raised, N900 surface, N950 sunken).                           |
| `color.error.*`             | `#B42318` light, `#F97066` dark            | State only.                                                                       |
| `color.success.*`           | `#067647` light, `#47CD89` dark            | State only.                                                                       |
| `color.warning.*`           | `#B54708` light, `#FDB022` dark            | State only.                                                                       |
| `color.info.*`              | `#175CD3` light, `#84ADFF` dark            | State, and in-text links where an underline alone is not enough [WEB §3.1].       |
| `color.accent`              | none (reserved slot)                       | Unused. Not to be filled without a brand decision [BG §18].                       |

Source: [TOK] `color.*`, [BG §05]. The neutral ramp is slightly warm, never blue-grey.

### 4.2 Semantic tokens (what components use)

| Token                                                         | Light        | Dark        | Use                                      |
| ------------------------------------------------------------- | ------------ | ----------- | ---------------------------------------- |
| `bg`                                                          | Paper        | Ink         | App and page background                  |
| `surface`                                                     | N50          | N900        | Cards, sheets, grouped lists             |
| `sunken`                                                      | N100         | N950        | Inputs on a surface, skeletons, disabled |
| `raised`                                                      | Paper        | N800        | Raised layers (menus, popovers)          |
| `fg`                                                          | Ink          | Paper       | Primary text, primary buttons, icons     |
| `fg-2`                                                        | N600         | N300        | Secondary text                           |
| `fg-3`                                                        | N500         | N400        | Placeholder, captions, timestamps        |
| `border`                                                      | N200         | N800        | Dividers                                 |
| `border-strong`                                               | N500         | N500        | Control borders (3:1)                    |
| `inverse-bg` / `inverse-fg`                                   | Ink / Paper  | Paper / Ink | Primary button, Ink bands, toasts        |
| `error`, `success`, `warning`, `info`                         | light values | dark values | State only                               |
| `tier-basic`, `tier-black-badge`, `tier-premium`, `tier-gold` | §3.1         | §3.1        | Rings and tier marks only                |

Source: [TOK] `theme.light`, `theme.dark`, [BG §05]. The optional OLED theme is the dark theme with
`bg` `#000000` and `surface` `#0A0A0A` [TOK] `theme.oled`; it is an app option and the website does
not ship it [WEB §3.1].

### 4.3 Colour rules

1. **The 98/2 rule.** At least 98% of any screen is Ink, Paper and neutrals. Signal colours appear
   only for errors, success confirmations, warnings and safety notices, always with an icon and
   text [BG §05].
2. Likes and matches are never shown by colour: they use shape, fill and labels [BG §05].
3. Nothing depends on colour alone [BG §13].
4. Text over a photo sits on a bottom scrim (Ink, 0 → 82%) [BG §11].
5. Member photos are always full colour and never filtered, tinted or converted [BG §09].
6. Pages and screens follow the system theme by default; dark is offered, never forced [BG §01].
7. On the website, at most two Ink bands per page; they use `inverse-bg` / `inverse-fg` [WEB §3.1].
8. Charts in the admin console use Ink and neutral series told apart by line style, marker and
   direct labels, never by hue alone [ADM §1.8].

## 5. Typography

Manrope is the only typeface on mobile and web (SIL Open Font License). It is bundled in the app
and self-hosted on the web; there is no runtime request to a font service [BG §06]. Monospace
(`font.family.mono`, JetBrains Mono first) is for ids, hashes, IPs and JSON in the admin console
only [ADM A01].

| Style               | Size / line           | Weight | Tracking           | Example use                              |
| ------------------- | --------------------- | ------ | ------------------ | ---------------------------------------- |
| `display`           | 40 / 44 (web 64 / 68) | 800    | −0.04em            | "It's a match."                          |
| `h1` (screen title) | 32 / 38               | 800    | −0.03em            | Screen titles                            |
| `h2`                | 24 / 30               | 700    | −0.02em            | Section titles                           |
| `h3`                | 20 / 26               | 700    | −0.01em            | Card titles                              |
| `title`             | 17 / 24               | 700    | 0                  | List row titles, button labels on native |
| `body`              | 16 / 24               | 500    | 0                  | Body text                                |
| `body-sm`           | 14 / 20               | 500    | 0                  | Secondary text                           |
| `caption`           | 12 / 16               | 600    | +0.01em            | Timestamps, meta                         |
| `label`             | 12 / 16               | 800    | +0.12em, uppercase | Badges, table headers                    |

Source: [TOK] `typography.*`, [BG §06]. Rules:

1. Eight sizes only: 12, 14, 16, 17, 20, 24, 32, 40 px. Nothing below 12 px; no 13 px [TOK]
   `typography.scale`. The admin console does not use 40 [ADM A01]. Marketing pages may use the web
   display sizes in [WEB §3.2].
2. Body text is never below 16 px on mobile; secondary text never below 14 px [BG §06].
3. Sizes scale with the device text-size setting up to 200%; layouts reflow, never truncate
   [BG §06], [TR §2.4].
4. Sentence case everywhere, including buttons. Capitals only for short labels and badges [BG §06].
5. Timers, prices, counts and codes use tabular figures [BG §06].
6. Left-aligned, never justified; 45–75 characters a line on the web [BG §06].

## 6. Shape, radius and spacing

| Token                 | Value              | Use                                                                                             |
| --------------------- | ------------------ | ----------------------------------------------------------------------------------------------- |
| `radius.sm` (default) | 4 px               | Buttons, inputs, boxes, CTAs, cards, photos, chips, badges, toasts                              |
| `radius.md`           | 8 px               | Menus and tooltips only                                                                         |
| `radius.sheet`        | 16 px, top corners | Bottom sheets                                                                                   |
| `radius.full`         | 9999 px            | People and rings only: avatars, tier rings, the 1-Minute ring, the three round reaction buttons |

Spacing is a 4-point grid: `space.0`–`space.24` = 0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80,
96 px. The screen gutter is 16 px (`size.screen-gutter`) [TOK], [BG §07].

| Size token                                | Value | Note                                                                            |
| ----------------------------------------- | ----- | ------------------------------------------------------------------------------- |
| `size.touch-min`                          | 44 px | Minimum tap target; small chips, links and Undo get an invisible 44 px hit area |
| `size.button-height`, `size.input-height` | 48 px | Primary buttons are full width on phones, in the bottom third                   |
| `size.reaction`                           | 60 px | Pass, Somewhat, Like circles                                                    |
| `size.tabbar-height`                      | 56 px | Five tabs: My Specs, Likes, Chats, Groups, Profile                              |
| `size.icon`                               | 24 px | Default icon                                                                    |

Depth comes from borders and surfaces, not shadows. Only two shadows exist: `shadow.menu` and
`shadow.sheet` [BG §07]. Border widths: 1 px hairline, 1.5 px control, 2 px focus [TOK]
`border.width.*`.

## 7. Logo

The two i's of "minit" become two people leaning in, one solid and one open [BG §03]. The logo is
artwork. It is never typed in a font, because a typed name loses the heads.

| Rule                      | Value                                                                                    | Source          |
| ------------------------- | ---------------------------------------------------------------------------------------- | --------------- |
| Colours                   | Ink or white only. White on Ink is primary. Never `#000000`.                             | [BG §03]        |
| Order                     | Solid head left, open head right                                                         | [BG §03]        |
| Lean                      | Exactly 7° towards each other (`logo.pair-lean-deg`)                                     | [TOK], [BG §03] |
| Clear space               | H on every side, where H is the diameter of the solid head (17% of symbol height)        | [BG §03]        |
| Minimum symbol            | 24 px (`logo.min-symbol-px`); below 32 px use the small-size cut                         | [TOK], [BG §03] |
| Minimum wordmark          | 155 px wide (`logo.min-wordmark-px`)                                                     | [TOK], [BG §03] |
| Minimum horizontal lockup | 200 px wide                                                                              | [BG §03]        |
| Favicon                   | 16 px, small cut; the solid head alone is allowed                                        | [BG §03]        |
| On photos                 | White, only over areas darker than N600, or on a solid Ink plate                         | [BG §03]        |
| Endorsement "by 1minit"   | App-store listing, website footer, legal pages only. Never in the app UI or on the icon. | [BG §02]        |

**Misuse (all forbidden)** [BG §03]: swapping the heads; adding colour, gradients or glow;
changing the lean; pure black; retyping the wordmark; adding a heart, flame or emoji.

### 7.1 Logo files

Sources live in `assets/brand/`; apps copy what they use and never import from `assets/` at runtime
(`assets/README.md`).

| Need                                  | File(s) in `assets/brand/`                                                                                                             |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Symbol, follows the theme             | `1minitman-mark.svg`; fixed colour: `1minitman-mark-ink.svg`, `1minitman-mark-paper.svg`, `mark-black.svg`, `mark-white.svg`           |
| Horizontal lockup                     | `lockup-horizontal-black.svg`, `lockup-horizontal-white.svg`                                                                           |
| Stacked lockup (splash, square posts) | `lockup-stacked-black.svg`                                                                                                             |
| Wordmark rasters                      | `1minitman-wordmark-ink@64` / `@160` and `1minitman-wordmark-paper@64` / `@160` (`.png`, `.webp`)                                      |
| Web icons                             | `favicon.svg`, `favicon.ico`, `apple-touch-icon-180.png`, `pwa-icon-maskable-512.png`, `1minitman-icon-*-bg-{32,180,192,512,1024}.png` |
| App icons                             | `app-icon-ios-1024.png`, `app-icon-android-adaptive-foreground-432.png`, `app-icon-android-playstore-512.png`                          |
| Sharing                               | `social-share-1200x630.png`, `social-avatar-800.png`                                                                                   |

App icon rules: iOS 1024 × 1024, square, no transparency, Ink background, white symbol; Android
adaptive foreground inside the safe zone on a solid `#0A0A0A` background layer, plus a monochrome
layer for themed icons [BG §04]. The monochrome layer and the iOS dark and tinted variants are not
in the repo yet (GAP-STD04-05). The Expo configuration (`apps/mobile/app.config.ts`) is one of the
few places where a raw Ink or Paper hex is allowed, because the file cannot read a CSS variable.

## 8. The ring motif

The countdown ring is the brand's one signature motion [BG §10].

1. It empties clockwise over 60 s (`motion.duration.intro`), with linear easing
   (`motion.easing.linear`, used nowhere else) [TOK].
2. The time is always also shown as text, in tabular figures [BG §10], [WEB §3.5].
3. With reduced motion on, the ring is replaced by the number counting down in 10-second steps
   (`motion.duration.reduced-step`) [TOK].
4. At 10 s left the `double-soft` haptic fires (screens A3, MF2, MF4) [TR §2.5].
5. The CTA that starts it is always "Start your minute". Never "Start intro" or "Call" [BG §11].
6. The intro length a member meets is the `intro.seconds` remote-config value served by the API;
   the token is the animation default, not the business rule.
7. Circles are reserved for people and rings (§6). Do not use a ring as generic decoration or as a
   content spinner.

## 9. Illustration system

One cast drawn in a fine single-weight line, Ink on Paper, remixed from Notionists by Zoish
(CC0 1.0); hearts, rays, the phone frame, the verified badge and route arcs are drawn in-house
[BG §09], [BS §9]. **Illustrations only at launch:** no stock photos anywhere, on the website or
in marketing; a consented shoot is reconsidered after the beta [OD-24].

### 9.1 Which file serves which screen

Files are in `assets/illustrations/`, each as `.svg` (preferred) and `.webp` (fallback). The name
encodes the screens: `<kind>_<subject>__<screens>__<width>x<height>`.

| File (without extension)                                          | Character or scene                  | Screens named in the file              |
| ----------------------------------------------------------------- | ----------------------------------- | -------------------------------------- |
| `avatar_amaka__A1-center-H8-GC3-BL6__512x512`                     | Amaka, the example spec             | A1 (centre), H8, GC3, BL6              |
| `avatar_zara__D1-D5-D6-MF1-MF2-MF3-MF5-P0-C8__512x512`            | Zara, the featured spec             | D1, D5, D6, MF1, MF2, MF3, MF5, P0, C8 |
| `avatar_you-ada__E4-D1-D14-B0-MF4-PM1__512x512`                   | Ada, the signed-in member           | E4, D1, D14, B0, MF4, PM1              |
| `avatar_aisha__A1-D12-GC3-GC5-BL6__512x512`                       | Aisha (groups and invites)          | A1, D12, GC3, GC5, BL6                 |
| `avatar_awa__A1-GC3-BL6__512x512`                                 | Awa (groups and invites)            | A1, GC3, BL6                           |
| `avatar_tunde__A1-D9-D10-D12-H3-H4-GC5__512x512`                  | Tunde (chat and safe-date example)  | A1, D9, D10, D12, H3, H4, GC5          |
| `avatar_kofi__A1-D11-GD0-GD6-GC3__512x512`                        | Kofi (cross-border example)         | A1, D11, GD0, GD6, GC3                 |
| `avatar_femi__GC3-BL6__512x512`                                   | Femi (group member)                 | GC3, BL6                               |
| `profile_you-ada-main__B4-B8-D14-PM1-PM2__1080x1440`              | Ada, main photo frame               | B4, B8, D14, PM1, PM2                  |
| `profile_you-ada-photo2__D14-B8__1080x1440`                       | Ada, second photo                   | D14, B8                                |
| `profile_zara-card__D1-D4-MF4__1080x1440`                         | Zara, full spec card                | D1, D4, MF4                            |
| `hero_A2-meet-your-specs_couple__1020x640` (+ `__dark__`)         | Couple with a heart                 | A2                                     |
| `hero_A4-verified-everywhere_video-call__1020x760` (+ `__dark__`) | Verified video call with route arcs | A4                                     |
| `example_B4-main-photo-two-people-rejected__1080x1440`            | Two people in one photo             | B4 only (in-app rejection example)     |

`GD0` and `P0` appear in file names but are not headings in the UI inventory (GAP-STD04-07).

### 9.2 Rules

1. One cast, one line weight. No fills other than Ink and Paper; no tints, gradients, shadows or
   effects; never recolour [BG §09].
2. **Dark theme:** people do not invert. They stay Ink on Paper on a Paper disc or plate. Use the
   `__dark__` file where one exists (A2, A4); avatars keep their Paper circle [BG §09].
3. Frames under about 120 px use the 512 × 512 `avatar_` file; large or 3:4 frames use the
   1080 × 1440 `profile_` file. Art fills its frame (cover); frames keep their size and mask
   [BG §09].
4. Illustrations stand in for people only in onboarding, examples, placeholders and empty states.
   They never replace a real member's photo in live use [BG §09].
5. On the website an illustration never pretends to be a member: no age, city or "verified" claim,
   and never in stories, proof or testimonial contexts [WEB §3.4].
6. `example_B4…rejected` is never used on the website or in marketing [WEB §3.4],
   `assets/README.md`.
7. Where no person fits, use the Pair symbol. Placeholders never use stock smiles [BG §09].
8. Alt text describes the scene. A2: "Two people who want the same things, smiling at each other".
   A4: "A verified member waving on a video call, connected to people far away". B4: "Two people in
   one photo". Decorative avatars use an empty alt [BG §09]. Alt text is copy, so it comes from the
   i18n catalogue or the CMS like any other string.
9. Screen A3 (the ring) and the logo are not illustrations [BG §09].

### 9.3 Licence obligations

1. Every asset, illustration, photo or sound, has a row in `assets/illustrations/LICENCE_LOG.csv`
   (columns: `file`, `persona_or_slot`, `source`, `source_url`, `creator`, `licence`, `notes`,
   `retrieved`) **before** it ships [BG §09].
2. The cast is CC0 1.0, so no attribution is required; the log is kept anyway [BS §9].
3. Website media also needs its licence record in `media_assets` before it can be published
   [WEB §3.4].
4. A pull request that adds a file under `assets/` without a log row is rejected in review. No
   automated check exists (GAP-STD04-04 covers the sound rows that are missing today).

## 10. Sensory system

Applies to every screen [TR §2.5], [BG §10].

### 10.1 Motion

| Token                        | Value                        | Use                           |
| ---------------------------- | ---------------------------- | ----------------------------- |
| `motion.duration.fast`       | 150 ms                       | Press, toggle, chip, toast in |
| `motion.duration.base`       | 200 ms                       | Card swipe-out, sheet, fade   |
| `motion.duration.slow`       | 250 ms                       | Match reveal, page transition |
| `motion.duration.undo-toast` | 6000 ms                      | Pass Undo toast visible time  |
| `motion.easing.standard`     | `cubic-bezier(0.2, 0, 0, 1)` | Default ease-out              |
| `motion.easing.exit`         | `cubic-bezier(0.4, 0, 1, 1)` | Elements leaving              |

Rules: 150–250 ms ease-out for almost every change; no bounce, no spring overshoot, no parallax.
The only loops are skeletons, loading spinners, the 1-Minute ring and the splash LogoRing fill.
Nothing flashes more than three times a second. The match moment (D5) is the Pair's two figures
stepping together at the 7° lean while the ring draws: no confetti, hearts or fireworks [BG §10].
**Reduced motion is always respected:** movement becomes a 150 ms cross-fade, the ring counts in
10 s steps, the D5 animation shows its final frame, skeletons stop pulsing [TOK] `motion.reduced`.

The website spec lists older durations (120 and 320 ms); the tokens win (GAP-STD20-05 in
[1MM-STD-20](1MM-STD-20-DESIGN-SYSTEM.md)).

### 10.2 Haptics

| Tag           | When                                                                | expo-haptics call                             |
| ------------- | ------------------------------------------------------------------- | --------------------------------------------- |
| `selection`   | Tabs, chips, Undo                                                   | `selectionAsync()`                            |
| `light`       | Pass, Somewhat                                                      | `impactAsync(Light)`                          |
| `medium`      | Like                                                                | `impactAsync(Medium)`                         |
| `success`     | Match (D5), Black Badge approved                                    | `notificationAsync(Success)`                  |
| `double-soft` | 10 s left on the ring (A3, MF2, MF4)                                | two `impactAsync(Soft)`, 120 ms apart [OD-31] |
| `warning`     | Confirm sheet opens for Unmatch, Block, Delete account, Leave group | `notificationAsync(Warning)`                  |
| `error`       | Only when something failed                                          | `notificationAsync(Error)`                    |

Haptics are optional, follow the OS setting and `user_settings.haptics_enabled`, and never carry
meaning on their own [TR §2.5]. In code they go through `useHaptic(kind)` in
`apps/mobile/src/lib/haptics.ts`; no screen calls `expo-haptics` directly.

### 10.3 Sound

Two sounds exist and nothing else: `match-chime` (D5) and `call-start` (MF4, a later release).
Both are free royalty-free library sounds, each under 600 ms, normalised to −18 LUFS, with the
licence logged in `LICENCE_LOG.csv` [OD-25], [OD-31], [TOK] `sound.$description`. Sound is off by
default (`user_settings.sounds_enabled` defaults to false). No sound on likes, passes, foreground
messages or timers; notification sounds follow the phone's own settings [BG §10]. The two files
and their licence rows are not in the repo yet (GAP-STD04-04).

## 11. Iconography

Feather through `@expo/vector-icons` on mobile and Lucide on the web: 24 px grid, 2 px stroke,
round caps and joins. Outline = available, filled = selected or active. Sizes 16, 20, 24 (default), 32. Icon-only buttons keep a 44 × 44 px target and an accessible label in context ("Like Amaka").
One stroke set only. No emoji in UI chrome; emoji are allowed only inside members' own messages and
reactions [BG §08]. Custom brand icons (Pass, Somewhat, Like, Verified, tier badges) are drawn on
the same grid; Somewhat is an outlined heart, half filled [BG §08]. The shared icon package the
guide asks for does not exist yet (GAP-STD20-04).

## 12. Voice and tone

Calm, direct, respectful, a little warm: a confident friend who respects your time. Short
sentences, plain words, a little wit, never crude. Say it once, short [BG §15], [BS §7].

| We are     | We are not    | Do                                                                     | Don't                                 |
| ---------- | ------------- | ---------------------------------------------------------------------- | ------------------------------------- |
| Direct     | Blunt or cold | "No spark? Move on. Someone else is waiting."                          | "This user is not interested in you." |
| Warm       | Gushing       | "You two like each other. Say hello."                                  | "OMG!!! You have a new match!!!"      |
| Witty      | Sleazy        | "One minute. Make it count."                                           | Innuendo of any kind                  |
| Protective | Preachy       | "Never send money to someone you haven't met. We'll never ask you to." | "WARNING: scammers are everywhere."   |
| Clear      | Technical     | "We couldn't see your face clearly. Try somewhere brighter."           | "Liveness check failed (code 4012)."  |

The "Do" lines are from [BG §15] and [BS §7]; the "Don't" lines are illustrations written for this
document.

What the product never says [BS §8]: claims it cannot prove ("guaranteed love"); say "verified",
not "safe", when describing people; invented or rounded-up numbers; explicit or sexual language in
public copy; anything that names and knocks another product.

## 13. Glossary and banned terms

Use these words exactly. One name per thing [BG §15].

| Word                   | Means                                   | Note                                   |
| ---------------------- | --------------------------------------- | -------------------------------------- |
| spec                   | A verified person who matches you       | Lower case in running text             |
| My Specs               | Discovery (D1)                          | First tab                              |
| Like · Somewhat · Pass | The three reactions                     | Somewhat = half a like                 |
| Maybe match            | Like + Somewhat, or Somewhat + Somewhat | MF1                                    |
| 1-Minute Intro         | 60-second voice intro after a match     | CTA is always "Start your minute"      |
| Direct Spec            | A message before matching               | Gold                                   |
| Black Badge            | The one-off verification                | Not a plan; never renews or lapses     |
| Free · Premium · Gold  | The three plans                         | No other plan names                    |
| Spotlight              | Being shown first for a time            | Rotation rule is remote config [OD-18] |
| Groups                 | Member communities with events          | Fifth tab                              |
| Meet-up                | Date plan and safety check-in           | EV1–EV6                                |
| Trusted contacts       | People who get your meet-up details     | They must opt in                       |
| Profile                | The fifth tab's label                   | [CN brand-review]                      |

**Banned terms (enforced).** `scripts/check-banned-terms.mjs` fails CI (`pnpm check:banned-terms`)
when any tracked or untracked non-ignored file contains one of three patterns: the name of the
retired fifth plan, its retired price, or the phrase that calls the Black Badge a subscription.
The patterns are in the script's `BANNED` list; they are deliberately not written out here. The
script skips `docs/`, `packages/db/migrations/`, `packages/db/SCHEMA_DATA_DICTIONARY.md`, itself,
the lockfile and binary images. Documents are still expected to comply.

**Retired UI (not machine-checked, reviewer-checked)** [BG §15]: "compare plans" pages, Rewind on
the reaction bar, the "share your date plan" card, the purple tier colour.

## 14. Copy rules for UI text

1. **No hard-coded copy.** Every string a person reads comes from the i18n catalogue, the CMS or
   the API ([1MM-STD-17](1MM-STD-17-LANGUAGE-CONFIGURATION.md)). These rules govern the wording
   that goes into those sources.
2. Screen titles are 2–6 words. Under a title, one supporting line of about 15 words or fewer
   [BG §15].
3. Buttons say what happens: "Send code", "Get your Black Badge". Not "Submit" or "OK" [BG §15].
4. One primary button per screen; a disabled button explains why nearby ("Tick all three to
   continue"); a loading button keeps its label and adds a spinner [BG §11].
5. Errors say what happened and how to fix it, with no blame. Never "Something went wrong" alone
   [BG §15].
6. Use "you" and "we". Numbers as digits [BG §15].
7. Prices: US dollars, symbol and two decimals ($1.00, $2.50, $9.75), "/mo" or "a month" for
   plans, "one-off" for the Black Badge [BG §15].
8. Daily limits are said plainly: Free shows 25 specs a day, 50 once verified; paid plans read "No
   daily limit" [OD-03], [BG §11]. The numbers come from remote config
   (`discovery.daily_cap.basic`, `discovery.daily_cap.verified_free`).
9. Scarcity numbers are real counts from the API, never invented or rounded up [BG §11].
10. "It's a match." carries a full stop [CN brand-review].
11. Do not describe people by appearance in system text [BG §15].
12. Confirm sheets: a question title, one plain consequence line, the destructive action named
    exactly, and a safe way out ("Unmatch Tunde?" / "Keep the match") [BG §11].
13. The name "1minitman" and the line "Don't waste my time" are never translated [BS §7].
    Pidgin and French strings are written or reviewed by native speakers before release [BG §15].
14. Admin console copy is English only and follows the same voice; confirm dialogs name the person
    and the consequence [ADM §1.10].
15. Gold copy does not lead with cross-border discovery until markets beyond Nigeria open; the
    International tab says "Opening soon" [BS §8], [OD-09]. There is no launch offer [OD-01].

## 15. Accessibility commitments

Target: WCAG 2.2 AA on every screen, AAA where monochrome makes it free. Accessibility is a release
blocker [BG §13].

| Area                | Commitment                                                                                                                            | Source               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Contrast            | Body ≥ 7:1, secondary ≥ 4.5:1, UI graphics (controls, borders, focus, rings) ≥ 3:1                                                    | [BG §13], [TR §2.4]  |
| Colour independence | Tiers, reactions, errors and status all carry shape, icon and text                                                                    | [BG §13]             |
| Targets             | 44 × 44 px minimum, 8 px apart; desktop admin pointer targets ≥ 24 × 24 px                                                            | [BG §13], [ADM §1.9] |
| Text size           | Scales to 200% without loss; no text in images                                                                                        | [BG §13]             |
| Motion              | A reduced-motion alternative for every animation                                                                                      | [BG §13]             |
| Controls            | Real controls only (button, link, radio, checkbox, switch); destructive actions confirm                                               | [TR §2.4]            |
| Screen readers      | Controls labelled in context ("Like Amaka"); photos get alt text ("Photo 2 of 6 of Amaka"); match and timer events announced politely | [BG §13]             |
| Focus               | Visible two-ring focus (2 px `bg` gap + 2 px `fg` ring) in both themes; never hidden behind sticky bars                               | [BG §05], [BG §13]   |
| Gestures            | Every swipe has a button; the 1-Minute Intro can be extended or switched to an untimed first message in accessibility settings        | [BG §13]             |
| Authentication      | Codes can be pasted and auto-filled; no puzzles                                                                                       | [BG §13]             |
| Language            | Content tagged `en`, `pcm` or `fr`                                                                                                    | [BG §13]             |
| Test hooks          | Each screen root carries `data-screen`, `data-route` and `data-testid` (Expo `testID`)                                                | [TR §2.4]            |

## 16. How the code enforces this

| Rule                                   | Where it is enforced today                                                                                                                                                   | Check that does not exist yet                                                                                                     |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Colours come from tokens               | `packages/tokens/dist/tokens.css` resets Tailwind's palette (`--color-*: initial`), so only semantic classes exist on the web; the NativeWind preset replaces `theme.colors` | A lint rule banning raw hex and arbitrary colour values (GAP-STD04-01)                                                            |
| Ink and Paper are unchanged            | `packages/tokens/build.mjs` fails if `theme.light.bg` is not `#FFFFFF` or `theme.dark.bg` is not `#0A0A0A`                                                                   | A contrast test over every text and background pair on a token change (GAP-STD04-06)                                              |
| Radius scale                           | `--radius-*: initial` then the four tokens; preset `borderRadius`                                                                                                            | Lint for arbitrary radius values (GAP-STD04-01)                                                                                   |
| Type scale                             | `packages/ui-native` `Text` variants; preset `fontSize` holds the eight sizes only                                                                                           | Web: no type utilities are generated, so apps write pixel sizes by hand (GAP-STD20-01); lint for pixel font sizes (GAP-STD04-01)  |
| Spacing scale                          | NativeWind preset replaces `theme.spacing`                                                                                                                                   | Web: Tailwind v4's open spacing scale is still on (GAP-STD20-02)                                                                  |
| Manrope only                           | `@fontsource-variable/manrope` in `packages/ui-web` and `apps/site`; `@expo-google-fonts/manrope` in `apps/mobile/src/providers/fonts.ts`                                    | none needed                                                                                                                       |
| Light, dark, system                    | `tokens.css` media query and `data-theme`; `initTheme` / `useTheme` in `packages/ui-web`; `ThemeProvider` in `packages/ui-native`                                            | Visual snapshots of core components in both themes (GAP-STD04-03)                                                                 |
| Focus ring and reduced motion (web)    | Base layer in `packages/ui-web/src/styles.css` and `apps/site/src/styles/global.css`                                                                                         | axe run in CI (GAP-STD04-02)                                                                                                      |
| Text scaling (native)                  | `Text` sets `maxFontSizeMultiplier={2}`                                                                                                                                      | Accessibility lint for React Native and Maestro accessibility checks (GAP-STD04-02)                                               |
| Haptic vocabulary                      | `HapticKind` type from `@1minitman/tokens`; `useHaptic`                                                                                                                      | The hook does not read `user_settings.haptics_enabled` yet (planned with settings in MOD-03)                                      |
| Sound vocabulary                       | `SoundName` type from `@1minitman/tokens`                                                                                                                                    | Sound files, licence rows and a player (GAP-STD04-04)                                                                             |
| Banned terms                           | `scripts/check-banned-terms.mjs`, run by CI                                                                                                                                  | none for the retired UI list in §13 (review only)                                                                                 |
| Colour is never the only signal        | `StatusBadge` in `packages/ui-web` always renders text beside the dot                                                                                                        | Review only                                                                                                                       |
| Buttons 48 px, 4 px radius, monochrome | `Button` in `packages/ui-web` and `packages/ui-native`                                                                                                                       | Review only                                                                                                                       |
| Logo is artwork                        | `BrandMark` components in `apps/admin`, `apps/web`, `apps/site`                                                                                                              | The wordmark beside the mark is typed text in those shells; replace with the lockup artwork when the shells are finished (review) |
| Licence log                            | none                                                                                                                                                                         | Review only (§9.3)                                                                                                                |

## 17. Compliance checklist for any UI pull request

- [ ] No raw hex, `rgb()` or named colour in a component; semantic token classes only.
- [ ] Signal colours appear only for state, with an icon and text; tier colours only on rings and
      tier marks, with the tier name in text.
- [ ] Font sizes are from the eight-size scale; Manrope only; sentence case.
- [ ] Radius is 4 px, or 8 px for a menu or tooltip, 16 px for a sheet top, full for a person or ring.
- [ ] Spacing is on the 4-point grid; tap targets are at least 44 × 44 px.
- [ ] No new shadow, gradient, glow, emoji in chrome, or looping animation.
- [ ] Motion uses the duration and easing tokens and has a reduced-motion path.
- [ ] Haptics use `useHaptic` with a tag from §10.2; no sound other than the two in §10.3.
- [ ] Checked in light and dark; illustrations keep Ink on Paper on a Paper plate in dark.
- [ ] Member photos are untouched: full colour, no filter, text only on a scrim.
- [ ] The logo is the master artwork, with clear space, at or above its minimum size.
- [ ] Every string comes from the catalogue, CMS or API and follows §14: title 2–6 words, one
      supporting line, buttons say what happens, errors say how to fix.
- [ ] Glossary words are used exactly; no banned or retired term; prices show two decimals.
- [ ] Every control is a real control with a label in context; every swipe has a button.
- [ ] Works at 200% text size without clipping.
- [ ] Any new asset has a `LICENCE_LOG.csv` row.
- [ ] Each screen root and interactive element has its `testID` / `data-testid`.

## 18. Gaps raised

Dispositions are recorded in [1MM-LOG-03](../1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md)
(Technical Reference and schema), [1MM-LOG-02](../1MM-LOG-02-UI-UPDATES.md) (UI) and
[1MM-LOG-04](../1MM-LOG-04-OPEN-DECISIONS-AND-FOLLOW-UPS.md) (owner decisions and repository
follow-ups).

| Gap id       | Type | Where found                                                                              | What is missing or conflicting                                                                                                                     | Proposed resolution                                                                                                                                                                                                                                                                       | Blocks                                    |
| ------------ | ---- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| GAP-STD04-01 | REPO | [BG §17] quality gates, [WEB §3.1], [ADM A01] checklist; `eslint.config.mjs`             | The sources require a lint rule that bans raw hex values and pixel font sizes in components. `eslint.config.mjs` has no such rule.                 | Add a rule (for example `no-restricted-syntax` over string literals and class names matching a hex colour or `text-[<n>px]`) for `apps/{admin,web,mobile}` and `packages/ui-*`, with an allow-list for `apps/mobile/app.config.ts` and HTML `theme-color` metas. Depends on GAP-STD20-01. | A01 acceptance; website global acceptance |
| GAP-STD04-02 | REPO | [BG §13] testing, [TR §2.4] tooling; `.github/workflows/ci.yml`                          | No automated accessibility check exists: no axe run for admin, web or site, no accessibility lint for React Native, no Maestro accessibility step. | Add them with the test harness in MOD-00, as [1MM-STD-01](1MM-STD-01-TESTING-STRATEGY.md) specifies.                                                                                                                                                                                      | Release gate for every UI module          |
| GAP-STD04-03 | REPO | [BG §17] quality gates                                                                   | Visual regression snapshots of core components in both themes are required; none exist.                                                            | Snapshot the admin `/_design` gallery in light and dark in CI once A01 is built.                                                                                                                                                                                                          | A01 exit                                  |
| GAP-STD04-04 | REPO | [OD-25], [TOK] `sound.*`; `assets/`, `assets/illustrations/LICENCE_LOG.csv`              | The two sound files (`match-chime`, `call-start`) are not in the repo and the licence log has no sound rows.                                       | Choose two free royalty-free library sounds under 600 ms at −18 LUFS, add them under `assets/sounds/`, add two log rows.                                                                                                                                                                  | D5 (MOD-07), MF4 (MOD-08, later release)  |
| GAP-STD04-05 | REPO | [BG §04]; `apps/mobile/app.config.ts`, `assets/brand/`                                   | No Android monochrome icon layer and no iOS dark or tinted icon variant exist; `app.config.ts` sets no `monochromeImage`.                          | Export the three variants from the master artwork and wire them in `app.config.ts`.                                                                                                                                                                                                       | Store submission (MOD-19)                 |
| GAP-STD04-06 | REPO | [BS §15] ("CI checks: no raw colours, accessibility tests"); `packages/tokens/build.mjs` | The token build checks only the two background values. A token change that breaks a stated contrast ratio would pass.                              | Add a contrast test to the tokens package for the pairs in §3.1 and §4.2 (body 7:1, secondary 4.5:1, graphics 3:1).                                                                                                                                                                       | none                                      |
| GAP-STD04-07 | UI   | Illustration file names against [INV]                                                    | `avatar_kofi…` names screen `GD0` and `avatar_zara…` names `P0`; neither id is a heading in the UI inventory.                                      | Design to confirm the intended boards (or rename the files); until then use the files on the screens the inventory does list.                                                                                                                                                             | none                                      |

## Change log

| Version | Date        | Change                                                                                   |
| ------- | ----------- | ---------------------------------------------------------------------------------------- |
| v1.0    | 24 Nov 2026 | First issue, from Brand Guide v3.1, Brand Strategy v3.2 (§7–§10, §15) and tokens v3.0.0. |
