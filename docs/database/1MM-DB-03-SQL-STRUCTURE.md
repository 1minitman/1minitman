# 1MM-DB-03 · SQL structure

|              |                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Document** | 1MM-DB-03                                                                                                                                                                                                                                                                                                                                                                          |
| **Status**   | Approved baseline · v1.0 · 24 Nov 2026                                                                                                                                                                                                                                                                                                                                             |
| **Audience** | Engineers and coding agents                                                                                                                                                                                                                                                                                                                                                        |
| **Owner**    | Engineering lead (code owners of `packages/db`)                                                                                                                                                                                                                                                                                                                                    |
| **Sources**  | [SQL] (`packages/db/migrations/0001_baseline_v3_4.sql`), `packages/db/migrations/0006_partition_function_definer.sql`, `packages/db/src/client.ts`, `packages/db/src/schema/*`, [TR §8.1], [TR §8.4], [TR §8.5], [TR §10.2], [TR §10.4], [TR §13.1], [TR §15.2], [TR §17.3], [DD §13], [DD §15]                                                                                    |
| **Related**  | [1MM-DB-01](1MM-DB-01-SCHEMAS.md), [1MM-DB-02](1MM-DB-02-MIGRATIONS.md), [1MM-DB-04](1MM-DB-04-INDEXING.md), [1MM-DB-05](1MM-DB-05-SECURITY.md), [1MM-DB-06](1MM-DB-06-DATA-PROTECTION.md), [1MM-STD-14](../standards/1MM-STD-14-CODING-CONVENTIONS.md), [1MM-STD-16](../standards/1MM-STD-16-DEFENSIVE-PROGRAMMING.md), [1MM-STD-01](../standards/1MM-STD-01-TESTING-STRATEGY.md) |

**What this document is for and when to open it.** It explains how the SQL is organised, what
logic lives inside the database (every function and trigger), the constraint patterns the schema
uses, and how application code is expected to write SQL. Open it when you need to find something
in the 6,977-line baseline, before you call or change a database function, and when you review a
query.

## 1. How the baseline file is organised

`0001_baseline_v3_4.sql` has a preamble and 27 numbered sections (0 to 26). Line numbers are those
of the file in the repo; use them with a targeted read, never read the file whole.

| §   | From line | Section                                          | Contents                                                                                                                                                                                                                                                                                                                                                       |
| --- | --------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| –   | 1         | Preamble                                         | Version, changelog v1.1 → v3.4, the conventions block (keys, timestamps, soft delete, "only one" rules, money, PII class, Citus notes)                                                                                                                                                                                                                         |
| –   | 217       | Session and extensions                           | `SET client_min_messages`, `SET TimeZone = 'UTC'`, `CREATE EXTENSION IF NOT EXISTS` for `postgis`, `citext`, `pgcrypto`                                                                                                                                                                                                                                        |
| 0   | 225       | Helpers                                          | `uuid_v7`, `set_updated_at`, `forbid_mutation`, `age_years`, `ensure_monthly_partitions`, `app_current_user_id`, `app_env`, `jsonb_has_secret_keys`                                                                                                                                                                                                            |
| 1   | 316       | Domains                                          | The 6 domains and the 8 human-reference and audit-chain sequences                                                                                                                                                                                                                                                                                              |
| 2   | 341       | Enumerated types                                 | All 101 enums, one line each, in domain order                                                                                                                                                                                                                                                                                                                  |
| 3   | 446       | Reference catalogues                             | 22 tables; 3.1 plans, entitlements, products, prices; 3.2 i18n, notification catalogue, legal documents, help centre                                                                                                                                                                                                                                           |
| 4   | 808       | Admin console                                    | Staff identity, RBAC, MFA, approvals, the audit log and its chain functions; 4.1 console operations (recovery codes, trusted devices, notifications, saved views, exports, macros)                                                                                                                                                                             |
| 5   | 1232      | Member identity and auth                         | 14 tables                                                                                                                                                                                                                                                                                                                                                      |
| 6   | 1488      | Profile                                          | 13 tables; `enforce_max_children`                                                                                                                                                                                                                                                                                                                              |
| 7   | 1756      | Verification                                     | 8 tables                                                                                                                                                                                                                                                                                                                                                       |
| 8   | 1896      | Discovery, reactions, matches, intro, Spotlight  | 11 tables                                                                                                                                                                                                                                                                                                                                                      |
| 9   | 2098      | Messaging                                        | 10 tables                                                                                                                                                                                                                                                                                                                                                      |
| 10  | 2282      | Groups                                           | 5 tables                                                                                                                                                                                                                                                                                                                                                       |
| 11  | 2388      | Meet-ups and safety                              | 9 tables                                                                                                                                                                                                                                                                                                                                                       |
| 12  | 2553      | Trust and safety                                 | 15 tables                                                                                                                                                                                                                                                                                                                                                      |
| 13  | 2859      | Billing                                          | 14 tables                                                                                                                                                                                                                                                                                                                                                      |
| 14  | 3168      | Notifications                                    | 7 tables                                                                                                                                                                                                                                                                                                                                                       |
| 15  | 3306      | Support and feedback                             | 4 tables                                                                                                                                                                                                                                                                                                                                                       |
| 16  | 3383      | Legal, consent and privacy                       | 4 tables; `has_legal_hold`                                                                                                                                                                                                                                                                                                                                     |
| 17  | 3475      | Analytics and research                           | 10 tables                                                                                                                                                                                                                                                                                                                                                      |
| 18  | 3651      | Platform config, network monitoring, website CMS | 59 tables; 18.1 website CMS; 18.2 new CMS tables; 18.2b offers and their guard functions; 18.3 content workflow (functions and the loop that adds columns, constraints, indexes and triggers to the ten workflow tables); 18.4 four-eyes on production config; 18.5 v3.4 design-review additions (20 tables, 214 columns on 84 tables, `v_public_plan_prices`) |
| 19  | 5462      | Late foreign keys                                | 11 `ALTER TABLE ... ADD FOREIGN KEY` for tables defined after their referrers                                                                                                                                                                                                                                                                                  |
| 20  | 5478      | Functions                                        | Role, quota, refund guard, reactions, intro, unmatch                                                                                                                                                                                                                                                                                                           |
| 21  | 5754      | Views and materialised views                     | 12 of the 13 views and the 6 materialised views with their unique indexes                                                                                                                                                                                                                                                                                      |
| 22  | 5993      | Row-level security                               | 10 `ENABLE ROW LEVEL SECURITY`, `is_blocked_pair`, 14 policies                                                                                                                                                                                                                                                                                                 |
| 23  | 6046      | Partitions                                       | One call creating November 2026 to December 2027 for eight parents                                                                                                                                                                                                                                                                                             |
| 24  | 6054      | Seed data                                        | Reference data only; the v3.4 seeds; the late `remote_config.permission_key` foreign key; first population of the materialised views                                                                                                                                                                                                                           |
| 25  | 6894      | Citus scale-out plan                             | Comments only                                                                                                                                                                                                                                                                                                                                                  |
| 26  | 6960      | Database roles                                   | Comments only; the executable version is `packages/db/roles/roles.sql`                                                                                                                                                                                                                                                                                         |

