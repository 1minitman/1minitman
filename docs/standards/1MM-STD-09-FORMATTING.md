# 1MM-STD-09 · Formatting standard

|              |                                                                                                                                                                                                                                                                                              |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Document** | 1MM-STD-09                                                                                                                                                                                                                                                                                   |
| **Status**   | Approved baseline · v1.0 · 24 Nov 2026                                                                                                                                                                                                                                                       |
| **Audience** | Engineers and coding agents                                                                                                                                                                                                                                                                  |
| **Owner**    | Engineering lead (code owners)                                                                                                                                                                                                                                                               |
| **Sources**  | Repo configuration: `.prettierrc.json`, `.prettierignore`, `.editorconfig`, `eslint.config.mjs`, `package.json` (`lint-staged`, scripts), `.husky/pre-commit`, `.github/workflows/ci.yml`, `tsconfig.base.json`, `.gitignore`; [TR §17.3]                                                    |
| **Related**  | [1MM-STD-14](1MM-STD-14-CODING-CONVENTIONS.md), [1MM-STD-10](1MM-STD-10-COMMITS-AND-LOCAL-CI.md), [1MM-STD-08](1MM-STD-08-CONTRIBUTING.md), [1MM-STD-20](1MM-STD-20-DESIGN-SYSTEM.md), [1MM-DB-03](../database/1MM-DB-03-SQL-STRUCTURE.md), [1MM-DB-02](../database/1MM-DB-02-MIGRATIONS.md) |

**What this document is for and when to open it.** It states how every file in the repository is
laid out, which tool decides, and where a human still has to. Open it when a format check fails,
when you add a new file type, or when you set up an editor. It describes what the configuration
does today; anything beyond that is labelled **Recommendation** and has a gap in §14.

## 1. Who decides what

| Concern                                                                                                             | Decided by                                                                     | Not decided by                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout: line width, quotes, commas, indentation, wrapping                                                           | Prettier 3 (`.prettierrc.json`)                                                | ESLint: `eslint-config-prettier` is the last entry in `eslint.config.mjs` and switches off every ESLint rule that would argue with Prettier |
| Correctness and architecture: unused variables, type-only imports, React hook rules, workspace and layer boundaries | ESLint 10 (`eslint.config.mjs`)                                                | Prettier                                                                                                                                    |
| Types                                                                                                               | `tsc --noEmit` per workspace and `astro check` for the site (`pnpm typecheck`) | —                                                                                                                                           |
| Encoding, line endings, final newline, indentation in files no formatter handles                                    | `.editorconfig`                                                                | —                                                                                                                                           |

Do not argue with the formatter in review, and do not add `// prettier-ignore` to win a layout
preference. It is acceptable only where alignment carries meaning (for example a matrix) and the
comment says why.

## 2. Prettier

`.prettierrc.json` sets three options; everything else is the Prettier 3 default.

| Option                 | Value                                                 | Set in the repo? |
| ---------------------- | ----------------------------------------------------- | ---------------- |
| `printWidth`           | 100                                                   | Yes              |
| `singleQuote`          | `true` (JSX attributes still use double quotes)       | Yes              |
| `trailingComma`        | `all`                                                 | Yes              |
| `semi`                 | `true`                                                | Default          |
| `tabWidth` / `useTabs` | 2 / spaces                                            | Default          |
| `arrowParens`          | `always`                                              | Default          |
| `bracketSpacing`       | `true`                                                | Default          |
| `bracketSameLine`      | `false`                                               | Default          |
| `quoteProps`           | `as-needed`                                           | Default          |
| `endOfLine`            | `lf`                                                  | Default          |
| `proseWrap`            | `preserve` (Markdown line breaks are left as written) | Default          |

No Prettier plugin is installed. Prettier therefore formats the languages it supports natively
(TypeScript, TSX, JavaScript, JSON, CSS, Markdown, YAML, HTML) and skips the rest (`.astro`,
`.sql`, shell).

