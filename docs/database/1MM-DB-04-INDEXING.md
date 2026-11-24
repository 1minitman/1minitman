# 1MM-DB-04 · Indexing

|              |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Document** | 1MM-DB-04                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Status**   | Approved baseline · v1.0 · 24 Nov 2026                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Audience** | Engineers and coding agents                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Owner**    | Engineering lead (code owners)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Sources**  | [SQL] (`packages/db/migrations/0001_baseline_v3_4.sql`), `packages/db/src/migrator.ts`, `apps/worker/src/jobs/partitions-ensure.ts`, [TR §8.1], [TR §8.4], [TR §8.5], [TR §10.1], [TR §10.2], [TR §10.3], [TR §11], [TR §15.1], [TR §15.2], [DD §1–§14], [ADM §1.4], [ADM A04], [ADM A07], [ADM A09]                                                                                                                                                                                                                        |
| **Related**  | [1MM-DB-01](1MM-DB-01-SCHEMAS.md), [1MM-DB-02](1MM-DB-02-MIGRATIONS.md), [1MM-DB-03](1MM-DB-03-SQL-STRUCTURE.md), [1MM-DB-05](1MM-DB-05-SECURITY.md), [1MM-DB-06](1MM-DB-06-DATA-PROTECTION.md), [MOD-00](../execution/1MM-EXE-MOD-00-FOUNDATIONS.md), [MOD-05](../execution/1MM-EXE-MOD-05-MEMBER-ADMINISTRATION.md), [MOD-07](../execution/1MM-EXE-MOD-07-DISCOVERY-AND-MATCHING.md), [MOD-18](../execution/1MM-EXE-MOD-18-ANALYTICS-OVERVIEW-AND-RESEARCH.md), [1MM-STD-01](../standards/1MM-STD-01-TESTING-STRATEGY.md) |

**What this document is for and when to open it.** It records the indexes schema v3.4 ships with,
the query paths they serve, the budgets they must meet and the rules for adding or removing one.
Open it before you write a list, queue, search or feed query, before you add an index in a
migration, and when a query misses its budget. Table structure is in
[1MM-DB-01](1MM-DB-01-SCHEMAS.md); how a migration is written and run is in
[1MM-DB-02](1MM-DB-02-MIGRATIONS.md).

Everything here was counted from the migration file with the scripts in section 2. No database was
queried for this document. Statements marked **Recommendation** are this document's engineering
advice, not source facts.

## 1. How the schema indexes, in one page

[TR §15.2] names the techniques: GiST for location, BRIN for time series, partial indexes for
queues, live rows and unread counts, monthly partitions, keyset pagination, EXPLAIN checks in CI for
hot queries, and materialised views for admin statistics. The baseline follows that list:

- More than half of the written-out indexes are partial (165 of 292). A queue index holds only the
  rows still waiting; a "live" index holds only rows not revoked, released, deleted or hidden.
- Every "only one" rule is a constraint or a unique index, not application code [SQL conventions].
  40 of the 49 unique indexes are partial, which is how "one live subscription", "one active match
  per pair" and "one scheduled deletion" are enforced.
- Append-only and time-series tables carry a BRIN index on their time column (23).
- Location columns carry a partial GiST index (4, plus one GiST index on network ranges).
- Text search is deliberately small: two `tsvector` columns and two prefix indexes (section 7).
- There is no covering (`INCLUDE`) index and no hash index.

## 2. Inventory

### 2.1 Counts

| Kind                                           | Count                                     | How counted                                                                                        |
| ---------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `CREATE [UNIQUE] INDEX` statements written out | **292**                                   | script A                                                                                           |
| …of which unique (`uq_` prefix)                | 49 (6 are on materialised views)          | script A                                                                                           |
| …of which partial (`WHERE`)                    | 165                                       | script A                                                                                           |
| …of which unique and partial                   | 40                                        | script A                                                                                           |
| …B-tree (no `USING`)                           | 258                                       | script A                                                                                           |
| …BRIN                                          | 23                                        | script A                                                                                           |
| …GIN                                           | 6                                         | script A                                                                                           |
| …GiST                                          | 5                                         | script A                                                                                           |
| …hash, SP-GiST                                 | 0                                         | script A                                                                                           |
| …expression keys                               | 6                                         | script A, list below                                                                               |
| …covering (`INCLUDE`)                          | 0                                         | script A                                                                                           |
| …with a `DESC` key                             | 84                                        | script A                                                                                           |
| …multi-column                                  | 150                                       | script B                                                                                           |
| Indexes created in the CMS workflow loop       | **37** (all partial B-tree)               | 3 per table × 10 workflow tables, plus `_wf_tgroup` on the 7 that have a `locale` column; script B |
| Named secondary indexes in total               | **329**                                   | 292 + 37                                                                                           |
| Primary keys                                   | 221 (every table has one)                 | script B                                                                                           |
| `UNIQUE` table and column constraints          | 97                                        | script B                                                                                           |
| Indexes at parent-table level                  | **647**                                   | 329 + 221 + 97                                                                                     |
| Tables with at least one secondary index       | 152 of 221, plus the 6 materialised views | script B                                                                                           |

The schema header and [TR §10.1] give **1,085 indexes "incl. partitions"**. That figure counts each
partition's copy of every index on the nine partitioned tables and can only be reproduced on a
migrated database (script C). The 647 above is the logical design; treat 1,085 as the physical count
at baseline, which grows by a handful every month as partitions are added.

The six expression indexes:

| Index                         | Table              | Key                                                                     | Purpose                                |
| ----------------------------- | ------------------ | ----------------------------------------------------------------------- | -------------------------------------- |
| `idx_cities_search`           | `cities`           | `lower(ascii_name) text_pattern_ops`                                    | City type-ahead by prefix              |
| `idx_profiles_nick_prefix`    | `profiles`         | `lower(nickname) text_pattern_ops`                                      | Admin nickname prefix search [ADM A04] |
| `idx_nickname_hist_held`      | `nickname_history` | `lower(nickname), held_until`                                           | Nickname hold check                    |
| `uq_admin_user_role_live`     | `admin_user_roles` | `admin_id, role_id, scope_kind, coalesce(scope_value, '')`              | One live grant per scope               |
| `uq_waitlist_identifier_city` | `waitlist_entries` | `identifier_hash, coalesce(city_id, 0), lower(coalesce(city_text, ''))` | One entry per identifier per city      |
| `uq_one_break_glass`          | `admin_users`      | `(true)` where `is_break_glass`                                         | At most one break-glass account        |

Naming is `idx_<table-or-abbreviation>_<purpose>` (243 statements) and `uq_<…>_<rule>` (49). No
index name is used twice (script B).

### 2.2 The scripts

Script A, counts by kind (shell, run from the repo root):

```sh
F=packages/db/migrations/0001_baseline_v3_4.sql
grep -E '^\s*CREATE (UNIQUE )?INDEX' "$F" > /tmp/idx.txt
wc -l < /tmp/idx.txt                                  # 292
grep -c 'CREATE UNIQUE' /tmp/idx.txt                  # 49
grep -c ' WHERE ' /tmp/idx.txt                        # 165 partial
grep 'CREATE UNIQUE' /tmp/idx.txt | grep -c ' WHERE ' # 40
for m in brin gin gist hash spgist; do echo "$m $(grep -ci "USING $m" /tmp/idx.txt)"; done
grep -ci 'INCLUDE' /tmp/idx.txt                       # 0
grep -c ' DESC' /tmp/idx.txt                          # 84
grep -cE 'lower\(|coalesce\(|\(\(true\)\)' /tmp/idx.txt   # 6 expression
grep -cE "EXECUTE format\('CREATE (UNIQUE )?INDEX" "$F"   # 4 loop templates
grep -vc ';' /tmp/idx.txt                             # 0: every statement is on one line
```

