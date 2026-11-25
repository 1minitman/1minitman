# 1MM-ADR-0002 · TypeScript everywhere

|                  |                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------ |
| **Status**       | Accepted                                                                                                     |
| **Date decided** | 18 Nov 2026                                                                                                  |
| **Decided by**   | Technical Reference v3 rule ("One language (TypeScript)"); repository set-up                                 |
| **Sources**      | [TR header], [TR §3], [TR §5.1], [TR §7.1], `tsconfig.base.json`, `pnpm-workspace.yaml`, `eslint.config.mjs` |
| **Affects**      | Every app and package                                                                                        |

## Context

The Technical Reference states its working rule in its header: "One language (TypeScript), one
database, managed services" [TR header]. The member app is "TypeScript strict" [TR §5.1], the
admin console is Vite + React + TypeScript [TR §7.1], and the API contract generates typed clients
for app, web and admin [TR §3]. A single language is what lets one zod schema validate a request
on the server and type the same request in every client.

## Decision

1. Every app and package is written in TypeScript. There is no second application language.
2. One TypeScript version for the whole repository, pinned in the pnpm catalogue
   (`typescript: 6.0.3`) and extended from `tsconfig.base.json`.
3. SQL is the only other language in the repository, and only in `packages/db/migrations/` and
   `packages/db/roles/` ([1MM-ADR-0012](1MM-ADR-0012-FORWARD-ONLY-SQL-MIGRATIONS.md)).
4. Build and repository scripts in `scripts/` are plain Node modules (`.mjs`) with no build step.

## Alternatives considered

The sources record no alternatives: TypeScript is carried from the product plan's stack (Expo,
Vite, Bun + Hono) [TR §3].

**Analysis:** a different server language (for example Go or Kotlin) would remove the shared
schemas and the shared entitlement rules, and would need a second toolchain and a second set of
reviewers. Native Swift and Kotlin apps would double the client work that one Expo codebase
avoids [TR §3].

## Consequences

- Easier: shared zod schemas, shared entitlement keys, shared i18n and tokens; one lint and
  format configuration; engineers and agents move between apps.
- Harder: CPU-heavy work (media re-encoding, image moderation) cannot be written in a faster
  language inside the repository; it relies on native tools and vendors called from the worker
  [TR §11].
- Cost: none beyond the toolchain.

## How it is applied

- `pnpm typecheck` runs in every workspace through Turborepo and is part of `pnpm check` and the
  CI job `verify`.
- `scripts/check-repo-rules.mjs` fails when `typescript` (or `zod`, `react`, `react-dom`,
  `react-native`) is declared with anything other than `catalog:`.
- ESLint enforces `consistent-type-imports` and no unused variables across the repository.
- Conventions: [1MM-STD-14 Coding conventions](../standards/1MM-STD-14-CODING-CONVENTIONS.md).

## Revisit when

A workload cannot meet its budget in TypeScript on Bun and no managed service covers it. The
answer would be a separate, narrowly scoped service with its own ADR, not a second language in
the apps.