### 2.1 What Prettier never touches (`.prettierignore`)

| Entry                                                            | Why                                                                      |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `node_modules`, `dist`, `.turbo`, `.astro`, `.expo`              | Dependencies and build output                                            |
| `pnpm-lock.yaml`                                                 | Written by pnpm                                                          |
| `packages/db/migrations`                                         | Applied migrations are checksummed; a reformat would change the checksum |
| `packages/db/src/schema`                                         | Drizzle models refreshed from `pnpm db:pull`                             |
| `packages/contracts/openapi`, `packages/contracts/src/generated` | Written by `pnpm contracts:generate`                                     |
| `packages/tokens/dist`                                           | Written by the token build                                               |
| `packages/tokens/tokens.json`                                    | A byte-for-byte copy of the design-token source                          |
| `apps/admin/src/routeTree.gen.ts`                                | Written by TanStack Router                                               |
| `**/*.svg`                                                       | Artwork                                                                  |
| `results.sarif`                                                  | Written by the CI secret scan                                            |

## 3. ESLint

`eslint.config.mjs` is one flat config for the whole repository.

| Block                                                      | Applies to                                                                                                                                                                                                      | What it does                                                                                                                                                                          |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ignores                                                    | `node_modules`, `dist`, `.turbo`, `.astro`, `.expo`, `**/*.gen.ts`, `packages/contracts/src/generated/**`, `packages/db/.introspected/**`, `**/*.astro`, `apps/mobile/*.config.js`, `apps/mobile/expo-env.d.ts` | Not linted                                                                                                                                                                            |
| `@eslint/js` recommended + `typescript-eslint` recommended | Everything else                                                                                                                                                                                                 | Baseline correctness rules (not the type-aware set)                                                                                                                                   |
| Project rules                                              | Everything                                                                                                                                                                                                      | `@typescript-eslint/consistent-type-imports` (error, `fixStyle: 'inline-type-imports'`); `@typescript-eslint/no-unused-vars` (error; names starting `_` are exempt); `no-console` off |
| `react-hooks` recommended                                  | `apps/{admin,web,mobile}/**/*.{ts,tsx}`, `packages/ui-*/**/*.{ts,tsx}`                                                                                                                                          | Rules of hooks                                                                                                                                                                        |
| `no-restricted-imports` (three blocks)                     | `apps/**`, `packages/**`, and the API's layers                                                                                                                                                                  | Workspace and clean-architecture boundaries; explained in [1MM-STD-14 §3](1MM-STD-14-CODING-CONVENTIONS.md)                                                                           |
| `eslint-config-prettier`                                   | Everything                                                                                                                                                                                                      | Last: disables formatting rules                                                                                                                                                       |

`eslint --fix` applies the safe fixes (for example it rewrites a value import of a type to a
type import). Run it through `pnpm lint` (`eslint .`), or let the commit hook do it.

## 4. Line endings, encoding and whitespace

`.editorconfig` applies to every file (`[*]`):

| Setting                        | Value       |
| ------------------------------ | ----------- |
| `charset`                      | `utf-8`     |
| `end_of_line`                  | `lf`        |
| `indent_style` / `indent_size` | `space` / 2 |
| `insert_final_newline`         | `true`      |
| `trim_trailing_whitespace`     | `true`      |

Prettier's default `endOfLine: lf` enforces LF in the files it formats. There is no
`.gitattributes`, so nothing stops Git on Windows from converting line endings on checkout
(GAP-STD09-04). No byte-order mark. No tabs anywhere.

## 5. Per-language rules

### 5.1 TypeScript and TSX

Formatted by Prettier, linted by ESLint, on commit and in CI.

