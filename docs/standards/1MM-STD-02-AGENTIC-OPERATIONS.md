# 1MM-STD-02 · Agentic operations: how agents and engineers keep records and stay uniform

|              |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Document** | 1MM-STD-02                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Status**   | Approved baseline · v1.0 · 24 Nov 2026                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Audience** | Engineers and coding agents                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **Owner**    | Engineering lead (code owners)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Sources**  | [PACK], [OD-nn] (decisions log), [TR §17.3], [TR §18], [TR §19], [BG], [BS], [TOK]; repo: `.github/rulesets/`, `.github/CODEOWNERS`, `.github/workflows/ci.yml`, `docs/USAGE.md`                                                                                                                                                                                                                                                                                                                                                                   |
| **Related**  | [1MM-INDEX](../1MM-INDEX.md), [1MM-EXE-00](../execution/1MM-EXE-00-MASTER-PLAN.md), [1MM-STD-06](1MM-STD-06-API-FIRST.md), [1MM-STD-07](1MM-STD-07-PROGRESS-UPDATES.md), [1MM-STD-08](1MM-STD-08-CONTRIBUTING.md), [1MM-STD-10](1MM-STD-10-COMMITS-AND-LOCAL-CI.md), [1MM-STD-04](1MM-STD-04-BRAND-GUIDE.md), [1MM-ADR-0000-INDEX](../adrs/1MM-ADR-0000-INDEX.md), [1MM-LOG-01](../1MM-LOG-01-PROGRESS.md), [1MM-LOG-02](../1MM-LOG-02-UI-UPDATES.md), [1MM-LOG-03](../1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md), [AGENTS.md](../../AGENTS.md) |

**What this document is for and when to open it.** It is the operating procedure for anyone who
changes this repository, human or coding agent: which record wins when two disagree, what to read
before a task, the loop every task follows, what to write down and where, and how several agents
work at once without undoing each other. Open it at the start of every working session until the
loop is habit, and whenever you are unsure where a decision, a change or a note belongs.

## 1. Principles

1. **The repository's documents are the memory.** Nothing that matters lives only in a chat, a
   terminal or an agent's private notes. If it is not in a document listed in section 2, it did not
   happen.
2. **One place for each kind of fact.** A decision is in an owner decision or an ADR. A rule is in
   a standard. A plan is in a module plan. Progress is in the progress log. A fact is never copied
   into a second place: it is linked.
3. **The order of work is fixed:** API → admin → web → mobile, and data before any of them
   ([1MM-STD-06](1MM-STD-06-API-FIRST.md)).
4. **Never invent.** A missing endpoint, column, key, screen or number is a gap (section 7), not a
   guess.
5. **An agent has no more authority than the pull request it opens.** Every change is reviewed and
   merged by a human code owner (section 13).

## 2. The records and who keeps them

| Record                                                                               | Where it lives                                                                                                                                                                                | Changed by                                                | Changed when                                                                                  |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Owner decisions `[OD-nn]`                                                            | Private spec pack (decisions log). Not in this repo.                                                                                                                                          | The owner only                                            | When the owner decides                                                                        |
| Technical Reference `[TR]`, schema `[SQL]`, data dictionary `[DD]`                   | Master in the private spec pack. Mirrored here only as: `packages/db/migrations/`, `packages/db/SCHEMA_DATA_DICTIONARY.md`, and [1MM-LOG-03](../1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md) | Engineering lead, in the pack first                       | Through a gap (section 7) and an extension (section 8)                                        |
| Brand strategy `[BS]`, brand guide `[BG]`, tokens `[TOK]`                            | Masters in the private spec pack. In this repo: [1MM-STD-04](1MM-STD-04-BRAND-GUIDE.md), [1MM-STD-20](1MM-STD-20-DESIGN-SYSTEM.md), `packages/tokens/tokens.json`, `assets/`                  | Owner and design lead in the pack; engineering lead here  | Master first, then the extension log, then the standard, then tokens and code                 |
| Architecture decision records (ADRs)                                                 | `docs/adrs/`, listed in [1MM-ADR-0000-INDEX](../adrs/1MM-ADR-0000-INDEX.md)                                                                                                                   | Any contributor proposes; a code owner accepts            | Section 6                                                                                     |
| Standards (`1MM-STD-nn`), database documents (`1MM-DB-nn`), resources (`1MM-RES-nn`) | `docs/standards/`, `docs/database/`, `docs/resources/`                                                                                                                                        | Any contributor by pull request; a code owner approves    | When a rule changes; every change adds a change-log row                                       |
| Master plan and module plans (`1MM-EXE-…`)                                           | `docs/execution/`                                                                                                                                                                             | The contributor working the module; a code owner approves | When scope, order, a task or a gap changes; change-log row every time                         |
| Progress log                                                                         | [1MM-LOG-01](../1MM-LOG-01-PROGRESS.md)                                                                                                                                                       | Whoever did the work                                      | End of every working session and at every gate ([1MM-STD-07](1MM-STD-07-PROGRESS-UPDATES.md)) |
| UI updates log                                                                       | [1MM-LOG-02](../1MM-LOG-02-UI-UPDATES.md)                                                                                                                                                     | Whoever raises or resolves a `UI` gap                     | Section 9                                                                                     |
| Technical Reference extensions log                                                   | [1MM-LOG-03](../1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md)                                                                                                                                 | Engineering lead                                          | Section 8                                                                                     |
| Open decisions and repository follow-ups                                             | [1MM-LOG-04](../1MM-LOG-04-OPEN-DECISIONS-AND-FOLLOW-UPS.md)                                                                                                                                  | Engineering lead                                          | When a `DECISION` or `REPO` gap is raised, answered or closed                                 |
| Index                                                                                | [1MM-INDEX](../1MM-INDEX.md)                                                                                                                                                                  | Whoever adds, renames or retires a document               | In the same pull request as the document                                                      |
| Agent entry point                                                                    | [AGENTS.md](../../AGENTS.md) (root); `CLAUDE.md` only imports it                                                                                                                              | Engineering lead                                          | When a non-negotiable rule, a command or the reading order changes                            |
| Code, migrations, contracts, seeds, catalogues                                       | `apps/`, `packages/`                                                                                                                                                                          | Any contributor by pull request                           | Last, after every record above it agrees                                                      |

