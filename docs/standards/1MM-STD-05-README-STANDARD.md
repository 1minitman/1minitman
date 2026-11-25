# 1MM-STD-05 · README standard

|              |                                                                                                                                                                                                                                                                                         |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Document** | 1MM-STD-05                                                                                                                                                                                                                                                                              |
| **Status**   | Approved baseline · v1.0 · 24 Nov 2026                                                                                                                                                                                                                                                  |
| **Audience** | Engineers and coding agents                                                                                                                                                                                                                                                             |
| **Owner**    | Engineering lead (code owners)                                                                                                                                                                                                                                                          |
| **Sources**  | [TR §1], [TR §2.1], [TR §4.5]; repo: `README.md`, `docs/USAGE.md`, `package.json`, `apps/*/package.json`, `packages/*/package.json`, `infra/README.md`, `assets/README.md`, `packages/db/migrations/README.md`, `scripts/check-banned-terms.mjs`                                        |
| **Related**  | [README.md](../../README.md), [1MM-STD-02](1MM-STD-02-AGENTIC-OPERATIONS.md), [1MM-STD-04](1MM-STD-04-BRAND-GUIDE.md), [1MM-STD-08](1MM-STD-08-CONTRIBUTING.md), [1MM-STD-09](1MM-STD-09-FORMATTING.md), [1MM-STD-10](1MM-STD-10-COMMITS-AND-LOCAL-CI.md), [1MM-INDEX](../1MM-INDEX.md) |

**What this document is for and when to open it.** It says what a README in this repository must
contain, in what order and in what voice, for the root and for every app and package, and how
READMEs are kept true. The root [README.md](../../README.md) is written to it. Open it when you
create an app or a package, when you change a command, a port, a setting or the layout, and when
you review a pull request that does any of those.

## 1. What a README is for here

A README answers three questions for someone who has just opened the folder: what is this, how
do I run it, and where do I read more. It is a front door, not a manual.

| A README holds                              | A README does not hold (and where it goes instead)                                 |
| ------------------------------------------- | ---------------------------------------------------------------------------------- |
| What the thing is, in plain words           | Product rules, limits, prices of record, flows → module plans in `docs/execution/` |
| How to run, test and build it               | Engineering rules → the standards in `docs/standards/`                             |
| What is inside, at folder level             | Decisions and their reasons → ADRs in `docs/adrs/`                                 |
| The few rules a newcomer must not break     | Progress → [1MM-LOG-01](../1MM-LOG-01-PROGRESS.md)                                 |
| Links to the documents that hold the detail | Step-by-step guides, accounts and keys → `docs/USAGE.md`                           |

A fact lives in one place. A README links to it; it does not copy it
([1MM-STD-02](1MM-STD-02-AGENTIC-OPERATIONS.md) §1).

## 2. The root README

Required sections, in this order. Headings use these words so that a reader of any README in the
project knows where to look.