Script B was a small Python parser (not kept in the repo: authors may not add files). It strips
`--` comments, reads each `CREATE TABLE … ( … );` body, splits it at top-level commas and collects
`PRIMARY KEY`, `UNIQUE`, `REFERENCES` and `FOREIGN KEY` items, adds the `ALTER TABLE … ADD FOREIGN
KEY` statements, and parses each `CREATE INDEX` into table, method, key list and predicate. It is a
static parse, so it is exact for what is written out and blind to what the `DO` blocks build at run
time (the 37 loop indexes and the workflow columns in section 3.2 were added by hand from the loop
at [SQL] section 18.3).

Script C is the authoritative version, for a migrated local database (`pnpm db:migrate`). It was not
run for this document:

```sql
-- every index by access method and shape
SELECT am.amname,
       count(*)                                         AS indexes,
       count(*) FILTER (WHERE i.indisunique)            AS is_unique,
       count(*) FILTER (WHERE i.indpred IS NOT NULL)    AS partial,
       count(*) FILTER (WHERE i.indexprs IS NOT NULL)   AS expression,
       count(*) FILTER (WHERE i.indnkeyatts < i.indnatts) AS covering
FROM pg_index i
JOIN pg_class c  ON c.oid = i.indexrelid
JOIN pg_am am    ON am.oid = c.relam
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
GROUP BY am.amname ORDER BY 2 DESC;
```

## 3. Principles used

### 3.1 The rules the baseline follows

| #   | Principle                                                                                             | Evidence in [SQL]                                                                                         |
| --- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 1   | Index the query, not the column. An index exists because a named screen, job or constraint needs it   | Index names carry the purpose (`_queue`, `_due`, `_live`, `_purge`, `_brin`)                              |
| 2   | Uniqueness rules are indexes                                                                          | 49 `uq_` indexes, 97 `UNIQUE` constraints                                                                 |
| 3   | Queues and schedules are partial indexes on the waiting rows, keyed by the due time or the sort order | `idx_cases_queue`, `idx_badge_queue`, `idx_notifications_due`, `idx_webhooks_pending`, `idx_deletion_due` |
| 4   | Lists are read by keyset, so the index key is the sort key [TR §8.1], [ADM §1.4]                      | `(owner, created_at DESC)` shape on 84 indexes                                                            |
| 5   | Append-only tables get BRIN on time, not a second B-tree                                              | 23 BRIN indexes                                                                                           |
| 6   | A partitioned table's primary key and unique indexes contain the partition column [TR §10.2]          | All nine partitioned tables; `uq_audit_chain_seq (chain_seq, created_at)`                                 |
| 7   | High-volume tables carry few indexes                                                                  | `messages` 3, `feed_impressions` 2, `analytics_events` 2                                                  |
| 8   | Sorting is offered only on indexed columns [ADM §1.4]                                                 | Each admin list names its sort columns                                                                    |

### 3.2 Are all foreign keys indexed? No

PostgreSQL indexes the referenced side (it must be a primary key or unique) and never the referencing
column. Script B checked every foreign key for an index, primary key or unique constraint whose
leading columns are the foreign-key columns.

| Result                                                                                         | Count   |
| ---------------------------------------------------------------------------------------------- | ------- |
| Foreign keys written out (`REFERENCES` clauses: 437; 5 are templates inside the workflow loop) | 432     |
| Covered by a full index, primary key or unique constraint                                      | 105     |
| Covered only by a partial index                                                                | 54      |
| Composite keys to `messages` / `group_messages` covered by a two-column prefix                 | 3       |
| **No index led by the foreign-key column**                                                     | **270** |

The 270 by referenced table:

| References                                                                                                             | Count | Typical column                                                                    | Delete action                       | Does it matter?                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------- | ----- | --------------------------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `admin_users`                                                                                                          | 84    | `created_by`, `updated_by`, `decided_by`, `approved_by`                           | SET NULL (80), none (4)             | No. Staff rows are kept 7 years and not deleted [DD §13]; nothing lists rows "by actor" except the audit log, which has `idx_audit_admin` |
| `users`                                                                                                                | 42    | see below                                                                         | CASCADE 27, SET NULL 14, RESTRICT 1 | **Yes, for some.** See below                                                                                                              |
| catalogue tables (`plans`, `prices`, `countries`, `cities`, `options`, `notification_templates`, `legal_documents`, …) | 42    | `plan_code`, `template_code`, `country`                                           | mixed                               | No. Catalogue rows are permanent [DD §1]                                                                                                  |
| `admin_approvals`                                                                                                      | 21    | `approval_id`                                                                     | SET NULL                            | No. Approvals are kept 7 years; the approval row points at its target (`idx_admin_approvals_target`)                                      |
| other                                                                                                                  | 81    | `media_id`, `case_id`, `device_id`, `incident_id`, `meetup_id`, `subscription_id` | mostly SET NULL                     | Case by case; each owning module decides with EXPLAIN evidence (section 10)                                                               |

The workflow loop also adds `updated_by`, `approved_by`, `published_by` and `live_revision_id` to the
10 CMS workflow tables and `native_reviewed_by` to the 7 with a locale; none is indexed, for the
same reason as the `admin_users` row above.

The 42 unindexed references to `users`:

- CASCADE (27): `otp_challenges.user_id`, `account_lockouts.user_id`,
  `pending_actions.target_user_id`, `pair_cooldowns.other_id`, `hidden_profiles.hidden_user_id`,
  `intro_sessions.user_a`, `intro_sessions.user_b`, `intro_messages.sender_id`,
  `intro_decisions.user_id`, `conversations.user_b`, `message_reactions.user_id`, `calls.caller_id`,
  `calls.callee_id`, `call_feedback.user_id`, `group_invites.inviter_id`, `meetups.created_by`,
  `meetup_time_proposals.proposed_by`, `meetup_feedback.user_id`, `meetup_shares.user_id`,
  `safety_checkins.user_id`, `safety_escalations.user_id`, `appeals.user_id`,
  `identity_links.linked_user_id`, `billing_credits.user_id`, `lapse_choices.user_id`,
  `feature_flag_overrides.user_id`, `group_message_reactions.user_id`.
- SET NULL (14): `login_attempts.user_id`, `matches.completed_by`, `matches.ended_by`,
  `intro_sessions.skipped_by`, `messages.sender_id`, `group_members.removed_by`,
  `group_messages.sender_id`, `inbox_items.actor_user_id`, `support_messages.author_user_id`,
  `help_article_votes.user_id`, `feedback.user_id`, `privacy_requests.user_id`,
  `beta_invites.redeemed_by`, `story_consents.user_id`.
- RESTRICT (1): `trials.user_id`.

Why this matters: the erasure job and the data export work member by member
([1MM-DB-06](1MM-DB-06-DATA-PROTECTION.md) sections 7 and 8). Whether they delete child rows
explicitly or rely on a cascade, every table above is scanned in full for each member unless the
column is indexed. Several are also read by the member's own screens (appeals, check-ins, calls,
trials, privacy requests). The proposed indexes are in GAP-DB04-02. On the two partitioned tables
(`messages.sender_id`, `group_messages.sender_id`) no index is proposed: erasure reaches messages
through the conversation, and an extra index on the hottest write path is not justified.