The private spec pack is never copied into this repository: the repository is public and the pack
holds business material (`docs/USAGE.md` §11). Documents here derive from it, restructure it and
cite it with bracket codes such as `[TR §8.2]`. They never link to it and never paste passages
from it.

## 3. Hierarchy and precedence

When two records disagree, the higher one wins and the lower one is corrected in the same pull
request, or a gap is raised if the correction is not yours to make.

| Rank | Record                                     | Notes                                                                                                                                                                                                                                                                                                                                                                       |
| ---- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Owner decisions `[OD-nn]`                  | Newest decision wins over an older one [PACK].                                                                                                                                                                                                                                                                                                                              |
| 2    | Technical Reference and its extensions log | The Technical Reference with schema v3.4, plus every extension recorded in [1MM-LOG-03](../1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md). An extension is part of the Technical Reference from the moment it is logged. The admin, website, user-flow and brand masters sit under it, in the source order the [master plan](../execution/1MM-EXE-00-MASTER-PLAN.md) states. |
| 3    | ADRs                                       | Decide how something is built where the Technical Reference leaves a choice, and record the engineering consequence of product rules. An ADR cannot contradict ranks 1 or 2; if it needs to, that is a `TR` or `DECISION` gap first.                                                                                                                                        |
| 4    | Standards, database documents, resources   | Rules that apply to every module.                                                                                                                                                                                                                                                                                                                                           |
| 5    | Module plans (under the master plan)       | What is built, in which order, with which data.                                                                                                                                                                                                                                                                                                                             |
| 6    | Code                                       | Code never settles a disagreement. Code that differs from a higher record is a defect, or the higher record is changed first through its own procedure.                                                                                                                                                                                                                     |

Two rules follow:

- **Change flows downwards only.** Decide at the highest rank the change touches, write it there,
  then update each lower rank in order. Never change code first and document afterwards.
- **A lower record never restates a higher one in different words.** It cites it. If you find a
  restatement that has drifted, fix the lower record and note it in that record's change log.

## 4. Read before work

Every task starts with [AGENTS.md](../../AGENTS.md), the task's module plan, and the newest
entries of [1MM-LOG-01](../1MM-LOG-01-PROGRESS.md) for that module. Three standards are
mandatory on every task, for agents and engineers alike, and `AGENTS.md` names them: this
document, [1MM-STD-06](1MM-STD-06-API-FIRST.md) (API first) and
[1MM-STD-04](1MM-STD-04-BRAND-GUIDE.md) (brand guide). Then, by kind of task:

