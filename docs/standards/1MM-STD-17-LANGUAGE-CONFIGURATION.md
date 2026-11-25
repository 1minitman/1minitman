# 1MM-STD-17 · Language configuration for every UI

|              |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Document** | 1MM-STD-17                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Status**   | Approved baseline · v1.0 · 24 Nov 2026                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Audience** | Engineers and coding agents                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Owner**    | Engineering lead (code owners)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Sources**  | [TR §2.4], [TR §4.6], [TR §5.1], [TR §6.2], [TR §8.2], [TR §11], [TR §17.1], [SQL], [BG §06], [BG §13], [BG §15], [ADM A25], [ADM A31], [WEB §3.8], [WEB W04], [WEB §6.6], [WEB §6.7], [UF §15.17], [INV OB2], [CN onboarding-edge-rules], [CN notif-rules], [DDR B26]; repo: `packages/i18n`, `apps/site`, `apps/mobile`                                                                                                                                                                                                                                |
| **Related**  | [MOD-02](../execution/1MM-EXE-MOD-02-PLATFORM-CONFIG-AND-CATALOGUES.md) (owns the i18n API, translations pages, OB2, W04) · [MOD-11](../execution/1MM-EXE-MOD-11-NOTIFICATIONS-AND-COMMUNICATIONS.md) · [MOD-15](../execution/1MM-EXE-MOD-15-CMS-AND-PUBLIC-WEBSITE.md) · [1MM-STD-03](1MM-STD-03-MOBILE-BUILD-STRATEGY.md) · [1MM-STD-13](1MM-STD-13-ERROR-CODES.md) · [1MM-STD-14](1MM-STD-14-CODING-CONVENTIONS.md) · [1MM-STD-18](1MM-STD-18-NOTIFICATIONS.md) · [1MM-STD-19](1MM-STD-19-OTA-UPDATES.md) · [1MM-STD-20](1MM-STD-20-DESIGN-SYSTEM.md) |

**What this document is for and when to open it.** Every implementation starts with its
language configuration: the keys exist, in English, before any UI code that shows them is written.
This document says where strings live, how they are named, written, formatted, loaded by each app,
reviewed and tested. Open it before you add a screen, a label, an error, a notification, an option
list or a locale. [MOD-02](../execution/1MM-EXE-MOD-02-PLATFORM-CONFIG-AND-CATALOGUES.md) plans the
build of the i18n API and the admin pages; this is the rule every other task follows.

## 1. The rule

1. **No literal copy in code.** Anything a person reads (labels, buttons, messages, errors, empty
   states, accessibility labels, notification text, e-mail text, option labels) is a key in the
   catalogue. This includes the admin console's own text (owner rule 4).
2. **Language first.** A task that adds visible text begins by adding its keys in `en`
   (section 12). A pull request with a UI change and no catalogue change is questioned in review.
3. **One source.** `i18n_strings` is the source of truth; `packages/i18n` is its export and the
   bundled floor [SQL `i18n_strings` comment].
4. **English is complete; other locales fall back to English** key by key, never to a blank or to
   the key name [ADM A25].
5. **Naijá and French are written or reviewed by native speakers** before members see them
   [BG §15], [TR §5.1].

## 2. Locales

| Code  | Language                | Shown as (`languages.native_name`) | Status at launch                           | Switch                                          |
| ----- | ----------------------- | ---------------------------------- | ------------------------------------------ | ----------------------------------------------- |
| `en`  | English                 | English                            | Default and fallback; always on            | –                                               |
| `pcm` | Nigerian Pidgin (Naijá) | Naijá                              | On; needs native review before launch      | Flag `locale.pcm` (seeded on) [SQL]             |
| `fr`  | French                  | Français                           | Off in the app until native review is done | Flag `locale.fr` (seeded off) [SQL], [TR §17.1] |

- The set is closed by the database domain `app_locale` (`en`, `pcm`, `fr`) [SQL]. `LOCALES` and
  `DEFAULT_LOCALE` in `packages/i18n/src/index.ts` mirror it.
- App locales offered in OB2 = `languages.is_app_locale` and active, filtered by the flag
  `locale.<code>`; `en` is always offered [MOD-02 §3.2].
- Website locales are `site_settings.locales` and may differ from the app: the website launches its
  core pages in French while the app flag is off [WEB §3.8]. The owner's confirmation of this
  split is GAP-MOD02-06.
- The admin console is English only; its strings still live in the catalogue under the `admin.`
  prefix (GAP-MOD02-10).
- Language tags for HTML and screen readers: `en`, `pcm`, `fr` (`HTML_LANG` in
  `apps/site/src/lib/i18n.ts`).

