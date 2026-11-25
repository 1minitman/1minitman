# 1MM-ADR-0024 · Vendors at near-zero fixed cost, each behind an adapter

|                  |                                                                                                                               |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                                                                      |
| **Date decided** | 18 Nov 2026                                                                                                                   |
| **Decided by**   | Owner decision OD-06 (hosting part refined by OD-11)                                                                          |
| **Sources**      | [OD-06], [OD-11], [OD-20], [OD-22], [TR §3], [TR §4.1], [TR §5.1], [TR §6.1], [TR §12], [TR §14], [TR §18.1] T7, T8, T10, T12 |
| **Affects**      | apps/api, apps/worker, apps/mobile, apps/site, MOD-00, MOD-03, MOD-06, MOD-11, MOD-18                                         |

## Context

The MVP baseline left the liveness vendor to a bake-off (T7) [TR §18.1]. On 18 Nov 2026 the
owner settled the open vendor choices with one rule: "Lean, near-zero fixed cost", upgrading
"each only when usage outgrows the free / pay-as-you-go tier" [OD-06]. The decision covers
liveness, the carrier check, e-mail, analytics, attribution and the edge; the hosting part was
refined the same day by OD-11 ([1MM-ADR-0022](1MM-ADR-0022-LEAN-HOSTING-EU-ORIGIN.md)).

## Decision

| Need              | Vendor and terms                                                             | Source       |
| ----------------- | ---------------------------------------------------------------------------- | ------------ |
| Face liveness     | AWS Rekognition Face Liveness, pay per check                                 | [OD-06], T7  |
| Carrier check     | Deferred until after launch; GD1 "live phone check" is hidden at launch      | [OD-06]      |
| Phone OTP         | Termii SMS + WhatsApp, with Twilio Verify as fallback                        | [TR §3], T8  |
| E-mail            | Resend, free tier                                                            | [OD-06]      |
| Push              | Expo Push (APNs / FCM)                                                       | [TR §3]      |
| Product analytics | PostHog Cloud, free tier, only after consent                                 | [OD-06], T10 |
| Attribution       | No paid vendor: UTM links, our own `/get` deep-link redirect, store consoles | [OD-06]      |
| Edge and CDN      | Cloudflare free plan                                                         | [OD-06]      |
| Calls             | daily.co, after public launch, behind `calls.enabled`                        | [OD-20], T12 |
| Status page       | Free hosted plan, hosted apart from our stack                                | [OD-22]      |

1. Each vendor is reached through an adapter (a port in the application layer), so it can be
   replaced without touching use cases. The liveness client is "behind an adapter" by the
   Technical Reference itself [TR §5.1].
2. Vendor callbacks arrive only on `/webhooks/*`, signature-verified and stored once in
   `webhook_events` [TR §12]. Rekognition has no webhook: the API fetches the session result
   [TR §12].
3. A vendor moves to a paid tier only when usage outgrows the free or pay-as-you-go tier [OD-06].

## Alternatives considered

- **Liveness vendor bake-off** (T7): closed by OD-06 in favour of Rekognition.
- **A paid attribution vendor:** rejected by OD-06; counts go to `web_redirects_daily` as
  aggregates only [TR §6.1].
- **Carrier check at launch:** deferred [OD-06].
- **Postmark or SES for e-mail:** named in an old canvas note; Resend is the provider
  [TR §18.3 item 12].

## Consequences

- Easier: almost no fixed monthly bill; vendors swap behind ports.
- Harder: free-tier quotas and rate limits must be monitored; several small vendors mean several
  DPAs and health probes (`vendor_health_checks`) [TR §14]; without an attribution vendor,
  install attribution is coarse.
- Cost: per check, per message and per minute only.

## How it is applied

- Outbound senders (Resend, Termii) and webhook routes land early (ruling R21, [master plan](../execution/1MM-EXE-00-MASTER-PLAN.md) section 7);
  liveness in [MOD-06](../execution/1MM-EXE-MOD-06-BLACK-BADGE-VERIFICATION.md); analytics in
  [MOD-18](../execution/1MM-EXE-MOD-18-ANALYTICS-OVERVIEW-AND-RESEARCH.md).
- Checks: vendor SDKs are imported only in `infrastructure` code (lint,
  [1MM-ADR-0005](1MM-ADR-0005-API-MODULE-LAYERS.md)); each adapter has a fake used in tests; spend
  alarms are among the required alerts [TR §14].
- Vendor register: [1MM-RES-01](../resources/1MM-RES-01-OPEN-SOURCE-AND-PLATFORMS.md).

## Revisit when

Usage outgrows a free or pay-as-you-go tier, a vendor's delivery rate in Nigeria falls below what
OTP sign-in needs, or the carrier check is scheduled after launch.