| Rule                                                                                                                                                   | Enforced by                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| 100 columns, single quotes, semicolons, trailing commas everywhere, 2 spaces                                                                           | Prettier                                                                                                                           |
| JSX attributes use double quotes; a JSX tree that wraps is put in parentheses                                                                          | Prettier                                                                                                                           |
| A type-only import uses `import type { … }`; a mixed import marks the type inline: `import { cva, type VariantProps } from 'class-variance-authority'` | ESLint `consistent-type-imports`, and `verbatimModuleSyntax` in `tsconfig.base.json` makes an unmarked type import a compile error |
| Unused variables and arguments are errors unless the name starts with `_`                                                                              | ESLint                                                                                                                             |
| No `// @ts-ignore` and no `any` without a reason                                                                                                       | `typescript-eslint` recommended (`ban-ts-comment`, `no-explicit-any`)                                                              |

**Import ordering is not enforced by any tool.** The existing code is consistent, and new code
follows it:

1. A side-effect import that must run first (for example `import '../global.css'` in the app's
   root layout) goes at the top, followed by a blank line.
2. Then one block with no blank lines, sorted alphabetically by module specifier: packages first
   (scoped `@1minitman/…` and other `@…` names sort ahead of bare names), then the `@/` alias (mobile
   only), then relative paths (`../` before `./`).
3. Named members inside the braces are alphabetical.

Example (`apps/api/src/app.ts`): `@1minitman/contracts`, `@scalar/hono-api-reference`,
`hono/cors`, `hono/secure-headers`, then `./config/env`, `./modules/system`, `./platform/…`,
`./surfaces`. **Recommendation:** enforce this order with a lint rule (GAP-STD09-03).

### 5.2 Astro

`.astro` files are **not formatted by Prettier** (no Astro plugin is installed, and the
`lint-staged` Prettier pattern does not list `astro`) and **not linted** (ESLint ignores
`**/*.astro`; the `lint-staged` ESLint pattern lists `astro` but `--no-warn-ignored` makes that a
no-op). They are type-checked by `astro check` through `pnpm typecheck`. Until GAP-STD09-01 closes,
format them by hand to the same rules: 2 spaces, single quotes in the frontmatter script, double
quotes on attributes, 100 columns, and the frontmatter laid out like a TypeScript file (§5.1).
Component files are PascalCase (§7).

### 5.3 JSON

Prettier formats `.json` (2 spaces, no trailing commas, since JSON forbids them). `package.json`
key order is kept as written: follow the order used in the existing manifests (`name`, `version`,
`private`, `type`, `description`, `exports`, `scripts`, `dependencies`, `peerDependencies`,
`devDependencies`). Generated JSON (§2.1) is never formatted. Locale catalogues
(`packages/i18n/src/locales/*.json`) are flat objects, one key per line.

### 5.4 YAML

Prettier formats `.yml` and `.yaml`: 2 spaces, comments kept. This covers
`.github/workflows/*.yml`, `.github/dependabot.yml`, `docker-compose.yml` and
`pnpm-workspace.yaml`. `pnpm-lock.yaml` is excluded. Content rules for workflows (pinned action
hashes, top-level `permissions`) are checked by `pnpm check:repo`, not by a formatter.

### 5.5 Markdown

Prettier formats `.md`: it normalises list markers, emphasis, code fences and blank lines, and
**re-aligns every table** (columns are padded to equal width, so a table with one long cell
becomes wide). `proseWrap` is `preserve`, so Prettier neither wraps nor unwraps paragraphs: wrap
prose by hand at about 100 columns. Document rules for `docs/` are in §8.

### 5.6 SQL migrations

No tool formats SQL. `packages/db/migrations` is in `.prettierignore`, and an applied migration
must never change by a single byte (the runner checks checksums; `packages/db/migrations/README.md`).
A new migration follows the style of the baseline: upper-case keywords, lower-case snake_case
identifiers, `--` comments, one statement group per concern. File names are
`NNNN_lower_snake_title.sql`. The structural rules are in
[1MM-DB-03](../database/1MM-DB-03-SQL-STRUCTURE.md) and
[1MM-DB-02](../database/1MM-DB-02-MIGRATIONS.md). SQL written inline in TypeScript (tagged
templates) follows the same keyword and identifier casing.

