# 1MM-PLANNER · Where to start

|              |                                                                                                                                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Document** | 1MM-PLANNER                                                                                                                                                                                                               |
| **Status**   | Approved baseline · v1.0 · 25 Nov 2026                                                                                                                                                                                    |
| **Audience** | The engineer leading the build                                                                                                                                                                                            |
| **Related**  | [1MM-INDEX](1MM-INDEX.md), [1MM-EXE-00](execution/1MM-EXE-00-MASTER-PLAN.md), [1MM-LOG-04](1MM-LOG-04-OPEN-DECISIONS-AND-FOLLOW-UPS.md), [1MM-STD-02](standards/1MM-STD-02-AGENTIC-OPERATIONS.md), [AGENTS](../AGENTS.md) |

This page is the short route into the documentation set. Read it once, follow the steps in order,
and you will have the first agents working by the end. Everything here points to a fuller document;
nothing here replaces one.

## 1. The situation in five lines

1. The monorepo is scaffolded and runs (`pnpm dev`). No product feature is built yet.
2. The build is planned as **20 modules** (MOD-00 to MOD-19), **420 tasks**, in **44 stages**.
3. Every module is built in one order: **data review → API → admin → web → mobile**. No client
   task starts until that module's **API gate** is green.
4. The planning found **371 gaps**. Those that needed no choice are already settled in the
   Technical Reference v3.6 and in migration `0007`. The rest wait for you.
5. Your part before work starts is small: merge one pull request, answer seven decisions, hand
   one log to design.

## 2. Step by step

### Step 1 · Merge the documentation (10 minutes)

Review and merge the pull request "Execution plan, engineering standards, database design,
resources and ADRs" into `develop`. It carries this documentation, migration `0007` and a fix to
`pnpm dev`. Then, on your machine:

```bash
git checkout develop && git pull
pnpm install
pnpm dev          # starts services, applies migrations and database roles, runs every app
```

### Step 2 · Read these, in this order (about 90 minutes)

| Order | Document                                                                                  | Read                                                 | Why                                                               |
| ----- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------- |
| 1     | [AGENTS](../AGENTS.md)                                                                    | All (two pages)                                      | The rules every agent is given. You need to know what they obey.  |
| 2     | [1MM-STD-06 API first](standards/1MM-STD-06-API-FIRST.md)                                 | Sections 1 to 4                                      | The method and what the API gate is.                              |
| 3     | [1MM-EXE-00 Master plan](execution/1MM-EXE-00-MASTER-PLAN.md)                             | Sections 1, 2, 4.2, 4.4, 8, 10                       | The modules, the 44 stages, how to run lanes in parallel, gates.  |
| 4     | [1MM-LOG-04 Open decisions](1MM-LOG-04-OPEN-DECISIONS-AND-FOLLOW-UPS.md)                  | Part A table, then the entries you must answer first | What only you can decide.                                         |
| 5     | [1MM-LOG-03 Technical Reference extensions](1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md) | Section 4 (awaiting owner decision)                  | Product rules that block API gates.                               |
| 6     | [1MM-EXE-MOD-00 Foundations](execution/1MM-EXE-MOD-00-FOUNDATIONS.md)                     | Sections 2, 8, 10                                    | The first module: its tasks and its gates.                        |
| 7     | [1MM-STD-02 Agentic operations](standards/1MM-STD-02-AGENTIC-OPERATIONS.md)               | Sections 5, 11, 13, 15                               | The working loop, running several agents, where a human must act. |

Leave the other standards, the database documents and the ADRs until a task sends you to them.
Each module plan lists what to read for that module.

### Step 3 · Answer the decisions that block the start

Record each answer in its entry in [1MM-LOG-04](1MM-LOG-04-OPEN-DECISIONS-AND-FOLLOW-UPS.md) (set
the status to "Decided" with the date). Each entry gives the options and a recommended default;
accepting the default is a valid answer.

