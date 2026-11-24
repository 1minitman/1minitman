# 1MM-ADR-0049 · Trusted-contact safety links live on `1minitman.com/s/<token>`

|                  |                                                                                               |
| ---------------- | --------------------------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                                      |
| **Date decided** | 19 Nov 2026                                                                                   |
| **Decided by**   | Owner decision OD-13 (tracker item T-1)                                                       |
| **Sources**      | [OD-13], [ODT T-1], [UF §12.3 D57], [TR §4], [TR §18.3], [CB §5]                              |
| **Affects**      | apps/api, apps/site or edge routing, apps/worker (SMS and WhatsApp templates); MOD-13, MOD-11 |

## Context

When a member plans a meet-up, trusted contacts receive a message with the time, the place and
the match's verified profile [CB §5]. The message carries a short link (LG5). The designs showed
it on a separate short domain, which did not yet exist [ODT T-1].

## Decision

1. Trusted-contact links use `https://1minitman.com/s/<token>` [OD-13].
2. There is no separate short domain. The earlier short-domain form is replaced everywhere: the
   Technical Reference, the LG5 flow, screen copy and the short-link configuration [ODT T-1].

## Alternatives considered

- **A dedicated short domain** (the form shown on the boards). Not chosen: the recommendation,
  which the owner took, was the main domain because it is "no extra domain to buy or secure"
  [ODT T-1], [UF §12.3 D57].

## Consequences

- Easier: one domain, one certificate, one set of DNS and WAF rules; recipients see the product's
  own domain in an unexpected SMS.
- Harder: the path `/s/*` on the website's domain needs a rewrite to one static shell that renders
  from `GET /public/v1/share/{token}` (TRX-010), although the rest of the site is built ahead of
  time. The page is owned by MOD-13, not by the website module.
- Harder: links are a few characters longer in an SMS.

## How it is applied

- The page and its API are in
  [MOD-13](../execution/1MM-EXE-MOD-13-MEETUPS-AND-PERSONAL-SAFETY.md); the message templates in
  [MOD-11](../execution/1MM-EXE-MOD-11-NOTIFICATIONS-AND-COMMUNICATIONS.md).
- The token carries no personal data, in line with the website rule that tokens in links are
  random and never reveal personal data [WEB §3.10]; handling of tokenised pages follows
  [1MM-STD-11](../standards/1MM-STD-11-SECURITY-AND-COMPLIANCE.md).
- Checks: a `pnpm check:banned-terms`-style review that no template or copy uses the old short
  domain; an end-to-end test that a link opens the trusted-contact page and an unknown token
  returns the standard not-found answer.

## Revisit when

SMS length or deliverability data shows a shorter domain is needed, or the trusted-contact page
moves to its own host for isolation.
