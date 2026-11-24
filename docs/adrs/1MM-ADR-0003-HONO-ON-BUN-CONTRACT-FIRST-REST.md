# 1MM-ADR-0003 · Hono on Bun with zod-openapi: contract-first REST

|                  |                                                                                                                            |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                                                                   |
| **Date decided** | 18 Nov 2026                                                                                                                |
| **Decided by**   | Technical Reference §3 (kept from the product plan) and §8.1                                                               |
| **Sources**      | [TR §3], [TR §8.1], `packages/contracts/`, `turbo.json`, `.github/workflows/ci.yml`, `scripts/check-contract-breaking.mjs` |
| **Affects**      | apps/api, packages/contracts, apps/admin, apps/web, apps/site, apps/mobile                                                 |

## Context

The product plan named "API: Bun, Hono, zod-openapi". The Technical Reference kept it and added
the reason: "The OpenAPI spec generates typed clients for app, web and admin. One contract"
[TR §3]. The API design section fixes the mechanism: "REST with @hono/zod-openapi. The same zod
schemas validate requests, shape responses and generate clients" [TR §8.1]. The owner's rule for
this build is API first: no client code before the API exists.

## Decision

1. `apps/api` is a Hono application running on Bun.
2. Every route is declared with `@hono/zod-openapi`. Request and response schemas and route
   definitions live in `packages/contracts` (`src/schemas/`, `src/routes/`), not in the API app.
3. The OpenAPI documents (`packages/contracts/openapi/member.json`, `public.json`, `admin.json`)
   and the typed clients (`packages/contracts/src/generated/`) are generated, never hand-edited.
4. Clients call the API only through the generated clients.
5. The style is REST over JSON. Realtime is a separate channel
   ([1MM-ADR-0019](1MM-ADR-0019-REALTIME-OVER-WEBSOCKET.md)).

## Alternatives considered

The sources record no alternatives; the stack is carried from the product plan [TR §3].

**Analysis:** GraphQL or tRPC would also give typed clients, but the endpoint catalogue
[TR §8.2], the per-route rate limits [TR §13.3] and the per-route permissions of the admin API are
all written per REST route. A code-first API with a hand-written specification would let the
contract and the code drift.

## Consequences

- Easier: a route cannot exist without a schema; invalid input is rejected before a use case
  runs; clients get types for free; a breaking change is detectable by comparing documents.
- Harder: every change starts in `packages/contracts`; generated files must be regenerated and
  committed with the change.
- Cost: none.

## How it is applied

- `pnpm contracts:generate` runs the Turborepo pipeline `@1minitman/api#openapi:emit` then
  `generate`.
- CI job `verify`: "Generated API client is up to date" (`git diff --exit-code packages/contracts`)
  and, on pull requests, "No breaking API change" (`scripts/check-contract-breaking.mjs`).
- Process: [1MM-STD-06 The API-first approach](../standards/1MM-STD-06-API-FIRST.md); each module
  plan lists its contract deliverables (§4.4).

## Revisit when

Bun or Hono stops being maintained to production standard, or a client need appears that REST
plus the WebSocket cannot serve. The contracts package keeps the cost of changing the HTTP
framework low, because schemas and routes are not tied to the API app's internals.