| #   | Section                   | Must contain                                                                                                                                                                                                            |
| --- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Title and tagline         | `# 1minitman` and the tagline. No badges that can go stale; no logo retyped in a font (the logo is artwork, `assets/README.md`).                                                                                        |
| 2   | What 1minitman is         | Two or three plain sentences, public product facts only: a dating app; the plans Free, Premium and Gold; the Black Badge as a one-off verification; the 1-Minute Intro. Then one sentence on what the repository holds. |
| 3   | Contents                  | A short linked list of the sections.                                                                                                                                                                                    |
| 4   | Apps and packages         | One table for the six apps (what it is, stack, API surface or port, where it deploys) and one for the seven packages (what it holds, who uses it).                                                                      |
| 5   | Architecture              | A text diagram of how the clients, the API, the worker, the database and Redis connect, and a few lines that name the load-bearing facts (only the API touches the database; one contract; separate database roles).    |
| 6   | The API-first rule        | The order API → admin → web → mobile, what the API gate is, and a link to [1MM-STD-06](1MM-STD-06-API-FIRST.md).                                                                                                        |
| 7   | Prerequisites             | Tool and version, as the repository pins them (`.nvmrc`, `packageManager`), and what each is needed for.                                                                                                                |
| 8   | Quick start               | The fewest commands from clone to running, and a table of local addresses.                                                                                                                                              |
| 9   | Everyday commands         | A table of the root scripts a contributor uses, exactly as named in `package.json`.                                                                                                                                     |
| 10  | Environment files         | Which file is committed, which is not, the client-prefix rule, and where hosted values live. Never a value.                                                                                                             |
| 11  | Project layout            | A tree to two levels, including `docs/`.                                                                                                                                                                                |
| 12  | How the work is organised | Links to [1MM-INDEX](../1MM-INDEX.md), the master plan, the standards, the database documents, the ADRs, the logs, `docs/USAGE.md` and `AGENTS.md`, with one line each.                                                 |
| 13  | Testing                   | How to run the tests and the checks, what needs the database, and a link to [1MM-STD-01](1MM-STD-01-TESTING-STRATEGY.md) and [1MM-STD-10](1MM-STD-10-COMMITS-AND-LOCAL-CI.md).                                          |
| 14  | Branches and contributing | The two branches, pull requests, signed commits, and a link to `CONTRIBUTING.md`.                                                                                                                                       |
| 15  | Security                  | How to report a problem (link to `SECURITY.md`) and that the repository is public.                                                                                                                                      |
| 16  | Status                    | What exists today, in facts, with a link to the progress log. Updated when a module passes its exit gate.                                                                                                               |
| 17  | Licence                   | What the licence file says. While there is no licence file: the sentence in section 6, rule 7.                                                                                                                          |

Length: the root README should be readable in about five minutes. When a section grows past a
screen, its detail moves to `docs/` and the section keeps a summary and a link.

## 3. App READMEs (`apps/<name>/README.md`)

Every app has a README with these sections, in this order. If a section does not apply, it keeps
its heading and one line saying why.

| #   | Section              | Must contain                                                                                                                                                  |
| --- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Title and one line   | `# @1minitman/<name>` and one sentence: what the app is and who uses it.                                                                                      |
| 2   | What it does         | Three to six lines. What it is responsible for and, as important, what it is not (for example: the web app is billing only; the website is information only). |
| 3   | Stack                | Framework and runtime, the workspace packages it depends on.                                                                                                  |
| 4   | Run it               | The command to run it alone (`pnpm dev --only <name>` or the filter command), its port, and what must be running first.                                       |
| 5   | Settings             | The names of the variables it reads, which are client-visible by prefix, and a pointer to `.env.example`. Never a value.                                      |
| 6   | Layout               | The folders under `src/` and what goes in each. For `apps/api`: the module layers and the surfaces.                                                           |
| 7   | How to add something | The steps to add the app's unit of work (a route, a job, a page, a screen), or a link to the section of `docs/USAGE.md` that holds them.                      |
| 8   | Tests                | How to run this app's tests and what kind they are; link to [1MM-STD-01](1MM-STD-01-TESTING-STRATEGY.md).                                                     |
| 9   | Build and deploy     | The build command, the output folder, where it deploys.                                                                                                       |
| 10  | Rules                | The few rules specific to this app that a newcomer breaks first, each with a link to the standard that owns it.                                               |
| 11  | Read more            | The module plans and standards that matter most for this app.                                                                                                 |

## 4. Package READMEs (`packages/<name>/README.md`)

