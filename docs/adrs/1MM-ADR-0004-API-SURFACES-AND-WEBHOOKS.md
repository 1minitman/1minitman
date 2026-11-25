# 1MM-ADR-0004 · Three API surfaces plus webhooks: `/v1`, `/public/v1`, `/admin/v1`, `/webhooks`

|                  |                                                                                                                |
| ---------------- | -------------------------------------------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                                                       |
| **Date decided** | 19 Nov 2026 (prefix `/public/v1`); surfaces from 18 Nov 2026                                                   |
| **Decided by**   | Technical Reference §4.2; AD-21 under owner decision OD-31                                                     |
| **Sources**      | [TR §4.1], [TR §4.2], [TR §8.2], [OD-31], [ODT] AD-21, [ADM §0.4] item 3, `packages/contracts/src/surfaces.ts` |
| **Affects**      | apps/api, packages/contracts, every client, MOD-00, MOD-15                                                     |

## Context

One API service serves four audiences with different trust: members, anonymous website visitors,
staff, and vendors calling back. The Technical Reference separates them by path: "REST under
`/v1` (members), `/public/v1` (website, no auth), `/admin/v1` (staff) and `/webhooks/*`
(vendors)" [TR §4.2]. The website spec used `/web/v1` for the same surface; the admin spec logged
the conflict and it was settled as AD-21 [ODT].

## Decision

1. One deployable (`apps/api`) with three client surfaces and one inbound surface:

   | Surface | Base path    | Audience               | Auth                                    |
   | ------- | ------------ | ---------------------- | --------------------------------------- |
   | member  | `/v1`        | Member app and web app | Member access token [TR §8.1]           |
   | public  | `/public/v1` | Website                | None [TR §4.2]                          |
   | admin   | `/admin/v1`  | Admin console          | Admin session plus permission [TR §8.2] |
   | inbound | `/webhooks`  | Vendors                | Signed webhook [TR §8.2]                |

2. Each client surface has its own OpenAPI document and generated client. Webhooks are in no
   client SDK.
3. The website prefix is `/public/v1`. Any `/web/v1` path in an older document is stale.
4. The member WebSocket is `/v1/ws` [TR §4.2].

## Alternatives considered

- **`/web/v1` for the website** (website spec): rejected by AD-21, decided at its recommended
  default under the owner's instruction of 19 Nov 2026 [OD-31], [ODT].
- **Separate services per audience:** the sources record no such option. **Analysis:** the
  hosting plan runs one `api` service with two or more replicas [TR §4.3]; separate services
  would add fixed cost against OD-06.

## Consequences

- Easier: auth, rate limits, CORS and WAF rules attach per prefix; the admin API can sit behind
  an IP allow list without touching members [TR §7.1].
- Harder: one process holds all four trust levels, so middleware order and the database role per
  surface ([1MM-ADR-0014](1MM-ADR-0014-LEAST-PRIVILEGE-DATABASE-ROLES.md)) must be exact.

## How it is applied

- `packages/contracts/src/surfaces.ts` defines `SURFACES` and `WEBHOOKS_BASE_PATH`;
  `apps/api/src/surfaces/` mounts them.
- Every endpoint row in a module plan names its surface (§4.1 of each plan).
- Review item: no route outside the four prefixes; no `/web/v1` anywhere (search in review).

## Revisit when

The admin API needs to scale, deploy or be network-isolated separately from the member API, or a
partner API is introduced (OD-16 keeps partner webhooks out of v1).