Authoritative check on a migrated database (not run here):

```sql
SELECT c.conrelid::regclass AS child, c.conname, c.confrelid::regclass AS parent
FROM pg_constraint c
WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace
  AND NOT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indrelid = c.conrelid AND i.indpred IS NULL
      AND (i.indkey::int2[])[0:cardinality(c.conkey) - 1] @> c.conkey::int2[])
ORDER BY 3, 1;
```

### 3.3 Keyset pagination

The cursor encodes `(sort_key, id)`; `limit` is 25, 50 or 100; OFFSET is never used [TR §8.1],
[ADM §1.4]. Rules:

1. The `ORDER BY` is the index key plus `id` as the tiebreaker, in the same direction.
2. Only `idx_users_created_id` (`created_at DESC, id DESC`) and `idx_users_last_active`
   (`last_active_at DESC NULLS LAST, id`) carry the `id` in the index. Every other list index ends
   at the time column. That is acceptable: ids are uuid v7 and time-ordered [TR §10.2], and
   PostgreSQL 16 sorts ties with an incremental sort over the already ordered prefix. A list that
   can hold many rows with the same timestamp must not rely on this; add the `id` to the index.
3. A `NULLS LAST` sort key (`last_active_at`) needs the same `NULLS LAST` in the query, or the index
   is not used.
4. A query on a partial index must repeat the index predicate literally
   (`status IN ('queued','claimed')`, `NOT is_hidden`, `deleted_at IS NULL`). A parameterised
   predicate (`status = ANY($1)`) hides it from the planner.

### 3.4 Partial indexes that encode business rules

| Rule                                                    | Index                                                                               | Source of the rule     |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------- |
| One account per e-mail among non-deleted accounts       | `uq_users_email (email) WHERE deleted_at IS NULL`                                   | [TR §13.1] duplication |
| One account per verified, current phone number          | `uq_phone_one_account (e164) WHERE verified_at IS NOT NULL AND released_at IS NULL` | [TR §13.1]             |
| One current phone per member                            | `uq_phone_user_current`                                                             | [DD §2]                |
| One linked identity per provider subject and per member | `uq_oauth_sub`, `uq_oauth_user_provider`                                            | [TR §13.2]             |
| One open Black Badge application                        | `uq_badge_open`                                                                     | [DD §4]                |
| One active match per pair                               | `uq_matches_active_pair (user_a, user_b) WHERE status = 'active'`                   | [TR §8.4] step 7       |
| One open conversation per pair                          | `uq_conv_live_pair`                                                                 | [DD §6]                |
| One pending DM request per pair                         | `uq_dm_pending_pair`                                                                | [DD §6]                |
| One live block per pair                                 | `uq_blocks_active`                                                                  | [DD §9]                |
| One live restriction per kind                           | `uq_restriction_live`                                                               | [DD §9]                |
| One live subscription (`on_hold` counts)                | `uq_subs_one_live`                                                                  | [OD-37], [SQL]         |
| One scheduled deletion                                  | `uq_deletion_scheduled`                                                             | [TR §16.2]             |
| One live legal hold per subject                         | `uq_legal_hold_live`                                                                | [DD §13A]              |
| One owner per group                                     | `uq_group_one_owner`                                                                | [DD §7]                |
| One notification per dedupe key                         | `uq_notifications_dedupe`, `uq_notifications_recipient_dedupe`                      | [TR §13.1]             |
| One break-glass admin                                   | `uq_one_break_glass`                                                                | [SQL]                  |

Changing one of these predicates changes a product rule. It needs the same review as a change to the
rule itself.

### 3.5 Indexes on partitioned tables

Nine tables are range-partitioned by month [TR §10.2]:

| Table                    | Partition key  | Primary key                                                             | Secondary indexes                                                                        |
| ------------------------ | -------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `messages`               | `created_at`   | `(conversation_id, id, created_at)`                                     | `idx_messages_thread`, `idx_messages_brin`, `idx_messages_flagged` (partial)             |
| `group_messages`         | `created_at`   | `(group_id, id, created_at)`                                            | `idx_group_msgs_room`, `idx_group_msgs_pinned` (partial)                                 |
| `admin_audit_log`        | `created_at`   | `(created_at, id)`                                                      | `idx_audit_target`, `idx_audit_admin`, `idx_audit_brin`, `uq_audit_chain_seq`            |
| `feed_impressions`       | `shown_at`     | `(user_id, shown_at, target_id)`                                        | `idx_impr_brin`, `idx_impr_target`                                                       |
| `analytics_events`       | `occurred_at`  | `(occurred_at, id)`                                                     | `idx_events_brin`, `idx_events_name`                                                     |
| `api_request_rollups`    | `bucket_start` | `(bucket_start, route_key, method, status_class, platform, country)`    | `idx_rollups_brin`                                                                       |
| `api_request_samples`    | `at`           | `(at, id)`                                                              | `idx_samples_brin`, `idx_samples_errors` (partial), `idx_samples_prefix`                 |
| `api_request_ip_rollups` | `bucket_start` | `(bucket_start, ip_prefix, asn, country, route_key, user_agent_family)` | `idx_iprollups_brin`, `idx_iprollups_prefix`, `idx_iprollups_asn`, `idx_iprollups_route` |
| `edge_security_events`   | `occurred_at`  | `(occurred_at, id)`                                                     | `idx_edge_events_rule`                                                                   |

Consequences:

1. An index declared on the parent is created on every partition, including each new monthly one.
   Every index added to one of these tables is multiplied by the number of partitions kept.
2. A unique rule that does not include the partition column cannot be an index. Message idempotency
   therefore lives in `message_client_ids` with primary key `(sender_id, client_msg_id)` [TR §10.2].
3. An index on a partitioned parent cannot be built with `CONCURRENTLY` in one statement
   (section 10.3).
4. `edge_security_events` had only its `DEFAULT` partition at baseline (GAP-DB01-01 in
   [1MM-DB-01](1MM-DB-01-SCHEMAS.md)); migration `0007_trx_schema_change_set.sql` creates its
   monthly partitions. The rule stands for every partitioned table: while rows sit in a `DEFAULT`
   partition, creating the monthly partition for their range fails.

## 4. Hot query paths and the indexes that serve them

Each index name below was confirmed by grep in the migration file.

### 4.1 Member paths

