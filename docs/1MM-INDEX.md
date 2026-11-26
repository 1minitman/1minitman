# 1MM-INDEX · Documentation map

|              |                                                                   |
| ------------ | ----------------------------------------------------------------- |
| **Document** | 1MM-INDEX                                                         |
| **Status**   | Approved baseline · v1.0 · 24 Nov 2026                            |
| **Audience** | Engineers and coding agents                                       |
| **Owner**    | Engineering lead (code owners)                                    |
| **Sources**  | Every document under `docs/`                                      |
| **Related**  | [README](../README.md), [AGENTS](../AGENTS.md), [USAGE](USAGE.md) |

This is the map of every document in the repository. Start here when you need to find a rule, a plan or a decision. Every document must be linked from this page: a document that is not listed here is an orphan and is either added or deleted.

## Reading order

The engineer leading the build starts with [1MM-PLANNER](1MM-PLANNER.md): the decisions to make, the
files to read first and the first tasks to give to agents.

1. [README](../README.md) and [USAGE](USAGE.md): what the project is and how to run it.
2. [AGENTS](../AGENTS.md) and [1MM-STD-02](standards/1MM-STD-02-AGENTIC-OPERATIONS.md): how work is done and recorded.
3. [1MM-STD-06](standards/1MM-STD-06-API-FIRST.md): the API-first rule every task follows.
4. [1MM-EXE-00](execution/1MM-EXE-00-MASTER-PLAN.md): the master execution plan, then the plan of the module you are working on.
5. The standards, database documents and ADRs your task touches.
6. [1MM-LOG-01](1MM-LOG-01-PROGRESS.md): where the build stands today.

## Naming

Every derived document is named `1MM-<SERIES>-<NN>-<UPPER-KEBAB-TITLE>.md`.

| Series | Folder            | What it holds                                               |
| ------ | ----------------- | ----------------------------------------------------------- |
| `EXE`  | `docs/execution/` | The execution plan: the master plan and one plan per module |
| `STD`  | `docs/standards/` | Standards and reference documents                           |
| `DB`   | `docs/database/`  | Database design                                             |
| `RES`  | `docs/resources/` | Helper resources: open-source platforms and libraries       |
| `ADR`  | `docs/adrs/`      | Architecture decision records                               |
| `LOG`  | `docs/`           | Running logs                                                |

## Execution plan (`docs/execution/`)

| Document                                                                        | Title                                               | Lines |
| ------------------------------------------------------------------------------- | --------------------------------------------------- | ----- |
| [1MM-EXE-00](execution/1MM-EXE-00-MASTER-PLAN.md)                               | Master execution plan                               | 974   |
| [1MM-EXE-MOD-00](execution/1MM-EXE-MOD-00-FOUNDATIONS.md)                       | Foundations and platform runtime                    | 543   |
| [1MM-EXE-MOD-01](execution/1MM-EXE-MOD-01-ADMIN-ACCESS-AND-GOVERNANCE.md)       | Admin access and governance                         | 601   |
| [1MM-EXE-MOD-02](execution/1MM-EXE-MOD-02-PLATFORM-CONFIG-AND-CATALOGUES.md)    | Platform configuration, catalogues and localisation | 515   |
| [1MM-EXE-MOD-03](execution/1MM-EXE-MOD-03-MEMBER-IDENTITY-AND-AUTH.md)          | Member identity and authentication                  | 546   |
| [1MM-EXE-MOD-04](execution/1MM-EXE-MOD-04-PROFILE-MEDIA-AND-PROMPTS.md)         | Profile, media and prompts                          | 493   |
| [1MM-EXE-MOD-05](execution/1MM-EXE-MOD-05-MEMBER-ADMINISTRATION.md)             | Member administration                               | 472   |
| [1MM-EXE-MOD-06](execution/1MM-EXE-MOD-06-BLACK-BADGE-VERIFICATION.md)          | Black Badge verification                            | 491   |
| [1MM-EXE-MOD-07](execution/1MM-EXE-MOD-07-DISCOVERY-AND-MATCHING.md)            | Discovery, reactions, matching and Spotlight        | 487   |
| [1MM-EXE-MOD-08](execution/1MM-EXE-MOD-08-INTRO-CHAT-AND-DIRECT-SPECS.md)       | 1-Minute Intro, chat, Direct Specs and calls        | 483   |
| [1MM-EXE-MOD-09](execution/1MM-EXE-MOD-09-TRUST-AND-SAFETY.md)                  | Trust and safety                                    | 466   |
| [1MM-EXE-MOD-10](execution/1MM-EXE-MOD-10-BILLING-PLANS-AND-ENTITLEMENTS.md)    | Billing, plans and entitlements                     | 522   |
| [1MM-EXE-MOD-11](execution/1MM-EXE-MOD-11-NOTIFICATIONS-AND-COMMUNICATIONS.md)  | Notifications and communications                    | 495   |
| [1MM-EXE-MOD-12](execution/1MM-EXE-MOD-12-GROUPS.md)                            | Groups                                              | 455   |
| [1MM-EXE-MOD-13](execution/1MM-EXE-MOD-13-MEETUPS-AND-PERSONAL-SAFETY.md)       | Meet-ups and personal safety                        | 527   |
| [1MM-EXE-MOD-14](execution/1MM-EXE-MOD-14-SUPPORT-AND-HELP.md)                  | Support and help                                    | 437   |
| [1MM-EXE-MOD-15](execution/1MM-EXE-MOD-15-CMS-AND-PUBLIC-WEBSITE.md)            | CMS and public website                              | 546   |
| [1MM-EXE-MOD-16](execution/1MM-EXE-MOD-16-LEGAL-PRIVACY-AND-DATA-OPERATIONS.md) | Legal, privacy and data operations                  | 524   |
| [1MM-EXE-MOD-17](execution/1MM-EXE-MOD-17-NETWORK-AND-SECURITY-OPERATIONS.md)   | Network and security operations                     | 380   |
| [1MM-EXE-MOD-18](execution/1MM-EXE-MOD-18-ANALYTICS-OVERVIEW-AND-RESEARCH.md)   | Analytics, overview and research                    | 623   |
| [1MM-EXE-MOD-19](execution/1MM-EXE-MOD-19-HARDENING-AND-LAUNCH.md)              | Hardening, end-to-end verification and launch       | 473   |