| Kind of task (task id kind)                            | Read in full before starting                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Any task                                               | The module plan (`docs/execution/1MM-EXE-MOD-nn-…`): §2 scope, §3 data first, §8 work breakdown, §12 gaps; [1MM-EXE-00](../execution/1MM-EXE-00-MASTER-PLAN.md) for order and dependencies; open ADRs in [the ADR index](../adrs/1MM-ADR-0000-INDEX.md) that name the module                                                                    |
| API endpoint (`API`)                                   | [1MM-STD-06](1MM-STD-06-API-FIRST.md), [1MM-STD-13](1MM-STD-13-ERROR-CODES.md), [1MM-STD-14](1MM-STD-14-CODING-CONVENTIONS.md), [1MM-STD-16](1MM-STD-16-DEFENSIVE-PROGRAMMING.md), [1MM-STD-15](1MM-STD-15-DATA-STRUCTURES-AND-MODELS.md), [1MM-STD-01](1MM-STD-01-TESTING-STRATEGY.md); module plan §4                                         |
| Database change (`DB`)                                 | [1MM-DB-01](../database/1MM-DB-01-SCHEMAS.md), [1MM-DB-02](../database/1MM-DB-02-MIGRATIONS.md), [1MM-DB-03](../database/1MM-DB-03-SQL-STRUCTURE.md), [1MM-DB-04](../database/1MM-DB-04-INDEXING.md), [1MM-DB-05](../database/1MM-DB-05-SECURITY.md), [1MM-DB-06](../database/1MM-DB-06-DATA-PROTECTION.md); `packages/db/migrations/README.md` |
| Worker job (`WRK`)                                     | Module plan §4.2; [1MM-STD-16](1MM-STD-16-DEFENSIVE-PROGRAMMING.md), [1MM-STD-12](1MM-STD-12-DATA-HANDLING.md), [1MM-STD-01](1MM-STD-01-TESTING-STRATEGY.md)                                                                                                                                                                                    |
| Admin page (`ADM`)                                     | Module plan §5; [1MM-STD-20](1MM-STD-20-DESIGN-SYSTEM.md), [1MM-STD-04](1MM-STD-04-BRAND-GUIDE.md), [1MM-STD-17](1MM-STD-17-LANGUAGE-CONFIGURATION.md), [1MM-STD-12](1MM-STD-12-DATA-HANDLING.md), [1MM-STD-01](1MM-STD-01-TESTING-STRATEGY.md)                                                                                                 |
| Website or billing web app (`WEB`)                     | Module plan §6; the same four as an admin page                                                                                                                                                                                                                                                                                                  |
| Mobile screen (`MOB`)                                  | Module plan §7; [1MM-STD-03](1MM-STD-03-MOBILE-BUILD-STRATEGY.md), [1MM-STD-20](1MM-STD-20-DESIGN-SYSTEM.md), [1MM-STD-04](1MM-STD-04-BRAND-GUIDE.md), [1MM-STD-17](1MM-STD-17-LANGUAGE-CONFIGURATION.md), [1MM-STD-12](1MM-STD-12-DATA-HANDLING.md), [1MM-STD-18](1MM-STD-18-NOTIFICATIONS.md), [1MM-STD-19](1MM-STD-19-OTA-UPDATES.md)        |
| Copy, labels, option lists, config values              | Module plan §3.4; [1MM-STD-17](1MM-STD-17-LANGUAGE-CONFIGURATION.md); [MOD-02](../execution/1MM-EXE-MOD-02-PLATFORM-CONFIG-AND-CATALOGUES.md)                                                                                                                                                                                                   |
| Authentication, payments, admin access, personal data  | [1MM-STD-11](1MM-STD-11-SECURITY-AND-COMPLIANCE.md), [1MM-STD-12](1MM-STD-12-DATA-HANDLING.md), [1MM-DB-05](../database/1MM-DB-05-SECURITY.md), [1MM-DB-06](../database/1MM-DB-06-DATA-PROTECTION.md)                                                                                                                                           |
| Tests and gates (`QA`)                                 | [1MM-STD-01](1MM-STD-01-TESTING-STRATEGY.md); module plan §9 and §10                                                                                                                                                                                                                                                                            |
| Provisioning, deploys, CI, repository settings (`OPS`) | [1MM-STD-08](1MM-STD-08-CONTRIBUTING.md), [1MM-STD-10](1MM-STD-10-COMMITS-AND-LOCAL-CI.md), [1MM-RES-01](../resources/1MM-RES-01-OPEN-SOURCE-AND-PLATFORMS.md), `docs/USAGE.md` §8 and §9                                                                                                                                                       |
| A new dependency                                       | [1MM-STD-08](1MM-STD-08-CONTRIBUTING.md) §12; [1MM-RES-01](../resources/1MM-RES-01-OPEN-SOURCE-AND-PLATFORMS.md)                                                                                                                                                                                                                                |
| Documentation only                                     | This document; [1MM-STD-05](1MM-STD-05-README-STANDARD.md); [1MM-STD-09](1MM-STD-09-FORMATTING.md); [1MM-INDEX](../1MM-INDEX.md)                                                                                                                                                                                                                |
| Any commit                                             | [1MM-STD-10](1MM-STD-10-COMMITS-AND-LOCAL-CI.md); [1MM-STD-09](1MM-STD-09-FORMATTING.md)                                                                                                                                                                                                                                                        |

An agent that cannot open a document on this list stops and says so. It does not proceed from
memory of an earlier session.

## 5. The operating loop

