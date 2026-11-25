# 1MM-ADR-0023 · Five environments; real personal data only in production

|                  |                                                                                                                       |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                                                              |
| **Date decided** | 18 Nov 2026                                                                                                           |
| **Decided by**   | Owner decision OD-10 (data rule); Technical Reference §4.4 (environments)                                             |
| **Sources**      | [OD-10], [OD-26], [TR §4.3], [TR §4.4], [TR §13.1], [TR §16.2], `docker-compose.yml`, `.env.example`, `docs/USAGE.md` |
| **Affects**      | infra, every app, MOD-00, MOD-16, MOD-19                                                                              |

## Context

The owner staged the legal work: the demo runs on "test accounts and dummy data only;
no real personal data", and no real users (including the closed beta) are allowed before the
lawyer review, the interim DPO and the NDPC registration are in place [OD-10]. The product
handles biometric data, so a copy of production in a weaker environment would be a breach in
waiting. The Technical Reference turns this into an environment table [TR §4.4].

## Decision

1. Five environments [TR §4.4]:

   | Env        | Purpose                                               | Data                              |
   | ---------- | ----------------------------------------------------- | --------------------------------- |
   | demo       | Demo (OD-10)                                          | Test accounts and dummy data only |
   | local      | Developer machine (docker compose)                    | Seed only                         |
   | dev        | Shared integration                                    | Synthetic                         |
   | staging    | Production-like; release candidates; usability builds | Synthetic + research fixtures     |
   | production | Members                                               | Real                              |

2. **No production data in lower environments** [TR §4.4], [TR §13.1].
3. Staging and production are fully separate: separate Railway environments, Neon projects,
   Upstash databases, R2 buckets and KMS keys. Staging is a separate Neon project, never a branch
   of production [TR §4.3], [TR §4.4].
4. Payments below production use Flutterwave test mode and store sandboxes; OTP and e-mail use
   test numbers, a console sink or allow-listed numbers [TR §4.4].
5. Usability research builds use test accounts and dummy data only [OD-26].
6. Preview deployments for web and admin are created per pull request [TR §4.4].

## Alternatives considered

- **A Neon branch of production for staging:** explicitly ruled out [TR §4.3].
- **Masked copies of production data:** the sources record no such option. **Analysis:** masking
  face templates, messages and locations reliably is hard, and the rule is no production data
  outside production in any form.

## Consequences

- Easier: a leak from a lower environment exposes nothing real; the demo can run before the
  legal gate.
- Harder: realistic volumes and edge cases must be generated; production-only bugs cannot be
  reproduced with real rows; every provider is provisioned at least twice.
- Cost: duplicate free or low tiers per environment.

## How it is applied

- Local: `docker-compose.yml` and `.env.example` (the list of settings; `.env.development` is
  local and never committed).
- Seeds and synthetic data are delivered in
  [MOD-00](../execution/1MM-EXE-MOD-00-FOUNDATIONS.md); the legal gate before real users is in
  [MOD-16](../execution/1MM-EXE-MOD-16-LEGAL-PRIVACY-AND-DATA-OPERATIONS.md) and
  [MOD-19](../execution/1MM-EXE-MOD-19-HARDENING-AND-LAUNCH.md).
- Checks: per-environment credentials (no secret shared between staging and production); review
  rejects any script that reads from production into another environment. Rules:
  [1MM-STD-12 Data handling](../standards/1MM-STD-12-DATA-HANDLING.md),
  [1MM-DB-06 Data protection](../database/1MM-DB-06-DATA-PROTECTION.md).

## Revisit when

Counsel's review under OD-10 sets different conditions, or a regulator requires a
production-like test with real data under a documented safeguard.