### 5.7 CSS and Tailwind class order

Prettier formats `.css` files (the Tailwind v4 at-rules `@import`, `@theme`, `@source`, `@layer`
are kept). There are few of them by design: one stylesheet per surface
([1MM-STD-20 §2.1](1MM-STD-20-DESIGN-SYSTEM.md)).

**The order of Tailwind classes inside `class` / `className` is not enforced by any tool.**
Prettier leaves string contents alone. **Recommendation** (GAP-STD09-02): until a sorter is
installed, write classes in this order so diffs stay readable: layout (`flex`, `grid`, position),
box (size, spacing), typography, colour and border, effects and transitions, then state and
responsive variants last. Long variant lists go in a `cva` definition, not inline.

### 5.8 Shell

The only shell in the repository is `.husky/pre-commit` and the `run:` blocks in the CI workflow.
No formatter runs on them; `.editorconfig` applies (LF, 2 spaces, final newline). Repository
scripts are Node `.mjs` files in `scripts/`, formatted by Prettier, so that they run the same on
every platform. Do not add `.sh` scripts where a `.mjs` script would do.

### 5.9 JavaScript (`.js`, `.mjs`, `.cjs`)

Formatted by Prettier and linted by ESLint like TypeScript. `apps/mobile/*.config.js` (Babel,
Metro, Tailwind) is formatted by Prettier but ignored by ESLint.

## 6. Generated files: never hand-formatted, never hand-edited

| Path                                                                         | Produced by                                       | Committed?                                                                  |
| ---------------------------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------- |
| `packages/tokens/dist/**`                                                    | `pnpm --filter @1minitman/tokens build`           | No (git-ignored)                                                            |
| `packages/contracts/openapi/*.json`, `packages/contracts/src/generated/*.ts` | `pnpm contracts:generate`                         | Yes; CI fails if they are stale (`git diff --exit-code packages/contracts`) |
| `apps/admin/src/routeTree.gen.ts`                                            | TanStack Router (`tsr generate`, the Vite plugin) | Yes                                                                         |
| `packages/db/src/schema/**`                                                  | Refreshed from `pnpm db:pull`                     | Yes                                                                         |
| `packages/db/.introspected/**`                                               | `pnpm db:pull`                                    | No (git-ignored)                                                            |
| `pnpm-lock.yaml`                                                             | `pnpm install`                                    | Yes                                                                         |
| `apps/mobile/expo-env.d.ts`, `.expo/`, `.astro/`, `dist/`, `.turbo/`         | Tooling                                           | `expo-env.d.ts` yes; the rest no                                            |

To change one of these, change its source and regenerate. Every generated file that carries a
header says so ("Generated by … Do not edit.").

## 7. File and folder naming

| Thing                         | Rule                                                                                              | Example                                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript and TSX source     | lower kebab-case                                                                                  | `check-readiness.ts`, `status-badge.tsx`, `redis-rate-limiter.ts`                                                               |
| API route file                | `<module>.routes.ts` in the module's `http/` folder                                               | `system.routes.ts`                                                                                                              |
| Test                          | `<subject>.test.ts`, next to the code                                                             | `rate-limit.test.ts`, `jobs.test.ts`                                                                                            |
| Astro component and layout    | PascalCase                                                                                        | `BaseLayout.astro`, `BrandMark.astro`                                                                                           |
| Router files                  | The router's own convention                                                                       | Admin: `__root.tsx`, `index.tsx`, `$.tsx`; mobile: `_layout.tsx`, `(tabs)/specs.tsx`; site: `[locale]/index.astro`, `404.astro` |
| Folders                       | lower kebab-case; API module layers are exactly `domain`, `application`, `infrastructure`, `http` | `apps/api/src/platform/rate-limit/`                                                                                             |
| Worker job file               | The job name with dots as hyphens                                                                 | `partitions.ensure` → `partitions-ensure.ts`                                                                                    |
| Repository script             | kebab-case `.mjs`                                                                                 | `scripts/check-banned-terms.mjs`                                                                                                |
| Migration                     | `NNNN_lower_snake_title.sql`, next unused number                                                  | `0006_partition_function_definer.sql`                                                                                           |
| Workspace package             | `@1minitman/<folder-name>`                                                                        | `@1minitman/ui-web`                                                                                                             |
| Derived document              | `1MM-<SERIES>-<NN>-<UPPER-KEBAB-TITLE>.md` (§8)                                                   | `1MM-STD-09-FORMATTING.md`                                                                                                      |
| Root conventions              | The names tools expect                                                                            | `README.md`, `AGENTS.md`, `CONTRIBUTING.md`, `SECURITY.md`, `.env.example`                                                      |
| Brand and illustration assets | Keep the source file names; they encode use                                                       | `avatar_zara__D1-D5-…__512x512.svg`                                                                                             |