| Path                        | Query shape                                                                                                       | Indexes                                                                                                                                                                                                                                                           | Notes                                                                                                                                                                                                                                                     |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Discovery deck [TR §8.5]    | `profiles` joined to `users`, `ST_DWithin` on location, age, gender and intention filters, exclusions, `LIMIT 50` | `idx_profiles_geo` (GiST, `WHERE NOT is_hidden`); `idx_profiles_feed (country, gender, interested_in, intention, birth_date) WHERE NOT is_hidden` for the Gold international tab; `idx_profiles_city`                                                             | Section 6                                                                                                                                                                                                                                                 |
| Discovery exclusions        | not blocked either way, not hidden, not cooling down, not already reacted                                         | `uq_blocks_active (blocker_id, blocked_id)`, `idx_blocks_blocked`; primary key of `hidden_profiles (user_id, hidden_user_id)`; primary key of `pair_cooldowns (user_id, other_id, reason)`; `UNIQUE (actor_id, target_id)` on `reactions`; `idx_reactions_passes` | All anti-joins start from the viewer's id                                                                                                                                                                                                                 |
| Daily quota [TR §8.5]       | `spend_spec_view()` on `usage_counters`                                                                           | Primary key `(user_id, metric, period_start)`                                                                                                                                                                                                                     | Redis `quota:specs:*` is the fast path [DD §14]                                                                                                                                                                                                           |
| Scarcity card               | `mv_city_weekly_joins`                                                                                            | `uq_mv_city_weekly (city_id, week_start)`                                                                                                                                                                                                                         | Section 9                                                                                                                                                                                                                                                 |
| Spotlight                   | live rotation for a city                                                                                          | `idx_spotlight_live`, `idx_spotlight_rotation_order (city_id, starts_at, is_priority DESC, position)`                                                                                                                                                             | Order matches [OD-18]: Gold first                                                                                                                                                                                                                         |
| Reaction write [TR §8.4]    | replay check, upsert, read the reverse reaction, insert match                                                     | `UNIQUE (actor_id, client_reaction_id)`, `UNIQUE (actor_id, target_id)`, `uq_matches_active_pair`                                                                                                                                                                 | The advisory lock, not an index, serialises the pair                                                                                                                                                                                                      |
| Likes grid "Liked you"      | `reactions` by target, newest first                                                                               | `idx_reactions_likes_grid (target_id, created_at DESC) WHERE kind IN ('like','somewhat') AND undone_at IS NULL`                                                                                                                                                   | View `v_likes_received`                                                                                                                                                                                                                                   |
| "You liked", "Passed"       | `reactions` by actor                                                                                              | `idx_reactions_you_liked`, `idx_reactions_passes`                                                                                                                                                                                                                 |                                                                                                                                                                                                                                                           |
| Matches                     | active matches for a member                                                                                       | `idx_matches_a (user_a, created_at DESC)`, `idx_matches_b (user_b, created_at DESC)`, both `WHERE status = 'active'`                                                                                                                                              | A member can be `user_a` or `user_b`: the query is a `UNION ALL` of two index scans, never `user_a = $1 OR user_b = $1`                                                                                                                                   |
| Intro expiry                | sessions past `expires_at`                                                                                        | `idx_matches_expiry`, `idx_intro_waiting`                                                                                                                                                                                                                         | Job `intro.expire` every 5 min [TR §11]                                                                                                                                                                                                                   |
| Chat thread                 | messages of one conversation, newest first                                                                        | `idx_messages_thread (conversation_id, created_at DESC)`                                                                                                                                                                                                          | Section 8 for pruning                                                                                                                                                                                                                                     |
| Message send                | idempotency, then insert                                                                                          | Primary key of `message_client_ids`; primary key of `messages`                                                                                                                                                                                                    |                                                                                                                                                                                                                                                           |
| Conversations list          | `v_chat_list` for one member, `ORDER BY last_message_at DESC`                                                     | `idx_cp_chat_list (user_id, conversation_id) WHERE hidden_at IS NULL`, then `conversations` by primary key                                                                                                                                                        | The sort column is on `conversations`, the filter on `conversation_participants`, so the member's conversations are fetched and sorted. Bounded by one member's chats. `idx_conv_last` is global and does not serve this list. Watch item 1 in section 13 |
| Unread badges               | `v_unread_counts`                                                                                                 | `idx_cp_unread`, `idx_inbox_unread`                                                                                                                                                                                                                               | Redis `badge:{user_id}` first [DD §14]                                                                                                                                                                                                                    |
| Notifications feed (D16)    | `inbox_items` for a member, newest first                                                                          | `idx_inbox_user (user_id, created_at DESC)`                                                                                                                                                                                                                       |                                                                                                                                                                                                                                                           |
| DM requests inbox           | pending or filtered, newest first                                                                                 | `idx_dm_inbox`                                                                                                                                                                                                                                                    |                                                                                                                                                                                                                                                           |
| Groups discovery and search | nearby, by city, by topic, by text                                                                                | `idx_groups_discover` (GiST), `idx_groups_city`, `idx_groups_topic`, `idx_groups_search` (GIN)                                                                                                                                                                    |                                                                                                                                                                                                                                                           |
| Group room                  | messages of one group                                                                                             | `idx_group_msgs_room (group_id, created_at DESC)`, `idx_group_msgs_pinned`                                                                                                                                                                                        |                                                                                                                                                                                                                                                           |
| Sessions and devices        | live sessions, token rotation                                                                                     | `idx_sessions_user_live`, `idx_refresh_session`, `UNIQUE (token_hash)` on `refresh_tokens`, `idx_devices_user`, `idx_devices_fp`                                                                                                                                  |                                                                                                                                                                                                                                                           |
| OTP and login throttles     | recent challenges and attempts by hashed identifier or IP                                                         | `idx_otp_dest_live`, `idx_login_attempts_id`, `idx_login_attempts_ip`                                                                                                                                                                                             | Redis `rl:*` counts first; these are the durable copy                                                                                                                                                                                                     |
| Entitlements                | live grants for a member                                                                                          | `idx_grants_live (user_id, ends_at) WHERE revoked_at IS NULL`, `uq_subs_one_live`                                                                                                                                                                                 | Redis `ent:{user_id}` first                                                                                                                                                                                                                               |

### 4.2 Worker paths

| Path                                          | Indexes                                                                                                                                                                                                                                 |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Notification outbox (`notifications.deliver`) | `idx_notifications_due (scheduled_for) WHERE status IN ('queued','batched','throttled')`; de-duplication `uq_notifications_dedupe (user_id, dedupe_key)`, `uq_notifications_recipient_dedupe`; broadcasts `idx_notifications_broadcast` |
| Webhook intake and retry                      | `UNIQUE (provider, event_id)` on `webhook_events` de-duplicates on insert; `idx_webhooks_pending (received_at) WHERE status IN ('received','failed')` feeds `webhooks.retry`; `idx_webhooks_brin`                                       |
| Media pipeline and purge                      | `idx_media_pipeline`, `idx_media_purge`, `idx_media_phash`                                                                                                                                                                              |
| Billing schedules                             | `idx_subs_period_end`, `idx_subs_grace`, `idx_trials_reminder`, `idx_restrictions_ending`                                                                                                                                               |
| Deletion and erasure                          | `idx_users_deletion_due`, `idx_deletion_due`                                                                                                                                                                                            |
| Retention purges                              | `idx_refresh_expiry`, `idx_cooldowns_until`, `idx_intro_msgs_purge`, `idx_job_apps_retention`, `idx_contact_retention`, the BRIN indexes                                                                                                |
| Safety check-ins                              | `idx_checkins_due (respond_by) WHERE status IN ('scheduled','due','snoozed')`                                                                                                                                                           |
| CMS schedule (`content.schedule`)             | `idx_<table>_wf_due`, `idx_<table>_wf_unpub` on the 10 workflow tables                                                                                                                                                                  |
| Audit chain                                   | `uq_audit_chain_seq (chain_seq, created_at)`: the trigger reads the newest `row_hash` by `chain_seq DESC` on every insert, and `audit.verify_chain` walks it in order                                                                   |

### 4.3 Admin paths