## 3. The single source of strings

### 3.1 `i18n_strings`

| Column                                     | Meaning                                                   | Rule                                                                                              |
| ------------------------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `key`                                      | Stable identifier, `^[a-zA-Z0-9_.-]{2,160}$`              | Section 4                                                                                         |
| `locale`                                   | `app_locale`                                              | Primary key is (`key`, `locale`)                                                                  |
| `value`                                    | The message                                               | ICU MessageFormat when `is_icu`                                                                   |
| `description`                              | Context for the translator                                | Required by this standard for every new key (section 12)                                          |
| `is_icu`                                   | Default true                                              | False only for values that must not be parsed (for example a legal entity line containing braces) |
| `status`                                   | `draft` → `machine` (optional) → `reviewed` → `published` | Only `reviewed` and `published` rows are exported [ADM A25]                                       |
| `reviewed_by`, `reviewed_at`, `updated_by` | Who                                                       | CHECK `i18n_review_not_editor`: the reviewer is never the last editor [DDR B26]                   |
| `max_length`                               | Character limit hint                                      | A longer value is refused on save [MOD-02 §4.3]; used for lock-screen text and tight layouts      |

Other tables hold **keys**, not text: `notification_templates.title_key` / `body_key`,
`notification_categories.label_key`, `languages.name_key`, `countries.name_key`,
`app_versions.release_notes_key`, `maintenance_windows.message_key`,
`in_app_announcements.title_key` / `body_key`, and every catalogue `label_key` [SQL].

No `i18n_strings` row is seeded today, although seeds reference many keys (GAP-MOD02-03).

### 3.2 `packages/i18n`

| Item today                                           | State                                                                                                           |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `src/locales/en.json`                                | 12 keys (brand, common, tabs, status); four have camelCase segments that section 4 retires                      |
| `src/locales/pcm.json`, `fr.json`                    | Empty on purpose: every key falls back to English until reviewed                                                |
| `translate(locale, key)`, `createTranslator(locale)` | Return the message or the English one; `MessageKey` is typed from `en.json`, so an unknown key fails type-check |
| `isLocale(value)`                                    | Guards untrusted input                                                                                          |
| ICU formatting, parameters, plurals                  | Not implemented: `translate` returns the raw string (GAP-STD17-01)                                              |

Target state [MOD-02 §4.4]: the loader keeps its API; the locale files become **generated**
by the publish export from `i18n_strings` and are never hand-edited after that; an ICU formatter
is added.

### 3.3 Other localised content (not `i18n_strings`)

| Content                                                    | Where                                                                               | Owner                         |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------- |
| Website page content                                       | CMS, localised per field, gate `localisation.reviewed`                              | MOD-15 [WEB §6.6], [WEB §6.7] |
| Legal documents                                            | `legal_documents` per `locale` and version, read with `GET /v1/legal/{kind}?locale` | MOD-16 [SQL], [TR §8.2]       |
| Help centre articles                                       | Help tables per locale                                                              | MOD-14                        |
| Member-written text (bios, prompts, messages, group names) | Stored as written; never translated by the product                                  | –                             |

## 4. Key naming

| Rule                                                                                                                                                     | Example                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Dot-separated, from general to specific: `<area>.<element>[.<part>]`                                                                                     | `tabs.specs`, `common.retry`                                                                      |
| Segments are lower case; a multi-word segment is lower snake_case, the pattern of the schema seeds ([ADR-0079](../adrs/1MM-ADR-0079-I18N-KEY-NAMING.md)) | `product.black_badge`, `common.get_the_app`, `status.api_offline`                                 |
| Screen copy uses the screen id in lower case as the area                                                                                                 | `d5.title`, `nt1.quiet_hours.label`, `ob2.suggested`                                              |
| Shared wording lives under `common.` and is reused, not copied                                                                                           | `common.retry`                                                                                    |
| Notification templates                                                                                                                                   | `n01.title`, `n01.body`, `w03.body` [SQL]                                                         |
| Notification categories                                                                                                                                  | `ncat.likes` [SQL]                                                                                |
| Errors                                                                                                                                                   | `error.<reason>` and field errors per [1MM-STD-13 §5.2](1MM-STD-13-ERROR-CODES.md)                |
| Catalogue and reference labels                                                                                                                           | The seeded key stands as is (`lang.en`, `country.ng`, each `label_key`) [SQL]                     |
| Admin console                                                                                                                                            | `admin.<module>.<element>` (GAP-MOD02-10)                                                         |
| Website chrome                                                                                                                                           | `site.<module>.<element>`. **Recommendation**                                                     |
| Accessibility labels                                                                                                                                     | Same area as the element, suffix `.a11y` (`d1.like.a11y` = "Like {nickname}"). **Recommendation** |
| Brand                                                                                                                                                    | `brand.name`, `brand.slogan`: present so code has one place to read them; never translated        |