Identifier naming inside files is in [1MM-STD-14 §4](1MM-STD-14-CODING-CONVENTIONS.md).

## 8. Markdown documents in `docs/`

### 8.1 Naming series

| Series | Folder            | Pattern                                                                         |
| ------ | ----------------- | ------------------------------------------------------------------------------- |
| `EXE`  | `docs/execution/` | `1MM-EXE-00-MASTER-PLAN.md`, `1MM-EXE-MOD-<NN>-<TITLE>.md`                      |
| `STD`  | `docs/standards/` | `1MM-STD-<NN>-<TITLE>.md`                                                       |
| `DB`   | `docs/database/`  | `1MM-DB-<NN>-<TITLE>.md`                                                        |
| `RES`  | `docs/resources/` | `1MM-RES-<NN>-<TITLE>.md`                                                       |
| `ADR`  | `docs/adrs/`      | `1MM-ADR-<NNNN>-<TITLE>.md` (four digits; `0000` is the index and the template) |
| `LOG`  | `docs/`           | `1MM-LOG-<NN>-<TITLE>.md`                                                       |

Titles are upper kebab-case. Numbers are never reused. `docs/1MM-INDEX.md` lists every document;
a new document adds its row there. `docs/USAGE.md` predates the series and keeps its name.

### 8.2 Structure of every document

1. One H1: `# <DOCUMENT ID> · <Title>`.
2. The header block directly under it: a two-column table with an empty header row and the rows
   **Document**, **Status**, **Audience**, **Owner**, **Sources**, **Related** (module plans add
   **Apps touched**, **Depends on**, **Unlocks**).
3. A two-to-four line paragraph: what the document is for and when to open it.
4. Numbered H2 sections (`## 1. …`), H3 below them (`### 1.1 …`). No skipped levels.
5. A "Gaps raised" section when the document raises any, with the columns Gap id, Type, Where
   found, What is missing or conflicting, Proposed resolution, Blocks.
6. Last: `## Change log` with the columns Version, Date, Change.

### 8.3 Writing and layout rules

| Rule                  | Detail                                                                                                                                                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language              | British English, plain and direct. No emojis. Say a thing once.                                                                                                                                |
| Facts                 | Tables. Ordered work: numbered lists. Checklists: `- [ ]`.                                                                                                                                     |
| Tables                | One row per line; keep a cell to one line; escape a literal pipe as `\|`. Prettier pads the columns, so do not align by hand.                                                                  |
| Code and names        | Backticks for paths, commands, identifiers, keys and values. Fenced blocks carry a language (`ts`, `bash`, `sql`, `json`, `markdown`), or none for diagrams.                                   |
| Links inside the repo | Relative Markdown links to the exact file name: `[1MM-STD-13](1MM-STD-13-ERROR-CODES.md)` from the same folder, `../execution/…` across folders. Never an absolute URL to the repository host. |
| Source pack           | Cited with bracket codes (`[TR §8.1]`, `[ADM A01]`, `[OD-24]`), never linked: the pack is not in the repo.                                                                                     |
| Line length           | Wrap prose at about 100 columns by hand; tables may be wide.                                                                                                                                   |
| Dates                 | `24 Nov 2026` in prose and tables.                                                                                                                                                             |
| Placeholders          | No "TBD" without an owner and a gap id. A section that does not apply says why in one line.                                                                                                    |
| Labels                | An engineering opinion that is not from a source is marked **Recommendation**.                                                                                                                 |
| Banned content        | No secrets, real personal contact details, or private-pack business content. The retired plan name and price are not written, even though `scripts/check-banned-terms.mjs` skips `docs/`.      |

