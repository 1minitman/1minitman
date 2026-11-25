# 1MM-STD-07 · How progress is logged

|              |                                                                                                                                                                                                                                                                                                                |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Document** | 1MM-STD-07                                                                                                                                                                                                                                                                                                     |
| **Status**   | Approved baseline · v1.0 · 24 Nov 2026                                                                                                                                                                                                                                                                         |
| **Audience** | Engineers and coding agents                                                                                                                                                                                                                                                                                    |
| **Owner**    | Engineering lead (code owners)                                                                                                                                                                                                                                                                                 |
| **Sources**  | [TR §17.2], [TR §17.3]; repo: `.github/workflows/ci.yml`, `.github/pull_request_template.md`                                                                                                                                                                                                                   |
| **Related**  | [1MM-LOG-01](../1MM-LOG-01-PROGRESS.md), [1MM-STD-02](1MM-STD-02-AGENTIC-OPERATIONS.md), [1MM-STD-06](1MM-STD-06-API-FIRST.md), [1MM-STD-08](1MM-STD-08-CONTRIBUTING.md), [1MM-STD-10](1MM-STD-10-COMMITS-AND-LOCAL-CI.md), [1MM-EXE-00](../execution/1MM-EXE-00-MASTER-PLAN.md), [1MM-INDEX](../1MM-INDEX.md) |

**What this document is for and when to open it.** It defines the progress log,
[docs/1MM-LOG-01-PROGRESS.md](../1MM-LOG-01-PROGRESS.md): the one place that says what has been
built, with what evidence, and what comes next. Open it before you write an entry, before you
change a module's state on the status board, and when you review a pull request that claims a
gate.

## 1. Why there is one log

Every execution part logs a summary of its updates and progress in one file. The log is how the
next engineer or agent learns where the build stands without asking anyone
([1MM-STD-02](1MM-STD-02-AGENTIC-OPERATIONS.md) §10). It has two parts:

1. **The status board**: one row per module, MOD-00 to MOD-19, showing its current state.
2. **The entries**: dated records of work, newest first.

The log records facts. Plans live in the module plans, decisions in ADRs, rules in standards.

## 2. The status board

The board sits at the top of the log. It has exactly twenty rows, in module order.

| Column     | Content                                                          |
| ---------- | ---------------------------------------------------------------- |
| Module     | Module id and short title, linked to its module plan             |
| State      | One of the states below, written exactly                         |
| Since      | Date the module entered that state                               |
| Last entry | Id of the newest entry that concerns the module                  |
| Open gaps  | Count of open gaps that block a task in the module (0 when none) |

### 2.1 States

A module moves forward through these states. The order follows the build order
API → admin → web → mobile ([1MM-STD-06](1MM-STD-06-API-FIRST.md)).

| State            | Meaning                                                                                              | Entered when                                                                        |
| ---------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Not started      | No task of the module has a merged pull request.                                                     | Default.                                                                            |
| API in progress  | Database, API or worker tasks are under way. No client task may start.                               | The first `DB`, `API`, `WRK` or `OPS` task of the module merges.                    |
| API gate passed  | Every check of the module's API gate (module plan §8) is green and recorded. Client tasks may start. | A gate entry (section 5) is merged with a code owner's approval.                    |
| Admin            | Admin tasks are under way or done; web and mobile have not all finished.                             | The first `ADM` task merges.                                                        |
| Web              | Website or billing web app tasks are under way.                                                      | The first `WEB` task merges and every `ADM` task of the module is merged.           |
| Mobile           | Mobile tasks are under way.                                                                          | The first `MOB` task merges and every `ADM` and `WEB` task of the module is merged. |
| Exit gate passed | Every item of the module's exit gate (module plan §10) is ticked and recorded.                       | A gate entry is merged with a code owner's approval.                                |

Rules for the board:

1. A module skips a client state it has no tasks for. A module with no admin, web or mobile tasks
   goes from "API gate passed" to "Exit gate passed".
2. The state shows the furthest stage reached in order. If a module's plan schedules a slice out
   of order (an early delivery slice, or a staged task such as the second stage of the admin
   shell), the state does not change for the slice: the entry records it.
3. The board never moves backwards silently. If a passed gate is found to be broken, the module
   returns to the earlier state with a correction entry (section 6) that says why.
4. The board is the only part of the log that is edited in place. Every change to a row is made
   in the same pull request as the entry that justifies it, and that entry's id goes in
   "Last entry".
5. Only a code owner's approving review turns a gate state. An agent proposes the change; it
   never treats its own proposal as passed ([1MM-STD-02](1MM-STD-02-AGENTIC-OPERATIONS.md) §13).

## 3. The entry format

Entries are level-3 headings under `## Entries`, newest first. Each entry uses this form:

```markdown
### P-0007 · 2026-12-02 · MOD-03 · OTP request and verify endpoints

| Field         | Value                                                                              |
| ------------- | ---------------------------------------------------------------------------------- |
| Date          | 2 Dec 2026                                                                         |
| Module, tasks | MOD-03 · MOD-03-API-02, MOD-03-DB-01                                               |
| Author        | Role or GitHub handle; "agent, reviewed by <handle>" for agent work                |
| What changed  | Two or three plain sentences or a short list: what now exists that did not before. |
| Evidence      | PR #nn (merged / open), commit, CI run result, test counts, local check results    |
| Gate status   | None / API gate: 6 of 9 checks green / API gate passed / Exit gate passed          |
| Gaps          | Raised: GAP-MOD03-04 (SCHEMA). Closed: GAP-MOD03-01 (extension id). Or "None".     |
| Next step     | The next task id, the branch, and anything the next person must know.              |
```

