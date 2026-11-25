# 1MM-ADR-0055 · The website CMS is built inside the admin console

|                  |                                                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                                                        |
| **Date decided** | 20 Nov 2026                                                                                                     |
| **Decided by**   | Owner decision OD-21 (tracker item C-4, website item DN-21)                                                     |
| **Sources**      | [OD-21], [ODT C-4], [WEB §0.4], [WEB §6], [WEB §9 DN-21], [ADM §0.4 #1, #2], [ADM App. D AD-20], [TR §6], [SQL] |
| **Affects**      | apps/admin (A28–A30), apps/api (`/admin/v1`, `/public/v1`), apps/site, apps/worker, packages/db; MOD-15, MOD-16 |

## Context

The website's content (pages, sections, blocks, media, legal documents) must be editable by
staff, localised per field and published through a workflow [WEB §6]. The website spec left the
implementation open [WEB §9 DN-21]; because it could carry a subscription cost, the choice went
to the owner [ODT C-4].

## Decision

1. The CMS is built **inside the admin console** (A28–A30). No paid headless CMS [OD-21].
2. The console uses the **schema's** entity names (`site_pages`, `site_page_sections`,
   `site_blocks`, `media_library`, `legal_documents`), not the names in the website spec. The
   website's `media_assets` maps to `media_library`, never to member `media_assets`
   [ADM §0.4 #1].
3. The content workflow is draft → in review → approved → scheduled → published → archived; the
   status enum and workflow columns exist since schema v3.1 [ADM App. D AD-20], [ADM §0.4 #2].
4. The website reads published content through a read-only content API and rebuilds on publish
   [WEB §0.4]. Each row keeps a live revision, so the published snapshot keeps serving while a
   newer draft is edited; publishing is the job `site.publish`, with rollback on a failed smoke
   test [TR §6].

## Alternatives considered

- **A headless CMS product synced to the admin console** [WEB §9 DN-21]. Not chosen: the owner
  ruled out a paid CMS [OD-21].

## Consequences

- Easier: one sign-in, one permission model, one audit log and one approval mechanism cover
  content and everything else; no second vendor holds content or credentials.
- Harder: the editor, block catalogue, validation rules that block publishing [WEB §6.4],
  versioning and preview are ours to build and maintain.
- Cost: build effort in place of a subscription.

## How it is applied

- [MOD-15](../execution/1MM-EXE-MOD-15-CMS-AND-PUBLIC-WEBSITE.md) builds A28 and A29 and the
  public content routes; legal authoring (A30) is
  [MOD-16](../execution/1MM-EXE-MOD-16-LEGAL-PRIVACY-AND-DATA-OPERATIONS.md) (ruling R12, [master plan](../execution/1MM-EXE-00-MASTER-PLAN.md) section 7).
- The site banner and the maintenance switch are edited in A28; MOD-02 builds their read path
  (ruling R13).
- Checks: API tests for each workflow transition and the two-person rule; an end-to-end test that
  a publish reaches the built site and a failed smoke test rolls back.

## Revisit when

Content volume or editorial needs (many editors, complex layouts) outgrow the built-in editor.