| Decision | Question in short                                                        | Recommended default                               |
| -------- | ------------------------------------------------------------------------ | ------------------------------------------------- |
| DEC-001  | What licence does this public repository carry?                          | All rights reserved for now; needs the lawyer     |
| DEC-002  | When Redis is down, do lockout rate limits refuse requests?              | Yes, refuse on lockout policies                   |
| DEC-003  | Which error-tracking set-up do the apps use?                             | Sentry, organisation created in the EU region     |
| DEC-004  | Are the proposed test coverage floors and flaky-test policy enforced?    | Yes, as written in the testing strategy           |
| DEC-005  | Do phones support landscape?                                             | Portrait only, except full-screen media and calls |
| DEC-006  | What does the admin console's "Help" link open?                          | Remove it for the first release                   |
| DEC-007  | Are over-the-air updates signed from the first public build (paid plan)? | Yes, before the first public build                |

These seven are enough to start MOD-00. Do **not** try to answer all 51 now.

### Step 4 · Line up the decisions that block later modules

Work reaches these in order. Answer each group before its module's API stage begins; the master
plan section 10 lists them in blocking order.

| Before this module | Decide                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| MOD-01 (stage 3)   | DEC-008 to DEC-010 (staff e-mail, IP-location and breached-password services, permission scope)                                      |
| MOD-02             | DEC-011 to DEC-014 (language switch, maintenance authority, console strings, French prices)                                          |
| MOD-03             | DEC-015 to DEC-017; extensions TRX-067 (when the account row is created during sign-up) and TRX-093 (how identifiers are hashed)     |
| MOD-04             | DEC-018 to DEC-020; extension TRX-068 (Premium and Gold profile steps saved before payment)                                          |
| MOD-07             | Extension TRX-071 (when a daily spec view is spent)                                                                                  |
| MOD-08             | Extensions TRX-072 (conversation slots) and TRX-073 (state machines)                                                                 |
| MOD-16             | Extension TRX-094 (what remains of an account after erasure); needs the lawyer                                                       |
| Any time           | Extension TRX-101: the config values and limits nobody has sourced. Supply them as each module asks; nothing is seeded with a guess. |

Nine decisions need the lawyer's confirmation (listed at the top of LOG-04 Part A). Send those
early: they have the longest waiting time.

### Step 5 · Hand the UI log to design

Give [1MM-LOG-02](1MM-LOG-02-UI-UPDATES.md) to the UI agents or designer. It holds 34 board
changes, each naming the exact screen and element. Ask for the 8 marked **"Blocks an API gate"**
first; the 18 marked "Blocks a client task" are needed only when that screen is built.

### Step 6 · Provision the accounts MOD-00 needs

The first task, `MOD-00-OPS-01`, needs owner accounts: Cloudflare, Neon, Upstash, Railway, AWS
(KMS and Rekognition only), Resend, Termii and Expo. [USAGE](USAGE.md) says where each key comes
from. Keep secrets out of the repository; agents never hold production secrets.

### Step 7 · Start stage 1 with agents

Stage 1 is "MOD-00 platform, with MOD-11 slice A": 20 tasks, closed by the MOD-00 API gate
(`MOD-00-QA-01`). Run **at most five agents: four build, one reviews**.

| Lane | Role               | First task                           | Then                                               |
| ---- | ------------------ | ------------------------------------ | -------------------------------------------------- |
| 1    | Infrastructure     | `MOD-00-OPS-01`                      | `MOD-00-OPS-02` to `-04`                           |
| 2    | Database and API   | `MOD-00-DB-01`                       | `MOD-00-DB-02`, then `MOD-00-API-01` onwards       |
| 3    | Gateway and worker | After lane 2's first API tasks merge | Remaining `MOD-00-API-*`, `MOD-00-WRK-01` to `-02` |
| 4    | Delivery slice     | After `MOD-00-API-08` merges         | `MOD-11-OPS-01`, `MOD-11-API-01`                   |
| 5    | Reviewer           | Reviews every pull request           | Gap triage and the progress log                    |

