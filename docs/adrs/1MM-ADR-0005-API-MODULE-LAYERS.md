# 1MM-ADR-0005 · API modules in four layers, enforced by lint

|                  |                                                                                 |
| ---------------- | ------------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                        |
| **Date decided** | 23 Nov 2026 (layers); 24 Nov 2026 (workspace boundary rules, commit `eb1a417`)  |
| **Decided by**   | Repository set-up                                                               |
| **Sources**      | `eslint.config.mjs`, `apps/api/src/modules/system/`, `docs/USAGE.md`, `git log` |
| **Affects**      | apps/api, every module plan (API tasks)                                         |

## Context

The Technical Reference fixes what the API does and which libraries it uses, but not how the code
inside `apps/api` is arranged. The repository set-up made that choice and built the first module
(`system`) to it. The product is built module by module by several engineers and coding agents;
without a fixed shape each module would invent its own, and business rules would end up tied to
Hono handlers or Drizzle queries. This decision is recorded from the merged repository; the
Technical Reference has no matching section.

## Decision

1. Each API module lives in `apps/api/src/modules/<name>/` with four folders:
   `domain` (rules and types), `application` (use cases and ports), `infrastructure` (adapters:
   database, Redis, vendors) and `http` (routes).
2. `domain` and `application` depend on ports only. They never import `hono`, `@hono/*`,
   `drizzle-orm`, `postgres`, `bun`, or anything under `infrastructure/` or `http/`.
3. A module is used through its `index.ts`, never through its inner folders.
4. Shared, non-business plumbing lives in `apps/api/src/platform/` (HTTP context, problem
   responses, rate limiting, logging).
5. When an earlier module needs something a later module owns, it depends on a port with a stub
   adapter and the owning module supplies the real adapter (ruling R7, [master plan](../execution/1MM-EXE-00-MASTER-PLAN.md) section 7).

## Alternatives considered

The sources record no alternatives.

**Analysis:** (a) route handlers that query the database directly are faster to write but make
the rules untestable without HTTP and a database; (b) a layer-first layout (`controllers/`,
`services/`, `repositories/` across the whole app) spreads one module over many folders and makes
module ownership, which the execution plan depends on, hard to see.

## Consequences

- Easier: use cases are unit-tested with fake ports; a vendor or the ORM can be swapped in one
  adapter; module boundaries match the execution plan's modules.
- Harder: more files per feature; simple read endpoints still pass through a use case.
- Cost: none.

## How it is applied

- `eslint.config.mjs`: the "Clean architecture" block (restricted imports for
  `modules/*/domain/**` and `modules/*/application/**`) and the "module index" block
  (`**/modules/*/*/**` banned outside the module). `pnpm lint` runs in `pnpm check` and in CI.
- Reference implementation: `apps/api/src/modules/system/`.
- Conventions: [1MM-STD-14 Coding conventions](../standards/1MM-STD-14-CODING-CONVENTIONS.md);
  defensive rules: [1MM-STD-16](../standards/1MM-STD-16-DEFENSIVE-PROGRAMMING.md).

## Revisit when

The layering produces measurable drag (for example most use cases are pass-throughs after
several modules are built), or the worker needs to share use cases with the API, which would
move `domain` and `application` code into a package.