| Path                                   | Order the spec asks for                        | Index                                                                                                                                                                                                                                                |
| -------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Moderation queues (A13, A14)           | kind, then priority, then SLA due              | `idx_cases_queue (kind, priority DESC, sla_due_at) WHERE status IN ('queued','claimed')`; scope by country `idx_cases_country`                                                                                                                       |
| Reports                                | severity, then SLA due                         | `idx_reports_queue (severity DESC, sla_due_at) WHERE status IN ('open','triaged','in_review')`                                                                                                                                                       |
| Black Badge review (A12)               | SLA due, oldest first                          | `idx_badge_queue (sla_due_at) WHERE status IN ('submitted','in_review')` [ADM A12]                                                                                                                                                                   |
| Support tickets (A27)                  | priority, then age; reply due                  | `idx_tickets_queue (priority DESC, created_at)`, `idx_tickets_due (reply_due_at)`                                                                                                                                                                    |
| Approvals inbox (A06)                  | oldest pending                                 | `idx_admin_approvals_pending`, `idx_admin_approvals_approver`, `idx_admin_approvals_requester`                                                                                                                                                       |
| Safety escalations (A15)               | open, oldest first                             | `idx_escalations_open`                                                                                                                                                                                                                               |
| Privacy requests (A36)                 | due date                                       | `idx_privacy_due (due_at) WHERE status IN ('open','in_progress')`                                                                                                                                                                                    |
| Disputes, re-verification, legal holds | due date                                       | `idx_disputes_open`, `idx_reverify_queue`, `idx_legal_hold_review`                                                                                                                                                                                   |
| Content publishing queue (A28)         | status, newest change                          | `idx_<table>_wf_queue (status, updated_at DESC)`, read through `v_content_queue`                                                                                                                                                                     |
| Member directory (A09)                 | `created_at` desc, `last_active_at`            | `idx_users_created_id`, `idx_users_last_active`, `idx_users_country`; filters `idx_users_status`, `idx_users_role`                                                                                                                                   |
| Member search (A04, A09)               | exact e-mail                                   | `uq_users_email` (citext, non-deleted accounts)                                                                                                                                                                                                      |
|                                        | exact E.164 phone                              | `uq_phone_one_account` (verified, current numbers only)                                                                                                                                                                                              |
|                                        | full id                                        | primary key of `users`                                                                                                                                                                                                                               |
|                                        | last 8 hex characters of the id                | **none**: GAP-DB04-01                                                                                                                                                                                                                                |
|                                        | nickname prefix                                | `idx_profiles_nick_prefix` (query must use `lower(nickname) LIKE lower($1) \|\| '%'`)                                                                                                                                                                |
| Member 360 tabs (A10)                  | per member, newest first                       | `idx_tx_user`, `idx_reports_reported`, `idx_reports_reporter`, `idx_cases_subject`, `idx_tickets_user`, `idx_consents_user`, `idx_verif_user`, `idx_liveness_user`, `idx_rule_hits_user`                                                             |
| Audit log search (A07)                 | date range required, at most 31 days [ADM A07] | `idx_audit_target (target_type, target_id, created_at DESC)`, `idx_audit_admin (admin_id, created_at DESC)`, `idx_audit_brin`; the date range prunes partitions                                                                                      |
| Network and security (A32)             | by prefix, ASN or route over time              | `idx_iprollups_prefix`, `idx_iprollups_asn`, `idx_iprollups_route`, `idx_samples_prefix`, `idx_samples_errors`, `idx_edge_events_rule`, `idx_detections_open`, `idx_detections_subject`; live IP rules `idx_ip_rules_live` (GiST on `cidr inet_ops`) |
| Finance (A19–A23)                      | by member, subscription, environment           | `idx_tx_user`, `idx_tx_sub`, `idx_tx_env`, `idx_refunds_tx`, `idx_payouts_period`                                                                                                                                                                    |

Notes on the admin paths:

- Audit filters `action` (prefix), `permission_key`, `approval_id`, `actor_kind` and the exact
  `request_id` search have no index of their own. They are filters inside the mandatory date range,
  which is why [ADM A07] caps a query at 31 days. Do not add indexes for them without evidence.
- Rate limiting itself is not a database path: counters live in Redis (`rl:{policy}:{subject}`
  [DD §14]). `rate_limit_policies` is a 15-row table read by primary key and cached.
- The directory filters Gender and Intention raised in GAP-MOD05-03 need no new index.
  **Recommendation:** both are low-cardinality; serve them as filters on the join to `profiles`
  while walking `idx_users_created_id`. `idx_profiles_feed` cannot serve the directory because it
  excludes hidden profiles, which the directory must show. Revisit only if the staging EXPLAIN shows
  the 1 s page target of [ADM A09] is missed.
- `appeals` has no secondary index. Appeals are worked through `moderation_cases`
  (`idx_cases_queue`), so the queue is served; the member's own list is part of GAP-DB04-02.

## 5. Write cost budget

Every index is paid for on every insert, and on every update that changes an indexed column or
cannot be done in place.

| Table                                   | Write rate                                         | Indexes at baseline (incl. primary key) | Budget                                                                        |
| --------------------------------------- | -------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------- |
| `messages`                              | Highest: 30 a minute per member allowed [TR §13.3] | 4 per partition                         | **No more.** A new need is met by a side table (as `message_client_ids` does) |
| `group_messages`                        | High                                               | 3 per partition                         | No more                                                                       |
| `feed_impressions`                      | High: one row per card shown                       | 3 per partition                         | No more                                                                       |
| `analytics_events`                      | High                                               | 3 per partition                         | No more; analysis goes to the materialised views or the warehouse             |
| `api_request_*`, `edge_security_events` | Batched every minute or 15 min [TR §14], [TR §11]  | 2 to 5 per partition                    | One more at most, with evidence                                               |
| `reactions`                             | High: 120 a minute per member allowed [TR §13.3]   | 6                                       | One more at most                                                              |
| `notifications`, `inbox_items`          | High                                               | 6, 3                                    | One more at most                                                              |
| `users`, `profiles`                     | Low writes, hot reads                              | 9, 5                                    | Reads decide; avoid indexing columns that change on every request             |
| Queue and admin tables                  | Low                                                | 2 to 6                                  | Free to index what a screen sorts or filters on                               |

The limits in the Budget column are **Recommendations**; the sources give latency budgets, not
index counts.

Rules:

1. `users.last_active_at` is indexed (`idx_users_last_active`). Update it at most once per member
   per interval, not per request, or every request rewrites an index entry.
   **Recommendation:** throttle through Redis presence (`presence:*` [DD §14]) and write the column
   on a coarse interval.
2. Counters that change on every message (`conversation_participants.unread_count`,
   `conversations.last_message_at`) are in partial or small indexes on purpose. Do not add them to
   wide composite indexes.
3. A partial index is cheaper than a full one only if rows leave it. Check that the status
   transition that removes a row from a queue index really happens (expired, processed, closed).

## 6. Geospatial indexing

| Index                 | Column                                      | Predicate                                           | Used by                                               |
| --------------------- | ------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------- |
| `idx_profiles_geo`    | `profiles.location` `geography(Point,4326)` | `WHERE NOT is_hidden`                               | Discovery deck and Nearby [TR §8.5]                   |
| `idx_groups_discover` | `groups.location`                           | `WHERE status = 'active' AND join_rule <> 'invite'` | Group discovery                                       |
| `idx_venues_loc`      | `venues.location`                           | `WHERE is_active`                                   | Meet-up venue suggestions                             |
| `idx_cities_centroid` | `cities.centroid`                           | none                                                | Nearest city for a point                              |
| `idx_ip_rules_live`   | `ip_access_rules.cidr` (`inet_ops`)         | `WHERE removed_at IS NULL`                          | "Which live rule contains this address" (not PostGIS) |

