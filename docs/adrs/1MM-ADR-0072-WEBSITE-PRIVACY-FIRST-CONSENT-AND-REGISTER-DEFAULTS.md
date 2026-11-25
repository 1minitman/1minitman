# 1MM-ADR-0072 · Website: privacy-first consent with zero third-party scripts by default, and the register defaults

|                  |                                                                                                             |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                                                    |
| **Date decided** | 18 Nov 2026 (OD-06 items); 19–20 Nov 2026 (register defaults)                                               |
| **Decided by**   | Owner decisions OD-06 and OD-31 (the website register DN-02 to DN-30 took its recommended defaults)         |
| **Sources**      | [OD-06], [OD-31], [ODT "05_website"], [WEB §0.3], [WEB §3.7], [WEB §3.10–§3.12], [WEB W03], [WEB §9], [SQL] |
| **Affects**      | apps/site, apps/api (`/public/v1`), apps/admin (A28, A29), packages/db; MOD-15, MOD-16, MOD-14, MOD-18      |

## Context

The website collects personal data through forms and measures visits. Its spec makes privacy the
default [WEB §3.10] and carried a register of 30 open items (DN-01 to DN-30), all now decided
[WEB §9]. This ADR records the ones that constrain the build. Items with their own ADR are not
repeated: the offer (0041), web scope (0050), the CMS (0055), status page and mailboxes (0056),
imagery (0057).

## Decision

1. **Zero third-party scripts before consent.** The default is strictly necessary storage only;
   no analytics, marketing or third-party script runs before an explicit opt-in. The performance
   budget states it as a number: third-party scripts before consent = 0 [WEB §3.7], [WEB §3.10].
2. Before consent the analytics library is **not loaded at all** [WEB §3.11]. Analytics is
   PostHog Cloud behind consent; there are no marketing pixels and no paid attribution vendor
   [OD-06], [WEB §9 DN-06, DN-07].
3. The banner (W03) offers "Accept all", "Reject all" and "Choose" at equal visual weight, with
   no pre-ticked boxes; closing it means reject. Global Privacy Control is honoured as reject
   [WEB §3.10].
4. Consent is stored in the first-party cookie `mm_consent` for 6 months, then re-asked; a
   pseudonymous receipt (no IP) is logged server-side in `consent_receipts`
   [WEB §3.10], [WEB §9 DN-17], [SQL].
5. Forms are protected by a honeypot, rate limits and a minimum time-to-submit; **no CAPTCHA**
   [WEB §9 DN-09].
6. Locale URLs: English at the root, `/pcm/` and `/fr/` prefixed; core pages are translated and
   others fall back to English [WEB §9 DN-11, DN-23].
7. Proof figures and social links render only when a real, sourced value exists; no placeholder
   numbers [WEB §0.3 #7], [WEB §9 DN-13].
8. The content security policy is nonce-based with no inline scripts; the analytics host is
   allowed only after consent [WEB §3.12].

## Alternatives considered

From the register [WEB §9]: analytics by a self-hosted cookieless tool, GA4 or none (DN-06);
paid mobile attribution vendors (DN-07); an invisible challenge token for bots (DN-09); all
locales prefixed, including `/en/` (DN-11); a 12-month consent lifetime (DN-17). Each lost to the
recommended default shown in the register.

## Consequences

- Easier: with no script before consent, the site meets its transfer and script budgets for
  every first visit, and a strict content security policy is practical.
- Harder: client analytics cover only consenting visitors, so server-side counts are the source
  of truth for the metrics [WEB §1.4].
- Harder: bot protection without a puzzle depends on server-side signals; thresholds are
  admin-tunable rate-limit policies and must be watched after launch.

## How it is applied

- The website is built in [MOD-15](../execution/1MM-EXE-MOD-15-CMS-AND-PUBLIC-WEBSITE.md); the
  consent manager W03 and the receipts API in
  [MOD-16](../execution/1MM-EXE-MOD-16-LEGAL-PRIVACY-AND-DATA-OPERATIONS.md) (ruling R22, [master plan](../execution/1MM-EXE-00-MASTER-PLAN.md) section 7); the
  shared form pipeline in MOD-14 (ruling R24); website events in MOD-18. The static build is
  [1MM-ADR-0033](1MM-ADR-0033-WEBSITE-ASTRO-STATIC.md).
- Checks: an end-to-end test on a fresh browser profile that inspects network and storage for
  zero analytics or marketing requests and cookies before a choice [WEB W03]; a test with
  `Sec-GPC: 1`; the website QA checklist [WEB §8] at the launch gate.

## Revisit when

A marketing channel needs a pixel (a new owner decision and a consent category change), bot
traffic defeats the current protection, or a market's law changes the consent rules.