| #   | Section            | Must contain                                                                                                         |
| --- | ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| 1   | Title and one line | `# @1minitman/<name>` and one sentence: what the package provides.                                                   |
| 2   | What it is for     | What belongs in it and what does not. Which apps consume it.                                                         |
| 3   | Public surface     | The entry points declared in `exports` in its `package.json`, and what each gives. Anything not exported is private. |
| 4   | Use it             | A short, real example of importing and using it from an app.                                                         |
| 5   | Scripts            | The package's scripts (`build`, `generate`, `migrate`, `test`, `typecheck`) and the root script that runs each.      |
| 6   | Generated files    | Which files are generated, by which command, and that they are never edited by hand. "None" if none.                 |
| 7   | How to change it   | The steps to add to it (a schema, a migration, an entitlement key, a token, a component, a catalogue key).           |
| 8   | Tests              | How to run them and what they need (for `packages/db`: a running, migrated database with roles applied).             |
| 9   | Rules              | The few package-specific rules, each linked to its standard.                                                         |
| 10  | Read more          | The standards and database documents that govern it.                                                                 |

Other folders with a README (`infra/`, `assets/`, `packages/db/migrations/`) keep it short: what
is here, what is deliberately not here yet, and the one or two rules of the folder.

## 5. Tone and form

1. **Plain British English.** Short sentences. Say what a thing is before how it works.
2. **No marketing.** No superlatives, no emojis, no slogans beyond the tagline in the root title.
   Describe; do not sell.
3. **Imperative for steps** ("Run", "Add", "Set"). Numbered lists for ordered work, tables for
   facts, code blocks for anything typed.
4. **Exact names.** Commands, scripts, paths and package names are written exactly as in the
   repository and in code formatting (`pnpm db:migrate`, `packages/contracts`). Product terms are
   exact: plans are Free, Premium and Gold; Black Badge is a one-off verification, never a
   subscription.
5. **Every command shown works** when pasted at the stated folder. If it needs something first,
   the line before says so.
6. **Relative links** to files in the repository. External links only to a tool's own
   documentation, and only where a reader needs it.
7. **Present tense, facts only.** A README describes what exists. Plans are in the module plans.
   The only forward-looking part is the Status section's link to the master plan.
8. **Formatting** follows [1MM-STD-09](1MM-STD-09-FORMATTING.md): Prettier, 100 columns, one H1.

## 6. What must never be in a README

1. **Secrets:** keys, tokens, passwords, connection strings to anything hosted, signing material.
   The local development credentials that `docker-compose.yml` already publishes are the only
   exception.
2. **Values of settings.** Name the variable; point to `.env.example`.
3. **Private spec content:** passages from the specification pack, and anything about investors,
   fundraising, valuation, revenue, competitors, persona research or budgets. The repository is
   public.
4. **Personal details:** personal e-mail addresses, phone numbers, real member data. Role
   mailboxes are fine.
5. **Retired product terms:** the retired fifth plan's name or price, or the Black Badge described
   as a subscription. `pnpm check:banned-terms` scans the root README and every README outside
   `docs/`.
6. **Invented facts and promises:** a feature, endpoint, command or date that does not exist. No
   roadmap dates.
7. **A licence claim the repository cannot back.** There is no `LICENSE` file (GAP-STD05-01;
   decision DEC-001 in [1MM-LOG-04](../1MM-LOG-04-OPEN-DECISIONS-AND-FOLLOW-UPS.md)). Until the
   owner decides, the root README says only that no licence file exists and that the terms are an
   open owner decision. It claims no licence.
8. **Copied detail** that lives in a standard, a module plan or `docs/USAGE.md`. Link to it.
9. **Internal hosts, account identifiers and dashboard links** that are not already public.

## 7. Keeping READMEs current

A README that is wrong is worse than none. It is kept true by the same pull request that makes it
wrong.