Rules for the discovery query:

1. Use `ST_DWithin(p.location, $me, $metres)` as [TR §8.5] writes it. It is index-assisted on
   `geography`. `ST_Distance(...) < x` is not and scans the table.
2. Include `NOT p.is_hidden` literally, or the partial index is not considered.
3. Order by distance only among the candidates already filtered; the outline orders by Spotlight
   priority, shared-specs score, recency and distance, then `LIMIT 50` [TR §8.5]. The radius bounds
   the candidate set, so the sort is over that set, never over the table.
4. The stored point is coarse (about a 1 km grid) and the exact location is never stored
   [SQL comment on `profiles.location`]. Many members therefore share a point; do not use location
   as a tiebreaker or a key.
5. The international tab does not use the GiST index: it filters `country IN (…)` (at most five
   countries) through `idx_profiles_feed` [TR §8.5].
6. The 50 results are cached in Redis `feed:{user}:{tab}` and served 10 at a time [TR §8.5], so the
   query runs on a refill, not on a swipe. The 300 ms deck budget (section 11) applies to the cached
   read; the refill is the job `feed.refill` [TR §11].

Growth path, from [TR §10.3]: indexes and tuning first, then a read replica for discovery and
analytics, then partition retention, then Citus.

## 7. Text search: what the schema actually uses

| Need                                 | Mechanism                                                                                                              | Index                                                                                                      |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Help-centre article search           | `help_articles.search_tsv`, a stored generated `tsvector` over title, summary and body with the `simple` configuration | `idx_help_search` (GIN, published rows only)                                                               |
| Group search by name and description | `groups.search_tsv`, same shape                                                                                        | `idx_groups_search` (GIN, active rows only)                                                                |
| City type-ahead                      | prefix match on `lower(ascii_name)`                                                                                    | `idx_cities_search` (`text_pattern_ops`)                                                                   |
| Admin nickname search                | prefix match on `lower(nickname)`                                                                                      | `idx_profiles_nick_prefix` (`text_pattern_ops`)                                                            |
| E-mail lookup                        | exact match on a `citext` column                                                                                       | `uq_users_email`                                                                                           |
| Tag and placement filters            | array containment                                                                                                      | GIN on `faqs.topics`, `journal_articles.tags`, `in_app_announcements.placement`, `admin_macros.case_kinds` |

What follows from that:

- The `simple` configuration does no stemming and removes no stop words. That suits three locales
  (en, pcm, fr) with one index, at the price of exact-word matching.
- The schema loads `postgis`, `citext` and `pgcrypto` only [SQL preamble]. There is no `pg_trgm`,
  so no fuzzy or substring search, and no index can serve `ILIKE '%text%'`.
- There is no member-to-member free-text search and no message search. The admin spec states e-mail
  and phone searches are exact matches only [ADM A04].
- A `text_pattern_ops` index serves `LIKE 'abc%'` on the same expression only. Lower-case the input
  in the application and escape `%` and `_`.

Adding trigram or substring search means adding an extension and is a schema change with a gap
entry, not a query tweak.

## 8. Partition pruning

Pruning happens only when the query constrains the partition column with a value the planner or
executor can see.

| Table                                                       | Rule for queries                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `admin_audit_log`                                           | Always pass the date range. The API requires one and caps it at 31 days [ADM A07]. `GET /audit/:created_at/:id` carries `created_at` in the path for the same reason                                                                                                                                                                                                                           |
| `messages`, `group_messages`                                | A thread page orders by `created_at DESC` and limits. Without a time bound, PostgreSQL opens the thread index of every partition and merges them. **Recommendation:** the cursor carries `created_at`, and the query adds `created_at < $cursor`; the first page adds a lower bound taken from `conversations.last_message_at` minus a window, widening if fewer rows than the limit come back |
| `feed_impressions`                                          | Quota audits and Spotlight statistics pass the day or the week                                                                                                                                                                                                                                                                                                                                 |
| `analytics_events`, `api_request_*`, `edge_security_events` | Every dashboard query has a time window; never query "all time"                                                                                                                                                                                                                                                                                                                                |

Further rules:

1. Join and reference a message by its full key `(conversation_id, id, created_at)`. That is why
   `message_attachments`, `message_reactions` and `group_message_reactions` store
   `message_created_at`.
2. Retention on partitioned tables is done by detaching whole partitions (`partitions.retain`
   [TR §11]), never by `DELETE`. `messages` is the exception: its retention is "while the
   conversation exists" [TR §16.1], so its partitions are not dropped by age.
3. `partitions.ensure` keeps three months ahead [TR §11]. If it fails, rows land in the `DEFAULT`
   partition, which is never pruned and blocks later partition creation for that range. Alert on
   any row count above zero in a `*_default` partition.
4. Partition creation needs the worker's one DDL right; detaching needs one it does not have yet
   (GAP-DB05-04 in [1MM-DB-05](1MM-DB-05-SECURITY.md)).

## 9. Materialised views

| Materialised view                | Unique index                                           | Refresh stated in the sources |
| -------------------------------- | ------------------------------------------------------ | ----------------------------- |
| `mv_admin_daily_kpis`            | `uq_mv_daily_kpis (day)`                               | every 15 min [SQL comment]    |
| `mv_admin_daily_kpis_by_country` | `uq_mv_kpis_country (day, country)`                    | with the above [MOD-18]       |
| `mv_city_weekly_joins`           | `uq_mv_city_weekly (city_id, week_start)`              | job `stats.refresh`           |
| `mv_moderation_sla`              | `uq_mv_mod_sla (kind)`                                 | job `stats.refresh`           |
| `mv_revenue_daily`               | `uq_mv_revenue (day, provider, product_code, country)` | job `stats.refresh`           |
| `mv_active_users_daily`          | `uq_mv_active_daily (day, country, platform)`          | job `stats.refresh`           |

- `stats.refresh` runs every 5 to 60 minutes and refreshes concurrently [TR §11]. A concurrent
  refresh needs a unique index over plain columns with no predicate; each view has one. Never drop
  or make one partial.
- The unique index is also the read path: dashboards filter by `day` (and country or provider).
- A concurrent refresh rebuilds the whole result and diffs it. Its cost is the cost of the defining
  query, so the base-table indexes the view's query uses are part of this budget
  ([MOD-18](../execution/1MM-EXE-MOD-18-ANALYTICS-OVERVIEW-AND-RESEARCH.md) risk on correlated
  subqueries over 90 days). The refresh queries are in the EXPLAIN set (section 12).
- The baseline ends with a plain `REFRESH` of all six, so they are populated before the first
  concurrent refresh.
- The worker role cannot run `REFRESH` today: GAP-DB05-04 in
  [1MM-DB-05](1MM-DB-05-SECURITY.md).

## 10. Rules for adding an index

### 10.1 Evidence first

1. Name the query: the endpoint, job or screen, and its budget from section 11.
2. Show `EXPLAIN (ANALYZE, BUFFERS)` before and after, on data shaped like production: realistic
   row counts and skew, synthetic only ([1MM-DB-06](1MM-DB-06-DATA-PROTECTION.md) section 12).
   An empty local database proves nothing, because the planner prefers a sequential scan on a small
   table.
