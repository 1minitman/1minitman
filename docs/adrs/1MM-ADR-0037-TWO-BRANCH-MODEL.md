# 1MM-ADR-0037 · Two protected branches: `develop` (squash) and `production` (merge commit)

|                  |                                                                                                                                                                            |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                                                                                                                   |
| **Date decided** | 23 Nov 2026                                                                                                                                                                |
| **Decided by**   | Repository set-up (commit `af48960`, "Add branch rulesets")                                                                                                                |
| **Sources**      | `.github/rulesets/develop.json`, `.github/rulesets/production.json`, `.github/CODEOWNERS`, `.github/workflows/ci.yml`, `docs/USAGE.md`, `README.md`, [TR §17.3], `git log` |
| **Affects**      | The whole repository; every contributor and coding agent                                                                                                                   |

## Context

The Technical Reference describes the workflow briefly: "Trunk-based development" with "staging
on merge; production after approval" [TR §17.3]. The repository set-up turned that into two
long-lived branches with rules written down as importable rulesets, so that protection does not
depend on anyone's memory. The repository is public and is worked on by engineers and by coding
agents, so the rules must hold without trust in the author.

## Decision

1. Two long-lived branches only. `develop` is the default branch and the trunk; `production` is
   what is live. There are no other long-lived branches.
2. Nobody pushes to either branch. Both refuse deletion and force pushes.
3. **`develop`:** changes arrive by pull request with one approving review from a code owner who
   is not the author, stale approvals dismissed on push, approval of the last push, resolved
   conversations, a green `verify` check on an up-to-date branch, no new CodeQL finding of high
   severity or above, signed commits and linear history. The only merge method is **squash**.
4. **`production`:** updated only by an approved pull request from `develop`, with the same
   review, check and signature rules. The only merge method is a **merge commit**.
5. The rules live in `.github/rulesets/` and are imported by the repository owner; weakening
   them is not something a contributor or agent may do.

## Alternatives considered

- **Pure trunk-based with one branch** [TR §17.3]: the repository keeps `develop` as the trunk
  and adds `production` as the record of what is released. **Analysis:** "production after
  approval" needs an approval point; a pull request from `develop` to `production` gives one
  with the same review and checks, and a merge commit keeps the released set of squashed commits
  identifiable.
- **Git-flow with release and hotfix branches:** the sources record no such option.
  **Analysis:** more long-lived branches than a small team needs.
- **Rebase or merge commits on `develop`:** not allowed by the ruleset; squash gives one commit
  per reviewed change, which the linear-history rule requires.

## Consequences

- Easier: every commit on `develop` is one reviewed, verified change; `production` history shows
  each release as one merge; an unsigned or unreviewed commit cannot land.
- Harder: at least one code owner other than the author must be available; a hotfix still goes
  through `develop`; contributors need a signing key; strict status checks mean rebasing or
  updating a branch before merge.
- Because the repository is public, both branches are readable by anyone; the rules control who
  can change them, not who can see them (`docs/USAGE.md`).

## How it is applied

- `.github/rulesets/develop.json` and `production.json`; `.github/CODEOWNERS`; CI job `verify`
  runs on pull requests to both branches and on pushes to `develop`.
- Working rules: [1MM-STD-08 Contributing](../standards/1MM-STD-08-CONTRIBUTING.md) and
  [1MM-STD-10 Commits and local CI](../standards/1MM-STD-10-COMMITS-AND-LOCAL-CI.md); one module
  task per pull request, named by its task id.
- Check: GitHub enforces the rulesets; `pnpm check:repo` keeps the workflow itself within its
  rules ([1MM-ADR-0038](1MM-ADR-0038-SUPPLY-CHAIN-HARDENING.md)).

## Revisit when

Deploy automation needs a different release marker (for example tags or a release branch per
store build), or the team grows enough to need a merge queue.