Every task, of every size, runs this loop. The task has a task id from its module plan
(`MOD-07-API-03`, `MOD-07-ADM-01`, `MOD-10-WEB-01`, `MOD-07-MOB-02`, `MOD-07-WRK-01`,
`MOD-07-DB-01`, `MOD-07-QA-01`, `MOD-00-OPS-01`). Work with no task id is not started: add the
task to the module plan first.

1. **Read the module plan.** Confirm the task exists, its dependencies are done
   ([1MM-LOG-01](../1MM-LOG-01-PROGRESS.md) status board and entries), and no open gap in §12
   blocks it.
2. **Check the API gate.** If the task is an admin, web or mobile task, the module's API gate
   (module plan §8) must be recorded as passed in the progress log. If it is not, the task does
   not start. A stub or a mocked endpoint in a client is never a substitute
   ([1MM-STD-06](1MM-STD-06-API-FIRST.md)).
3. **Data-first review.** Re-read §3 of the module plan against the code as it is today: every
   input, label, limit and list in scope has a column, a config key, an i18n key, a catalogue or
   an entitlement, an endpoint that serves it, and an admin control that manages it. Grep the
   schema (`packages/db/migrations/`) to confirm each object exists. Anything missing is a gap.
4. **Record what is new before building it.** If the task needs something no source has, raise
   the gap (section 7). If it settles a choice of approach, write the ADR (section 6). Dependent
   work waits until the extension is in [1MM-LOG-03](../1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md)
   or the ADR is accepted.
5. **Implement in order:** API (contracts, migration, use case, route, worker job) → admin → web →
   mobile. Within one module task, touch only the layer the task id names.
6. **Test.** Write the tests the module plan §9 names for the task: expected, unexpected, and
   variables changing ([1MM-STD-01](1MM-STD-01-TESTING-STRATEGY.md)). Run the local checks
   ([1MM-STD-10](1MM-STD-10-COMMITS-AND-LOCAL-CI.md)). Nothing is pushed with a red local check.
7. **Update the progress log.** Add an entry to [1MM-LOG-01](../1MM-LOG-01-PROGRESS.md) in the
   format of [1MM-STD-07](1MM-STD-07-PROGRESS-UPDATES.md). Update the status board if a state
   changed.
8. **Update the module plan's change log** if the task changed scope, order, a task's definition
   of done, or a gap's status. A task that was built exactly as planned adds no change-log row.
9. **Open one pull request** for the task ([1MM-STD-08](1MM-STD-08-CONTRIBUTING.md)). The records
   from steps 4, 7 and 8 travel in the same pull request as the code they describe.

## 6. Architecture decision records

### 6.1 When an ADR is required

Write an ADR when a change does any of the following:

| Trigger                                                                                                          | Example                                                              |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Chooses between approaches the Technical Reference leaves open                                                   | How the realtime gateway fans out across instances                   |
| Departs from the letter of the Technical Reference for an engineering reason, without changing product behaviour | pnpm workspaces in place of Bun workspaces, with Bun as the runtime  |
| Adds, replaces or removes a runtime dependency, a vendor SDK, a framework or a build tool                        | A new state library in `apps/mobile`                                 |
| Changes a cross-cutting contract: error shape, pagination, idempotency, auth, RLS context, job framework         | A new problem type family                                            |
| Changes a module boundary, a package's public surface, or the layering rules                                     | Moving a use case between API modules                                |
| Changes the security or data-protection posture                                                                  | A new database role, a new place personal data is stored             |
| Records a product rule or owner decision that carries engineering weight                                         | Three plans and the Black Badge as a one-off verification (ADR-0040) |
| Reverses or replaces an earlier ADR                                                                              | Always a new ADR; the old one is marked superseded                   |

ADRs record technical decisions and also product rules that carry engineering weight: an owner
decision that shapes the schema, the API or the build is restated as an ADR that cites it, so the
engineering consequence has one record in the repository (ADR-0040 to ADR-0072 do exactly this).
Such an ADR never changes the owner decision; it records what the decision means for the code.

An ADR is **not** the way to make or change a product rule, a price, a limit, a screen or a schema
object: those are decided by owner decisions, Technical Reference extensions or `UI` gaps first.
An ADR is also not needed for a choice that is local to one file and reversible without anyone
noticing.

### 6.2 Numbering and life

1. Copy [1MM-ADR-0000-TEMPLATE](../adrs/1MM-ADR-0000-TEMPLATE.md) to
   `docs/adrs/1MM-ADR-<NNNN>-<UPPER-KEBAB-TITLE>.md`.
2. `<NNNN>` is the next unused four-digit number in
   [1MM-ADR-0000-INDEX](../adrs/1MM-ADR-0000-INDEX.md). Numbers are never reused and never
   renumbered. `0000` is reserved for the index and the template.
3. If two open pull requests take the same number, the one merged second takes the next free
   number before it merges.
4. Add the row to the index in the same pull request.
5. The ADR is merged as proposed or accepted, as the template defines. Only a code owner's
   approving review makes it accepted.