## Standards (`docs/standards/`)

| Document                                                         | Title                                                                              | Lines |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----- |
| [1MM-STD-01](standards/1MM-STD-01-TESTING-STRATEGY.md)           | Testing strategy                                                                   | 444   |
| [1MM-STD-02](standards/1MM-STD-02-AGENTIC-OPERATIONS.md)         | Agentic operations: how agents and engineers keep records and stay uniform         | 448   |
| [1MM-STD-03](standards/1MM-STD-03-MOBILE-BUILD-STRATEGY.md)      | Mobile build strategy                                                              | 459   |
| [1MM-STD-04](standards/1MM-STD-04-BRAND-GUIDE.md)                | Brand guide for engineers                                                          | 542   |
| [1MM-STD-05](standards/1MM-STD-05-README-STANDARD.md)            | README standard                                                                    | 188   |
| [1MM-STD-06](standards/1MM-STD-06-API-FIRST.md)                  | The API-first approach                                                             | 331   |
| [1MM-STD-07](standards/1MM-STD-07-PROGRESS-UPDATES.md)           | How progress is logged                                                             | 180   |
| [1MM-STD-08](standards/1MM-STD-08-CONTRIBUTING.md)               | Contributing strategy                                                              | 382   |
| [1MM-STD-09](standards/1MM-STD-09-FORMATTING.md)                 | Formatting standard                                                                | 364   |
| [1MM-STD-10](standards/1MM-STD-10-COMMITS-AND-LOCAL-CI.md)       | Commit configuration and running CI locally                                        | 417   |
| [1MM-STD-11](standards/1MM-STD-11-SECURITY-AND-COMPLIANCE.md)    | Compliance and security: predicted attacks and mitigations                         | 446   |
| [1MM-STD-12](standards/1MM-STD-12-DATA-HANDLING.md)              | Store considerations: how data is held on the client and the server                | 516   |
| [1MM-STD-13](standards/1MM-STD-13-ERROR-CODES.md)                | Error codes and error handling                                                     | 580   |
| [1MM-STD-14](standards/1MM-STD-14-CODING-CONVENTIONS.md)         | Coding conventions                                                                 | 546   |
| [1MM-STD-15](standards/1MM-STD-15-DATA-STRUCTURES-AND-MODELS.md) | Data structures and models: collection, preparation, storage, use, state over time | 762   |
| [1MM-STD-16](standards/1MM-STD-16-DEFENSIVE-PROGRAMMING.md)      | Defensive programming                                                              | 457   |
| [1MM-STD-17](standards/1MM-STD-17-LANGUAGE-CONFIGURATION.md)     | Language configuration for every UI                                                | 474   |
| [1MM-STD-18](standards/1MM-STD-18-NOTIFICATIONS.md)              | Notifications standard (mobile)                                                    | 510   |
| [1MM-STD-19](standards/1MM-STD-19-OTA-UPDATES.md)                | Over-the-air updates (mobile)                                                      | 402   |
| [1MM-STD-20](standards/1MM-STD-20-DESIGN-SYSTEM.md)              | Design system                                                                      | 413   |
| [1MM-STD-21](standards/1MM-STD-21-CLIENT-INPUT-VALIDATION.md)    | Client input validation                                                            | 243   |

