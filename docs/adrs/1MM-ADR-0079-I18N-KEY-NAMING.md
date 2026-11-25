# 1MM-ADR-0079 · i18n key naming: dotted keys with lower snake_case segments

|                  |                                                                                                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Status**       | Proposed                                                                                                                                                                                               |
| **Date decided** | 24 Nov 2026 (proposed)                                                                                                                                                                                 |
| **Decided by**   | Engineering recommendation, applied across this documentation set (1MM-STD-17 is aligned to it); awaiting the owner                                                                                    |
| **Sources**      | `docs/standards/1MM-STD-17-LANGUAGE-CONFIGURATION.md` §4, `docs/standards/1MM-STD-14-CODING-CONVENTIONS.md` §4.2 and GAP-STD14-02, `packages/i18n/src/locales/en.json`, [SQL `i18n_strings` and seeds] |
| **Affects**      | packages/i18n, packages/db (seeds), every client, apps/admin (translations pages); MOD-02 and every module that adds copy                                                                              |

## Context

Every piece of text a person reads is an i18n key whose source of truth is the table
`i18n_strings`, with bundled defaults in `packages/i18n`
([1MM-ADR-0035](1MM-ADR-0035-I18N-EN-PCM-FR.md)). Keys are dotted, from general to specific. Two
casings for a multi-word segment exist today:

- the schema seeds use lower snake_case segments (`product.black_badge`, `opt.faith_practice`,
  `n01.title`) [SQL];
- the twelve keys in the scaffold catalogue use camelCase segments (`common.getTheApp`,
  `status.apiOnline`) (`packages/i18n/src/locales/en.json`).

The two standards written for this set first took different sides. 1MM-STD-17 §4 said a
multi-word segment is lowerCamelCase "as in the existing catalogue"; it is now aligned to this
ADR. 1MM-STD-14 §4.2 says new keys follow the seeds and raises GAP-STD14-02 to rename the
scaffold keys. The table's CHECK constraint
accepts both. Both cannot be the rule for one table.

## Decision

**Recommendation:** adopt the seeds' pattern.

1. A key is dot-separated, general to specific: `<area>.<element>[.<part>]`.
2. Every segment is lower case; a multi-word segment is **lower snake_case**
   (`common.get_the_app`, `nt1.quiet_hours.label`).
3. The twelve scaffold keys are renamed to match (GAP-STD14-02), and
   [1MM-STD-17 §4](../standards/1MM-STD-17-LANGUAGE-CONFIGURATION.md) is corrected. Its other
   rules stand unchanged: screen id as the area, `common.` for shared wording, `error.<reason>`,
   one key per sentence, no key built from free text.

Until the owner confirms, new keys follow this recommendation, because it needs no change to the
seeded rows.

## Alternatives considered

| Option                                         | For                                                                                                                                                                                                                                                                                | Against                                                                                                                                     |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. lower snake_case segments** (recommended) | Matches every key already seeded in the schema; matches config keys, entitlement keys and error codes, which are all lower snake (`intro.window_hours`, `chat.full`, `quota_exhausted`), so `error.<reason>` needs no case conversion; only 12 keys to rename, all in the scaffold | Differs from the common JavaScript habit of camelCase property names                                                                        |
| **B. lowerCamelCase segments**                 | Matches the scaffold catalogue and reads naturally in TypeScript                                                                                                                                                                                                                   | Requires renaming every seeded key by migration, or living with two patterns; `error.<reason>` keys would be snake inside a camel catalogue |
| **C. Leave both**                              | No work now                                                                                                                                                                                                                                                                        | Two patterns in one table; no lint rule can be written; translators and agents guess                                                        |

## Consequences

- Easier: one pattern that a lint rule and a catalogue test can enforce; keys derived from codes
  need no transformation.
- Harder: the scaffold's twelve keys and their call sites change once, and 1MM-STD-17's examples
  are rewritten in snake_case.
- Cost: small now, growing with every key added under the wrong pattern, which is why this is
  recorded before module work starts.

## How it is applied

- The rename and the key-pattern test land with the i18n tasks in
  [MOD-02](../execution/1MM-EXE-MOD-02-PLATFORM-CONFIG-AND-CATALOGUES.md) (GAP-STD17-01 lists the
  missing lint rule and catalogue tests).
- Check: a catalogue test that every key matches the pattern, in `packages/i18n` and against the
  `i18n_strings` seed; review rejects a new key in the other casing.

## Revisit when

The owner chooses option B, or the Technical Reference gains a key-naming rule that differs.
Either way, the choice must be made before the first module adds keys in bulk.