6. An accepted ADR is not rewritten. To change the decision, write a new ADR that names the one
   it supersedes, and change only the status line of the old one.
7. Code and module plans that rely on the ADR cite it by number.

## 7. Raising a gap

A gap is anything the plan needs that is missing, unclear or contradictory in the sources. It is
recorded, never patched around.

1. **Verify it.** Grep the schema and check the Technical Reference citation in the module plan.
   Check [1MM-LOG-03](../1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md): the gap may already be
   resolved. Do not raise a style preference.
2. **Record it** as a row in the "Gaps raised" section of the document that needs it (module
   plan §12, or the last section before the change log in a standard):

   | Gap id | Type | Where found | What is missing or conflicting | Proposed resolution | Blocks |
   | ------ | ---- | ----------- | ------------------------------ | ------------------- | ------ |

3. **Gap id:** `GAP-<DOC>-<NN>`, where `<DOC>` is the document's short code without hyphens
   (`GAP-MOD07-01`, `GAP-STD13-01`, `GAP-DB04-01`) and `<NN>` is the next number in that document.
4. **Type**, exactly one of:

   | Type       | Meaning                                                    | The proposed resolution must give                       | Resolved by                                                                                    |
   | ---------- | ---------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
   | `TR`       | The Technical Reference needs an addition or a correction  | The section and the exact wording or table row          | An extension (section 8)                                                                       |
   | `SCHEMA`   | A table, column, index, enum, seed or config key is needed | The exact DDL or seed                                   | An extension, then a new numbered migration ([1MM-DB-02](../database/1MM-DB-02-MIGRATIONS.md)) |
   | `UI`       | A design board must change                                 | The screen id or admin / website module and the element | The design master, logged in [1MM-LOG-02](../1MM-LOG-02-UI-UPDATES.md)                         |
   | `DECISION` | The owner must decide                                      | The options and a recommendation                        | A new owner decision                                                                           |
   | `REPO`     | The scaffold or repository configuration must change       | The file and the change                                 | A pull request reviewed by a code owner                                                        |

5. **Blocks:** name the task ids the gap blocks. Only those tasks stop. Everything else in the
   module continues.
6. **Report it:** list the gap under "Gaps raised or closed" in the session's progress-log entry.
7. **Do not resolve it yourself** by editing the Technical Reference mirror, a migration, the data
   dictionary or a design. The engineering lead collects gaps into the right master. A `REPO` gap
   may be resolved by its raiser in its own pull request.
8. **Closing:** when the resolution lands, the gap row gains the resolution reference (extension
   id, migration file, ADR number, owner decision number or pull request), the document's change
   log gains a row, and the progress log records the gap as closed. Gap rows are never deleted.

## 8. The Technical Reference extensions log

The Technical Reference master lives in the private spec pack. This repository cannot show it, so
[1MM-LOG-03](../1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md) is its public trail: one row for
every addition or correction made after the baseline the documents were written from.

The order is fixed and is never shortened:

1. A `TR` or `SCHEMA` gap is raised and verified (section 7).
2. The engineering lead (with the owner where the gap is also a `DECISION`) records the extension
   in the Technical Reference master, in the pack. A schema extension also updates the pack's
   schema and data dictionary.
3. The extension is mirrored as a row in [1MM-LOG-03](../1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md),
   in the form that log defines, carrying the gap id it resolves. The row states the fact that
   was added (endpoint, table, column, key, rule) without pasting pack text.
4. Only then do dependent documents change (module plan, standards, `packages/db/SCHEMA_DATA_DICTIONARY.md`),
   and only then does code change (migration, contract, implementation).

Rules:

- A pull request whose code depends on something that is in neither a cited source nor the
  extensions log is rejected.
- An agent without access to the pack cannot perform step 2. It raises the gap, marks the
  blocked tasks, and continues with unblocked work.
- The log is append-only. A wrong extension is corrected by a new row that names the row it
  corrects.
- Citations to an extension use the id the log gives it, next to the Technical Reference section
  it extends.

## 9. The UI updates log

The design boards are masters outside this repository. When the build needs a board to change,
or a board changes for any other reason, the change is recorded in
[1MM-LOG-02](../1MM-LOG-02-UI-UPDATES.md).

1. Raise a `UI` gap naming the screen id (`D7`, `B9`), admin module (`A12`) or website module
   (`W22`) exactly as the sources write it, and the element.
2. The gap is mirrored as a row in the log, in the form the log defines. A row carries at least:
   the date, the gap id, the screen or module id, the element, what changes and why, the status,
   and the pull request that implements it once there is one.
3. The client task that depends on the change waits until the row is marked agreed by the design
   owner. The API side is not blocked unless the data changes, in which case a `TR` or `SCHEMA`
   gap is raised as well.
4. When the client implementation merges, the row gains the pull request number. A UI change
   implemented with no row in the log is rejected at review.