Further rules:

1. A key names **meaning and place**, never the English words (`d1.empty.title`, not
   `no_more_specs`).
2. A key is never reused for a different meaning. Change of meaning = new key; the old key is
   removed when no supported client uses it ([1MM-STD-19 §9](1MM-STD-19-OTA-UPDATES.md)).
3. One key per whole sentence. Never join keys or fragments to build a sentence; word order
   differs between languages.
4. Keys are never built at runtime from free text. Building from a closed set is allowed
   (`error.${reason}`, `ncat.${key}`) when a test proves every member of the set has a key.
5. Lengths: 2 to 160 characters. The table CHECK allows `a-z A-Z 0-9 _ . -`; new keys use lower
   case, digits, underscores and dots only.
6. The scaffold catalogue still holds camelCase segments (`common.getTheApp`,
   `common.skipToContent`, `status.apiOnline`, `status.apiOffline`). Rewriting the scaffold's
   twelve keys to this rule is a repository follow-up recorded with ADR-0079; until it lands, code
   uses the keys as they are in `en.json`.

## 5. Writing messages

### 5.1 ICU MessageFormat

| Need                                | Form                                                                             |
| ----------------------------------- | -------------------------------------------------------------------------------- |
| Variable                            | `Like {nickname}`                                                                |
| Plural                              | `{count, plural, one {# new like} other {# new likes}}`                          |
| Choice                              | `{plan, select, premium {Premium} gold {Gold} other {Free}}`                     |
| Number, date, time inside a message | `{price, number, ::currency/USD}`, `{when, date, medium}`, `{when, time, short}` |
| Literal brace or apostrophe         | ICU quoting (`'{'`), and the typographic apostrophe (’) in prose                 |

- Arguments are **named**, never positional, and described in `description`.
- The ICU syntax is validated on save in A25 (an error blocks the save, with line and column) and
  in CI for the bundled files [ADM A25].
- Arguments are inserted as text. A value never contains HTML or Markdown that the client would
  render; emphasis and links are built by the component from separate keys.
- User-supplied values (nicknames, group names) are passed as arguments, never concatenated, and
  are displayed as plain text.

### 5.2 Plurals

1. Every count uses `plural`; never "like(s)", never an `if (n === 1)` in code.
2. Each locale supplies the categories **its own** rule needs. English and French need `one` and
   `other` (French treats 0 and 1 as `one`). Naijá has its own rule in the Unicode CLDR data: the
   reviewer confirms the forms, and the tests in section 15 run 0, 1, 2 and a large number in
   every locale.
3. `=0` is used when zero deserves its own sentence ("No new likes").
4. The A25 preview shows all plural forms [ADM A25].

### 5.3 Gender-neutral wording

