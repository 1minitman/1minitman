# Contributing to 1minitman

The full rules are in
[docs/standards/1MM-STD-08-CONTRIBUTING.md](docs/standards/1MM-STD-08-CONTRIBUTING.md). This page
is the short version. Coding agents start at [AGENTS.md](AGENTS.md).

## The essentials

1. **Two branches.** `develop` is the default branch; `production` is what is live. Nobody pushes
   to either. There are no other long-lived branches.
2. **Everything goes by pull request** into `develop`, from a short-lived branch named
   `<kind>/<task-id>-<short-description>` (for example `feature/mod-07-api-03-discovery-feed`).
3. **One module task per pull request.** The title starts with the task id from the module plan
   in `docs/execution/` (`MOD-07-API-03: …`).
4. **API first.** Inside every module the order is API → admin → web → mobile. Client work starts
   only after the module's API gate is recorded as passed
   ([1MM-STD-06](docs/standards/1MM-STD-06-API-FIRST.md)).
5. **Signed commits.** Every commit is signed with an SSH or GPG key
   ([1MM-STD-10](docs/standards/1MM-STD-10-COMMITS-AND-LOCAL-CI.md)).
6. **Green before you push.** Run the local checks; nothing is pushed with a red check.
7. **Review.** One approving review from a code owner who is not the author, on the final push,
   with every conversation resolved.
8. **Checks.** The `verify` job and CodeQL must pass.
9. **Merging.** A code owner squash-merges into `develop`. `production` changes only by an
   approved merge commit from `develop`.
10. **Records travel with the code.** Add a progress-log entry
    ([docs/1MM-LOG-01-PROGRESS.md](docs/1MM-LOG-01-PROGRESS.md)); raise a gap rather than invent a
    fact; write an ADR for an engineering decision; link any new document from
    [docs/1MM-INDEX.md](docs/1MM-INDEX.md).

## Before you open a pull request

```bash
pnpm install
pnpm preflight
pnpm services:up && pnpm db:migrate && pnpm db:roles
pnpm check
```

`pnpm check` is not all of CI. The full local run, step by step, is in
[1MM-STD-10 §8](docs/standards/1MM-STD-10-COMMITS-AND-LOCAL-CI.md).

## This repository is public

Never commit secrets, `.env` files (only `.env.example`), real member data, personal e-mail
addresses or phone numbers, or business and investor material. The product specifications are
kept outside the repository; cite them through the documents in `docs/`.

## Dependencies

A new dependency is a supply-chain change: give the reason, add it in the workspace that uses
it, use `catalog:` for shared versions, and never loosen the guards in `pnpm-workspace.yaml`.
See [1MM-STD-08 §12](docs/standards/1MM-STD-08-CONTRIBUTING.md).

## Outside contributors

Work from a fork and open a pull request into `develop`. CI runs on a fork's pull request only
after a maintainer approves the run. Keep the change small and focused; feature work follows the
module plans.

## Security problems

Do not open a public issue. Follow [SECURITY.md](SECURITY.md).