A change that only alters a value an admin can already edit (copy in the i18n catalogue, a
config value, a CMS block) is not a UI update: it is made in the admin console.

## 10. Memory between sessions

An agent keeps nothing reliably between sessions, and a human forgets. The durable memory is the
repository.

| What must survive the session                                  | Where it is written                                                                                                        |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| What was done, with evidence; what is half-done; the next step | [1MM-LOG-01](../1MM-LOG-01-PROGRESS.md) entry (the "Next step" field is the hand-off)                                      |
| Which state each module is in                                  | Status board at the top of [1MM-LOG-01](../1MM-LOG-01-PROGRESS.md)                                                         |
| Why something is built the way it is                           | An ADR                                                                                                                     |
| Something the sources lack                                     | A gap row; then [1MM-LOG-03](../1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md) or [1MM-LOG-02](../1MM-LOG-02-UI-UPDATES.md) |
| A change to scope, order or a task                             | The module plan and its change log                                                                                         |
| A rule every task must follow                                  | The standard that owns the subject; a one-line pointer in [AGENTS.md](../../AGENTS.md) only if it is non-negotiable        |
| Work in flight                                                 | The pull request: its description names the task id and what is left                                                       |

Rules:

- [AGENTS.md](../../AGENTS.md) is the entry point that coding agents load at the start of a
  session. It stays short and points into `docs/`. It is not a place to accumulate notes.
  `CLAUDE.md` contains only the import of `AGENTS.md`, so there is one entry point, not two.
- A tool's private memory (an agent's memory folder, a chat history, a personal notes file) is a
  convenience and never a source. Anything in it that another contributor would need is written
  to the repository in the same session. It never holds secrets or content from the private pack.
- No scratch files, drafts, summaries or "notes to self" are committed. If a note is worth
  keeping, it belongs in one of the records above.
- Uncommitted work is not memory. A session that ends with work in the working tree either
  commits it to its branch and pushes, or records in the progress log exactly what is uncommitted
  and where.

## 11. Several agents at once

The owner has capped concurrency at **five agents** working on the repository at the same time.
The cap includes sub-agents: an agent that starts a sub-agent uses one of the five places.

| Rule                         | Detail                                                                                                                                                                                                                              |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One task, one owner          | A task id is worked by one agent or engineer at a time. The owner is whoever the newest progress-log entry or open pull request for that task names.                                                                                |
| One writer per file          | While a task is open, the files it creates or edits belong to it. Another agent that needs a change in such a file asks for it through the owning pull request or waits for the merge.                                              |
| No overriding                | Never revert, rewrite, reformat or "tidy" another contributor's uncommitted or unmerged work. Never force-push a branch you did not create. Never resolve a conflict by discarding the other side without reading it.               |
| One module per pull request  | A pull request carries one module task, named by its task id in the title ([1MM-STD-08](1MM-STD-08-CONTRIBUTING.md)). Parallel agents therefore work in different modules, or in different layers of one module after its API gate. |
| Own branch, own working copy | Each agent works on its own branch from `develop`. **Recommendation:** one git worktree per agent, so no two agents share a working tree or an index.                                                                               |
| The order still holds        | Parallel work never crosses the API gate: no agent starts a module's client tasks while another is still building that module's API.                                                                                                |
| Shared files                 | See the table below.                                                                                                                                                                                                                |

Files that several tasks touch, and how collisions are avoided:

