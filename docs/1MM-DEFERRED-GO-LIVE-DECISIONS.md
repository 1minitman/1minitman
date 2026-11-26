# 1MM-DEFERRED-GO-LIVE-DECISIONS · What the owner still owes before go-live

|              |                                                                                                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Document** | 1MM-DEFERRED-GO-LIVE-DECISIONS                                                                                                                                                                          |
| **Status**   | Running reminder list · started 26 Nov 2026 · v1.1                                                                                                                                                      |
| **Audience** | The owner and the engineering lead                                                                                                                                                                      |
| **Owner**    | Engineering lead (code owners)                                                                                                                                                                          |
| **Related**  | [1MM-LOG-04](1MM-LOG-04-OPEN-DECISIONS-AND-FOLLOW-UPS.md), [1MM-LOG-03](1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md), [1MM-PLANNER](1MM-PLANNER.md), [1MM-EXE-00](execution/1MM-EXE-00-MASTER-PLAN.md) |

**What this document is for and when to open it.** The build no longer waits on these items, but
go-live does. Each row names the item, what the owner must supply or confirm, and the latest point
at which it is needed. The answer itself is recorded in the item's own entry (LOG-04 for `DEC`,
LOG-03 for `TRX`); this page is only the reminder. Open it before each module's API stage and
before every gate from MOD-10 on. When an item is closed, strike its row here in the same pull
request.

This repository is public. Names, contact details, contracts and commercial terms are kept
outside it; a row records only that the answer exists and what the build must do.

## 1. Deferred by the owner

The build runs on a placeholder until the value arrives.

| Item                                                                                 | What is needed                                                                                                                                                                    | Placeholder meanwhile                                                                                                       | Needed by                                  |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| [DEC-027](1MM-LOG-04-OPEN-DECISIONS-AND-FOLLOW-UPS.md) Store and payment product ids | Nine ids: `black_badge`, `premium_monthly`, `gold_monthly` × App Store, Google Play, Flutterwave. App Store and Play ids exist since 1 Jul 2026 (App Store Connect, Play Console) | `TBD:<product>:<provider>` ([1MM-ADR-0046](adrs/1MM-ADR-0046-STORE-PRODUCT-IDS-AND-TBD-PLACEHOLDERS.md)); purchases refused | MOD-10 sandbox purchase tests; launch gate |
| [DEC-045](1MM-LOG-04-OPEN-DECISIONS-AND-FOLLOW-UPS.md) Security incident roles       | Incident owner, one or two deputies, who notifies the regulator (NDPC) and who notifies members. Roles and a shared alias in the repo; names kept outside                         | Role placeholders in the MOD-17 playbooks                                                                                   | MOD-19 launch gate                         |

## 2. Waiting on the lawyer

Legal questions are never settled by a default ([1MM-LOG-04 §2](1MM-LOG-04-OPEN-DECISIONS-AND-FOLLOW-UPS.md)). Where an
interim default is named, the build uses it and the entry stays open.

| Item    | Question in short                                                      | Interim default for building                                          | Needed by                       |
| ------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------- |
| DEC-001 | Licence of the public repository                                       | Owner chose all rights reserved; `LICENSE` file added on confirmation | Accepting outside contributions |
| DEC-021 | Black Badge consent withdrawal wording                                 | Product rules decided; wording pending                                | `MOD-06-API-06`                 |
| DEC-023 | What a shared profile link exposes, and consent                        | Share action hidden behind flag `profile.share`, seeded off           | Turning the flag on             |
| DEC-035 | Identity columns in clear, protected by encryption at rest, roles, RLS | Current design                                                        | DPIA in MOD-19                  |
| DEC-039 | Website "was this helpful" vote: per-visit id in `sessionStorage`      | As stated                                                             | `MOD-14-WEB-01`                 |
| DEC-041 | Effect of an `object` or `restrict_processing` privacy request         | Withdraw marketing, research, analytics consents; hide profile        | `MOD-16-ADM-02`                 |
| DEC-042 | Consent-receipt retention, privacy deadlines, NDPC registration ref    | Deadlines provisional; retention key seeded null                      | Production launch               |
| DEC-043 | E-mail announcement of a material legal change                         | In-app sheet and website banner only                                  | MOD-16                          |
| DEC-049 | Approval of store privacy declarations and age rating                  | Owner and interim DPO approve                                         | Store submission                |
| TRX-094 | What remains of an erased member; ledger purge periods                 | None; blocks the erasure work                                         | MOD-16 API stage                |

## 3. Waiting on the trust-and-safety lead or the accountant

| Item    | What is needed                                                                                                                          | Needed by                         |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| DEC-019 | Media providers and the match, no-match and review thresholds. Engineering proposal in the entry: AWS Rekognition only, the rest manual | `MOD-04-WRK-01`, `MOD-04-WRK-02`  |
| DEC-024 | Sanctions ladder: steps and look-back days per category (verbs already decided)                                                         | Before the beta; MOD-09 exit gate |
| TRX-080 | Invoice number format (the gap-free counter is decided)                                                                                 | MOD-10 invoices                   |

## 4. Values and names the owner supplies

Nothing is seeded with a guess; code defaults apply until each value arrives.

| Item        | What is needed                                                                                                  | Needed by               |
| ----------- | --------------------------------------------------------------------------------------------------------------- | ----------------------- |
| ~~DEC-051~~ | ~~The person responsible for Lagos usability round 1 (method decided: stage 40 build, A35)~~ Closed 26 Nov 2026 | MOD-19 exit gate        |
| ~~TRX-069~~ | ~~Profile-strength weights per profile element (`profile.strength_weights`)~~ Closed 26 Nov 2026                | MOD-04                  |
| TRX-071     | Values of `discovery.distance_steps_km`                                                                         | MOD-07                  |
| TRX-101     | The unsourced limits and values listed in the extension, supplied as each module asks                           | Each module's API stage |

## 5. Spending to approve or action

Decided, but each costs money and needs the owner to act.

| Item    | Spend                                                                                         | When                                          |
| ------- | --------------------------------------------------------------------------------------------- | --------------------------------------------- |
| DEC-003 | Sentry team plan (free plan until then; organisation created in the EU region from the start) | Before the private beta                       |
| DEC-007 | Expo plan tier that allows update code signing                                                | Before the first public build                 |
| TRX-096 | Resend paid tier (free plan with an alert at 70% of the daily cap until then)                 | When the alert fires, or before public launch |

## 6. Private Technical Reference updates

The Technical Reference master is in the private specification pack, so these edits are made there
by the owner or the engineering lead.

| Item        | Update                                                                                        |
| ----------- | --------------------------------------------------------------------------------------------- |
| DEC-003     | Add the Sentry line to the paid-tier list in [TR §4.3]                                        |
| LOG-03 §4.1 | Record the extensions decided on 26 Nov 2026 in [TR §20] and move them to the LOG-03 register |

## Change log

| Version | Date        | Change                                                                                  |
| ------- | ----------- | --------------------------------------------------------------------------------------- |
| v1.1    | 26 Nov 2026 | DEC-051 (State Manager) and TRX-069 (weights by industry practice) closed.              |
| v1.0    | 26 Nov 2026 | First version: DEC-027 and DEC-045 deferred; every item still owed by the owner listed. |