No tool checks these document rules or the links (GAP-STD09-06).

## 9. Editor set-up

The repository commits `.editorconfig` and no editor-specific settings (GAP-STD09-05). Set up any
editor to do three things:

1. Honour `.editorconfig` (built in to most editors; a plugin in VS Code).
2. Format on save with the workspace's Prettier (the version in `node_modules`, not a global
   one), using `.prettierrc.json` and `.prettierignore`.
3. Show ESLint problems from the root flat config and apply its fixes on save.

Use the workspace TypeScript version (6, from the pnpm catalogue), not the editor's bundled one.
For `.astro` files install the editor's Astro language support; its formatter is not the
repository's formatter (§5.2), so do not let it reformat whole files in a pull request about
something else.

## 10. How formatting is enforced

| Stage               | What runs                                                                                                                                                                                                                              | Defined in                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| On commit           | `pnpm exec lint-staged`: `eslint --fix --no-warn-ignored` on staged `*.{ts,tsx,js,mjs,cjs,astro}`; `prettier --write` on staged `*.{ts,tsx,js,mjs,cjs,json,md,yml,yaml,css}`. Then the staged secret check, and gitleaks if installed. | `package.json` (`lint-staged`), `.husky/pre-commit` |
| Locally, on demand  | `pnpm format` (`prettier --write .`), `pnpm format:check`, `pnpm lint`; `pnpm check` runs format check, lint, repository rules, type-check and tests in that order                                                                     | `package.json`                                      |
| In CI, job `verify` | `pnpm format:check` then `pnpm lint`, before the database, contract, type-check, test and build steps. A formatting difference fails the pull request.                                                                                 | `.github/workflows/ci.yml`                          |

Notes:

- The commit hook formats only staged files of the listed extensions. HTML files (for example
  `apps/admin/index.html`) are not in the hook pattern but are checked by `pnpm format:check`, so
  run `pnpm format` before pushing if you touched one.
- Never bypass the hook with `--no-verify` ([1MM-STD-10](1MM-STD-10-COMMITS-AND-LOCAL-CI.md)).
- A pull request does not mix a mass reformat with a behaviour change. If a formatter setting
  changes, the reformat is its own pull request.

## 11. Quick answers

| Question                                           | Answer                                                                                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| The check fails on a file I did not touch          | Someone committed without the hook, or the file type is outside the hook pattern. Run `pnpm format` and commit the result separately. |
| Prettier reformatted my table into very long lines | Expected (§5.5). Shorten the longest cell or move detail into prose under the table.                                                  |
| ESLint and Prettier disagree                       | They cannot: `eslint-config-prettier` is last. If you see it, a rule was added after it; fix the config order.                        |
| Can I change a Prettier option?                    | Only by its own pull request with the full reformat, reviewed by a code owner.                                                        |

## 12. What never to do

1. Hand-edit or hand-format a generated file (§6).
2. Reformat an applied migration.
3. Add a second formatter, a per-folder Prettier config, or editor settings that override the
   root configuration.
4. Disable a lint rule for a file or line without a comment giving the reason.
5. Commit with CRLF line endings, tabs or a byte-order mark.
6. Reformat `packages/tokens/tokens.json` (it must stay identical to the design-token source).

