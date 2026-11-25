# 1MM-ADR-0036 · Observability: OpenTelemetry tracing, Sentry, PostHog behind consent, rollups in PostgreSQL

|                  |                                                                                                     |
| ---------------- | --------------------------------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                                            |
| **Date decided** | 18 Nov 2026                                                                                         |
| **Decided by**   | Technical Reference §14; analytics vendor by owner decision OD-06 (baseline T10)                    |
| **Sources**      | [TR §4.1], [TR §5.1], [TR §14], [TR §18.1] T10, [OD-06], [OD-22], `apps/api/src/platform/logger.ts` |
| **Affects**      | Every app, apps/api, apps/worker, MOD-00, MOD-17, MOD-18                                            |

## Context

The product runs on five providers ([1MM-ADR-0022](1MM-ADR-0022-LEAN-HOSTING-EU-ORIGIN.md)) with
no operations team, handles safety escalations with minute-level targets, and must never leak
private content into its own telemetry. The Technical Reference sets the observability design in
one section [TR §14]. The vendor rule is near-zero fixed cost: PostHog Cloud on the free tier,
only after consent [OD-06].

## Decision

1. **Tracing:** OpenTelemetry from app to API to database, Redis and vendors, with a request id
   on every response and log line [TR §14].
2. **Errors:** Sentry for app, web, admin, API and worker (crashes, performance, release health)
   [TR §14].
3. **Product analytics:** PostHog Cloud (EU hosting, free tier), only after consent, plus our
   own `analytics_events` copy. Event names follow `screen.action` and are tied to screen codes
   [TR §14].
4. **Metrics:** the API flushes 1-minute rollups to `api_request_rollups` and samples to
   `api_request_samples`; vendor probes go to `vendor_health_checks`. These feed the admin
   network dashboard. Infrastructure metrics come from the Railway, Neon, Upstash and Cloudflare
   dashboards [TR §14].
5. **Logs:** structured JSON. Never logged: message bodies, passwords, codes, tokens, face data,
   card data. IPs are truncated in samples. Retention is 30 days hot and 1 year archived
   [TR §14].
6. **Alerts:** SLO burn, error-rate spikes, webhook failures, entitlement drift (`v_role_drift`
   not empty), badge SLA at risk, safety escalations unacknowledged after 5 minutes, OTP delivery
   failure rate, a vendor down, a broken audit chain, MFA gaps, spend alarms [TR §14].
7. The public status page is hosted apart from our stack on a free plan [OD-22].

## Alternatives considered

- **PostHog without a consent gate, or a paid analytics vendor:** T10 is "PostHog behind
  consent", kept on the free tier [TR §18.1], [OD-06].
- **A full metrics platform (for example Datadog or Grafana Cloud):** the sources record no such
  option. **Analysis:** it adds fixed cost against OD-06; request rollups in PostgreSQL plus the
  providers' own dashboards cover the stated needs and feed the admin console directly.

## Consequences

- Easier: one request id joins a member's report to a trace, a log line and a problem response;
  the admin network dashboard needs no external tool; almost no fixed cost.
- Harder: metrics live in several dashboards; rollup tables add write load and need partition
  retention; the never-log list must be enforced in code, not by convention; analytics are
  incomplete by design because they need consent.
- The sources name no tracing backend or alert-delivery channel. That is an open item for
  MOD-00, to be raised there as a gap, not decided here.

## How it is applied

- Request id, structured logger, tracing, Sentry and the rollup flush are cross-cutting
  deliverables of [MOD-00](../execution/1MM-EXE-MOD-00-FOUNDATIONS.md); the network dashboard in
  [MOD-17](../execution/1MM-EXE-MOD-17-NETWORK-AND-SECURITY-OPERATIONS.md); the event catalogue
  and consent gating in
  [MOD-18](../execution/1MM-EXE-MOD-18-ANALYTICS-OVERVIEW-AND-RESEARCH.md) (ruling R17, [master plan](../execution/1MM-EXE-00-MASTER-PLAN.md) section 7).
- Checks: a logger test that redacts the never-log fields; a test that no analytics call is
  made before consent; each alert in item 6 has an owner and a test firing before launch
  ([MOD-19](../execution/1MM-EXE-MOD-19-HARDENING-AND-LAUNCH.md)).

## Revisit when

Free tiers of Sentry or PostHog are outgrown, on-call needs a single metrics and alerting
platform, or rollup writes show up in the database budget.