| Shared file                                                                  | Rule                                                                                                                                             |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/db/migrations/`                                                    | Take the next unused number when the pull request opens. If another migration merges first, renumber before merging. Never edit an applied file. |
| `packages/contracts/openapi/`, `packages/contracts/src/generated/`           | Generated. Never hand-edit or hand-merge: rebase on `develop`, run `pnpm contracts:generate`, commit the result.                                 |
| `pnpm-lock.yaml`                                                             | Never hand-merge: rebase, run `pnpm install`, commit the result. Dependency changes follow [1MM-STD-08](1MM-STD-08-CONTRIBUTING.md) §12.         |
| `apps/api/src/surfaces/index.ts`, `apps/worker/src/jobs/index.ts`            | Registration lists: add your line, keep the existing order, do not reorder others.                                                               |
| `packages/i18n` catalogues, seeds                                            | Add keys under your module's namespace only. Do not rename another module's key.                                                                 |
| [1MM-LOG-01](../1MM-LOG-01-PROGRESS.md) and the other logs                   | Append your own entry at the top of the entries. Never edit another contributor's entry. On conflict keep both entries, newest first.            |
| [1MM-INDEX](../1MM-INDEX.md), [the ADR index](../adrs/1MM-ADR-0000-INDEX.md) | Add your row; on conflict keep both rows.                                                                                                        |

**Hand-offs.** A task changes hands only through the record: the outgoing contributor pushes the
branch, and writes a progress-log entry whose "Next step" names the task id, the branch, the
pull request if there is one, what is done, what is left, and anything that surprised them. The
incoming contributor reads that entry and the pull request before touching the branch. A hand-off
made in a chat alone does not count.

## 12. Nothing orphaned

An orphan is anything that exists with nothing pointing to it and nobody responsible for it. The
checks below are run by the author before a pull request, and by the reviewer.

| Thing                         | Must trace to                                                                                               | How to check                                                                                         |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Every document under `docs/`  | A link from [1MM-INDEX](../1MM-INDEX.md)                                                                    | List `docs/**/*.md` and grep each file name in the index                                             |
| Every relative link           | A file that exists, by the exact name in the index                                                          | Follow every link changed in the pull request                                                        |
| Every task id                 | A row in §8 of exactly one module plan                                                                      | Grep the id in `docs/execution/`                                                                     |
| Every pull request and commit | A task id                                                                                                   | Pull request title; [1MM-STD-10](1MM-STD-10-COMMITS-AND-LOCAL-CI.md)                                 |
| Every decision                | An owner decision `[OD-nn]`, a Technical Reference citation or extension, or an ADR                         | A "we decided" in a document or a review with no reference is turned into an ADR or a `DECISION` gap |
| Every endpoint                | A route definition in `packages/contracts`, a row in a module plan §4.1, and a source citation or extension | Grep the path in `docs/execution/`                                                                   |
| Every table, column and enum  | A migration, the data dictionary, and a module plan §3.1                                                    | Grep the name in `packages/db/` and `docs/execution/`                                                |
| Every config key              | A seed, a row in a module plan §3.4 naming the owning module, and an admin control that edits it            | Grep the key in `docs/execution/` and the seeds                                                      |
| Every i18n key                | A catalogue entry in every shipped locale, an owning module namespace, and at least one use                 | [1MM-STD-17](1MM-STD-17-LANGUAGE-CONFIGURATION.md)                                                   |
| Every worker job              | A name from the job catalogue [TR §11] or an extension, and a row in a module plan §4.2                     | Grep the job name in `docs/execution/`                                                               |
| Every screen and module id    | Exactly one owning module in the [master plan](../execution/1MM-EXE-00-MASTER-PLAN.md)'s coverage matrix    | The coverage matrix                                                                                  |
| Every gap                     | An open row with an owner, or a closed row with its resolution reference                                    | Grep `GAP-` across `docs/`                                                                           |
| Every dependency              | A use in the workspace that declares it, and a reason in the pull request that added it                     | [1MM-STD-08](1MM-STD-08-CONTRIBUTING.md) §12                                                         |
| Every feature flag            | An owning module, a removal condition, and an admin control                                                 | Module plan §2 and §3.4                                                                              |

When something is removed, its references are removed or redirected in the same pull request: a
retired document is taken out of the index and the documents that linked to it are updated.

## 13. Human in the loop

Agents prepare; humans decide at these points. None of them can be delegated to an agent.

| Point                              | Who                                                                            | What the agent does instead                                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Code-owner review                  | A code owner who is not the author (`.github/CODEOWNERS`, `.github/rulesets/`) | Opens the pull request with the evidence the reviewer needs; answers review comments                                             |
| Merge into `develop`               | A code owner                                                                   | Keeps the branch up to date and the checks green; never merges its own work                                                      |
| Merge into `production`            | A code owner, by an approved merge commit from `develop`                       | Nothing. Agents do not open, approve or merge release pull requests unless a code owner asks for the pull request to be prepared |
| Owner decisions                    | The owner                                                                      | Raises a `DECISION` gap with options and a recommendation                                                                        |
| Technical Reference master changes | Engineering lead, in the pack                                                  | Raises a `TR` or `SCHEMA` gap                                                                                                    |
| Accepting an ADR                   | A code owner                                                                   | Writes the ADR as proposed                                                                                                       |
| Secrets, accounts, keys            | The owner or engineering lead                                                  | Names the variable from `.env.example` that is needed and stops; never asks for the value in a chat or writes one to a file      |
| Hosted environments and production | Engineering lead                                                               | Prepares configuration as code under review; never runs a migration, a deploy or a data change against a hosted environment      |
| Repository settings and rulesets   | The repository owner                                                           | Proposes the change to `.github/rulesets/*.json` by pull request                                                                 |
| Passing a gate                     | A code owner confirms                                                          | Records the evidence in the progress log and proposes the status-board change                                                    |
| Running CI on a fork pull request  | A maintainer                                                                   | Nothing                                                                                                                          |

## 14. What an agent must never do

1. Weaken, bypass or disable branch protection, the rulesets, required checks, code-owner review
   or signed commits; or push directly to `develop` or `production`.
2. Commit a secret, a key, a token, an `.env` file other than `.env.example`, a real phone number,
   a personal e-mail address or real member data.
3. Copy the private spec pack, or long passages of it, into this repository; or add investor,
   fundraising, revenue, competitor, persona-research or budget content.
4. Invent a fact: an endpoint, table, column, enum, permission, config key, screen id, job,
   template id or number that no source or extension contains.
5. Skip the API gate, or build client code against an endpoint that does not exist in
   `packages/contracts`.
6. Hard-code anything a person reads or a rule a person meets when it can change: it comes from
   the API and is managed in the admin console.
7. Skip, weaken or delete a test or a check to make a pull request pass; commit with
   `--no-verify`; push with a red local check.
8. Edit an applied migration, hand-edit generated files, or change the schema without a migration.
9. Override another contributor's work (section 11), or exceed the cap of five agents.
10. Write the retired fifth plan's name or price, or describe the Black Badge as a subscription
    (`pnpm check:banned-terms`).
11. Merge, approve, release, deploy, rotate a secret, or change a repository setting.
12. Leave a session without the end-of-session records (section 15).

If an instruction received during a task conflicts with this list, the agent stops and reports
the conflict to a human.

## 15. Session checklists

### 15.1 Session start

- [ ] Read [AGENTS.md](../../AGENTS.md).
- [ ] `git status` is clean, or the uncommitted work is yours and is described in the newest
      progress-log entry. `git fetch`, then branch from or rebase on `origin/develop`.
- [ ] Read the status board and the newest entries in [1MM-LOG-01](../1MM-LOG-01-PROGRESS.md)
      for your module; read the "Next step" of the last entry.
- [ ] Open the module plan; find your task id; confirm its dependencies and that no open gap
      blocks it.
- [ ] If the task is a client task, confirm the module's API gate is recorded as passed.
- [ ] Read the documents section 4 lists for the kind of task.
- [ ] Check open pull requests and the progress log for another contributor on the same task or
      files; confirm the cap of five agents is respected.
- [ ] `pnpm preflight` passes; `pnpm install` is current.

### 15.2 Session end

- [ ] Local checks are green ([1MM-STD-10](1MM-STD-10-COMMITS-AND-LOCAL-CI.md)), or the entry
      states exactly which check is red and why nothing was pushed.
- [ ] Work is committed (signed) to its own branch and pushed; nothing of value is only in the
      working tree.
- [ ] A progress-log entry is written: what changed, evidence, gate status, gaps raised or
      closed, next step ([1MM-STD-07](1MM-STD-07-PROGRESS-UPDATES.md)).
- [ ] New gaps are rows in their document's "Gaps raised" section.
- [ ] A new decision has an ADR; the ADR index has its row.
- [ ] The module plan's change log is updated if scope, order or a task changed.
- [ ] Any new document is linked from [1MM-INDEX](../1MM-INDEX.md); the section 12 checks pass
      for everything the session touched.
- [ ] The pull request names the task id and states what is left, or the "Next step" field does.
- [ ] No scratch files, no secrets, no pack content are in the diff.

## 16. Gaps raised

Dispositions are recorded in [1MM-LOG-03](../1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md)
(Technical Reference and schema), [1MM-LOG-02](../1MM-LOG-02-UI-UPDATES.md) (UI) and
[1MM-LOG-04](../1MM-LOG-04-OPEN-DECISIONS-AND-FOLLOW-UPS.md) (owner decisions and repository
follow-ups).

| Gap id       | Type | Where found                                                | What is missing or conflicting                                                                                                                                                                                                                          | Proposed resolution                                                                                                                                                                                                                                     | Blocks                                  |
| ------------ | ---- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| GAP-STD02-01 | TR   | [TR §17.3], [TR §18], [TR §19]                             | The Technical Reference defines the engineering workflow and lists decisions, but says nothing about how it is extended after the baseline, nor about ADRs. The extension rule in section 8 and the ADR rule in section 6 have no anchor in the master. | Add to [TR §17.3] one line: "Additions to this reference are recorded here first and mirrored in the repository's extensions log before dependent documents or code change; engineering choices it leaves open are recorded as ADRs in the repository." | Nothing                                 |
| GAP-STD02-02 | REPO | `scripts/check-repo-rules.mjs`, `.github/workflows/ci.yml` | The "nothing orphaned" checks in section 12 are manual. `pnpm check:repo` checks workflows and workspaces only; nothing in CI checks that every file under `docs/` is linked from `docs/1MM-INDEX.md` or that relative links resolve.                   | **Recommendation:** add a dependency-free `scripts/check-docs.mjs` (every `docs/**/*.md` named in the index; every relative Markdown link resolves; every `GAP-` id unique), a root script `check:docs`, and a step in the `verify` job.                | Nothing; until then the check is manual |

## Change log

| Version | Date        | Change            |
| ------- | ----------- | ----------------- |
| v1.0    | 24 Nov 2026 | Approved baseline |