3. Check first whether an existing index serves the query once the predicate or the sort is written
   to match it (section 3.3).
4. State the write cost against section 5.
5. Prefer, in order: a partial index on the live rows; extending the key of an existing index;
   a new index. Never add an index that is a left-prefix of another on the same table with the same
   predicate.
6. Record the evidence in the pull request and the module's progress entry.

### 10.2 Naming and shape

- `idx_<table-or-abbreviation>_<purpose>`; `uq_<…>_<rule>` for unique indexes; `uq_mv_<name>` on
  materialised views. Use the abbreviation the table's existing indexes use (`tx`, `cp`, `subs`).
- One statement per line, as the baseline does, so the counts in section 2 stay scriptable.
- A unique index on a partitioned table includes the partition column.
- The Drizzle models do not declare indexes; the SQL owns them
  ([1MM-DB-01](1MM-DB-01-SCHEMAS.md)).
- Add a `COMMENT ON INDEX` only when the purpose is not clear from the name.

### 10.3 `CONCURRENTLY` and the one-transaction rule

`packages/db/src/migrator.ts` sends each file as one simple-protocol query, so PostgreSQL runs the
whole file as a single implicit transaction. `CREATE INDEX CONCURRENTLY`,
`DROP INDEX CONCURRENTLY` and `REINDEX CONCURRENTLY` refuse to run inside a transaction block, so
**they cannot be used in a migration file today**. A plain `CREATE INDEX` in a migration takes a
lock that blocks writes to the table for the whole build.

| Situation                                       | What to do                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Before launch, or a table that is small or cold | Plain `CREATE INDEX` in a numbered migration. This is the normal case during the build                                                                                                                                                                                                                                                                                                                                                            |
| A large, hot table after launch                 | Needs a non-transactional migration path, which the runner does not have: GAP-DB04-04, the same change as GAP-DB02-01 in [1MM-DB-02](1MM-DB-02-MIGRATIONS.md) (a file whose first line is `-- migrate: no-transaction`). Until it exists, an online index build is a reviewed manual step run with the migration role, followed by a migration that contains `CREATE INDEX IF NOT EXISTS` with the same definition so every environment converges |
| A partitioned table after launch                | `CREATE INDEX CONCURRENTLY` is not allowed on the parent. Create the index on the parent with `ON ONLY`, build it on each partition concurrently, then attach each one; the parent index becomes valid when the last is attached                                                                                                                                                                                                                  |
| A concurrent build that failed                  | It leaves an `INVALID` index that still costs writes. Drop it and rebuild; the check is in section 10.4                                                                                                                                                                                                                                                                                                                                           |

Set a `lock_timeout` in any migration that adds an index to a table with traffic, so the migration
fails fast instead of queueing behind a long transaction and blocking everything after it
(**Recommendation**).

### 10.4 Finding unused, duplicate and invalid indexes

Run on production monthly and before any index is added (**Recommendation**). These read statistics
only.

Unused since the last statistics reset (exclude constraint indexes, which exist for correctness):

```sql
SELECT s.relname AS table_name, s.indexrelname AS index_name,
       pg_size_pretty(pg_relation_size(s.indexrelid)) AS size, s.idx_scan
FROM pg_stat_user_indexes s
JOIN pg_index i ON i.indexrelid = s.indexrelid
WHERE s.schemaname = 'public' AND s.idx_scan = 0
  AND NOT i.indisunique AND NOT i.indisprimary
ORDER BY pg_relation_size(s.indexrelid) DESC;
```

Read the result with care: check `pg_stat_database.stats_reset`, wait a full month (monthly jobs),
and check the read replica separately once one exists. A queue index may show few scans and still
be essential.

Exact duplicates (same table, columns, operator classes, expressions and predicate):

```sql
SELECT indrelid::regclass AS table_name, array_agg(indexrelid::regclass) AS duplicates
FROM pg_index
GROUP BY indrelid, indkey, indclass, indoption,
         coalesce(pg_get_expr(indexprs, indrelid), ''),
         coalesce(pg_get_expr(indpred, indrelid), '')
HAVING count(*) > 1;
```

Left-prefix overlaps (candidates only; a partial or unique index is not redundant):

```sql
SELECT a.indrelid::regclass AS table_name,
       a.indexrelid::regclass AS narrower, b.indexrelid::regclass AS wider
FROM pg_index a
JOIN pg_index b ON a.indrelid = b.indrelid AND a.indexrelid <> b.indexrelid
WHERE a.indpred IS NULL AND b.indpred IS NULL AND NOT a.indisunique
  AND a.indnatts < b.indnatts
  AND (b.indkey::int2[])[0:a.indnatts - 1] = a.indkey::int2[];
```

Invalid indexes left by a failed concurrent build:

```sql
SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid;
```

Dropping an index is a migration like any other, with the evidence above in the pull request. Never
drop a `uq_` index or a constraint index on usage evidence: they are rules.

## 11. Performance budgets the indexes must meet

From [TR §15.1]. Server time is measured at the origin.

| Measure                          | Budget                                                        | What it means for queries                                                                                   |
| -------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| API reads, p95                   | < 200 ms                                                      | A read endpoint's queries are index scans; no sequential scan on a table that grows with members            |
| API writes, p95                  | < 400 ms                                                      | Section 5: few indexes on hot tables; one transaction per change [TR §13.1]                                 |
| Discovery deck, p95              | < 300 ms                                                      | Served from the Redis deck; the refill query is index-assisted (section 6)                                  |
| End to end from Lagos on 4G, p95 | reads < 450 ms, writes < 650 ms [OD-11]                       | About 100 to 150 ms of network time is outside the database [TR §4.3]; the origin budgets above still apply |
| Chat delivery                    | < 500 ms between two online members (< 700 ms Lagos to Lagos) | The message insert and the participant updates fit one short transaction                                    |
| Black Badge auto-decision        | 80% within 5 minutes                                          | Queue indexes keep job pick-up constant-time                                                                |
| Availability                     | 99.9% monthly for the API                                     | No migration takes a long write lock on a hot table (section 10.3)                                          |
| Admin list page                  | a 50-row page within 1 s on staging [ADM A09]                 | Every filter maps to an indexed query [ADM A09]                                                             |

The database's share of each API budget is not split out in the sources. **Recommendation:** treat
50 ms p95 for a single hot read query and 100 ms for a write transaction as the working targets,
and alert on the slow-query log above 200 ms.

## 12. EXPLAIN checks in CI (planned)

[TR §15.2] lists "EXPLAIN checks in CI for hot queries". **Nothing in the repo does this yet**:
`.github/workflows/ci.yml` applies the migrations and roles and runs the tests, and
`packages/db/src` has two test files, neither of which inspects a plan. This is GAP-DB04-03, to be
delivered with `MOD-00-DB-02` ([MOD-00](../execution/1MM-EXE-MOD-00-FOUNDATIONS.md)).

Planned design (**Recommendation**):

1. A synthetic fixture loader in `packages/db` fills the hot tables with enough rows and skew that
   the planner's choice is meaningful, then runs `ANALYZE`. Synthetic data only.
2. Each hot query is registered with its owning module and the index it must use.
3. The test runs `EXPLAIN (FORMAT JSON)` and asserts on the plan, not on timing: the named index
   appears; no `Seq Scan` node on the listed large tables; for partitioned tables the number of
   partitions scanned is at most the expected number; no `Sort` node above a keyset query that the
   index should order.