| Field         | Rule                                                                                                                                                                                                                                |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entry id      | `P-` and a four-digit number, one higher than the newest entry. Never reused. If two pull requests take the same id, the one merged second takes the next number before it merges.                                                  |
| Heading       | Entry id · ISO date · module id (or `REPO` for repository-wide work, `DOCS` for documentation-only work) · a short title.                                                                                                           |
| Date          | The date the work was done, not the date it merged.                                                                                                                                                                                 |
| Module, tasks | Task ids exactly as in the module plan §8. Work with no task id is not logged as module work: add the task to the plan first ([1MM-STD-02](1MM-STD-02-AGENTIC-OPERATIONS.md) §5).                                                   |
| Author        | A role or a GitHub handle. No personal e-mail addresses.                                                                                                                                                                            |
| What changed  | What is true now. Past tense or present tense, never future.                                                                                                                                                                        |
| Evidence      | Something a reader can check: a pull request number, a commit hash, the result of the `verify` job, test counts as the runner printed them, the local commands run and their result. "Not run" is written when a check was not run. |
| Gate status   | Which gate checks are green, by their number in the module plan, or "None" when the entry does not concern a gate.                                                                                                                  |
| Gaps          | Every gap raised or closed in the session, by id and type. A closed gap names its resolution.                                                                                                                                       |
| Next step     | One concrete step. This field is the hand-off: the next session starts from it.                                                                                                                                                     |

Keep an entry short. It summarises; the pull request holds the detail.

## 4. Who writes entries, and when

| Moment                                                   | Who writes                              | What the entry must contain                                                                       |
| -------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------- |
| End of every working session that changed the repository | The engineer or agent who did the work  | The full entry. A session that changed nothing writes no entry.                                   |
| A task's pull request is opened                          | The author                              | The entry travels in the pull request, with "PR #nn (open)". It is not rewritten after the merge. |
| The API gate of a module                                 | The contributor who ran the gate checks | A gate entry (section 5). A code owner confirms by approving the pull request.                    |
| The exit gate of a module                                | The contributor who ran the checklist   | A gate entry (section 5). A code owner confirms.                                                  |
| A gap is raised or closed outside a working session      | Whoever raised or closed it             | A short entry with the "Gaps" field filled.                                                       |
| A release to `production`                                | The code owner who merged it            | The release pull request number, what it contained, and the result of post-release checks.        |
| A hand-off                                               | The outgoing contributor                | "Next step" with task id, branch, pull request, what is done and what is left.                    |
| A correction                                             | Whoever found the error                 | A correction entry (section 6).                                                                   |

An entry for work on a branch is committed on that branch and reaches `develop` with the work.
There is no separate "log-only" pull request for work that has its own pull request.

## 5. Gate entries

A gate entry is an ordinary entry whose "Gate status" claims a gate. In addition it must:

1. List every check of the gate by its number in the module plan (§8 for the API gate, §10 for
   the exit gate), each with its evidence.
2. Name the environment the checks ran on.
3. State the commit the checks ran against.
4. List every open gap of the module and why it does not block the gate.
5. Change the module's row on the status board in the same pull request.

A gate with one red or unrun check is not passed. The entry may still be written, with the state
unchanged and the red check named.

## 6. Rules

1. **Append-only.** A merged entry is never edited or deleted, apart from fixing a broken link
   or a typing error that changes no fact.
2. **Corrections are new entries.** If an entry was wrong, add an entry titled
   "Correction to P-nnnn" that states what was wrong and what is true.
3. **Newest first.** New entries go directly under the `## Entries` heading.
4. **Facts, not intentions.** "Built", "merged", "failed", "not run". Never "will", "plan to",
   "should be". The only forward-looking field is "Next step".
5. **Evidence or it is not logged.** A claim with nothing to check is rewritten or removed at
   review.
6. **Never another contributor's entry.** On a merge conflict keep both entries
   ([1MM-STD-02](1MM-STD-02-AGENTIC-OPERATIONS.md) §11).
7. **Nothing private.** No secrets, no real member data, no personal contact details, no content
   from the private spec pack beyond cited facts, no business figures.
8. **One log.** No per-module or per-agent progress files. Module plans record changes of plan in
   their own change logs; they do not record progress.
9. **Size.** **Recommendation:** when the log passes about 2,000 lines, the engineering lead
   moves the oldest entries, unchanged, to an archive file named by the document naming rule,
   links it from the log and from [1MM-INDEX](../1MM-INDEX.md), and records the move as an entry.

## 7. How a reviewer uses the log

A reviewer of a pull request checks that:

- the entry exists and uses the form in section 3;
- every claim in "What changed" is visible in the diff;
- the evidence can be checked and matches the `verify` job;
- a board change is justified by the entry and, for a gate, by section 5;
- gaps named in the entry exist as rows in their documents.

## 8. Gaps raised

Dispositions are recorded in [1MM-LOG-03](../1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md)
(Technical Reference and schema), [1MM-LOG-02](../1MM-LOG-02-UI-UPDATES.md) (UI) and
[1MM-LOG-04](../1MM-LOG-04-OPEN-DECISIONS-AND-FOLLOW-UPS.md) (owner decisions and repository
follow-ups).

None. The pull-request template does not yet ask for the progress-log entry; that is raised with
the other template changes as GAP-STD08-01 in [1MM-STD-08](1MM-STD-08-CONTRIBUTING.md).

## Change log

| Version | Date        | Change            |
| ------- | ----------- | ----------------- |
| v1.0    | 24 Nov 2026 | Approved baseline |