## Database design (`docs/database/`)

| Document                                           | Title                           | Lines |
| -------------------------------------------------- | ------------------------------- | ----- |
| [1MM-DB-01](database/1MM-DB-01-SCHEMAS.md)         | Schemas                         | 855   |
| [1MM-DB-02](database/1MM-DB-02-MIGRATIONS.md)      | Migrations                      | 576   |
| [1MM-DB-03](database/1MM-DB-03-SQL-STRUCTURE.md)   | SQL structure                   | 635   |
| [1MM-DB-04](database/1MM-DB-04-INDEXING.md)        | Indexing                        | 692   |
| [1MM-DB-05](database/1MM-DB-05-SECURITY.md)        | Database security               | 663   |
| [1MM-DB-06](database/1MM-DB-06-DATA-PROTECTION.md) | Data protection in the database | 586   |

## Helper resources (`docs/resources/`)

| Document                                                        | Title                               | Lines |
| --------------------------------------------------------------- | ----------------------------------- | ----- |
| [1MM-RES-01](resources/1MM-RES-01-OPEN-SOURCE-AND-PLATFORMS.md) | Open-source resources and platforms | 886   |

## Architecture decision records (`docs/adrs/`)

80 records, numbered 0001 to 0080. The list with status and date is in the [ADR index](adrs/1MM-ADR-0000-INDEX.md); new records start from the [template](adrs/1MM-ADR-0000-TEMPLATE.md).

| Range        | Subject                                                                 |
| ------------ | ----------------------------------------------------------------------- |
| 0001 to 0039 | Architecture, platform, data, security and repository                   |
| 0040 to 0072 | Product rules, admin console, website and operations                    |
| 0073 to 0079 | Decisions made in this documentation set (proposed, awaiting the owner) |

## Logs (`docs/`)

| Document                                                   | What it records                                                                                                                  | Who writes it                                   |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| [1MM-LOG-01](1MM-LOG-01-PROGRESS.md)                       | Progress: the module status board and a dated entry for every working session and gate                                           | Whoever did the work, at the end of the session |
| [1MM-LOG-02](1MM-LOG-02-UI-UPDATES.md)                     | UI updates: every design board change the build needs, with the exact UI part, for hand-off to UI agents                         | Whoever finds the need                          |
| [1MM-LOG-03](1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md) | Technical Reference extensions: every addition or correction, recorded before anything depends on it, and the schema change sets | Whoever raises the extension                    |
| [1MM-LOG-04](1MM-LOG-04-OPEN-DECISIONS-AND-FOLLOW-UPS.md)  | Owner decisions still needed, and repository follow-ups                                                                          | Whoever raises the gap                          |

## Other documents

| Document                                                            | What it is                                                                                              |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [1MM-PLANNER](1MM-PLANNER.md)                                       | Where to start: decisions needed, reading order and the first stage with agents                         |
| [1MM-DEFERRED-GO-LIVE-DECISIONS](1MM-DEFERRED-GO-LIVE-DECISIONS.md) | Reminder list of what the owner still owes before go-live: deferred values, legal confirmations, spends |
| [README](../README.md)                                              | Project overview                                                                                        |
| [AGENTS](../AGENTS.md)                                              | Entry point for coding agents (`CLAUDE.md` imports it)                                                  |
| [CONTRIBUTING](../CONTRIBUTING.md)                                  | Contribution essentials                                                                                 |
| [SECURITY](../SECURITY.md)                                          | How to report a vulnerability                                                                           |
| [USAGE](USAGE.md)                                                   | How the parts fit, how to run them and where each key and account comes from                            |
| [Schema data dictionary](../packages/db/SCHEMA_DATA_DICTIONARY.md)  | Every table by domain                                                                                   |
| [Migrations README](../packages/db/migrations/README.md)            | Migration file rules                                                                                    |

## Sources that are not in this repository

The product specification (Technical Reference, admin and website specifications, user flow, brand guide, decision logs) is a private pack kept outside this public repository. Documents cite it with bracket codes such as `[TR §8.2]`, `[ADM A12]`, `[WEB W22]`, `[UF §15.12]`, `[INV B5]`, `[DD §4]` and `[OD-14]`. Additions to the Technical Reference are mirrored in [1MM-LOG-03](1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md).

## Change log

| Version | Date        | Change                                |
| ------- | ----------- | ------------------------------------- |
| v1.1    | 26 Nov 2026 | Added 1MM-DEFERRED-GO-LIVE-DECISIONS. |
| v1.0    | 24 Nov 2026 | First map of the documentation set.   |