Table counts per section come from the same script as [1MM-DB-01](1MM-DB-01-SCHEMAS.md) section 1
(22 + 16 + 14 + 13 + 8 + 11 + 10 + 5 + 9 + 15 + 14 + 7 + 4 + 4 + 10 + 59 = 221). The file's
sections are not the dictionary's domains: section 18.5 holds the v3.4 tables of every domain, and
the dictionary files them under their own domain ([1MM-DB-01](1MM-DB-01-SCHEMAS.md) section 4).

### 1.1 Layout of one table

Each table is a self-contained block, in this order:

```sql
CREATE TABLE <name> (
  <columns, each with its inline CHECK and REFERENCES>,
  <table-level PRIMARY KEY / UNIQUE / CHECK / FOREIGN KEY>
);
CREATE TRIGGER trg_<name>_upd BEFORE UPDATE ON <name> FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE [UNIQUE] INDEX ...;      -- every index of the table, directly under it
COMMENT ON TABLE <name> IS '...';
COMMENT ON COLUMN <name>.<col> IS '...';   -- where a column needs explaining
```

A function that serves one table sits beside it (for example `admin_audit_chain()` under
`admin_audit_log`, `redirects_no_chain()` under `redirects`); functions that span tables are in
sections 0 and 20. Lines changed after v3 carry a version tag and, for v3.4, the design-review item
id in a trailing comment (`-- v3.4 M9 ...`), which is how [DDR] items are traced to DDL.

Later migrations do not follow the section layout: one file, one concern
([1MM-DB-02](1MM-DB-02-MIGRATIONS.md)). They do keep the block order above for a new table.

## 2. What belongs in the database and what does not

The schema's stated rule is "every 'only one' rule is a constraint or unique index, not app
logic" [SQL] conventions. In practice the database holds:

| In the database                                                                                                                   | In the API or worker                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Invariants of a single row or a small set of rows: state and timestamp agree, a pair is ordered, one live subscription per member | Entitlement checks, quotas beyond the durable counter, slot limits ("Premium 20" is checked "in the API before calling", `decide_intro()` comment) |
| Races that must be serialised next to the data: reaction and match creation, intro decisions, code allocation, the audit chain    | Orchestration across services: payments, notifications, media processing                                                                           |
| Append-only guarantees and four-eyes backstops that must hold even if application code is wrong                                   | Permission checks (`v_admin_effective_permissions` is read, the decision is in code), rate limits (Redis)                                          |
| Values read from `remote_config` at the moment of the write, through `config_int()`                                               | Everything a person reads: copy, labels, lists (config bootstrap, i18n, CMS)                                                                       |

Rule for new work: add database logic only when it protects an invariant against concurrency or
against a faulty caller. Business flow stays in the application layer of the owning module
([1MM-STD-14](../standards/1MM-STD-14-CODING-CONVENTIONS.md)).

## 3. Database-side logic catalogue

All 40 functions (`grep '^CREATE OR REPLACE FUNCTION'`) and all 101 triggers (73 written out, 28
created by the section 18.3 loop). "Kind" is `fn` for a callable function and `trg` for a trigger
function. `0006` changes one property of one function and adds none.

### 3.1 Ids, time and session helpers

| Function                                                  | Kind              | Purpose                                                                                       |
| --------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------- |
| `uuid_v7(p_ts timestamptz DEFAULT clock_timestamp())`     | fn, SQL, volatile | Time-ordered UUID v7; the default of every entity primary key                                 |
| `set_updated_at()`                                        | trg               | `BEFORE UPDATE`: stamps `updated_at`                                                          |
| `age_years(p_birth date, p_on date DEFAULT CURRENT_DATE)` | fn, immutable     | Whole years on a day; used by the 18+ gate and discovery                                      |
| `app_current_user_id()`                                   | fn, stable        | The member id for RLS policies, from the transaction setting `app.user_id`; `NULL` when unset |
| `app_env()`                                               | fn, stable        | Environment name from the setting `app.env`; unset means `development`                        |
| `config_int(p_key text, p_default int)`                   | fn, stable        | Integer value of a `remote_config` key, or the default when the key is missing                |

`set_updated_at()` is attached 52 times: 44 written-out `trg_<table>_upd` triggers and 8
`trg_<table>_wf_upd` created by the workflow loop.

### 3.2 Append-only ledgers and the audit hash chain

| Function                                      | Kind       | Attached as                                                                                                                                                                                                                                                                                                                                                                                                      | Purpose                                                                                                                                                                               |
| --------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `forbid_mutation()`                           | trg        | `trg_audit_immutable` (`admin_audit_log`), `trg_mod_actions_immutable` (`moderation_actions`), `trg_consents_immutable` (`consent_records`), `trg_revisions_immutable` (`content_revisions`), `trg_consent_receipts_immutable` (`consent_receipts`), `trg_esc_updates_immutable` (`safety_escalation_updates`): `BEFORE UPDATE OR DELETE`. `trg_intro_decisions_final` (`intro_decisions`): `BEFORE UPDATE` only | Raises `42501` "<table> is append-only". The erasure path is described in [1MM-DB-06](1MM-DB-06-DATA-PROTECTION.md)                                                                   |
| `admin_audit_row_hash(p_prev bytea, r jsonb)` | fn, stable | –                                                                                                                                                                                                                                                                                                                                                                                                                | Hash formula v2: `sha256(prev_hash \|\| canonical JSON array of 'v2', chain_seq, id, created_at as UTC ISO-8601, and every audited field)`. Shared by the trigger and the verifier    |
| `admin_audit_chain()`                         | trg        | `trg_audit_chain BEFORE INSERT ON admin_audit_log`                                                                                                                                                                                                                                                                                                                                                               | Takes `pg_advisory_xact_lock(7240001)` to serialise the chain, then draws `chain_seq` from `admin_audit_chain_seq`, reads the previous `row_hash` and sets `prev_hash` and `row_hash` |

The order matters: the sequence value is drawn **after** the lock, so `chain_seq` is the true
chaining order; the verifier (job `audit.verify_chain`, results in `admin_audit_chain_runs`) walks
`chain_seq`, not `created_at` or `id` [TR §7.1], [TR §11]. `uq_audit_chain_seq (chain_seq,
created_at)` keeps the order unique. Every admin write therefore queues briefly on one advisory
lock; keep audit inserts at the end of the transaction so the lock is held for the shortest time
(**Recommendation**).

### 3.3 Admin access

| Function                                                                          | Kind          | Purpose                                                                                                                                                                                                                         |
| --------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `admin_issue_recovery_codes(p_admin uuid, p_hashes bytea[])`                      | fn            | Stores a batch of exactly 10 recovery-code digests and revokes the previous unused batch; returns the batch id. The comment names the audit event `admin.recovery_codes.issue` (the admin spec uses another name: GAP-MOD01-04) |
| `admin_consume_recovery_code(p_admin uuid, p_hash bytea, p_ip inet DEFAULT NULL)` | fn            | Single-use check under a row lock; returns `false` for unknown, used or revoked codes alike                                                                                                                                     |
| `jsonb_has_secret_keys(p jsonb)`                                                  | fn, immutable | Recursive test for secret-looking keys; used by the `CHECK` on `vendor_settings.settings` so that only secret references are stored                                                                                             |

### 3.4 Four-eyes and approval guards

