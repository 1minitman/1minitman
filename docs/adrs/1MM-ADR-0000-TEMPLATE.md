# 1MM-ADR-0000 · Template for an architecture decision record

This file is the template every ADR in `docs/adrs/` follows. Copy it, take the next unused number
from [the index](1MM-ADR-0000-INDEX.md), and fill every section. Open it when a decision is made
that changes how the product is built, hosted, secured or operated.

## Rules for writing an ADR

1. **One decision per ADR.** If the text needs "and also", it is two ADRs.
2. **File name:** `1MM-ADR-nnnn-UPPER-KEBAB-TITLE.md`, four-digit number, never reused. Numbers
   0001 to 0039 hold technical architecture, stack, platform, data, security and repository
   decisions; 0040 onwards hold product rules with engineering impact, the admin console, the
   website, operations and documentation decisions.
3. **Length:** 40 to 90 lines. Facts, not essays. British English, no marketing tone.
4. **Sources, not invention.** Context and alternatives come from the sources or the repository
   history. Cite the private spec pack with bracket codes (`[TR §8.1]`, `[OD-11]`, `[ODT]`), never
   with a link: the pack is not in this repository. Cite the repository by path. Where the sources
   give no alternatives, write "The sources record no alternatives" and add the obvious ones
   labelled as analysis.
5. **Status** is one of:
   - `Accepted`: an owner decision, the Technical Reference baseline or the merged repository
     shows it.
   - `Proposed`: an engineering recommendation awaiting the owner.
   - `Deferred`: decided, but not built until a named trigger.
   - `Superseded by 1MM-ADR-nnnn`: replaced. The old file stays; only its status row changes.
6. **An accepted ADR is not rewritten.** A changed decision is a new ADR that supersedes the old
   one. Typing and link fixes are fine.
7. **Precedence:** owner decisions, then the Technical Reference and its extensions log, then
   ADRs, then standards, module plans and code. An ADR records a decision; it never overrides an
   owner decision.
8. Every new ADR gets a row in [the index](1MM-ADR-0000-INDEX.md) in the same pull request.
9. The repository is public: no secrets, no business or investor content, no long passages from
   the pack.

## The template

Copy everything inside the block.

```markdown
# 1MM-ADR-0007 · Short decision title

|                  |                                                                                                                             |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Status**       | Accepted (or Proposed / Superseded by 1MM-ADR-nnnn / Deferred)                                                              |
| **Date decided** | 18 Nov 2026                                                                                                                 |
| **Decided by**   | Owner decision OD-11 (or: Technical Reference §18.1 baseline; repository set-up; engineering recommendation awaiting owner) |
| **Sources**      | [OD-11], [TR §4.3] ...                                                                                                      |
| **Affects**      | apps/api, apps/worker, MOD-00 ...                                                                                           |

## Context

The problem, the constraints and what the sources say. Two to eight lines.

## Decision

What is decided, stated so that it can be checked. Name the repository objects exactly.

## Alternatives considered

What else was on the table and why it was not chosen, from the sources. Analysis that is the
author's own is labelled "Analysis".

## Consequences

What gets easier, what gets harder, and what it costs.

## How it is applied

Where in the repository and the plans this decision shows up, and how compliance is checked
(a lint rule, a CI step, a test, a review item).

## Revisit when

The trigger that would reopen the decision.
```

## What each header row means

| Row              | Content                                                                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**       | One of the four values in rule 5.                                                                                                                                         |
| **Date decided** | The date of the owner decision, the Technical Reference revision or the merged commit that shows it.                                                                      |
| **Decided by**   | The authority: an `OD-nn` owner decision, the Technical Reference §18.1 baseline (T1 to T15), the repository set-up, or an engineering recommendation awaiting the owner. |
| **Sources**      | Bracket codes for the pack; paths for the repository.                                                                                                                     |
| **Affects**      | Apps, packages and modules (`MOD-nn`) that must follow the decision.                                                                                                      |
