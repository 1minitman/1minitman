# 1MM-ADR-0071 · Admin console governance rules from the admin decision register

|                  |                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------ |
| **Status**       | Accepted                                                                                                     |
| **Date decided** | 19 Nov 2026 (AD-01 remainder: 20 Nov 2026)                                                                   |
| **Decided by**   | Owner decision OD-31 (standing instruction: the admin register AD-02 to AD-42 took its recommended defaults) |
| **Sources**      | [OD-31], [ODT "04_admin"], [ADM §0.4], [ADM §1.1–§1.6], [ADM App. D], [TR §7], [SQL]                         |
| **Affects**      | apps/api (`/admin/v1`), apps/admin, packages/db; MOD-01, MOD-05, MOD-06, MOD-09, MOD-17, MOD-18              |

## Context

The admin spec carried a register of 42 open items (AD-01 to AD-42) and a list of source
conflicts it resolved [ADM §0.4]. All are now decided [ADM App. D]. Many are operating values;
this ADR records the ones that constrain how the API and the console are built. Items with their
own ADR are not repeated: refunds (0044), passwords (0045), the queue and appeals (0058), admin
unlock (0059), suspension billing (0066).

## Decision

| Ref            | Rule the build must enforce                                                                                                                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AD-05          | Production changes to feature flags and remote config need a second admin, except turning a kill switch off; enforced in the database by `enforce_config_approval()`                                                                  |
| AD-06          | Member-level exports (`users.export`, `billing.export`, `newsletter.export`) need approval; aggregated `analytics.export` does not                                                                                                    |
| AD-09          | Reviewers have no access to the liveness video: results and scores only                                                                                                                                                               |
| AD-10, §0.4 #4 | There is no lawful-access path to unreported messages. Message content is shown only from `report_evidence`, behind `conversations.read_reported` with a reason and re-authentication; previews and DM request notes count as content |
| AD-11          | Moderators cannot read live group rooms: flagged counts and report evidence only                                                                                                                                                      |
| AD-12          | "Merge duplicates" means close the duplicate; subscriptions, chats and media are never moved                                                                                                                                          |
| AD-13          | Forced re-verification is a new badge application at the face check, with no charge                                                                                                                                                   |
| AD-14          | Console real-time is one server-sent events stream, `GET /admin/v1/stream`, with a 30-second polling fallback                                                                                                                         |
| AD-15          | System roles are not editable; a custom role is made by cloning                                                                                                                                                                       |
| AD-03, AD-24   | A device allow-list is required in production for the four most privileged roles; staging has its own IP allow-list                                                                                                                   |
| AD-19          | The network "challenge" is a silent WAF challenge on website and web-app routes only, never the mobile API                                                                                                                            |
| AD-21          | The website API prefix is `/public/v1`                                                                                                                                                                                                |
| AD-23          | The console is English only; member content is shown as written                                                                                                                                                                       |
| §0.4 #1        | The console uses the schema's table names, not the website spec's entity names                                                                                                                                                        |
| §1.1           | A row outside an admin's scope returns `404`, not `403`, so scope cannot be probed                                                                                                                                                    |

## Alternatives considered

Each register row stated a question and a default; the default was applied [ODT]. Where the
register shows the option not taken: four-eyes on config was "seed says no" (AD-05); an explicit
lawful-access path was asked for and refused (AD-10); the other real-time candidate is the member
WebSocket gateway ([1MM-ADR-0019](1MM-ADR-0019-REALTIME-OVER-WEBSOCKET.md)), not used for the
console (AD-14).

## Consequences

- Easier: the privacy rules are structural. An endpoint that returns liveness video, unreported
  message content or live group content does not exist, so no permission can grant it.
- Harder: config changes in production are asynchronous
  ([1MM-ADR-0030](1MM-ADR-0030-FOUR-EYES-APPROVALS.md)); an urgent change waits for a second
  admin unless it is a kill switch being turned off.
- Harder: the console's own constants (claim timeouts, targets, caps such as AD-26, AD-28, AD-38,
  AD-39, AD-41) are config rows, per owner rule 4, and each needs an admin control.

## How it is applied

- Access, roles, approvals and audit: [MOD-01](../execution/1MM-EXE-MOD-01-ADMIN-ACCESS-AND-GOVERNANCE.md),
  with [1MM-ADR-0028](1MM-ADR-0028-ADMIN-CONSOLE-STATIC-SPA-MANDATORY-MFA.md) and
  [1MM-ADR-0029](1MM-ADR-0029-HASH-CHAINED-AUDIT-LOG.md).
- Checks: negative authorisation tests per rule (gate item G6 in
  [1MM-STD-06 §3](../standards/1MM-STD-06-API-FIRST.md)); a contract test that no admin route
  exposes the excluded content; a database test for `enforce_config_approval()` in production
  mode; the admin QA checklist [ADM §4] at the launch gate.

## Revisit when

A regulator or court order requires access the rules exclude (a new owner decision, with counsel),
or the team grows enough to tighten the single-approver rules.