## 13. Summary of what is and is not machine-enforced

| Rule                                                               | Enforced                                                    |
| ------------------------------------------------------------------ | ----------------------------------------------------------- |
| Prettier layout for TS, TSX, JS, JSON, CSS, Markdown, YAML, HTML   | Yes (hook and CI)                                           |
| Type-only imports, unused variables, hook rules, import boundaries | Yes (ESLint, hook and CI)                                   |
| LF, UTF-8, final newline                                           | Partly (Prettier for its files; `.editorconfig` in editors) |
| Astro formatting and linting                                       | No (GAP-STD09-01)                                           |
| Tailwind class order                                               | No (GAP-STD09-02)                                           |
| Import order                                                       | No (GAP-STD09-03)                                           |
| Line endings on checkout                                           | No (GAP-STD09-04)                                           |
| SQL and shell layout                                               | No; review only (§5.6, §5.8)                                |
| File naming                                                        | No; review only (§7)                                        |
| Document naming, header block, links                               | No (GAP-STD09-06)                                           |

## 14. Gaps raised

Dispositions are recorded in [1MM-LOG-03](../1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md)
(Technical Reference and schema), [1MM-LOG-02](../1MM-LOG-02-UI-UPDATES.md) (UI) and
[1MM-LOG-04](../1MM-LOG-04-OPEN-DECISIONS-AND-FOLLOW-UPS.md) (owner decisions and repository
follow-ups).

Each gap is a **Recommendation**: the repository works without it, and the rule it would enforce
is followed by hand until it closes.

| Gap id       | Type | Where found                                                                     | What is missing or conflicting                                                                                                  | Proposed resolution                                                                                                                                                                  | Blocks |
| ------------ | ---- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| GAP-STD09-01 | REPO | `package.json` (`lint-staged`), `eslint.config.mjs` ignores, no Prettier plugin | `.astro` files are neither formatted nor linted; only `astro check` reads them. The website is built almost entirely from them. | Add `prettier-plugin-astro` (and `astro` to the Prettier `lint-staged` pattern) and `eslint-plugin-astro` with the accessibility rules; remove `**/*.astro` from the ESLint ignores. | none   |
| GAP-STD09-02 | REPO | `.prettierrc.json`                                                              | Tailwind class order is not sorted by any tool.                                                                                 | Add `prettier-plugin-tailwindcss`, pointed at `packages/ui-web/src/styles.css` and the site stylesheet; reformat in one pull request.                                                | none   |
| GAP-STD09-03 | REPO | `eslint.config.mjs`                                                             | Import order is a convention only.                                                                                              | Add an import-sorting rule configured to the order in §5.1 and run `eslint --fix` once.                                                                                              | none   |
| GAP-STD09-04 | REPO | Repository root                                                                 | No `.gitattributes`; a Windows checkout with automatic CRLF conversion fails `pnpm format:check`.                               | Add `.gitattributes` with `* text=auto eol=lf` and binary markers for images and fonts.                                                                                              | none   |
| GAP-STD09-05 | REPO | Repository root                                                                 | No shared editor settings; format-on-save depends on each person's set-up.                                                      | Commit `.vscode/extensions.json` (EditorConfig, Prettier, ESLint, Astro, Tailwind) and a minimal `.vscode/settings.json` (format on save, workspace TypeScript).                     | none   |
| GAP-STD09-06 | REPO | `docs/`                                                                         | Nothing checks document file names, the header block, the change log or relative links, so a renamed file leaves dead links.    | Add a `scripts/check-docs.mjs` step to `pnpm check:repo`: name pattern per folder, required header rows, every relative link resolves.                                               | none   |

## Change log

| Version | Date        | Change                                                        |
| ------- | ----------- | ------------------------------------------------------------- |
| v1.0    | 24 Nov 2026 | First issue, from the repository configuration as scaffolded. |