| Function                    | Kind                                                              | Attached as                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Purpose                                                                                                                                                                                                                                                                                                                                          |
| --------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `enforce_config_approval()` | trg, `BEFORE INSERT OR UPDATE`                                    | `trg_flags_approval` (`feature_flags`, `config.flags`), `trg_rconfig_approval` (`remote_config`, `config.remote`), `trg_rlp_approval` (`rate_limit_policies`, `security.rate_limits`), `trg_vendor_approval` (`vendor_settings`, `config.vendors`), `trg_site_settings_approval` (`site_settings`, `site_settings.manage`; keys `maintenance` and `emergency_numbers` always need approval), `trg_countries_approval` and `trg_cities_approval` (`config.markets`) | Only when `app_env() = 'production'`. A change needs `approval_id` pointing at an approved `admin_approvals` row for the same permission, table and key; the approval is marked `executed` (single use). Exempt: bookkeeping-only updates, and switching a kill switch off. For `remote_config` the permission is the row's own `permission_key` |
| `refund_approval_guard()`   | trg, `BEFORE INSERT OR UPDATE ON refunds` (`trg_refund_approval`) | –                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | An admin-initiated refund above `billing.refund_approval_threshold_usd_cents` (seeded 0: every refund) needs an approved `billing.refund` or `billing.refund_large` approval decided by a different admin [OD-05]. Enforced in every environment                                                                                                 |

`maintenance_windows` has an `approval_id` column but no such trigger (GAP-MOD02-09); `languages`
is covered by neither market trigger (GAP-MOD02-07).

### 3.5 Roles and entitlements

| Function                                                                                                            | Kind                               | Purpose                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `compute_member_role(p_user uuid, p_at timestamptz DEFAULT now())`                                                  | fn, stable, returns `(role, plan)` | Source of truth for the ladder `BASIC` → `PENDING_REVIEW` → `ACTIVE` → `CLASSIC` → `SUPER` and the plan, from `users.is_verified`, open badge applications and live `entitlement_grants` ranked by `plans.rank` |
| `refresh_member_role(p_user uuid, p_reason text, p_actor actor_kind_t DEFAULT 'system', p_admin uuid DEFAULT NULL)` | fn                                 | Locks the `users` row, recomputes, updates the cached `users.role` and `users.plan`, and writes `role_history` on change. Called after every billing, verification or moderation event                          |

`users.role` and `users.plan` are caches; `v_role_drift` must return no rows, and job
`entitlements.reconcile` checks it hourly [TR §10.2].

### 3.6 Quotas

| Function                                         | Kind                                       | Purpose                                                                                                                                                                                                 |
| ------------------------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `daily_spec_cap(p_role member_role_t)`           | fn, stable                                 | `NULL` (no limit) for `CLASSIC` and `SUPER`; `discovery.daily_cap.verified_free` for `ACTIVE`; `discovery.daily_cap.basic` otherwise [OD-03]                                                            |
| `spend_spec_view(p_user uuid, p_local_day date)` | fn, returns `(o_allowed, o_used, o_limit)` | Durable quota: upserts the `usage_counters` row for the member's local day, locks it, refuses at the cap, otherwise increments. Redis `quota:*` is the fast path; this is the source of truth [TR §8.5] |

### 3.7 Matching, intro and unmatch

| Function                                                                                                              | Kind                                                                                    | Purpose                                                                                                                                                                                    | Endpoint named in its comment   |
| --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| `record_reaction(p_actor, p_target, p_kind reaction_t, p_client_id uuid, p_surface feed_surface_t DEFAULT 'for_you')` | fn, returns `(o_reaction_id, o_replayed, o_match_id, o_match_kind, o_intro_session_id)` | Race-free, idempotent reaction and match creation (section 5)                                                                                                                              | `POST /v1/reactions`            |
| `undo_reaction(p_actor, p_target, p_via text DEFAULT 'undo_toast')`                                                   | fn                                                                                      | Undoes a Pass inside `undo_until`, or at any time when `p_via = 'rewind'` (the entitlement is checked by the API); removes the pass cooldown; writes `reaction_history`                    | –                               |
| `decide_intro(p_session, p_user, p_decision intro_decision_t)`                                                        | fn, returns text                                                                        | Blind, final decision under a row lock on the session. Both keep: creates the conversation and its two participants. Otherwise: marks the match `moved_on` and writes a cooldown both ways | `POST /v1/intros/{id}/decision` |
| `unmatch(p_match, p_user)`                                                                                            | fn                                                                                      | Under a row lock on the match: ends it, closes the conversation, writes a cooldown both ways from `unmatch.cooldown_days`                                                                  | –                               |

### 3.8 Child-count limits

| Function                 | Kind                                                            | Attached as                                                                                                                                                     | Purpose                                                                                                                          |
| ------------------------ | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `enforce_max_children()` | constraint trg, `AFTER INSERT`, `DEFERRABLE INITIALLY DEFERRED` | `trg_profile_vibes_max` (10 per `user_id`), `trg_intl_countries_max` (5), `trg_trusted_max` (3 live, `AND removed_at IS NULL`), `trg_profile_languages_max` (6) | Counts the rows of the parent at commit and raises `23514` above the maximum. Arguments: column, maximum, optional extra `WHERE` |

The maxima are trigger arguments, so they are database ceilings. Where a config key exists for
the same limit (`trusted_contacts.max` = 3), the key may be lowered but not raised above the
ceiling; MOD-02 refuses a value above a database-enforced limit
([MOD-02](../execution/1MM-EXE-MOD-02-PLATFORM-CONFIG-AND-CATALOGUES.md) rule 4).

### 3.9 Partition maintenance