| If a pull request…                                        | It updates…                                                                                          |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Adds, renames or removes a root script                    | Root README "Everyday commands", `AGENTS.md`, `docs/USAGE.md` §3                                     |
| Adds an app or a package                                  | Its own README (sections 3 or 4), root README "Apps and packages" and "Project layout", `AGENTS.md`  |
| Changes a port, a local address or a prerequisite version | Root README "Prerequisites" and "Quick start", the app's README, `docs/USAGE.md` §2                  |
| Adds or renames a setting                                 | `.env.example`, the app's README "Settings"                                                          |
| Changes a package's `exports`                             | That package's README "Public surface"                                                               |
| Changes how an app is built or deployed                   | The app's README "Build and deploy", `docs/USAGE.md` §9                                              |
| Changes the branch model, the checks or the review rule   | Root README "Branches and contributing", `CONTRIBUTING.md`, [1MM-STD-08](1MM-STD-08-CONTRIBUTING.md) |
| Passes a module's exit gate                               | Root README "Status"                                                                                 |
| Adds a document series or moves a document                | Root README "How the work is organised", [1MM-INDEX](../1MM-INDEX.md)                                |

Checks:

1. **At review:** the reviewer runs the table above against the diff. A missing README update is
   a reason to send the pull request back ([1MM-STD-08](1MM-STD-08-CONTRIBUTING.md) §11).
2. **At every exit gate:** the contributor closing the gate reads the root README and the READMEs
   of the apps and packages the module touched from top to bottom, runs the commands in them, and
   fixes what has drifted. The gate entry in the progress log says this was done.
3. **Automatically:** READMEs are formatted by Prettier (`pnpm format:check`) and READMEs outside
   `docs/` are scanned by `pnpm check:banned-terms`. **Recommendation:** when the documentation
   check proposed in GAP-STD02-02 ([1MM-STD-02](1MM-STD-02-AGENTIC-OPERATIONS.md)) exists, it also
   checks that every app and package has a README with the required headings and that relative
   links in READMEs resolve.

## 8. Gaps raised

Dispositions are recorded in [1MM-LOG-03](../1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md)
(Technical Reference and schema), [1MM-LOG-02](../1MM-LOG-02-UI-UPDATES.md) (UI) and
[1MM-LOG-04](../1MM-LOG-04-OPEN-DECISIONS-AND-FOLLOW-UPS.md) (owner decisions and repository
follow-ups).

| Gap id       | Type     | Where found                                                                  | What is missing or conflicting                                                                                                                                                                                                                                                  | Proposed resolution                                                                                                                                                                                                                                                                                                                                                                 | Blocks                                                                        |
| ------------ | -------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| GAP-STD05-01 | DECISION | Repository root                                                              | The repository is public and has no `LICENSE` file, so the terms on which anyone may use, copy or contribute to the code are unstated. The root README can make no licence claim, and outside contributions have no stated terms ([1MM-STD-08](1MM-STD-08-CONTRIBUTING.md) §9). | The owner decides. Options: (a) keep the code proprietary and add a `LICENSE` file that says all rights are reserved, with a line on how contributions are accepted; (b) choose an open-source licence. **Recommendation:** (a) until the owner decides otherwise, because the product is commercial. The README's Licence section is updated in the same pull request as the file. | Nothing in the build. Accepting outside contributions should wait for it.     |
| GAP-STD05-02 | REPO     | `apps/*`, `packages/*`                                                       | None of the six apps and seven packages has a README. The only READMEs below the root are `infra/README.md`, `assets/README.md` and `packages/db/migrations/README.md`.                                                                                                         | Add a README to each app and package to sections 3 and 4. **Recommendation:** write each one in the first module that touches the workspace (most arrive with [MOD-00](../execution/1MM-EXE-MOD-00-FOUNDATIONS.md)), so that each describes real code.                                                                                                                              | Nothing                                                                       |
| GAP-STD05-03 | REPO     | `docs/USAGE.md` §4 ("A database change"), `packages/db/migrations/README.md` | Both say the next migration number is `0006`. `packages/db/migrations/0006_partition_function_definer.sql` already exists, so the next number is `0007`.                                                                                                                        | Replace the fixed number in both files with "the next unused number", so the text cannot go stale again.                                                                                                                                                                                                                                                                            | **Closed 25 Nov 2026** (REP-002): both files now say "the next unused number" |

## Change log

| Version | Date        | Change            |
| ------- | ----------- | ----------------- |
| v1.0    | 24 Nov 2026 | Approved baseline |