- The app does not know, and must not guess, a person's gender from their profile for the purpose
  of grammar. Messages are written so that no gendered form is needed: use the nickname ("Zara
  likes you"), "they", or a neutral noun.
- French: prefer constructions that avoid agreement ("Zara vous a envoyé un like", not an
  adjective that agrees with the subject). Where grammar forces a choice and a gender value is
  truly available as data the member gave for that purpose, use `select` with an `other` branch
  that is neutral. `other` is mandatory.
- Naijá and French reviewers check neutrality as part of review [BG §15].

### 5.4 Voice

Sentence case everywhere, including buttons; caps only for short labels [BG §06]. Screen titles 2
to 6 words; one supporting line of about 15 words. Buttons say what happens ("Send code"). Errors
say what happened and how to fix it. Numbers as digits. One name per thing, from the glossary
[BG §15]. No emoji in UI chrome [TR §2.4].

## 6. Numbers, dates, currency and time zones

Formatting is done by `Intl` (or the ICU formatter) with the active locale; never by string
building.

| Kind                             | Rule                                                                                                                                                                                                                                                                                                                  | Source                            |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Formatting locale                | `en` → `en-NG`; `fr` → `fr`; `pcm` → `en-NG` for numbers and dates, because device ICU data for `pcm` is not dependable. **Recommendation**; one map in `packages/i18n`                                                                                                                                               | **Recommendation** (GAP-STD17-04) |
| Numbers                          | Digits, grouped by locale. Timers, prices, counts and codes use tabular figures                                                                                                                                                                                                                                       | [BG §06], [BG §15]                |
| Currency                         | Prices are USD list prices; the product shows US dollars with the symbol and two decimals (`$1.00`, `$2.50`, `$9.75`), "/mo" or "a month" for plans, "one-off" for the Black Badge. Stores show their own local currency on the purchase sheet; the app never converts. Amounts come from the API as integer US cents | [BG §15], [TR §4.6]               |
| Currency in French               | The brand format above and the French locale format differ: GAP-STD17-02. Until decided, the brand format is used in every locale                                                                                                                                                                                     | –                                 |
| Dates                            | Locale medium form with the month as a word ("24 Nov 2026"), never all-numeric (day and month order differs between readers)                                                                                                                                                                                          | **Recommendation**                |
| Times                            | Device 12 / 24-hour preference; shown in the viewer's time zone                                                                                                                                                                                                                                                       | **Recommendation**                |
| Relative time                    | `Intl.RelativeTimeFormat` or catalogue keys with plurals ("Active 5 min ago")                                                                                                                                                                                                                                         | [BG §06] example                  |
| Time zone                        | The member's zone is `profiles.timezone` (default `Africa/Lagos`); server-side rules (quiet hours, the 18:00 daily reset, "per local day" quotas) use it. Clients display instants in the device zone; the API sends instants as ISO 8601 UTC                                                                         | [SQL], [TR §11]                   |
| Meet-up times                    | Shown with the zone name when the two members' zones differ                                                                                                                                                                                                                                                           | **Recommendation**                |
| Distances                        | Kilometres ("3 km away")                                                                                                                                                                                                                                                                                              | [BG §06] example                  |
| Phone numbers                    | Stored E.164; shown with the dial code from `countries.dial_code`; country shown as a monochrome ISO code, not a flag                                                                                                                                                                                                 | [SQL], [CN]                       |
| Names of countries and languages | From `countries.name_key` and `languages.native_name`; each language is listed in its own language                                                                                                                                                                                                                    | [SQL], [WEB W04]                  |
| Sorting                          | `Intl.Collator` with the active locale for lists the client sorts                                                                                                                                                                                                                                                     | **Recommendation**                |

## 7. How each app loads its locale

| App                          | Source of strings                                                                                                          | Locale comes from                                                                                         | Mechanism                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/mobile`                | Bundled `packages/i18n` (the floor); newer catalogues arrive by EAS Update; a runtime overlay from the API is GAP-MOD02-04 | Section 8.1                                                                                               | One provider at the root resolves the locale before navigation mounts and exposes `useTranslator()`; `GET /v1/config` supplies the offered locales [MOD-02 §7]. Today the tab labels call `translate('en', …)` directly (`(tabs)/_layout.tsx`): GAP-STD17-01                                                                                              |
| `apps/site` (Astro, static)  | `packages/i18n` for chrome, one file per locale; CMS content per field                                                     | The URL                                                                                                   | Astro i18n routing: English at the root, `/pcm/…` and `/fr/…` beside it (`prefixDefaultLocale: false`, `redirectToDefaultLocale: false`); `[locale]` pages are generated from `LOCALES`; `<html lang>` and `hreflang` alternates (plus `x-default`) are set in `BaseLayout.astro`; components take `locale` as a prop and call `createTranslator(locale)` |
| `apps/web` (billing web app) | `packages/i18n`, same loader [MOD-02 §6]                                                                                   | Section 8.3                                                                                               | A provider at the root; the build includes all three catalogues                                                                                                                                                                                                                                                                                           |
| `apps/admin`                 | `packages/i18n`, keys under `admin.`                                                                                       | Always `en`                                                                                               | A provider with a fixed locale, so the console still has no literals (GAP-MOD02-10)                                                                                                                                                                                                                                                                       |
| `apps/api`                   | Does not send prose. Errors carry a machine `reason`; clients resolve `error.<reason>`                                     | –                                                                                                         | [1MM-STD-13 §5.2](1MM-STD-13-ERROR-CODES.md)                                                                                                                                                                                                                                                                                                              |
| `apps/worker`                | The published catalogue, for text rendered on the server: push, e-mail, SMS                                                | `notifications.locale`, from `users.locale` for members and from the form's `locale` for website contacts | [MOD-11 §4.3 rule 14]                                                                                                                                                                                                                                                                                                                                     |

Rules common to every client:

1. The locale is resolved **once**, at the root, and passed down by context or prop. No component
   reads the device language itself.
2. Changing the locale re-renders at once; no restart.
3. The document or screen language is declared: `<html lang>` on the web; on mobile,
   text in a language other than the active one is tagged for the screen reader (for example the
   native names in OB2) [BG §13], [WEB W04].
4. Catalogues are loaded per locale. The website ships only the page's locale; the mobile bundle
   contains all three (they are small); the web app may load the non-default ones on demand.

## 8. Locale negotiation and persistence

### 8.1 Mobile (OB2)

| Step                                                   | Rule                                                                                                              | Source                                                        |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| First launch                                           | Suggest a language from the **SIM or store country**, never GPS: country → `countries.default_locale`             | [TR §5.1], [CN onboarding-edge-rules]                         |
| If the suggestion is not offered (flag off) or unknown | `en`                                                                                                              | [MOD-02 §9]                                                   |
| Choice                                                 | OB2 sheet opened from the "EN" chip on A1–A5 and from settings (D17); radio list in each language's own name      | [UF §15.17], [INV OB2]                                        |
| Before sign-up                                         | Saved on the device                                                                                               | [CN onboarding-edge-rules]                                    |
| After sign-in                                          | Written to `users.locale` (`PUT /v1/me/settings`, MOD-03); the hint is kept in `users.signup_country_hint`        | [SQL], [MOD-02 §3.2]                                          |
| Signing in on a new device                             | The server's `users.locale` wins over the device default                                                          | **Recommendation**                                            |
| Flag turned off while a member uses that locale        | The app falls back to `en`; `users.locale` is left as it is, so the choice returns if the flag is turned on again | [MOD-02 §9]; keeping the stored value is a **Recommendation** |

The device's system language is not used: the sources name the SIM or store country as the only
signal.

### 8.2 Website (W04)

| Step         | Rule                                                                                                                                                         | Source     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| Locale       | The URL decides. **Never an automatic redirect**                                                                                                             | [WEB §3.8] |
| First visit  | If `Accept-Language` prefers `pcm` or `fr` and the visitor is on an English URL, show a dismissible suggestion bar in that language                          | [WEB §3.8] |
| Switcher     | A disclosure button with the current language's native name; links with `hreflang` and `lang`, not a `<select>`; keeps the equivalent page and scroll anchor | [WEB W04]  |
| Missing page | The link goes to the English page and says so with an "(English)" suffix                                                                                     | [WEB W04]  |
| Persistence  | Cookie `mm_locale`, strictly necessary, 12 months                                                                                                            | [WEB §3.8] |
| Country      | From the CDN country header, only to order the city strip, choose emergency numbers and preselect the waitlist country; never to choose the language         | [WEB §3.8] |

### 8.3 Billing web app and admin

- Web app: signed-in members use `users.locale`; before sign-in, the `mm_locale` cookie when the
  member arrives from the website, otherwise `en`. **Recommendation** (the sources do not say).
- Admin: `en` only.

### 8.4 Server-rendered text

The worker renders in the row's locale. A member's locale change applies to messages written after
it. Website contacts carry the locale they submitted (for example `newsletter_subscribers.locale`)
[SQL].

## 9. Fallbacks

| Situation                                           | Result                                                                                                                                                                                                                                       |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Key missing in `pcm` or `fr`, or not yet `reviewed` | The English value. A25 marks the locale as missing [ADM A25]                                                                                                                                                                                 |
| Key missing in `en`                                 | A defect. Type-check fails for bundled keys (`MessageKey`); for runtime keys (closed sets), the client shows `common.`-level generic wording for that kind of element, reports the key once, and never shows the raw key. **Recommendation** |
| ICU error at runtime                                | Show the English value; report once                                                                                                                                                                                                          |
| Unknown locale value from storage, cookie or URL    | `isLocale()` fails → `en`                                                                                                                                                                                                                    |
| Whole catalogue unavailable (overlay fetch failed)  | The bundled catalogue                                                                                                                                                                                                                        |
| Website page not published in the locale            | English page, marked [WEB W04]                                                                                                                                                                                                               |

Fallback is per key, so a half-translated screen mixes languages. That is accepted during review
periods and is the reason a locale stays behind its flag until its launch set is complete.

## 10. Layout: expansion, truncation, direction

### 10.1 Text expansion

1. Design for text **at least 35% longer** than English, and for short labels (under 10
   characters) up to twice as long. **Recommendation.** French and Naijá both run longer than
   English in the brand guide's own examples [BG §15].
2. No fixed widths on text containers. Buttons grow in height and wrap to two lines before they
   truncate; a row of two buttons stacks.
3. This combines with text size at 200% [TR §2.4]: test the longest locale at the largest size.
4. Tab bar labels, chips and badges have no room: their keys carry a `max_length`, and translators
   are held to it.

### 10.2 Truncation

| Text                                                           | Rule                                                                                                         |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Buttons, titles, error messages, legal and safety text, prices | Never truncated                                                                                              |
| Member-written text in lists (bio previews, last message)      | May truncate with an ellipsis; the full text is one tap away and is what the screen reader reads             |
| Names (nicknames, group names)                                 | One line with an ellipsis in dense rows; full on the detail screen                                           |
| Notification titles and bodies                                 | Kept within `max_length` instead of relying on the OS to cut ([1MM-STD-18 §10](1MM-STD-18-NOTIFICATIONS.md)) |
| Table cells in the admin                                       | May truncate with the full value in a tooltip and on the detail page                                         |

Never truncate in code by character count; use the platform's line clamp so that scripts and
accents are not cut mid-character.

### 10.3 Right-to-left readiness

No launch locale is right-to-left, but layouts are to be ready for one [BG §13]:

- Use logical properties: `start` / `end`, not `left` / `right` (`ps-4`, `me-2`, `text-start`;
  `marginStart`, `paddingEnd` in styles).
- Rows rely on flex direction, not absolute positions; no `left:` offsets.
- Icons that imply direction (back, forward, chevrons) are mirrored through one helper, not per
  screen. Icons that do not (clock, heart) are not mirrored.
- Never concatenate punctuation around variables in code.
- Numbers, the countdown ring's direction and media controls do not flip.

### 10.4 Type

Manrope covers English, Naijá and French accents [BG §06]. A new locale whose script Manrope does
not cover needs a font decision before it is added (section 13).

## 11. What is never translated

| Item                                                                                                 | Rule                                                                                                       | Source                                         |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| The name "1minitman"                                                                                 | Never translated or transliterated                                                                         | [BG §15], [WEB §3.8]                           |
| The slogan "Don't waste my time."                                                                    | Never translated                                                                                           | [BG §15], [WEB §3.8]                           |
| Plan and product names: Free, Premium, Gold, Black Badge                                             | Kept as product names in every locale. **Recommendation**, pending native review of each locale's glossary | [BG §15] glossary rule                         |
| Member-written content                                                                               | Shown as written                                                                                           | –                                              |
| Nicknames, group names, venue names                                                                  | Shown as stored                                                                                            | –                                              |
| The registered entity name and address in e-mail footers and receipts                                | As registered                                                                                              | [CN notif-rules]                               |
| Legal document versions                                                                              | A translation is its own `legal_documents` row; the wording is the lawyer's, not a string in the catalogue | [SQL]                                          |
| Codes and identifiers: screen ids, template codes, error `reason`, ISO country codes, currency codes | Never shown translated; most are never shown at all                                                        | –                                              |
| Analytics event names, log messages, audit action names                                              | English, not in the catalogue                                                                              | [1MM-STD-14](1MM-STD-14-CODING-CONVENTIONS.md) |
| The emergency number                                                                                 | From `countries.emergency_number`                                                                          | [SQL]                                          |

## 12. How to add a string (before any UI code)

1. **Check it is not already there.** Search the catalogue for the wording and for a `common.` key.
2. **Check it is a string at all.** A limit, an option list or a price is data from config, a
   catalogue or the API; only the sentence around it is a string, with the value as an argument.
3. **Name the key** by section 4.
4. **Write the English message** by section 5, with named arguments and plurals.
5. **Write the description**: where it appears, what each argument is, any length limit, and the
   screen id. Set `max_length` when the space is tight.
6. **Add it to the catalogue.**
   - Today, and for anything a build needs at compile time: add the key to
     `packages/i18n/src/locales/en.json` in the same pull request (leave `pcm.json` and `fr.json`
     alone: they fall back).
   - Once MOD-02's i18n API exists: add the `en` row to `i18n_strings` by a forward migration (so
     every environment gets it), then publish; the export regenerates the locale files
     [MOD-02 §4.2]. After that point the JSON files are generated and are not hand-edited.
7. **Run `pnpm typecheck`**: the new key is now a valid `MessageKey`.
8. **Only now write the UI**, using the translator. Pass arguments; do not format numbers or dates
   by hand.
9. **Request translation.** The key appears in A25 as missing for `pcm` and `fr`; section 14.
10. **Test** in `en`, in the pseudo-locale and at 200% text (section 15).

Changing wording: edit the value, keep the key, unless the meaning changes. Removing a string:
remove its last use first, then the key, respecting clients still in use
([1MM-STD-19 §9](1MM-STD-19-OTA-UPDATES.md)).

A pull request that adds a server-rendered template (`n37.title`) adds the keys in the same
migration as the template row ([1MM-STD-18 §11.1](1MM-STD-18-NOTIFICATIONS.md)).

## 13. How to add a locale

Adding a locale is an owner decision and a schema change, not a configuration switch.

1. Owner decision recorded (market, launch set, reviewer).
2. Font check: does Manrope cover the script [BG §06]? If not, a brand decision first. If the
   language is right-to-left, the readiness rules in 10.3 become a tested requirement.
3. Forward migration: extend the `app_locale` domain's CHECK; add or update the `languages` row
   (`is_app_locale`, `native_name`); set `countries.default_locale` where it applies; seed the
   feature flag `locale.<code>` **off** [SQL].
4. `packages/i18n`: add the code to `LOCALES`, the locale file, the formatting-locale map
   (section 6) and the plural test cases. `apps/site`: add it to `astro.config` `i18n.locales` and
   `HTML_LANG`; add the `site_settings.locales` entry (not enabled).
5. Contracts: the locale enum in `packages/contracts` regenerates (`pnpm contracts:generate`).
6. Translate the launch set; native review to `reviewed`; publish (section 14).
7. Legal documents, help articles, notification wording and CMS core pages exist in the locale, or
   the fallback to English is accepted in writing for each.
8. Run the locale test pass (section 15) on every app.
9. Turn the flag on in A31 (approval in production) and enable the website entry in A28.

Removing a locale is the reverse, with `users.locale` values migrated to `en` first.

## 14. Translation workflow and native review

| Step                 | Who                                                              | Where                                 | Rule                                                                                                                                                                   |
| -------------------- | ---------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. English written   | The engineer or content author of the feature                    | Pull request (section 12)             | Reviewed by a code owner for voice [BG §15]                                                                                                                            |
| 2. Draft translation | A translator; a machine draft is allowed and is marked `machine` | A25 `/comms/translations/:key`        | Permission `i18n.manage` with a reason; ICU validated on save; `max_length` enforced; saving sets `updated_by` and returns the row to `draft` [ADM A25], [MOD-02 §4.1] |
| 3. Native review     | A native speaker who is **not** the last editor                  | A25, `POST /i18n/:key/:locale/review` | Sets `reviewed`; enforced by the API and by `i18n_review_not_editor` [DDR B26]                                                                                         |
| 4. Publish           | A holder of `i18n.manage`                                        | A25 "Publish", `POST /i18n/publish`   | Exports the reviewed set to `packages/i18n` and to the notification service; audit `i18n.publish` [ADM A25]                                                            |
| 5. Reach clients     | –                                                                | –                                     | Website: rebuild. Mobile: next build or EAS Update; runtime overlay when GAP-MOD02-04 is decided. Worker: at once                                                      |

Rules:

1. A `machine` row is never shown to members.
2. Reviewers get context: the `description`, the screen, and the A25 preview (all plural forms,
   sample arguments) [ADM A25].
3. A change to an English value puts its translations back to review. **Recommendation:** A25
   lists them as stale until re-reviewed; until then the old translation stays live.
4. Review covers meaning, tone, neutrality (5.3), length and the glossary.
5. A locale's launch set must be 100% `reviewed` before its flag is turned on; MOD-11 and MOD-02
   carry this in their exit gates.
6. Website CMS content follows its own review gate (`localisation.reviewed`) [WEB §6.7].

## 15. Pseudo-localisation and tests

### 15.1 Pseudo-locale

A development-only pseudo-locale is generated from `en` at build time: accented look-alike letters,
each message padded by about 40% and wrapped in brackets, ICU arguments and plural structure left
intact (for example `[Ţŕý åĝåîñ ~~~]`). **Recommendation.**

- It shows at a glance any text that is hard-coded (it stays plain), truncated (the closing bracket
  is missing) or concatenated (brackets in the middle of a sentence).
- It is **not** a value of `app_locale`, is never stored in `users.locale`, never sent to the API
  and never included in a production build. It is selected by a development switch only.

### 15.2 Automated checks

| Check            | Where                                                                                                                        | Fails when                                                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Key exists       | `pnpm typecheck`                                                                                                             | Code uses a key not in `en.json`                                                                                                    |
| ICU syntax       | Unit test over every bundled message in every locale                                                                         | A message does not parse                                                                                                            |
| Argument parity  | Unit test                                                                                                                    | A translation uses an argument the English message lacks, or drops one                                                              |
| Plural coverage  | Unit test                                                                                                                    | A plural lacks `other`, or a category the locale needs                                                                              |
| Length           | Unit test                                                                                                                    | A value exceeds its `max_length`                                                                                                    |
| Closed sets      | Unit test                                                                                                                    | An error `reason`, notification template, category or catalogue `label_key` has no `en` key [1MM-STD-13](1MM-STD-13-ERROR-CODES.md) |
| No literals      | Lint rule on JSX text and on `accessibilityLabel` / `aria-label` / `title` / `placeholder` props in the apps and UI packages | A string literal is rendered. **Recommendation** (GAP-STD17-01)                                                                     |
| Unused keys      | Report in CI (warning)                                                                                                       | A key has no use for two releases                                                                                                   |
| Never translated | Unit test                                                                                                                    | `brand.name` or `brand.slogan` differs between locales                                                                              |
| Export integrity | Worker test                                                                                                                  | A partial export replaces a good catalogue [MOD-02 §9]                                                                              |

### 15.3 Per-task manual pass

For every task with visible text: the screen in `en`, in the pseudo-locale and in `pcm` (and `fr`
when its flag is on in the environment); at 200% text; on the smallest device class
([1MM-STD-03 §12](1MM-STD-03-MOBILE-BUILD-STRATEGY.md)); with a screen reader announcing the right
language; counts at 0, 1, 2 and many; a long nickname; a price; a date across midnight in another
time zone.

### 15.4 End-to-end

- Mobile (Maestro): OB2 changes the language, it persists across restart and across sign-in
  [MOD-02 §8]; a flag turned off falls back to `en`.
- Website (Playwright): W04 keeps the page, `hreflang` matches the switcher, no automatic redirect,
  the `mm_locale` cookie persists [WEB W04].
- Admin: an edit → review by a second person → publish reaches a client; the last editor cannot
  review [ADM A25].

## 16. Gaps raised

Dispositions are recorded in [1MM-LOG-03](../1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md)
(Technical Reference and schema), [1MM-LOG-02](../1MM-LOG-02-UI-UPDATES.md) (UI) and
[1MM-LOG-04](../1MM-LOG-04-OPEN-DECISIONS-AND-FOLLOW-UPS.md) (owner decisions and repository
follow-ups).

Gaps already raised by MOD-02 (GAP-MOD02-03 seed, -04 runtime delivery, -05 `site_settings.locales`
shape, -06 locale switches, -10 admin strings) are referenced above and not repeated.

| Gap id       | Type     | Where found                                                                                                            | What is missing or conflicting                                                                                                                                                                                                                                                           | Proposed resolution                                                                                                                                                                                                                                                                                | Blocks                             |
| ------------ | -------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| GAP-STD17-01 | REPO     | `packages/i18n/src/index.ts`; `apps/mobile/src/app/(tabs)/_layout.tsx`; `apps/admin`, `apps/web`; ESLint configuration | `translate()` takes no arguments and does no ICU formatting, although every source requires ICU messages; the mobile tab labels pass the literal locale `'en'`; the admin and web app do not use the package; no lint rule stops literal copy; no pseudo-locale or catalogue tests exist | In MOD-02-API-08 / MOD-00 client tasks: add an ICU formatter and a `translate(locale, key, args)` signature (the library choice is recorded by ADR), a locale provider per app with `useTranslator()`, the formatting-locale map, the pseudo-locale generator, the tests in 15.2 and the lint rule | Every task with parameterised text |
| GAP-STD17-02 | DECISION | [BG §15] vs locale formatting                                                                                          | The brand guide fixes prices as `$2.50`; French locale formatting writes the amount and symbol differently. No source says which wins in `fr`                                                                                                                                            | Owner decides with the French reviewer: keep the brand format in every locale (recommended until `locale.fr` is turned on), or use locale currency formatting in `fr`                                                                                                                              | French launch set                  |
| GAP-STD17-03 | TR       | [TR §5.1], [CN onboarding-edge-rules], [TR §6.2]                                                                       | Locale negotiation is specified for the app (OB2) and the website (W04) only. Nothing says how the billing web app chooses its language before sign-in, or whether a member's `users.locale` overrides a device choice on a new device                                                   | Add to the Technical Reference: web app uses `users.locale` after sign-in and the `mm_locale` cookie or `en` before; on sign-in the server value wins on every client                                                                                                                              | Web app sign-in screen             |
| GAP-STD17-04 | TR       | [TR §5.1], [SQL `i18n_strings`]                                                                                        | Plural categories and number and date formatting for `pcm` depend on locale data that devices may not carry; no source names the formatting locale for Naijá                                                                                                                             | Record the map in section 6 (`pcm` formats numbers and dates as `en-NG`; plural categories resolved from bundled CLDR data, not the device) in the Technical Reference; confirm the plural forms with the Naijá reviewer                                                                           | Naijá plural correctness           |

## Change log

| Version | Date        | Change      |
| ------- | ----------- | ----------- |
| v1.0    | 24 Nov 2026 | First issue |