Give each building agent this brief, changing only the task id:

> Read `AGENTS.md`, then `docs/execution/1MM-EXE-MOD-00-FOUNDATIONS.md`. Do task `MOD-00-DB-01`
> only. Follow the task's "definition of done". One pull request, titled with the task id. If
> something you need is missing from the plan or the Technical Reference, stop and raise a gap as
> `docs/standards/1MM-STD-02-AGENTIC-OPERATIONS.md` section 7 describes; do not invent it. Finish
> by adding an entry to `docs/1MM-LOG-01-PROGRESS.md`.

Give the reviewer this brief:

> Read `AGENTS.md` and `docs/standards/1MM-STD-02-AGENTIC-OPERATIONS.md`. Review each open pull
> request against its task's definition of done, the standards it touches and the checks in
> `docs/standards/1MM-STD-10-COMMITS-AND-LOCAL-CI.md`. Report findings; do not merge.

Two rules keep the lanes from colliding: never let two agents write migrations at the same time,
and merge the database and contracts tasks of a module first.

### Step 8 · Close the gate, then repeat

1. When the stage's tasks are merged, run the gate task (`MOD-00-QA-01`). The checklist is in the
   module plan, section 8; the generic one is in the master plan, section 8.1.
2. Only when the gate is green, open stage 2 (MOD-00 clients): admin, web and mobile lanes may run
   side by side, merged in the order admin → web → mobile.
3. When every item of the module's exit gate (module plan, section 10) is ticked, update the
   status board in [1MM-LOG-01](1MM-LOG-01-PROGRESS.md) and move to the next stage in the master
   plan, section 4.2.

Every later module follows the same loop: decisions answered → API stage → API gate → client stage
→ exit gate → progress log.

## 3. What only you do

Agents write code, tests, documents and pull requests. These stay with you:

- Merging pull requests and promoting `develop` to `production`.
- Answering decisions and Technical Reference extensions that await the owner.
- Creating accounts, holding secrets, anything touching production.
- Approving a change to branch protection, code owners or the public-repository rules.
- Signing off each API gate and exit gate.

## 4. Daily routine once work is running

| When                | Do                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Start of day        | Read the newest entries in [1MM-LOG-01](1MM-LOG-01-PROGRESS.md); check which stage is open and what its gate still needs. |
| When an agent stops | It either finished (review and merge) or raised a gap (answer it, or record it in LOG-03, LOG-02 or LOG-04).              |
| Before a new module | Answer that module's decisions (step 4) and read sections 2, 8 and 10 of its plan.                                        |
| End of day          | Make sure every session left a progress entry; nothing is "done" without one.                                             |

## 5. If you are unsure

| Question                                 | Open                                                            |
| ---------------------------------------- | --------------------------------------------------------------- |
| What is built next?                      | [1MM-EXE-00](execution/1MM-EXE-00-MASTER-PLAN.md) section 4.2   |
| Who owns this screen, endpoint or table? | [1MM-EXE-00](execution/1MM-EXE-00-MASTER-PLAN.md) section 6     |
| Why was this decided?                    | [ADR index](adrs/1MM-ADR-0000-INDEX.md)                         |
| What error code or status applies?       | [1MM-STD-13](standards/1MM-STD-13-ERROR-CODES.md)               |
| How do I change the schema?              | [1MM-DB-02](database/1MM-DB-02-MIGRATIONS.md)                   |
| Should we adopt a library for this?      | [1MM-RES-01](resources/1MM-RES-01-OPEN-SOURCE-AND-PLATFORMS.md) |
| Where is everything?                     | [1MM-INDEX](1MM-INDEX.md)                                       |

## Change log

| Version | Date        | Change        |
| ------- | ----------- | ------------- |
| v1.0    | 25 Nov 2026 | First version |
