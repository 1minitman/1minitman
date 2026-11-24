# 1MM-ADR-0076 · Gap protocol, Technical Reference extensions log and the `1MM-<SERIES>-<NN>` naming series

|                  |                                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Status**       | Proposed                                                                                                                                         |
| **Date decided** | 24 Nov 2026 (proposed)                                                                                                                           |
| **Decided by**   | Engineering recommendation in 1MM-STD-02, applying the owner's rule that every addition extends from the Technical Reference; awaiting the owner |
| **Sources**      | `docs/standards/1MM-STD-02-AGENTIC-OPERATIONS.md` §7–§9, `AGENTS.md`, `docs/1MM-INDEX.md`                                                        |
| **Affects**      | Every document in `docs/`, every pull request; all modules                                                                                       |

## Context

The masters (Technical Reference, schema, data dictionary, design boards) live in a private spec
pack that this public repository cannot show
([1MM-ADR-0039](1MM-ADR-0039-PUBLIC-REPOSITORY-PRIVATE-SPEC-PACK.md)). The owner's rule is that
every addition extends from the Technical Reference and nothing is silently invented. Engineers
and agents working here will meet things the sources lack or contradict. Without a protocol they
would patch around them, and the repository would drift from masters nobody here can see. The
documentation set also needed one naming scheme so that links and citations are stable.

## Decision

**Gap protocol** ([1MM-STD-02 §7](../standards/1MM-STD-02-AGENTIC-OPERATIONS.md))

1. Anything missing, unclear or contradictory in the sources is recorded as a row in the "Gaps
   raised" section of the document that needs it, never patched around.
2. Gap id: `GAP-<DOC>-<NN>` (`GAP-MOD07-01`, `GAP-STD13-01`). Type is exactly one of `TR`,
   `SCHEMA`, `UI`, `DECISION`, `REPO`. Each row names the tasks it blocks; only those stop.
3. A gap is verified before it is raised (grep the schema, check the citation). Gap rows are
   never deleted; closing adds the resolution reference.

**Extensions log** ([1MM-STD-02 §8](../standards/1MM-STD-02-AGENTIC-OPERATIONS.md))

4. `docs/1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md` is the public trail of every addition or
   correction to the Technical Reference after the baseline. The order is fixed: gap raised, the
   master updated in the pack, the row mirrored in the log, and only then dependent documents and
   code. The log is append-only.
5. A pull request whose code depends on something in neither a cited source nor the log is
   rejected. Board changes follow the same pattern in `docs/1MM-LOG-02-UI-UPDATES.md`.

**Naming**

6. Every derived document is `1MM-<SERIES>-<NN>-<UPPER-KEBAB-TITLE>.md`, with the series `EXE`
   (`docs/execution/`), `STD` (`docs/standards/`), `DB` (`docs/database/`), `RES`
   (`docs/resources/`), `ADR` (`docs/adrs/`, four digits) and `LOG` (`docs/`). File names are
   fixed once published; documents link to each other by relative path and cite the pack by
   bracket code, never by link.

## Alternatives considered

**Analysis** (the sources give none):

- **Fix gaps in place** (edit the plan or add the column and move on). Rejected: it is the silent
  invention the owner's rule forbids, and the private masters would never learn of it.
- **An issue tracker only.** Rejected as the sole record: issues are not versioned with the
  documents and are invisible to an agent reading the repository offline.
- **Copy the Technical Reference into the repository.** Not possible: the pack is private.
- **Free-form file names.** Rejected: a series prefix sorts, greps and cites unambiguously.

## Consequences

- Easier: every fact in code traces to a cited source or a log row; a blocked task is visible
  with its reason.
- Harder: a `TR` or `SCHEMA` gap needs someone with access to the pack to resolve it; an agent
  without access must stop that task and continue elsewhere.
- Cost: bookkeeping on every gap, and a document can never be renamed casually.

## How it is applied

- Session checklists in [1MM-STD-02 §15](../standards/1MM-STD-02-AGENTIC-OPERATIONS.md) and
  `AGENTS.md`; gaps are reported in each progress-log entry
  ([1MM-STD-07](../standards/1MM-STD-07-PROGRESS-UPDATES.md)).
- Checks: review; `pnpm check:repo` for repository rules. No automated check yet verifies that
  gap ids are unique or that links resolve. **Recommendation:** add both to `pnpm check:repo`.

## Revisit when

The pack becomes available in the repository (the log is then redundant), or gap volume shows
the protocol is too slow for `REPO`-type fixes.
