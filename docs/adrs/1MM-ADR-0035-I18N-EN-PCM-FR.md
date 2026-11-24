# 1MM-ADR-0035 · i18n catalogues in en, pcm and fr; French behind a flag

|                  |                                                                                                                                                                                                     |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                                                                                                                                            |
| **Date decided** | 18 Nov 2026 (catalogues and the French flag); 19 Nov 2026 (DN-11, DN-23, AD-23 under OD-31)                                                                                                         |
| **Decided by**   | Technical Reference §4.5, §5.1 and §17.1; owner decision OD-31                                                                                                                                      |
| **Sources**      | [TR §4.5], [TR §5.1], [TR §6.1], [TR §17.1], [OD-31], [ODT] DN-11, DN-23, AD-23, [SQL] `i18n_strings`, `feature_flags` seed `locale.fr`, `packages/i18n/src/index.ts`, `apps/site/astro.config.mjs` |
| **Affects**      | packages/i18n, packages/db, every app, MOD-02                                                                                                                                                       |

## Context

The launch market is Lagos, with French-speaking markets on the waitlist. The Technical
Reference names three locales, "ICU catalogues en / pcm / fr", and warns that "pcm and fr need
native review before launch" [TR §5.1]. The launch scope is "English and Naijá; French behind
`locale.fr` until native review" [TR §17.1]. The owner's rule is that text a person reads is
managed in the admin console, not hard-coded.

## Decision

1. Three locales: `en` (English), `pcm` (Naijá) and `fr` (French). Messages use ICU format
   [TR §5.1].
2. The source of translated strings is the table `i18n_strings`; `packages/i18n` holds the
   catalogues "exported from i18n_strings" [TR §4.5] and is shared by every app.
3. French is gated by the feature flag `locale.fr`, seeded off ("French UI (needs native
   review)") [SQL]. It is switched on only after native review [TR §17.1].
4. The `pcm` and `fr` catalogues start empty in the repository on purpose: no machine or
   non-native translation is committed (`packages/i18n/src/index.ts`).
5. The app's language suggestion comes from the SIM or store country, never GPS [TR §5.1].
6. Website: English at the root, `/pcm/` and `/fr/` beside it, never an automatic redirect
   (DN-11); core pages are translated and others fall back to English (DN-23) [ODT].
7. The admin console is English only (AD-23) [ODT].

## Alternatives considered

- **Launching all three languages at once:** not chosen; French waits for native review
  [TR §17.1].
- **Locale sub-domains or automatic redirects on the website:** DN-11 took the recommended
  default of path prefixes without redirects [ODT].
- **A translated admin console:** AD-23 decided English only [ODT].
- **A translation-management vendor:** the sources record no such option. **Analysis:** it adds
  a fixed cost against OD-06; the `i18n.manage` permission and the content workflow's
  native-review gate already exist in the schema [SQL], [TR changelog v3.1].

## Consequences

- Easier: copy changes without a release; one catalogue for every interface; an unreviewed
  language cannot reach members.
- Harder: every string needs a key and an English source before a screen can ship; a missing
  translation must fall back to English predictably; the export from `i18n_strings` to the
  packaged catalogues is a pipeline that must be built and kept in step.
- Cost: native reviewers for pcm and fr.

## How it is applied

- `packages/i18n/src/` (`LOCALES = ['en', 'pcm', 'fr']`, `locales/*.json`); site locales in
  `apps/site/astro.config.mjs`; the seeded site setting `locales` [SQL].
- The i18n API, the translations pages and the catalogue export are built in
  [MOD-02](../execution/1MM-EXE-MOD-02-PLATFORM-CONFIG-AND-CATALOGUES.md) (ruling R11, [master plan](../execution/1MM-EXE-00-MASTER-PLAN.md) section 7).
- Rules: [1MM-STD-17 Language configuration](../standards/1MM-STD-17-LANGUAGE-CONFIGURATION.md).
- Checks: review rejects a literal user-facing string in a screen; a test that with `locale.fr`
  off no client offers French; a test for English fallback on a missing key.

## Revisit when

Native review of French is complete (the flag is switched on, no new ADR needed), or a new
market needs a fourth locale.
