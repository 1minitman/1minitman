# 1MM-ADR-0039 · The repository is public; the specification pack stays outside it

|                  |                                                                                                                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**       | Accepted (repository practice since set-up; explicit owner confirmation of the pack rule is requested, see Consequences)                                                                              |
| **Date decided** | 23 Nov 2026                                                                                                                                                                                           |
| **Decided by**   | Repository set-up; the binding rules of the documentation brief (24 Nov 2026)                                                                                                                         |
| **Sources**      | `docs/USAGE.md`, `SECURITY.md`, `packages/db/migrations/README.md`, `packages/db/SCHEMA_DATA_DICTIONARY.md`, `packages/tokens/package.json`, `.github/workflows/ci.yml`, `git log` (commit `6b7b71a`) |
| **Affects**      | The whole repository; every document under `docs/`; every contributor and coding agent                                                                                                                |

## Context

The code is hosted at `github.com/1minitman/1minitman` as a **public** repository: "anyone can
read both branches" (`docs/USAGE.md`). A public repository gets GitHub's secret scanning, push
protection, CodeQL and rulesets at no cost, which fits the near-zero fixed-cost rule. The
product's specification pack is a different kind of material: besides the technical documents it
holds business content that must not be published. At set-up, only three artefacts were taken
from the pack into the repository: the schema (as the baseline migration), the data dictionary
and the design tokens.

## Decision

1. The repository is public.
2. The specification pack is **not** in the repository and is never copied into it. Documents
   cite it with bracket codes (`[TR §8.1]`, `[OD-11]`) and never link to it.
3. Only these derived artefacts from the pack live in the repository:
   `packages/db/migrations/0001_baseline_v3_4.sql`, `packages/db/SCHEMA_DATA_DICTIONARY.md` and
   `packages/tokens/tokens.json`.
4. Nothing in the repository may contain: investor, fundraising, valuation, revenue-projection,
   competitor, persona-research or budget content; secrets, keys or tokens; real phone numbers
   or personal e-mail addresses (role mailboxes are fine; the one exception is the code owner
   named in `.github/CODEOWNERS`, at the owner's explicit request); real member data.
5. Derived documents restructure and cite facts (endpoints, tables, permissions, config keys);
   they do not paste long passages from the pack.
6. Security problems are reported privately to the security role mailbox, never as a public
   issue (`SECURITY.md`).

## Alternatives considered

- **A private repository:** noted in `docs/USAGE.md`: "If `production` must not be readable,
  make the repository private (branch rules on a private repository need a paid GitHub plan)."
- **The pack in the repository:** not done at set-up. **Analysis:** a public repository cannot
  hold the pack's business content, and a private sub-module would hide the sources from CI and
  from outside contributors anyway.
- **A second private repository for the pack:** the sources record no such option; it stays
  possible and would not change this decision.

## Consequences

- Easier: free security tooling; nothing sensitive to leak from the code host; contributors can
  read every rule that binds them.
- Harder: the documents in `docs/` must carry enough cited fact to build from without the pack;
  an engineer without pack access cannot verify a citation; every author must check what they
  paste; the Technical Reference is corrected through the extensions log in `docs/`, not by
  editing the pack from here.
- **Open point for the owner:** keeping the pack out was a set-up choice that the documentation
  brief then made binding; this ADR asks the owner to confirm it explicitly. Until then the rule is followed as written.

## How it is applied

- `.gitignore` and the pre-commit and CI secret scans
  ([1MM-ADR-0038](1MM-ADR-0038-SUPPLY-CHAIN-HARDENING.md)); `.env.example` is the only
  environment file committed.
- `pnpm check:banned-terms` runs in CI.
- Authoring rules: [1MM-STD-02 Agentic operations](../standards/1MM-STD-02-AGENTIC-OPERATIONS.md)
  and [1MM-STD-08 Contributing](../standards/1MM-STD-08-CONTRIBUTING.md); review of every pull
  request includes "no private spec content in the diff".

## Revisit when

The owner decides the code must not be readable (the repository goes private on a paid plan), or
decides to publish part of the technical pack.
