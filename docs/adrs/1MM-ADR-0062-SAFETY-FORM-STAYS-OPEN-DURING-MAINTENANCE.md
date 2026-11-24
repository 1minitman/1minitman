# 1MM-ADR-0062 · The website safety report form stays open during maintenance

|                  |                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                                |
| **Date decided** | 21 Nov 2026                                                                             |
| **Decided by**   | Owner decision OD-32 (default under the standing instruction)                           |
| **Sources**      | [OD-32], [DDR W12], [TR §6], [TR §18.2b], [WEB W34], [WEB W06], [SQL]                   |
| **Affects**      | apps/api (`/public/v1`), apps/site (W34, W06), apps/admin (A28); MOD-14, MOD-15, MOD-02 |

## Context

The website can be put into maintenance from the admin console. The boards disagreed about what
happens to forms while it is on; the design data review recorded the conflict and took "the safer
rule" [DDR W12], [SQL seed comment]. A safety report can concern a threat or a possible minor, and
it is the one form a visitor may need precisely when the service is degraded.

## Decision

1. During maintenance the website safety report (W34) **stays open; every other form closes**
   [OD-32].
2. The exemption is data: `site_settings.maintenance.exempt_forms = ["safety_report"]` [SQL].
3. A safety report keeps its normal handling: an `SR-` reference and a priority, urgent for
   under-18 and threats [TR §6].

## Alternatives considered

- **Close every form during maintenance**, as some boards showed [DDR W12]. Not chosen: the
  safer rule was taken.

**Analysis:** a mailto fallback in place of the form would lose the reference, the priority and
the evidence upload.

## Consequences

- Easier: the exemption list is configuration, so another form can be exempted without a release.
- Harder: "maintenance" cannot mean "the public API is off". The submission path for an exempt
  form (route, validation, upload, storage, notification) must stay available while everything
  else answers `503` `maintenance`
  ([1MM-STD-13 §2.2](../standards/1MM-STD-13-ERROR-CODES.md)).
- Harder: a maintenance window that needs the database offline cannot honour the exemption; such
  a window must be announced on the status page
  ([1MM-ADR-0056](1MM-ADR-0056-HOSTED-STATUS-PAGE-AND-ONE-MAILBOX-WITH-ALIASES.md)) and kept
  short. **Analysis.**

## How it is applied

- The shared public form pipeline, including the "maintenance gate with exempt forms", is built
  once in [MOD-14](../execution/1MM-EXE-MOD-14-SUPPORT-AND-HELP.md) and reused (ruling R24, [master plan](../execution/1MM-EXE-00-MASTER-PLAN.md) section 7).
- The maintenance switch is edited in A28 ([MOD-15](../execution/1MM-EXE-MOD-15-CMS-AND-PUBLIC-WEBSITE.md));
  the read path and banner W06 are MOD-02 (ruling R13).
- Checks: an API test with maintenance on that the safety form succeeds and another form is
  refused; a test that changing `exempt_forms` changes the answer; an end-to-end run of W34 in
  maintenance.

## Revisit when

A second form proves safety-critical (add it to the list), or an incident shows the exempt path
was unavailable during maintenance.