4. The test runs as the role the query runs as in production (`app_api` with `app.user_id` set for
   member queries), because row-level security changes plans
   ([1MM-DB-05](1MM-DB-05-SECURITY.md)).
5. A module adds its queries when it builds them; the module's API gate includes the check.

First set of queries:

| Query                                           | Must use                                                             | Must not                                         |
| ----------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------ |
| Discovery refill [TR §8.5]                      | `idx_profiles_geo`                                                   | Seq scan on `profiles`, `reactions`, `blocks`    |
| Likes grid page                                 | `idx_reactions_likes_grid`                                           | Sort node                                        |
| Matches list                                    | `idx_matches_a` and `idx_matches_b`                                  | Seq scan on `matches`                            |
| Chat thread page                                | `idx_messages_thread`                                                | Scan more partitions than the cursor window      |
| Conversations list                              | `idx_cp_chat_list`                                                   | Seq scan on `conversations`                      |
| Inbox page                                      | `idx_inbox_user`                                                     | Sort node                                        |
| Outbox pick-up                                  | `idx_notifications_due`                                              | Seq scan on `notifications`                      |
| Webhook retry pick-up                           | `idx_webhooks_pending`                                               | Seq scan on `webhook_events`                     |
| Moderation queue page                           | `idx_cases_queue`                                                    | Sort node                                        |
| Member directory page                           | `idx_users_created_id`                                               | Sort node                                        |
| Member search by e-mail, phone, nickname prefix | `uq_users_email`, `uq_phone_one_account`, `idx_profiles_nick_prefix` | Seq scan on `users`, `phone_numbers`, `profiles` |
| Audit log page for a target                     | `idx_audit_target`                                                   | Scan partitions outside the date range           |
| Each materialised view's defining query         | (recorded plan cost under a ceiling)                                 | Cost growth beyond the ceiling without review    |

## 13. Watch list

Items that are not gaps today because there is no evidence yet. Each is checked with EXPLAIN when
its module is built.

| #   | Item                                                                                                                                                                                                                                               | Owner              |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 1   | Conversations list sorts after fetching the member's conversations (section 4.1). If a member can hold thousands of open conversations, denormalise `last_message_at` onto `conversation_participants` and index `(user_id, last_message_at DESC)` | MOD-08             |
| 2   | Thread pages without a time bound open every `messages` partition (section 8)                                                                                                                                                                      | MOD-08             |
| 3   | `idx_users_last_active` write churn (section 5)                                                                                                                                                                                                    | MOD-00, MOD-03     |
| 4   | Materialised view refresh cost as base tables grow (section 9)                                                                                                                                                                                     | MOD-18             |
| 5   | Audit filters with no index inside the date range (section 4.3)                                                                                                                                                                                    | MOD-01             |
| 6   | The 81 "other" unindexed foreign keys (section 3.2)                                                                                                                                                                                                | each owning module |

## 14. Gaps raised

Dispositions are recorded in [1MM-LOG-03](../1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md) (Technical Reference and schema), [1MM-LOG-02](../1MM-LOG-02-UI-UPDATES.md) (UI) and [1MM-LOG-04](../1MM-LOG-04-OPEN-DECISIONS-AND-FOLLOW-UPS.md) (owner decisions and repository follow-ups).

| Gap id      | Type   | Where found                                                        | What is missing or conflicting                                                                                                                                                                                                                                                                                  | Proposed resolution                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Blocks                                                                         |
| ----------- | ------ | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| GAP-DB04-01 | SCHEMA | [ADM A04] global search, [ADM A09]; [SQL] `users`, `phone_numbers` | Search by the last 8 hex characters of `users.id` has no index: a uuid primary key cannot serve a suffix match, so the query scans `users`. Exact phone search is indexed only for verified, current numbers (`uq_phone_one_account` is partial), so a number that is unverified or released is found by a scan | `CREATE INDEX idx_users_id_last8 ON users (right(id::text, 8));` and `CREATE INDEX idx_phone_e164 ON phone_numbers (e164);`. The last-8 query must use the same expression                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | MOD-05-API-02, MOD-00 global search                                            |
| GAP-DB04-02 | SCHEMA | [SQL] foreign keys to `users`; section 3.2                         | 42 foreign keys to `users` have no index led by the column, 27 of them `ON DELETE CASCADE`. Erasure, export and several member screens look these tables up by member and would scan them                                                                                                                       | First set, where a member screen or the erasure job reads by member: `CREATE INDEX idx_appeals_user ON appeals (user_id, created_at DESC);` `CREATE INDEX idx_checkins_user ON safety_checkins (user_id);` `CREATE INDEX idx_escalations_user ON safety_escalations (user_id);` `CREATE INDEX idx_privacy_user ON privacy_requests (user_id) WHERE user_id IS NOT NULL;` `CREATE INDEX idx_trials_user ON trials (user_id);` `CREATE INDEX idx_credits_user ON billing_credits (user_id);` `CREATE INDEX idx_calls_caller ON calls (caller_id, started_at DESC);` `CREATE INDEX idx_calls_callee ON calls (callee_id, started_at DESC);` `CREATE INDEX idx_intro_sessions_a ON intro_sessions (user_a);` `CREATE INDEX idx_intro_sessions_b ON intro_sessions (user_b);` `CREATE INDEX idx_meetups_creator ON meetups (created_by);`. The remaining columns listed in section 3.2 are decided by the owning module with EXPLAIN evidence from the erasure and export jobs (MOD-16) | MOD-16 erasure and export at volume                                            |
| GAP-DB04-03 | REPO   | [TR §15.2]; `.github/workflows/ci.yml`; `packages/db/src`          | "EXPLAIN checks in CI for hot queries" is a stated technique, but no test, fixture or CI step exists                                                                                                                                                                                                            | Add the plan-assertion test and synthetic fixture loader of section 12 to `packages/db`, run in the `verify` job after `pnpm db:roles`; schedule with `MOD-00-DB-02`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Performance sign-off in MOD-19                                                 |
| GAP-DB04-04 | REPO   | `packages/db/src/migrator.ts`; `packages/db/migrations/README.md`  | Every migration file runs as one transaction, so `CREATE INDEX CONCURRENTLY` cannot be shipped as a migration. After launch, an index on a large table can only be added with a write-blocking lock or by hand                                                                                                  | Add a non-transactional file kind to the runner, marked by a first-line comment `-- migrate: no-transaction`: one statement per file, sent alone, ledger row written after it succeeds, `IF NOT EXISTS` required so a retry is safe. This is the same change as GAP-DB02-01 in [1MM-DB-02](1MM-DB-02-MIGRATIONS.md), which defines the marker; deliver both as one                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | First post-launch index on `messages`, `reactions`, `notifications` or `users` |

Related gaps owned elsewhere: GAP-DB01-01 (`edge_security_events` monthly partitions), GAP-MOD05-03
(directory filters, assessed in section 4.3), GAP-DB05-04 (worker rights for `REFRESH` and partition
detach).

## Change log

| Version | Date        | Change                                                                                             |
| ------- | ----------- | -------------------------------------------------------------------------------------------------- |
| v1.0    | 24 Nov 2026 | First issue: inventory counted from schema v3.4, hot paths, rules, budgets, planned EXPLAIN checks |