| Function                                                              | Kind                           | Purpose                                                                                                                                                                                                                                        |
| --------------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ensure_monthly_partitions(p_parent text, p_from date, p_months int)` | fn, returns the number created | Creates missing `<parent>_pYYYYMM` range partitions. `SECURITY DEFINER` with `search_path = public, pg_temp` and `EXECUTE` revoked from `PUBLIC` (migration `0006`); granted to `app_worker` in `roles.sql`. Called by job `partitions.ensure` |

### 3.10 Legal, privacy and beta access

| Function                                             | Kind                                                   | Attached as                                            | Purpose                                                                                                                                        |
| ---------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `has_legal_hold(p_kind text, p_id uuid)`             | fn, stable                                             | –                                                      | True while a hold that is live or pending approval covers the subject; erasure and retention jobs call it before deleting                      |
| `legal_published_immutable()`                        | trg                                                    | `trg_legal_immutable BEFORE UPDATE ON legal_documents` | The text, version and dates of a published legal document cannot change; archiving is allowed                                                  |
| `redeem_beta_invite(p_code_hash bytea, p_user uuid)` | fn                                                     | –                                                      | Single-use redemption of a closed-beta invite under a row lock; refuses unknown, used, revoked or expired codes [OD-09]                        |
| `is_blocked_pair(p_a uuid, p_b uuid)`                | fn, stable, `SECURITY DEFINER`, `search_path = public` | Used by policy `profiles_read`                         | True when either person has a live block on the other; definer rights let the policy see blocks in both directions despite the RLS on `blocks` |

### 3.11 Content workflow, snapshots and website paths

| Function                                | Kind                           | Attached as                                                                           | Purpose                                                                                                                                                                                                                                                                                    |
| --------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `content_workflow_tables()`             | fn, immutable                  | –                                                                                     | The array of the ten workflow tables: `site_pages`, `site_blocks`, `stories`, `careers_jobs`, `investor_documents`, `press_items`, `help_articles`, `legal_documents`, `faqs`, `journal_articles`                                                                                          |
| `content_workflow_guard()`              | trg, `BEFORE INSERT OR UPDATE` | `trg_<table>_workflow` on each of the ten                                             | Allowed transitions only (draft → in_review → approved → scheduled → published → archived, and published → draft for a new version except on legal documents); the two-person rule; scheduling; native review before `pcm` / `fr` publish; maintains `live_revision_id` and `live_version` |
| `content_snapshot()`                    | trg, `AFTER INSERT OR UPDATE`  | `trg_<table>_snapshot` on each of the ten                                             | Writes an immutable publish snapshot (`to_jsonb(NEW)`) to `content_revisions` when an item becomes published or a published item gets a new version. Page sections are separate rows outside the snapshot (GAP-MOD15-01)                                                                   |
| `content_run_schedule()`                | fn, returns per-table counts   | –                                                                                     | Job `content.schedule` (every minute): publishes due scheduled items and archives items past `unpublish_at`, row by row with `FOR UPDATE SKIP LOCKED`; one failing row does not block the rest                                                                                             |
| `site_path(p_locale, p_prefix, p_slug)` | fn                             | –                                                                                     | Public path of a CMS item: `en` at the root, `pcm` and `fr` under their prefix                                                                                                                                                                                                             |
| `site_slug_redirect()`                  | trg, `AFTER UPDATE OF slug`    | `trg_site_pages_slug`, `trg_journal_slug`, `trg_stories_slug`, `trg_careers_slug`     | After a published item's slug changes, upserts a 301 from the old path and re-points redirects that targeted it                                                                                                                                                                            |
| `redirects_no_chain()`                  | trg                            | `trg_redirects_no_chain BEFORE INSERT OR UPDATE OF from_path, to_target ON redirects` | Refuses loops and chains longer than one hop                                                                                                                                                                                                                                               |
| `contact_submission_defaults()`         | trg                            | `trg_contact_defaults BEFORE INSERT ON contact_submissions`                           | Website safety reports get an `SR-` reference, an urgent priority for under-18 and threats, and `sla_due_at` from `contact.safety_sla_minutes.urgent` / `.normal`                                                                                                                          |

### 3.12 Offers (module off at launch, OD-01)

| Function                         | Kind | Attached as                                                           | Purpose                                                                                                                                                                                                      |
| -------------------------------- | ---- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `offer_campaign_guard()`         | trg  | `trg_offer_campaign_guard BEFORE INSERT OR UPDATE ON offer_campaigns` | Going live needs flag `offers.enabled` on, published offer terms and an approved `offers.publish`; live changes to eligibility, caps or dates need a new approval                                            |
| `offer_claim_guard()`            | trg  | `trg_offer_claim_guard BEFORE INSERT ON offer_claims`                 | Live window, eligible country, channel, one claim per identifier hash, total cap, IP-prefix hourly limit and a circuit breaker that pauses the campaign; a failing claim is stored as rejected with a reason |
| `offer_issue_code(p_claim uuid)` | fn   | –                                                                     | Allocates one available code with `SKIP LOCKED`, wipes the encrypted value and returns it once; an empty pool pauses the campaign                                                                            |
| `offer_end_expired()`            | fn   | –                                                                     | Job `offers.end`: ends campaigns at `ends_at`                                                                                                                                                                |

### 3.13 Trigger totals

| Trigger function                                                                                                                                                            | Written out | From the 18.3 loop | Total   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------ | ------- |
| `set_updated_at`                                                                                                                                                            | 44          | 8                  | 52      |
| `content_workflow_guard`                                                                                                                                                    | 0           | 10                 | 10      |
| `content_snapshot`                                                                                                                                                          | 0           | 10                 | 10      |
| `forbid_mutation`                                                                                                                                                           | 7           | 0                  | 7       |
| `enforce_config_approval`                                                                                                                                                   | 7           | 0                  | 7       |
| `enforce_max_children`                                                                                                                                                      | 4           | 0                  | 4       |
| `site_slug_redirect`                                                                                                                                                        | 4           | 0                  | 4       |
| `admin_audit_chain`, `refund_approval_guard`, `redirects_no_chain`, `offer_campaign_guard`, `offer_claim_guard`, `contact_submission_defaults`, `legal_published_immutable` | 1 each      | 0                  | 7       |
| **Total**                                                                                                                                                                   | **73**      | **28**             | **101** |

### 3.14 Rules for database functions

1. Callable functions are invoked by the owning module's repository through a typed wrapper in
   `packages/db` (for example `MOD-07-DB-01` wraps `record_reaction()`, `undo_reaction()` and
   `spend_spec_view()`). No other module calls them directly.
2. A function raises with an `ERRCODE` the wrapper can map: the baseline uses `42501` (not
   allowed), `22023` (invalid argument), `23514` (rule violated), `23502` (missing value), `P0002`
   (not found), and a `HINT` where the client needs a reason (`record_reaction()` hints
   `black_badge`). The wrapper turns these into the problem types of
   [1MM-STD-13](../standards/1MM-STD-13-ERROR-CODES.md); raw database errors never reach a
   response.
3. A number a person can meet is read with `config_int('<key>', <seeded default>)`, never written
   as a literal. Known exceptions are listed in section 9.
4. `SECURITY DEFINER` only when a role needs one narrow action it has no right to; always with a
   pinned `search_path` and `EXECUTE` revoked from `PUBLIC` ([1MM-DB-05](1MM-DB-05-SECURITY.md)).
5. Every function has a `COMMENT ON FUNCTION` stating its caller (endpoint or job) and its rule.
   In the baseline 36 of 40 do; `admin_audit_chain`, `age_years`, `config_int` and
   `is_blocked_pair` have only the `--` comment line above their definition.
6. Changing a function is a migration with `CREATE OR REPLACE` and a behaviour test
   ([1MM-DB-02](1MM-DB-02-MIGRATIONS.md) section 5.3).

## 4. Constraint patterns

Counts are line counts in the baseline: 766 lines contain `CHECK (`, 437 contain `REFERENCES`, 49
`CREATE UNIQUE INDEX`, 165 index statements carry a `WHERE`.

### 4.1 `CHECK` constraints for state invariants

| Pattern                                     | Real example                                                                                                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A flag and its timestamp agree              | `users`: `CHECK (is_verified = (verified_at IS NOT NULL))`                                                                                             |
| A status implies a column                   | `users`: `CHECK ((status = 'deletion_pending') = (deletion_scheduled_for IS NOT NULL))`; `matches`: `CHECK ((status = 'active') = (ended_at IS NULL))` |
| A role implies a fact                       | `users`: `CHECK (role NOT IN ('ACTIVE','CLASSIC','SUPER') OR is_verified)`                                                                             |
| Canonical form                              | `users`: `CHECK (email = lower(btrim(email::text)))`                                                                                                   |
| Ordered pair, so one row represents a pair  | `matches`: `CHECK (user_a < user_b)`                                                                                                                   |
| No self-reference                           | `reactions`: `CHECK (actor_id <> target_id)`                                                                                                           |
| A column only applies to one kind           | `reactions`: `CHECK (kind = 'pass' OR undo_until IS NULL)`                                                                                             |
| Two columns move together                   | `conversation_participants`: `CHECK (holds_slot = (slot_acquired_at IS NOT NULL))`                                                                     |
| Mutually exclusive states                   | `admin_recovery_codes`: `CHECK (used_at IS NULL OR revoked_at IS NULL)`                                                                                |
| Bounded text and numbers                    | `users.first_name`: `CHECK (char_length(first_name) BETWEEN 1 AND 40)`; `messages.body`: `CHECK (char_length(body) <= 2000)`                           |
| Closed set without an enum                  | `matches.ended_reason`: `CHECK (ended_reason IN ('unmatch','block','moved_on','intro_expired','account_deleted','moderation'))`                        |
| A value that must never be stored           | `messages`: `CHECK (safety_verdict <> 'blocked')` (blocked sends are `message_failures`)                                                               |
| Format through a domain                     | `e164`, `iso_country`, `app_locale`, `hex_colour`, `sha256_hash`, `usd_cents`                                                                          |
| Workflow columns (added by the loop, named) | `ck_<table>_wf_scheduled`: `CHECK (status <> 'scheduled' OR publish_at IS NOT NULL)`                                                                   |

A `CHECK` that fixes a number which is also an editable config key is a defect, not a pattern:
see section 9.

### 4.2 Partial unique indexes as business rules

This is the schema's main tool for "only one live X".

| Rule                                                 | Index                                                                                                                      |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| One account per e-mail among non-deleted members     | `uq_users_email ON users (email) WHERE deleted_at IS NULL`                                                                 |
| One active match per pair                            | `uq_matches_active_pair ON matches (user_a, user_b) WHERE status = 'active'`                                               |
| One open conversation per pair                       | `uq_conv_live_pair ON conversations (user_a, user_b) WHERE state <> 'closed'`                                              |
| One live subscription per member (a held one counts) | `uq_subs_one_live ON subscriptions (user_id) WHERE status IN ('trialing','active','grace','on_hold','cancelled','paused')` |
| One open badge application per member                | `uq_badge_open ON badge_applications (user_id) WHERE status IN ('draft','submitted','in_review','needs_fix')`              |
| One open pending action per gate                     | `uq_pending_action_open ON pending_actions (user_id, gate) WHERE completed_at IS NULL`                                     |
| One open re-verification request                     | `uq_reverify_open ON reverification_requests (user_id) WHERE status = 'open'`                                              |
| One live answer per prompt slot                      | `uq_prompt_slot ON prompt_answers (user_id, position) WHERE removed_at IS NULL`                                            |
| One default payment method                           | `uq_payment_methods_default ON payment_methods (user_id) WHERE is_default AND removed_at IS NULL`                          |
| No duplicate live trusted-contact number             | `uq_trusted_phone ON trusted_contacts (user_id, phone) WHERE removed_at IS NULL`                                           |

Two consequences for code: an `INSERT ... ON CONFLICT` against such an index must repeat its
predicate (`ON CONFLICT (user_a, user_b) WHERE status = 'active'`, as `record_reaction()` does);
and changing which states count as "live" is a schema change with a product decision behind it
(v3.4 added `on_hold` to `uq_subs_one_live`). Index design itself is in
[1MM-DB-04](1MM-DB-04-INDEXING.md).

### 4.3 Plain unique keys for idempotency

| Rule                                   | Key                                                                                                                |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| One reaction per direction             | `reactions UNIQUE (actor_id, target_id)`                                                                           |
| Outbox replay of a reaction is safe    | `reactions UNIQUE (actor_id, client_reaction_id)`                                                                  |
| Outbox replay of a message is safe     | `message_client_ids PRIMARY KEY (sender_id, client_msg_id)`, inserted first in the same transaction as the message |
| One intro session per match            | `intro_sessions.match_id ... UNIQUE`                                                                               |
| One decision per person per intro      | `intro_decisions PRIMARY KEY (intro_session_id, user_id)`                                                          |
| A recovery code cannot be stored twice | `admin_recovery_codes UNIQUE (admin_id, code_hash)`                                                                |

Group messages have no such ledger yet (GAP-MOD12-03).

### 4.4 Exclusion constraints

There are none: the baseline contains no `EXCLUDE` clause and does not install `btree_gist`.
Overlap rules that an exclusion constraint could express are written as partial unique indexes
(above) or as trigger checks (`offer_claim_guard()`). **Recommendation:** if a future rule is a
true range overlap (for example two maintenance windows that may not overlap), raise it as a
schema gap first, because `btree_gist` would be a fourth extension [TR §4.3].

### 4.5 Deferrable constraints

| Object                                                                                            | Declared                                                                            | Why                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `trg_profile_vibes_max`, `trg_intl_countries_max`, `trg_trusted_max`, `trg_profile_languages_max` | `CREATE CONSTRAINT TRIGGER ... DEFERRABLE INITIALLY DEFERRED`                       | The count is checked at commit, so a transaction may replace a member's whole set (delete and insert in any order) without tripping the limit midway                                                |
| `live_revision_id` on the ten workflow tables                                                     | `REFERENCES content_revisions(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED` | `content_workflow_guard()` sets the id before the row is written and `content_snapshot()` inserts the revision with that id afterwards, in the same transaction; the reference is checked at commit |

These are the only five uses of `DEFERRABLE`. Do not add `SET CONSTRAINTS ... IMMEDIATE` in
application code.

### 4.6 Foreign keys

- Every foreign key states its delete action where the default would be wrong: `CASCADE` for rows
  that are part of the member (profile, media, reactions), `SET NULL` for attribution and optional
  links, `RESTRICT` where history must survive (`badge_applications.payment_transaction_id`).
- A child of a partitioned table references the full composite key
  (`message_attachments (conversation_id, message_id, message_created_at) → messages`).
- High-volume append-only tables deliberately have no foreign keys (`feed_impressions`,
  `reaction_history`, `analytics_events`, `message_client_ids`).
- Tables defined before their targets get the key in section 19.
- In Citus mode, cross-shard foreign keys are enforced by the API and dropped in the database
  (section 25 comment); nothing in the application may rely on a cascade that would cross shards.

## 5. Race-free matching as SQL structure

[TR §8.4] specifies the behaviour; this is how the DDL carries it. The API calls
`record_reaction(actor, target, kind, client_id, surface)` in one transaction.

| Step      | What the function does                                                                                                                                                                                                   | The structure that makes it safe                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| 1 Replay  | Looks up `(actor_id, client_reaction_id)`; if found, returns the original reaction, the active match and its intro session with `o_replayed = true`                                                                      | `UNIQUE (actor_id, client_reaction_id)`                                                                                         |
| 2 Gate    | Like and Somewhat need role `ACTIVE`, `CLASSIC` or `SUPER`; otherwise raises `42501` with hint `black_badge`. Pass is open to all                                                                                        | `users.role` (cache of `compute_member_role()`); `CHECK (role NOT IN (...) OR is_verified)`                                     |
| 3 Blocks  | Raises `42501` if either has a live block on the other                                                                                                                                                                   | `blocks` rows with `unblocked_at IS NULL`                                                                                       |
| 4 Lock    | `pg_advisory_xact_lock(hashtextextended(low_id \|\| ':' \|\| high_id, 0))`                                                                                                                                               | A transaction-level lock keyed on the ordered pair: only the two people involved wait, and it is released at commit or rollback |
| 5 Upsert  | Inserts the reaction or updates the existing one for that direction; a Pass sets `undo_until` from `discovery.pass_undo_seconds` and a `pair_cooldowns` row from `discovery.pass_memory_days`; writes `reaction_history` | `UNIQUE (actor_id, target_id)`; `pair_cooldowns` primary key `(user_id, other_id, reason)`                                      |
| 6 Reverse | Reads the other person's live reaction. Like + Like is `match`; any other mix of Like and Somewhat is `maybe`; none or Pass ends here                                                                                    | `reactions.undone_at IS NULL`                                                                                                   |
| 7 Match   | Inserts the match with `intro_expires_at` from `intro.window_hours`; on conflict upgrades `maybe` to `match`, never the reverse                                                                                          | `CHECK (user_a < user_b)` and `uq_matches_active_pair` make a second active match for the pair impossible even without the lock |
| 8 Intro   | Inserts the intro session with `duration_s` from `intro.seconds`, `ON CONFLICT (match_id) DO NOTHING`                                                                                                                    | `intro_sessions.match_id UNIQUE`                                                                                                |

Design points to keep when this is extended:

1. **Three independent defences.** The advisory lock serialises the two actors; the partial unique
   index makes a duplicate impossible if the lock were ever bypassed; the client id makes a retry
   harmless. Do not remove one because another exists.
2. **Ordered pair.** Every pair table stores `LEAST(a, b)` in `user_a` and `GREATEST(a, b)` in
   `user_b`. Lookups by the other member use the indexes on `user_b`.
3. **Config at write time.** The window, the intro length and the cooldowns are read through
   `config_int()` inside the transaction, so an admin change applies to the next reaction and never
   rewrites existing rows.
4. **Related functions** lock a row, not the pair: `decide_intro()` takes `FOR UPDATE` on the
   session, `unmatch()` on the match, `refresh_member_role()` on the member,
   `spend_spec_view()` on the counter row.
5. **Still to prove.** The verification engine ran on a single connection, so the advisory lock was
   never tested under concurrency; a parallel-connection test on PostgreSQL 16 is required before
   beta [TR §10.4] and is specified in
   [1MM-STD-01](../standards/1MM-STD-01-TESTING-STRATEGY.md) (`MOD-00-DB-02`, `MOD-07-DB-01`).

The same pattern (idempotency key, serialising lock, uniqueness as the last line) is the template
for any new "exactly once" write: webhook intake uses the provider event key on `webhook_events`,
message send uses `message_client_ids`.

## 6. How the application writes SQL

### 6.1 The stack

| Layer                    | Rule                                                                                                                                                                                                                                                                 | Source                                                                     |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Driver and pool          | `createDatabase({ url, max, applicationName })` from `@1minitman/db` returns `{ db, sql, close }`. Every connection is UTC and named (`api`, `worker`) so it can be found in `pg_stat_activity`. Runtime uses the pooled URL; migrations and pg-boss use direct URLs | `packages/db/src/client.ts`, `.env.example`                                |
| Query builder            | Drizzle (`db`) with the models from `@1minitman/db/schema`. Queries are parameterised; string-built SQL is banned                                                                                                                                                    | [TR §13.1], [1MM-STD-16](../standards/1MM-STD-16-DEFENSIVE-PROGRAMMING.md) |
| Where SQL may be written | Only in a module's `infrastructure/` layer (repositories) and in `packages/db`. `domain/` and `application/` never import `drizzle-orm` or `postgres`                                                                                                                | [1MM-STD-14](../standards/1MM-STD-14-CODING-CONVENTIONS.md)                |
| Roles                    | The member API connects as `app_api` (`DATABASE_URL`), the admin API as `app_admin_api` (`ADMIN_DATABASE_URL`), the worker as `app_worker` (`WORKER_DATABASE_URL`)                                                                                                   | `.env.example`, [1MM-DB-05](1MM-DB-05-SECURITY.md)                         |

### 6.2 Raw SQL policy

The Drizzle builder is the default. Raw SQL is allowed, through the tagged template only
(`` sql`...` `` from `drizzle-orm`, or the `postgres` client's tagged template as
`apps/worker/src/jobs/partitions-ensure.ts` does), in these cases:

1. Calling a database function (`SELECT * FROM record_reaction(...)`).
2. PostGIS expressions (`ST_DWithin`, `ST_X`, `ST_Y`) and other operators the builder lacks.
3. Reading a view or materialised view that has no model, and `REFRESH MATERIALIZED VIEW
CONCURRENTLY`.
4. Row-value comparisons for keyset pagination (section 6.4).
5. Locking clauses the builder cannot express (`FOR UPDATE SKIP LOCKED` in queue claims).

Never allowed: concatenating or interpolating a value or an identifier into a SQL string;
`sql.unsafe()` and `sql.raw()` outside `packages/db` (the migrator and the roles CLI are the only
users); a dynamic `ORDER BY` built from request input (map the request's sort name to a fixed
expression in code). The lint rule that [TR §13.1] assumes does not exist yet (GAP-STD11-02,
GAP-STD16-03); until it does, this is a review item.

### 6.3 Transactions and the RLS context

The member API "sets `SET LOCAL app.user_id` for each transaction" [TR §8.1]. Policies compare
rows with `app_current_user_id()`, which returns `NULL` when the setting is absent, so a member
query outside such a transaction sees no protected rows, with one exception: `profiles_read` still
returns every non-hidden profile (GAP-DB05-03 in [1MM-DB-05](1MM-DB-05-SECURITY.md)).

MOD-00 delivers the helpers `withMemberTx(memberId, fn)`, `withAdminTx` and `withWorkerTx` in
`packages/db` ([MOD-00](../execution/1MM-EXE-MOD-00-FOUNDATIONS.md), cross-cutting item 5). What
`withMemberTx` must do:

```ts
// Shape only: the helper is built in MOD-00.
await db.transaction(async (tx) => {
  await tx.execute(sql`SELECT set_config('app.user_id', ${memberId}, true)`); // true = transaction-local
  return fn(tx);
});
```

Rules:

1. Every member query runs inside `withMemberTx`. There is no "quick read" outside it.
2. The id is passed as a bound parameter through `set_config(..., true)`, which is the
   parameterisable form of `SET LOCAL`. Never build `SET LOCAL app.user_id = '...'` as a string.
3. The setting must be transaction-local. The runtime connection goes through Neon's pooler; a
   session-level `SET` would leak one member's id to the next request on that connection.
4. One request, one transaction for its writes. Do not call an external service (payment
   provider, e-mail, push) inside a transaction; write an outbox row and let the worker deliver.
5. A function that takes locks (`record_reaction()`, `decide_intro()`, `spend_spec_view()`) is
   called inside the same transaction as the rest of the use case, and transactions stay short:
   the pair lock and the audit-chain lock are held until commit.
6. Admin and worker transactions bypass RLS, so their repositories carry the whole burden:
   explicit predicates, permission checks in code, and an audit row for every admin write
   ([1MM-STD-16](../standards/1MM-STD-16-DEFENSIVE-PROGRAMMING.md)).
7. Use the default isolation level (read committed). A use case that needs more takes an explicit
   row lock (`FOR UPDATE`) or uses a database function, as the baseline does; it does not raise
   the isolation level.
8. `app.env` is a connection-level setting of the environment (not of the request) and is set by
   configuration, never by request code.

### 6.4 Keyset pagination, never `OFFSET`

"Pagination: keyset (cursor), never OFFSET" [TR §8.1]. The cursor is opaque to clients and encodes
`(sort_key, id)`; list responses carry `next_cursor` and `has_more`
([1MM-STD-14](../standards/1MM-STD-14-CODING-CONVENTIONS.md), `CursorQuerySchema` in
`packages/contracts`).

Rules:

1. Sort by an indexed column plus a unique tiebreaker (`id`). A sort on a non-indexed column is
   refused with a 422.
2. Compare as a row value so the index is used in one range scan.
3. Fetch `limit + 1` rows to compute `has_more`; never run a `count(*)` for a pager.
4. The `WHERE` of the first page and of every later page is identical apart from the cursor
   predicate.

Example: a chat thread, newest first, served by `idx_messages_thread ON messages (conversation_id,
created_at DESC)`:

```sql
-- First page
SELECT id, created_at, sender_id, kind, body
  FROM messages
 WHERE conversation_id = $1
 ORDER BY created_at DESC, id DESC
 LIMIT $2;                                   -- $2 = page size + 1

-- Next page: the cursor decodes to (created_at, id) of the last row returned
SELECT id, created_at, sender_id, kind, body
  FROM messages
 WHERE conversation_id = $1
   AND (created_at, id) < ($3, $4)
 ORDER BY created_at DESC, id DESC
 LIMIT $2;
```

In Drizzle the cursor predicate is the one raw fragment:
`` sql`(${messages.createdAt}, ${messages.id}) < (${cursor.createdAt}, ${cursor.id})` ``.

On a partitioned table, bound the time range when the product allows it, so the planner prunes
partitions. `v_chat_list` is documented as "order by last_message_at DESC, keyset paginated"; its
cursor is `(last_message_at, conversation_id)`. Which index serves which list is recorded in
[1MM-DB-04](1MM-DB-04-INDEXING.md).

### 6.5 Query style rules

| #   | Rule                                                                                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Name the columns you need. No `SELECT *` in application queries (views and function results excepted)                                                     |
| 2   | Every query on a member-owned table carries an ownership predicate (`user_id = $1`) even though RLS would filter it: the predicate is what uses the index |
| 3   | Every list has a `LIMIT`. Page sizes are 25, 50 or 100 in the console and come from the contract elsewhere                                                |
| 4   | Filter on the same expression the partial index declares (`WHERE status = 'active'`, `WHERE deleted_at IS NULL`), or the index is not used                |
| 5   | No N+1: fetch children with one `WHERE parent_id = ANY($1)` or a join                                                                                     |
| 6   | Use `INSERT ... ON CONFLICT` for upserts and idempotent writes, never "select then insert"                                                                |
| 7   | Use `RETURNING` instead of a second read                                                                                                                  |
| 8   | Time comes from the database (`now()`) for stored timestamps; the member's local day is passed in explicitly (`spend_spec_view(p_user, p_local_day)`)     |
| 9   | Geography is read with `ST_X` / `ST_Y` in the query; application code never parses EWKB (`packages/db/src/schema/types.ts`)                               |
| 10  | Read `remote_config` through the typed config reader, not ad hoc; `jsonb` values are parsed with a schema before use                                      |
| 11  | Enum and `CHECK` values are typed in the model (`$type<...>()`) and switched exhaustively                                                                 |
| 12  | Soft-deleted rows are excluded explicitly; do not rely on a view to hide them unless the view is the documented reader                                    |
| 13  | Bulk work in the worker goes in batches by primary key with a commit per batch                                                                            |
| 14  | SQL keywords upper case, identifiers `lower_snake_case`, one clause per line, as in the baseline. Migrations are not formatted by Prettier                |
| 15  | A query on a hot path has an EXPLAIN test (section 8)                                                                                                     |

## 7. `COMMENT ON` as documentation

The schema documents itself: 339 `COMMENT ON` statements, one on every one of the 221 tables.
This is a convention with a checkable rule, because the data dictionary and the module plans are
derived from these comments.

| Object                     | Required content                                                                                                                                                                                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Table                      | Purpose in one or two sentences; the screens or admin modules that use it (canvas ids); the retention rule; `PII: none \| personal \| sensitive \| biometric`; where it applies, `Citus:` with the distribution note; a version tag for anything after v3 |
| Column                     | Only when the name does not explain it: units, the rule behind a nullable column, who writes it, the config key that feeds it                                                                                                                             |
| Function                   | The caller (endpoint or job), the rule, and the decision or item id behind it                                                                                                                                                                             |
| View and materialised view | The reader and, for a materialised view, the refresh interval and job                                                                                                                                                                                     |
| Domain                     | The format                                                                                                                                                                                                                                                |

Example from the baseline: `COMMENT ON TABLE admin_recovery_codes IS 'v3.1 A02 MFA recovery codes
(AD-02): 10 single-use codes per batch, stored as SHA-256 digests only ... Retention: account
life. PII: personal (credential digest).'`

Rules:

1. A migration that adds a table, function, view or materialised view adds its comment in the
   same file; a migration that changes a rule updates the comment.
2. The PII class in the comment and in the data dictionary must agree
   ([1MM-DB-06](1MM-DB-06-DATA-PROTECTION.md)).
3. Comments state decisions, not history. No names of people, no secrets, no retired product
   names.
4. **Recommendation:** a repo check that fails when a table in `public` has no comment or its
   comment lacks `PII:`; the original verification asserted "every table has a COMMENT" [DD §15].

## 8. How SQL is reviewed

Every pull request that adds or changes SQL (a migration, a repository query, a database
function) is reviewed against this list. `packages/db` has code owners.

| #   | Check                                                                                              | Evidence the author provides                                           |
| --- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | The change is authorised by a Technical Reference extension when it alters the schema              | Gap or extension id in the migration header                            |
| 2   | Migration rules and the zero-downtime checklist                                                    | [1MM-DB-02](1MM-DB-02-MIGRATIONS.md) section 13                        |
| 3   | Parameterised; no string-built SQL; raw SQL only in the allowed cases                              | The diff                                                               |
| 4   | Member queries run in `withMemberTx` and carry an ownership predicate                              | The diff; an RLS test: another member's row is not returned            |
| 5   | Lists are keyset-paginated on an indexed sort with a tiebreaker; no `OFFSET`                       | The diff                                                               |
| 6   | "Only one" and "exactly once" rules are constraints, with a parallel-connection test               | Test names ([1MM-STD-01](../standards/1MM-STD-01-TESTING-STRATEGY.md)) |
| 7   | Limits and timers come from `remote_config`, not literals                                          | The diff; section 9 lists the known exceptions                         |
| 8   | Comments are present and state PII and retention                                                   | The diff                                                               |
| 9   | Plans for hot queries                                                                              | An EXPLAIN test, below                                                 |
| 10  | Roles: new objects have the right grants; no new `SECURITY DEFINER` without a pinned `search_path` | `roles.sql`, `roles.test.ts`                                           |

### 8.1 EXPLAIN checks on hot queries

"EXPLAIN checks in CI for hot queries" is a stated technique [TR §15.2] and part of the engineering
workflow [TR §17.3]. They are not built yet (tracked in
[1MM-STD-01](../standards/1MM-STD-01-TESTING-STRATEGY.md) as a MOD-00 gap). The contract:

1. A **hot query** is one on a member's critical path or on a large table: the discovery candidate
   query [TR §8.5], the chat thread and chat list, likes received, unread counts, the inbox, the
   reaction write path, queue claims in the console, and any query on a partitioned table. Each
   owning module lists its hot queries in its plan and adds their tests.
2. The test runs the real repository query under `EXPLAIN (FORMAT JSON)` against a database loaded
   with a sized fixture, and asserts on the plan, not on timings: the expected index is used; there
   is no sequential scan on a large table; partition pruning happens where a time bound is given;
   no sort spills for a paginated list.
3. Row estimates need statistics: the fixture is loaded and `ANALYZE` is run before the
   assertions.
4. Timings are judged separately against the performance budgets [TR §15.1] in the load test
   (MOD-19).
5. In review, a new or changed hot query comes with its plan pasted in the pull request
   (`EXPLAIN (ANALYZE, BUFFERS)` from a staging-sized database) until the automated test exists.

The index side of this (which index each hot query needs, and how to add one safely) is
[1MM-DB-04](1MM-DB-04-INDEXING.md).

## 9. Known defects in database logic

Found while reading the SQL and checked against the module plans. Each is already raised by a
module plan; this document raises no duplicate and lists them so that a reader of the SQL sees
them in one place.

| Gap id       | Object                                   | Defect                                                                                                                                              | Raised in                                                                  |
| ------------ | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| GAP-MOD08-03 | `decide_intro()`                         | The move-on cooldown is the literal `interval '30 days'` (twice), although `discovery.pass_memory_days` is seeded and `unmatch()` reads its own key | [MOD-08](../execution/1MM-EXE-MOD-08-INTRO-CHAT-AND-DIRECT-SPECS.md)       |
| GAP-MOD13-02 | `safety_checkins`                        | `CHECK (respond_by = due_at + interval '15 minutes')` fixes a value that is also the public, editable key `checkin.response_minutes`                | [MOD-13](../execution/1MM-EXE-MOD-13-MEETUPS-AND-PERSONAL-SAFETY.md)       |
| GAP-MOD16-06 | `account_deletions`                      | `CHECK (scheduled_for = requested_at + interval '14 days')` fixes a value that is also the editable key `deletion.grace_days`                       | [MOD-16](../execution/1MM-EXE-MOD-16-LEGAL-PRIVACY-AND-DATA-OPERATIONS.md) |
| GAP-MOD02-09 | `maintenance_windows`                    | The comment says an approval is required and `approval_id` exists, but no `enforce_config_approval` trigger is attached                             | [MOD-02](../execution/1MM-EXE-MOD-02-PLATFORM-CONFIG-AND-CATALOGUES.md)    |
| GAP-MOD02-07 | `languages`                              | Editable under two permissions; the market approval trigger covers `countries` and `cities` only                                                    | [MOD-02](../execution/1MM-EXE-MOD-02-PLATFORM-CONFIG-AND-CATALOGUES.md)    |
| GAP-MOD12-03 | `group_messages`                         | No idempotency ledger equivalent to `message_client_ids`                                                                                            | [MOD-12](../execution/1MM-EXE-MOD-12-GROUPS.md)                            |
| GAP-MOD12-09 | `group_invites.expires_at`               | The 14-day expiry is a column default with no config key, and no job sets invites to `expired`                                                      | [MOD-12](../execution/1MM-EXE-MOD-12-GROUPS.md)                            |
| GAP-MOD15-01 | `content_snapshot()`                     | The snapshot is the page row only; `site_page_sections` are outside it                                                                              | [MOD-15](../execution/1MM-EXE-MOD-15-CMS-AND-PUBLIC-WEBSITE.md)            |
| GAP-MOD08-07 | `unmatch()`, `has_legal_hold()` comments | "The message purge" is referred to but no job is named or seeded                                                                                    | [MOD-08](../execution/1MM-EXE-MOD-08-INTRO-CHAT-AND-DIRECT-SPECS.md)       |
| GAP-MOD01-04 | `admin_issue_recovery_codes()` comment   | Audit event name differs from the admin spec                                                                                                        | [MOD-01](../execution/1MM-EXE-MOD-01-ADMIN-ACCESS-AND-GOVERNANCE.md)       |

Not defects, but easy to mistake for one: the maxima in `enforce_max_children` triggers and the
length ceilings in `CHECK` constraints (for example `intro.text_max_chars` 280 under a database
ceiling of 1000) are deliberate upper bounds, with the editable value enforced by the API below
them [SQL] `remote_config` descriptions.

## 10. Gaps raised

Dispositions are recorded in [1MM-LOG-03](../1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md) (Technical Reference and schema), [1MM-LOG-02](../1MM-LOG-02-UI-UPDATES.md) (UI) and [1MM-LOG-04](../1MM-LOG-04-OPEN-DECISIONS-AND-FOLLOW-UPS.md) (owner decisions and repository follow-ups).

| Gap id      | Type   | Where found                                                                                                                                                 | What is missing or conflicting                                                                                                                                                                                                                                                                               | Proposed resolution                                                                                                                                                                                                                                                                                                                                      | Blocks                                                                             |
| ----------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| GAP-DB03-01 | SCHEMA | [SQL] `record_reaction()` step 2 against `entitlements` / `role_entitlements` (`react.like_somewhat`) and [TR §9]                                           | The function decides who may Like or Somewhat with the literal role list `('ACTIVE','CLASSIC','SUPER')`, while the same rule is a seeded, admin-visible entitlement (`react.like_somewhat`: false, false, true, true, true by role). If the matrix were edited, the database would still enforce the literal | Either state in [TR §8.4] that the role list is a fixed database backstop and mark `react.like_somewhat` as not editable in A23, or replace the literal in a migration with a lookup: `IF NOT coalesce((SELECT (value #>> '{}')::boolean FROM role_entitlements WHERE role = v_role AND entitlement_key = 'react.like_somewhat'), false) THEN RAISE ...` | none at launch (the two agree); decide before the matrix becomes editable (MOD-10) |
| GAP-DB03-02 | TR     | [TR §8.1] "the member API sets `SET LOCAL app.user_id` for each transaction" against the pooled runtime connection ([TR §4.3], `packages/db/src/client.ts`) | The Technical Reference does not say how the value is bound. `SET LOCAL` takes no bind parameter, so a literal implementation would build SQL by string, which [TR §13.1] bans                                                                                                                               | Add to [TR §8.1]: the context is set with `SELECT set_config('app.user_id', $1, true)` as the first statement of the transaction, and a member query outside such a transaction is a defect. Implemented once in `withMemberTx` (MOD-00)                                                                                                                 | `MOD-00` RLS context helper                                                        |

## Change log

| Version | Date        | Change                                                                           |
| ------- | ----------- | -------------------------------------------------------------------------------- |
| v1.0    | 24 Nov 2026 | First issue, against schema v3.4 (`0001_baseline_v3_4.sql`) and migration `0006` |
