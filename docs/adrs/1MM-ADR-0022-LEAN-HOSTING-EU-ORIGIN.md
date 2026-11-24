# 1MM-ADR-0022 · Lean hosting with an EU origin: Cloudflare, Railway, Neon, Upstash

|                  |                                                                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                                                                                           |
| **Date decided** | 18 Nov 2026                                                                                                                                        |
| **Decided by**   | Owner decision OD-11 (refines OD-06; revises baseline T1)                                                                                          |
| **Sources**      | [OD-06], [OD-11], [OD-10], [TR §4.1], [TR §4.3], [TR §13.4], [TR §18.1] T1, `infra/README.md`, `infra/railway/`, `infra/docker/service.Dockerfile` |
| **Affects**      | infra, apps/api, apps/worker, every static app, MOD-00, MOD-19                                                                                     |

## Context

The MVP baseline (T1) hosted on AWS af-south-1 with CloudFront. After the hosting review on
18 Nov 2026 the owner replaced it with a lean set of providers on free or pay-as-you-go tiers:
"No AWS compute, database or cache at launch" [OD-11]. None of the chosen providers has a Nigeria
region, so the origin sits in the EU and Cloudflare serves Lagos from its local edge [OD-11].

## Decision

| Layer        | Choice [OD-11], [TR §4.3]                                                                  |
| ------------ | ------------------------------------------------------------------------------------------ |
| Edge         | Cloudflare free plan: DNS, CDN, WAF, DDoS, Pages for the website, web app and admin        |
| API + worker | Bun + Hono and the pg-boss worker as Docker services on Railway, EU West (Amsterdam)       |
| Database     | Neon serverless PostgreSQL 16 with PostGIS, citext, pgcrypto, AWS eu-central-1 (Frankfurt) |
| Redis        | Upstash Redis, eu-central-1                                                                |
| Media        | Cloudflare R2, EU jurisdiction                                                             |
| AWS          | Only pay-per-use Rekognition Face Liveness and KMS (envelope keys)                         |
| Secrets      | Railway sealed variables (`vault://` references), not AWS Secrets Manager                  |

1. The Railway API accepts traffic only through Cloudflare (Cloudflare IP ranges plus an origin
   secret header) [TR §4.3].
2. Free and hobby tiers are for demo and beta only. Before public launch: Railway Pro, paid Neon
   and paid Upstash, because free tiers sleep and have small quotas [OD-11].
3. The code stays portable: standard PostgreSQL, the S3 API and the Redis protocol [OD-11].

## Alternatives considered

- **AWS af-south-1 + CloudFront** (T1): revised; kept as the growth path [TR §18.1].
- **Fly.io** for compute and **Supabase** for the database: the owner preferred Railway over
  Fly.io and Neon over Supabase [OD-11].
- **AWS Secrets Manager:** replaced by Railway sealed variables [OD-11].

## Consequences

- Easier: near-zero fixed cost; managed services with no servers to patch.
- Harder: Lagos members see roughly 100 to 150 ms of extra network time per API call
  [TR §4.3]; five providers to operate; member data crosses a border, which is added to the OD-10
  lawyer review under NDPA 2023 [OD-11], [OD-10].
- Cost: usage-based; the paid tiers are a launch gate.

## How it is applied

- `infra/railway/api.json`, `infra/railway/worker.json`, `infra/docker/service.Dockerfile`.
  Terraform for Cloudflare, Neon, Upstash and the small AWS footprint [TR §4.3] is added when the
  staging environment is created (`infra/README.md`).
- Provisioning tasks (`OPS`) are in [MOD-00](../execution/1MM-EXE-MOD-00-FOUNDATIONS.md); the
  paid-tier move is a gate in [MOD-19](../execution/1MM-EXE-MOD-19-HARDENING-AND-LAUNCH.md).
- Checks: a request to the Railway origin that bypasses Cloudflare is refused; no AWS SDK use
  outside the Rekognition and KMS adapters (review).
- Platform list: [1MM-RES-01](../resources/1MM-RES-01-OPEN-SOURCE-AND-PLATFORMS.md).

## Revisit when

A market requires local hosting, or load outgrows these tiers: the origin then moves to AWS
af-south-1 (RDS, later Citus) [OD-11].
