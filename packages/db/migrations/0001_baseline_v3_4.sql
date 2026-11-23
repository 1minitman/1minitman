-- =====================================================================
-- 1minitman database schema · v3.4 (21 Nov 2026)
-- PostgreSQL 16 + PostGIS 3.4 + citext + pgcrypto · Citus-ready
-- Source of truth for packages/db (Drizzle models are generated from /
-- kept in sync with this file; every change ships as a numbered migration).
--
-- Changelog
--   v3.4 21 Nov 2026  Full design-board review (mobile M-*, website W-*, admin
--                     A01-A36) against the schema, de-duplicated and applied
--                     (_sources/DESIGN_DATA_REVIEW_2026-11-21.md; item ids
--                     M / W / A / B are cited on every v3.4 line). Migration
--                     migrations/0005_v3_4_design_review.sql (delta only,
--                     idempotent; run without a wrapping transaction).
--                     * P1: admin audit chain v2: chain_seq assigned inside
--                       the trigger after the lock, hash over every audited
--                       field (admin_audit_row_hash(), canonical JSON) (A1/A2),
--                       remote_config.permission_key so the sanctions ladder
--                       is approved under sanctions.manage (A3); Spotlight
--                       turn_no 1-3 + position (M1/B1, OD-18); CMS
--                       live_revision_id / live_version on the 10 workflow
--                       tables, published -> draft allowed, published legal
--                       documents immutable (B2/B39); transactions.environment,
--                       sandbox left out of mv_revenue_daily (+ country) (B3),
--                       notifications for non-members (recipient_kind,
--                       encrypted address + hash) and content broadcasts
--                       (broadcast_id, template optional), templates N23-N36
--                       and W01-W08 (W3/B4/B5/M20); anonymous W34 safety
--                       report (name / email optional for kind safety,
--                       web_safety_category_t, SR- reference, urgent triage
--                       and SLA) (W1/W10/W11); web_uploads with scan status
--                       (W2); beta_invites + waitlist status invited +
--                       redeem_beta_invite(), otp purpose waitlist_confirm (W4/W5)
--                     * new tables (20): group_message_reactions,
--                       payment_methods (Flutterwave token only),
--                       partner_preference_languages, feature_waitlist,
--                       web_uploads, beta_invites, plan_compare_rows,
--                       web_redirects_daily, story_consents,
--                       investor_document_grants, admin_security_alerts,
--                       admin_audit_chain_runs, safety_escalation_updates,
--                       appeal_evidence, decision_reasons,
--                       age_verification_requests (A14b age check, owner
--                       decision), moderation_case_watchers,
--                       reconciliation_items, edge_security_events
--                       (partitioned), cms_publish_runs; view
--                       v_public_plan_prices
--                     * human refs SE- / A- / RF- / PR- / LH- / SI- / J-,
--                       214 new columns on 84 tables (groups topic / icon / slug, settings
--                       switches, Gold incognito next to invisible, refunds,
--                       disputes, privacy requests, admin lock / break-glass /
--                       allowed scopes, campaign attribution ...)
--                     * enums: otp_purpose_t, rsvp_status_t (maybe),
--                       report_context_t, case_status_t (awaiting_member),
--                       moderation_action_t (request_age_check),
--                       subscription_status_t / _event_t (on_hold),
--                       legal_doc_kind_t (refund_policy), export_status_t
--                       (held); new web_safety_category_t; on_hold counts toward
--                       the one-live-subscription index (uq_subs_one_live)
--                     * seeds: 59 B7 vibes, 26 P2 industries (+ other), 34
--                       languages, option sets kids_have / kids_want /
--                       love_language / comms_style / languages, Nigerian
--                       beta cities + Lagos areas + London, 13 dial-code
--                       countries, 4 message effects, 6 starter venues, 3
--                       abuse rules, decision reasons, 8 help categories, 5
--                       journal categories, T-7 timings as remote_config
--                       (intro text 280, DM request 14 d, unmatch 30 d read by
--                       unmatch(), call ring 45 s), privacy.sla_days.* = 30
--                       PROVISIONAL until counsel confirms, maintenance keeps
--                       the safety form open (exempt_forms), permissions
--                       admins.unlock / waitlist.invite /
--                       investors.grant_access (89 total), 12 worker jobs,
--                       enabled flags at 100% rollout
--                     * totals: 201 -> 221 tables, 8 -> 9 partitioned, 12 -> 13
--                       views, 6 materialized views, 100 -> 101 enums, 36 -> 40
--                       functions, 991 -> 1,085 indexes (incl. partitions), 14
--                       RLS policies, 89 admin permissions. Verified on PGlite
--                       0.5.14 (PG 18.6) + PostGIS: 1,183 statements; 37 v3 +
--                       22 v3.1 / v3.2 + 4 v3.3 + 15 v3.4 behaviour tests
--                       pass; v3.3 + migration 0005 (applied twice) matches
--                       this file (columns, constraints, indexes, enums,
--                       functions, triggers, views, seeds, comments).
--   v3.3 20 Nov 2026  Owner decisions of 19-20 Nov 2026 (OD-12..OD-31,
--                     _sources/DECISIONS_LOG.md): web billing moves from Stripe
--                     to Flutterwave (OD-14): payment_provider_t gains
--                     'flutterwave' ('stripe' kept as a legacy value only),
--                     pay_method_t gains bank_transfer / ussd, web price seeds,
--                     vendor card and flags switch to Flutterwave,
--                     account_deletions.stripe_cancelled_at renamed
--                     web_billing_cancelled_at; remote_config adds
--                     spotlight.rotations_per_week = 3, spotlight.gold_priority
--                     = true (OD-18), chat.gold_new_conversations_daily_soft_cap
--                     = 100 (OD-31 / P-1), appeals.sla_hours = 48 (OD-28),
--                     role_entitlements spotlight.turns_per_week Premium 3 /
--                     Gold 3 (one turn per rotation); new entitlement
--                     likes.sort_filter (Premium / Gold, OD-31 / P-3),
--                     open-decision comments
--                     replaced by their decisions. Migration
--                     0004_v3_3_owner_decisions.sql.
--   v3.2.1 18 Nov 2026 OD-11 lean hosting (Neon PostgreSQL 16 + PostGIS, Upstash
--                     Redis, Railway, Cloudflare R2): comment text only (WAF IP
--                     lists, secret refs). No DDL change; extensions used
--                     (postgis, citext, pgcrypto) are all available on Neon.
--   v3.2 18 Nov 2026  Owner decisions OD-01..OD-10 (_sources/DECISIONS_LOG.md):
--                     offers.enabled flag OFF and offer_campaign_guard refuses
--                     go-live while off (OD-01); intro window 24 h (OD-02);
--                     daily caps BASIC 25 / ACTIVE 50 / Premium + Gold none via
--                     remote_config discovery.daily_cap.basic / .verified_free,
--                     daily_spec_cap() + spend_spec_view() (OD-03); refunds:
--                     billing.refund_approval_threshold_usd_cents = 0 and
--                     refund_approval_guard() = four-eyes on every admin refund
--                     (OD-04 / OD-05); vendors posthog + cloudflare added,
--                     liveness = AWS Rekognition Face Liveness, carrier check
--                     deferred (flag verification.carrier_check OFF), analytics
--                     = PostHog, no attribution vendor (OD-06); member password
--                     min 8, admin 12 + MFA (OD-07); markets Lagos live, rest
--                     of Nigeria beta by invite, others waitlist, emergency
--                     numbers NG 112 only (OD-09). Migration 0003_v3_2_owner_decisions.sql.
--                     * totals: tables / views / enums / indexes / policies /
--                       permissions unchanged; functions 33 -> 36. Verified on
--                       PGlite 0.5.14 (PG 18.6) + PostGIS: 1,105 statements,
--                       37 v3 + 22 v3.1 / v3.2 behaviour tests pass.
--   v3.1 18 Nov 2026  Closes every schema gap in ADMIN_UI_MODULES_FLOWS.md
--                     Appendix C (C.1 admin / ops / offers, C.2 website CMS,
--                     C.3 seeds) against PUBLIC_WEBSITE_UI_MODULES_FLOWS.md §6.
--                     Every v3.1 line is tagged "v3.1" so the migration
--                     (0002_v3_1_admin_cms.sql) can be cut from this file.
--                     * enums: content_status_t + approved, scheduled
--                       (AD-20 resolved: extend the enum AND add workflow
--                       columns); legal_doc_kind_t + offer_terms;
--                       approval_status_t + failed; scope_kind_t + own;
--                       contact_kind_t + support, story, accessibility, other;
--                       subscriber_status_t + complained
--                     * content workflow (section 18.3): draft -> in_review ->
--                       approved -> scheduled -> published -> archived on all
--                       10 CMS tables, with publish_at / unpublish_at,
--                       two-person rule, native-review gate for pcm / fr,
--                       content_revisions snapshots, content_run_schedule()
--                       (job content.schedule) and slug-change 301 redirects
--                     * website CMS: site_blocks.kind = the 41 block_types of
--                       website §6.3 (+ the 14 v3 kinds kept as legacy),
--                       faqs, redirects, site_settings (incl. maintenance and
--                       offline banner), journal_categories / journal_authors /
--                       journal_articles, waitlist_entries, consent_receipts,
--                       markets status on cities, emergency-number provenance
--                       on countries, locale review fields, media licence /
--                       consent fields, careers / applications / stories /
--                       press / investors / contact / newsletter columns
--                     * offers: offer_campaigns, offer_code_pools, offer_codes,
--                       offer_claims with anti-abuse guard (one claim per
--                       identifier hash, caps, eligible countries, IP-prefix
--                       rate, circuit breaker) and offer_issue_code()
--                     * admin / ops: admin_recovery_codes (hashed only),
--                       admin_trusted_devices, admin_notifications,
--                       admin_saved_views, admin_exports, admin_macros,
--                       reverification_requests (RLS), broadcast_campaigns,
--                       in_app_announcements, security_detections,
--                       security_incidents, legal_holds, reconciliation_runs,
--                       payouts (+ transactions.fee_usd_cents),
--                       analytics_saved_reports, scheduled_exports,
--                       store_installs_daily, api_request_ip_rollups
--                       (partitioned monthly; + asn / country / UA family on
--                       samples), vendor_settings (secret references only),
--                       worker_jobs (job catalogue for A31)
--                     * four-eyes in production enforced in the database for
--                       feature_flags, remote_config, rate_limit_policies,
--                       vendor_settings and sensitive site_settings keys
--                       (enforce_config_approval(); kill switch OFF exempt)
--                     * MVs: mv_admin_daily_kpis + messages_sent,
--                       intros_completed, reports_open_end_of_day; new
--                       mv_admin_daily_kpis_by_country, mv_active_users_daily
--                     * seeds: 37 proposed admin permissions (86 total) and
--                       their grants per Appendix A; config.flags /
--                       config.remote requires_approval = true (AD-05);
--                       member-level exports need approval (AD-06); new
--                       remote_config keys; worker job catalogue; site
--                       settings keys
--                     * totals: 168 -> 201 tables, 8 partitioned, 12 views,
--                       6 materialized views, 100 enums, 33 functions, 991
--                       indexes, 14 RLS policies, 86 admin permissions.
--                       Verified on PGlite 0.5.14 (PG 18.6) + PostGIS: 1,095
--                       statements; 37 v3 + 19 v3.1 behaviour tests pass.
--   v3   18 Nov 2026  Rebuilt against CHANGE_BRIEF (18 Nov), UI_INVENTORY v233
--                     (154 live screens) and CANVAS_NOTES v233:
--                     * plans 5 -> 3 (free, premium, gold); All Access / EXTRA
--                       and the $5.40 Gold price removed; Black Badge is a
--                       one-off $1.00 product, never a subscription
--                     * role ladder BASIC -> PENDING_REVIEW -> ACTIVE -> CLASSIC -> SUPER
--                     * onboarding 10 steps; nickname defaults to first name
--                     * new: prompts (PM8), likes filter (D7F), help articles
--                       + support chat (H1A/H1B), group info (D13A), Pass undo,
--                       unmatch confirm, safe-date bar (EV1), groups, meet-ups,
--                       trusted contacts, check-ins, research metrics, CMS,
--                       full admin RBAC with scoped roles, approvals, MFA
--                     * partitioned messages / events / audit / network logs
--   v1.1 16 Nov 2026  MVP schema (tech/schema.sql), superseded by this file.
--
-- Conventions (decided once, applied everywhere)
--   * Primary keys: uuid v7 (uuid_v7() below) for every entity row.
--     Why: globally unique across Citus shards and devices (the offline
--     outbox generates ids on the phone), time-ordered so B-tree inserts
--     stay local like a bigint, and not guessable in URLs. Small catalogue
--     tables use smallint/text natural keys; append-only, never-referenced
--     logs (analytics events, network samples, audit) use bigint sequences.
--     PostgreSQL 18 adds a native uuidv7(); uuid_v7() keeps PG16 support.
--   * timestamptz everywhere, stored UTC; the session must run with TimeZone=UTC.
--   * created_at / updated_at on every mutable table (trigger set_updated_at).
--   * Soft delete (deleted_at) only where the UI offers undo or retention
--     rules require it; hard erasure happens only in the erasure job.
--   * Every "only one" rule is a constraint or unique index, not app logic.
--   * Money: integer US cents (domain usd_cents). List prices are USD only.
--   * PII class is stated in each table comment: none / personal /
--     sensitive / biometric (see SCHEMA_DATA_DICTIONARY.md).
--   * Citus: comments marked "Citus:" give the distribution column.
--     Reference tables (catalogues) are replicated to every node.
--     Section 25 lists the create_distributed_table() calls (commented out:
--     plain PostgreSQL 16 runs this file as-is).
-- =====================================================================

SET client_min_messages = warning;
SET TimeZone = 'UTC';

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================================
-- 0. HELPERS
-- =====================================================================

-- UUID version 7 (RFC 9562): 48-bit Unix ms timestamp + random bits.
CREATE OR REPLACE FUNCTION uuid_v7(p_ts timestamptz DEFAULT clock_timestamp())
RETURNS uuid LANGUAGE sql VOLATILE PARALLEL SAFE AS $$
  SELECT encode(
           set_bit(set_bit(
             overlay(uuid_send(gen_random_uuid())
                     PLACING substring(int8send((extract(epoch FROM p_ts) * 1000)::bigint) FROM 3)
                     FROM 1 FOR 6),
             52, 1), 53, 1),
         'hex')::uuid;
$$;
COMMENT ON FUNCTION uuid_v7(timestamptz) IS 'Time-ordered UUID v7 generator (PG16-compatible). Default for every entity primary key.';

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
COMMENT ON FUNCTION set_updated_at() IS 'BEFORE UPDATE trigger: stamps updated_at.';

CREATE OR REPLACE FUNCTION forbid_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only (% refused)', TG_TABLE_NAME, TG_OP USING ERRCODE = '42501';
END $$;
COMMENT ON FUNCTION forbid_mutation() IS 'BEFORE UPDATE OR DELETE trigger for append-only ledgers (audit, consents, moderation actions, intro decisions). The erasure job uses a dedicated role that disables it per statement with session_replication_role.';

-- Age in whole years on a given day (used by the 18+ gate and discovery).
CREATE OR REPLACE FUNCTION age_years(p_birth date, p_on date DEFAULT CURRENT_DATE)
RETURNS int LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT date_part('year', age(p_on, p_birth))::int;
$$;

-- Monthly range partitions for time-series tables. A worker calls this
-- every month for the next 3 months; DEFAULT partitions catch strays.
CREATE OR REPLACE FUNCTION ensure_monthly_partitions(p_parent text, p_from date, p_months int)
RETURNS int LANGUAGE plpgsql AS $$
DECLARE
  v_start date := date_trunc('month', p_from)::date;
  v_lo date; v_hi date; v_name text; v_made int := 0;
BEGIN
  FOR i IN 0 .. p_months - 1 LOOP
    v_lo := (v_start + make_interval(months => i))::date;
    v_hi := (v_start + make_interval(months => i + 1))::date;
    v_name := p_parent || '_p' || to_char(v_lo, 'YYYYMM');
    IF to_regclass(v_name) IS NULL THEN
      EXECUTE format('CREATE TABLE %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
                     v_name, p_parent, v_lo::timestamptz, v_hi::timestamptz);
      v_made := v_made + 1;
    END IF;
  END LOOP;
  RETURN v_made;
END $$;
COMMENT ON FUNCTION ensure_monthly_partitions(text, date, int) IS 'Creates missing monthly partitions <parent>_pYYYYMM. Job: partitions.ensure (monthly). Old partitions are detached and archived by retention jobs.';

-- The member id the API sets per transaction for row-level security:
--   SET LOCAL app.user_id = '<uuid>';
CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.user_id', true), '')::uuid;
$$;
COMMENT ON FUNCTION app_current_user_id() IS 'Member id for RLS policies, from SET LOCAL app.user_id. NULL for workers/admin (they use roles with BYPASSRLS).';

-- v3.1 Deployment environment, set per connection by the API / workers:
--   ALTER ROLE app_admin_api SET app.env = 'production';   (or SET app.env)
-- Unset means development: production-only rules (four-eyes on config) are off.
CREATE OR REPLACE FUNCTION app_env() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('app.env', true), ''), 'development');
$$;
COMMENT ON FUNCTION app_env() IS 'v3.1 Environment name from the app.env setting (development | staging | production). enforce_config_approval() only enforces four-eyes in production (AD-05).';

-- v3.1 True when any key at any depth of a JSON document looks like a secret.
-- Used to keep plain secrets out of vendor_settings.settings.
CREATE OR REPLACE FUNCTION jsonb_has_secret_keys(p jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE AS $$
DECLARE k text; v jsonb;
BEGIN
  IF p IS NULL THEN RETURN false; END IF;
  IF jsonb_typeof(p) = 'object' THEN
    FOR k, v IN SELECT * FROM jsonb_each(p) LOOP
      IF k ~* '(secret|password|passwd|api_?key|token|private_?key|credential|auth_?key)' THEN RETURN true; END IF;
      IF jsonb_has_secret_keys(v) THEN RETURN true; END IF;
    END LOOP;
  ELSIF jsonb_typeof(p) = 'array' THEN
    FOR v IN SELECT * FROM jsonb_array_elements(p) LOOP
      IF jsonb_has_secret_keys(v) THEN RETURN true; END IF;
    END LOOP;
  END IF;
  RETURN false;
END $$;
COMMENT ON FUNCTION jsonb_has_secret_keys(jsonb) IS 'v3.1 Recursive check for secret-looking keys (secret, password, api_key, token, private_key, credential). CHECK on vendor_settings.settings: secrets live in Railway sealed variables (OD-11) and are referenced by vault:// key only.';

-- =====================================================================
-- 1. DOMAINS
-- =====================================================================
CREATE DOMAIN e164        AS text     CHECK (VALUE ~ '^\+[1-9][0-9]{6,14}$');
CREATE DOMAIN iso_country AS char(2)  CHECK (VALUE ~ '^[A-Z]{2}$');
CREATE DOMAIN app_locale  AS text     CHECK (VALUE IN ('en','pcm','fr'));
CREATE DOMAIN usd_cents   AS bigint   CHECK (VALUE >= 0);
CREATE DOMAIN hex_colour  AS text     CHECK (VALUE ~ '^#[0-9A-Fa-f]{6}$');
CREATE DOMAIN sha256_hash AS bytea    CHECK (octet_length(VALUE) = 32);
COMMENT ON DOMAIN e164 IS 'Phone number in E.164 (+ and 7-15 digits).';
COMMENT ON DOMAIN iso_country IS 'ISO 3166-1 alpha-2, upper case.';
COMMENT ON DOMAIN app_locale IS 'App languages: en, pcm (Naija), fr.';
COMMENT ON DOMAIN usd_cents IS 'Non-negative amount in US cents.';
COMMENT ON DOMAIN sha256_hash IS '32-byte SHA-256 digest (tokens, codes and identifiers are stored hashed, never raw).';

-- v3.4 human reference sequences (same pattern as R- reports, S- tickets, W- website forms).
CREATE SEQUENCE security_incident_ref_seq START 1;      -- SI-0001 (A5 / B49)
CREATE SEQUENCE safety_escalation_ref_seq START 300;    -- SE-300 (A14)
CREATE SEQUENCE appeal_ref_seq START 200;               -- A-200 (A16)
CREATE SEQUENCE refund_ref_seq START 1000;              -- RF-1000 (B7)
CREATE SEQUENCE privacy_request_ref_seq START 1000;     -- PR-1000 (B44)
CREATE SEQUENCE legal_hold_ref_seq START 1;             -- LH-001 (B44)
CREATE SEQUENCE job_application_ref_seq START 1000;     -- J-1000 (W26)
CREATE SEQUENCE admin_audit_chain_seq AS bigint START 1; -- audit chain order (A1)

-- =====================================================================
-- 2. ENUMERATED TYPES (stable state machines; catalogues are tables)
-- =====================================================================
CREATE TYPE member_role_t        AS ENUM ('BASIC','PENDING_REVIEW','ACTIVE','CLASSIC','SUPER');
CREATE TYPE plan_t               AS ENUM ('free','premium','gold');
CREATE TYPE account_status_t     AS ENUM ('onboarding','active','restricted','suspended','banned','deletion_pending','deleted');
CREATE TYPE gender_t             AS ENUM ('man','woman');
CREATE TYPE interest_t           AS ENUM ('men','women','both');
CREATE TYPE intention_t          AS ENUM ('long_term','long_open_short','short_term','friends','figuring_out');
CREATE TYPE presence_t           AS ENUM ('online','away','dnd','invisible');
CREATE TYPE theme_t              AS ENUM ('system','light','dark');
CREATE TYPE oauth_provider_t     AS ENUM ('google','apple');
CREATE TYPE signup_path_t        AS ENUM ('email','google','apple');
CREATE TYPE platform_t           AS ENUM ('ios','android','web');
CREATE TYPE otp_purpose_t        AS ENUM ('signup_email','email_change','new_device','password_reset','phone_verify','phone_sign_in','link_provider','reauth','waitlist_confirm','offer_claim');  -- v3.4 W4 waitlist phone OTP (W25), offer claim (W24, flag off)
CREATE TYPE otp_channel_t        AS ENUM ('sms','whatsapp','voice','email');
CREATE TYPE lock_subject_t       AS ENUM ('account','ip','device','phone','email');
CREATE TYPE device_answer_t      AS ENUM ('pending','was_me','not_me','expired');
CREATE TYPE phone_type_t         AS ENUM ('mobile','fixed','voip','virtual','unknown');
CREATE TYPE verification_kind_t  AS ENUM ('email','phone','liveness','face_match','carrier','manual_review');
CREATE TYPE verification_result_t AS ENUM ('pending','pass','fail','review','expired');
CREATE TYPE badge_status_t       AS ENUM ('draft','submitted','in_review','needs_fix','approved','not_approved','withdrawn');
CREATE TYPE badge_step_t         AS ENUM ('phone','consent','photo','face_check','about','vibe','media','pay');
CREATE TYPE carrier_result_t     AS ENUM ('clear','hold_72h','face_recheck','failed');
CREATE TYPE media_kind_t         AS ENUM ('photo','clip','voice_prompt','voice_intro','chat_image','chat_voice','evidence','group_avatar');
CREATE TYPE media_status_t       AS ENUM ('quarantine','processing','active','hidden','rejected','deleted');
CREATE TYPE face_match_t         AS ENUM ('pending','match','no_match','manual_review','not_required');
CREATE TYPE moderation_status_t  AS ENUM ('pending','approved','flagged','rejected');
CREATE TYPE prompt_answer_kind_t AS ENUM ('text','voice');
CREATE TYPE reaction_t           AS ENUM ('like','somewhat','pass');
CREATE TYPE feed_surface_t       AS ENUM ('for_you','nearby','new','international','spotlight','likes','profile','group');
CREATE TYPE cooldown_reason_t    AS ENUM ('pass','moved_on','unblocked','unmatched','hidden');
CREATE TYPE match_kind_t         AS ENUM ('match','maybe');
CREATE TYPE match_status_t       AS ENUM ('active','intro_expired','moved_on','unmatched','blocked','closed');
CREATE TYPE intro_status_t       AS ENUM ('waiting','live','ended','decided','expired');
CREATE TYPE intro_decision_t     AS ENUM ('keep','move_on');
CREATE TYPE conversation_kind_t  AS ENUM ('match','direct_spec','group_dm');
CREATE TYPE conversation_state_t AS ENUM ('request','open','read_only','closed');
CREATE TYPE message_kind_t       AS ENUM ('text','voice','image','system','date_invite','intro_recap');
CREATE TYPE safety_verdict_t     AS ENUM ('clean','warned','blocked');
CREATE TYPE send_failure_t       AS ENUM ('no_connection','safety_filter','conversation_limit','blocked','restricted','rate_limited','other');
CREATE TYPE dm_kind_t            AS ENUM ('direct_spec','group_member');
CREATE TYPE dm_status_t          AS ENUM ('pending','accepted','declined','blocked','expired','filtered');
CREATE TYPE call_kind_t          AS ENUM ('audio','video');
CREATE TYPE call_status_t        AS ENUM ('ringing','active','missed','declined','ended','failed');
CREATE TYPE feeling_t            AS ENUM ('great','ok','noshow','bad');
CREATE TYPE group_join_rule_t    AS ENUM ('public','ask','invite');
CREATE TYPE group_post_rule_t    AS ENUM ('premium_plus','admins');
CREATE TYPE group_status_t       AS ENUM ('pending_review','active','paused','removed','deleted');
CREATE TYPE group_role_t         AS ENUM ('owner','admin','member');
CREATE TYPE group_member_status_t AS ENUM ('active','pending_approval','invited','left','removed','banned');
CREATE TYPE invite_status_t      AS ENUM ('pending','accepted','declined','expired','revoked');
CREATE TYPE meetup_kind_t        AS ENUM ('date','group');
CREATE TYPE meetup_status_t      AS ENUM ('draft','proposed','accepted','new_time_suggested','scheduled','cancelled','completed','expired');
CREATE TYPE meetup_join_rule_t   AS ENUM ('any_member','approve','verified_only');
CREATE TYPE rsvp_status_t        AS ENUM ('invited','going','maybe','declined','pending_approval','waitlist','cancelled');  -- v3.4 M7 EV4 Maybe (capacity counts going only)
CREATE TYPE trusted_status_t     AS ENUM ('waiting_opt_in','active','opted_out','removed');
CREATE TYPE checkin_status_t     AS ENUM ('scheduled','due','ok','snoozed','alerted','escalated','cancelled');
CREATE TYPE escalation_kind_t    AS ENUM ('missed_checkin','need_help','emergency_call','urgent_report','money_scam_pattern');
CREATE TYPE report_subject_t     AS ENUM ('user','message','group','group_message','media','call','meetup','dm_request');
CREATE TYPE report_context_t     AS ENUM ('chat_actions','spec_profile','call','call_feedback','cancel_plan','group_info','dm_thread','meetup_after','safety_centre','block_sheet','delete_account','new_sign_in');  -- v3.4 M43 PM6 "Report this"
CREATE TYPE report_status_t      AS ENUM ('open','triaged','in_review','actioned','dismissed','duplicate');
CREATE TYPE case_kind_t          AS ENUM ('report','badge_review','media_review','face_mismatch_review','group_review','appeal','restriction_review','safety_escalation','abuse_rule_hit','payment_risk');
CREATE TYPE case_status_t        AS ENUM ('queued','claimed','awaiting_member','decided','closed');  -- v3.4 A23 age check pending
CREATE TYPE moderation_action_t  AS ENUM ('warn','hide_content','remove_content','approve_media','reject_media','restrict','lift_restriction','suspend','unsuspend','ban','unban','approve_badge','badge_needs_fix','reject_badge','approve_group','remove_group','dismiss','escalate','refund','credit_days','request_age_check');  -- v3.4 A23 A14b
CREATE TYPE restriction_kind_t   AS ENUM ('restricted','suspended','banned');
CREATE TYPE appeal_status_t      AS ENUM ('submitted','in_review','upheld','overturned','withdrawn');
CREATE TYPE deletion_status_t    AS ENUM ('scheduled','cancelled','executed','failed');
CREATE TYPE rule_kind_t          AS ENUM ('keyword','regex','velocity','classifier');
CREATE TYPE rule_action_t        AS ENUM ('block_inline','warn_receiver','flag','auto_restrict');
CREATE TYPE payment_provider_t   AS ENUM ('app_store','google_play','stripe','flutterwave');  -- v3.3 OD-14: web billing = flutterwave; 'stripe' is a legacy value kept for old fixtures, never written by new code
CREATE TYPE product_kind_t       AS ENUM ('one_off','subscription');
CREATE TYPE billing_interval_t   AS ENUM ('none','month');
CREATE TYPE subscription_status_t AS ENUM ('trialing','active','grace','on_hold','cancelled','lapsed','paused','refunded','revoked');  -- v3.4 B70 store account hold (access paused, store retrying)
CREATE TYPE subscription_event_t AS ENUM ('created','trial_started','trial_converted','trial_cancelled','renewed','upgraded','downgrade_scheduled','downgraded','cancel_scheduled','uncancelled','billing_issue','grace_started','recovered','lapsed','paused','resumed','refunded','revoked','restored','on_hold');  -- v3.4 B70
CREATE TYPE transaction_kind_t   AS ENUM ('purchase','renewal','upgrade','trial_conversion','refund','chargeback','chargeback_reversal');
CREATE TYPE transaction_status_t AS ENUM ('pending','requires_action','succeeded','failed','refunded','partially_refunded','disputed');
CREATE TYPE pay_method_t         AS ENUM ('store','card','apple_pay','google_pay','link','usdc','bank_transfer','ussd');  -- v3.3: bank_transfer / ussd for Flutterwave; link / usdc are legacy Stripe methods
CREATE TYPE refund_reason_t      AS ENUM ('badge_not_approved','customer_request','store_refund','duplicate','service_issue','goodwill');
CREATE TYPE dispute_status_t     AS ENUM ('needs_response','under_review','won','lost','closed');
CREATE TYPE grant_source_t       AS ENUM ('subscription','trial','badge','admin_comp','restriction_credit');
CREATE TYPE usage_metric_t       AS ENUM ('specs_viewed','direct_specs_sent','direct_specs_abroad','spotlight_turns','rewinds','data_exports','intro_starts');
CREATE TYPE notif_channel_t      AS ENUM ('push','email','sms','whatsapp','in_app');
CREATE TYPE delivery_status_t    AS ENUM ('queued','batched','throttled','sent','delivered','opened','failed','suppressed');
CREATE TYPE ticket_status_t      AS ENUM ('open','pending_member','pending_agent','solved','closed');
CREATE TYPE ticket_channel_t     AS ENUM ('in_app_chat','email','web_form','feedback','safety');
CREATE TYPE author_kind_t        AS ENUM ('member','agent','system');
CREATE TYPE consent_kind_t       AS ENUM ('age_18','terms','privacy','guidelines','biometric','genotype','faith','marketing','research','location','push','analytics','cross_border_safety','trusted_contact');
CREATE TYPE consent_action_t     AS ENUM ('granted','withdrawn');
CREATE TYPE legal_doc_kind_t     AS ENUM ('terms','privacy','guidelines','biometric_notice','cookies','accessibility','offer_terms','refund_policy');  -- v3.1 + offer_terms; v3.4 B10 + refund_policy (A20e evidence)
CREATE TYPE export_status_t      AS ENUM ('requested','building','held','ready','expired','failed');  -- v3.4 B47 held until identity is confirmed (A36c)
CREATE TYPE privacy_request_t    AS ENUM ('access','export','rectify','erase_account','erase_sensitive','object','restrict_processing');
CREATE TYPE content_status_t     AS ENUM ('draft','in_review','approved','scheduled','published','archived');  -- v3.1 + approved, scheduled (website §6.7)
CREATE TYPE admin_status_t       AS ENUM ('invited','active','suspended','deactivated');
CREATE TYPE mfa_kind_t           AS ENUM ('totp','webauthn');
CREATE TYPE approval_status_t    AS ENUM ('pending','approved','rejected','expired','executed','cancelled','failed');  -- v3.1 + failed (approved, execution failed)
CREATE TYPE scope_kind_t         AS ENUM ('global','country','city','queue','own');  -- v3.1 + own (explicit own-queue scope)
CREATE TYPE actor_kind_t         AS ENUM ('system','member','admin');
CREATE TYPE list_kind_t          AS ENUM ('allow','deny');
CREATE TYPE task_outcome_t       AS ENUM ('success','partial','fail','skipped');
CREATE TYPE contact_kind_t       AS ENUM ('general','press','investor','partnership','careers','safety','data_request','support','story','accessibility','other');  -- v3.1 + support, story, accessibility, other (website privacy -> data_request, safety_report -> safety)
CREATE TYPE subscriber_status_t  AS ENUM ('pending','confirmed','unsubscribed','bounced','complained');  -- v3.1 + complained
CREATE TYPE maintenance_kind_t   AS ENUM ('required_update','recommended_update','maintenance','offline_banner');
CREATE TYPE web_safety_category_t AS ENUM ('under_18','threats_violence','scam_money','fake_impersonation','harassment','sexual_no_consent','hate','other');  -- v3.4 W11 W34 safety form

-- =====================================================================
-- 3. REFERENCE CATALOGUES  (Citus: create_reference_table for all)
-- =====================================================================

CREATE TABLE countries (
  iso2                 iso_country PRIMARY KEY,
  name_key             text NOT NULL,
  dial_code            text NOT NULL CHECK (dial_code ~ '^\+[0-9]{1,4}$'),
  emergency_number     text,
  is_launch_market     boolean NOT NULL DEFAULT false,
  allows_international boolean NOT NULL DEFAULT false,
  default_locale       app_locale NOT NULL DEFAULT 'en',
  timezone_default     text NOT NULL DEFAULT 'Africa/Lagos',
  emergency_number_verified_by uuid,          -- v3.1 FK admin_users (late FK, section 4)
  emergency_number_verified_at timestamptz,   -- v3.1
  approval_id          uuid,                  -- v3.1 config.markets approval (late FK, section 4)
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CHECK ((emergency_number_verified_at IS NULL) = (emergency_number_verified_by IS NULL)),
  CHECK (emergency_number_verified_at IS NULL OR emergency_number IS NOT NULL),
  default_market_status text CHECK (default_market_status IN ('beta','waitlist'))  -- v3.4 W18 OD-09 status for a city not in the list
);
CREATE TRIGGER trg_countries_upd BEFORE UPDATE ON countries FOR EACH ROW EXECUTE FUNCTION set_updated_at();
COMMENT ON TABLE countries IS 'Country catalogue. Phone field (B1/P1-Phone), GD2 international picker (only allows_international markets, max 5 per member), H2 emergency number (112 in Nigeria). Admin A31 Markets (changes need config.markets approval). PII: none. Citus: reference.';
COMMENT ON COLUMN countries.allows_international IS 'Supported, legal market for Gold international discovery (gold-rules GD2).';
COMMENT ON COLUMN countries.emergency_number_verified_by IS 'v3.1 Admin who confirmed the emergency number from an official source (AD-33). The app (H2) and website (W21, site_settings.emergency_numbers) show "Not confirmed" while NULL.';

CREATE TABLE cities (
  id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  country      iso_country NOT NULL REFERENCES countries(iso2),
  name         text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  ascii_name   text NOT NULL,
  admin_area   text,
  centroid     geography(Point,4326) NOT NULL,
  timezone     text NOT NULL,
  is_popular   boolean NOT NULL DEFAULT false,
  market_status text CHECK (market_status IN ('live','beta','waitlist')),            -- v3.1 website markets (W14, W25)
  launch_note_key text,                                                             -- v3.1 i18n key
  display_order smallint,                                                           -- v3.1
  stats        jsonb CHECK (stats IS NULL OR (jsonb_typeof(stats) = 'object'
                 AND stats ? 'member_count' AND stats ? 'as_of' AND stats ? 'source' AND stats ? 'approver')),  -- v3.1
  approval_id  uuid,                                                               -- v3.1 config.markets approval (late FK)
  updated_at   timestamptz NOT NULL DEFAULT now(),                                  -- v3.1
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country, ascii_name, admin_area)
);
CREATE TRIGGER trg_cities_upd BEFORE UPDATE ON cities FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_cities_search ON cities (lower(ascii_name) text_pattern_ops);
CREATE INDEX idx_cities_centroid ON cities USING gist (centroid);
CREATE INDEX idx_cities_markets ON cities (market_status, display_order) WHERE market_status IS NOT NULL;  -- v3.1 website city strip, A31 markets tab
COMMENT ON TABLE cities IS 'City catalogue for C6 "Enter my city instead" and OB3 fallback; specs then come from the city centroid. v3.1: also the website markets list (market_status live / beta / waitlist; W14 city strip, W25 waitlist; admin A31 Markets, approval config.markets). PII: none. Citus: reference.';
COMMENT ON COLUMN cities.market_status IS 'v3.1 Website market status. NULL = not shown on the website. Changing a city to live lets staff send the waitlist "now open" message (A29).';
COMMENT ON COLUMN cities.stats IS 'v3.1 {member_count, as_of, source, approver}: real counts only; the website hides values older than 90 days (website §6.4 rule 5).';

CREATE TABLE languages (
  code          text PRIMARY KEY CHECK (code ~ '^[a-z]{2,3}(-[A-Z]{2})?$'),
  name_key      text NOT NULL,
  native_name   text NOT NULL,
  aliases       text[] NOT NULL DEFAULT '{}',
  is_app_locale boolean NOT NULL DEFAULT false,
  popularity    smallint NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true
);
COMMENT ON TABLE languages IS 'Spoken languages for P1 "Languages" (required on Premium) and P3 "Languages they speak". SearchPicker GET /options/languages. PII: none. Citus: reference.';

-- Choice catalogues for every profile and preference field (P1, P2, P3, D4 spec grid).
CREATE TABLE option_sets (
  key            text PRIMARY KEY CHECK (key ~ '^[a-z_]{2,40}$'),
  label_key      text NOT NULL,
  question_key   text,
  pii_class      text NOT NULL DEFAULT 'personal' CHECK (pii_class IN ('none','personal','sensitive')),
  needs_consent  consent_kind_t,
  multi_select   boolean NOT NULL DEFAULT false,
  max_select     smallint CHECK (max_select BETWEEN 1 AND 20),
  in_profile     boolean NOT NULL DEFAULT true,
  in_preferences boolean NOT NULL DEFAULT true,
  can_be_dealbreaker boolean NOT NULL DEFAULT true,
  premium_only   boolean NOT NULL DEFAULT false,
  show_on_profile boolean NOT NULL DEFAULT true,
  sort           smallint NOT NULL DEFAULT 0
);
COMMENT ON TABLE option_sets IS 'Catalogue of choice fields: drink, smoke, kids, diet, exercise, sleep, faith, faith_practice, genotype, education, work, traits, goal. Sensitive sets (genotype = health data, faith) need explicit consent and are never shown on the profile (premium-rules P3). PII: none. Citus: reference.';

CREATE TABLE options (
  id        smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  set_key   text NOT NULL REFERENCES option_sets(key) ON DELETE CASCADE,
  key       text NOT NULL CHECK (key ~ '^[a-z0-9_]{1,40}$'),
  label_key text NOT NULL,
  sort      smallint NOT NULL DEFAULT 0,
  is_prefer_not_to_say boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE (set_key, key)
);
COMMENT ON TABLE options IS 'Values of each option set (e.g. drink: doesnt_drink, sober_curious, special_occasions, social_weekends, most_nights). Labels are i18n keys. PII: none. Citus: reference.';

CREATE TABLE vibe_tags (
  id         smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug       text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{2,40}$'),
  category   text NOT NULL CHECK (category IN ('interest','lifestyle','music','food','faith','sport','culture','going_out','travel','fitness','career','pets','home','other')),  -- v3.4 M2 B7 categories
  label_key  text NOT NULL,
  aliases    text[] NOT NULL DEFAULT '{}',
  popularity smallint NOT NULL DEFAULT 0,
  is_active  boolean NOT NULL DEFAULT true
);
COMMENT ON TABLE vibe_tags IS 'B7 "Your vibe" chips (3-10 per member) and shared-spec chips on cards (D1, D4). PII: none. Citus: reference.';

CREATE TABLE industries (
  id        smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug      text NOT NULL UNIQUE,
  label_key text NOT NULL,
  aliases   text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true
);
COMMENT ON TABLE industries IS 'P2 Career industry picker. PII: none. Citus: reference.';

CREATE TABLE prompts (
  id          smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key         text NOT NULL UNIQUE,
  text_key    text NOT NULL,
  allows_text boolean NOT NULL DEFAULT true,
  allows_voice boolean NOT NULL DEFAULT true,
  sort        smallint NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE prompts IS 'PM8 prompt catalogue ("The way to win me over...", "Two truths and a lie", ...). Members answer up to 3. PII: none. Citus: reference.';

CREATE TABLE report_reasons (
  key          text PRIMARY KEY,
  label_key    text NOT NULL,
  severity     smallint NOT NULL CHECK (severity BETWEEN 1 AND 5),
  sla_minutes  integer NOT NULL CHECK (sla_minutes > 0),
  human_within_1h boolean NOT NULL DEFAULT false,
  sort         smallint NOT NULL DEFAULT 0,
  is_active    boolean NOT NULL DEFAULT true
);
COMMENT ON TABLE report_reasons IS 'H3 report reasons. Under-18 and threats reach a human within 1 hour, everything else within 24 h (safety-rules). PII: none. Citus: reference.';

CREATE TABLE message_effects (
  key           text PRIMARY KEY,
  label_key     text NOT NULL,
  animation_ref text NOT NULL,
  min_role      member_role_t NOT NULL DEFAULT 'CLASSIC',
  plays_once    boolean NOT NULL DEFAULT true,
  is_active     boolean NOT NULL DEFAULT true
);
COMMENT ON TABLE message_effects IS 'D9 effects tray (monochrome, plays once; brand-review). Premium and Gold only. PII: none. Citus: reference.';

CREATE TABLE venues (
  id               uuid PRIMARY KEY DEFAULT uuid_v7(),
  google_place_id  text UNIQUE,
  name             text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  area             text,
  city_id          integer REFERENCES cities(id),
  category         text NOT NULL CHECK (category IN ('cafe','restaurant','gallery','park','mall','culture','other_public')),
  location         geography(Point,4326) NOT NULL,
  busy_hours_note  text,
  tags             text[] NOT NULL DEFAULT '{}',
  is_public_place  boolean NOT NULL DEFAULT true,
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (is_public_place),
  CONSTRAINT ck_venues_busy_note CHECK (char_length(busy_hours_note) <= 200)  -- v3.4 A51 A18e
);
CREATE TRIGGER trg_venues_upd BEFORE UPDATE ON venues FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_venues_loc ON venues USING gist (location) WHERE is_active;
CREATE INDEX idx_venues_city ON venues (city_id, category) WHERE is_active;
COMMENT ON TABLE venues IS 'EV2 curated public places (Google Places: cafes, restaurants, galleries, parks, malls) plus our busy-hours note. Home/hotel addresses can never be stored: is_public_place must be true. PII: none. Citus: reference.';

-- ---------------------------------------------------------------------
-- 3.1 Plans, entitlements, products and versioned prices
-- ---------------------------------------------------------------------
CREATE TABLE plans (
  code            plan_t PRIMARY KEY,
  rank            smallint NOT NULL UNIQUE CHECK (rank BETWEEN 0 AND 2),
  grants_role     member_role_t UNIQUE,
  name_key        text NOT NULL,
  tier_colour_light hex_colour NOT NULL,
  tier_colour_dark  hex_colour NOT NULL,
  is_active       boolean NOT NULL DEFAULT true,
  CHECK ((code = 'free') = (grants_role IS NULL)),
  tagline_key text,  -- v3.4 W6 W12 / W22 plan card
  key_perk_keys text[] NOT NULL DEFAULT '{}' CHECK (cardinality(key_perk_keys) <= 7)  -- v3.4 W6
);
COMMENT ON TABLE plans IS 'The three plans on D15: free, premium ($2.50/mo), gold ($9.75/mo). All Access no longer exists. Free grants no role by itself: BASIC/PENDING_REVIEW/ACTIVE come from verification. PII: none. Citus: reference.';
COMMENT ON COLUMN plans.tier_colour_light IS 'Tier ring colour (CHANGE_BRIEF section 2). Always paired with the plan name in text.';

CREATE TABLE entitlements (
  key         text PRIMARY KEY CHECK (key ~ '^[a-z_]+\.[a-z_]+$'),
  value_type  text NOT NULL CHECK (value_type IN ('bool','int','int_or_unlimited')),
  description text NOT NULL,
  ui_screens  text[] NOT NULL DEFAULT '{}'
);
COMMENT ON TABLE entitlements IS 'Entitlement keys checked by the API (never by the client). PII: none. Citus: reference.';

CREATE TABLE role_entitlements (
  role            member_role_t NOT NULL,
  entitlement_key text NOT NULL REFERENCES entitlements(key) ON DELETE CASCADE,
  value           jsonb NOT NULL,
  PRIMARY KEY (role, entitlement_key)
);
COMMENT ON TABLE role_entitlements IS 'Entitlement matrix by role (BASIC, PENDING_REVIEW, ACTIVE = Free verified, CLASSIC = Premium, SUPER = Gold). value: true/false, an integer, or null = unlimited. Admin-editable (plans.manage, approval required). PII: none. Citus: reference.';

CREATE TABLE products (
  id          smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code        text NOT NULL UNIQUE CHECK (code ~ '^[a-z_]+$'),
  kind        product_kind_t NOT NULL,
  plan_code   plan_t REFERENCES plans(code),
  name_key    text NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  CHECK ((kind = 'subscription') = (plan_code IS NOT NULL AND plan_code <> 'free'))
);
COMMENT ON TABLE products IS 'Sellable products: black_badge (one-off $1.00, never renews, never lapses), premium_monthly, gold_monthly. PII: none. Citus: reference.';

CREATE TABLE prices (
  id                  uuid PRIMARY KEY DEFAULT uuid_v7(),
  product_id          smallint NOT NULL REFERENCES products(id),
  version             smallint NOT NULL CHECK (version >= 1),
  provider            payment_provider_t NOT NULL,
  provider_product_id text NOT NULL,
  amount_usd_cents    usd_cents NOT NULL,
  currency            text NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
  interval            billing_interval_t NOT NULL,
  trial_days          smallint NOT NULL DEFAULT 0 CHECK (trial_days BETWEEN 0 AND 30),
  valid_from          timestamptz NOT NULL DEFAULT now(),
  valid_to            timestamptz,
  is_active           boolean NOT NULL DEFAULT true,
  created_by          uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, provider, version),
  UNIQUE (provider, provider_product_id, version),
  CHECK (valid_to IS NULL OR valid_to > valid_from)
);
CREATE UNIQUE INDEX uq_prices_current ON prices (product_id, provider) WHERE is_active AND valid_to IS NULL;
COMMENT ON TABLE prices IS 'Versioned USD list prices per product and provider (App Store, Google Play, Flutterwave on the web; OD-14). Never updated in place: a price change inserts version+1 and closes the old row. Stores convert to local currency themselves. PII: none. Citus: reference.';

-- ---------------------------------------------------------------------
-- 3.2 i18n, notification catalogue, legal documents, help centre
-- ---------------------------------------------------------------------
CREATE TABLE i18n_strings (
  key         text NOT NULL CHECK (key ~ '^[a-zA-Z0-9_.-]{2,160}$'),
  locale      app_locale NOT NULL,
  value       text NOT NULL,
  description text,
  is_icu      boolean NOT NULL DEFAULT true,
  status      text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','machine','reviewed','published')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (key, locale),
  updated_by uuid,  -- v3.4 B26 A25d last editor
  max_length smallint CHECK (max_length > 0),  -- v3.4 B26 lock-screen limit hint
  CONSTRAINT i18n_review_not_editor CHECK (reviewed_by IS NULL OR updated_by IS NULL OR reviewed_by <> updated_by)  -- v3.4 B26
);
CREATE TRIGGER trg_i18n_upd BEFORE UPDATE ON i18n_strings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
COMMENT ON TABLE i18n_strings IS 'ICU message catalogue (en, pcm, fr). Naija and French must be reviewed by native speakers before launch (status = reviewed). Exported to packages/i18n at build; notification templates reference these keys. PII: none. Citus: reference.';

CREATE TABLE notification_categories (
  key              text PRIMARY KEY,
  label_key        text NOT NULL,
  is_transactional boolean NOT NULL DEFAULT false,
  default_push     boolean NOT NULL DEFAULT true,
  default_email    boolean NOT NULL DEFAULT false,
  is_marketing     boolean NOT NULL DEFAULT false,
  sort             smallint NOT NULL DEFAULT 0
);
COMMENT ON TABLE notification_categories IS 'NT1 rows: likes, msgs, groups, daily, news (marketing, off by default), billing and security (transactional, cannot be turned off). PII: none. Citus: reference.';

CREATE TABLE notification_templates (
  code          text PRIMARY KEY CHECK (code ~ '^[NW][0-9]{2}$'),   -- v3.4 W3 W01-W08 website (non-member) templates
  category_key  text NOT NULL REFERENCES notification_categories(key),
  channels      notif_channel_t[] NOT NULL CHECK (cardinality(channels) >= 1),
  trigger_desc  text NOT NULL,
  title_key     text NOT NULL,
  body_key      text NOT NULL,
  deep_link     text NOT NULL,
  email_template text,
  throttle_rule text NOT NULL,
  bypass_quiet_hours boolean NOT NULL DEFAULT false,
  is_active     boolean NOT NULL DEFAULT true,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  required_channels notif_channel_t[] NOT NULL DEFAULT '{}',  -- v3.4 B25 A25b transactional channels
  version integer NOT NULL DEFAULT 1,  -- v3.4 B25 A25 template versions
  CONSTRAINT ntpl_required_subset CHECK (required_channels <@ channels)  -- v3.4 B25
);
CREATE TRIGGER trg_ntpl_upd BEFORE UPDATE ON notification_templates FOR EACH ROW EXECUTE FUNCTION set_updated_at();
COMMENT ON TABLE notification_templates IS 'NT4 catalogue N01-N22: channel, i18n title/body keys, deep link and throttle (e.g. likes batched max 1 an hour). Single source for NT1-NT3 and the D16 inbox. PII: none. Citus: reference.';

CREATE TABLE legal_documents (
  id           uuid PRIMARY KEY DEFAULT uuid_v7(),
  kind         legal_doc_kind_t NOT NULL,
  version      text NOT NULL CHECK (version ~ '^[0-9]+\.[0-9]+$'),
  locale       app_locale NOT NULL,
  title        text NOT NULL,
  short_version_md text NOT NULL,
  body_md      text NOT NULL,
  is_material_change boolean NOT NULL DEFAULT false,
  status       content_status_t NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  effective_at timestamptz,
  reaccept_from timestamptz,
  approved_by  uuid,
  change_summary text CHECK (char_length(change_summary) <= 1000),   -- v3.1 website §6.2 legal_document_versions
  counsel_review_ref text,                                           -- v3.1 counsel sign-off reference (DN-28)
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, version, locale),
  CHECK (status <> 'published' OR published_at IS NOT NULL),
  CONSTRAINT ck_legal_counsel_ref CHECK (status <> 'published' OR kind NOT IN ('terms','privacy','guidelines','biometric_notice','offer_terms') OR counsel_review_ref IS NOT NULL),  -- v3.4 B38 OD-10 lawyer review before publishing Terms, Privacy, Guidelines, biometric notice, offer terms
  CONSTRAINT ck_legal_short CHECK (char_length(short_version_md) <= 600),  -- v3.4 W29 / B40 W35 short version
  CONSTRAINT ck_legal_reaccept CHECK (reaccept_from IS NULL OR published_at IS NULL OR reaccept_from >= published_at + interval '14 days')  -- v3.4 B40 A30c
  -- + common workflow / locale columns (section 18.3)
);
CREATE INDEX idx_legal_current ON legal_documents (kind, locale, published_at DESC) WHERE status = 'published';
COMMENT ON TABLE legal_documents IS 'LG1 Terms, LG2 Privacy, LG3 Guidelines, B3 biometric notice, cookie and accessibility statements and (v3.1) offer terms, served as versioned Markdown with a "short version" box. A material change shows a re-accept sheet 14 days ahead (reaccept_from). Draft v0.9 needs Nigerian counsel review. Admin A30; website W35. PII: none. Citus: reference.';
COMMENT ON COLUMN legal_documents.counsel_review_ref IS 'v3.1 Reference to the counsel review (required to publish offer_terms; website §1.3 fine print, DN-28).';

CREATE TABLE help_categories (
  id        smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key       text NOT NULL UNIQUE,
  title_key text NOT NULL,
  icon      text NOT NULL,
  deep_link text,
  sort      smallint NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true
);
COMMENT ON TABLE help_categories IS 'H1 topics: Account & sign-in, Plans & billing, Matching, Safety, Privacy, Groups. PII: none. Citus: reference.';

CREATE TABLE help_articles (
  id           uuid PRIMARY KEY DEFAULT uuid_v7(),
  category_id  smallint NOT NULL REFERENCES help_categories(id),
  slug         text NOT NULL CHECK (slug ~ '^[a-z0-9-]{3,80}$'),
  locale       app_locale NOT NULL,
  title        text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 80),     -- v3.4 W28 W32 title <= 80
  summary      text CHECK (char_length(summary) <= 160),                        -- v3.4 W28 summary <= 160
  steps        jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(steps) = 'array'),
  body_md      text,
  cta_label_key text,
  cta_deep_link text,
  search_tsv   tsvector GENERATED ALWAYS AS (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(summary,'') || ' ' || coalesce(body_md,''))) STORED,
  is_popular   boolean NOT NULL DEFAULT false,
  status       content_status_t NOT NULL DEFAULT 'draft',
  version      integer NOT NULL DEFAULT 1,
  published_at timestamptz,
  helpful_yes  integer NOT NULL DEFAULT 0 CHECK (helpful_yes >= 0),
  helpful_no   integer NOT NULL DEFAULT 0 CHECK (helpful_no >= 0),
  view_count   bigint NOT NULL DEFAULT 0,
  created_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slug, locale),
  last_reviewed_at timestamptz,  -- v3.4 W14 W32 "Last reviewed"
  related_ids uuid[] NOT NULL DEFAULT '{}' CHECK (cardinality(related_ids) <= 3),  -- v3.4 W14
  applies_to_plans plan_t[] NOT NULL DEFAULT '{}',  -- v3.4 W14
  platforms text[] NOT NULL DEFAULT '{all}' CHECK (platforms <@ ARRAY['ios','android','all']::text[]),  -- v3.4 W14
  CONSTRAINT ck_help_reviewed CHECK (status <> 'published' OR last_reviewed_at IS NOT NULL)  -- v3.4 W14
);
CREATE TRIGGER trg_help_upd BEFORE UPDATE ON help_articles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_help_search ON help_articles USING gin (search_tsv) WHERE status = 'published';
CREATE INDEX idx_help_popular ON help_articles (locale, category_id) WHERE status = 'published' AND is_popular;
COMMENT ON TABLE help_articles IS 'H1 search + popular articles and H1A article page (steps, CTA e.g. "Start verification" -> B0). helpful_yes/no are counters maintained from help_article_votes. PII: none. Citus: reference.';

-- =====================================================================
-- 4. ADMIN CONSOLE: STAFF IDENTITY, RBAC, MFA, APPROVALS, AUDIT
--    Staff are never members: separate table, separate domain
--    (admin.1minit.com), separate API prefix /admin/v1.
--    Citus: all admin tables are small -> reference tables, except the
--    audit log (local/append-only on the coordinator).
-- =====================================================================

CREATE TABLE admin_users (
  id               uuid PRIMARY KEY DEFAULT uuid_v7(),
  email            citext NOT NULL UNIQUE,
  full_name        text NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 120),
  display_name     text NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 40),
  password_hash    text,
  status           admin_status_t NOT NULL DEFAULT 'invited',
  mfa_required     boolean NOT NULL DEFAULT true CHECK (mfa_required),
  invited_by       uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  invite_token_hash sha256_hash UNIQUE,
  invite_expires_at timestamptz,
  last_login_at    timestamptz,
  password_set_at  timestamptz,
  failed_logins    smallint NOT NULL DEFAULT 0,
  locked_until     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deactivated_at   timestamptz,
  CHECK (status = 'invited' OR password_hash IS NOT NULL),
  locked_at timestamptz,  -- v3.4 A6 A08 lock context
  locked_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,  -- v3.4 A6
  lock_reason text CHECK (lock_reason IN ('failed_logins','security_alert','admin_action','break_glass_close')),  -- v3.4 A6
  lock_incident_id uuid,  -- v3.4 A6 OD-29
  is_break_glass boolean NOT NULL DEFAULT false  -- v3.4 A10 A03g
);
CREATE TRIGGER trg_admin_users_upd BEFORE UPDATE ON admin_users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
COMMENT ON TABLE admin_users IS 'Staff accounts for the admin console. MFA is mandatory for every admin (mfa_required is always true). PII: personal. Retention: account life + 7 years in audit context.';
COMMENT ON COLUMN admin_users.display_name IS 'Name members see in support chat (H1B shows the agent as e.g. "Tobi").';
COMMENT ON COLUMN admin_users.password_hash IS 'Argon2id. NULL only while status = invited. Minimum 12 characters plus mandatory MFA (OD-07, remote_config admin.password_min_length).';

CREATE TABLE admin_mfa_factors (
  id                uuid PRIMARY KEY DEFAULT uuid_v7(),
  admin_id          uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  kind              mfa_kind_t NOT NULL,
  label             text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 60),
  totp_secret_enc   bytea,
  webauthn_credential_id bytea UNIQUE,
  webauthn_public_key bytea,
  webauthn_sign_count bigint,
  webauthn_transports text[],
  aaguid            uuid,
  confirmed_at      timestamptz,
  last_used_at      timestamptz,
  revoked_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'totp') = (totp_secret_enc IS NOT NULL)),
  CHECK ((kind = 'webauthn') = (webauthn_credential_id IS NOT NULL AND webauthn_public_key IS NOT NULL))
);
CREATE INDEX idx_admin_mfa_live ON admin_mfa_factors (admin_id) WHERE revoked_at IS NULL AND confirmed_at IS NOT NULL;
COMMENT ON TABLE admin_mfa_factors IS 'Mandatory MFA factors: TOTP (secret encrypted with a KMS data key) or WebAuthn passkeys. An active admin with no live factor cannot sign in (see v_admin_mfa_gaps). PII: personal.';

CREATE TABLE admin_permissions (
  key              text PRIMARY KEY CHECK (key ~ '^[a-z0-9_]+(\.[a-z0-9_]+)+$'),
  domain           text NOT NULL,
  description      text NOT NULL,
  is_sensitive     boolean NOT NULL DEFAULT false,
  requires_reason  boolean NOT NULL DEFAULT true,
  requires_approval boolean NOT NULL DEFAULT false,
  requires_reauth  boolean NOT NULL DEFAULT false,
  allowed_scopes scope_kind_t[] NOT NULL DEFAULT '{global}' CHECK ('global' = ANY (allowed_scopes)),  -- v3.4 A13 Appendix A Scope column
  depends_on text[] NOT NULL DEFAULT '{}'  -- v3.4 A58 A05c auto-select
);
COMMENT ON TABLE admin_permissions IS 'Permission catalogue checked server-side on every /admin/v1 request. requires_approval = four-eyes rule through admin_approvals; requires_reauth = fresh MFA within 5 minutes. PII: none.';

CREATE TABLE admin_roles (
  id          uuid PRIMARY KEY DEFAULT uuid_v7(),
  key         text NOT NULL UNIQUE CHECK (key ~ '^[a-z_]{3,40}$'),
  name        text NOT NULL,
  description text NOT NULL,
  is_system   boolean NOT NULL DEFAULT false,
  max_holders smallint CHECK (max_holders > 0),
  created_by  uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  CONSTRAINT ck_admin_roles_name CHECK (char_length(name) BETWEEN 2 AND 60),  -- v3.4 A51 A05c
  CONSTRAINT ck_admin_roles_desc CHECK (char_length(description) BETWEEN 10 AND 500)  -- v3.4 A51 A05c
);
CREATE TRIGGER trg_admin_roles_upd BEFORE UPDATE ON admin_roles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
COMMENT ON TABLE admin_roles IS 'Roles. System roles are seeded; a super admin can create custom roles (is_system = false) and give them any permissions. super_admin has max_holders = 2. PII: none.';

CREATE TABLE admin_role_permissions (
  role_id        uuid NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES admin_permissions(key) ON DELETE CASCADE,
  granted_by     uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  granted_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_key)
);
COMMENT ON TABLE admin_role_permissions IS 'Which permissions each role holds. PII: none.';

CREATE TABLE admin_user_roles (
  id          uuid PRIMARY KEY DEFAULT uuid_v7(),
  admin_id    uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  role_id     uuid NOT NULL REFERENCES admin_roles(id) ON DELETE RESTRICT,
  scope_kind  scope_kind_t NOT NULL DEFAULT 'global',
  scope_value text,
  granted_by  uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  granted_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz,
  revoked_at  timestamptz,
  revoked_by  uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  CHECK ((scope_kind IN ('global','own')) = (scope_value IS NULL)),  -- v3.1 own needs no value
  CHECK (expires_at IS NULL OR expires_at > granted_at),
  is_break_glass boolean NOT NULL DEFAULT false,  -- v3.4 A10
  CONSTRAINT ck_bg_expiry CHECK (NOT is_break_glass OR (expires_at IS NOT NULL AND expires_at <= granted_at + interval '4 hours'))  -- v3.4 A10
);
CREATE UNIQUE INDEX uq_admin_user_role_live ON admin_user_roles (admin_id, role_id, scope_kind, coalesce(scope_value, '')) WHERE revoked_at IS NULL;
CREATE INDEX idx_admin_user_roles_role ON admin_user_roles (role_id) WHERE revoked_at IS NULL;
COMMENT ON TABLE admin_user_roles IS 'Role grants, optionally scoped (country NG, city Lagos, queue badge_review) and time-boxed. Scoped permissions: a reviewer scoped to country=GH only sees Ghana cases. PII: none.';

CREATE TABLE admin_sessions (
  id              uuid PRIMARY KEY DEFAULT uuid_v7(),
  admin_id        uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash      sha256_hash NOT NULL UNIQUE,
  mfa_factor_id   uuid REFERENCES admin_mfa_factors(id) ON DELETE SET NULL,
  mfa_verified_at timestamptz NOT NULL,
  reauth_at       timestamptz,
  ip              inet,
  user_agent      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_seen_at    timestamptz NOT NULL DEFAULT now(),
  idle_expires_at timestamptz NOT NULL,
  expires_at      timestamptz NOT NULL,
  revoked_at      timestamptz,
  revoke_reason   text,
  CHECK (expires_at <= created_at + interval '8 hours'),
  ip_country iso_country,  -- v3.4 A9 A03b
  ip_city text,  -- v3.4 A9
  asn integer  -- v3.4 A9
);
CREATE INDEX idx_admin_sessions_live ON admin_sessions (admin_id) WHERE revoked_at IS NULL;
COMMENT ON TABLE admin_sessions IS 'Admin cookie sessions: 30 min idle, 8 h absolute (CHECK), re-auth for sensitive permissions. PII: personal (IP).';

CREATE TABLE admin_login_attempts (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email_hash  sha256_hash NOT NULL,
  admin_id    uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  ip          inet,
  user_agent  text,
  step        text NOT NULL CHECK (step IN ('password','mfa','invite')),
  success     boolean NOT NULL,
  failure_reason text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  ip_country iso_country,  -- v3.4 A9 A03f
  ip_city text,  -- v3.4 A9
  asn integer  -- v3.4 A9
);
CREATE INDEX idx_admin_login_brin ON admin_login_attempts USING brin (created_at);
CREATE INDEX idx_admin_login_recent ON admin_login_attempts (email_hash, created_at DESC);
COMMENT ON TABLE admin_login_attempts IS 'Every admin sign-in step, for lockout and security alerts. Retention 1 year. PII: personal (IP).';

CREATE TABLE admin_approvals (
  id             uuid PRIMARY KEY DEFAULT uuid_v7(),
  permission_key text NOT NULL REFERENCES admin_permissions(key),
  action         text NOT NULL,
  target_type    text NOT NULL,
  target_id      text,
  payload        jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason         text NOT NULL CHECK (char_length(reason) BETWEEN 5 AND 2000),
  requested_by   uuid NOT NULL REFERENCES admin_users(id),
  requested_at   timestamptz NOT NULL DEFAULT now(),
  status         approval_status_t NOT NULL DEFAULT 'pending',
  decided_by     uuid REFERENCES admin_users(id),
  decided_at     timestamptz,
  decision_note  text,
  executed_at    timestamptz,
  execution_error text,                                              -- v3.1 set when status = failed
  expires_at     timestamptz NOT NULL DEFAULT now() + interval '72 hours',
  CHECK (decided_by IS NULL OR decided_by <> requested_by),
  CHECK ((status IN ('approved','rejected','executed','failed')) = (decided_by IS NOT NULL)),
  CHECK (status <> 'failed' OR execution_error IS NOT NULL),  -- v3.1
  approver_id uuid REFERENCES admin_users(id),  -- v3.4 A4 A06a named approver (NULL = any eligible)
  CONSTRAINT ck_appr_not_self CHECK (approver_id IS NULL OR approver_id <> requested_by)  -- v3.4 A4
);
CREATE INDEX idx_admin_approvals_pending ON admin_approvals (requested_at) WHERE status = 'pending';
CREATE INDEX idx_admin_approvals_requester ON admin_approvals (requested_by, requested_at DESC);           -- v3.1 A06 "my requests"
CREATE INDEX idx_admin_approvals_target ON admin_approvals (permission_key, target_type, target_id, status); -- v3.1 enforce_config_approval()
COMMENT ON TABLE admin_approvals IS 'Four-eyes approvals for sensitive actions (erasure, bans, every admin refund (OD-05), role and price changes, legal publishing, maintenance mode). The requester can never approve their own request. PII: none (payload holds ids).';

-- Immutable, hash-chained audit log, partitioned by month.
CREATE SEQUENCE admin_audit_log_id_seq AS bigint;
CREATE TABLE admin_audit_log (
  id             bigint NOT NULL DEFAULT nextval('admin_audit_log_id_seq'),
  created_at     timestamptz NOT NULL DEFAULT now(),
  actor_kind     actor_kind_t NOT NULL DEFAULT 'admin',
  admin_id       uuid REFERENCES admin_users(id),
  session_id     uuid,
  permission_key text,
  action         text NOT NULL,
  target_type    text NOT NULL,
  target_id      text,
  reason         text,
  approval_id    uuid,
  before         jsonb,
  after          jsonb,
  ip             inet,
  user_agent     text,
  request_id     text,
  prev_hash      bytea,
  row_hash       bytea,
  PRIMARY KEY (created_at, id),
  CHECK (actor_kind <> 'admin' OR admin_id IS NOT NULL),
  chain_seq bigint  -- v3.4 A1 chain order
) PARTITION BY RANGE (created_at);
ALTER SEQUENCE admin_audit_log_id_seq OWNED BY admin_audit_log.id;
CREATE TABLE admin_audit_log_default PARTITION OF admin_audit_log DEFAULT;
CREATE INDEX idx_audit_target ON admin_audit_log (target_type, target_id, created_at DESC);
CREATE INDEX idx_audit_admin ON admin_audit_log (admin_id, created_at DESC);
CREATE INDEX idx_audit_brin ON admin_audit_log USING brin (created_at);
COMMENT ON TABLE admin_audit_log IS 'Every admin write and every PII reveal: who, what, target, reason, before/after. Append-only (trigger) and hash-chained (row_hash = sha256(prev_hash || row)); a nightly job verifies the chain. Partitioned monthly. Retention 7 years, then cold storage. PII: personal (IP, before/after may hold member data: masked where possible).';

-- v3.4 A1 / A2 hash formula v2: every audited field, canonical JSON (unambiguous NULLs,
-- UTC timestamp, normalised jsonb), chained in chain_seq order. Shared by the trigger and
-- the verifier (job audit.verify_chain, admin_audit_chain_runs).
CREATE OR REPLACE FUNCTION admin_audit_row_hash(p_prev bytea, r jsonb) RETURNS bytea
LANGUAGE sql STABLE AS $$
  SELECT digest(coalesce(p_prev, '\x00'::bytea) || convert_to(jsonb_build_array('v2', r -> 'chain_seq', r -> 'id',
           to_char((r ->> 'created_at')::timestamptz AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
           r -> 'actor_kind', r -> 'admin_id', r -> 'session_id', r -> 'permission_key', r -> 'action', r -> 'target_type',
           r -> 'target_id', r -> 'reason', r -> 'approval_id', r -> 'before', r -> 'after', r -> 'ip', r -> 'user_agent',
           r -> 'request_id')::text, 'UTF8'), 'sha256');
$$;
COMMENT ON FUNCTION admin_audit_row_hash(bytea, jsonb) IS 'v3.4 A1 / A2 audit hash formula v2 = sha256(prev_hash || jsonb_build_array(''v2'', chain_seq, id, created_at as UTC ISO-8601, actor_kind, admin_id, session_id, permission_key, action, target_type, target_id, reason, approval_id, before, after, ip, user_agent, request_id)::text), called with to_jsonb(row). Canonical JSON keeps NULLs unambiguous. Fixed before the first row is written; any change needs a new version tag.';

CREATE OR REPLACE FUNCTION admin_audit_chain() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_prev bytea;
BEGIN
  PERFORM pg_advisory_xact_lock(7240001);           -- serialise the chain
  NEW.chain_seq := nextval('admin_audit_chain_seq'); -- v3.4 A1: order assigned after the lock = true chaining order
  SELECT row_hash INTO v_prev FROM admin_audit_log ORDER BY chain_seq DESC NULLS LAST LIMIT 1;
  NEW.prev_hash := v_prev;
  NEW.row_hash  := admin_audit_row_hash(v_prev, to_jsonb(NEW));  -- v3.4 A2: all fields incl. permission_key, approval_id, session_id, ip, user_agent, request_id
  RETURN NEW;
END $$;
CREATE TRIGGER trg_audit_chain BEFORE INSERT ON admin_audit_log FOR EACH ROW EXECUTE FUNCTION admin_audit_chain();
CREATE TRIGGER trg_audit_immutable BEFORE UPDATE OR DELETE ON admin_audit_log FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- ---------------------------------------------------------------------
-- 4.1 v3.1 Admin console operations (Appendix C.1 rows 1-6)
--     Citus: reference tables (small, admin-only), except admin_notifications
--     and admin_exports, which stay coordinator-local.
-- ---------------------------------------------------------------------

-- C.1-1 Recovery codes (AD-02: 10 single-use codes). Only SHA-256 digests are
-- stored; the API shows the plain codes once at enrolment and never again.
CREATE TABLE admin_recovery_codes (
  id          uuid PRIMARY KEY DEFAULT uuid_v7(),
  admin_id    uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  code_hash   sha256_hash NOT NULL,
  batch_id    uuid NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  used_at     timestamptz,
  used_ip     inet,
  revoked_at  timestamptz,
  UNIQUE (admin_id, code_hash),
  CHECK (used_at IS NULL OR revoked_at IS NULL)
);
CREATE INDEX idx_admin_recovery_live ON admin_recovery_codes (admin_id) WHERE used_at IS NULL AND revoked_at IS NULL;
COMMENT ON TABLE admin_recovery_codes IS 'v3.1 A02 MFA recovery codes (AD-02): 10 single-use codes per batch, stored as SHA-256 digests only (sha256_hash domain: a raw code cannot be stored). Issuing a new batch revokes the old one. Use = admin_consume_recovery_code(). Retention: account life. PII: personal (credential digest).';
COMMENT ON COLUMN admin_recovery_codes.code_hash IS 'SHA-256 of the normalised code (upper case, no spaces or dashes), computed by the API. The plain code is never stored or logged.';

CREATE OR REPLACE FUNCTION admin_issue_recovery_codes(p_admin uuid, p_hashes bytea[])
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_batch uuid := uuid_v7();
BEGIN
  IF cardinality(p_hashes) <> 10 THEN
    RAISE EXCEPTION 'exactly 10 recovery codes per batch (AD-02), got %', cardinality(p_hashes) USING ERRCODE = '22023';
  END IF;
  UPDATE admin_recovery_codes SET revoked_at = now()
   WHERE admin_id = p_admin AND used_at IS NULL AND revoked_at IS NULL;
  INSERT INTO admin_recovery_codes (admin_id, code_hash, batch_id)
  SELECT p_admin, h::sha256_hash, v_batch FROM unnest(p_hashes) AS h;
  RETURN v_batch;
END $$;
COMMENT ON FUNCTION admin_issue_recovery_codes(uuid, bytea[]) IS 'v3.1 A02: store a new batch of 10 recovery-code digests and revoke the previous unused batch. Audit: admin.recovery_codes.issue.';

CREATE OR REPLACE FUNCTION admin_consume_recovery_code(p_admin uuid, p_hash bytea, p_ip inet DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  UPDATE admin_recovery_codes SET used_at = now(), used_ip = p_ip
   WHERE id = (SELECT id FROM admin_recovery_codes
                WHERE admin_id = p_admin AND code_hash = p_hash::sha256_hash
                  AND used_at IS NULL AND revoked_at IS NULL
                FOR UPDATE)
  RETURNING id INTO v_id;
  RETURN v_id IS NOT NULL;
END $$;
COMMENT ON FUNCTION admin_consume_recovery_code(uuid, bytea, inet) IS 'v3.1 A02: single-use check of a recovery-code digest. Returns false for unknown, used or revoked codes (same answer, no oracle). Counts toward admin.login rate limits.';

-- C.1-2 Device allow-list (AD-03).
CREATE TABLE admin_trusted_devices (
  id              uuid PRIMARY KEY DEFAULT uuid_v7(),
  admin_id        uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  label           text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 60),
  platform        text NOT NULL CHECK (platform IN ('macos','windows','linux','chromeos','ios','android','other')),
  mfa_factor_id   uuid REFERENCES admin_mfa_factors(id) ON DELETE CASCADE,
  device_cert_fingerprint sha256_hash,
  registered_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at    timestamptz,
  approved_by     uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  approval_id     uuid REFERENCES admin_approvals(id) ON DELETE SET NULL,
  revoked_at      timestamptz,
  revoked_by      uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  CHECK ((mfa_factor_id IS NULL) <> (device_cert_fingerprint IS NULL)),
  CHECK (approved_by IS NULL OR approved_by <> admin_id),
  registered_ip inet,  -- v3.4 A54 A03d
  rejected_at timestamptz,  -- v3.4 A54
  reject_reason text,  -- v3.4 A54
  incident_id uuid  -- v3.4 A54
);
CREATE UNIQUE INDEX uq_admin_device_cert ON admin_trusted_devices (device_cert_fingerprint) WHERE revoked_at IS NULL AND device_cert_fingerprint IS NOT NULL;
CREATE UNIQUE INDEX uq_admin_device_factor ON admin_trusted_devices (mfa_factor_id) WHERE revoked_at IS NULL AND mfa_factor_id IS NOT NULL;
CREATE INDEX idx_admin_devices_live ON admin_trusted_devices (admin_id) WHERE revoked_at IS NULL;
COMMENT ON TABLE admin_trusted_devices IS 'v3.1 A03 device allow-list (AD-03: required in production for super_admin, finance, trust_safety_lead and privacy_officer holders). A device is a platform passkey bound to it (mfa_factor_id) or a managed-device certificate fingerprint; a second admin approves it. Retention: account life + 1 year. PII: personal.';

-- C.1-3 Console notifications (bell, /notifications).
CREATE TABLE admin_notifications (
  id          uuid PRIMARY KEY DEFAULT uuid_v7(),
  admin_id    uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type ~ '^[a-z_]+\.[a-z_.]+$'),
  priority    smallint NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 3),
  title       text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  body        text CHECK (char_length(body) <= 1000),
  link        text CHECK (link IS NULL OR link ~ '^/'),
  dedupe_key  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  read_at     timestamptz
);
CREATE INDEX idx_admin_notif_inbox ON admin_notifications (admin_id, read_at, created_at DESC);
CREATE INDEX idx_admin_notif_type ON admin_notifications (admin_id, type, created_at DESC);
CREATE UNIQUE INDEX uq_admin_notif_dedupe ON admin_notifications (admin_id, dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX idx_admin_notif_brin ON admin_notifications USING brin (created_at);
COMMENT ON TABLE admin_notifications IS 'v3.1 A04 bell and /notifications: approval.requested / decided, case.assigned, case.sla_breach, escalation.created, support.assigned, export.ready, security.alert, job.failed, chain.broken, config.changed. priority 1 = high (banner). link is a console route. Retention 90 days. PII: none (ids only).';

-- C.1-4 Saved views and saved member lists.
CREATE TABLE admin_saved_views (
  id             uuid PRIMARY KEY DEFAULT uuid_v7(),
  admin_id       uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  module         text NOT NULL CHECK (module ~ '^A[0-9]{2}$'),
  name           text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  query          text NOT NULL CHECK (char_length(query) <= 4000),
  columns        text[] NOT NULL DEFAULT '{}',
  member_ids     uuid[] CHECK (member_ids IS NULL OR cardinality(member_ids) <= 5000),
  shared_role_id uuid REFERENCES admin_roles(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (admin_id, module, name)
);
CREATE TRIGGER trg_admin_views_upd BEFORE UPDATE ON admin_saved_views FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_admin_views_shared ON admin_saved_views (shared_role_id, module) WHERE shared_role_id IS NOT NULL;
COMMENT ON TABLE admin_saved_views IS 'v3.1 A04 / A09 saved filters (query string of the list URL), column choice and optional saved member list; can be shared with a role. Opening a shared view still applies the viewer''s own scope. Retention: until deleted or the admin leaves. PII: personal when member_ids is set.';

-- C.1-5 Admin exports (AD-06: member-level exports need approval).
CREATE TABLE admin_exports (
  id            uuid PRIMARY KEY DEFAULT uuid_v7(),
  requested_by  uuid NOT NULL REFERENCES admin_users(id),
  permission_key text NOT NULL REFERENCES admin_permissions(key),
  approval_id   uuid REFERENCES admin_approvals(id) ON DELETE SET NULL,
  module        text NOT NULL CHECK (module ~ '^A[0-9]{2}$'),
  kind          text NOT NULL,
  filters       jsonb NOT NULL DEFAULT '{}'::jsonb,
  format        text NOT NULL CHECK (format IN ('csv','jsonl','xlsx','pdf','zip')),
  status        text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','building','ready','expired','failed')),
  row_count     bigint CHECK (row_count >= 0),
  bytes         bigint CHECK (bytes >= 0),
  storage_key   text,
  expires_at    timestamptz,
  downloaded_at timestamptz,
  download_count smallint NOT NULL DEFAULT 0,
  error         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'ready' OR (storage_key IS NOT NULL AND expires_at IS NOT NULL)),
  CHECK (status <> 'failed' OR error IS NOT NULL)
);
CREATE INDEX idx_admin_exports_mine ON admin_exports (requested_by, created_at DESC);
CREATE INDEX idx_admin_exports_queue ON admin_exports (created_at) WHERE status IN ('queued','building');
CREATE INDEX idx_admin_exports_expiry ON admin_exports (expires_at) WHERE status = 'ready';
COMMENT ON TABLE admin_exports IS 'v3.1 Every console export (A07 audit, A09 members, A11, A19 billing, A23 revenue, A29 newsletter / waitlist, A34 analytics). Built by job exports.admin.build into an encrypted R2 object (OD-11) with a presigned link; purged by exports.admin.purge at expires_at. The API refuses to build an export whose permission requires_approval without an approved approval_id. Retention: file 24 hours (v3.4 B81, final QA: personal-data exports expire after 24 h), row 7 years (audit). PII: none (the file is personal).';

-- C.1-6 Macros (safety decisions and support replies).
CREATE TABLE admin_macros (
  id               uuid PRIMARY KEY DEFAULT uuid_v7(),
  domain           text NOT NULL CHECK (domain IN ('safety','support')),
  name             text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  case_kinds       case_kind_t[] NOT NULL DEFAULT '{}',
  decision         moderation_action_t,
  reason_code      text,
  member_message_key text,
  body             jsonb CHECK (body IS NULL OR (jsonb_typeof(body) = 'object' AND body ? 'en')),
  is_active        boolean NOT NULL DEFAULT true,
  created_by       uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (domain, name),
  CHECK (domain <> 'safety' OR (decision IS NOT NULL AND reason_code IS NOT NULL)),
  CHECK (domain <> 'support' OR body IS NOT NULL),
  duration_hours integer CHECK (duration_hours > 0),  -- v3.4 A24 A14d
  restriction_scope text[],  -- v3.4 A24
  note_template text CHECK (char_length(note_template) <= 2000),  -- v3.4 A24 A17
  topic_key text  -- v3.4 B36 A27f
);
CREATE TRIGGER trg_admin_macros_upd BEFORE UPDATE ON admin_macros FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_admin_macros_active ON admin_macros (domain) WHERE is_active;
CREATE INDEX idx_admin_macros_kinds ON admin_macros USING gin (case_kinds);
COMMENT ON TABLE admin_macros IS 'v3.1 A14 / A17 safety macros (decision + reason code + member message key per case kind) and A27 support reply macros (body per locale, en required). Permission macros.manage. Retention: permanent while active. PII: none.';

-- Late foreign keys from catalogues to staff.
ALTER TABLE countries       ADD FOREIGN KEY (emergency_number_verified_by) REFERENCES admin_users(id) ON DELETE SET NULL;  -- v3.1
ALTER TABLE countries       ADD FOREIGN KEY (approval_id) REFERENCES admin_approvals(id) ON DELETE SET NULL;  -- v3.1
ALTER TABLE cities          ADD FOREIGN KEY (approval_id) REFERENCES admin_approvals(id) ON DELETE SET NULL;     -- v3.1
ALTER TABLE prices          ADD FOREIGN KEY (created_by)  REFERENCES admin_users(id) ON DELETE SET NULL;
ALTER TABLE i18n_strings    ADD FOREIGN KEY (reviewed_by) REFERENCES admin_users(id) ON DELETE SET NULL;
ALTER TABLE legal_documents ADD FOREIGN KEY (approved_by) REFERENCES admin_users(id) ON DELETE SET NULL;
ALTER TABLE help_articles   ADD FOREIGN KEY (created_by)  REFERENCES admin_users(id) ON DELETE SET NULL;

-- =====================================================================
-- 5. MEMBER IDENTITY AND AUTH
--    Citus: distribution column user_id (users.id) for every table here.
-- =====================================================================

CREATE TABLE users (
  id                    uuid PRIMARY KEY DEFAULT uuid_v7(),
  email                 citext NOT NULL,
  email_verified_at     timestamptz,
  first_name            text NOT NULL CHECK (char_length(first_name) BETWEEN 1 AND 40),
  last_name             text CHECK (char_length(last_name) BETWEEN 1 AND 40),
  status                account_status_t NOT NULL DEFAULT 'onboarding',
  role                  member_role_t NOT NULL DEFAULT 'BASIC',
  plan                  plan_t NOT NULL DEFAULT 'free',
  is_verified           boolean NOT NULL DEFAULT false,
  verified_at           timestamptz,
  signup_path           signup_path_t NOT NULL DEFAULT 'email',
  onboarding_step       smallint NOT NULL DEFAULT 1 CHECK (onboarding_step BETWEEN 1 AND 10),
  onboarding_completed_at timestamptz,
  locale                app_locale NOT NULL DEFAULT 'en',
  country               iso_country,
  signup_country_hint   iso_country,
  last_active_at        timestamptz,
  deletion_scheduled_for timestamptz,
  deleted_at            timestamptz,
  role_recomputed_at    timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CHECK (is_verified = (verified_at IS NOT NULL)),
  CHECK (role NOT IN ('ACTIVE','CLASSIC','SUPER') OR is_verified),
  CHECK ((status = 'deletion_pending') = (deletion_scheduled_for IS NOT NULL)),
  CHECK (email = lower(btrim(email::text)))
);
CREATE UNIQUE INDEX uq_users_email ON users (email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_status ON users (status) WHERE status <> 'active';
CREATE INDEX idx_users_role ON users (role);
CREATE INDEX idx_users_deletion_due ON users (deletion_scheduled_for) WHERE status = 'deletion_pending';
CREATE INDEX idx_users_created_brin ON users USING brin (created_at);
CREATE TRIGGER trg_users_upd BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
COMMENT ON TABLE users IS 'One row per member account. E1 email (trim + lower-case), E3 private first/last name (never shown), onboarding progress n/10 (E1 E2 E3 E5 C1 C2 C3 C4 C5 C6, then C8). Screens: E1-E5, C1-C8, G2, AP2, L1, D14, D17, AS2-AS5. PII: personal. Citus: distributed by id. Retention: erased 14 days after deletion request.';
COMMENT ON COLUMN users.role IS 'Cached effective role (BASIC -> PENDING_REVIEW -> ACTIVE -> CLASSIC -> SUPER). Source of truth: compute_member_role(); refreshed by the entitlement service on every billing / verification event and logged to role_history.';
COMMENT ON COLUMN users.plan IS 'Cached plan (free, premium, gold) for D15 dot, D14 ring and BL1. Derived from entitlement_grants.';
COMMENT ON COLUMN users.is_verified IS 'Black Badge verification. Permanent: survives a lapsed plan (D2); removed only when biometric consent is withdrawn (PM4) or by a ban.';
COMMENT ON COLUMN users.onboarding_step IS 'Resume point of the 10-step sign-up (save after every screen). Google/Apple paths start at C1. OB4 resumes here if < 10.';
COMMENT ON COLUMN users.signup_country_hint IS 'From SIM/store country (never GPS); drives OB2 language suggestion.';

CREATE TABLE password_credentials (
  user_id          uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_hash    text NOT NULL CHECK (password_hash LIKE '$argon2id$%'),
  set_at           timestamptz NOT NULL DEFAULT now(),
  breach_checked_at timestamptz NOT NULL DEFAULT now(),
  must_change      boolean NOT NULL DEFAULT false,
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_pwd_upd BEFORE UPDATE ON password_credentials FOR EACH ROW EXECUTE FUNCTION set_updated_at();
COMMENT ON TABLE password_credentials IS 'Argon2id password hash (E5, R3, PM7). Member minimum 8 characters (OD-07, remote_config auth.password_min_length; checked by the API before hashing; the strength meter may recommend longer). Google/Apple-only members have no row until they add a password in Settings > Sign-in methods. Breached-password check by k-anonymity range API. PII: sensitive (credential).';

CREATE TABLE oauth_identities (
  id                uuid PRIMARY KEY DEFAULT uuid_v7(),
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider          oauth_provider_t NOT NULL,
  provider_sub      text NOT NULL CHECK (char_length(provider_sub) BETWEEN 1 AND 255),
  provider_email    citext,
  email_verified    boolean NOT NULL DEFAULT false,
  is_private_relay  boolean NOT NULL DEFAULT false,
  name_shared       boolean NOT NULL DEFAULT false,
  linked_via        text NOT NULL DEFAULT 'signup' CHECK (linked_via IN ('signup','link_password','link_email_code','settings')),
  linked_at         timestamptz NOT NULL DEFAULT now(),
  last_used_at      timestamptz,
  unlinked_at       timestamptz
);
CREATE UNIQUE INDEX uq_oauth_sub ON oauth_identities (provider, provider_sub) WHERE unlinked_at IS NULL;
CREATE UNIQUE INDEX uq_oauth_user_provider ON oauth_identities (user_id, provider) WHERE unlinked_at IS NULL;
COMMENT ON TABLE oauth_identities IS 'Google / Apple sign-in links (G1/G2, AP1/AP2, S1/S2/S1E, OB4). Match by provider sub; Apple private-relay emails match by sub only. Never merged silently: an email match requires S2 confirmation. A member cannot remove their last sign-in method. PII: personal.';

CREATE TABLE phone_numbers (
  id               uuid PRIMARY KEY DEFAULT uuid_v7(),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  e164             e164 NOT NULL,
  country          iso_country NOT NULL REFERENCES countries(iso2),
  number_type      phone_type_t NOT NULL DEFAULT 'unknown',
  carrier_name     text,
  verified_at      timestamptz,
  verified_channel otp_channel_t,
  sign_in_enabled  boolean NOT NULL DEFAULT false,
  sim_swap_detected_at timestamptz,
  released_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (number_type NOT IN ('voip','virtual') OR verified_at IS NULL),
  CHECK (NOT sign_in_enabled OR (verified_at IS NOT NULL AND sim_swap_detected_at IS NULL))
);
CREATE UNIQUE INDEX uq_phone_one_account ON phone_numbers (e164) WHERE verified_at IS NOT NULL AND released_at IS NULL;
CREATE UNIQUE INDEX uq_phone_user_current ON phone_numbers (user_id) WHERE released_at IS NULL;
COMMENT ON TABLE phone_numbers IS 'B1/B2 verified mobile number (E.164). One account per number; VoIP/virtual numbers blocked. Phone sign-in (P1-Phone) turns on after verification and off on number change or SIM swap. PII: personal.';

CREATE TABLE devices (
  id               uuid PRIMARY KEY DEFAULT uuid_v7(),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fingerprint_hash sha256_hash NOT NULL,
  platform         platform_t NOT NULL,
  model            text,
  os_version       text,
  app_version      text,
  integrity_verdict text CHECK (integrity_verdict IN ('meets_strong','meets_device','meets_basic','failed','unavailable')),
  integrity_checked_at timestamptz,
  trusted_at       timestamptz,
  first_seen_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at     timestamptz NOT NULL DEFAULT now(),
  last_ip          inet,
  last_city        text,
  revoked_at       timestamptz,
  UNIQUE (user_id, fingerprint_hash)
);
CREATE INDEX idx_devices_user ON devices (user_id, last_seen_at DESC) WHERE revoked_at IS NULL;
CREATE INDEX idx_devices_fp ON devices (fingerprint_hash);
COMMENT ON TABLE devices IS 'Known devices per member (PM5 devices list, PM6 new sign-in alert). An unseen fingerprint triggers L2/L3 new-device confirmation. Play Integrity / App Attest verdict stored; no CAPTCHAs. Location shown is IP-derived, city level only. PII: personal.';

CREATE TABLE sessions (
  id              uuid PRIMARY KEY DEFAULT uuid_v7(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id       uuid REFERENCES devices(id) ON DELETE SET NULL,
  auth_method     text NOT NULL CHECK (auth_method IN ('password','google','apple','phone_otp','reset')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_used_at    timestamptz NOT NULL DEFAULT now(),
  absolute_expires_at timestamptz NOT NULL,
  ip              inet,
  city            text,
  revoked_at      timestamptz,
  revoke_reason   text CHECK (revoke_reason IN ('sign_out','sign_out_others','password_changed','token_reuse','not_me','deletion','admin','suspended'))
);
CREATE INDEX idx_sessions_user_live ON sessions (user_id) WHERE revoked_at IS NULL;
COMMENT ON TABLE sessions IS 'A refresh-token family per device sign-in (PM5 "Sign out" revokes one family; "Sign out of all others" revokes the rest). PII: personal (IP, city).';

CREATE TABLE refresh_tokens (
  id          uuid PRIMARY KEY DEFAULT uuid_v7(),
  session_id  uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  token_hash  sha256_hash NOT NULL UNIQUE,
  issued_at   timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  replaced_by uuid REFERENCES refresh_tokens(id) ON DELETE SET NULL,
  CHECK (expires_at > issued_at)
);
CREATE INDEX idx_refresh_session ON refresh_tokens (session_id);
CREATE INDEX idx_refresh_expiry ON refresh_tokens (expires_at);
COMMENT ON TABLE refresh_tokens IS 'Rotating refresh tokens (30 days), stored as SHA-256 only. Re-use of a used token revokes the whole session family. Purged 7 days after expiry. PII: none.';

CREATE TABLE otp_challenges (
  id               uuid PRIMARY KEY DEFAULT uuid_v7(),
  purpose          otp_purpose_t NOT NULL,
  channel          otp_channel_t NOT NULL,
  user_id          uuid REFERENCES users(id) ON DELETE CASCADE,
  destination_hash sha256_hash NOT NULL,
  destination_hint text,
  new_email        citext,
  code_hash        text NOT NULL,
  expires_at       timestamptz NOT NULL,
  attempts         smallint NOT NULL DEFAULT 0,
  max_attempts     smallint NOT NULL CHECK (max_attempts BETWEEN 1 AND 10),
  sends            smallint NOT NULL DEFAULT 1 CHECK (sends BETWEEN 1 AND 5),
  last_sent_at     timestamptz NOT NULL DEFAULT now(),
  locked_until     timestamptz,
  consumed_at      timestamptz,
  provider         text,
  provider_msg_id  text,
  device_id        uuid REFERENCES devices(id) ON DELETE SET NULL,
  ip               inet,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (attempts <= max_attempts),
  CHECK (expires_at <= created_at + interval '10 minutes'),
  CHECK (purpose <> 'email_change' OR new_email IS NOT NULL)
);
CREATE INDEX idx_otp_dest_live ON otp_challenges (destination_hash, purpose, created_at DESC) WHERE consumed_at IS NULL;
CREATE INDEX idx_otp_brin ON otp_challenges USING brin (created_at);
COMMENT ON TABLE otp_challenges IS 'All one-time codes: E2 sign-up email, L2/L3 new device (SMS/WhatsApp/voice/email), R2 reset, B2 phone, P1-Phone sign-in, S2 link, AS3 re-auth. 6 digits, valid 10 min, resend after 60 s, max 5 sends an hour; wrong tries: 3 by SMS (then 30-min lock), 5 by email (then 15-min wait). Code stored hashed. Purged after 30 days. PII: personal (hashed destination + hint like "+234 *** 0123").';

CREATE TABLE login_attempts (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id         uuid REFERENCES users(id) ON DELETE SET NULL,
  identifier_hash sha256_hash NOT NULL,
  method          text NOT NULL CHECK (method IN ('password','google','apple','phone_otp')),
  success         boolean NOT NULL,
  failure_reason  text CHECK (failure_reason IN ('invalid_credentials','locked','not_linked','provider_error','integrity_failed','suspended','rate_limited')),
  device_fingerprint_hash sha256_hash,
  ip              inet,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_login_attempts_id ON login_attempts (identifier_hash, created_at DESC);
CREATE INDEX idx_login_attempts_ip ON login_attempts (ip, created_at DESC);
CREATE INDEX idx_login_attempts_brin ON login_attempts USING brin (created_at);
COMMENT ON TABLE login_attempts IS 'Sign-in attempts (L1, L1E, P1-Phone, S1). Five wrong passwords -> X1 15-minute pause (account_lockouts). Retention 90 days. PII: personal (IP).';

CREATE TABLE account_lockouts (
  id            uuid PRIMARY KEY DEFAULT uuid_v7(),
  subject_kind  lock_subject_t NOT NULL,
  subject_hash  sha256_hash NOT NULL,
  user_id       uuid REFERENCES users(id) ON DELETE CASCADE,
  reason        text NOT NULL CHECK (reason IN ('wrong_password','wrong_code','otp_send_limit','signup_velocity','risk')),
  locked_at     timestamptz NOT NULL DEFAULT now(),
  locked_until  timestamptz NOT NULL,
  cleared_at    timestamptz,
  CHECK (locked_until > locked_at)
);
CREATE INDEX idx_lockouts_live ON account_lockouts (subject_kind, subject_hash, locked_until) WHERE cleared_at IS NULL;
COMMENT ON TABLE account_lockouts IS 'Durable copy of lockouts (X1 "Let''s pause for 15 minutes", OTP locks). Redis holds the fast counter; this row survives a cache flush and feeds the admin security view. PII: personal (hashed).';

CREATE TABLE password_resets (
  id               uuid PRIMARY KEY DEFAULT uuid_v7(),
  user_id          uuid REFERENCES users(id) ON DELETE CASCADE,
  otp_challenge_id uuid REFERENCES otp_challenges(id) ON DELETE SET NULL,
  requested_ip     inet,
  requested_at     timestamptz NOT NULL DEFAULT now(),
  completed_at     timestamptz,
  signed_out_others boolean NOT NULL DEFAULT true,
  source           text NOT NULL DEFAULT 'forgot' CHECK (source IN ('forgot','not_me','admin','breach'))
);
CREATE INDEX idx_password_resets_user ON password_resets (user_id, requested_at DESC);
COMMENT ON TABLE password_resets IS 'R1-R4 reset flow; user_id is NULL when the email has no account (we never reveal that). PM6 "It wasn''t me" forces a reset (source not_me). PII: personal.';

CREATE TABLE new_device_challenges (
  id               uuid PRIMARY KEY DEFAULT uuid_v7(),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id        uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  otp_challenge_id uuid REFERENCES otp_challenges(id) ON DELETE SET NULL,
  confirmed_at     timestamptz,
  alert_email_sent_at timestamptz,
  answer           device_answer_t NOT NULL DEFAULT 'pending',
  answered_at      timestamptz,
  fraud_review_case_id uuid,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ndc_user ON new_device_challenges (user_id, created_at DESC);
COMMENT ON TABLE new_device_challenges IS 'L2/L3 code on an unseen device plus the PM6 "Was this you?" answer. not_me revokes all sessions, forces a password reset and opens a fraud review case. PII: personal.';

CREATE TABLE age_gate_blocks (
  device_hash   sha256_hash PRIMARY KEY,
  blocked_until timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE age_gate_blocks IS 'C1X under-18: no account is created; the device is flagged for 30 days. Stores a device hash, never the date of birth. PII: none.';

CREATE TABLE role_history (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_role  member_role_t,
  to_role    member_role_t NOT NULL,
  from_plan  plan_t,
  to_plan    plan_t NOT NULL,
  reason     text NOT NULL,
  actor_kind actor_kind_t NOT NULL,
  admin_id   uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_role_history_user ON role_history (user_id, created_at DESC);
COMMENT ON TABLE role_history IS 'Every role / plan change (verification approved, purchase, lapse, restriction). PII: none.';

-- =====================================================================
-- 6. PROFILE
-- =====================================================================

CREATE TABLE profiles (
  user_id             uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  nickname            text NOT NULL CHECK (char_length(nickname) BETWEEN 2 AND 20),
  nickname_is_default boolean NOT NULL DEFAULT true,
  nickname_changed_at timestamptz,
  birth_date          date NOT NULL CHECK (birth_date > DATE '1900-01-01'),
  birth_date_locked_at timestamptz NOT NULL DEFAULT now(),
  gender              gender_t NOT NULL,
  interested_in       interest_t NOT NULL,
  intention           intention_t NOT NULL,
  bio                 text CHECK (char_length(bio) <= 300),
  height_cm           smallint CHECK (height_cm BETWEEN 120 AND 230),
  relationship_history text CHECK (relationship_history IN ('never_married','divorced','separated','widowed','prefer_not')),
  job_title           text CHECK (char_length(job_title) <= 40),
  employer            text CHECK (char_length(employer) <= 40),
  show_employer       boolean NOT NULL DEFAULT false,
  industry_id         smallint REFERENCES industries(id),
  location            geography(Point,4326),
  location_source     text CHECK (location_source IN ('gps','city','ip')),
  location_precise_ok boolean NOT NULL DEFAULT false,
  city_id             integer REFERENCES cities(id),
  city_name           text,
  country             iso_country REFERENCES countries(iso2),
  timezone            text NOT NULL DEFAULT 'Africa/Lagos',
  location_updated_at timestamptz,
  presence_pref       presence_t NOT NULL DEFAULT 'online',
  status_note         text CHECK (char_length(status_note) <= 40),
  status_note_expires_at timestamptz,
  is_hidden           boolean NOT NULL DEFAULT false,
  hidden_reason       text CHECK (hidden_reason IN ('member_break','deletion_pending','restricted','suspended','banned','unverified_consent','age_check')),  -- v3.4 A23 possible minor
  spotlight_opt_out   boolean NOT NULL DEFAULT false,
  show_distance       boolean NOT NULL DEFAULT true,
  profile_strength    smallint NOT NULL DEFAULT 0 CHECK (profile_strength BETWEEN 0 AND 100),
  premium_sections_done text[] NOT NULL DEFAULT '{}' CHECK (premium_sections_done <@ ARRAY['lifestyle','career','preferences','media']::text[]),
  version             integer NOT NULL DEFAULT 1,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (age_years(birth_date, (birth_date_locked_at AT TIME ZONE 'UTC')::date) >= 18),
  CONSTRAINT ck_profiles_nickname_contact CHECK (regexp_replace(nickname, '[\s-]', '', 'g') !~ '[0-9]{5,}'
                                                 AND nickname !~* '(https?://|www\.|@|\.(com|ng|net|org)([^a-z]|$))'),  -- v3.4 M37 same rule as the API (5+ digits, any @, links)
  incognito boolean NOT NULL DEFAULT false  -- v3.4 M11 D17 Gold incognito
);
CREATE TRIGGER trg_profiles_upd BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_profiles_geo ON profiles USING gist (location) WHERE NOT is_hidden;
CREATE INDEX idx_profiles_feed ON profiles (country, gender, interested_in, intention, birth_date) WHERE NOT is_hidden;
CREATE INDEX idx_profiles_city ON profiles (city_id) WHERE NOT is_hidden;
COMMENT ON TABLE profiles IS 'Public-facing profile. Nickname defaults to first name ("People see you as Ada"); E4 editor from profile, change again after 21 days. C1 birthday (18+ on the day, locked after confirm), C2 I am, C3 Interested in, C4 intention, C6 location (snapped to ~1 km before storing), D2 presence + status note (<= 40), B6/PM3 bio (<= 300, contact details blocked), P2 career, D4 spec grid (height). Screens: C1-C6, B6, PM1, PM3, D1, D2, D4, D14. PII: personal. Citus: distributed by user_id (colocated with users).';
COMMENT ON COLUMN profiles.location IS 'Coarse point (~1 km grid). Exact location is never stored or revealed; meet-up halfway uses rounded points.';
COMMENT ON COLUMN profiles.presence_pref IS 'Chosen D2 status. invisible is Gold only (API). Live presence (online/away after 10 min idle) is in Redis presence:{user_id}.';
COMMENT ON COLUMN profiles.nickname_changed_at IS 'Change cooldown 21 days (CHANGE_BRIEF section 3; canvas profile-rules said 30, the brief wins). Old nicknames are held 90 days in nickname_history.';
COMMENT ON COLUMN profiles.relationship_history IS 'Visible to Premium viewers only (badge-rules B6).';
COMMENT ON COLUMN profiles.version IS 'Optimistic concurrency for PATCH /me/profile (If-Match).';

CREATE TABLE nickname_history (
  id         uuid PRIMARY KEY DEFAULT uuid_v7(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nickname   text NOT NULL,
  used_from  timestamptz NOT NULL,
  used_to    timestamptz NOT NULL DEFAULT now(),
  held_until timestamptz NOT NULL,
  CHECK (held_until >= used_to)
);
CREATE INDEX idx_nickname_hist_user ON nickname_history (user_id, used_to DESC);
CREATE INDEX idx_nickname_hist_held ON nickname_history (lower(nickname), held_until);
COMMENT ON TABLE nickname_history IS 'Previous nicknames, held 90 days (impersonation and abuse checks). PII: personal.';

CREATE TABLE profile_languages (
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  language_code text NOT NULL REFERENCES languages(code),
  position      smallint NOT NULL DEFAULT 0 CHECK (position BETWEEN 0 AND 9),
  PRIMARY KEY (user_id, language_code)
);
CREATE INDEX idx_profile_languages_lang ON profile_languages (language_code);
COMMENT ON TABLE profile_languages IS 'P1 "Languages" (required for Premium), shown in the D4 spec grid. PII: personal.';

CREATE TABLE profile_answers (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  option_id  smallint NOT NULL REFERENCES options(id),
  set_key    text NOT NULL REFERENCES option_sets(key),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, option_id)
);
CREATE INDEX idx_profile_answers_set ON profile_answers (set_key, option_id);
COMMENT ON TABLE profile_answers IS 'Member''s own answers for P1 lifestyle (diet, exercise, sleep, religion, education), drinks, smokes, kids and P3-shared sets. Genotype and faith rows exist only with consent and are deleted within 30 days of withdrawal (LG6). PII: personal; sensitive for genotype (health) and faith.';

CREATE TABLE profile_vibes (
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vibe_tag_id smallint NOT NULL REFERENCES vibe_tags(id),
  source      text NOT NULL DEFAULT 'user' CHECK (source IN ('user','ai_suggested')),
  position    smallint NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, vibe_tag_id)
);
CREATE INDEX idx_profile_vibes_tag ON profile_vibes (vibe_tag_id);
COMMENT ON TABLE profile_vibes IS 'B7 vibe chips, 3-10 per member (max enforced by trigger; min by the API at submit). AI suggestions from the bio are only saved after the member confirms. PII: personal.';

CREATE OR REPLACE FUNCTION enforce_max_children() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_max int := TG_ARGV[1]::int; v_col text := TG_ARGV[0]; v_n int;
BEGIN
  EXECUTE format('SELECT count(*) FROM %I WHERE %I = $1 %s', TG_TABLE_NAME, v_col, coalesce(TG_ARGV[2], ''))
    INTO v_n USING (to_jsonb(NEW) ->> v_col)::uuid;
  IF v_n > v_max THEN
    RAISE EXCEPTION '% allows at most % rows per %', TG_TABLE_NAME, v_max, v_col USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
COMMENT ON FUNCTION enforce_max_children() IS 'AFTER INSERT/UPDATE constraint trigger: max rows per parent. Args: column, max, optional extra WHERE (e.g. AND removed_at IS NULL).';
CREATE CONSTRAINT TRIGGER trg_profile_vibes_max AFTER INSERT ON profile_vibes
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_max_children('user_id', '10');

CREATE TABLE prompt_answers (
  id          uuid PRIMARY KEY DEFAULT uuid_v7(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prompt_id   smallint NOT NULL REFERENCES prompts(id),
  position    smallint NOT NULL CHECK (position BETWEEN 1 AND 3),
  kind        prompt_answer_kind_t NOT NULL,
  text_answer text CHECK (char_length(text_answer) BETWEEN 1 AND 150),
  media_id    uuid,
  voice_duration_ms integer CHECK (voice_duration_ms BETWEEN 500 AND 20000),
  transcript  text,
  moderation_status moderation_status_t NOT NULL DEFAULT 'pending',
  removed_at  timestamptz,
  undo_until  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'text')  = (text_answer IS NOT NULL)),
  CHECK ((kind = 'voice') = (media_id IS NOT NULL AND voice_duration_ms IS NOT NULL)),
  moderation_labels jsonb NOT NULL DEFAULT '{}'::jsonb,  -- v3.4 A28 A13c
  removed_by_kind actor_kind_t,  -- v3.4 A28
  removed_reason_code text  -- v3.4 A28
);
CREATE TRIGGER trg_prompt_answers_upd BEFORE UPDATE ON prompt_answers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE UNIQUE INDEX uq_prompt_slot ON prompt_answers (user_id, position) WHERE removed_at IS NULL;
CREATE UNIQUE INDEX uq_prompt_once ON prompt_answers (user_id, prompt_id) WHERE removed_at IS NULL;
COMMENT ON TABLE prompt_answers IS 'PM8 "Your prompts": up to 3 (position 1-3), each a text answer <= 150 chars or a voice note <= 20 s; shown on D4; PM1 row "2 of 3 answered, 1 voice". Remove offers Undo (undo_until), then the row stays soft-deleted 30 days. Voice is transcribed for moderation. PII: personal.';

CREATE TABLE media_assets (
  id                uuid PRIMARY KEY DEFAULT uuid_v7(),
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind              media_kind_t NOT NULL,
  storage_key       text NOT NULL UNIQUE,
  mime_type         text NOT NULL CHECK (mime_type ~ '^(image|video|audio)/[a-z0-9.+-]+$'),
  bytes             integer NOT NULL CHECK (bytes > 0 AND bytes <= 104857600),
  width             smallint,
  height            smallint,
  duration_ms       integer CHECK (duration_ms IS NULL OR duration_ms > 0),
  sha256            sha256_hash,
  phash             bigint,
  status            media_status_t NOT NULL DEFAULT 'quarantine',
  face_match        face_match_t NOT NULL DEFAULT 'pending',
  face_match_score  numeric(5,4) CHECK (face_match_score BETWEEN 0 AND 1),
  face_count        smallint,
  moderation_status moderation_status_t NOT NULL DEFAULT 'pending',
  moderation_labels jsonb NOT NULL DEFAULT '{}'::jsonb,
  colour_filter_detected boolean NOT NULL DEFAULT false,
  ai_generated_score numeric(5,4),
  alt_text          text CHECK (char_length(alt_text) <= 200),
  variants          jsonb NOT NULL DEFAULT '{}'::jsonb,
  transcript        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz,
  purge_after       timestamptz,
  CHECK (kind NOT IN ('clip') OR duration_ms <= 30000),
  CHECK (kind NOT IN ('voice_prompt','voice_intro') OR duration_ms <= 20000),
  CHECK (kind NOT IN ('photo','clip') OR status <> 'active' OR (face_match IN ('match','not_required') AND moderation_status = 'approved')),
  CHECK (NOT (kind = 'photo' AND status = 'active' AND colour_filter_detected))
);
CREATE TRIGGER trg_media_upd BEFORE UPDATE ON media_assets FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_media_user ON media_assets (user_id, kind) WHERE deleted_at IS NULL;
CREATE INDEX idx_media_pipeline ON media_assets (created_at) WHERE status IN ('quarantine','processing');
CREATE INDEX idx_media_purge ON media_assets (purge_after) WHERE purge_after IS NOT NULL;
CREATE INDEX idx_media_phash ON media_assets (phash) WHERE phash IS NOT NULL;
COMMENT ON TABLE media_assets IS 'Every uploaded file (photos, clips <= 30 s, voice prompts / intro notes <= 20 s as Opus, chat media, report screenshots). Uploads land in quarantine, then face match against the verified template, then image moderation (nudity, violence, text, QR). Photos and clips go public only after both pass (CHECK). Colour filters on member photos are blocked at upload. EXIF/GPS stripped on re-encode. PII: personal (face images = biometric source data while in quarantine).';

CREATE TABLE profile_media (
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_id     uuid NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  kind         media_kind_t NOT NULL CHECK (kind IN ('photo','clip')),
  position     smallint NOT NULL CHECK (position BETWEEN 1 AND 20),
  is_main      boolean NOT NULL DEFAULT false,
  hidden_reason text CHECK (hidden_reason IN ('plan_lapsed','moderation','member')),
  hidden_until timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, media_id),
  CHECK (NOT is_main OR (kind = 'photo' AND position = 1 AND hidden_reason IS NULL))
);
CREATE TRIGGER trg_profile_media_upd BEFORE UPDATE ON profile_media FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE UNIQUE INDEX uq_profile_media_slot ON profile_media (user_id, kind, position);
CREATE UNIQUE INDEX uq_profile_media_main ON profile_media (user_id) WHERE is_main;
COMMENT ON TABLE profile_media IS 'Ordered photo/clip slots (PM1, PM2, B8, P4, GD4). Caps from entitlements: Free verified 3 photos + 1 clip, Premium 6 + 3, Gold 20 + 10. Main photo is always slot 1 and cannot be deleted until another replaces it. BL6: extras over the new cap are hidden 90 days (hidden_until) then deleted; the main photo always stays. PII: personal.';

CREATE TABLE partner_preferences (
  user_id            uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  show_me            interest_t NOT NULL DEFAULT 'women',
  age_min            smallint NOT NULL DEFAULT 18,
  age_max            smallint NOT NULL DEFAULT 45,
  max_distance_km    smallint NOT NULL DEFAULT 25,
  intentions         intention_t[] NOT NULL DEFAULT '{long_term,long_open_short}',
  verified_only      boolean NOT NULL DEFAULT false,
  active_this_week   boolean NOT NULL DEFAULT true,
  include_international boolean NOT NULL DEFAULT false,
  open_to_long_distance boolean NOT NULL DEFAULT false,
  open_to_relocating boolean NOT NULL DEFAULT false,
  open_when_travelling boolean NOT NULL DEFAULT false,
  likes_sort         text NOT NULL DEFAULT 'new' CHECK (likes_sort IN ('new','near','specs')),
  likes_kinds        text[] NOT NULL DEFAULT '{like,somewhat,direct}' CHECK (likes_kinds <@ ARRAY['like','somewhat','direct']::text[] AND cardinality(likes_kinds) >= 1),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CHECK (age_min >= 18 AND age_max <= 99 AND age_min <= age_max),
  CHECK (max_distance_km BETWEEN 1 AND 500)
);
CREATE TRIGGER trg_prefs_upd BEFORE UPDATE ON partner_preferences FOR EACH ROW EXECUTE FUNCTION set_updated_at();
COMMENT ON TABLE partner_preferences IS 'Saved discovery filters: D1F (show me, distance, age range, intentions, verified only, active this week, international = Gold), D7F likes sort/filter, GD2 open-to flags. Widening past the local limit is a Gold trigger. PII: personal.';

CREATE TABLE partner_preference_options (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  option_id  smallint NOT NULL REFERENCES options(id),
  set_key    text NOT NULL REFERENCES option_sets(key),
  PRIMARY KEY (user_id, option_id)
);
CREATE INDEX idx_ppo_set ON partner_preference_options (user_id, set_key);
COMMENT ON TABLE partner_preference_options IS 'P3 "open to" choices per section (soft boost). Character traits capped at 5 and only weight results. PII: personal; sensitive for genotype/faith.';

CREATE TABLE partner_preference_sections (
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  set_key        text NOT NULL REFERENCES option_sets(key),
  is_dealbreaker boolean NOT NULL DEFAULT false,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, set_key)
);
COMMENT ON TABLE partner_preference_sections IS 'P3 Deal-breaker switch per section (hard filter). Traits can never be a deal-breaker. The match-pool meter suggests relaxing when fewer than 10 people match. PII: personal.';

CREATE TABLE international_countries (
  user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  country  iso_country NOT NULL REFERENCES countries(iso2),
  position smallint NOT NULL DEFAULT 0,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, country)
);
CREATE CONSTRAINT TRIGGER trg_intl_countries_max AFTER INSERT ON international_countries
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_max_children('user_id', '5');
COMMENT ON TABLE international_countries IS 'GD2 "Where should we look?": up to 5 supported markets (Gold). PII: personal.';

CREATE TABLE user_settings (
  user_id          uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme            theme_t NOT NULL DEFAULT 'system',
  data_saver       boolean NOT NULL DEFAULT false,
  haptics_enabled  boolean NOT NULL DEFAULT true,
  sounds_enabled   boolean NOT NULL DEFAULT false,
  reduce_motion    boolean,
  show_active_status boolean NOT NULL DEFAULT true,
  discreet_mode    boolean NOT NULL DEFAULT false,
  quiet_hours_start time NOT NULL DEFAULT '23:00',
  quiet_hours_end  time NOT NULL DEFAULT '07:00',
  coach_tips_done_at timestamptz,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  show_plan_ring boolean NOT NULL DEFAULT true,  -- v3.4 M8 D17
  send_read_receipts boolean NOT NULL DEFAULT true,  -- v3.4 M9 D17
  quiet_hours_enabled boolean NOT NULL DEFAULT true  -- v3.4 M10 NT1
);
CREATE TRIGGER trg_settings_upd BEFORE UPDATE ON user_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
COMMENT ON TABLE user_settings IS 'D17 app settings and sensory preferences: theme, data saver, haptics (expo-haptics), sounds (off by default in public: match-chime, call-start only), reduced motion override (NULL = follow OS), NT1 quiet hours 23:00-07:00 and discreet lock-screen mode, C8 coach tips done. PII: none.';

-- =====================================================================
-- 7. VERIFICATION (Black Badge, liveness, face template, carrier check)
-- =====================================================================

CREATE TABLE badge_applications (
  id               uuid PRIMARY KEY DEFAULT uuid_v7(),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status           badge_status_t NOT NULL DEFAULT 'draft',
  steps_done       badge_step_t[] NOT NULL DEFAULT '{}',
  current_step     badge_step_t NOT NULL DEFAULT 'phone',
  trigger_surface  text CHECK (trigger_surface IN ('like','somewhat','open_profile','chat','likes_tab','banner','daily_limit','help_article')),
  payment_transaction_id uuid,
  auto_decided     boolean NOT NULL DEFAULT false,
  risk_score       numeric(5,4) CHECK (risk_score BETWEEN 0 AND 1),
  fix_step         badge_step_t,
  decision_reason  text,
  is_fraud         boolean NOT NULL DEFAULT false,
  reviewer_admin_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  started_at       timestamptz NOT NULL DEFAULT now(),
  submitted_at     timestamptz,
  sla_due_at       timestamptz,
  reminder_sent_at timestamptz,
  decided_at       timestamptz,
  refund_id        uuid,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (status = 'draft' OR submitted_at IS NOT NULL),
  CHECK (status <> 'needs_fix' OR fix_step IS NOT NULL),
  CHECK (status NOT IN ('approved','not_approved') OR decided_at IS NOT NULL),
  CHECK (submitted_at IS NULL OR payment_transaction_id IS NOT NULL),
  decision_reason_code text,  -- v3.4 A25 A12c
  member_message_key text,  -- v3.4 A25
  decision_note text CHECK (char_length(decision_note) <= 2000),  -- v3.4 A25
  CONSTRAINT ck_badge_decision CHECK (status NOT IN ('needs_fix','not_approved') OR (decision_reason_code IS NOT NULL AND member_message_key IS NOT NULL))  -- v3.4 A25
);
CREATE TRIGGER trg_badge_upd BEFORE UPDATE ON badge_applications FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE UNIQUE INDEX uq_badge_open ON badge_applications (user_id) WHERE status IN ('draft','submitted','in_review','needs_fix');
CREATE INDEX idx_badge_queue ON badge_applications (sla_due_at) WHERE status IN ('submitted','in_review');
COMMENT ON TABLE badge_applications IS 'Black Badge stepper B0-B11 (Phone -> Consent -> Photo -> Face check -> About -> Vibe -> Media -> Pay). Autosaves every step; B0 resumes ("Pick up where you left off"). Pay happens BEFORE review (submitted requires a paid transaction). B10 decisions: approved | needs_fix (redo one step, no new charge) | not_approved (auto refund, none for fraud). SLA 24 h. PII: personal.';

CREATE TABLE pending_actions (
  id             uuid PRIMARY KEY DEFAULT uuid_v7(),
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind           text NOT NULL CHECK (kind IN ('like','somewhat','open_profile','open_chat','keep_talking','direct_spec','go_international')),
  target_user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  target_ref     uuid,
  gate           text NOT NULL CHECK (gate IN ('black_badge','premium','gold')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  completed_at   timestamptz,
  expires_at     timestamptz NOT NULL DEFAULT now() + interval '30 days'
);
CREATE UNIQUE INDEX uq_pending_action_open ON pending_actions (user_id, gate) WHERE completed_at IS NULL;
COMMENT ON TABLE pending_actions IS 'The action that triggered a paywall (e.g. the Like for Zara). Auto-completes on approval (B11) or after purchase (P6 -> Zara chat, GD6). PII: personal.';

CREATE TABLE verification_records (
  id          uuid PRIMARY KEY DEFAULT uuid_v7(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        verification_kind_t NOT NULL,
  vendor      text NOT NULL,
  vendor_ref  text,
  attempt_no  smallint NOT NULL DEFAULT 1 CHECK (attempt_no BETWEEN 1 AND 10),
  result      verification_result_t NOT NULL,
  score       numeric(6,4),
  reason_codes text[] NOT NULL DEFAULT '{}',
  badge_application_id uuid REFERENCES badge_applications(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz
);
CREATE INDEX idx_verif_user ON verification_records (user_id, kind, created_at DESC);
COMMENT ON TABLE verification_records IS 'Outcome log of every check: email, phone, liveness, face match, carrier, manual review (PM4 shows status). v3.2: the carrier check is deferred until after launch (OD-06), so no carrier rows at launch. No raw biometrics here, only vendor references and scores. PII: personal.';

CREATE TABLE liveness_sessions (
  id                uuid PRIMARY KEY DEFAULT uuid_v7(),
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vendor            text NOT NULL,
  vendor_session_id text NOT NULL,
  attempt_no        smallint NOT NULL CHECK (attempt_no BETWEEN 1 AND 3),
  status            verification_result_t NOT NULL DEFAULT 'pending',
  sent_to_manual_review boolean NOT NULL DEFAULT false,
  video_deleted_at  timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  completed_at      timestamptz,
  UNIQUE (vendor, vendor_session_id)
);
CREATE INDEX idx_liveness_user ON liveness_sessions (user_id, created_at DESC);
COMMENT ON TABLE liveness_sessions IS 'B5 face check. Vendor DECIDED (18 Nov 2026, OD-06): AWS Rekognition Face Liveness, pay per check (vendor = ''aws_rekognition''). 3 tries, then manual review. The video is deleted after review (video_deleted_at must be set within 30 days, job liveness.purge). PII: biometric (vendor side).';

CREATE TABLE face_templates (
  user_id            uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  vendor             text NOT NULL,
  vendor_template_ref_enc bytea NOT NULL,
  dedupe_fingerprint sha256_hash,
  consent_record_id  uuid,
  created_at         timestamptz NOT NULL DEFAULT now(),
  rotated_at         timestamptz,
  deleted_at         timestamptz,
  retained_for_ban   boolean NOT NULL DEFAULT false
);
CREATE INDEX idx_face_dedupe ON face_templates (dedupe_fingerprint) WHERE deleted_at IS NULL OR retained_for_ban;
COMMENT ON TABLE face_templates IS 'Reference to the encrypted face template held by the liveness vendor ("kept as numbers", PM4). Used only for duplicate-account and ban detection and photo face-match. Deleted on consent withdrawal or erasure, except a one-way fingerprint for BANNED accounts (D13, legal basis fraud prevention). PII: biometric. Citus: distributed by user_id.';

CREATE TABLE carrier_checks (
  id              uuid PRIMARY KEY DEFAULT uuid_v7(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone_number_id uuid NOT NULL REFERENCES phone_numbers(id) ON DELETE CASCADE,
  vendor          text NOT NULL,
  trigger         text NOT NULL CHECK (trigger IN ('gold_upgrade','recheck_90d','new_device','manual')),
  sim_swap_at     timestamptz,
  line_age_days   integer,
  number_type     phone_type_t,
  is_roaming      boolean,
  result          carrier_result_t NOT NULL,
  hold_until      timestamptz,
  next_check_due_at timestamptz NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (result <> 'hold_72h' OR hold_until IS NOT NULL)
);
CREATE INDEX idx_carrier_due ON carrier_checks (next_check_due_at);
CREATE INDEX idx_carrier_user ON carrier_checks (user_id, created_at DESC);
COMMENT ON TABLE carrier_checks IS 'GD1 live phone check for Gold (SIM swap, line age, number type, roaming) via MNO network APIs or an aggregator. Recent SIM swap -> 72 h hold or a fresh face check. Re-check every 90 days and on a new device. PII: personal.';

CREATE TABLE upgrade_progress (
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  flow         plan_t NOT NULL CHECK (flow IN ('premium','gold')),
  step         text NOT NULL CHECK (step IN ('lifestyle','career','preferences','media','phone_check','international','safety_briefing','pay')),
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, flow, step)
);
COMMENT ON TABLE upgrade_progress IS 'Premium P1-P5 and Gold GD1-GD5 shared stepper: only steps not yet done are shown. PII: none.';

CREATE TABLE safety_briefing_acks (
  id            uuid PRIMARY KEY DEFAULT uuid_v7(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  briefing_version text NOT NULL,
  cards_viewed  smallint[] NOT NULL CHECK (cards_viewed @> ARRAY[1,2,3,4]::smallint[]),
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL DEFAULT now() + interval '6 months'
);
CREATE INDEX idx_briefing_user ON safety_briefing_acks (user_id, acknowledged_at DESC);
COMMENT ON TABLE safety_briefing_acks IS 'GD3 cross-border safety briefing: all 4 cards viewed before the confirm tick; mandatory once, refreshed every 6 months. PII: none.';

-- =====================================================================
-- 8. DISCOVERY, REACTIONS, MATCHES, 1-MINUTE INTRO, SPOTLIGHT
--    Citus: reactions / impressions / cooldowns / hidden by actor user_id;
--    matches and intro sessions by user_a (pair rows are canonical
--    user_a < user_b); lookups by user_b go through a colocated index
--    table in Citus mode (see section 25).
-- =====================================================================

CREATE TABLE usage_counters (
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metric       usage_metric_t NOT NULL,
  period_start date NOT NULL,
  period_kind  text NOT NULL CHECK (period_kind IN ('day','week')),
  count        integer NOT NULL DEFAULT 0 CHECK (count >= 0),
  limit_snapshot integer CHECK (limit_snapshot >= 0),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, metric, period_start),
  CHECK (period_kind <> 'week' OR extract(isodow FROM period_start) = 1),
  CHECK (limit_snapshot IS NULL OR count <= limit_snapshot)
);
COMMENT ON TABLE usage_counters IS 'Durable copy of quotas; Redis quota:* keys are the fast path. specs_viewed per member local day (v3.2 OD-03: BASIC / PENDING_REVIEW 25, ACTIVE verified Free 50, Premium / Gold no limit; remote_config discovery.daily_cap.*; the card after the cap becomes AS6; reset at local midnight; spent through spend_spec_view()), direct_specs_sent per ISO week (Gold 20), direct_specs_abroad (max 2 in a new Gold account''s first 7 days), spotlight_turns per week, data_exports per day (1). Spending uses SELECT ... FOR UPDATE. PII: none.';

CREATE TABLE feed_impressions (
  user_id      uuid NOT NULL,
  shown_at     timestamptz NOT NULL DEFAULT now(),
  target_id    uuid NOT NULL,
  surface      feed_surface_t NOT NULL,
  position     smallint NOT NULL CHECK (position >= 0),
  rank_score   real,
  request_id   uuid,
  counted_for_quota boolean NOT NULL DEFAULT true,
  PRIMARY KEY (user_id, shown_at, target_id)
) PARTITION BY RANGE (shown_at);
CREATE TABLE feed_impressions_default PARTITION OF feed_impressions DEFAULT;
CREATE INDEX idx_impr_brin ON feed_impressions USING brin (shown_at);
CREATE INDEX idx_impr_target ON feed_impressions (target_id, shown_at DESC);
COMMENT ON TABLE feed_impressions IS 'Cards shown in D1 tabs (For you, Nearby, New, International), Spotlight and Likes: quota audit, ranking training data and Spotlight stats. Partitioned monthly, retention 90 days. No FK (high volume); ids validated at write. PII: personal (behavioural).';

CREATE TABLE reactions (
  id                 uuid PRIMARY KEY DEFAULT uuid_v7(),
  actor_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind               reaction_t NOT NULL,
  surface            feed_surface_t NOT NULL DEFAULT 'for_you',
  client_reaction_id uuid NOT NULL,
  pass_count         smallint NOT NULL DEFAULT 0 CHECK (pass_count >= 0),
  undo_until         timestamptz,
  undone_at          timestamptz,
  undone_via         text CHECK (undone_via IN ('undo_toast','rewind')),
  seen_by_target_at  timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CHECK (actor_id <> target_id),
  CHECK (kind = 'pass' OR undo_until IS NULL),
  CHECK (undone_at IS NULL OR undone_via IS NOT NULL),
  UNIQUE (actor_id, target_id),
  UNIQUE (actor_id, client_reaction_id)
);
CREATE TRIGGER trg_reactions_upd BEFORE UPDATE ON reactions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_reactions_likes_grid ON reactions (target_id, created_at DESC) WHERE kind IN ('like','somewhat') AND undone_at IS NULL;
CREATE INDEX idx_reactions_you_liked ON reactions (actor_id, created_at DESC) WHERE kind IN ('like','somewhat') AND undone_at IS NULL;
CREATE INDEX idx_reactions_passes ON reactions (actor_id, target_id) WHERE kind = 'pass' AND undone_at IS NULL;
COMMENT ON TABLE reactions IS 'Swipe ledger: one current reaction per direction (UNIQUE actor,target) plus an idempotency key from the device outbox (UNIQUE actor, client_reaction_id). D1 reaction bar Pass / Somewhat / Like. Pass shows an Undo toast for 6 s (undo_until); Gold Rewind can undo later. D7 Likes grid ("Liked you" / "You liked") and D7F filters read the partial indexes. Written only through record_reaction(). PII: personal (behavioural).';

CREATE TABLE reaction_history (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id   uuid NOT NULL,
  target_id  uuid NOT NULL,
  kind       reaction_t NOT NULL,
  event      text NOT NULL CHECK (event IN ('react','undo','rewind','replace')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_reaction_hist_actor ON reaction_history (actor_id, created_at DESC);
CREATE INDEX idx_reaction_hist_brin ON reaction_history USING brin (created_at);
COMMENT ON TABLE reaction_history IS 'Append-only history of reactions, undos and rewinds (analytics, abuse velocity, support). Retention 13 months. PII: personal (behavioural).';

CREATE TABLE pair_cooldowns (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  other_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason     cooldown_reason_t NOT NULL,
  until      timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, other_id, reason),
  CHECK (user_id <> other_id)
);
CREATE INDEX idx_cooldowns_until ON pair_cooldowns (until);
COMMENT ON TABLE pair_cooldowns IS 'Hide-for-a-while rules: Pass and Move on hide that person for 30 days (D20, pass memory), unblock allows re-matching after 48 h, unmatch. Discovery excludes rows with until > now(). Expired rows purged daily. PII: personal.';

CREATE TABLE hidden_profiles (
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hidden_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, hidden_user_id),
  CHECK (user_id <> hidden_user_id)
);
COMMENT ON TABLE hidden_profiles IS 'D4 "Hide from My Specs": softer than block, only removes someone from My Specs; the person is not told. Listed and reversible in H5. PII: personal.';

CREATE TABLE matches (
  id                 uuid PRIMARY KEY DEFAULT uuid_v7(),
  user_a             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind               match_kind_t NOT NULL,
  status             match_status_t NOT NULL DEFAULT 'active',
  completed_by       uuid REFERENCES users(id) ON DELETE SET NULL,
  intro_expires_at   timestamptz NOT NULL,
  seen_by_a_at       timestamptz,
  seen_by_b_at       timestamptz,
  ended_at           timestamptz,
  ended_by           uuid REFERENCES users(id) ON DELETE SET NULL,
  ended_reason       text CHECK (ended_reason IN ('unmatch','block','moved_on','intro_expired','account_deleted','moderation')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CHECK (user_a < user_b),
  CHECK ((status = 'active') = (ended_at IS NULL))
);
CREATE TRIGGER trg_matches_upd BEFORE UPDATE ON matches FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE UNIQUE INDEX uq_matches_active_pair ON matches (user_a, user_b) WHERE status = 'active';
CREATE INDEX idx_matches_b ON matches (user_b, created_at DESC) WHERE status = 'active';
CREATE INDEX idx_matches_a ON matches (user_a, created_at DESC) WHERE status = 'active';
CREATE INDEX idx_matches_expiry ON matches (intro_expires_at) WHERE status = 'active';
COMMENT ON TABLE matches IS 'Mutual reactions. Like + Like = match (D5 "MUTUAL LIKE"); Like + Somewhat or Somewhat + Somewhat = maybe (MF1). One active row per pair in canonical order. intro_expires_at drives the D5 countdown and the D8 fresh-matches row ("hours left"). Unmatch (D10) requires a confirm sheet; chat disappears for both. PII: personal.';
COMMENT ON COLUMN matches.intro_expires_at IS 'created_at + remote_config intro.window_hours. DECIDED (18 Nov 2026, OD-02): 24 h for matches and maybe-matches. The 48 h rules for meet-up invite expiry and re-match after unblock are unchanged.';

CREATE TABLE intro_sessions (
  id              uuid PRIMARY KEY DEFAULT uuid_v7(),
  match_id        uuid NOT NULL UNIQUE REFERENCES matches(id) ON DELETE CASCADE,
  user_a          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          intro_status_t NOT NULL DEFAULT 'waiting',
  a_opened_at     timestamptz,
  b_opened_at     timestamptz,
  started_at      timestamptz,
  ends_at         timestamptz,
  duration_s      smallint NOT NULL DEFAULT 60 CHECK (duration_s BETWEEN 30 AND 300),
  untimed         boolean NOT NULL DEFAULT false,
  expires_at      timestamptz NOT NULL,
  skipped_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  outcome         text CHECK (outcome IN ('both_keep','moved_on','expired','skipped_to_chat')),
  decided_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (user_a < user_b),
  CHECK (started_at IS NULL OR (a_opened_at IS NOT NULL AND b_opened_at IS NOT NULL)),
  CHECK (ends_at IS NULL OR untimed OR ends_at = started_at + make_interval(secs => duration_s)),
  decide_by timestamptz  -- v3.4 M40 MF3 24 h to choose
);
CREATE TRIGGER trg_intro_upd BEFORE UPDATE ON intro_sessions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_intro_waiting ON intro_sessions (expires_at) WHERE status IN ('waiting','live','ended');
COMMENT ON TABLE intro_sessions IS 'One server-side 1-Minute Intro per match (D6, MF2). The 60 s timer starts when both people have it open (presence via the chat socket). Untimed mode exists for accessibility. Premium+ can "Skip intro, open chat" (D5). PII: personal.';

CREATE TABLE intro_messages (
  id               uuid PRIMARY KEY DEFAULT uuid_v7(),
  intro_session_id uuid NOT NULL REFERENCES intro_sessions(id) ON DELETE CASCADE,
  sender_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind             prompt_answer_kind_t NOT NULL,
  body             text CHECK (char_length(body) BETWEEN 1 AND 1000),   -- v3.4 M19 ceiling; API enforces remote_config intro.text_max_chars (280)
  media_id         uuid REFERENCES media_assets(id) ON DELETE SET NULL,
  duration_ms      integer CHECK (duration_ms BETWEEN 300 AND 20000),
  transcript       text,
  safety_verdict   safety_verdict_t NOT NULL DEFAULT 'clean',
  kept             boolean NOT NULL DEFAULT false,
  delete_after     timestamptz NOT NULL DEFAULT now() + interval '30 days',
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (intro_session_id, sender_id),
  CHECK ((kind = 'text') = (body IS NOT NULL)),
  CHECK (kind = 'text' OR duration_ms IS NOT NULL)
);
CREATE INDEX idx_intro_msgs_purge ON intro_messages (delete_after) WHERE NOT kept;
COMMENT ON TABLE intro_messages IS 'Each person sends either one text (D6) or one voice note up to 20 s (MF2), stored as Opus, transcribed for moderation, deleted 30 days after the intro unless kept (both chose Keep talking). Text cap 280 chars: DECIDED (19 Nov 2026, OD-31 / T-7): keep the seed (admin-tunable). PII: personal.';

CREATE TABLE intro_decisions (
  intro_session_id uuid NOT NULL REFERENCES intro_sessions(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  decision         intro_decision_t NOT NULL,
  decided_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (intro_session_id, user_id)
);
CREATE TRIGGER trg_intro_decisions_final BEFORE UPDATE ON intro_decisions FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
COMMENT ON TABLE intro_decisions IS 'MF3 Keep talking / Move on: blind and final (updates refused). Both keep -> chat thread created (Free verified sees the Premium upsell with the intro saved). Either moves on -> neutral "didn''t click" for both and a 30-day pair cooldown. PII: personal.';

CREATE TABLE spotlight_rotations (
  id               uuid PRIMARY KEY DEFAULT uuid_v7(),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start       date NOT NULL CHECK (extract(isodow FROM week_start) = 1),
  turn_no          smallint NOT NULL CHECK (turn_no BETWEEN 1 AND 3),   -- v3.4 M1 / B1 OD-18: 3 rotations a week
  is_priority      boolean NOT NULL DEFAULT false,
  city_id          integer REFERENCES cities(id),
  starts_at        timestamptz NOT NULL,
  ends_at          timestamptz NOT NULL,
  status           text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','live','done','skipped','cancelled')),
  push_sent_at     timestamptz,
  impressions      integer NOT NULL DEFAULT 0,
  likes_received   integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start, turn_no),
  CHECK (ends_at > starts_at),
  position smallint CHECK (position >= 1),  -- v3.4 M1 / B1 A24c place in rotation
  somewhats_received integer NOT NULL DEFAULT 0  -- v3.4 M42 MF6
);
CREATE INDEX idx_spotlight_live ON spotlight_rotations (city_id, starts_at) WHERE status IN ('scheduled','live');
COMMENT ON TABLE spotlight_rotations IS 'MF6 Spotlight at local peak hours for verified paid members. DECIDED (19 Nov 2026, OD-18): 3 rotations a week (e.g. Mon, Wed, Fri; remote_config spotlight.rotations_per_week = 3); in each rotation every eligible Premium and Gold member gets a turn, Gold placed first (spotlight.gold_priority = true). RESTRICTED accounts and opt-outs excluded. N09 push starts each turn; stats update live. PII: personal.';

-- =====================================================================
-- 9. MESSAGING (chats, Direct Specs, DM requests, calls)
--    Citus: conversations by id; messages and children by conversation_id
--    (colocated). Typing indicators and presence are Redis-only.
-- =====================================================================

CREATE TABLE conversations (
  id               uuid PRIMARY KEY DEFAULT uuid_v7(),
  kind             conversation_kind_t NOT NULL,
  user_a           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_id         uuid REFERENCES matches(id) ON DELETE SET NULL,
  intro_session_id uuid REFERENCES intro_sessions(id) ON DELETE SET NULL,
  state            conversation_state_t NOT NULL DEFAULT 'open',
  opened_via       text CHECK (opened_via IN ('both_keep','skip_intro','dm_accepted')),
  last_message_at  timestamptz,
  last_message_preview text CHECK (char_length(last_message_preview) <= 120),
  last_sender_id   uuid,
  message_count    integer NOT NULL DEFAULT 0,
  money_warning_shown_at timestamptz,
  closed_at        timestamptz,
  closed_reason    text CHECK (closed_reason IN ('unmatched','blocked','account_deleted','moderation','declined')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (user_a < user_b),
  CHECK (kind <> 'match' OR match_id IS NOT NULL OR state = 'closed'),
  CHECK ((state = 'closed') = (closed_at IS NOT NULL))
);
CREATE TRIGGER trg_conv_upd BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE UNIQUE INDEX uq_conv_live_pair ON conversations (user_a, user_b) WHERE state <> 'closed';
CREATE INDEX idx_conv_last ON conversations (last_message_at DESC) WHERE state <> 'closed';
COMMENT ON TABLE conversations IS 'One-to-one threads: from a match (D9), a Direct Spec (D11 -> H7/H8) or a group-member DM. One live thread per pair. state request = waiting in Message requests; read_only = over the plan''s conversation limit after a lapse (BL6). The D9 "Meeting Tunde? Plan a safe date" bar opens EV1 for this conversation. PII: personal.';

CREATE TABLE conversation_participants (
  conversation_id   uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  holds_slot        boolean NOT NULL DEFAULT false,
  slot_acquired_at  timestamptz,
  last_read_message_id uuid,
  last_read_at      timestamptz,
  unread_count      integer NOT NULL DEFAULT 0 CHECK (unread_count >= 0),
  muted_until       timestamptz,
  archived_at       timestamptz,
  hidden_at         timestamptz,
  read_only_reason  text CHECK (read_only_reason IN ('plan_lapsed','restricted')),
  joined_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id),
  CHECK (holds_slot = (slot_acquired_at IS NOT NULL)),
  send_read_receipts boolean  -- v3.4 M9 D10 per-chat override (NULL = inherit)
);
CREATE INDEX idx_cp_chat_list ON conversation_participants (user_id, conversation_id) WHERE hidden_at IS NULL;
CREATE INDEX idx_cp_unread ON conversation_participants (user_id) WHERE unread_count > 0 AND hidden_at IS NULL;
CREATE INDEX idx_cp_slots ON conversation_participants (user_id) WHERE holds_slot;
COMMENT ON TABLE conversation_participants IS 'Per-member thread state: open-conversation slot (Premium 20, Gold unlimited; "1 of 20 conversations" on P6), unread counter (D8 badge, tab "Chats 2"), read watermark. Read receipts: the watermark is shown to the other person only when the viewer holds chat.read_receipts (Gold); senders of DM requests never see read status until accepted. PII: personal.';

CREATE TABLE messages (
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  id              uuid NOT NULL DEFAULT uuid_v7(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  sender_id       uuid REFERENCES users(id) ON DELETE SET NULL,
  kind            message_kind_t NOT NULL DEFAULT 'text',
  body            text CHECK (char_length(body) <= 2000),
  reply_to_id     uuid,
  effect_key      text REFERENCES message_effects(key),
  meetup_id       uuid,
  safety_flags    text[] NOT NULL DEFAULT '{}',
  safety_verdict  safety_verdict_t NOT NULL DEFAULT 'clean',
  edited_at       timestamptz,
  deleted_at      timestamptz,
  PRIMARY KEY (conversation_id, id, created_at),
  CHECK (kind <> 'text' OR body IS NOT NULL OR deleted_at IS NOT NULL),
  CHECK (safety_verdict <> 'blocked')
) PARTITION BY RANGE (created_at);
CREATE TABLE messages_default PARTITION OF messages DEFAULT;
CREATE INDEX idx_messages_thread ON messages (conversation_id, created_at DESC);
CREATE INDEX idx_messages_brin ON messages USING brin (created_at);
CREATE INDEX idx_messages_flagged ON messages (created_at) WHERE safety_verdict = 'warned';
COMMENT ON TABLE messages IS 'Chat messages, partitioned monthly by created_at (keyset pagination on conversation_id, created_at). Blocked-by-safety-filter sends never land here (they are message_failures, ES6). safety_flags: money_words, contact_info, link, move_app; "warned" shows the in-chat warning to the receiver (money / gift card / crypto / bank / move-to-another-app). Deleted when both unmatch or on erasure; reported evidence is copied to report_evidence first. PII: personal.';

CREATE TABLE message_client_ids (
  sender_id     uuid NOT NULL,
  client_msg_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  message_id    uuid NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sender_id, client_msg_id)
);
CREATE INDEX idx_msg_client_ids_brin ON message_client_ids USING brin (created_at);
COMMENT ON TABLE message_client_ids IS 'Idempotency for message sends from the offline outbox (a unique key cannot span a partitioned table). Insert first in the same transaction as the message; conflict = duplicate retry, return the original. Retention 7 days. PII: none.';

CREATE TABLE message_attachments (
  id                 uuid PRIMARY KEY DEFAULT uuid_v7(),
  conversation_id    uuid NOT NULL,
  message_id         uuid NOT NULL,
  message_created_at timestamptz NOT NULL,
  media_id           uuid NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  position           smallint NOT NULL DEFAULT 0 CHECK (position BETWEEN 0 AND 9),
  FOREIGN KEY (conversation_id, message_id, message_created_at)
    REFERENCES messages (conversation_id, id, created_at) ON DELETE CASCADE
);
CREATE INDEX idx_msg_att_msg ON message_attachments (conversation_id, message_id);
COMMENT ON TABLE message_attachments IS 'Images and voice notes in chat (D10 "media" gallery). PII: personal.';

CREATE TABLE message_reactions (
  conversation_id    uuid NOT NULL,
  message_id         uuid NOT NULL,
  message_created_at timestamptz NOT NULL,
  user_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji              text NOT NULL CHECK (char_length(emoji) BETWEEN 1 AND 16),
  created_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, message_id, user_id),
  FOREIGN KEY (conversation_id, message_id, message_created_at)
    REFERENCES messages (conversation_id, id, created_at) ON DELETE CASCADE
);
COMMENT ON TABLE message_reactions IS 'D9 reaction picker (one reaction per person per message; emoji is member content). PII: personal.';

CREATE TABLE message_failures (
  id              uuid PRIMARY KEY DEFAULT uuid_v7(),
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_msg_id   uuid NOT NULL,
  reason          send_failure_t NOT NULL,
  matched_rule_ids uuid[] NOT NULL DEFAULT '{}',
  body_hash       sha256_hash,
  retry_count     smallint NOT NULL DEFAULT 0 CHECK (retry_count BETWEEN 0 AND 20),
  last_retry_at   timestamptz,
  resolution      text CHECK (resolution IN ('sent','edited','deleted','upgraded')),
  resolved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sender_id, client_msg_id)
);
CREATE INDEX idx_msg_fail_open ON message_failures (sender_id, created_at DESC) WHERE resolved_at IS NULL;
COMMENT ON TABLE message_failures IS 'ES6 "Not sent, tap to retry": safety filter (money or bank words in early chats: must edit or delete, never auto-resent), conversation limit (links to upgrade), restricted, rate limited. No-connection failures are client-side; retries reported for metrics. The body is not stored, only a hash. Retention 30 days. PII: none.';

CREATE TABLE dm_requests (
  id              uuid PRIMARY KEY DEFAULT uuid_v7(),
  conversation_id uuid NOT NULL UNIQUE REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind            dm_kind_t NOT NULL,
  note            text NOT NULL CHECK (char_length(note) BETWEEN 1 AND 200),
  group_id        uuid,
  status          dm_status_t NOT NULL DEFAULT 'pending',
  is_cross_border boolean NOT NULL DEFAULT false,
  spam_score      real,
  created_at      timestamptz NOT NULL DEFAULT now(),
  responded_at    timestamptz,
  expires_at      timestamptz NOT NULL DEFAULT now() + interval '14 days',
  CHECK (sender_id <> recipient_id),
  CHECK ((status IN ('pending','filtered','expired')) = (responded_at IS NULL)),
  CHECK (kind <> 'group_member' OR group_id IS NOT NULL),
  replied_prompt_answer_id uuid REFERENCES prompt_answers(id) ON DELETE SET NULL  -- v3.4 M12 D11
);
CREATE UNIQUE INDEX uq_dm_pending_pair ON dm_requests (sender_id, recipient_id) WHERE status = 'pending';
CREATE INDEX idx_dm_inbox ON dm_requests (recipient_id, created_at DESC) WHERE status IN ('pending','filtered');
COMMENT ON TABLE dm_requests IS 'D11 Direct Spec (Gold, 20 a week, note <= 200) and group-member DMs. Land in H7 Message requests (likely spam -> Filtered); H8 accept / decline / block. Accepting uses a conversation slot. Request expiry 14 days: DECIDED (19 Nov 2026, OD-31 / T-7): keep the seed (admin-tunable). PII: personal.';

CREATE TABLE calls (
  id              uuid PRIMARY KEY DEFAULT uuid_v7(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  caller_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  callee_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind            call_kind_t NOT NULL,
  daily_room_name text NOT NULL UNIQUE,
  status          call_status_t NOT NULL DEFAULT 'ringing',
  started_at      timestamptz NOT NULL DEFAULT now(),
  answered_at     timestamptz,
  ended_at        timestamptz,
  duration_s      integer CHECK (duration_s >= 0),
  end_reason      text,
  CHECK (caller_id <> callee_id)
);
CREATE INDEX idx_calls_conv ON calls (conversation_id, started_at DESC);
COMMENT ON TABLE calls IS 'MF4 audio/video calls (Gold, later release) through daily.co rooms per call with short-lived tokens. Never recorded: only metadata (time, duration), which is what a report from MF5 attaches. PII: personal.';

CREATE TABLE call_feedback (
  call_id    uuid NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feeling    feeling_t NOT NULL CHECK (feeling <> 'noshow'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (call_id, user_id)
);
COMMENT ON TABLE call_feedback IS 'MF5 "How did it feel?" (private). bad leads to H3. PII: personal.';

-- =====================================================================
-- 10. GROUPS
--     Citus: groups by id; group_members / group_messages / group_rules /
--     group_invites by group_id (colocated).
-- =====================================================================

CREATE TABLE groups (
  id              uuid PRIMARY KEY DEFAULT uuid_v7(),
  owner_id        uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name            text NOT NULL CHECK (char_length(name) BETWEEN 3 AND 40),
  description     text CHECK (char_length(description) <= 140),
  avatar_media_id uuid REFERENCES media_assets(id) ON DELETE SET NULL,
  city_id         integer REFERENCES cities(id),
  location        geography(Point,4326),
  join_rule       group_join_rule_t NOT NULL DEFAULT 'public',
  post_rule       group_post_rule_t NOT NULL DEFAULT 'premium_plus',
  status          group_status_t NOT NULL DEFAULT 'pending_review',
  max_members     smallint NOT NULL DEFAULT 500 CHECK (max_members BETWEEN 2 AND 500),
  member_count    integer NOT NULL DEFAULT 1 CHECK (member_count >= 0),
  guidelines_accepted_at timestamptz NOT NULL,
  search_tsv      tsvector GENERATED ALWAYS AS (to_tsvector('simple', name || ' ' || coalesce(description,''))) STORED,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  CHECK (member_count <= max_members),
  CONSTRAINT ck_groups_name_contact CHECK (regexp_replace(name, '[\s-]', '', 'g') !~ '[0-9]{5,}'
                                           AND name !~* '(https?://|www\.|@|\.(com|ng|net|org)([^a-z]|$))'),  -- v3.4 M37 same rule as the API
  topic text NOT NULL DEFAULT 'other' CHECK (topic IN ('food','music','books','faith','fitness','travel','sport','culture','other')),  -- v3.4 M4 GC1 / D12
  icon_key text CHECK (icon_key ~ '^[a-z_]{2,30}$'),  -- v3.4 M4 GC1
  slug text CHECK (slug ~ '^[a-z0-9-]{3,60}$'),  -- v3.4 M5 GC5 1minitman.com/g/<slug>
  review_note_key text,  -- v3.4 A53 A18a
  rename_requested_at timestamptz  -- v3.4 A53
);
CREATE TRIGGER trg_groups_upd BEFORE UPDATE ON groups FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_groups_discover ON groups USING gist (location) WHERE status = 'active' AND join_rule <> 'invite';
CREATE INDEX idx_groups_city ON groups (city_id, member_count DESC) WHERE status = 'active' AND join_rule <> 'invite';
CREATE INDEX idx_groups_search ON groups USING gin (search_tsv) WHERE status = 'active';
CREATE INDEX idx_groups_owner ON groups (owner_id) WHERE deleted_at IS NULL;
COMMENT ON TABLE groups IS 'Verified-only interest rooms (D12, D13, D13A, GC1-GC5). Create: Premium owns 1, Gold owns up to 10 (entitlement groups.own_max; GC4 copy "Gold lets you run 3" must change to 10). Max 500 members. Name 3-40, no phones/emails/links/@handles; checked by moderation before public. Invite-only groups are hidden from Discover. Owner can transfer, pause or delete. PII: personal.';

CREATE TABLE group_rules (
  id         uuid PRIMARY KEY DEFAULT uuid_v7(),
  group_id   uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  position   smallint NOT NULL CHECK (position BETWEEN 1 AND 5),
  text       text NOT NULL CHECK (char_length(text) BETWEEN 3 AND 80),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, position)
);
COMMENT ON TABLE group_rules IS 'Owner''s own rules (GC2, up to 5, <= 80 chars). The 3 platform rules (respect, no selling/soliciting, 18+ verified) always apply and live in i18n, not here. PII: none.';

CREATE TABLE group_members (
  group_id      uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          group_role_t NOT NULL DEFAULT 'member',
  status        group_member_status_t NOT NULL DEFAULT 'active',
  muted         boolean NOT NULL DEFAULT false,
  last_read_at  timestamptz,
  unread_count  integer NOT NULL DEFAULT 0 CHECK (unread_count >= 0),
  requested_at  timestamptz,
  joined_at     timestamptz,
  left_at       timestamptz,
  removed_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (group_id, user_id),
  CHECK (status <> 'active' OR joined_at IS NOT NULL),
  removed_by_admin uuid REFERENCES admin_users(id) ON DELETE SET NULL  -- v3.4 A53 A18b
);
CREATE UNIQUE INDEX uq_group_one_owner ON group_members (group_id) WHERE role = 'owner' AND status = 'active';
CREATE INDEX idx_group_members_user ON group_members (user_id) WHERE status = 'active';
CREATE INDEX idx_group_members_pending ON group_members (group_id, requested_at) WHERE status = 'pending_approval';
COMMENT ON TABLE group_members IS 'Membership, roles and D13A mute switch. "Ask to join" requests are pending_approval until the owner approves. Leave group needs a confirm (D13A). Everyone verified can browse; posting needs Premium+ unless the group is admins-only. PII: personal.';

CREATE TABLE group_invites (
  id          uuid PRIMARY KEY DEFAULT uuid_v7(),
  group_id    uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  inviter_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      invite_status_t NOT NULL DEFAULT 'pending',
  created_at  timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  expires_at  timestamptz NOT NULL DEFAULT now() + interval '14 days',
  CHECK (inviter_id <> invitee_id)
);
CREATE UNIQUE INDEX uq_group_invite_pending ON group_invites (group_id, invitee_id) WHERE status = 'pending';
CREATE INDEX idx_group_invites_invitee ON group_invites (invitee_id) WHERE status = 'pending';
COMMENT ON TABLE group_invites IS 'GC3 / D13A invites: only to people you have matched or chatted with (API check); an invite is a request, not an add. PII: personal.';

CREATE TABLE group_messages (
  group_id      uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  id            uuid NOT NULL DEFAULT uuid_v7(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  sender_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  kind          message_kind_t NOT NULL DEFAULT 'text',
  body          text CHECK (char_length(body) <= 2000),
  reply_to_id   uuid,
  meetup_id     uuid,
  is_pinned     boolean NOT NULL DEFAULT false,
  safety_flags  text[] NOT NULL DEFAULT '{}',
  deleted_at    timestamptz,
  deleted_by    uuid,
  PRIMARY KEY (group_id, id, created_at)
) PARTITION BY RANGE (created_at);
CREATE TABLE group_messages_default PARTITION OF group_messages DEFAULT;
CREATE INDEX idx_group_msgs_room ON group_messages (group_id, created_at DESC);
CREATE INDEX idx_group_msgs_pinned ON group_messages (group_id) WHERE is_pinned;
COMMENT ON TABLE group_messages IS 'D13 group room messages, partitioned monthly. Pinned event card (RSVP) via meetup_id. PII: personal.';

-- =====================================================================
-- 11. MEET-UPS AND SAFETY (EV1-EV6, LG4, LG5, H2)
--     Citus: meetups by id; children by meetup_id; trusted_contacts by user_id.
-- =====================================================================

CREATE TABLE meetups (
  id               uuid PRIMARY KEY DEFAULT uuid_v7(),
  kind             meetup_kind_t NOT NULL,
  title            text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 60),
  cost_note        text CHECK (char_length(cost_note) <= 80),
  created_by       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id  uuid REFERENCES conversations(id) ON DELETE CASCADE,
  group_id         uuid REFERENCES groups(id) ON DELETE CASCADE,
  venue_id         uuid NOT NULL REFERENCES venues(id),
  starts_at        timestamptz NOT NULL,
  ends_at          timestamptz NOT NULL,
  capacity         smallint CHECK (capacity BETWEEN 2 AND 500),
  join_rule        meetup_join_rule_t NOT NULL DEFAULT 'verified_only',
  status           meetup_status_t NOT NULL DEFAULT 'proposed',
  share_with_trusted boolean NOT NULL DEFAULT true,
  invite_expires_at timestamptz,
  reminder_sent_at timestamptz,
  cancelled_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK ((kind = 'date')  = (conversation_id IS NOT NULL AND group_id IS NULL)),
  CHECK ((kind = 'group') = (group_id IS NOT NULL AND conversation_id IS NULL)),
  CHECK (kind = 'group' OR capacity IS NULL),
  cancelled_by_kind actor_kind_t,  -- v3.4 A34 A18c
  cancelled_by_admin uuid REFERENCES admin_users(id) ON DELETE SET NULL,  -- v3.4 A34
  cancel_reason_code text CHECK (cancel_reason_code IN ('unsafe_or_not_allowed','venue_unavailable','group_asked','group_removed','member_cancelled','other')),  -- v3.4 A34
  cancel_note text CHECK (char_length(cancel_note) <= 500)  -- v3.4 A34
);
CREATE TRIGGER trg_meetups_upd BEFORE UPDATE ON meetups FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_meetups_conv ON meetups (conversation_id, starts_at DESC);
CREATE INDEX idx_meetups_group ON meetups (group_id, starts_at) WHERE status IN ('proposed','scheduled');
CREATE INDEX idx_meetups_upcoming ON meetups (starts_at) WHERE status IN ('accepted','scheduled');
COMMENT ON TABLE meetups IS 'One model, two kinds (meetup-rules): a date with a match (from D9 safe-date bar, D10, MF5, EV6) or a group event (GC5, D13 pinned). Public venue required (no home/hotel). Date invites expire after 48 h; group events remind 24 h before (N08). No payments are collected in the app; cost_note is text only. PII: personal.';

CREATE TABLE meetup_rsvps (
  meetup_id  uuid NOT NULL REFERENCES meetups(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status     rsvp_status_t NOT NULL DEFAULT 'invited',
  added_to_calendar boolean NOT NULL DEFAULT false,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (meetup_id, user_id)
);
CREATE INDEX idx_rsvps_user ON meetup_rsvps (user_id) WHERE status = 'going';
COMMENT ON TABLE meetup_rsvps IS 'EV4 invite / RSVP ("Sun 16:00 works", going counts on D13 pinned events). Accepting adds to the device calendar (expo-calendar). PII: personal.';

CREATE TABLE meetup_time_proposals (
  id          uuid PRIMARY KEY DEFAULT uuid_v7(),
  meetup_id   uuid NOT NULL REFERENCES meetups(id) ON DELETE CASCADE,
  proposed_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  starts_at   timestamptz NOT NULL,
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','superseded')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mtp_meetup ON meetup_time_proposals (meetup_id, created_at DESC);
COMMENT ON TABLE meetup_time_proposals IS 'EV4 "Suggest another" time. PII: personal.';

CREATE TABLE meetup_feedback (
  meetup_id  uuid NOT NULL REFERENCES meetups(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feeling    feeling_t NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (meetup_id, user_id)
);
COMMENT ON TABLE meetup_feedback IS 'EV6 private feedback: great -> plan the next one; noshow or bad feed trust_signals; bad leads to H3. PII: personal.';

CREATE TABLE trusted_contacts (
  id              uuid PRIMARY KEY DEFAULT uuid_v7(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  phone           e164 NOT NULL,
  channel         otp_channel_t NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('sms','whatsapp')),
  status          trusted_status_t NOT NULL DEFAULT 'waiting_opt_in',
  opt_in_sent_at  timestamptz,
  opted_in_at     timestamptz,
  opted_out_at    timestamptz,
  removed_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'active') = (opted_in_at IS NOT NULL AND opted_out_at IS NULL AND removed_at IS NULL)),
  relationship text CHECK (char_length(relationship) <= 30)  -- v3.4 A57 A15b
);
CREATE TRIGGER trg_trusted_upd BEFORE UPDATE ON trusted_contacts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE UNIQUE INDEX uq_trusted_phone ON trusted_contacts (user_id, phone) WHERE removed_at IS NULL;
CREATE CONSTRAINT TRIGGER trg_trusted_max AFTER INSERT ON trusted_contacts
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_max_children('user_id', '3', 'AND removed_at IS NULL');
COMMENT ON TABLE trusted_contacts IS 'LG4 trusted contacts (up to 3). Each gets one opt-in by SMS or WhatsApp and must reply YES before anything is shared (NDPA third-party consent); STOP opts out. Status shows Active or Waiting for yes. PII: personal (third party).';

CREATE TABLE trusted_contact_messages (
  id                 uuid PRIMARY KEY DEFAULT uuid_v7(),
  trusted_contact_id uuid NOT NULL REFERENCES trusted_contacts(id) ON DELETE CASCADE,
  meetup_id          uuid REFERENCES meetups(id) ON DELETE SET NULL,
  direction          text NOT NULL CHECK (direction IN ('outbound','inbound')),
  kind               text NOT NULL CHECK (kind IN ('opt_in_request','date_shared','missed_checkin','stop_confirmation','reply_yes','reply_stop','reply_other')),
  provider           text,
  provider_msg_id    text,
  status             delivery_status_t NOT NULL DEFAULT 'queued',
  created_at         timestamptz NOT NULL DEFAULT now(),
  channel notif_channel_t CHECK (channel IN ('sms','whatsapp'))  -- v3.4 B32 A26e
);
CREATE INDEX idx_tcm_contact ON trusted_contact_messages (trusted_contact_id, created_at DESC);
COMMENT ON TABLE trusted_contact_messages IS 'Outbound SMS/WhatsApp to trusted contacts and their YES / STOP replies (inbound webhook). Bodies are not stored. Retention 12 months. PII: personal.';

CREATE TABLE meetup_shares (
  id                 uuid PRIMARY KEY DEFAULT uuid_v7(),
  meetup_id          uuid NOT NULL REFERENCES meetups(id) ON DELETE CASCADE,
  user_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trusted_contact_id uuid NOT NULL REFERENCES trusted_contacts(id) ON DELETE CASCADE,
  token_hash         sha256_hash NOT NULL UNIQUE,
  expires_at         timestamptz NOT NULL,
  first_viewed_at    timestamptz,
  view_count         integer NOT NULL DEFAULT 0,
  revoked_at         timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (meetup_id, trusted_contact_id)
);
COMMENT ON TABLE meetup_shares IS 'LG5 tokenised public link (no login) for a trusted contact: time, place, the match''s verified card; on a missed check-in the last coarse area and the member''s number. Never chats. Expires 24 h after the meet-up. PII: personal.';

CREATE TABLE safety_checkins (
  id             uuid PRIMARY KEY DEFAULT uuid_v7(),
  meetup_id      uuid NOT NULL REFERENCES meetups(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status         checkin_status_t NOT NULL DEFAULT 'scheduled',
  due_at         timestamptz NOT NULL,
  respond_by     timestamptz NOT NULL,
  snooze_count   smallint NOT NULL DEFAULT 0 CHECK (snooze_count BETWEEN 0 AND 6),
  responded_at   timestamptz,
  response       text CHECK (response IN ('ok','need_help')),
  last_coarse_location geography(Point,4326),
  alert_sent_at  timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (meetup_id, user_id),
  CHECK (respond_by = due_at + interval '15 minutes')
);
CREATE TRIGGER trg_checkins_upd BEFORE UPDATE ON safety_checkins FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_checkins_due ON safety_checkins (respond_by) WHERE status IN ('scheduled','due','snoozed');
COMMENT ON TABLE safety_checkins IS 'EV5 date safety check-in: a push at the planned end time; 15 minutes to answer, then the trusted contact and the trust-and-safety queue are alerted with the last coarse location. "Add 1 hour" snoozes (due_at += 1 h). The 112 call button is always visible. Location deleted 30 days after the meet-up. PII: sensitive (location during a date).';

CREATE TABLE safety_escalations (
  id               uuid PRIMARY KEY DEFAULT uuid_v7(),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind             escalation_kind_t NOT NULL,
  checkin_id       uuid REFERENCES safety_checkins(id) ON DELETE SET NULL,
  meetup_id        uuid REFERENCES meetups(id) ON DELETE SET NULL,
  report_id        uuid,
  status           text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','contacted_member','contacted_authorities','resolved','false_alarm')),
  contacts_notified_at timestamptz,
  assigned_admin_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  acknowledged_at  timestamptz,
  resolved_at      timestamptz,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  public_ref text NOT NULL UNIQUE DEFAULT ('SE-' || nextval('safety_escalation_ref_seq')),  -- v3.4 A14 SE-nnn
  outcome text CHECK (outcome IN ('member_safe','member_unreachable','handed_to_authorities','false_alarm','other'))  -- v3.4 A15
);
CREATE INDEX idx_escalations_open ON safety_escalations (created_at) WHERE status IN ('open','acknowledged');
COMMENT ON TABLE safety_escalations IS 'Missed check-ins, "I need help", urgent reports, money-scam patterns: highest-priority queue in the admin console. PII: sensitive.';

-- =====================================================================
-- 12. TRUST AND SAFETY
-- =====================================================================

CREATE TABLE blocks (
  id            uuid PRIMARY KEY DEFAULT uuid_v7(),
  blocker_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  surface       text NOT NULL CHECK (surface IN ('chat_actions','spec_profile','dm_thread','call_ended','group','report')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  undo_until    timestamptz NOT NULL DEFAULT now() + interval '6 seconds',
  unblocked_at  timestamptz,
  unblock_via   text CHECK (unblock_via IN ('undo_toast','blocked_list')),
  CHECK (blocker_id <> blocked_id),
  CHECK ((unblocked_at IS NULL) = (unblock_via IS NULL))
);
CREATE UNIQUE INDEX uq_blocks_active ON blocks (blocker_id, blocked_id) WHERE unblocked_at IS NULL;
CREATE INDEX idx_blocks_blocked ON blocks (blocked_id) WHERE unblocked_at IS NULL;
COMMENT ON TABLE blocks IS 'H4 block (instant, silent): removes the chat and hides both people everywhere (My Specs, Likes, Groups, DMs). Undo toast, then H5 blocked list (unblock with undo). Re-matching allowed 48 h after unblock (pair_cooldowns). Undo window 6 s mirrors Pass: DECIDED (19 Nov 2026, OD-31 / T-7): keep (admin-tunable). PII: personal.';

CREATE SEQUENCE report_public_ref_seq START 20000;
CREATE TABLE reports (
  id                uuid PRIMARY KEY DEFAULT uuid_v7(),
  public_ref        text NOT NULL UNIQUE DEFAULT ('R-' || nextval('report_public_ref_seq')),
  reporter_id       uuid REFERENCES users(id) ON DELETE SET NULL,
  reported_user_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  subject_type      report_subject_t NOT NULL,
  subject_id        uuid,
  context           report_context_t NOT NULL,
  reason_key        text NOT NULL REFERENCES report_reasons(key),
  details           text CHECK (char_length(details) <= 1000),
  include_messages  boolean NOT NULL DEFAULT true,
  also_blocked      boolean NOT NULL DEFAULT false,
  status            report_status_t NOT NULL DEFAULT 'open',
  severity          smallint NOT NULL CHECK (severity BETWEEN 1 AND 5),
  sla_due_at        timestamptz NOT NULL,
  case_id           uuid,
  resolution_code   text,
  resolved_at       timestamptz,
  reporter_notified_at timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CHECK (reporter_id IS NULL OR reporter_id <> reported_user_id),
  CHECK (subject_type <> 'user' OR reported_user_id IS NOT NULL),
  duplicate_of uuid REFERENCES reports(id),  -- v3.4 A49 A14a
  CONSTRAINT ck_reports_duplicate CHECK ((status = 'duplicate') = (duplicate_of IS NOT NULL))  -- v3.4 A49
);
CREATE TRIGGER trg_reports_upd BEFORE UPDATE ON reports FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_reports_queue ON reports (severity DESC, sla_due_at) WHERE status IN ('open','triaged','in_review');
CREATE INDEX idx_reports_reported ON reports (reported_user_id, created_at DESC);
CREATE INDEX idx_reports_reporter ON reports (reporter_id, created_at DESC);
COMMENT ON TABLE reports IS 'H3 reports (reason -> details -> sent) from chat actions, spec profile, call, call feedback, cancel plan, group info, DM thread, after a meet-up. The reported person is never told. Last 50 messages attach automatically from a chat. Under-18 and threats: human within 1 hour; others within 24 h. Public ref like R-20418 shown in Activity. Retention: 12 months after resolution (evidence) unless legal hold. PII: personal.';

CREATE TABLE report_evidence (
  id                 uuid PRIMARY KEY DEFAULT uuid_v7(),
  report_id          uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  kind               text NOT NULL CHECK (kind IN ('message_snapshot','screenshot','call_metadata','profile_snapshot','media','group_message_snapshot')),
  conversation_id    uuid,
  message_id         uuid,
  media_id           uuid REFERENCES media_assets(id) ON DELETE SET NULL,
  snapshot           jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CHECK (kind NOT IN ('message_snapshot','profile_snapshot','call_metadata','group_message_snapshot') OR snapshot IS NOT NULL)
);
CREATE INDEX idx_evidence_report ON report_evidence (report_id);
COMMENT ON TABLE report_evidence IS 'Frozen copies of evidence (messages, profile, call time/duration, screenshots "Add screenshots"), so evidence survives unmatch and erasure for 12 months. Moderators read only this, never live chats (conversations.read_reported). PII: personal.';

CREATE TABLE moderation_cases (
  id              uuid PRIMARY KEY DEFAULT uuid_v7(),
  kind            case_kind_t NOT NULL,
  subject_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  source_table    text NOT NULL,
  source_id       uuid NOT NULL,
  priority        smallint NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  country         iso_country,
  status          case_status_t NOT NULL DEFAULT 'queued',
  sla_due_at      timestamptz NOT NULL,
  claimed_by      uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  claimed_at      timestamptz,
  decided_at      timestamptz,
  decision        moderation_action_t,
  auto_decided    boolean NOT NULL DEFAULT false,
  sampled_for_qa  boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, source_table, source_id),
  CHECK (status <> 'claimed' OR claimed_by IS NOT NULL),
  CHECK (status <> 'decided' OR (decided_at IS NOT NULL AND decision IS NOT NULL)),
  qa_verdict text CHECK (qa_verdict IN ('agree','disagree')),  -- v3.4 A26 A12d
  qa_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,  -- v3.4 A26
  qa_at timestamptz,  -- v3.4 A26
  qa_reason text,  -- v3.4 A26
  qa_followup_case_id uuid REFERENCES moderation_cases(id) ON DELETE SET NULL,  -- v3.4 A26
  escalated_at timestamptz,  -- v3.4 A47
  assigned_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,  -- v3.4 A47
  pending_approval_id uuid REFERENCES admin_approvals(id) ON DELETE SET NULL,  -- v3.4 A48 A14a
  CONSTRAINT ck_cases_qa CHECK (qa_verdict IS DISTINCT FROM 'disagree' OR qa_reason IS NOT NULL)  -- v3.4 A26
);
CREATE TRIGGER trg_cases_upd BEFORE UPDATE ON moderation_cases FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_cases_queue ON moderation_cases (kind, priority DESC, sla_due_at) WHERE status IN ('queued','claimed');
CREATE INDEX idx_cases_country ON moderation_cases (country, kind) WHERE status IN ('queued','claimed');
CREATE INDEX idx_cases_subject ON moderation_cases (subject_user_id, created_at DESC);
COMMENT ON TABLE moderation_cases IS 'One moderation queue for every human decision: reports, badge reviews (24 h SLA), media reviews ("It''s really me, ask for a review"), group names, appeals, restriction reviews, safety escalations, abuse rule hits, payment risk. Scoped admins see only their country/queue. Auto-approved cases are sampled for QA. PII: personal.';

CREATE TABLE moderation_actions (
  id             uuid PRIMARY KEY DEFAULT uuid_v7(),
  case_id        uuid REFERENCES moderation_cases(id) ON DELETE SET NULL,
  actor_kind     actor_kind_t NOT NULL,
  admin_id       uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  target_type    text NOT NULL,
  target_id      uuid,
  action         moderation_action_t NOT NULL,
  reason_code    text NOT NULL,
  note           text,
  expires_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (actor_kind <> 'admin' OR admin_id IS NOT NULL),
  ladder_suggestion jsonb,  -- v3.4 A22 A06b / A14b
  off_ladder_reason text CHECK (char_length(off_ladder_reason) <= 2000),  -- v3.4 A22
  macro_id uuid REFERENCES admin_macros(id),  -- v3.4 A22 A14d "Used 42 times"
  reverses_action_id uuid REFERENCES moderation_actions(id),  -- v3.4 A22 A16b overturn
  approval_id uuid REFERENCES admin_approvals(id)  -- v3.4 A22
);
CREATE INDEX idx_mod_actions_user ON moderation_actions (target_user_id, created_at DESC);
CREATE TRIGGER trg_mod_actions_immutable BEFORE UPDATE OR DELETE ON moderation_actions FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
COMMENT ON TABLE moderation_actions IS 'Append-only ledger of every sanction and decision (system rules engine or a moderator). Retention 7 years. PII: personal.';

CREATE TABLE account_restrictions (
  id             uuid PRIMARY KEY DEFAULT uuid_v7(),
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind           restriction_kind_t NOT NULL,
  scope          text[] NOT NULL DEFAULT '{new_conversations,direct_specs,group_posts,discovery,spotlight}',
  source         text NOT NULL CHECK (source IN ('rules_engine','moderator','money_reports','chargeback')),
  reason_code    text NOT NULL,
  member_message_key text,
  action_id      uuid REFERENCES moderation_actions(id) ON DELETE SET NULL,
  starts_at      timestamptz NOT NULL DEFAULT now(),
  ends_at        timestamptz,
  lifted_at      timestamptz,
  lifted_by      uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  paid_days_credited smallint NOT NULL DEFAULT 0 CHECK (paid_days_credited >= 0),
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (kind <> 'suspended' OR ends_at IS NOT NULL OR reason_code LIKE 'permanent%'),
  CHECK (kind <> 'banned' OR ends_at IS NULL),
  CHECK (ends_at IS NULL OR ends_at > starts_at),
  CONSTRAINT ck_restr_scope CHECK (scope <@ ARRAY['new_conversations','direct_specs','group_posts','discovery','spotlight']::text[] AND cardinality(scope) >= 1)  -- v3.4 A39 A11b
);
CREATE UNIQUE INDEX uq_restriction_live ON account_restrictions (user_id, kind) WHERE lifted_at IS NULL;
CREATE INDEX idx_restrictions_ending ON account_restrictions (ends_at) WHERE lifted_at IS NULL AND ends_at IS NOT NULL;
COMMENT ON TABLE account_restrictions IS 'AS1 restricted (403 restricted on new conversations, Direct Specs, group posts; excluded from discovery and Spotlight; replies in existing chats still work), H6 suspended (temporary 7/30 days or permanent; paid plan paused, no charge) and banned. When cleared, paid days lost are credited back. PII: personal.';

CREATE TABLE appeals (
  id             uuid PRIMARY KEY DEFAULT uuid_v7(),
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  restriction_id uuid UNIQUE REFERENCES account_restrictions(id) ON DELETE CASCADE,   -- v3.4 A19 NULL when the appeal is against a warning (moderation_action_id)
  text           text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 1500),
  status         appeal_status_t NOT NULL DEFAULT 'submitted',
  case_id        uuid REFERENCES moderation_cases(id) ON DELETE SET NULL,
  decided_by     uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  decided_at     timestamptz,
  decision_note  text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  public_ref text NOT NULL UNIQUE DEFAULT ('A-' || nextval('appeal_ref_seq')),  -- v3.4 A16 A-nnn
  member_message_key text,  -- v3.4 A17 A16b
  claimed_at timestamptz,  -- v3.4 A17
  moderation_action_id uuid UNIQUE REFERENCES moderation_actions(id),  -- v3.4 A19 appeal of a warning
  CONSTRAINT ck_appeal_target CHECK ((restriction_id IS NULL) <> (moderation_action_id IS NULL)),  -- v3.4 A19
  CONSTRAINT ck_appeal_decision CHECK (status NOT IN ('upheld','overturned') OR (member_message_key IS NOT NULL AND decision_note IS NOT NULL))  -- v3.4 A17
);
COMMENT ON TABLE appeals IS 'AS1 "Tell us your side" (<= 600 chars in UI) and H6 appeal (<= 1500). One appeal per decision (UNIQUE restriction_id). PII: personal.';

CREATE TABLE account_deletions (
  id             uuid PRIMARY KEY DEFAULT uuid_v7(),
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reasons        text[] NOT NULL DEFAULT '{}' CHECK (reasons <@ ARRAY['cost','met','few','break','unsafe','other','duplicate']::text[]),  -- v3.4 A30 admin duplicate erasure
  reason_note    text CHECK (char_length(reason_note) <= 500),
  story_opt_in   boolean NOT NULL DEFAULT false,
  reauth_method  text CHECK (reauth_method IN ('password','google','apple')),   -- v3.4 A30 NULL for admin-initiated erasure (source <> member)
  status         deletion_status_t NOT NULL DEFAULT 'scheduled',
  requested_at   timestamptz NOT NULL DEFAULT now(),
  scheduled_for  timestamptz NOT NULL,
  reminder_sent_at timestamptz,
  cancelled_at   timestamptz,
  executed_at    timestamptz,
  store_cancel_warned boolean NOT NULL DEFAULT false,
  web_billing_cancelled_at timestamptz,   -- v3.3 renamed from stripe_cancelled_at: web provider (Flutterwave) subscription cancelled
  keep_face_fingerprint boolean NOT NULL DEFAULT false,
  CHECK (scheduled_for = requested_at + interval '14 days'),
  source text NOT NULL DEFAULT 'member' CHECK (source IN ('member','admin_duplicate','admin_erase','privacy_request')),  -- v3.4 A30 A11d / A10e
  requested_by_admin uuid REFERENCES admin_users(id) ON DELETE SET NULL,  -- v3.4 A30
  approval_id uuid REFERENCES admin_approvals(id) ON DELETE SET NULL,  -- v3.4 A30
  CONSTRAINT ck_deletion_source CHECK ((source = 'member') = (reauth_method IS NOT NULL))  -- v3.4 A30
);
CREATE UNIQUE INDEX uq_deletion_scheduled ON account_deletions (user_id) WHERE status = 'scheduled';
CREATE INDEX idx_deletion_due ON account_deletions (scheduled_for) WHERE status = 'scheduled';
COMMENT ON TABLE account_deletions IS 'AS2-AS5: re-authenticate, then DELETION_PENDING hides the profile, revokes sessions, emails an undo link (N20) and a day-7 reminder; the erasure job runs on day 14. Keep (AS5) cancels. Payment records kept 7 years (tax). Store subscriptions cannot be cancelled by us (warned); web (Flutterwave) subscriptions are cancelled automatically (web_billing_cancelled_at). The row itself is kept pseudonymised as proof of erasure. PII: personal until executed.';

CREATE TABLE abuse_rules (
  id          uuid PRIMARY KEY DEFAULT uuid_v7(),
  key         text NOT NULL UNIQUE,
  kind        rule_kind_t NOT NULL,
  pattern     text,
  applies_to  text[] NOT NULL CHECK (applies_to <@ ARRAY['nickname','first_name','bio','job_title','message_early','message','group_name','group_rule','dm_note','prompt_text','status_note','report','email']::text[]),  -- v3.4 A33 report velocity, M46 email
  action      rule_action_t NOT NULL,
  threshold   jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active   boolean NOT NULL DEFAULT true,
  version     integer NOT NULL DEFAULT 1,
  created_by  uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (kind NOT IN ('keyword','regex') OR pattern IS NOT NULL),
  name text NOT NULL DEFAULT '' CHECK (char_length(name) <= 80),  -- v3.4 A31 A17a
  locales app_locale[] NOT NULL DEFAULT '{}',  -- v3.4 A32 A17a (empty = all)
  CONSTRAINT ck_abuse_rules_key CHECK (key ~ '^[a-z0-9_.]{3,80}$')  -- v3.4 A51 A17b
);
CREATE TRIGGER trg_abuse_rules_upd BEFORE UPDATE ON abuse_rules FOR EACH ROW EXECUTE FUNCTION set_updated_at();
COMMENT ON TABLE abuse_rules IS 'Keyword / regex / velocity / classifier rules: contact details in nickname, bio, job title (blocked inline), money words in early chats (ES6 block), cross-border scam phrases (warn receiver), report velocity (auto restrict). Same rules run client-side for instant feedback. Citus: reference. PII: none.';

CREATE TABLE abuse_rule_hits (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  rule_id     uuid NOT NULL REFERENCES abuse_rules(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  surface     text NOT NULL,
  subject_ref uuid,
  action_taken rule_action_t NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rule_hits_user ON abuse_rule_hits (user_id, created_at DESC);
CREATE INDEX idx_rule_hits_brin ON abuse_rule_hits USING brin (created_at);
COMMENT ON TABLE abuse_rule_hits IS 'Every rule hit (no matched text stored). Feeds velocity rules and the admin abuse dashboard. Retention 12 months. PII: personal.';

CREATE TABLE risk_devices (
  fingerprint_hash sha256_hash PRIMARY KEY,
  risk_score    numeric(5,4) NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 1),
  linked_users  integer NOT NULL DEFAULT 0,
  banned_at     timestamptz,
  ban_reason    text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  risk_reasons text[] NOT NULL DEFAULT '{}',  -- v3.4 A52 A17d
  banned_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,  -- v3.4 A52
  ban_approval_id uuid REFERENCES admin_approvals(id) ON DELETE SET NULL  -- v3.4 A52
);
COMMENT ON TABLE risk_devices IS 'Device reputation across accounts (device bans, multi-account farms). PII: personal (hashed).';

CREATE TABLE risk_ips (
  ip          inet PRIMARY KEY,
  asn         integer,
  is_vpn      boolean,
  is_hosting  boolean,
  risk_score  numeric(5,4) NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 1),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  as_org text,  -- v3.4 A52
  country iso_country  -- v3.4 A52
);
COMMENT ON TABLE risk_ips IS 'IP reputation cache (VPN / hosting ranges, abuse). Retention 90 days. PII: personal.';

CREATE TABLE identity_links (
  id             uuid PRIMARY KEY DEFAULT uuid_v7(),
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  linked_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  link_type      text NOT NULL CHECK (link_type IN ('device','phone','face','payment','ip')),
  confidence     numeric(5,4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (user_id < linked_user_id),
  UNIQUE (user_id, linked_user_id, link_type),
  review_status text NOT NULL DEFAULT 'unreviewed' CHECK (review_status IN ('unreviewed','confirmed','not_duplicate')),  -- v3.4 A29 A11d
  reviewed_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,  -- v3.4 A29
  reviewed_at timestamptz  -- v3.4 A29
);
COMMENT ON TABLE identity_links IS 'Related-account graph for trust and safety ("link related accounts": device, phone, face matches). PII: personal.';

CREATE TABLE trust_signals (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  signal     text NOT NULL CHECK (signal IN ('no_show','didnt_feel_right','money_report','scam_report','carrier_clear','sim_swap','verified','long_tenure','blocked_by_many')),
  weight     real NOT NULL,
  source_ref uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_trust_signals_user ON trust_signals (user_id, created_at DESC);
COMMENT ON TABLE trust_signals IS 'Inputs to the internal trust score (EV6 no-show / did not feel right, money-related reports, carrier results). Never shown to members. Retention 24 months. PII: personal.';

-- v3.1 C.1-7 Forced re-verification (AD-13): a new badge application at
-- face_check with no charge. RLS: the member sees their own open request.
CREATE TABLE reverification_requests (
  id                   uuid PRIMARY KEY DEFAULT uuid_v7(),
  user_id              uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_by         uuid NOT NULL REFERENCES admin_users(id),
  reason_code          text NOT NULL CHECK (reason_code ~ '^[a-z_]{3,40}$'),
  note                 text CHECK (char_length(note) <= 1000),
  case_id              uuid REFERENCES moderation_cases(id) ON DELETE SET NULL,
  badge_application_id uuid REFERENCES badge_applications(id) ON DELETE SET NULL,
  status               text NOT NULL DEFAULT 'open' CHECK (status IN ('open','completed','cancelled')),
  due_at               timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  completed_at         timestamptz,
  cancelled_at         timestamptz,
  CHECK (status <> 'completed' OR (completed_at IS NOT NULL AND badge_application_id IS NOT NULL)),
  CHECK (status <> 'cancelled' OR cancelled_at IS NOT NULL)
);
CREATE UNIQUE INDEX uq_reverify_open ON reverification_requests (user_id) WHERE status = 'open';
CREATE INDEX idx_reverify_queue ON reverification_requests (created_at) WHERE status = 'open';
COMMENT ON TABLE reverification_requests IS 'v3.1 A11 "Ask to re-verify" (permission users.reverify, AD-13): one open request per member; the app routes the member to a new badge application at face_check with no charge. Retention 24 months after close. PII: personal. Citus: user_id.';

-- =====================================================================
-- 13. BILLING (RevenueCat for App Store / Google Play, Flutterwave on web; OD-14)
--     One entitlement service is the source of truth. BL screens read
--     entitlements + billing source, never the client.
--     Citus: by user_id.
-- =====================================================================

CREATE TABLE billing_customers (
  id                   uuid PRIMARY KEY DEFAULT uuid_v7(),
  user_id              uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  provider             payment_provider_t NOT NULL,
  provider_customer_id text NOT NULL,
  revenuecat_app_user_id text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_customer_id),
  UNIQUE (user_id, provider)
);
COMMENT ON TABLE billing_customers IS 'Web provider (Flutterwave, OD-14) customer reference and RevenueCat app user ids per member. ON DELETE RESTRICT: billing identity is pseudonymised, not deleted, at erasure (7-year tax retention). PII: personal.';

CREATE TABLE subscriptions (
  id                     uuid PRIMARY KEY DEFAULT uuid_v7(),
  user_id                uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  plan_code              plan_t NOT NULL REFERENCES plans(code) CHECK (plan_code <> 'free'),
  price_id               uuid NOT NULL REFERENCES prices(id),
  provider               payment_provider_t NOT NULL,
  provider_subscription_id text NOT NULL,
  original_transaction_id text,
  environment            text NOT NULL DEFAULT 'production' CHECK (environment IN ('production','sandbox')),
  status                 subscription_status_t NOT NULL,
  current_period_start   timestamptz NOT NULL,
  current_period_end     timestamptz NOT NULL,
  trial_start            timestamptz,
  trial_end              timestamptz,
  cancel_at_period_end   boolean NOT NULL DEFAULT false,
  cancelled_at           timestamptz,
  cancel_reason          text CHECK (cancel_reason IN ('cost','met','few','break','unsafe','other','billing_error','deletion')),
  grace_ends_at          timestamptz,
  scheduled_plan_code    plan_t REFERENCES plans(code),
  scheduled_change_at    timestamptz,
  paused_at              timestamptz,
  paused_reason          text CHECK (paused_reason IN ('suspension','store_pause')),
  lapsed_at              timestamptz,
  latest_event_at        timestamptz NOT NULL DEFAULT now(),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_subscription_id),
  CHECK (current_period_end > current_period_start),
  CHECK (status <> 'grace' OR grace_ends_at IS NOT NULL),
  CHECK (status <> 'trialing' OR trial_end IS NOT NULL),
  CHECK ((scheduled_plan_code IS NULL) = (scheduled_change_at IS NULL)),
  cancel_reasons text[] NOT NULL DEFAULT '{}' CHECK (cancel_reasons <@ ARRAY['cost','met','few','break','unsafe','other','billing_error','deletion']::text[])  -- v3.4 M13 BL3 multi-select
);
CREATE TRIGGER trg_subs_upd BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE UNIQUE INDEX uq_subs_one_live ON subscriptions (user_id) WHERE status IN ('trialing','active','grace','on_hold','cancelled','paused');   -- v3.4 B70 a held store subscription can resume, so it still counts as live (no double billing)
CREATE INDEX idx_subs_period_end ON subscriptions (current_period_end) WHERE status IN ('active','cancelled','trialing');
CREATE INDEX idx_subs_grace ON subscriptions (grace_ends_at) WHERE status = 'grace';
COMMENT ON TABLE subscriptions IS 'Premium / Gold subscriptions per provider (BL1). billedVia = provider decides every action: store plans are changed/cancelled/refunded in the store (deep links), web (Flutterwave) plans in-app via the Flutterwave API (OD-14). Downgrade and cancel apply at period end. Grace: 7 days full access, reminders day 1/4/6, day 8 -> lapsed and role recomputed (BL5, BL6). One live subscription per member. Black Badge is NOT a subscription. PII: personal.';

CREATE TABLE subscription_events (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  subscription_id uuid NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  event           subscription_event_t NOT NULL,
  from_plan       plan_t,
  to_plan         plan_t,
  occurred_at     timestamptz NOT NULL,
  webhook_event_id uuid,
  details         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sub_events_sub ON subscription_events (subscription_id, occurred_at DESC);
COMMENT ON TABLE subscription_events IS 'Normalised lifecycle history (App Store Server Notifications v2 and Play RTDN via RevenueCat, Flutterwave webhooks). Drives BL1 banners (ending, grace, trial, switching) and BL4. Retention 7 years. PII: none.';

CREATE TABLE trials (
  id                uuid PRIMARY KEY DEFAULT uuid_v7(),
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  identity_key_hash sha256_hash NOT NULL,
  plan_code         plan_t NOT NULL DEFAULT 'premium' CHECK (plan_code = 'premium'),
  provider          payment_provider_t NOT NULL,
  subscription_id   uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  started_at        timestamptz NOT NULL DEFAULT now(),
  ends_at           timestamptz NOT NULL,
  reminder_sent_at  timestamptz,
  converted_at      timestamptz,
  cancelled_at      timestamptz,
  CONSTRAINT ck_trials_length CHECK (ends_at > started_at AND ends_at <= started_at + interval '30 days'),  -- v3.4 B23 length from billing.trial_days / prices.trial_days (0-30)
  UNIQUE (identity_key_hash, plan_code)
);
CREATE INDEX idx_trials_reminder ON trials (ends_at) WHERE reminder_sent_at IS NULL AND cancelled_at IS NULL AND converted_at IS NULL;
COMMENT ON TABLE trials IS 'BL7 3-day Premium trial, once per person: keyed on the verified identity (hash of face-template / phone), not the account. N16 reminder must go out 24 h before the charge (store rule). PII: personal.';

CREATE TABLE transactions (
  id                    uuid PRIMARY KEY DEFAULT uuid_v7(),
  user_id               uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  subscription_id       uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  product_id            smallint NOT NULL REFERENCES products(id),
  price_id              uuid NOT NULL REFERENCES prices(id),
  provider              payment_provider_t NOT NULL,
  provider_transaction_id text NOT NULL,
  idempotency_key       text NOT NULL UNIQUE,
  kind                  transaction_kind_t NOT NULL,
  status                transaction_status_t NOT NULL,
  amount_usd_cents      usd_cents NOT NULL,
  proration_credit_usd_cents usd_cents NOT NULL DEFAULT 0,
  tax_usd_cents         usd_cents NOT NULL DEFAULT 0,
  charged_amount_minor  bigint,
  charged_currency      text CHECK (charged_currency ~ '^[A-Z]{3,5}$'),
  settlement_asset      text NOT NULL DEFAULT 'USD' CHECK (settlement_asset IN ('USD','USDC')),
  crypto_network        text CHECK (crypto_network IN ('base','polygon','solana','ethereum')),
  payment_method        pay_method_t NOT NULL,
  card_brand            text,
  card_last4            text CHECK (card_last4 ~ '^[0-9]{4}$'),
  three_ds_required     boolean NOT NULL DEFAULT false,
  failure_code          text,
  fee_usd_cents         usd_cents,          -- v3.1 store / web provider (Flutterwave) fee once imported (AD-17); NULL = not yet known
  occurred_at           timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_transaction_id),
  CHECK ((settlement_asset = 'USD') = (crypto_network IS NULL)),
  CHECK (provider IN ('flutterwave','stripe') OR payment_method = 'store'),  -- v3.3: web provider = flutterwave ('stripe' legacy)
  environment text NOT NULL DEFAULT 'production' CHECK (environment IN ('production','sandbox')),  -- v3.4 B3 A19 / A23
  terms_document_id uuid REFERENCES legal_documents(id),  -- v3.4 B10 A20e evidence
  refund_policy_document_id uuid REFERENCES legal_documents(id),  -- v3.4 B10
  three_ds_result text CHECK (three_ds_result IN ('passed','failed','not_asked','exempt')),  -- v3.4 B68
  device_id uuid REFERENCES devices(id) ON DELETE SET NULL,  -- v3.4 B69
  ip_country iso_country  -- v3.4 B69
);
CREATE INDEX idx_tx_user ON transactions (user_id, occurred_at DESC);
CREATE INDEX idx_tx_sub ON transactions (subscription_id, occurred_at DESC);
CREATE INDEX idx_tx_brin ON transactions USING brin (occurred_at);
COMMENT ON TABLE transactions IS 'Money ledger (BL2 history): Black Badge $1.00 (one-off), Premium $2.50, Gold $9.75, upgrades with proration (e.g. $9.75 - $1.67 unused Premium = $8.08 due today), renewals, refunds, chargebacks. All revenue aggregated in US cents; store-shown local currency kept for reference. No card data: brand + last 4 only from the web provider (Flutterwave, OD-14). settlement_asset / crypto_network are legacy (USDC was a Stripe option; Flutterwave settles in fiat). Retention 7 years (tax). PII: personal.';
COMMENT ON COLUMN transactions.amount_usd_cents IS 'Amount actually due/charged after proration credit, in US cents.';

CREATE TABLE invoices (
  id               uuid PRIMARY KEY DEFAULT uuid_v7(),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  transaction_id   uuid NOT NULL UNIQUE REFERENCES transactions(id) ON DELETE RESTRICT,
  number           text NOT NULL UNIQUE CHECK (number ~ '^1MM-[0-9]{4}-R[0-9]{5,}$'),
  seller_name      text NOT NULL DEFAULT '1MINITMAN DATING SERVICES',
  seller_reg_no    text NOT NULL DEFAULT '9997907',
  seller_address   text NOT NULL DEFAULT 'Block 9 Flat G, FHS Zuba, Abuja, FCT',
  line_description text NOT NULL,
  subtotal_usd_cents usd_cents NOT NULL,
  credit_usd_cents usd_cents NOT NULL DEFAULT 0,
  total_usd_cents  usd_cents NOT NULL,
  billed_via       payment_provider_t NOT NULL,
  pdf_storage_key  text,
  provider_invoice_id text,
  issued_at        timestamptz NOT NULL DEFAULT now(),
  CHECK (total_usd_cents = subtotal_usd_cents - credit_usd_cents)
);
CREATE INDEX idx_invoices_user ON invoices (user_id, issued_at DESC);
COMMENT ON TABLE invoices IS 'BL2 receipts ("Download PDF") and N14 email receipt, naming the registered seller (the TIN is never printed). For store purchases the store receipt is the legal record; this is our ledger copy. Retention 7 years. PII: personal.';

CREATE TABLE refunds (
  id                uuid PRIMARY KEY DEFAULT uuid_v7(),
  transaction_id    uuid NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
  amount_usd_cents  usd_cents NOT NULL CHECK (amount_usd_cents > 0),
  reason            refund_reason_t NOT NULL,
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending_approval','pending','processing','succeeded','failed','cancelled')),  -- v3.4 B6 A20 states
  provider_refund_id text,
  initiated_by      actor_kind_t NOT NULL,
  admin_id          uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  approval_id       uuid REFERENCES admin_approvals(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  completed_at      timestamptz,
  UNIQUE (provider_refund_id),
  public_ref text NOT NULL UNIQUE DEFAULT ('RF-' || nextval('refund_ref_seq')),  -- v3.4 B7 RF-nnnn
  failure_message text,  -- v3.4 B6 A20f
  idempotency_key text UNIQUE,  -- v3.4 B6 retry with the same key
  attempts smallint NOT NULL DEFAULT 0 CHECK (attempts >= 0),  -- v3.4 B6
  access_action text CHECK (access_action IN ('keep_until_period_end','revoke_now','not_applicable'))  -- v3.4 B8 A20b
);
CREATE INDEX idx_refunds_tx ON refunds (transaction_id);
COMMENT ON TABLE refunds IS 'Refunds. v3.2 (OD-04 / OD-05): Google Play and web (Flutterwave, OD-14) refunds are issued automatically by us (including the Black Badge refund when not approved, never for fraud); iOS members are guided to Apple (reportaproblem.apple.com) and the Apple refund is mirrored here from the store notification (initiated_by system). Every admin-initiated refund needs a second admin''s approval whatever the amount (billing.refund_approval_threshold_usd_cents = 0; refund_approval_guard()). PII: none.';

CREATE TABLE disputes (
  id                 uuid PRIMARY KEY DEFAULT uuid_v7(),
  transaction_id     uuid NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
  provider_dispute_id text NOT NULL UNIQUE,
  reason             text NOT NULL,
  amount_usd_cents   usd_cents NOT NULL,
  status             dispute_status_t NOT NULL DEFAULT 'needs_response',
  evidence_due_by    timestamptz,
  evidence_submitted_at timestamptz,
  closed_at          timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  fee_usd_cents usd_cents,  -- v3.4 B9 A20e
  decision text CHECK (decision IN ('accepted','declined')),  -- v3.4 B9
  decided_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,  -- v3.4 B9
  decided_at timestamptz,  -- v3.4 B9
  evidence_sections jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(evidence_sections) = 'array'),  -- v3.4 B9
  evidence_pdf_storage_key text,  -- v3.4 B9
  card_network_reason text  -- v3.4 B9
);
CREATE INDEX idx_disputes_open ON disputes (evidence_due_by) WHERE status IN ('needs_response','under_review');
COMMENT ON TABLE disputes IS 'Web provider (Flutterwave) disputes / chargebacks (stores handle their own). A lost dispute can trigger a restriction (source chargeback). PII: none.';

CREATE TABLE entitlement_grants (
  id          uuid PRIMARY KEY DEFAULT uuid_v7(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source      grant_source_t NOT NULL,
  source_id   uuid,
  plan_code   plan_t REFERENCES plans(code),
  grants_verified boolean NOT NULL DEFAULT false,
  starts_at   timestamptz NOT NULL DEFAULT now(),
  ends_at     timestamptz,
  revoked_at  timestamptz,
  revoke_reason text,
  admin_id    uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (source <> 'badge' OR (grants_verified AND plan_code IS NULL AND ends_at IS NULL)),
  CHECK (source = 'badge' OR plan_code IN ('premium','gold')),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX idx_grants_live ON entitlement_grants (user_id, ends_at) WHERE revoked_at IS NULL;
COMMENT ON TABLE entitlement_grants IS 'Derived grants that compute_member_role() reads: badge (permanent verification, never lapses), subscription periods (ends_at = period end or grace end), trial, admin comp, restriction credit days. PII: none.';

CREATE TABLE billing_credits (
  id              uuid PRIMARY KEY DEFAULT uuid_v7(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  days            smallint NOT NULL CHECK (days BETWEEN 1 AND 366),
  reason          text NOT NULL CHECK (reason IN ('restriction_cleared','suspension_overturned','service_issue','goodwill')),
  restriction_id  uuid REFERENCES account_restrictions(id) ON DELETE SET NULL,
  applied_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE billing_credits IS 'Paid days credited back when a restriction is cleared (account-rules AS1). Applied as a web (Flutterwave) billing credit / store promo offer or an admin_comp grant. PII: none.';

CREATE TABLE lapse_choices (
  id              uuid PRIMARY KEY DEFAULT uuid_v7(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  from_plan       plan_t NOT NULL,
  to_role         member_role_t NOT NULL,
  kept_media_ids  uuid[] NOT NULL DEFAULT '{}',
  kept_conversation_ids uuid[] NOT NULL DEFAULT '{}',
  hide_until      timestamptz NOT NULL,
  saved_at        timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (hide_until <= created_at + interval '90 days')
);
COMMENT ON TABLE lapse_choices IS 'BL6 "Choose what stays active": extras above the new limit are hidden for 90 days then deleted; conversations above the limit become read-only; Premium profile data is kept indefinitely and restored on resubscribe. PII: personal.';

CREATE TABLE webhook_events (
  id             uuid PRIMARY KEY DEFAULT uuid_v7(),
  provider       text NOT NULL CHECK (provider IN ('flutterwave','stripe','revenuecat','app_store','google_play','liveness','termii','twilio','whatsapp','resend','daily','carrier')),
  event_id       text NOT NULL,
  event_type     text NOT NULL,
  signature_valid boolean NOT NULL,
  payload        jsonb NOT NULL,
  status         text NOT NULL DEFAULT 'received' CHECK (status IN ('received','processing','processed','failed','ignored')),
  attempts       smallint NOT NULL DEFAULT 0,
  last_error     text,
  received_at    timestamptz NOT NULL DEFAULT now(),
  processed_at   timestamptz,
  UNIQUE (provider, event_id),
  attempt_log jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(attempt_log) = 'array')  -- v3.4 B67 A19g
);
CREATE INDEX idx_webhooks_pending ON webhook_events (received_at) WHERE status IN ('received','failed');
CREATE INDEX idx_webhooks_brin ON webhook_events USING brin (received_at);
COMMENT ON TABLE webhook_events IS 'Every inbound webhook stored once (dedupe on provider + event id), verified by signature and re-fetched from the provider before granting access; replayable from the admin console. Retention: billing 7 years, others 90 days. PII: personal (payload).';
COMMENT ON COLUMN transactions.fee_usd_cents IS 'v3.1 Provider fee (App Store / Google Play commission, Flutterwave fee) imported from payouts / proceeds reports (AD-17). Revenue reports show "before fees" while NULL.';

-- v3.1 C.1-13 Reconciliation runs (A19): ours vs the provider for a range.
CREATE TABLE reconciliation_runs (
  id               uuid PRIMARY KEY DEFAULT uuid_v7(),
  provider         payment_provider_t NOT NULL,
  range_from       timestamptz NOT NULL,
  range_to         timestamptz NOT NULL,
  status           text NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed')),
  matched          integer NOT NULL DEFAULT 0 CHECK (matched >= 0),
  missing_ours     integer NOT NULL DEFAULT 0 CHECK (missing_ours >= 0),
  missing_provider integer NOT NULL DEFAULT 0 CHECK (missing_provider >= 0),
  amount_mismatch  integer NOT NULL DEFAULT 0 CHECK (amount_mismatch >= 0),
  status_mismatch  integer NOT NULL DEFAULT 0 CHECK (status_mismatch >= 0),
  items            jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(items) = 'array'),
  error            text,
  run_by           uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  started_at       timestamptz NOT NULL DEFAULT now(),
  finished_at      timestamptz,
  CHECK (range_to > range_from),
  CHECK (status = 'running' OR finished_at IS NOT NULL)
);
CREATE INDEX idx_recon_runs ON reconciliation_runs (provider, started_at DESC);
COMMENT ON TABLE reconciliation_runs IS 'v3.1 A19 reconciliation: job billing.reconcile (daily) or an admin run (run_by) compares transactions with the provider for a range; items lists each mismatch {kind, provider_transaction_id, ours, theirs}. Retention 7 years (finance). PII: none (ids).';

-- v3.1 C.1-14 Provider payouts (AD-17).
CREATE TABLE payouts (
  id                 uuid PRIMARY KEY DEFAULT uuid_v7(),
  provider           payment_provider_t NOT NULL,
  provider_payout_id text NOT NULL,
  amount_usd_cents   usd_cents NOT NULL,
  fees_usd_cents     usd_cents,
  currency           text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  amount_minor       bigint,
  period_from        date NOT NULL,
  period_to          date NOT NULL,
  arrival_date       date,
  status             text NOT NULL CHECK (status IN ('pending','in_transit','paid','failed','cancelled')),
  source_file        text,
  imported_by        uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  imported_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_payout_id),
  CHECK (period_to >= period_from)
);
CREATE INDEX idx_payouts_period ON payouts (provider, period_from DESC);
COMMENT ON TABLE payouts IS 'v3.1 A23 net revenue: Flutterwave settlements (payouts) and App Store / Google Play proceeds imported from reports (AD-17). Retention 7 years (finance). PII: none.';

-- =====================================================================
-- 14. NOTIFICATIONS
-- =====================================================================

CREATE TABLE push_tokens (
  id            uuid PRIMARY KEY DEFAULT uuid_v7(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id     uuid REFERENCES devices(id) ON DELETE CASCADE,
  provider      text NOT NULL DEFAULT 'expo' CHECK (provider IN ('expo','apns','fcm')),
  token         text NOT NULL UNIQUE,
  platform      platform_t NOT NULL,
  os_permission text NOT NULL DEFAULT 'granted' CHECK (os_permission IN ('granted','denied','provisional')),
  is_active     boolean NOT NULL DEFAULT true,
  last_success_at timestamptz,
  invalidated_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_push_tokens_user ON push_tokens (user_id) WHERE is_active;
COMMENT ON TABLE push_tokens IS 'Expo push tokens (APNs + FCM). Permission is asked in context at the first match (D5 "Get notified when Zara replies" -> C7), not during sign-up. NT1 shows "Off in phone settings". PII: personal.';

CREATE TABLE notification_preferences (
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_key text NOT NULL REFERENCES notification_categories(key),
  channel      notif_channel_t NOT NULL,
  enabled      boolean NOT NULL,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, category_key, channel)
);
COMMENT ON TABLE notification_preferences IS 'NT1 category x channel switches. Missing row = category default. Billing and Security & safety cannot be turned off (enforced in API). "Tips and offers" also needs a marketing consent record. PII: none.';

CREATE TABLE notifications (
  id            uuid PRIMARY KEY DEFAULT uuid_v7(),
  user_id       uuid REFERENCES users(id) ON DELETE CASCADE,                -- v3.4 W3 NULL for a non-member recipient (recipient_kind)
  template_code text REFERENCES notification_templates(code),                -- v3.4 B4 NULL for a content broadcast (broadcast_id)
  channel       notif_channel_t NOT NULL,
  locale        app_locale NOT NULL,
  params        jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key    text,
  collapse_key  text,
  status        delivery_status_t NOT NULL DEFAULT 'queued',
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  silent        boolean NOT NULL DEFAULT false,
  provider      text,
  provider_msg_id text,
  attempts      smallint NOT NULL DEFAULT 0,
  error         text,
  sent_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  recipient_kind text NOT NULL DEFAULT 'member' CHECK (recipient_kind IN ('member','waitlist','newsletter','contact','applicant','story_partner','investor_contact')),  -- v3.4 W3 / B5
  recipient_enc bytea,  -- v3.4 W3
  recipient_hash sha256_hash,  -- v3.4 W3
  recipient_ref_id uuid,  -- v3.4 W3 / B5 source row
  broadcast_id uuid,  -- v3.4 B4 A26
  CONSTRAINT ck_notifications_recipient CHECK ((recipient_kind = 'member') = (user_id IS NOT NULL) AND (user_id IS NOT NULL OR (recipient_enc IS NOT NULL AND recipient_hash IS NOT NULL AND channel IN ('email','sms','whatsapp')))),  -- v3.4 W3
  CONSTRAINT ck_notifications_source CHECK (template_code IS NOT NULL OR broadcast_id IS NOT NULL)  -- v3.4 B4
);
CREATE UNIQUE INDEX uq_notifications_dedupe ON notifications (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX idx_notifications_due ON notifications (scheduled_for) WHERE status IN ('queued','batched','throttled');
CREATE INDEX idx_notifications_brin ON notifications USING brin (created_at);
COMMENT ON TABLE notifications IS 'Outbox + delivery log for push / email (Resend) / SMS / WhatsApp. Written in the same transaction as the change that causes it (outbox pattern). Throttles: likes batched max 1 an hour, messages collapsed per thread (collapse_key), Basic daily reset max once a day at 18:00 local. Quiet hours deliver silently except security alerts. Retention 90 days. PII: personal.';

CREATE TABLE inbox_items (
  id            uuid PRIMARY KEY DEFAULT uuid_v7(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_code text NOT NULL REFERENCES notification_templates(code),
  params        jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  deep_link     text NOT NULL,
  group_key     text,
  read_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_inbox_user ON inbox_items (user_id, created_at DESC);
CREATE INDEX idx_inbox_unread ON inbox_items (user_id) WHERE read_at IS NULL;
COMMENT ON TABLE inbox_items IS 'D16 Activity inbox (TODAY / EARLIER, "Mark all read"). A row for every push; rendered client-side from the template i18n keys + params. Retention 180 days. PII: personal.';

CREATE TABLE email_suppressions (
  email      citext PRIMARY KEY,
  reason     text NOT NULL CHECK (reason IN ('hard_bounce','complaint','unsubscribe_marketing','manual')),
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE email_suppressions IS 'Resend bounce / complaint suppression list. Transactional mail still goes to unsubscribe_marketing addresses. PII: personal.';

-- v3.1 C.1-8 Broadcasts (A26; permission notifications.broadcast needs approval).
CREATE TABLE broadcast_campaigns (
  id            uuid PRIMARY KEY DEFAULT uuid_v7(),
  name          text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  category_key  text NOT NULL REFERENCES notification_categories(key),
  channels      notif_channel_t[] NOT NULL CHECK (cardinality(channels) >= 1),
  audience      jsonb NOT NULL CHECK (jsonb_typeof(audience) = 'object'),
  template_code text REFERENCES notification_templates(code),
  content       jsonb CHECK (content IS NULL OR jsonb_typeof(content) = 'object'),
  deep_link     text,
  scheduled_for timestamptz,
  status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_approval','scheduled','sending','sent','cancelled')),
  approval_id   uuid REFERENCES admin_approvals(id) ON DELETE SET NULL,
  estimate      jsonb,
  stats         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by    uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  sent_at       timestamptz,
  cancelled_at  timestamptz,
  CHECK ((template_code IS NULL) <> (content IS NULL)),
  CHECK (status NOT IN ('scheduled','sending','sent') OR approval_id IS NOT NULL),
  CHECK (status <> 'scheduled' OR scheduled_for IS NOT NULL),
  CHECK (status <> 'sent' OR sent_at IS NOT NULL)
);
CREATE TRIGGER trg_broadcast_upd BEFORE UPDATE ON broadcast_campaigns FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_broadcast_due ON broadcast_campaigns (scheduled_for) WHERE status = 'scheduled';
CREATE INDEX idx_broadcast_list ON broadcast_campaigns (status, created_at DESC);
COMMENT ON TABLE broadcast_campaigns IS 'v3.1 A26 broadcasts: audience filter (country, city, role, plan, locale, last active), channels, a template or channel x locale content, schedule, four-eyes approval (no send without approval_id), estimate and delivery stats. Each recipient gets a notifications row (dedupe_key = broadcast id); frequency cap remote_config notifications.broadcast_max_per_day (AD-38). Retention 2 years. PII: none.';

-- v3.1 C.1-9 In-app announcements (home banner / inbox card).
CREATE TABLE in_app_announcements (
  id            uuid PRIMARY KEY DEFAULT uuid_v7(),
  title_key     text NOT NULL,
  body_key      text NOT NULL,
  cta_label_key text,
  cta_deep_link text,
  placement     text[] NOT NULL CONSTRAINT ck_announce_placement CHECK (cardinality(placement) >= 1 AND placement <@ ARRAY['home_banner','inbox']::text[]),  -- v3.4 B31 A26d one or both
  audience      jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(audience) = 'object'),
  starts_at     timestamptz NOT NULL,
  ends_at       timestamptz,
  dismissible   boolean NOT NULL DEFAULT true,
  priority      smallint NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  status        content_status_t NOT NULL DEFAULT 'draft',
  approval_id   uuid REFERENCES admin_approvals(id) ON DELETE SET NULL,
  created_by    uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at > starts_at),
  CHECK ((cta_label_key IS NULL) = (cta_deep_link IS NULL)),
  CHECK (status <> 'published' OR audience <> '{}'::jsonb OR approval_id IS NOT NULL)
);
CREATE TRIGGER trg_announce_upd BEFORE UPDATE ON in_app_announcements FOR EACH ROW EXECUTE FUNCTION set_updated_at();
COMMENT ON TABLE in_app_announcements IS 'v3.1 A26 announcements served with GET /v1/config: placement, audience, window, dismissible, priority. An all-member audience ({} = everyone) needs an approval (announcements.manage, Appendix A). Text is i18n keys. Retention 2 years. PII: none.';

-- =====================================================================
-- 15. SUPPORT AND FEEDBACK (H1, H1A, H1B)
-- =====================================================================

CREATE SEQUENCE support_ticket_ref_seq START 10000;
CREATE TABLE support_tickets (
  id               uuid PRIMARY KEY DEFAULT uuid_v7(),
  public_ref       text NOT NULL UNIQUE DEFAULT ('S-' || nextval('support_ticket_ref_seq')),
  user_id          uuid REFERENCES users(id) ON DELETE SET NULL,
  contact_email    citext,
  channel          ticket_channel_t NOT NULL,
  topic_key        text,
  help_article_id  uuid REFERENCES help_articles(id) ON DELETE SET NULL,
  subject          text CHECK (char_length(subject) <= 140),
  status           ticket_status_t NOT NULL DEFAULT 'open',
  priority         smallint NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  assigned_admin_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  first_response_at timestamptz,
  solved_at        timestamptz,
  csat             smallint CHECK (csat BETWEEN 1 AND 5),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR contact_email IS NOT NULL),
  merged_into_id uuid REFERENCES support_tickets(id) ON DELETE SET NULL,  -- v3.4 B34 A27b
  reply_due_at timestamptz,  -- v3.4 B35 A27a
  CONSTRAINT tickets_no_self_merge CHECK (merged_into_id IS NULL OR merged_into_id <> id)  -- v3.4 B34
);
CREATE TRIGGER trg_tickets_upd BEFORE UPDATE ON support_tickets FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_tickets_queue ON support_tickets (priority DESC, created_at) WHERE status IN ('open','pending_agent');
CREATE INDEX idx_tickets_user ON support_tickets (user_id, created_at DESC);
COMMENT ON TABLE support_tickets IS 'H1B "Chat with us" threads (replies in about 2 h), email to help@1minitman.com (inbound), web contact form, H1A "No, not helpful" -> chat. Retention 24 months after close. PII: personal.';

CREATE TABLE support_messages (
  id            uuid PRIMARY KEY DEFAULT uuid_v7(),
  ticket_id     uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_kind   author_kind_t NOT NULL,
  author_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  author_admin_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  body          text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  quick_topic   text,
  attachment_media_ids uuid[] NOT NULL DEFAULT '{}',
  is_internal_note boolean NOT NULL DEFAULT false,
  member_notified_at timestamptz,
  read_by_member_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (author_kind <> 'agent' OR author_admin_id IS NOT NULL),
  CHECK (NOT is_internal_note OR author_kind = 'agent')
);
CREATE INDEX idx_support_msgs_ticket ON support_messages (ticket_id, created_at);
COMMENT ON TABLE support_messages IS 'Messages in a support thread (H1B: quick topics, message box, "Sent, we''ll notify you"). Agents appear by admin_users.display_name. Internal notes never reach the member. PII: personal.';

CREATE TABLE help_article_votes (
  id             uuid PRIMARY KEY DEFAULT uuid_v7(),
  article_id     uuid NOT NULL REFERENCES help_articles(id) ON DELETE CASCADE,
  user_id        uuid REFERENCES users(id) ON DELETE SET NULL,
  anon_device_hash sha256_hash,
  helpful        boolean NOT NULL,
  opened_chat    boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR anon_device_hash IS NOT NULL)
);
CREATE UNIQUE INDEX uq_help_vote_user ON help_article_votes (article_id, user_id) WHERE user_id IS NOT NULL;
COMMENT ON TABLE help_article_votes IS 'H1A "Was this helpful?" yes/no (no -> H1B chat). PII: none.';

CREATE TABLE feedback (
  id          uuid PRIMARY KEY DEFAULT uuid_v7(),
  user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  rating      smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text        text CHECK (char_length(text) <= 500),
  screen_code text,
  platform    platform_t,
  app_version text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_feedback_brin ON feedback USING brin (created_at);
COMMENT ON TABLE feedback IS 'H1 "Send feedback" rating 1-5 + optional text (<= 500). PII: personal (free text).';

-- =====================================================================
-- 16. LEGAL, CONSENT AND PRIVACY (NDPA 2023 / GDPR)
-- =====================================================================

CREATE TABLE consent_records (
  id          uuid PRIMARY KEY DEFAULT uuid_v7(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        consent_kind_t NOT NULL,
  action      consent_action_t NOT NULL,
  document_id uuid REFERENCES legal_documents(id),
  version     text NOT NULL,
  screen_code text NOT NULL,
  text_hash   sha256_hash,
  ip          inet,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_consents_user ON consent_records (user_id, kind, created_at DESC);
CREATE TRIGGER trg_consents_immutable BEFORE UPDATE OR DELETE ON consent_records FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
COMMENT ON TABLE consent_records IS 'Append-only consent log (LG6 "consent history"): C5 Terms/Privacy/Guidelines (version + time), B3 biometric consent (separate, explicit), P3 genotype and faith, marketing, research, location, push, analytics, trusted-contact third-party consent. Withdrawal is a new row. Kept for the life of the account + 6 years as accountability evidence (NDPA). PII: personal.';

CREATE TABLE data_export_requests (
  id            uuid PRIMARY KEY DEFAULT uuid_v7(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status        export_status_t NOT NULL DEFAULT 'requested',
  requested_on  date NOT NULL DEFAULT CURRENT_DATE,
  requested_at  timestamptz NOT NULL DEFAULT now(),
  ready_at      timestamptz,
  storage_key   text,
  bytes         bigint,
  link_expires_at timestamptz,
  downloaded_at timestamptz,
  error         text,
  UNIQUE (user_id, requested_on),
  CHECK (status <> 'ready' OR (storage_key IS NOT NULL AND link_expires_at <= ready_at + interval '7 days')),
  privacy_request_id uuid  -- v3.4 B44 A36c
);
COMMENT ON TABLE data_export_requests IS 'LG6 / H6 "Download my data": async ZIP (profile, photos, messages, matches, payments), link emailed valid 7 days, once a day (UNIQUE user, day). PII: personal.';

CREATE TABLE privacy_requests (
  id           uuid PRIMARY KEY DEFAULT uuid_v7(),
  user_id      uuid REFERENCES users(id) ON DELETE SET NULL,
  contact_email citext,
  kind         privacy_request_t NOT NULL,
  field        text,
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','completed','rejected')),
  due_at       timestamptz NOT NULL,
  completed_at timestamptz,
  handled_by   uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  public_ref text NOT NULL UNIQUE DEFAULT ('PR-' || nextval('privacy_request_ref_seq')),  -- v3.4 B44 PR-nnnn
  source text NOT NULL DEFAULT 'app' CHECK (source IN ('app','web_form','email','admin')),  -- v3.4 B44
  contact_submission_id uuid,  -- v3.4 B44
  identity_verified_at timestamptz,  -- v3.4 B44
  rejection_reason text,  -- v3.4 B44
  evidence_media_ids uuid[] NOT NULL DEFAULT '{}'  -- v3.4 B48 A36b
);
CREATE INDEX idx_privacy_due ON privacy_requests (due_at) WHERE status IN ('open','in_progress');
COMMENT ON TABLE privacy_requests IS 'Data-subject request register for the DPO: sensitive-field erasure from LG6 switches (within 30 days), access, rectification, objection, web data-request form. PII: personal.';

-- v3.1 C.1-12 Legal holds (A36). erasure.run and every retention purge
-- skip rows covered by a live hold (has_legal_hold()).
CREATE TABLE legal_holds (
  id           uuid PRIMARY KEY DEFAULT uuid_v7(),
  scope_kind   text NOT NULL CHECK (scope_kind IN ('user','report','conversation')),
  scope_id     uuid NOT NULL,
  reason       text NOT NULL CHECK (char_length(reason) BETWEEN 5 AND 2000),
  reference    text,
  requested_by uuid NOT NULL REFERENCES admin_users(id),
  approval_id  uuid REFERENCES admin_approvals(id) ON DELETE SET NULL,
  placed_at    timestamptz NOT NULL DEFAULT now(),
  review_at    timestamptz NOT NULL,
  released_at  timestamptz,
  released_by  uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  release_note text,
  CHECK (review_at > placed_at),
  CHECK ((released_at IS NULL) = (released_by IS NULL)),
  public_ref text NOT NULL UNIQUE DEFAULT ('LH-' || lpad(nextval('legal_hold_ref_seq')::text, 3, '0')),  -- v3.4 B44 LH-nnn
  status text NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval','live','rejected','released'))  -- v3.4 B46 A36h
);
CREATE UNIQUE INDEX uq_legal_hold_live ON legal_holds (scope_kind, scope_id) WHERE released_at IS NULL;
CREATE INDEX idx_legal_hold_review ON legal_holds (review_at) WHERE released_at IS NULL;
COMMENT ON TABLE legal_holds IS 'v3.1 A36 legal holds on a member, report or conversation (permission privacy.legal_holds, approval). While live, erasure and retention jobs keep the data; job holds.review (daily) notifies the owner at review_at. Retention: release + 6 years. PII: personal (ids, reason).';

CREATE OR REPLACE FUNCTION has_legal_hold(p_kind text, p_id uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM legal_holds h WHERE h.scope_kind = p_kind AND h.scope_id = p_id AND h.released_at IS NULL
                   AND h.status IN ('pending_approval','live'));   -- v3.4 B46 a hold waiting for approval still protects the data
$$;
COMMENT ON FUNCTION has_legal_hold(text, uuid) IS 'v3.1 True while a live legal hold covers the subject. Called by erasure.run, retention.purge and the message purge before deleting. v3.4 B46: holds pending approval count too (conservative); rejected / released do not.';

-- =====================================================================
-- 17. ANALYTICS AND RESEARCH
-- =====================================================================

CREATE SEQUENCE analytics_events_id_seq AS bigint;
CREATE TABLE analytics_events (
  id           bigint NOT NULL DEFAULT nextval('analytics_events_id_seq'),
  occurred_at  timestamptz NOT NULL,
  received_at  timestamptz NOT NULL DEFAULT now(),
  user_id      uuid,
  anon_id      uuid,
  session_id   uuid,
  event_name   text NOT NULL CHECK (event_name ~ '^[a-z0-9_.]{2,80}$'),
  screen_code  text,
  platform     platform_t,
  app_version  text,
  locale       app_locale,
  country      iso_country,
  plan         plan_t,
  properties   jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (occurred_at, id)
) PARTITION BY RANGE (occurred_at);
ALTER SEQUENCE analytics_events_id_seq OWNED BY analytics_events.id;
CREATE TABLE analytics_events_default PARTITION OF analytics_events DEFAULT;
CREATE INDEX idx_events_brin ON analytics_events USING brin (occurred_at);
CREATE INDEX idx_events_name ON analytics_events (event_name, occurred_at);
COMMENT ON TABLE analytics_events IS 'Append-only product events, only after analytics consent (PostHog is the product tool; this is our own copy for funnels, admin stats and research exports). Partitioned monthly; raw retention 13 months, then aggregated. No message bodies, codes or tokens ever. PII: personal (pseudonymous).';

CREATE TABLE research_studies (
  id          uuid PRIMARY KEY DEFAULT uuid_v7(),
  code        text NOT NULL UNIQUE,
  name        text NOT NULL,
  city_id     integer REFERENCES cities(id),
  method      text NOT NULL DEFAULT 'moderated_think_aloud',
  starts_on   date,
  ends_on     date,
  target_sus  numeric(5,2) NOT NULL DEFAULT 80 CHECK (target_sus BETWEEN 0 AND 100),
  target_trust numeric(4,2) NOT NULL DEFAULT 8 CHECK (target_trust BETWEEN 0 AND 10),
  target_task_success numeric(4,3) NOT NULL DEFAULT 0.90 CHECK (target_task_success BETWEEN 0 AND 1),
  status      text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','running','analysing','closed')),
  created_by  uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  target_sessions smallint CHECK (target_sessions > 0)  -- v3.4 B58 OD-26
);
COMMENT ON TABLE research_studies IS 'Usability rounds, e.g. LAGOS-R1 (6 tasks, SUS >= 80, trust >= 8/10, >= 90% task success). PII: none.';

CREATE TABLE research_tasks (
  id           uuid PRIMARY KEY DEFAULT uuid_v7(),
  study_id     uuid NOT NULL REFERENCES research_studies(id) ON DELETE CASCADE,
  task_no      smallint NOT NULL CHECK (task_no BETWEEN 1 AND 20),
  title        text NOT NULL,
  start_screen text,
  end_screen   text,
  success_criteria text NOT NULL,
  UNIQUE (study_id, task_no)
);
COMMENT ON TABLE research_tasks IS 'Tasks per study (R1: sign up and get verified E1->B11; like a spec D1; start your minute D5->D6; plan a safe date D9->EV1; pick a plan D15; undo a pass and unmatch D1, D10). PII: none.';

CREATE TABLE research_participants (
  id            uuid PRIMARY KEY DEFAULT uuid_v7(),
  study_id      uuid NOT NULL REFERENCES research_studies(id) ON DELETE CASCADE,
  pseudonym     text NOT NULL CHECK (pseudonym ~ '^P[0-9]{2}$'),
  age_band      text CHECK (age_band IN ('23-27','28-32','33-40','41-45')),
  gender        gender_t,
  device_model  text,
  network       text CHECK (network IN ('mobile_data','wifi')),
  consent_signed_at timestamptz,
  incentive_minor bigint CHECK (incentive_minor >= 0),
  incentive_currency text CHECK (incentive_currency ~ '^[A-Z]{3}$'),
  incentive_paid_at timestamptz,
  UNIQUE (study_id, pseudonym)
);
COMMENT ON TABLE research_participants IS 'Pseudonymous participants; real identities stay in the signed consent forms outside this database. PII: personal (pseudonymous).';

CREATE TABLE research_sessions (
  id             uuid PRIMARY KEY DEFAULT uuid_v7(),
  study_id       uuid NOT NULL REFERENCES research_studies(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES research_participants(id) ON DELETE CASCADE,
  moderator_admin_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  app_build      text,
  started_at     timestamptz NOT NULL,
  ended_at       timestamptz,
  sus_responses  smallint[] CHECK (sus_responses IS NULL OR (cardinality(sus_responses) = 10 AND 1 <= ALL (sus_responses) AND 5 >= ALL (sus_responses))),
  sus_score      numeric(5,2) GENERATED ALWAYS AS (
                   CASE WHEN sus_responses IS NULL THEN NULL ELSE
                   ((sus_responses[1]-1) + (5-sus_responses[2]) + (sus_responses[3]-1) + (5-sus_responses[4]) + (sus_responses[5]-1)
                  + (5-sus_responses[6]) + (sus_responses[7]-1) + (5-sus_responses[8]) + (sus_responses[9]-1) + (5-sus_responses[10])) * 2.5 END) STORED,
  trust_score    smallint CHECK (trust_score BETWEEN 0 AND 10),
  comments       text,
  UNIQUE (study_id, participant_id),
  completed_at timestamptz,  -- v3.4 B57 A35e
  draft jsonb  -- v3.4 B57 partial answers until completion
);
COMMENT ON TABLE research_sessions IS 'One moderated session per participant: SUS (10 answers 1-5, score computed 0-100) and "Would you trust this app with a real date?" 0-10. PII: personal (pseudonymous).';

CREATE TABLE research_task_results (
  session_id     uuid NOT NULL REFERENCES research_sessions(id) ON DELETE CASCADE,
  task_id        uuid NOT NULL REFERENCES research_tasks(id) ON DELETE CASCADE,
  outcome        task_outcome_t NOT NULL,
  critical_error boolean NOT NULL DEFAULT false,
  time_on_task_s integer CHECK (time_on_task_s >= 0),
  error_count    smallint NOT NULL DEFAULT 0 CHECK (error_count >= 0),
  notes          text,
  PRIMARY KEY (session_id, task_id)
);
COMMENT ON TABLE research_task_results IS 'Task success, time on task, errors, critical errors per participant and task. PII: none.';

CREATE TABLE research_findings (
  id            uuid PRIMARY KEY DEFAULT uuid_v7(),
  study_id      uuid NOT NULL REFERENCES research_studies(id) ON DELETE CASCADE,
  theme         text NOT NULL,
  severity      text NOT NULL CHECK (severity IN ('critical','major','minor','cosmetic')),
  mentioned_by  smallint NOT NULL DEFAULT 1 CHECK (mentioned_by >= 1),
  screen_codes  text[] NOT NULL DEFAULT '{}',
  status        text NOT NULL DEFAULT 'open' CHECK (status IN ('open','fixing','fixed','wont_fix')),
  fixed_in_version text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  risk_accepted_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,  -- v3.4 B56 A35b
  risk_accepted_at timestamptz,  -- v3.4 B56
  risk_note text CHECK (char_length(risk_note) <= 1000),  -- v3.4 B56
  CONSTRAINT rf_risk_only_wontfix CHECK (risk_accepted_at IS NULL OR status = 'wont_fix')  -- v3.4 B56
);
COMMENT ON TABLE research_findings IS 'Themes raised; the pass bar requires no theme raised by 3+ people left unfixed. PII: none.';

-- v3.1 C.1-15 Saved analytics reports and scheduled exports (A34).
CREATE TABLE analytics_saved_reports (
  id             uuid PRIMARY KEY DEFAULT uuid_v7(),
  owner_admin_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  name           text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  tab            text NOT NULL CHECK (tab IN ('funnel','retention','matching_health','safety','revenue','markets')),
  query          jsonb NOT NULL CHECK (jsonb_typeof(query) = 'object'),
  shared_role_id uuid REFERENCES admin_roles(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_admin_id, name),
  last_opened_at timestamptz  -- v3.4 B75 A34f
);
CREATE TRIGGER trg_asr_upd BEFORE UPDATE ON analytics_saved_reports FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_asr_shared ON analytics_saved_reports (shared_role_id) WHERE shared_role_id IS NOT NULL;
COMMENT ON TABLE analytics_saved_reports IS 'v3.1 A34 saved reports (aggregates only: query holds metric, dimensions, filters, range; never member ids). Permission analytics.reports.manage. Retention: until deleted. PII: none.';

CREATE TABLE scheduled_exports (
  id                  uuid PRIMARY KEY DEFAULT uuid_v7(),
  report_id           uuid NOT NULL REFERENCES analytics_saved_reports(id) ON DELETE CASCADE,
  frequency           text NOT NULL CHECK (frequency IN ('daily','weekly','monthly')),
  format              text NOT NULL DEFAULT 'csv' CHECK (format IN ('csv','xlsx','pdf')),
  recipient_admin_ids uuid[] NOT NULL CHECK (cardinality(recipient_admin_ids) BETWEEN 1 AND 20),
  next_run_at         timestamptz NOT NULL,
  last_run_at         timestamptz,
  last_export_id      uuid REFERENCES admin_exports(id) ON DELETE SET NULL,
  is_active           boolean NOT NULL DEFAULT true,
  created_by          uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  run_time_local time NOT NULL DEFAULT '08:00',  -- v3.4 B74 A34g
  run_weekday smallint CHECK (run_weekday BETWEEN 1 AND 7),  -- v3.4 B74
  run_monthday smallint CHECK (run_monthday BETWEEN 1 AND 28),  -- v3.4 B74
  timezone text NOT NULL DEFAULT 'Africa/Lagos',  -- v3.4 B74
  last_run_status text CHECK (last_run_status IN ('sent','failed'))  -- v3.4 B74
);
CREATE INDEX idx_sched_exports_due ON scheduled_exports (next_run_at) WHERE is_active;
COMMENT ON TABLE scheduled_exports IS 'v3.1 A34 scheduled delivery of a saved report to admins (never outside the console: recipients are admin ids; the file is an admin_exports row). Permission analytics.schedules.manage. Retention: until deleted. PII: none.';

-- v3.1 C.1-16 Store installs (AD-16), imported daily from App Store Connect / Play Console.
CREATE TABLE store_installs_daily (
  day         date NOT NULL,
  platform    platform_t NOT NULL CHECK (platform IN ('ios','android')),
  country     iso_country NOT NULL,
  installs    integer NOT NULL CHECK (installs >= 0),
  source      text NOT NULL DEFAULT 'store_report' CHECK (source IN ('store_report','api','manual')),
  imported_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (day, platform, country, campaign),  -- v3.4 W9 web-attributed installs per campaign
  campaign text NOT NULL DEFAULT ''  -- v3.4 W9
);
CREATE INDEX idx_installs_brin ON store_installs_daily USING brin (day);
COMMENT ON TABLE store_installs_daily IS 'v3.1 A34 acquisition: store-reported installs per day, platform and country (aggregates, no device data). Retention 5 years. PII: none.';

-- =====================================================================
-- 18. PLATFORM CONFIG, NETWORK MONITORING, WEBSITE CMS
--     Citus: config tables are reference tables; request logs stay on
--     the coordinator (or go to the observability stack).
-- =====================================================================

CREATE TABLE feature_flags (
  key             text PRIMARY KEY CHECK (key ~ '^[a-z0-9_.]{2,80}$'),
  description     text NOT NULL,
  enabled         boolean NOT NULL DEFAULT false,
  rollout_percent smallint NOT NULL DEFAULT 0 CHECK (rollout_percent BETWEEN 0 AND 100),
  rules           jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_kill_switch  boolean NOT NULL DEFAULT false,
  approval_id     uuid REFERENCES admin_approvals(id) ON DELETE SET NULL,   -- v3.1 four-eyes in production (AD-05)
  updated_by      uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_flags_upd BEFORE UPDATE ON feature_flags FOR EACH ROW EXECUTE FUNCTION set_updated_at();
COMMENT ON TABLE feature_flags IS 'Feature flags and kill switches (e.g. calls.enabled for MF4 "later release", locale.fr, payments.flutterwave_link_out). rules target platform, country, role, app version. v3.1: in production every change needs an approved admin_approvals row (config.flags, AD-05) except turning a kill switch OFF (enforce_config_approval). Admin A31. PII: none.';
COMMENT ON COLUMN feature_flags.approval_id IS 'v3.1 Approved admin_approvals row (permission config.flags, target_id = key) that authorised the last production change; consumed (status executed) by the change.';

CREATE TABLE feature_flag_overrides (
  flag_key   text NOT NULL REFERENCES feature_flags(key) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enabled    boolean NOT NULL,
  reason     text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (flag_key, user_id)
);
COMMENT ON TABLE feature_flag_overrides IS 'Per-member flag overrides (beta testers, research participants). PII: none.';

CREATE TABLE remote_config (
  key         text PRIMARY KEY CHECK (key ~ '^[a-z0-9_.]{2,80}$'),
  value       jsonb NOT NULL,
  value_type  text NOT NULL CHECK (value_type IN ('int','number','bool','string','json')),
  description text NOT NULL,
  is_public   boolean NOT NULL DEFAULT false,
  source_ref  text,
  version     integer NOT NULL DEFAULT 1,
  approval_id uuid REFERENCES admin_approvals(id) ON DELETE SET NULL,   -- v3.1 four-eyes in production (AD-05)
  updated_by  uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  permission_key text NOT NULL DEFAULT 'config.remote',  -- v3.4 A3 per-key approval permission (FK added after the permission seeds)
  min_value numeric,  -- v3.4 B13 A24 guards
  max_value numeric,  -- v3.4 B13
  unit text,  -- v3.4 B13
  group_key text,  -- v3.4 B13
  CONSTRAINT rc_range_chk CHECK (min_value IS NULL OR max_value IS NULL OR min_value <= max_value)  -- v3.4 B13
);
CREATE TRIGGER trg_rconfig_upd BEFORE UPDATE ON remote_config FOR EACH ROW EXECUTE FUNCTION set_updated_at();
COMMENT ON TABLE remote_config IS 'Tunable limits and timers (25 / 50 specs/day, 24 h intro window, 60 s intro, 6 s Pass undo, 7-day grace...). is_public values are returned by GET /config to the apps. Every change is audited. v3.1: production changes need an approved config.remote approval (AD-05, enforce_config_approval). A value of JSON null means "not set" (e.g. AD-27 badge QA sample): the API treats it as unset and applies the documented safe default. Admin A24 / A31. PII: none.';
COMMENT ON COLUMN remote_config.approval_id IS 'v3.1 Approved admin_approvals row (permission config.remote, target_id = key) consumed by the last production change.';

CREATE TABLE app_versions (
  id              uuid PRIMARY KEY DEFAULT uuid_v7(),
  platform        platform_t NOT NULL CHECK (platform IN ('ios','android')),
  min_supported   text NOT NULL CHECK (min_supported ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  latest          text NOT NULL CHECK (latest ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  store_url       text NOT NULL,
  release_notes_key text,
  runtime_version text,
  effective_at    timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  download_mb numeric(6,1) CHECK (download_mb > 0),  -- v3.4 M38 OB1
  min_os_version text  -- v3.4 M38 OB1
);
CREATE INDEX idx_app_versions_current ON app_versions (platform, effective_at DESC);
COMMENT ON TABLE app_versions IS 'OB1 version gate: below min_supported -> Required (blocks the app); below latest -> Recommended (snoozed 3 days). runtime_version pins EAS Update OTA bundles. PII: none.';

CREATE TABLE maintenance_windows (
  id            uuid PRIMARY KEY DEFAULT uuid_v7(),
  kind          maintenance_kind_t NOT NULL DEFAULT 'maintenance',
  platforms     platform_t[] NOT NULL DEFAULT '{ios,android,web}',
  starts_at     timestamptz NOT NULL,
  ends_at       timestamptz,
  message_key   text NOT NULL,
  status_page_url text,
  read_only     boolean NOT NULL DEFAULT false,
  approval_id   uuid REFERENCES admin_approvals(id) ON DELETE SET NULL,
  created_by    uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  cancelled_at  timestamptz,
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX idx_maint_active ON maintenance_windows (starts_at) WHERE cancelled_at IS NULL;
COMMENT ON TABLE maintenance_windows IS 'OB1 Maintenance (retry with backoff + status page link), global read-only / offline mode. Requires an approval. PII: none.';

CREATE TABLE rate_limit_policies (
  key            text PRIMARY KEY CHECK (key ~ '^[a-z0-9_.]{2,80}$'),
  scope          text NOT NULL CHECK (scope IN ('ip','device','account','phone','email','account_ip')),
  max_requests   integer NOT NULL CHECK (max_requests > 0),
  window_seconds integer NOT NULL CHECK (window_seconds > 0),
  lockout_seconds integer CHECK (lockout_seconds > 0),
  algorithm      text NOT NULL DEFAULT 'sliding_window' CHECK (algorithm IN ('sliding_window','token_bucket','fixed_window')),
  applies_to     text NOT NULL,
  is_active      boolean NOT NULL DEFAULT true,
  description    text NOT NULL,
  approval_id    uuid REFERENCES admin_approvals(id) ON DELETE SET NULL,   -- v3.1
  updated_by     uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_rlp_upd BEFORE UPDATE ON rate_limit_policies FOR EACH ROW EXECUTE FUNCTION set_updated_at();
COMMENT ON TABLE rate_limit_policies IS 'Redis rate-limit policies loaded by the API at start and on change (pub/sub). Keys rl:{policy}:{subject}. v3.1: production changes need an approved security.rate_limits approval (enforce_config_approval). PII: none.';

CREATE TABLE ip_access_rules (
  id          uuid PRIMARY KEY DEFAULT uuid_v7(),
  cidr        cidr NOT NULL,
  list        list_kind_t NOT NULL,
  scope       text NOT NULL CHECK (scope IN ('admin','api','webhooks','all')),
  reason      text NOT NULL,
  expires_at  timestamptz,
  created_by  uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  removed_at  timestamptz,
  label text CHECK (char_length(label) BETWEEN 1 AND 60),  -- v3.4 A11 A03c
  cf_rule_id text,  -- v3.4 B51 A32f
  synced_at timestamptz,  -- v3.4 B51
  sync_error text,  -- v3.4 B51
  approval_id uuid REFERENCES admin_approvals(id) ON DELETE SET NULL,  -- v3.4 B51
  detection_id uuid,  -- v3.4 B51
  CONSTRAINT ip_deny_expiry_chk CHECK (list <> 'deny' OR (expires_at IS NOT NULL AND expires_at <= created_at + interval '90 days'))  -- v3.4 B52 A32c
);
CREATE INDEX idx_ip_rules_live ON ip_access_rules USING gist (cidr inet_ops) WHERE removed_at IS NULL;
COMMENT ON TABLE ip_access_rules IS 'IP allow list (admin console: office/VPN only in production) and deny list (abusive ranges); synced to Cloudflare WAF IP lists (OD-06 / OD-11). PII: personal (IP).';

CREATE TABLE api_request_rollups (
  bucket_start  timestamptz NOT NULL,
  route_key     text NOT NULL,
  method        text NOT NULL CHECK (method IN ('GET','POST','PUT','PATCH','DELETE','WS')),
  status_class  smallint NOT NULL CHECK (status_class IN (1,2,3,4,5)),
  platform      text NOT NULL DEFAULT 'unknown',
  country       text NOT NULL DEFAULT 'ZZ',
  requests      bigint NOT NULL CHECK (requests >= 0),
  errors        bigint NOT NULL DEFAULT 0,
  rate_limited  bigint NOT NULL DEFAULT 0,
  p50_ms        integer,
  p95_ms        integer,
  p99_ms        integer,
  bytes_in      bigint NOT NULL DEFAULT 0,
  bytes_out     bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_start, route_key, method, status_class, platform, country)
) PARTITION BY RANGE (bucket_start);
CREATE TABLE api_request_rollups_default PARTITION OF api_request_rollups DEFAULT;
CREATE INDEX idx_rollups_brin ON api_request_rollups USING brin (bucket_start);
COMMENT ON TABLE api_request_rollups IS 'Admin network dashboard: 1-minute buckets per route / method / status class / platform / country with latency percentiles, written by the API metrics flusher. Partitioned monthly; retention 13 months. PII: none.';

CREATE SEQUENCE api_request_samples_id_seq AS bigint;
CREATE TABLE api_request_samples (
  id          bigint NOT NULL DEFAULT nextval('api_request_samples_id_seq'),
  at          timestamptz NOT NULL DEFAULT now(),
  request_id  text NOT NULL,
  route_key   text NOT NULL,
  method      text NOT NULL,
  status      smallint NOT NULL,
  latency_ms  integer NOT NULL,
  user_hash   sha256_hash,
  ip_prefix   cidr,
  platform    text,
  app_version text,
  error_code  text,
  asn         integer CHECK (asn >= 0),                                   -- v3.1 A32
  country     text CHECK (country ~ '^[A-Z]{2}$'),                        -- v3.1 A32 (ZZ = unknown)
  user_agent_family text CHECK (char_length(user_agent_family) <= 60),    -- v3.1 A32 (e.g. okhttp, Safari, curl)
  PRIMARY KEY (at, id),
  CHECK (ip_prefix IS NULL OR (family(ip_prefix) = 4 AND masklen(ip_prefix) = 24) OR (family(ip_prefix) = 6 AND masklen(ip_prefix) = 48))  -- v3.1 truncation enforced
) PARTITION BY RANGE (at);
ALTER SEQUENCE api_request_samples_id_seq OWNED BY api_request_samples.id;
CREATE TABLE api_request_samples_default PARTITION OF api_request_samples DEFAULT;
CREATE INDEX idx_samples_brin ON api_request_samples USING brin (at);
CREATE INDEX idx_samples_errors ON api_request_samples (route_key, at) WHERE status >= 500;
CREATE INDEX idx_samples_prefix ON api_request_samples (ip_prefix, at DESC);      -- v3.1 A32 drill-down by prefix
COMMENT ON TABLE api_request_samples IS 'Sampled raw requests (all 5xx, 1% of the rest) for drill-down. IP truncated to /24 (/48 IPv6, CHECK), user id hashed; v3.1 adds ASN, country and user-agent family for A32 aggregates. Retention 14 days. PII: personal (pseudonymous).';

CREATE TABLE vendor_health_checks (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vendor      text NOT NULL CHECK (vendor IN ('termii','twilio','whatsapp','resend','expo_push','flutterwave','stripe','revenuecat','liveness','daily','google_places','carrier','posthog','cloudflare')),
  checked_at  timestamptz NOT NULL DEFAULT now(),
  ok          boolean NOT NULL,
  latency_ms  integer,
  detail      text
);
CREATE INDEX idx_vendor_health ON vendor_health_checks (vendor, checked_at DESC);
COMMENT ON TABLE vendor_health_checks IS 'v3.2 + posthog, cloudflare (OD-06). Synthetic checks of every vendor (OTP fallback Termii -> Twilio is driven by this). Retention 30 days. PII: none.';

-- v3.1 C.1-17 Per-IP-prefix / ASN / user-agent aggregates (A32), 1-minute
-- buckets, partitioned monthly (ensure_monthly_partitions), 30-day retention.
CREATE TABLE api_request_ip_rollups (
  bucket_start      timestamptz NOT NULL,
  ip_prefix         cidr NOT NULL,
  asn               integer NOT NULL DEFAULT 0 CHECK (asn >= 0),
  country           text NOT NULL DEFAULT 'ZZ' CHECK (country ~ '^[A-Z]{2}$'),
  route_key         text NOT NULL,
  user_agent_family text NOT NULL DEFAULT 'unknown' CHECK (char_length(user_agent_family) <= 60),
  requests          bigint NOT NULL CHECK (requests >= 0),
  errors            bigint NOT NULL DEFAULT 0 CHECK (errors >= 0),
  rate_limited      bigint NOT NULL DEFAULT 0 CHECK (rate_limited >= 0),
  status_4xx        bigint NOT NULL DEFAULT 0 CHECK (status_4xx >= 0),
  status_5xx        bigint NOT NULL DEFAULT 0 CHECK (status_5xx >= 0),
  PRIMARY KEY (bucket_start, ip_prefix, asn, country, route_key, user_agent_family),
  CHECK ((family(ip_prefix) = 4 AND masklen(ip_prefix) = 24) OR (family(ip_prefix) = 6 AND masklen(ip_prefix) = 48)),
  CHECK (errors <= requests AND rate_limited <= requests),
  p50_ms integer,  -- v3.4 B54 A32b
  p95_ms integer,  -- v3.4 B54
  p99_ms integer,  -- v3.4 B54
  bytes_out bigint NOT NULL DEFAULT 0  -- v3.4 B54
) PARTITION BY RANGE (bucket_start);
CREATE TABLE api_request_ip_rollups_default PARTITION OF api_request_ip_rollups DEFAULT;
CREATE INDEX idx_iprollups_brin ON api_request_ip_rollups USING brin (bucket_start);
CREATE INDEX idx_iprollups_prefix ON api_request_ip_rollups (ip_prefix, bucket_start DESC);
CREATE INDEX idx_iprollups_asn ON api_request_ip_rollups (asn, bucket_start DESC);
CREATE INDEX idx_iprollups_route ON api_request_ip_rollups (route_key, bucket_start DESC);
COMMENT ON TABLE api_request_ip_rollups IS 'v3.1 A32 aggregates and detections: 1-minute buckets per IP prefix (/24 IPv4, /48 IPv6: CHECK), ASN, country, route and user-agent family, written by the API metrics flusher (upsert on the PK). Partitioned monthly; job ip_rollups.purge deletes buckets older than 30 days daily and drops a month partition once it is empty. PII: personal (pseudonymous network prefix). Citus: coordinator-local.';

-- v3.1 C.1-18 Vendor settings. Secrets are NEVER stored here: secret_ref is a
-- vault:// key (Railway sealed variable, OD-11); settings may not contain secret-like keys.
CREATE TABLE vendor_settings (
  vendor          text PRIMARY KEY CHECK (vendor IN ('termii','twilio','whatsapp','resend','expo_push','flutterwave','stripe','revenuecat','liveness','daily','google_places','carrier','posthog','cloudflare')),
  settings        jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(settings) = 'object' AND NOT jsonb_has_secret_keys(settings)),
  secret_ref      text CHECK (secret_ref ~ '^(arn:aws:secretsmanager:[a-z0-9-]+:[0-9]{12}:secret:[A-Za-z0-9/_+=.@-]+|vault://[A-Za-z0-9/_.-]+)$'),
  secret_version  text CHECK (char_length(secret_version) <= 64),
  secret_last4    text CHECK (secret_last4 ~ '^.{4}$'),
  last_rotated_at timestamptz,
  rotation_due_at timestamptz,
  webhook_url     text CHECK (webhook_url IS NULL OR webhook_url ~ '^https://'),
  approval_id     uuid REFERENCES admin_approvals(id) ON DELETE SET NULL,
  updated_by      uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (secret_last4 IS NULL OR secret_ref IS NOT NULL)
);
CREATE TRIGGER trg_vendor_settings_upd BEFORE UPDATE ON vendor_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
COMMENT ON TABLE vendor_settings IS 'v3.1 A31 vendor cards: non-secret settings (sender ids, templates, OTP failover order, timeouts) and secret METADATA only. The secret value lives in Railway sealed variables (OD-11) and is referenced by secret_ref as a vault:// key; the console shows secret_last4 masked and never the value. Rotation (config.vendors: approval + re-auth) calls the rotation function and updates secret_version / last_rotated_at. Retention: permanent. PII: none.';
COMMENT ON COLUMN vendor_settings.secret_ref IS 'v3.1 Reference only: arn:aws:secretsmanager:<region>:<account>:secret:<name> or vault://<path>. A plain secret cannot match this pattern.';
COMMENT ON COLUMN vendor_settings.settings IS 'v3.1 Non-secret settings. CHECK NOT jsonb_has_secret_keys(settings): keys such as password, token, api_key, secret are refused at any depth.';

-- v3.1 C.1-10 Security detections (job security.detect, every minute).
CREATE TABLE security_detections (
  id                   uuid PRIMARY KEY DEFAULT uuid_v7(),
  rule_key             text NOT NULL CHECK (rule_key ~ '^[a-z_]+$'),
  subject_kind         text NOT NULL CHECK (subject_kind IN ('ip_prefix','asn','identifier_hash','user_hash','destination_prefix')),
  subject_value        text NOT NULL,
  window_start         timestamptz NOT NULL,
  window_end           timestamptz NOT NULL,
  evidence             jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(evidence) = 'object'),
  status               text NOT NULL DEFAULT 'open' CHECK (status IN ('open','responded','dismissed')),
  response_approval_id uuid REFERENCES admin_approvals(id) ON DELETE SET NULL,
  incident_id          uuid,
  resolved_by          uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  resolved_at          timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  CHECK (window_end > window_start),
  CHECK (status = 'open' OR resolved_at IS NOT NULL),
  CHECK (status <> 'responded' OR response_approval_id IS NOT NULL)
);
CREATE UNIQUE INDEX uq_detection_window ON security_detections (rule_key, subject_kind, subject_value, window_start);
CREATE INDEX idx_detections_open ON security_detections (created_at DESC) WHERE status = 'open';
CREATE INDEX idx_detections_subject ON security_detections (subject_kind, subject_value, created_at DESC);
CREATE INDEX idx_detections_brin ON security_detections USING brin (created_at);
COMMENT ON TABLE security_detections IS 'v3.1 A32 detections: credential_stuffing, password_spraying, otp_abuse, signup_farming, scraping, webhook_forgery, error_spike, admin_attack. Thresholds come from remote_config security.detect.* (AD-41: none set). A response is proposed as an admin_approvals row (security.ip_lists / security.rate_limits). Retention 13 months. PII: personal (pseudonymous prefixes and hashes).';

-- v3.1 C.1-11 Security incidents (A03, A07, A32).
CREATE TABLE security_incidents (
  id                    uuid PRIMARY KEY DEFAULT uuid_v7(),
  title                 text NOT NULL CHECK (char_length(title) BETWEEN 5 AND 160),
  severity              smallint NOT NULL CHECK (severity BETWEEN 1 AND 4),
  category              text NOT NULL CHECK (category IN ('account_takeover','credential_stuffing','password_spraying','otp_abuse','scraping','data_breach','scam_wave','vendor_outage','admin_access_abuse','other')),  -- v3.4 B50
  status                text NOT NULL DEFAULT 'open' CHECK (status IN ('open','contained','resolved','post_mortem')),
  owner_admin_id        uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  aware_at              timestamptz NOT NULL DEFAULT now(),
  regulator_notified_at timestamptz,
  contained_at          timestamptz,
  resolved_at           timestamptz,
  member_impact_count   integer CHECK (member_impact_count >= 0),
  summary               text CHECK (char_length(summary) <= 10000),
  post_mortem_url       text CHECK (post_mortem_url IS NULL OR post_mortem_url ~ '^https://'),
  links                 jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(links) = 'array'),
  timeline              jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(timeline) = 'array'),
  created_by            uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CHECK (status NOT IN ('contained','resolved','post_mortem') OR contained_at IS NOT NULL),
  CHECK (status NOT IN ('resolved','post_mortem') OR resolved_at IS NOT NULL),
  public_ref text NOT NULL UNIQUE DEFAULT ('SI-' || lpad(nextval('security_incident_ref_seq')::text, 4, '0')),  -- v3.4 A5 / B49 SI-nnnn
  regulator_reference text,  -- v3.4 B49 NDPC reference
  regulator_notice text CHECK (char_length(regulator_notice) <= 5000)  -- v3.4 B49
);
CREATE TRIGGER trg_incidents_upd BEFORE UPDATE ON security_incidents FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_incidents_open ON security_incidents (severity, aware_at) WHERE status IN ('open','contained');
CREATE INDEX idx_incidents_breach_clock ON security_incidents (aware_at) WHERE category = 'data_breach' AND regulator_notified_at IS NULL;
ALTER TABLE security_detections ADD FOREIGN KEY (incident_id) REFERENCES security_incidents(id) ON DELETE SET NULL;
COMMENT ON TABLE security_incidents IS 'v3.1 A32 incident log. category data_breach starts the NDPA 72-hour regulator clock from aware_at (deadline = aware_at + 72 h, shown as an SLA timer until regulator_notified_at). links = detections / approvals / audit rows. Permission security.incidents. Retention 7 years. PII: none (impact as counts).';

-- v3.1 Worker job catalogue (A31 Jobs page). pg-boss owns runtime state
-- (schema pgboss); this table says what each job is and whether "Run now"
-- is allowed. Seeded in section 24.
CREATE TABLE worker_jobs (
  name            text PRIMARY KEY CHECK (name ~ '^[a-z_]+(\.[a-z_]+)+$'),
  schedule        text NOT NULL,
  description     text NOT NULL,
  module          text CHECK (module ~ '^A[0-9]{2}$'),
  run_now_allowed boolean NOT NULL DEFAULT false,
  is_destructive  boolean NOT NULL DEFAULT false,
  is_active       boolean NOT NULL DEFAULT true,
  source_ref      text,
  CHECK (NOT (run_now_allowed AND is_destructive)),
  cron text  -- v3.4 B73 machine-readable schedule
);
COMMENT ON TABLE worker_jobs IS 'v3.1 A31 job catalogue (Technical Reference §11 plus the v3.1 jobs). run_now_allowed only for safe idempotent jobs; destructive jobs (erasure.run, purges) can never be run on demand (CHECK). jobs.read to view, jobs.run to retry / run now. PII: none. Citus: reference.';

-- ---------------------------------------------------------------------
-- 18.1 Website CMS (1minitman.com: information only, no member sign-in)
--      Website spec §6. Citus: coordinator-local. Every CMS table also gets
--      the common workflow / locale columns of section 18.3.
-- ---------------------------------------------------------------------
CREATE TABLE media_library (
  id           uuid PRIMARY KEY DEFAULT uuid_v7(),
  storage_key  text NOT NULL UNIQUE,
  kind         text NOT NULL CHECK (kind IN ('image','illustration','svg','video','document','font','zip')),  -- v3.1 + svg, zip
  mime_type    text NOT NULL,
  bytes        integer NOT NULL CHECK (bytes > 0),
  width        smallint,
  height       smallint,
  alt_text_key text,
  decorative   boolean NOT NULL DEFAULT false,                      -- v3.1
  caption_key  text,                                                -- v3.1
  credit       text,
  source_url   text CHECK (source_url IS NULL OR source_url ~ '^https://'),  -- v3.1
  licence      text NOT NULL CHECK (licence IN ('CC0','CC-BY','commercial','owned','model_release')),  -- v3.1 CHECK
  licence_url  text,
  licence_ref  text,                                                -- v3.1 e.g. LICENCE_LOG.csv row
  consent_ref  text,                                                -- v3.1 identifiable real person
  model_release_ref text,                                           -- v3.1
  is_real_member_or_model boolean NOT NULL DEFAULT false,           -- v3.1
  focal_point  point,                                               -- v3.1 (x, y) in 0..1
  dark_variant_id uuid REFERENCES media_library(id) ON DELETE SET NULL,  -- v3.1
  renditions   jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(renditions) = 'array'),  -- v3.1 AVIF / WebP widths
  internal_only boolean NOT NULL DEFAULT false,                     -- v3.1 not selectable on the website
  expires_at   timestamptz,                                         -- v3.1 licence / consent expiry
  uploaded_by  uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  archived_at  timestamptz,
  CHECK (kind NOT IN ('image','illustration','svg') OR decorative OR alt_text_key IS NOT NULL),
  CHECK (licence_url IS NOT NULL OR licence_ref IS NOT NULL),
  CHECK (NOT is_real_member_or_model OR consent_ref IS NOT NULL),
  CHECK (licence <> 'model_release' OR model_release_ref IS NOT NULL),
  CHECK (focal_point IS NULL OR (focal_point[0] BETWEEN 0 AND 1 AND focal_point[1] BETWEEN 0 AND 1)),
  CHECK (dark_variant_id IS NULL OR dark_variant_id <> id)
);
CREATE INDEX idx_media_lib_expiry ON media_library (expires_at) WHERE expires_at IS NOT NULL AND archived_at IS NULL;  -- v3.1 auto-unpublish job
CREATE INDEX idx_media_lib_filter ON media_library (kind, licence) WHERE archived_at IS NULL;                          -- v3.1 A29 filters
COMMENT ON TABLE media_library IS 'Brand and website assets with licence log (e.g. Notionists by Zoish, CC0 1.0, mirrored from 1minit/media/LICENCE_LOG.csv). Never member photos. v3.1: website §6.5 fields (alt or decorative, licence CHECK, consent / model release for real people, focal point, dark variant, renditions, expiry auto-unpublishes dependants, internal_only). Admin A29. Retention: permanent while used. PII: none (personal when is_real_member_or_model).';
COMMENT ON COLUMN media_library.expires_at IS 'v3.1 Licence or consent expiry: job media.expiry unpublishes dependent blocks and notifies the editor (website §6.4 rule 4).';

CREATE TABLE site_pages (
  id            uuid PRIMARY KEY DEFAULT uuid_v7(),
  slug          text NOT NULL CHECK (slug ~ '^(/|(/[a-z0-9-]+)+)$'),
  locale        app_locale NOT NULL,
  page_type     text NOT NULL DEFAULT 'standard' CHECK (page_type IN ('home','standard','landing','legal_wrapper','listing')),  -- v3.1
  template      text NOT NULL CHECK (template IN ('landing','generic','legal','safety','careers','investors','press','help','contact',
                  'how_it_works','plans','download','offer','waitlist','about','stories','journal','newsletter','status','campaign','error')),  -- v3.1 + W-module templates
  parent_id     uuid REFERENCES site_pages(id) ON DELETE SET NULL,                                 -- v3.1 breadcrumbs
  nav_visibility text NOT NULL DEFAULT 'hidden' CHECK (nav_visibility IN ('header','footer','both','hidden')),  -- v3.1
  title         text NOT NULL,
  seo_title     text CHECK (char_length(seo_title) <= 70),
  seo_description text CHECK (char_length(seo_description) <= 170),
  og_image_id   uuid REFERENCES media_library(id) ON DELETE SET NULL,
  canonical_override text CHECK (canonical_override IS NULL OR canonical_override ~ '^https://'),  -- v3.1
  noindex       boolean NOT NULL DEFAULT false,                                                    -- v3.1
  breadcrumb_label text CHECK (char_length(breadcrumb_label) <= 30),                               -- v3.1
  legal_kind    legal_doc_kind_t,
  status        content_status_t NOT NULL DEFAULT 'draft',
  version       integer NOT NULL DEFAULT 1,
  published_at  timestamptz,
  updated_by    uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slug, locale),
  CHECK ((template = 'legal') = (legal_kind IS NOT NULL)),
  CHECK (parent_id IS NULL OR parent_id <> id),
  campaign_code text CHECK (campaign_code ~ '^[a-z0-9-]{1,40}$'),  -- v3.4 W8 W40
  ref_code text CHECK (char_length(ref_code) <= 40),  -- v3.4 W8
  default_store_behaviour text NOT NULL DEFAULT 'auto' CHECK (default_store_behaviour IN ('auto','app_store','google_play')),  -- v3.4 W8
  expires_at timestamptz,  -- v3.4 W8 then 302 to Home
  CONSTRAINT ck_site_pages_campaign CHECK (template <> 'campaign' OR campaign_code IS NOT NULL)  -- v3.4 W8
  -- + common workflow / locale columns (section 18.3)
);
CREATE TRIGGER trg_site_pages_upd BEFORE UPDATE ON site_pages FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_site_pages_parent ON site_pages (parent_id) WHERE parent_id IS NOT NULL;   -- v3.1
CREATE INDEX idx_site_pages_list ON site_pages (template, status, updated_at DESC);         -- v3.1 A28 pages list
COMMENT ON TABLE site_pages IS 'Website pages per locale (/, /how-it-works, /safety, /plans, /stories, /help, /legal/*, /careers, /investors, /press, /contact, /offer, /waitlist, /journal ...). Legal pages render the published legal_documents row. Publishing triggers a static rebuild webhook. v3.1: page_type, parent (breadcrumbs), nav visibility, canonical override, noindex, breadcrumb label; changing a published slug writes a 301 to redirects. Admin A28. Retention: permanent (revisions in content_revisions). PII: none.';

CREATE TABLE site_blocks (
  id          uuid PRIMARY KEY DEFAULT uuid_v7(),
  key         text NOT NULL,
  locale      app_locale NOT NULL,
  name        text CHECK (char_length(name) <= 80),                                  -- v3.1 internal name
  reusable    boolean NOT NULL DEFAULT true,                                         -- v3.1 shared across pages
  kind        text NOT NULL CHECK (kind IN (
                -- v3.1 website §6.3 block catalogue (41 block_types)
                'hero_promise','proof_trio','intro_ring_explainer','feature_list','promise_band','plans_teaser',
                'plan_cards','plan_compare_table','billing_facts','black_badge_explainer','stories_teaser','city_strip',
                'press_logos','faq_list','cta_band','download_panel','interest_tiles','circle_invite','page_header',
                'rich_text','media_feature','steps_timeline','timeline','glossary','values_list','team_grid',
                'emergency_numbers','tips_list','cta_pair','help_links','offer_claim','waitlist_form','newsletter_signup',
                'form_embed','job_list','investor_updates_list','facts_box','documents_on_request','disclaimer',
                'media_kit','legal_document_view',
                -- v3 kinds kept for compatibility (legacy; migrate to the catalogue above)
                'hero','proof_strip','how_it_works','interests','plans','stories','circle','get_the_app','faq','cta',
                'image','footer')),
  content     jsonb NOT NULL,
  status      content_status_t NOT NULL DEFAULT 'draft',
  updated_by  uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (key, locale)
  -- + common workflow / locale columns (section 18.3)
);
CREATE INDEX idx_site_blocks_kind ON site_blocks (kind, status);   -- v3.1 A28 blocks list
COMMENT ON TABLE site_blocks IS 'Reusable typed content blocks (website §6.3 block catalogue; content is validated by packages/content-schema per kind). The plans blocks read prices from the prices table (Free / Premium $2.50 / Gold $9.75, Black Badge $1.00 one-off). v3.1: the 41 website block_types (+ 14 legacy v3 kinds), internal name, reusable flag. Admin A28. Retention: permanent. PII: none.';
COMMENT ON COLUMN site_blocks.kind IS 'v3.1 website §6.3 block_type. Legacy v3 kinds (hero, proof_strip, how_it_works, interests, plans, stories, circle, get_the_app, faq, cta, image, footer) are accepted until migrated.';

CREATE TABLE site_page_sections (
  id         uuid PRIMARY KEY DEFAULT uuid_v7(),
  page_id    uuid NOT NULL REFERENCES site_pages(id) ON DELETE CASCADE,
  position   smallint NOT NULL CHECK (position >= 0),
  block_id   uuid REFERENCES site_blocks(id) ON DELETE RESTRICT,
  inline_content jsonb,
  is_visible boolean NOT NULL DEFAULT true,
  surface    text NOT NULL DEFAULT 'bg' CHECK (surface IN ('bg','surface','ink_band')),   -- v3.1
  anchor_id  text CHECK (anchor_id ~ '^[a-z0-9-]+$'),                                    -- v3.1
  visible_locales app_locale[],                                                           -- v3.1 NULL = all
  visible_from  timestamptz,                                                              -- v3.1 section scheduling
  visible_until timestamptz,                                                              -- v3.1
  UNIQUE (page_id, position),
  CHECK ((block_id IS NULL) <> (inline_content IS NULL)),
  CHECK (visible_until IS NULL OR visible_from IS NULL OR visible_until > visible_from)
);
CREATE UNIQUE INDEX uq_section_anchor ON site_page_sections (page_id, anchor_id) WHERE anchor_id IS NOT NULL;  -- v3.1
CREATE INDEX idx_sections_block ON site_page_sections (block_id) WHERE block_id IS NOT NULL;                   -- v3.1 "used on N pages"
COMMENT ON TABLE site_page_sections IS 'Ordered sections of a page: a shared block or inline content. v3.1: surface (bg, surface, ink_band; the CMS validator allows at most two ink_band per page), anchor id, per-locale visibility and a visible_from / visible_until window (website §6.2, §6.7). Admin A28. PII: none.';

CREATE TABLE stories (
  id           uuid PRIMARY KEY DEFAULT uuid_v7(),
  slug         text NOT NULL UNIQUE,
  locale       app_locale NOT NULL DEFAULT 'en',
  title        text NOT NULL CHECK (char_length(title) <= 70),
  body_md      text NOT NULL CHECK (char_length(body_md) <= 6000),
  image_id     uuid REFERENCES media_library(id) ON DELETE SET NULL,
  couple_display_names text,                                                          -- v3.1
  city         text CHECK (char_length(city) <= 80),                                  -- v3.1
  met_year     smallint CHECK (met_year >= 1900),                                     -- v3.1
  pull_quote   text CHECK (char_length(pull_quote) <= 120),                           -- v3.1
  photo_ids    uuid[] NOT NULL DEFAULT '{}' CHECK (cardinality(photo_ids) <= 3),      -- v3.1 consented photos
  consent_ref  text,                                                                  -- v3.4 B42 required to publish (stories_publish_consent), not to draft
  both_consented_at timestamptz,                                                      -- v3.4 B42 set when both story_consents rows are confirmed
  consent_status text NOT NULL DEFAULT 'active' CHECK (consent_status IN ('active','withdrawn')),  -- v3.1
  consented_locales app_locale[] NOT NULL DEFAULT '{en}',                             -- v3.1
  approved_text_version integer,                                                      -- v3.1 couple-approved text
  tags         text[] NOT NULL DEFAULT '{}',                                          -- v3.1
  withdrawn_at timestamptz,                                                           -- v3.1
  status       content_status_t NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  created_by   uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK ((consent_status = 'withdrawn') = (withdrawn_at IS NOT NULL)),
  CHECK (consent_status = 'active' OR status <> 'published'),
  consent_scopes text[] NOT NULL DEFAULT '{text}' CHECK ('text' = ANY (consent_scopes) AND consent_scopes <@ ARRAY['text','photos','first_names','social']::text[]),  -- v3.4 W22 W27
  CONSTRAINT ck_story_photos_scope CHECK (cardinality(photo_ids) = 0 OR 'photos' = ANY (consent_scopes)),  -- v3.4 W22
  CONSTRAINT stories_publish_consent CHECK (status <> 'published' OR (both_consented_at IS NOT NULL AND consent_ref IS NOT NULL))  -- v3.4 B42
  -- + common workflow / locale columns (section 18.3)
);
CREATE INDEX idx_stories_city ON stories (city) WHERE status = 'published';   -- v3.1 W27 city filter
COMMENT ON TABLE stories IS 'Couple stories for the website, only with both people''s signed release (AS2 "I met someone, share your story"). v3.1: W27 fields; a withdrawn consent can never be published (CHECK) and the CMS unpublishes it everywhere (410). Admin A29. Retention: until consent is withdrawn, then removed within the DN-18 SLA. PII: personal.';

CREATE TABLE careers_jobs (
  id            uuid PRIMARY KEY DEFAULT uuid_v7(),
  slug          text NOT NULL UNIQUE,
  title         text NOT NULL,
  team          text NOT NULL,
  location      text NOT NULL,
  employment_type text NOT NULL CHECK (employment_type IN ('full_time','part_time','contract','internship')),
  remote_policy text CHECK (remote_policy IN ('onsite','hybrid','remote')),
  description_md text NOT NULL,
  summary       text CHECK (char_length(summary) <= 200),                        -- v3.1 W30; v3.4 W27 <= 200
  responsibilities jsonb CHECK (responsibilities IS NULL OR jsonb_typeof(responsibilities) = 'array'),  -- v3.1
  requirements  jsonb CHECK (requirements IS NULL OR jsonb_typeof(requirements) = 'array'),              -- v3.1
  nice_to_have  jsonb CHECK (nice_to_have IS NULL OR jsonb_typeof(nice_to_have) = 'array'),              -- v3.1
  benefits      jsonb CHECK (benefits IS NULL OR jsonb_typeof(benefits) = 'array'),                      -- v3.1
  hiring_process jsonb CHECK (hiring_process IS NULL OR jsonb_typeof(hiring_process) = 'array'),         -- v3.1
  salary_min    integer CHECK (salary_min >= 0),                                 -- v3.1
  salary_max    integer,                                                         -- v3.1
  salary_currency text CHECK (salary_currency ~ '^[A-Z]{3}$'),                   -- v3.1
  salary_period text CHECK (salary_period IN ('year','month','hour')),           -- v3.1
  city          text,                                                            -- v3.1
  country       iso_country,                                                     -- v3.1
  applicant_countries iso_country[] NOT NULL DEFAULT '{}',                       -- v3.1
  apply_method  text NOT NULL DEFAULT 'internal_form' CHECK (apply_method IN ('internal_form','external_url')),  -- v3.1 (DN-15)
  external_url  text CHECK (external_url IS NULL OR external_url ~ '^https://'), -- v3.1
  hiring_manager_email citext,                                                   -- v3.1 internal only, never rendered
  apply_email   citext,
  status        content_status_t NOT NULL DEFAULT 'draft',
  published_at  timestamptz,
  closes_at     timestamptz,
  created_by    uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (salary_max IS NULL OR salary_min IS NULL OR salary_max >= salary_min),
  CHECK ((salary_min IS NULL AND salary_max IS NULL) OR (salary_currency IS NOT NULL AND salary_period IS NOT NULL)),
  CHECK (apply_method <> 'external_url' OR external_url IS NOT NULL),
  CHECK (status <> 'published' OR closes_at IS NOT NULL),  -- v3.1 closes_at = JobPosting valid_through (website §6.4 rule 9)
  CONSTRAINT ck_careers_title CHECK (char_length(title) <= 80)  -- v3.4 W27 W30
  -- + common workflow columns (section 18.3)
);
COMMENT ON TABLE careers_jobs IS 'Website /careers openings. v3.1: W30 fields (summary, responsibilities, requirements, benefits, hiring process, salary range, city / country, applicant countries, apply method); closes_at serves as valid_through and is required to publish. Admin A29. Retention: permanent. PII: none (hiring_manager_email is internal).';

CREATE TABLE job_applications (
  id            uuid PRIMARY KEY DEFAULT uuid_v7(),
  job_id        uuid NOT NULL REFERENCES careers_jobs(id) ON DELETE CASCADE,
  full_name     text NOT NULL,
  email         citext NOT NULL,
  phone         e164,
  links         text[] NOT NULL DEFAULT '{}',
  cv_upload_id  uuid,                                                           -- v3.4 W2 scanned upload (web_uploads, late FK); replaces cv_storage_key
  cover_note    text CHECK (char_length(cover_note) <= 2000),                   -- v3.4 W25 W30 <= 2,000
  current_location text CHECK (char_length(current_location) <= 120),           -- v3.1
  right_to_work text CHECK (right_to_work IN ('yes','no','needs_sponsorship')),  -- v3.1
  heard_from    text CHECK (char_length(heard_from) <= 120),                     -- v3.1
  consent_future_roles boolean NOT NULL DEFAULT false,                           -- v3.1 (DN-15)
  retention_until timestamptz,                                                   -- v3.1 role close + 12 months
  internal_notes text CHECK (char_length(internal_notes) <= 5000),               -- v3.1 never shown to the applicant
  consent_at    timestamptz NOT NULL,
  status        text NOT NULL DEFAULT 'received' CHECK (status IN ('received','reviewing','interview','offer','hired','not_progressed','withdrawn')),  -- v3.4 W13 website §5.4 pipeline
  created_at    timestamptz NOT NULL DEFAULT now(),
  reference text UNIQUE DEFAULT ('J-' || nextval('job_application_ref_seq')),  -- v3.4 W26
  locale app_locale NOT NULL DEFAULT 'en'  -- v3.4 W26
);
CREATE INDEX idx_job_apps_job ON job_applications (job_id, created_at DESC);                       -- v3.1 A29 per-job list
CREATE INDEX idx_job_apps_retention ON job_applications (retention_until) WHERE retention_until IS NOT NULL;  -- v3.1 purge job
COMMENT ON TABLE job_applications IS 'Applications from /careers. Retention 12 months after the role closes (retention_until), then deleted unless consent_future_roles (DN-15). CV opens are audited (application.cv.open, permission applications.read). Admin A29. PII: personal.';

CREATE TABLE investor_documents (
  id           uuid PRIMARY KEY DEFAULT uuid_v7(),
  title        text NOT NULL,
  kind         text NOT NULL CHECK (kind IN ('update','deck','report','faq','financials','cap_table','dd_pack')),  -- v3.4 W37 W31 kinds ('gated' = on request)
  visibility   text NOT NULL DEFAULT 'gated' CHECK (visibility IN ('public','gated')),
  summary      text CHECK (char_length(summary) <= 500),                          -- v3.1
  doc_date     date,                                                              -- v3.1
  body_md      text,
  file_id      uuid REFERENCES media_library(id) ON DELETE SET NULL,
  attachment_ids uuid[] NOT NULL DEFAULT '{}',                                    -- v3.1 media_library ids
  finance_signoff_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,          -- v3.1 figures need finance sign-off
  status       content_status_t NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  created_by   uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  legal_review_ref text  -- v3.4 B63 A29f
  -- + common workflow columns (section 18.3); approved_by = legal / finance approver
);
COMMENT ON TABLE investor_documents IS 'Website /investors content. No figures are published without finance sign-off. v3.1: summary, date, attachments, finance_signoff_by; legal approval through the workflow approved_by (content.review_legal). Admin A29. Retention: permanent. PII: none.';

CREATE TABLE press_items (
  id           uuid PRIMARY KEY DEFAULT uuid_v7(),
  kind         text NOT NULL CHECK (kind IN ('release','coverage','kit')),
  title        text NOT NULL,
  outlet       text,
  url          text,
  summary      text CHECK (char_length(summary) <= 500),
  body_md      text,
  file_id      uuid REFERENCES media_library(id) ON DELETE SET NULL,
  logo_id      uuid REFERENCES media_library(id) ON DELETE SET NULL,              -- v3.1
  logo_permission boolean NOT NULL DEFAULT false,                                 -- v3.1
  attachment_ids uuid[] NOT NULL DEFAULT '{}',                                    -- v3.1
  published_on date,
  status       content_status_t NOT NULL DEFAULT 'draft',
  created_by   uuid REFERENCES admin_users(id) ON DELETE SET NULL,                -- v3.1
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (logo_id IS NULL OR logo_permission),
  CHECK (kind <> 'coverage' OR url ~ '^https://'),
  link_checked_at timestamptz,  -- v3.4 B63 A29f
  link_status smallint  -- v3.4 B63
  -- + common workflow columns (section 18.3)
);
COMMENT ON TABLE press_items IS 'Website /press: releases, coverage links, press kit. v3.1: outlet logo only with permission (CHECK), attachments. Admin A29. Retention: permanent. PII: none.';

CREATE SEQUENCE contact_public_ref_seq START 100001;   -- v3.1
CREATE TABLE contact_submissions (
  id           uuid PRIMARY KEY DEFAULT uuid_v7(),
  kind         contact_kind_t NOT NULL,
  reference    text NOT NULL UNIQUE DEFAULT ('W-' || nextval('contact_public_ref_seq')),  -- v3.1 human-readable
  topic        text CHECK (char_length(topic) <= 80),                                     -- v3.1
  priority     text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal','urgent')),    -- v3.1
  name         text CHECK (char_length(name) BETWEEN 1 AND 120),             -- v3.4 W1 W34 anonymous safety report: no name
  email        citext,                                                         -- v3.4 W1 optional for kind safety only (ck_contact_identity)
  company      text,
  message      text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 5000),
  payload_enc  bytea,                                                                     -- v3.1 extra fields, encrypted JSON (KMS)
  attachment_ids uuid[] NOT NULL DEFAULT '{}',                                            -- v3.1 scanned uploads
  source_page  text,                                                                      -- v3.1
  locale       app_locale,
  ticket_id    uuid REFERENCES support_tickets(id) ON DELETE SET NULL,
  status       text NOT NULL DEFAULT 'new' CHECK (status IN ('new','triaged','routed','in_progress','answered','resolved','spam','closed')),  -- v3.1 + website statuses
  assigned_admin_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  sla_due_at   timestamptz,                                                               -- v3.1
  retention_until timestamptz,                                                            -- v3.1 (DN-24)
  ip           inet,
  user_agent   text,
  bot_score    real,
  created_at   timestamptz NOT NULL DEFAULT now(),
  safety_category web_safety_category_t,  -- v3.4 W11 W34
  spam_marked_at timestamptz,  -- v3.4 B64 A29d
  routed_to text,  -- v3.4 B64
  ip_prefix cidr,  -- v3.4 W44 truncated IP
  CONSTRAINT ck_contact_identity CHECK (kind = 'safety' OR (name IS NOT NULL AND email IS NOT NULL)),  -- v3.4 W1 anonymous safety report
  CONSTRAINT ck_contact_safety_cat CHECK (kind <> 'safety' OR safety_category IS NOT NULL)  -- v3.4 W11
);
CREATE INDEX idx_contact_open ON contact_submissions (kind, created_at) WHERE status IN ('new','triaged','routed','in_progress');
CREATE INDEX idx_contact_sla ON contact_submissions (sla_due_at) WHERE status IN ('new','triaged','routed','in_progress') AND sla_due_at IS NOT NULL;  -- v3.1
CREATE INDEX idx_contact_retention ON contact_submissions (retention_until) WHERE retention_until IS NOT NULL;  -- v3.1
COMMENT ON TABLE contact_submissions IS 'Website contact, support, press, investor, partnership, careers, safety, data-request, story, accessibility and other forms (rate-limited, bot-checked). v3.1: reference, topic, priority, encrypted payload, attachments, source page, SLA, retention_until, website statuses (triaged, in_progress, resolved); website type privacy maps to data_request, safety_report to safety. Admin A29 inbox. Retention 24 months (retention_until, DN-24). PII: personal.';

CREATE TABLE newsletter_subscribers (
  id               uuid PRIMARY KEY DEFAULT uuid_v7(),
  email_hash       sha256_hash NOT NULL UNIQUE,                            -- v3.1 dedupe / suppression lookups; v3.4 W20 the only lookup key (email_enc holds the address)
  locale           app_locale NOT NULL DEFAULT 'en',
  city             text,
  topics           text[] NOT NULL DEFAULT '{}',                           -- v3.1
  source           text NOT NULL DEFAULT 'website' CHECK (source IN ('website','waitlist','app','event')),
  source_page      text,                                                   -- v3.1
  referral_code    text,
  status           subscriber_status_t NOT NULL DEFAULT 'pending',
  confirm_token_hash sha256_hash UNIQUE,
  consent_text_hash sha256_hash NOT NULL,
  consent_text_version text,                                               -- v3.1
  consented_at     timestamptz,                                            -- v3.1
  confirmed_at     timestamptz,
  unsubscribed_at  timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  email_enc bytea,  -- v3.4 W20
  manage_token_hash sha256_hash UNIQUE,  -- v3.4 W21 W36
  last_confirm_sent_at timestamptz,  -- v3.4 W21
  campaign_code text CHECK (campaign_code ~ '^[a-z0-9-]{1,40}$'),  -- v3.4 W7
  src text CHECK (src IN ('web','qr','sms','email','social')),  -- v3.4 W7
  age_confirmed_at timestamptz,  -- v3.4 W35
  CONSTRAINT ck_newsletter_topics CHECK (topics <@ ARRAY['product_news','city_launches','safety_tips','circle','investor_updates']::text[])  -- v3.4 W31
);
CREATE INDEX idx_newsletter_status ON newsletter_subscribers (status, created_at);  -- v3.1 A29 list + purge
COMMENT ON TABLE newsletter_subscribers IS 'Website newsletter (double opt-in, W36). v3.1: topics, consent text version and time, source page, email hash, status complained. The pre-launch waitlist moved to waitlist_entries. Deleted on unsubscribe + 30 days; unconfirmed after 7 days. Admin A29 (export: newsletter.export, approval). PII: personal.';

-- ---------------------------------------------------------------------
-- 18.2 v3.1 New CMS tables (Appendix C.2)
-- ---------------------------------------------------------------------

-- C.2-2 Revision history for every CMS entity (snapshots on publish are
-- written by content_snapshot(); draft saves and restores by the API).
CREATE TABLE content_revisions (
  id          uuid PRIMARY KEY DEFAULT uuid_v7(),
  entity_type text NOT NULL CHECK (entity_type IN ('site_pages','site_blocks','stories','careers_jobs','investor_documents',
                'press_items','help_articles','legal_documents','faqs','journal_articles','site_settings','offer_campaigns')),
  entity_id   text NOT NULL,
  version     integer NOT NULL CHECK (version >= 1),
  kind        text NOT NULL DEFAULT 'save' CHECK (kind IN ('save','submit','approve','publish','unpublish','restore')),
  status      content_status_t,
  data        jsonb NOT NULL,
  comment     text CHECK (char_length(comment) <= 1000),
  created_by  uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id, version)
);
CREATE INDEX idx_revisions_entity ON content_revisions (entity_type, entity_id, version DESC);
CREATE TRIGGER trg_revisions_immutable BEFORE UPDATE OR DELETE ON content_revisions FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
COMMENT ON TABLE content_revisions IS 'v3.1 A28 Versions tab: append-only revision history with field-level diff and Restore (a restore writes a new draft). entity_id is text so composite or text keys (site_settings.key) fit. Retention: permanent (legal versions are immutable). PII: none (stories: personal).';

-- C.2-9 FAQ entries used by faq_list blocks, help and JSON-LD.
CREATE TABLE faqs (
  id          uuid PRIMARY KEY DEFAULT uuid_v7(),
  question    text NOT NULL CHECK (char_length(question) BETWEEN 3 AND 120),
  answer_md   text NOT NULL CHECK (char_length(answer_md) <= 1200),
  locale      app_locale NOT NULL DEFAULT 'en',
  topics      text[] NOT NULL DEFAULT '{}' CHECK (topics <@ ARRAY['home','plans','safety','download','offer','how_it_works']::text[]),
  sort        smallint NOT NULL DEFAULT 0,
  source_rule text,
  status      content_status_t NOT NULL DEFAULT 'draft',
  created_by  uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
  -- + common workflow / locale columns (section 18.3)
);
CREATE INDEX idx_faqs_topics ON faqs USING gin (topics) WHERE status = 'published';
CREATE INDEX idx_faqs_locale ON faqs (locale, sort) WHERE status = 'published';
COMMENT ON TABLE faqs IS 'v3.1 Website FAQ (W16 + pages): question (<= 120), answer (<= 1,200), topics, order and the canvas rule behind the answer (source_rule, internal). Admin A29. Retention: permanent. PII: none.';

-- C.2-10 Edge redirects. Chains longer than one hop and loops are refused.
CREATE TABLE redirects (
  id          uuid PRIMARY KEY DEFAULT uuid_v7(),
  from_path   text NOT NULL UNIQUE CHECK (from_path ~ '^/[A-Za-z0-9/_.~-]*$'),
  to_target   text CHECK (to_target ~ '^/' OR to_target ~ '^https://'),
  code        smallint NOT NULL DEFAULT 301 CHECK (code IN (301, 302, 410)),
  locale      app_locale,
  source      text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','slug_change','import')),
  expires_at  timestamptz,
  hits        bigint NOT NULL DEFAULT 0 CHECK (hits >= 0),
  last_hit_at timestamptz,
  created_by  uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK ((code = 410) = (to_target IS NULL)),
  CHECK (to_target IS NULL OR to_target <> from_path)
);
CREATE INDEX idx_redirects_target ON redirects (to_target);
CREATE INDEX idx_redirects_expiry ON redirects (expires_at) WHERE expires_at IS NOT NULL;
COMMENT ON TABLE redirects IS 'v3.1 Website edge redirects (A28 /content/redirects, permission site_settings.manage): from path (unique), to path or https URL, 301 / 302 / 410 (gone, e.g. a withdrawn story), optional locale and expiry, read-only hit counter. A published slug change writes a 301 automatically (site_slug_redirect). Retention: until expiry. PII: none.';

CREATE OR REPLACE FUNCTION redirects_no_chain() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.to_target IS NOT NULL AND EXISTS (SELECT 1 FROM redirects r WHERE r.from_path = NEW.to_target AND r.id <> NEW.id) THEN
    RAISE EXCEPTION 'redirect % -> % would chain (target is itself redirected)', NEW.from_path, NEW.to_target USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM redirects r WHERE r.to_target = NEW.from_path AND r.id <> NEW.id) THEN
    RAISE EXCEPTION 'redirect from % would chain (another redirect points to it)', NEW.from_path USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_redirects_no_chain BEFORE INSERT OR UPDATE OF from_path, to_target ON redirects FOR EACH ROW EXECUTE FUNCTION redirects_no_chain();
COMMENT ON FUNCTION redirects_no_chain() IS 'v3.1 Refuses loops and chains longer than one hop (A28).';

-- C.2-11 Site settings (singletons by key), including the website
-- maintenance switch and the offline banner text.
CREATE TABLE site_settings (
  key         text PRIMARY KEY CHECK (key IN ('navigation','socials','app','markets_default_order','banner','maintenance',
                'offline_message','consent','locales','company_facts','support_reply_times','emergency_numbers',
                'feature_flags','analytics','contacts','family')),   -- v3.4 W42 W02 1minit family links
  value       jsonb NOT NULL,
  version     integer NOT NULL DEFAULT 1,
  approval_id uuid REFERENCES admin_approvals(id) ON DELETE SET NULL,
  updated_by  uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (key <> 'maintenance' OR (coalesce(jsonb_typeof(value -> 'enabled'), '') = 'boolean'
         AND (NOT (value ->> 'enabled')::boolean OR coalesce(jsonb_typeof(value -> 'message'), '') = 'object'))),
  CHECK (key <> 'offline_message' OR (jsonb_typeof(value) = 'object' AND value ? 'en')),
  CHECK (key <> 'banner' OR coalesce(jsonb_typeof(value -> 'enabled'), '') = 'boolean'),
  CHECK (key <> 'emergency_numbers' OR jsonb_typeof(value) = 'array'),
  CHECK (key <> 'analytics' OR NOT jsonb_has_secret_keys(value))
);
CREATE TRIGGER trg_site_settings_upd BEFORE UPDATE ON site_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
COMMENT ON TABLE site_settings IS 'v3.1 Website site settings (A28 /content/settings, permission site_settings.manage): navigation, socials, app store links and QR targets, markets order, banner (W06), maintenance {enabled, message (L), until, status_url} and offline_message (L) for W38, consent banner config (W03), locales, company facts {label, value, source, as_of, approver}, support reply times, emergency numbers (W21, with verified_by / at; mirrors countries.emergency_number), site feature switches, analytics vendor and public site id, contact mailboxes. maintenance and emergency_numbers changes need an approval in production (enforce_config_approval). Retention: permanent (history in content_revisions). PII: none.';
COMMENT ON COLUMN site_settings.value IS 'v3.1 JSON per key; localised strings are {en, pcm, fr} maps with en required. Validated by packages/content-schema; shape CHECKs cover maintenance, offline_message, banner and emergency_numbers.';

-- C.2-15 Journal (W28).
CREATE TABLE journal_categories (
  id         smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug       text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{2,40}$'),
  name_key   text NOT NULL,
  sort       smallint NOT NULL DEFAULT 0,
  requires_ts_review boolean NOT NULL DEFAULT false,
  is_active  boolean NOT NULL DEFAULT true
);
COMMENT ON TABLE journal_categories IS 'v3.1 Journal categories (DN-30, e.g. Dating with intention, Safety, Product news). requires_ts_review: articles need a T&S reviewer (content.review_safety) before publish. Admin A29. Retention: permanent. PII: none.';

CREATE TABLE journal_authors (
  id          uuid PRIMARY KEY DEFAULT uuid_v7(),
  name        text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  role_key    text,
  photo_id    uuid REFERENCES media_library(id) ON DELETE SET NULL,
  consent_ref text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (photo_id IS NULL OR consent_ref IS NOT NULL)
);
COMMENT ON TABLE journal_authors IS 'v3.1 Journal authors (Appendix C.2-15 "authors"): name, role, optional photo with a consent reference. Admin A29. Retention: while referenced. PII: personal.';

CREATE TABLE journal_articles (
  id               uuid PRIMARY KEY DEFAULT uuid_v7(),
  slug             text NOT NULL CHECK (slug ~ '^[a-z0-9-]{2,80}$'),
  locale           app_locale NOT NULL DEFAULT 'en',
  title            text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 80),
  excerpt          text NOT NULL CHECK (char_length(excerpt) <= 160),
  category_id      smallint NOT NULL REFERENCES journal_categories(id),
  tags             text[] NOT NULL DEFAULT '{}',
  author_id        uuid REFERENCES journal_authors(id) ON DELETE SET NULL,
  hero_image_id    uuid REFERENCES media_library(id) ON DELETE SET NULL,
  body             jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(body) = 'array'),
  reading_time_min smallint CHECK (reading_time_min > 0),
  related_ids      uuid[] NOT NULL DEFAULT '{}' CHECK (cardinality(related_ids) <= 3),
  seo              jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(seo) = 'object'),
  medical_or_legal_review boolean NOT NULL DEFAULT false,
  reviewer_id      uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  status           content_status_t NOT NULL DEFAULT 'draft',
  published_at     timestamptz,
  created_by       uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slug, locale),
  CHECK (NOT medical_or_legal_review OR status NOT IN ('approved','scheduled','published') OR reviewer_id IS NOT NULL),
  is_featured boolean NOT NULL DEFAULT false  -- v3.4 W30 W28
  -- + common workflow / locale columns (section 18.3)
);
CREATE INDEX idx_journal_list ON journal_articles (locale, category_id, published_at DESC) WHERE status = 'published';
CREATE INDEX idx_journal_tags ON journal_articles USING gin (tags) WHERE status = 'published';
COMMENT ON TABLE journal_articles IS 'v3.1 Journal articles (W28 "articles"): title <= 80, excerpt <= 160, category, tags, author, hero image, portable rich-text body, related <= 3, SEO; health / legal topics need a named reviewer (CHECK). Admin A29. Retention: permanent. PII: none.';

-- C.2-14 Waitlist for non-launch cities (W25). Double opt-in; no queue positions.
CREATE TABLE waitlist_entries (
  id                 uuid PRIMARY KEY DEFAULT uuid_v7(),
  channel            text NOT NULL CHECK (channel IN ('email','sms','whatsapp')),
  identifier_enc     bytea,
  identifier_hash    sha256_hash NOT NULL,
  city_id            integer REFERENCES cities(id) ON DELETE SET NULL,
  city_text          text CHECK (char_length(city_text) <= 60),
  country            iso_country NOT NULL,
  i_am               text CHECK (i_am IN ('woman','man','prefer_not_to_say')),
  locale             app_locale NOT NULL DEFAULT 'en',
  status             text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','invited','notified','deleted')),  -- v3.4 W5 closed-beta invite
  consented_at       timestamptz NOT NULL,
  marketing_opt_in   boolean NOT NULL DEFAULT false,
  confirm_token_hash sha256_hash UNIQUE,
  source_page        text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  confirmed_at       timestamptz,
  notified_at        timestamptz,
  deleted_at         timestamptz,
  CHECK (city_id IS NOT NULL OR city_text IS NOT NULL),
  CHECK (status NOT IN ('confirmed','notified') OR confirmed_at IS NOT NULL),
  CHECK (status <> 'notified' OR notified_at IS NOT NULL),
  CHECK (status <> 'deleted' OR identifier_enc IS NULL),
  invited_at timestamptz,  -- v3.4 W5
  otp_challenge_id uuid REFERENCES otp_challenges(id) ON DELETE SET NULL,  -- v3.4 W4 phone OTP
  campaign_code text CHECK (campaign_code ~ '^[a-z0-9-]{1,40}$'),  -- v3.4 W7
  ref_code text CHECK (char_length(ref_code) <= 40),  -- v3.4 W7
  src text CHECK (src IN ('web','qr','sms','email','social')),  -- v3.4 W7
  age_confirmed_at timestamptz NOT NULL DEFAULT now(),  -- v3.4 W35
  CONSTRAINT ck_waitlist_invited CHECK (status <> 'invited' OR invited_at IS NOT NULL)  -- v3.4 W5
);
CREATE UNIQUE INDEX uq_waitlist_identifier_city ON waitlist_entries (identifier_hash, coalesce(city_id, 0), lower(coalesce(city_text, ''))) WHERE status <> 'deleted';
CREATE INDEX idx_waitlist_city ON waitlist_entries (city_id, confirmed_at) WHERE status = 'confirmed';
CREATE INDEX idx_waitlist_pending ON waitlist_entries (created_at) WHERE status = 'pending';
COMMENT ON TABLE waitlist_entries IS 'v3.1 W25 waitlist: identifier encrypted (KMS) + SHA-256 hash, one entry per identifier per city (unique index), city from cities or free text <= 60, optional i_am (DN-20). Unconfirmed entries deleted after 7 days; after the "now open" message entries without marketing opt-in are deleted 30 days later (website §5.3). Admin A29 (counts, export with approval). PII: personal.';

-- C.2-16 Cookie consent receipts (W03). No IP, no user agent.
CREATE TABLE consent_receipts (
  receipt_id     uuid PRIMARY KEY DEFAULT uuid_v7(),
  choices        jsonb NOT NULL CHECK (jsonb_typeof(choices) = 'object' AND choices ? 'analytics' AND choices ? 'marketing'),
  policy_version text NOT NULL CHECK (policy_version ~ '^[0-9]+\.[0-9]+(\.[0-9]+)?$'),
  gpc            boolean NOT NULL DEFAULT false,
  locale         app_locale NOT NULL DEFAULT 'en',
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT gpc OR (choices ->> 'marketing') = 'false'),
  retention_until timestamptz  -- v3.4 W43 DN-24
);
CREATE INDEX idx_consent_receipts_brin ON consent_receipts USING brin (created_at);
CREATE INDEX idx_consent_receipts_version ON consent_receipts (policy_version, created_at);
CREATE TRIGGER trg_consent_receipts_immutable BEFORE UPDATE OR DELETE ON consent_receipts FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
COMMENT ON TABLE consent_receipts IS 'v3.1 Pseudonymous cookie-consent log for NDPA accountability (POST /consent-receipts): random receipt id (also in the mm_consent cookie), choices, policy version, GPC flag (GPC means marketing off: CHECK), locale, time. Never an IP or user agent. Append-only. Admin A29 (privacy.requests). Retention: DECIDED (19 Nov 2026, OD-31 / T-9, DN-24): period set with the lawyer in the OD-10 review; retention_until and the deletion job are built now; purged by retention.purge. PII: none (pseudonymous).';

-- ---------------------------------------------------------------------
-- 18.2b v3.1 Offers (Appendix C.1 rows 23-26; website W24 and §5.2; A22)
-- ---------------------------------------------------------------------
CREATE TABLE offer_campaigns (
  id                 uuid PRIMARY KEY DEFAULT uuid_v7(),
  slug               text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{2,60}$'),
  name               jsonb NOT NULL CHECK (jsonb_typeof(name) = 'object' AND name ? 'en' AND char_length(name ->> 'en') <= 40),
  type               text NOT NULL CHECK (type IN ('fee_waiver','store_trial_code','store_one_time_code')),
  eligible_countries iso_country[] NOT NULL DEFAULT '{}',
  eligible_city_ids  integer[] NOT NULL DEFAULT '{}',
  starts_at          timestamptz NOT NULL,
  ends_at            timestamptz NOT NULL,
  cap_total          integer CHECK (cap_total >= 1),
  cap_per_identifier smallint NOT NULL DEFAULT 1 CHECK (cap_per_identifier >= 1),
  delivery_channels  text[] NOT NULL DEFAULT '{email}' CHECK (cardinality(delivery_channels) >= 1 AND delivery_channels <@ ARRAY['email','sms','whatsapp']::text[]),
  terms_document_id  uuid REFERENCES legal_documents(id) ON DELETE RESTRICT,
  abuse_rules        jsonb NOT NULL DEFAULT '{"max_claims_per_ip_prefix_per_hour": null, "circuit_breaker_claims_per_minute": null, "min_seconds_to_submit": null, "block_disposable_email": true, "block_voip": true}'::jsonb
                       CHECK (jsonb_typeof(abuse_rules) = 'object'),
  status             text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','live','paused','ended')),
  paused_reason      text CHECK (paused_reason IN ('manual','circuit_breaker','pool_empty')),
  approval_id        uuid REFERENCES admin_approvals(id) ON DELETE SET NULL,
  created_by         uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  ended_at           timestamptz,
  CHECK (ends_at > starts_at),
  CHECK (status = 'draft' OR (cardinality(eligible_countries) >= 1 AND terms_document_id IS NOT NULL AND approval_id IS NOT NULL)),
  CHECK ((status = 'paused') = (paused_reason IS NOT NULL)),
  CHECK (status <> 'ended' OR ended_at IS NOT NULL)
);
CREATE TRIGGER trg_offer_campaigns_upd BEFORE UPDATE ON offer_campaigns FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_offer_live_end ON offer_campaigns (ends_at) WHERE status IN ('live','paused');
COMMENT ON TABLE offer_campaigns IS 'v3.1 A22 / W24 offers (AD-22, website DN-01). v3.2 DECIDED (18 Nov 2026, OD-01): no launch offer; the module stays in the design but is off at launch (feature flag offers.enabled = false, enforced by offer_campaign_guard). Types: fee_waiver (O1, no code), store_trial_code (O2), store_one_time_code (O3). Going live needs a published offer_terms legal document and an approved offers.publish approval (offer_campaign_guard); while live, eligibility / caps / dates changes need a new approval. Job offers.end sets ended at ends_at. abuse_rules thresholds are null until tuned (defaults to be tuned, not targets). Retention: permanent. PII: none.';
COMMENT ON COLUMN offer_campaigns.abuse_rules IS 'v3.1 {max_claims_per_ip_prefix_per_hour, circuit_breaker_claims_per_minute, min_seconds_to_submit, block_disposable_email, block_voip}. Null numbers = rule off. Enforced in offer_claim_guard() (IP prefix, circuit breaker) and the API (time-to-submit, disposable / VoIP).';

CREATE TABLE offer_code_pools (
  id              uuid PRIMARY KEY DEFAULT uuid_v7(),
  campaign_id     uuid NOT NULL REFERENCES offer_campaigns(id) ON DELETE CASCADE,
  platform        platform_t NOT NULL CHECK (platform IN ('ios','android')),
  store_offer_ref text NOT NULL,
  total           integer NOT NULL DEFAULT 0 CHECK (total >= 0),
  low_water_pct   smallint NOT NULL DEFAULT 10 CHECK (low_water_pct BETWEEN 1 AND 99),
  low_water_alerted_at timestamptz,
  expires_at      timestamptz,
  imported_by     uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  imported_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, platform, store_offer_ref)
);
COMMENT ON TABLE offer_code_pools IS 'v3.1 A22 code pools: one per campaign, platform and store offer reference (App Store offer code / Play promo code batch), imported by CSV (offers.codes.import: re-auth). Low-water alert at low_water_pct (10% default, website §5.2) from v_offer_pool_stock. Retention: offer end + 1 year. PII: none.';

CREATE TABLE offer_claims (
  id                uuid PRIMARY KEY DEFAULT uuid_v7(),
  campaign_id       uuid NOT NULL REFERENCES offer_campaigns(id) ON DELETE CASCADE,
  channel           text NOT NULL CHECK (channel IN ('email','sms','whatsapp')),
  identifier_enc    bytea,
  identifier_hash   sha256_hash NOT NULL,
  claim_no          smallint CHECK (claim_no >= 1),
  country           iso_country NOT NULL,
  platform          platform_t CHECK (platform IN ('ios','android')),
  status            text NOT NULL DEFAULT 'pending_verification' CHECK (status IN ('pending_verification','verified','issued','redeemed','rejected','expired','voided')),
  rejection_code    text CHECK (rejection_code IN ('not_eligible_country','offer_ended','offer_not_live','cap_reached','already_claimed',
                      'invalid_phone','voip_blocked','disposable_email','rate_limited','circuit_breaker','channel_not_offered')),
  ip_prefix         cidr CHECK (ip_prefix IS NULL OR (family(ip_prefix) = 4 AND masklen(ip_prefix) = 24) OR (family(ip_prefix) = 6 AND masklen(ip_prefix) = 48)),
  marketing_opt_in  boolean NOT NULL DEFAULT false,
  age_confirmed_at  timestamptz NOT NULL DEFAULT now(),
  terms_accepted_at timestamptz NOT NULL DEFAULT now(),
  source            text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  verified_at       timestamptz,
  issued_at         timestamptz,
  redeemed_at       timestamptz,
  voided_at         timestamptz,
  UNIQUE (campaign_id, identifier_hash, claim_no),
  CHECK ((status = 'rejected') = (rejection_code IS NOT NULL)),
  CHECK (status <> 'rejected' OR claim_no IS NULL),
  CHECK (status = 'rejected' OR claim_no IS NOT NULL),
  CHECK (status NOT IN ('verified','issued','redeemed') OR verified_at IS NOT NULL),
  CHECK (status NOT IN ('issued','redeemed') OR issued_at IS NOT NULL)
);
CREATE INDEX idx_offer_claims_identifier ON offer_claims (campaign_id, identifier_hash);
CREATE INDEX idx_offer_claims_prefix ON offer_claims (campaign_id, ip_prefix, created_at DESC) WHERE ip_prefix IS NOT NULL;
CREATE INDEX idx_offer_claims_list ON offer_claims (campaign_id, status, created_at DESC);
CREATE INDEX idx_offer_claims_rejected ON offer_claims (campaign_id, rejection_code, created_at DESC) WHERE status = 'rejected';
CREATE INDEX idx_offer_claims_brin ON offer_claims USING brin (created_at);
COMMENT ON TABLE offer_claims IS 'v3.1 A22 claims / W24 form. Anti-abuse in the database (offer_claim_guard): one claim per normalised identifier hash per campaign up to cap_per_identifier (claim_no + UNIQUE), eligible country, live window, cap_total, per-IP-prefix hourly limit and a circuit breaker that pauses the campaign. Rejected attempts are kept with a reason code for the abuse review queue (claim_no NULL). Plain identifiers (identifier_enc) are deleted 30 days after the offer ends unless marketing_opt_in (website DN-24, job offers.purge_identifiers). PII: personal.';
COMMENT ON COLUMN offer_claims.claim_no IS 'v3.1 1..cap_per_identifier for accepted claims of the same identifier; NULL for rejected rows. UNIQUE (campaign_id, identifier_hash, claim_no) is the race-proof backstop of the one-per-person rule.';

CREATE TABLE offer_codes (
  id          uuid PRIMARY KEY DEFAULT uuid_v7(),
  pool_id     uuid NOT NULL REFERENCES offer_code_pools(id) ON DELETE CASCADE,
  code_enc    bytea,
  code_hash   sha256_hash NOT NULL UNIQUE,
  status      text NOT NULL DEFAULT 'available' CHECK (status IN ('available','issued','redeemed','expired','voided')),
  claim_id    uuid UNIQUE REFERENCES offer_claims(id) ON DELETE SET NULL,
  issued_at   timestamptz,
  redeemed_at timestamptz,
  voided_at   timestamptz,
  void_reason text,
  CHECK ((status = 'available') = (code_enc IS NOT NULL)),
  CHECK (status NOT IN ('issued','redeemed') OR (claim_id IS NOT NULL AND issued_at IS NOT NULL)),
  CHECK (status <> 'voided' OR voided_at IS NOT NULL)
);
CREATE INDEX idx_offer_codes_available ON offer_codes (pool_id) WHERE status = 'available';
CREATE INDEX idx_offer_codes_pool_status ON offer_codes (pool_id, status);
COMMENT ON TABLE offer_codes IS 'v3.1 A22 single-use store codes. Encrypted at rest (code_enc, KMS) only while available; on issue code_enc is wiped (CHECK) and only code_hash remains, so the plain code exists only in the delivery message and the one API response (website §5.2). One code per claim (UNIQUE claim_id). Never shown in the console after import. Retention: offer end + 1 year. PII: none.';

-- Going live / changes while live (A22 approvals).
CREATE OR REPLACE FUNCTION offer_campaign_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'live' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'live') THEN
    IF NOT coalesce((SELECT f.enabled FROM feature_flags f WHERE f.key = 'offers.enabled'), false) THEN   -- v3.2 OD-01
      RAISE EXCEPTION 'offer % cannot go live: offers are off (feature flag offers.enabled = false, OD-01)', NEW.slug USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM legal_documents d WHERE d.id = NEW.terms_document_id AND d.kind = 'offer_terms' AND d.status = 'published') THEN
      RAISE EXCEPTION 'offer % cannot go live without a published offer_terms document', NEW.slug USING ERRCODE = '23514';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM admin_approvals a WHERE a.id = NEW.approval_id AND a.permission_key = 'offers.publish'
                   AND a.status IN ('approved','executed')) THEN
      RAISE EXCEPTION 'offer % needs an approved offers.publish approval to go live', NEW.slug USING ERRCODE = '42501';
    END IF;
    NEW.paused_reason := NULL;
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'live' AND NEW.status = 'live'
        AND (NEW.eligible_countries, NEW.eligible_city_ids, NEW.cap_total, NEW.cap_per_identifier, NEW.starts_at, NEW.ends_at)
            IS DISTINCT FROM (OLD.eligible_countries, OLD.eligible_city_ids, OLD.cap_total, OLD.cap_per_identifier, OLD.starts_at, OLD.ends_at)
        AND NEW.approval_id IS NOT DISTINCT FROM OLD.approval_id THEN
    RAISE EXCEPTION 'changing eligibility, caps or dates of live offer % needs a new approval', NEW.slug USING ERRCODE = '42501';
  END IF;
  IF NEW.status = 'ended' AND NEW.ended_at IS NULL THEN NEW.ended_at := now(); END IF;
  IF NEW.status <> 'paused' THEN NEW.paused_reason := NULL; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_offer_campaign_guard BEFORE INSERT OR UPDATE ON offer_campaigns FOR EACH ROW EXECUTE FUNCTION offer_campaign_guard();
COMMENT ON FUNCTION offer_campaign_guard() IS 'v3.1 A22: live needs feature flag offers.enabled ON (v3.2, OD-01: off at launch), published offer_terms + approved offers.publish; live changes to eligibility, caps or dates need a new approval.';

-- Claim anti-abuse (website §5.2). Serialised per campaign by the row lock.
CREATE OR REPLACE FUNCTION offer_claim_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  c offer_campaigns%ROWTYPE;
  v_mine int; v_n int; v_lim int; v_code text;
BEGIN
  SELECT * INTO c FROM offer_campaigns WHERE id = NEW.campaign_id FOR UPDATE;
  IF NEW.status = 'rejected' THEN            -- rejected upstream by the API (invalid_phone, voip_blocked, disposable_email ...)
    NEW.claim_no := NULL;
    RETURN NEW;
  END IF;
  NEW.status := 'pending_verification';
  v_code := CASE
    WHEN c.status <> 'live' OR now() < c.starts_at THEN 'offer_not_live'
    WHEN now() >= c.ends_at                         THEN 'offer_ended'
    WHEN NOT (NEW.country = ANY (c.eligible_countries)) THEN 'not_eligible_country'
    WHEN NOT (NEW.channel = ANY (c.delivery_channels))  THEN 'channel_not_offered'
  END;
  SELECT count(*) INTO v_mine FROM offer_claims
   WHERE campaign_id = c.id AND identifier_hash = NEW.identifier_hash AND claim_no IS NOT NULL;
  IF v_code IS NULL AND v_mine >= c.cap_per_identifier THEN v_code := 'already_claimed'; END IF;
  IF v_code IS NULL AND c.cap_total IS NOT NULL THEN
    SELECT count(*) INTO v_n FROM offer_claims WHERE campaign_id = c.id AND claim_no IS NOT NULL AND status NOT IN ('expired','voided');
    IF v_n >= c.cap_total THEN v_code := 'cap_reached'; END IF;
  END IF;
  v_lim := (c.abuse_rules ->> 'max_claims_per_ip_prefix_per_hour')::int;
  IF v_code IS NULL AND v_lim IS NOT NULL AND NEW.ip_prefix IS NOT NULL THEN
    SELECT count(*) INTO v_n FROM offer_claims
     WHERE campaign_id = c.id AND ip_prefix = NEW.ip_prefix AND created_at > now() - interval '1 hour';
    IF v_n >= v_lim THEN v_code := 'rate_limited'; END IF;
  END IF;
  v_lim := (c.abuse_rules ->> 'circuit_breaker_claims_per_minute')::int;
  IF v_code IS NULL AND v_lim IS NOT NULL THEN
    SELECT count(*) INTO v_n FROM offer_claims
     WHERE campaign_id = c.id AND claim_no IS NOT NULL AND created_at > now() - interval '1 minute';
    IF v_n >= v_lim THEN
      UPDATE offer_campaigns SET status = 'paused', paused_reason = 'circuit_breaker' WHERE id = c.id;
      v_code := 'circuit_breaker';
    END IF;
  END IF;
  IF v_code IS NOT NULL THEN
    NEW.status := 'rejected'; NEW.rejection_code := v_code; NEW.claim_no := NULL;
  ELSE
    NEW.rejection_code := NULL; NEW.claim_no := v_mine + 1;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_offer_claim_guard BEFORE INSERT ON offer_claims FOR EACH ROW EXECUTE FUNCTION offer_claim_guard();
COMMENT ON FUNCTION offer_claim_guard() IS 'v3.1 BEFORE INSERT on offer_claims: live window, eligible country, delivery channel, cap_per_identifier (already_claimed), cap_total, IP-prefix hourly limit and circuit breaker (pauses the campaign). Failing claims are stored as rejected with the reason code (A22 abuse review) and never get a claim_no, so they never count as a claim.';

-- Atomic code allocation after verification (website §5.2 step 5).
CREATE OR REPLACE FUNCTION offer_issue_code(p_claim uuid)
RETURNS TABLE (o_code_id uuid, o_code_enc bytea) LANGUAGE plpgsql AS $$
DECLARE cl offer_claims%ROWTYPE; v_id uuid; v_enc bytea;
BEGIN
  SELECT * INTO cl FROM offer_claims WHERE id = p_claim FOR UPDATE;
  IF NOT FOUND OR cl.status <> 'verified' THEN
    RAISE EXCEPTION 'claim % is not verified', p_claim USING ERRCODE = '22023';
  END IF;
  IF cl.platform IS NULL THEN
    RAISE EXCEPTION 'claim % has no platform (ask iPhone or Android first)', p_claim USING ERRCODE = '22023';
  END IF;
  SELECT oc.id, oc.code_enc INTO v_id, v_enc
    FROM offer_codes oc JOIN offer_code_pools p ON p.id = oc.pool_id
   WHERE p.campaign_id = cl.campaign_id AND p.platform = cl.platform AND oc.status = 'available'
     AND (p.expires_at IS NULL OR p.expires_at > now())
   ORDER BY p.expires_at NULLS LAST, oc.id
   LIMIT 1
   FOR UPDATE OF oc SKIP LOCKED;
  IF v_id IS NULL THEN
    UPDATE offer_campaigns SET status = 'paused', paused_reason = 'pool_empty' WHERE id = cl.campaign_id AND status = 'live';
    RETURN;
  END IF;
  UPDATE offer_codes SET status = 'issued', claim_id = cl.id, issued_at = now(), code_enc = NULL WHERE id = v_id;
  UPDATE offer_claims SET status = 'issued', issued_at = now() WHERE id = cl.id;
  o_code_id := v_id; o_code_enc := v_enc;
  RETURN NEXT;
END $$;
COMMENT ON FUNCTION offer_issue_code(uuid) IS 'v3.1 Allocates one available code for a verified claim (SKIP LOCKED, one per claim), wipes the encrypted value and returns it once for delivery. No code left: the campaign pauses (pool_empty) and no row is returned.';

CREATE OR REPLACE FUNCTION offer_end_expired() RETURNS integer LANGUAGE plpgsql AS $$
DECLARE n int;
BEGIN
  UPDATE offer_campaigns SET status = 'ended' WHERE status IN ('live','paused') AND ends_at <= now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
COMMENT ON FUNCTION offer_end_expired() IS 'v3.1 Job offers.end: ends campaigns at ends_at (the website switches to the ended state and drops the route from the sitemap).';

-- ---------------------------------------------------------------------
-- 18.3 v3.1 Content workflow contract (website §6.1 / §6.7, A28, AD-20)
--   draft -> in_review -> approved -> (scheduled) -> published -> archived
--   Common columns added to every CMS table below; one guard trigger
--   enforces the transitions, the two-person rule, scheduling and the
--   native-review gate for pcm / fr; a snapshot trigger writes a
--   content_revisions row on every publish; content_run_schedule() is the
--   content.schedule job (every minute).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION content_workflow_tables() RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['site_pages','site_blocks','stories','careers_jobs','investor_documents','press_items',
               'help_articles','legal_documents','faqs','journal_articles']::text[];
$$;
COMMENT ON FUNCTION content_workflow_tables() IS 'v3.1 The 10 CMS tables that carry the common workflow columns and triggers.';

CREATE OR REPLACE FUNCTION content_workflow_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_old text;
  v_new text := NEW.status::text;
  j     jsonb := to_jsonb(NEW);
  v_allowed constant text[] := ARRAY[
    'draft>in_review','draft>archived',
    'in_review>draft','in_review>approved','in_review>archived',
    'approved>draft','approved>scheduled','approved>published','approved>archived',
    'scheduled>approved','scheduled>draft','scheduled>published','scheduled>archived',
    'published>archived','published>draft',   -- v3.4 B2: editing a published item starts a new draft; the live revision keeps serving
    'archived>draft'];
BEGIN
  IF TG_OP = 'UPDATE' THEN v_old := OLD.status::text; END IF;

  IF TG_OP = 'UPDATE' AND v_old IS DISTINCT FROM v_new THEN
    IF NOT ((v_old || '>' || v_new) = ANY (v_allowed)) THEN
      RAISE EXCEPTION 'content workflow: % -> % is not allowed on %', v_old, v_new, TG_TABLE_NAME USING ERRCODE = '23514';
    END IF;
    IF v_old = 'published' AND v_new = 'draft' AND TG_TABLE_NAME = 'legal_documents' THEN
      RAISE EXCEPTION 'content workflow: a published legal document never changes; create a new version' USING ERRCODE = '23514';  -- v3.4 B39
    END IF;
    IF v_new = 'in_review' THEN NEW.submitted_at := now(); END IF;
    IF v_new = 'draft' THEN NEW.approved_by := NULL; NEW.approved_at := NULL; END IF;   -- an edit voids the approval
    IF v_new = 'approved' THEN
      IF NEW.approved_by IS NULL THEN
        RAISE EXCEPTION 'content workflow: approving % needs approved_by', TG_TABLE_NAME USING ERRCODE = '23514';
      END IF;
      IF NEW.approved_by = NEW.updated_by THEN
        RAISE EXCEPTION 'content workflow: two-person rule, the approver cannot be the last editor' USING ERRCODE = '42501';
      END IF;
      NEW.approved_at := now();
    END IF;
    IF v_new = 'published' AND v_old = 'scheduled' AND NEW.publish_at > now() THEN
      RAISE EXCEPTION 'content workflow: % is scheduled for % and is not due yet', TG_TABLE_NAME, NEW.publish_at USING ERRCODE = '23514';
    END IF;
    IF v_new = 'published' AND NEW.approved_by IS NULL THEN
      RAISE EXCEPTION 'content workflow: % must be approved before it is published', TG_TABLE_NAME USING ERRCODE = '23514';
    END IF;
  END IF;

  -- Scheduling: entering scheduled, or moving the time of a scheduled item.
  IF v_new = 'scheduled' AND (TG_OP = 'INSERT' OR v_old IS DISTINCT FROM 'scheduled' OR NEW.publish_at IS DISTINCT FROM OLD.publish_at)
     AND (NEW.publish_at IS NULL OR NEW.publish_at <= now()) THEN
    RAISE EXCEPTION 'content workflow: publish_at must be in the future to schedule' USING ERRCODE = '23514';
  END IF;

  IF v_new = 'published' AND (TG_OP = 'INSERT' OR v_old IS DISTINCT FROM 'published') THEN
    IF (j ->> 'locale') IN ('pcm','fr') AND (j ->> 'native_reviewed_at') IS NULL THEN
      RAISE EXCEPTION 'content workflow: % (%) needs a native-speaker review before publishing', TG_TABLE_NAME, j ->> 'locale' USING ERRCODE = '23514';
    END IF;
    IF TG_TABLE_NAME = 'stories' AND (j ->> 'consent_status') IS DISTINCT FROM 'active' THEN
      RAISE EXCEPTION 'content workflow: a story needs active two-party consent to publish' USING ERRCODE = '23514';
    END IF;
    NEW.published_at := now();
    NEW.archived_at := NULL;
  END IF;
  -- v3.4 B2 live-revision pointer: every publish (or new version while published) gets a new
  -- snapshot id, written by content_snapshot(); it stays live while a newer draft is reviewed.
  IF v_new = 'published' AND (TG_OP = 'INSERT' OR v_old IS DISTINCT FROM 'published' OR NEW.version IS DISTINCT FROM OLD.version) THEN
    NEW.live_revision_id := uuid_v7();
    NEW.live_version := NEW.version::text;
  END IF;
  IF v_new = 'archived' AND (TG_OP = 'INSERT' OR v_old IS DISTINCT FROM 'archived') THEN
    NEW.archived_at := now();
    NEW.live_revision_id := NULL;            -- v3.4 B2 archived = offline
    NEW.live_version := NULL;
  END IF;
  RETURN NEW;
END $$;
COMMENT ON FUNCTION content_workflow_guard() IS 'v3.4 B2: published -> draft starts a new version while live_revision_id keeps the published snapshot live (not for legal_documents, which are row-per-version); publish sets a new live_revision_id; archive clears it. v3.1 BEFORE INSERT OR UPDATE on every CMS table: allowed transitions only (draft -> in_review -> approved -> scheduled -> published -> archived, with returns to draft); approve needs approved_by <> updated_by (two-person rule); schedule needs a future publish_at; a scheduled item cannot be published early; publish needs an approval, native review for pcm / fr, and for stories active consent. Stamps submitted_at, approved_at, published_at, archived_at.';

CREATE OR REPLACE FUNCTION content_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_first boolean;
BEGIN
  IF NEW.status <> 'published' THEN RETURN NULL; END IF;
  IF TG_OP = 'INSERT' THEN v_first := true;
  ELSE v_first := (OLD.status IS DISTINCT FROM 'published' OR OLD.version IS DISTINCT FROM NEW.version);
  END IF;
  IF v_first THEN
    INSERT INTO content_revisions (id, entity_type, entity_id, version, kind, status, data, created_by)
    SELECT coalesce(NEW.live_revision_id, uuid_v7()), TG_TABLE_NAME, NEW.id::text, coalesce(max(r.version), 0) + 1, 'publish', 'published', to_jsonb(NEW),   -- v3.4 B2 id = live_revision_id
           coalesce(NEW.published_by, NEW.approved_by)
      FROM content_revisions r WHERE r.entity_type = TG_TABLE_NAME AND r.entity_id = NEW.id::text;
  END IF;
  RETURN NULL;
END $$;
COMMENT ON FUNCTION content_snapshot() IS 'v3.1 AFTER INSERT OR UPDATE: writes an immutable publish snapshot to content_revisions whenever an item becomes published (or a published item gets a new version).';

DO $$
DECLARE t text; has_locale boolean;
BEGIN
  FOREACH t IN ARRAY content_workflow_tables() LOOP
    has_locale := EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_name = t AND c.column_name = 'locale');
    EXECUTE format('ALTER TABLE %I
      ADD COLUMN IF NOT EXISTS updated_by   uuid REFERENCES admin_users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
      ADD COLUMN IF NOT EXISTS approved_by  uuid REFERENCES admin_users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS approved_at  timestamptz,
      ADD COLUMN IF NOT EXISTS published_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS published_at timestamptz,
      ADD COLUMN IF NOT EXISTS publish_at   timestamptz,
      ADD COLUMN IF NOT EXISTS unpublish_at timestamptz,
      ADD COLUMN IF NOT EXISTS archived_at  timestamptz,
      ADD COLUMN IF NOT EXISTS review_comment text,
      ADD COLUMN IF NOT EXISTS version      integer NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS updated_at   timestamptz NOT NULL DEFAULT now(),
      ADD COLUMN IF NOT EXISTS live_revision_id uuid REFERENCES content_revisions(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,  -- v3.4 B2
      ADD COLUMN IF NOT EXISTS live_version text,                                                                                       -- v3.4 B2
      ADD CONSTRAINT %I CHECK (unpublish_at IS NULL OR publish_at IS NULL OR unpublish_at > publish_at),
      ADD CONSTRAINT %I CHECK (status <> ''scheduled'' OR publish_at IS NOT NULL),
      ADD CONSTRAINT %I CHECK (status NOT IN (''approved'',''scheduled'') OR approved_by IS NOT NULL),
      ADD CONSTRAINT %I CHECK (status <> ''published'' OR published_at IS NOT NULL),
      ADD CONSTRAINT %I CHECK (status <> ''archived'' OR archived_at IS NOT NULL)',
      t, 'ck_' || t || '_wf_window', 'ck_' || t || '_wf_scheduled', 'ck_' || t || '_wf_approved',
      'ck_' || t || '_wf_published', 'ck_' || t || '_wf_archived');
    IF has_locale THEN
      EXECUTE format('ALTER TABLE %I
        ADD COLUMN IF NOT EXISTS translation_group_id uuid,
        ADD COLUMN IF NOT EXISTS native_reviewed_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS native_reviewed_at timestamptz,
        ADD COLUMN IF NOT EXISTS fallback_to_en boolean NOT NULL DEFAULT false,
        ADD CONSTRAINT %I CHECK ((native_reviewed_at IS NULL) = (native_reviewed_by IS NULL))',
        t, 'ck_' || t || '_wf_native');
      EXECUTE format('CREATE INDEX %I ON %I (translation_group_id) WHERE translation_group_id IS NOT NULL', 'idx_' || t || '_wf_tgroup', t);
      EXECUTE format('COMMENT ON COLUMN %I.translation_group_id IS %L', t, 'v3.1 Groups the locale variants (row-per-locale model) of one item.');
      EXECUTE format('COMMENT ON COLUMN %I.native_reviewed_at IS %L', t, 'v3.1 Native-speaker review (localisation reviewer). pcm / fr rows cannot be published without it (content_workflow_guard).');
      EXECUTE format('COMMENT ON COLUMN %I.fallback_to_en IS %L', t, 'v3.1 This locale is not published; the website renders the en variant with lang="en" and marks the fallback.');
    END IF;
    EXECUTE format('CREATE INDEX %I ON %I (publish_at) WHERE status = ''scheduled''', 'idx_' || t || '_wf_due', t);
    EXECUTE format('CREATE INDEX %I ON %I (unpublish_at) WHERE status = ''published'' AND unpublish_at IS NOT NULL', 'idx_' || t || '_wf_unpub', t);
    EXECUTE format('CREATE INDEX %I ON %I (status, updated_at DESC) WHERE status IN (''in_review'',''approved'',''scheduled'')', 'idx_' || t || '_wf_queue', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION content_workflow_guard()', 'trg_' || t || '_workflow', t);
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION content_snapshot()', 'trg_' || t || '_snapshot', t);
    IF NOT EXISTS (SELECT 1 FROM pg_trigger g WHERE g.tgrelid = t::regclass AND g.tgfoid = 'set_updated_at'::regproc) THEN
      EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', 'trg_' || t || '_wf_upd', t);
    END IF;
    EXECUTE format('COMMENT ON COLUMN %I.publish_at IS %L', t, 'v3.1 Scheduled publish time (UTC, shown in WAT). Required for status scheduled; content.schedule publishes at the time.');
    EXECUTE format('COMMENT ON COLUMN %I.unpublish_at IS %L', t, 'v3.1 Scheduled unpublish (archive) time; must be after publish_at.');
    EXECUTE format('COMMENT ON COLUMN %I.approved_by IS %L', t, 'v3.1 Reviewer who approved (content.review / review_legal / review_safety). Two-person rule: never the last editor (updated_by).');
    EXECUTE format('COMMENT ON COLUMN %I.live_revision_id IS %L', t, 'v3.4 B2 The publish snapshot (content_revisions) the website serves. Stays set while a newer draft is edited or reviewed (A28 "v3 live, v4 in review"); replaced on the next publish; cleared on archive.');
  END LOOP;
END $$;

-- Published slug changes write a 301 (website §6.1, A28). TG_ARGV[0] = path prefix.
CREATE OR REPLACE FUNCTION site_path(p_locale text, p_prefix text, p_slug text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN coalesce(p_locale, 'en') = 'en' THEN p_prefix || p_slug
              WHEN p_prefix || p_slug = '/' THEN '/' || p_locale
              ELSE '/' || p_locale || p_prefix || p_slug END;
$$;
COMMENT ON FUNCTION site_path(text, text, text) IS 'v3.1 Public path of a CMS item: en at the root, pcm / fr under /pcm and /fr.';

CREATE OR REPLACE FUNCTION site_slug_redirect() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_loc text := to_jsonb(NEW) ->> 'locale';
  v_old text := site_path(v_loc, TG_ARGV[0], OLD.slug);
  v_new text := site_path(v_loc, TG_ARGV[0], NEW.slug);
BEGIN
  IF OLD.slug IS DISTINCT FROM NEW.slug AND OLD.published_at IS NOT NULL THEN
    DELETE FROM redirects WHERE from_path = v_new;                       -- the item now lives there
    UPDATE redirects SET to_target = v_new WHERE to_target = v_old;      -- collapse chains to one hop
    INSERT INTO redirects (from_path, to_target, code, locale, source, created_by)
    VALUES (v_old, v_new, 301, v_loc::app_locale, 'slug_change', NEW.updated_by)
    ON CONFLICT (from_path) DO UPDATE SET to_target = EXCLUDED.to_target, code = 301, source = 'slug_change';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_site_pages_slug AFTER UPDATE OF slug ON site_pages FOR EACH ROW EXECUTE FUNCTION site_slug_redirect('');
CREATE TRIGGER trg_journal_slug AFTER UPDATE OF slug ON journal_articles FOR EACH ROW EXECUTE FUNCTION site_slug_redirect('/journal/');
CREATE TRIGGER trg_stories_slug AFTER UPDATE OF slug ON stories FOR EACH ROW EXECUTE FUNCTION site_slug_redirect('/stories/');
CREATE TRIGGER trg_careers_slug AFTER UPDATE OF slug ON careers_jobs FOR EACH ROW EXECUTE FUNCTION site_slug_redirect('/careers/');
COMMENT ON FUNCTION site_slug_redirect() IS 'v3.1 AFTER UPDATE OF slug: once an item has been published, the old path 301-redirects to the new one; existing redirects to the old path are re-pointed (no chains).';

-- Scheduler (job content.schedule, every minute). One bad row never blocks the rest.
CREATE OR REPLACE FUNCTION content_run_schedule()
RETURNS TABLE (o_entity_type text, o_published int, o_archived int, o_failed int) LANGUAGE plpgsql AS $$
DECLARE t text; v_id uuid; p int; a int; f int;
BEGIN
  FOREACH t IN ARRAY content_workflow_tables() LOOP
    p := 0; a := 0; f := 0;
    FOR v_id IN EXECUTE format('SELECT id FROM %I WHERE status = ''scheduled'' AND publish_at <= now() ORDER BY publish_at FOR UPDATE SKIP LOCKED', t) LOOP
      BEGIN
        EXECUTE format('UPDATE %I SET status = ''published'' WHERE id = $1', t) USING v_id;
        p := p + 1;
      EXCEPTION WHEN others THEN
        f := f + 1;
        RAISE WARNING 'content.schedule: % % not published: %', t, v_id, SQLERRM;
      END;
    END LOOP;
    FOR v_id IN EXECUTE format('SELECT id FROM %I WHERE status = ''published'' AND unpublish_at <= now() FOR UPDATE SKIP LOCKED', t) LOOP
      BEGIN
        EXECUTE format('UPDATE %I SET status = ''archived'' WHERE id = $1', t) USING v_id;
        a := a + 1;
      EXCEPTION WHEN others THEN
        f := f + 1;
        RAISE WARNING 'content.schedule: % % not archived: %', t, v_id, SQLERRM;
      END;
    END LOOP;
    IF p + a + f > 0 THEN
      o_entity_type := t; o_published := p; o_archived := a; o_failed := f;
      RETURN NEXT;
    END IF;
  END LOOP;
END $$;
COMMENT ON FUNCTION content_run_schedule() IS 'v3.1 Job content.schedule: publishes scheduled items whose publish_at has passed and archives published items whose unpublish_at has passed, row by row through the workflow guard; failures (e.g. missing native review) are counted and reported (notification job.failed) without blocking other rows. The publish webhook then rebuilds affected routes.';

-- ---------------------------------------------------------------------
-- 18.4 v3.1 Four-eyes on production config (AD-05, A31, A28)
--   TG_ARGV[0] permission key, TG_ARGV[1] key column, TG_ARGV[2] optional
--   comma list of keys that always need approval even when the permission
--   itself does not (site_settings maintenance / emergency_numbers).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_config_approval() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_perm   text := TG_ARGV[0];
  v_keycol text := TG_ARGV[1];
  v_always text[] := CASE WHEN TG_NARGS > 2 THEN string_to_array(TG_ARGV[2], ',') ELSE '{}'::text[] END;
  v_skip   constant text[] := ARRAY['updated_at','updated_by','approval_id'];
  jn jsonb := to_jsonb(NEW);
  jo jsonb;
  v_key  text := jn ->> v_keycol;
  v_appr uuid := (jn ->> 'approval_id')::uuid;
  v_req  boolean;
BEGIN
  IF app_env() <> 'production' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN
    jo := to_jsonb(OLD);
    IF (jn - v_skip) = (jo - v_skip) THEN RETURN NEW; END IF;              -- bookkeeping only
    -- Kill switch OFF executes immediately with reason + re-auth (retrospective review).
    IF TG_TABLE_NAME = 'feature_flags' AND (jo ->> 'is_kill_switch')::boolean
       AND (jo ->> 'enabled')::boolean AND NOT (jn ->> 'enabled')::boolean
       AND (jn - v_skip - 'enabled') = (jo - v_skip - 'enabled') THEN
      RETURN NEW;
    END IF;
    IF v_appr IS NOT DISTINCT FROM (jo ->> 'approval_id')::uuid THEN v_appr := NULL; END IF;  -- an approval is used once
  END IF;
  -- v3.4 A3: a row can name its own approval permission (remote_config.permission_key, e.g. the
  -- sanctions ladder = sanctions.manage). On UPDATE the old row's key decides, so changing the key
  -- itself needs an approval under the old permission.
  IF jn ? 'permission_key' THEN
    v_perm := coalesce(CASE WHEN TG_OP = 'UPDATE' THEN jo ->> 'permission_key' END, jn ->> 'permission_key', v_perm);
  END IF;
  SELECT p.requires_approval INTO v_req FROM admin_permissions p WHERE p.key = v_perm;
  IF NOT coalesce(v_req, false) AND NOT (v_key = ANY (v_always)) THEN RETURN NEW; END IF;
  IF v_appr IS NULL OR NOT EXISTS (
       SELECT 1 FROM admin_approvals a
        WHERE a.id = v_appr AND a.status = 'approved' AND a.permission_key = v_perm
          AND a.target_type = TG_TABLE_NAME AND a.target_id = v_key) THEN
    RAISE EXCEPTION 'four-eyes: % of %.% needs an approved % approval in production', lower(TG_OP), TG_TABLE_NAME, v_key, v_perm
      USING ERRCODE = '42501';
  END IF;
  UPDATE admin_approvals SET status = 'executed', executed_at = now() WHERE id = v_appr;
  RETURN NEW;
END $$;
COMMENT ON FUNCTION enforce_config_approval() IS 'v3.4 A3: for remote_config the permission is the row''s permission_key (default config.remote; safety.sanctions_ladder = sanctions.manage). v3.1 BEFORE INSERT OR UPDATE on config tables when app.env = production: a change needs approval_id = an approved admin_approvals row for the same permission, table and key; the row is marked executed (single use). Exempt: bookkeeping-only updates and turning a kill switch OFF (AD-05). Development and staging are not enforced; the API still applies the permission flags there.';

CREATE TRIGGER trg_flags_approval    BEFORE INSERT OR UPDATE ON feature_flags       FOR EACH ROW EXECUTE FUNCTION enforce_config_approval('config.flags', 'key');
CREATE TRIGGER trg_rconfig_approval  BEFORE INSERT OR UPDATE ON remote_config       FOR EACH ROW EXECUTE FUNCTION enforce_config_approval('config.remote', 'key');
CREATE TRIGGER trg_rlp_approval      BEFORE INSERT OR UPDATE ON rate_limit_policies FOR EACH ROW EXECUTE FUNCTION enforce_config_approval('security.rate_limits', 'key');
CREATE TRIGGER trg_vendor_approval   BEFORE INSERT OR UPDATE ON vendor_settings     FOR EACH ROW EXECUTE FUNCTION enforce_config_approval('config.vendors', 'vendor');
CREATE TRIGGER trg_site_settings_approval BEFORE INSERT OR UPDATE ON site_settings  FOR EACH ROW EXECUTE FUNCTION enforce_config_approval('site_settings.manage', 'key', 'maintenance,emergency_numbers');
CREATE TRIGGER trg_countries_approval BEFORE INSERT OR UPDATE ON countries          FOR EACH ROW EXECUTE FUNCTION enforce_config_approval('config.markets', 'iso2');
CREATE TRIGGER trg_cities_approval    BEFORE INSERT OR UPDATE ON cities             FOR EACH ROW EXECUTE FUNCTION enforce_config_approval('config.markets', 'id');

-- ---------------------------------------------------------------------
-- 18.5 v3.4 Design-review additions (21 Nov 2026)
--   New tables, functions and indexes from the full board review
--   (_sources/DESIGN_DATA_REVIEW_2026-11-21.md). Item ids: M = mobile,
--   W = website, A = admin A01-A18, B = admin A19-A36 findings.
--   Columns added to existing tables are inline and tagged "v3.4".
-- ---------------------------------------------------------------------

-- M6 D13 emoji reactions on group messages (everyone in the group can react; posting needs Premium, GC2).
CREATE TABLE group_message_reactions (
  group_id           uuid NOT NULL,
  message_id         uuid NOT NULL,
  message_created_at timestamptz NOT NULL,
  user_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji              text NOT NULL CHECK (char_length(emoji) BETWEEN 1 AND 16),
  created_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, message_id, user_id),
  FOREIGN KEY (group_id, message_id, message_created_at) REFERENCES group_messages (group_id, id, created_at) ON DELETE CASCADE
);
CREATE INDEX idx_gmr_message ON group_message_reactions (group_id, message_id);
COMMENT ON TABLE group_message_reactions IS 'v3.4 M6 D13 group room reactions ("🙌 5"): one emoji per member per message. Everyone in the group can react; posting needs Premium (GC2). Retention: with the message. PII: personal. Citus: distributed by group_id (colocate groups).';

-- M14 Saved web card for Flutterwave renewals (OD-14): tokenised reference only, never a PAN.
CREATE TABLE payment_methods (
  id                 uuid PRIMARY KEY DEFAULT uuid_v7(),
  user_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider           payment_provider_t NOT NULL CHECK (provider = 'flutterwave'),
  provider_token_ref text NOT NULL CHECK (char_length(provider_token_ref) BETWEEN 4 AND 200),
  method             pay_method_t NOT NULL DEFAULT 'card' CHECK (method = 'card'),
  card_brand         text CHECK (char_length(card_brand) <= 20),
  card_last4         text CHECK (card_last4 ~ '^[0-9]{4}$'),
  exp_month          smallint CHECK (exp_month BETWEEN 1 AND 12),
  exp_year           smallint CHECK (exp_year BETWEEN 2020 AND 2100),
  is_default         boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  removed_at         timestamptz,
  UNIQUE (provider, provider_token_ref)
);
CREATE TRIGGER trg_payment_methods_upd BEFORE UPDATE ON payment_methods FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE UNIQUE INDEX uq_payment_methods_default ON payment_methods (user_id) WHERE is_default AND removed_at IS NULL;
COMMENT ON TABLE payment_methods IS 'v3.4 M14 BL1 / BL5 / B9 / P5 / GD5 saved web card ("Visa •••• 4242 · Expires 08/28", "Update card and retry"). Flutterwave card token reference only (OD-14): never a PAN, CVV or full expiry date beyond month / year. Store purchases never appear here. Removing the card sets removed_at and deletes the token at Flutterwave. Retention: until removed or the account is erased. PII: personal.';
COMMENT ON COLUMN payment_methods.provider_token_ref IS 'v3.4 Flutterwave card token used for tokenised renewals (OD-14). Not a card number.';

-- M17 P3 "Languages they speak" partner preference (values live in languages, not options).
CREATE TABLE partner_preference_languages (
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  language_code text NOT NULL REFERENCES languages(code),
  PRIMARY KEY (user_id, language_code)
);
COMMENT ON TABLE partner_preference_languages IS 'v3.4 M17 P3 "Languages they speak" (soft boost). The deal-breaker switch is partner_preference_sections.set_key = ''languages'' (pseudo option set with no options). PII: personal.';

-- M45 "Notify me" interest for features that are not live yet (MF4 calls, OD-20; Gold International "Opening soon", OD-09).
CREATE TABLE feature_waitlist (
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature_key text NOT NULL CHECK (feature_key ~ '^[a-z0-9_.]{2,80}$'),
  created_at  timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz,
  PRIMARY KEY (user_id, feature_key)
);
CREATE INDEX idx_feature_waitlist_key ON feature_waitlist (feature_key) WHERE notified_at IS NULL;
COMMENT ON TABLE feature_waitlist IS 'v3.4 M45 MF4 "Notify me when calls arrive" (calls after public launch, OD-20) and similar "Opening soon" interest. feature_key matches a feature flag or market key. Retention: deleted 30 days after notified_at. PII: personal.';

-- W2 Public website uploads (CV, contact screenshots, safety evidence, story photos): quarantine + scan.
CREATE TABLE web_uploads (
  id                    uuid PRIMARY KEY DEFAULT uuid_v7(),
  purpose               text NOT NULL CHECK (purpose IN ('cv','contact_attachment','safety_evidence','story_photo')),
  storage_key           text NOT NULL UNIQUE,
  mime_type             text NOT NULL CHECK (mime_type IN ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/jpeg','image/png','image/webp','image/heic')),
  bytes                 integer NOT NULL CHECK (bytes > 0 AND bytes <= 5242880),
  sha256                sha256_hash,
  scan_status           text NOT NULL DEFAULT 'pending' CHECK (scan_status IN ('pending','clean','infected','rejected_type')),
  exif_stripped         boolean NOT NULL DEFAULT false,
  upload_url_expires_at timestamptz NOT NULL,
  attached_to_type      text CHECK (attached_to_type IN ('contact_submissions','job_applications','story_consents')),
  attached_to_id        uuid,
  retention_until       timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  scanned_at            timestamptz,
  CHECK (scan_status = 'pending' OR scanned_at IS NOT NULL),
  CHECK ((attached_to_type IS NULL) = (attached_to_id IS NULL)),
  CHECK (purpose <> 'cv' OR mime_type IN ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'))
);
CREATE INDEX idx_web_uploads_attached ON web_uploads (attached_to_type, attached_to_id) WHERE attached_to_id IS NOT NULL;
CREATE INDEX idx_web_uploads_orphans ON web_uploads (created_at) WHERE attached_to_id IS NULL;
CREATE INDEX idx_web_uploads_scan ON web_uploads (created_at) WHERE scan_status = 'pending';
COMMENT ON TABLE web_uploads IS 'v3.4 W2 POST /public/v1/uploads (W30 CV <= 5 MB PDF/DOCX, W33 screenshots <= 3, W34 safety evidence <= 5 with EXIF stripped, W27 story photos <= 3). Files land in an R2 quarantine prefix, pass magic-byte and AV checks (scan_status) and only clean files can be opened in A29 ("CV scan pending", open disabled). Orphans are purged after 24 h (job web_uploads.purge). contact_submissions.attachment_ids and job_applications.cv_upload_id point here. PII: personal.';

-- W5 Closed beta by invite (OD-09: rest of Nigeria is a closed beta; markets.beta_requires_invite).
CREATE TABLE beta_invites (
  id                uuid PRIMARY KEY DEFAULT uuid_v7(),
  waitlist_entry_id uuid REFERENCES waitlist_entries(id) ON DELETE SET NULL,
  identifier_hash   sha256_hash NOT NULL,
  city_id           integer REFERENCES cities(id),
  code_hash         sha256_hash NOT NULL UNIQUE,
  status            text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','redeemed','expired','revoked')),
  expires_at        timestamptz NOT NULL,
  redeemed_by       uuid REFERENCES users(id) ON DELETE SET NULL,
  redeemed_at       timestamptz,
  created_by        uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at),
  CHECK ((status = 'redeemed') = (redeemed_at IS NOT NULL))
);
CREATE INDEX idx_beta_invites_identifier ON beta_invites (identifier_hash) WHERE status = 'sent';
CREATE INDEX idx_beta_invites_expiry ON beta_invites (expires_at) WHERE status = 'sent';
COMMENT ON TABLE beta_invites IS 'v3.4 W5 closed-beta invites (OD-09). Staff pick waitlist entries in A29 (permission waitlist.invite, audit waitlist.invite.send); the entry moves to status invited and gets a single-use code (stored hashed). Sign-up in a beta city redeems it through redeem_beta_invite() when markets.beta_requires_invite is true. Unredeemed invites expire (job beta_invites.expire). PII: personal (hashed identifier).';

CREATE OR REPLACE FUNCTION redeem_beta_invite(p_code_hash bytea, p_user uuid) RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE v_id uuid; v_status text; v_exp timestamptz;
BEGIN
  SELECT id, status, expires_at INTO v_id, v_status, v_exp FROM beta_invites WHERE code_hash = p_code_hash::sha256_hash FOR UPDATE;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'beta invite not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_status <> 'sent' OR v_exp <= now() THEN
    RAISE EXCEPTION 'beta invite is % and cannot be used', CASE WHEN v_status = 'sent' THEN 'expired' ELSE v_status END USING ERRCODE = '23514';
  END IF;
  UPDATE beta_invites SET status = 'redeemed', redeemed_by = p_user, redeemed_at = now() WHERE id = v_id;
  RETURN v_id;
END $$;
COMMENT ON FUNCTION redeem_beta_invite(bytea, uuid) IS 'v3.4 W5 single-use redemption of a closed-beta invite at sign-up (OD-09): row-locked; refuses unknown, used, revoked or expired codes.';

-- W6 Plan marketing (W12 compare table, W22 plan cards): every perk resolves from data, not typed text.
CREATE TABLE plan_compare_rows (
  key               text PRIMARY KEY CHECK (key ~ '^[a-z_]+$'),
  label_key         text NOT NULL,
  entitlement_key   text REFERENCES entitlements(key),
  remote_config_key text REFERENCES remote_config(key),
  free_value_key    text,
  premium_value_key text,
  gold_value_key    text,
  note_key          text,
  feature_flag      text REFERENCES feature_flags(key),
  sort              smallint NOT NULL DEFAULT 0,
  is_active         boolean NOT NULL DEFAULT true,
  CHECK (entitlement_key IS NOT NULL OR remote_config_key IS NOT NULL OR (free_value_key IS NOT NULL AND premium_value_key IS NOT NULL AND gold_value_key IS NOT NULL))
);
COMMENT ON TABLE plan_compare_rows IS 'v3.4 W6 website compare table (W12, W22) and plan perks: each row names the entitlement or remote_config key its numbers come from (OD-03 caps etc.), so prices and perks never drift from the app. feature_flag hides a row until the feature is live ("Opening soon"). Admin A21 / A28. PII: none. Citus: reference.';

CREATE VIEW v_public_plan_prices AS
SELECT p.plan_code, p.code AS product_code, p.kind, pr.provider, pr.amount_usd_cents, pr.interval, pr.trial_days
FROM products p
JOIN prices pr ON pr.product_id = p.id AND pr.is_active AND pr.valid_to IS NULL
WHERE p.is_active;
COMMENT ON VIEW v_public_plan_prices IS 'v3.4 W6 current list prices per product and provider for the website plan blocks (W12, W22) and the trial billing fact (trial_days > 0, W22 "when offered"). CI compares providers so the site never shows a price the stores do not charge.';

-- W9 Server-side redirect / QR counts per campaign (OD-06: no attribution vendor; aggregates only, no IP).
CREATE TABLE web_redirects_daily (
  day       date NOT NULL,
  event     text NOT NULL CHECK (event IN ('store_redirect','qr_scan')),
  store     text NOT NULL CHECK (store IN ('app_store','google_play','download','waitlist')),
  src       text NOT NULL DEFAULT '',
  placement text NOT NULL DEFAULT '',
  campaign  text NOT NULL DEFAULT '',
  country   text NOT NULL DEFAULT '' CHECK (country = '' OR country ~ '^[A-Z]{2}$'),
  hits      integer NOT NULL CHECK (hits >= 0),
  PRIMARY KEY (day, event, store, src, placement, campaign, country)
);
COMMENT ON TABLE web_redirects_daily IS 'v3.4 W9 /get and QR redirect counts by day, store, src, placement, campaign and country (website §1.4 "S" metrics; OD-06 no attribution vendor). Aggregates only: no IP, no device. Retention 5 years. PII: none.';

-- W22 / B42 Two-party story consent (W27 share form; A29 story review; DN-18 withdrawal within 24 h by either partner).
CREATE TABLE story_consents (
  id                    uuid PRIMARY KEY DEFAULT uuid_v7(),
  submission_id         uuid REFERENCES contact_submissions(id) ON DELETE CASCADE,
  story_id              uuid REFERENCES stories(id) ON DELETE CASCADE,
  partner_no            smallint NOT NULL CHECK (partner_no IN (1,2)),
  user_id               uuid REFERENCES users(id) ON DELETE SET NULL,
  first_name            text NOT NULL CHECK (char_length(first_name) BETWEEN 1 AND 40),
  email_enc             bytea,
  email_hash            sha256_hash NOT NULL,
  confirm_token_hash    sha256_hash UNIQUE,
  confirmed_at          timestamptz,
  text_approved_version integer CHECK (text_approved_version >= 1),
  withdrawn_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  CHECK (submission_id IS NOT NULL OR story_id IS NOT NULL),
  CHECK (withdrawn_at IS NULL OR confirmed_at IS NOT NULL)
);
CREATE UNIQUE INDEX uq_story_consent_submission ON story_consents (submission_id, partner_no) WHERE submission_id IS NOT NULL;
CREATE UNIQUE INDEX uq_story_consent_story ON story_consents (story_id, partner_no) WHERE story_id IS NOT NULL;
COMMENT ON TABLE story_consents IS 'v3.4 W22 / B42 one row per partner of a story (W27 submission, then the A29 story): first name only (DN-18), email encrypted + hash, confirm link (token hashed), confirmation time, couple-approved text version and withdrawal. A story publishes only when both partners confirmed and neither withdrew (API publish guard; stories.consent_scopes holds what they agreed to). Retention: with the story; removed within 24 h of a withdrawal. PII: personal.';

-- W23 IR approves access to an on-request investor document: time-limited signed link, logged.
CREATE TABLE investor_document_grants (
  id                    uuid PRIMARY KEY DEFAULT uuid_v7(),
  document_id           uuid NOT NULL REFERENCES investor_documents(id) ON DELETE CASCADE,
  contact_submission_id uuid REFERENCES contact_submissions(id) ON DELETE SET NULL,
  recipient_email_hash  sha256_hash NOT NULL,
  approved_by           uuid NOT NULL REFERENCES admin_users(id),
  link_expires_at       timestamptz NOT NULL,
  opened_at             timestamptz,
  revoked_at            timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  CHECK (link_expires_at > created_at)
);
CREATE INDEX idx_investor_grants_doc ON investor_document_grants (document_id, created_at DESC);
COMMENT ON TABLE investor_document_grants IS 'v3.4 W23 W31 / A29: an on-request investor document has no public URL; IR (permission investors.grant_access, audit investor.document.grant) approves a time-limited signed link for one recipient. Retention 7 years. PII: personal (hashed email).';

-- A8 Admin login anomaly alerts and the response ("Mark as expected", "This wasn't me", "Block this network").
CREATE TABLE admin_security_alerts (
  id           uuid PRIMARY KEY DEFAULT uuid_v7(),
  rule         text NOT NULL CHECK (rule IN ('new_network','new_country','impossible_travel','repeated_failures','spray','offhours_super_admin','passkey_anomaly')),
  admin_id     uuid REFERENCES admin_users(id) ON DELETE CASCADE,
  ip           inet,
  ip_prefix    cidr,
  country      iso_country,
  city         text,
  evidence     jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(evidence) = 'object'),
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open','expected','not_me','network_blocked')),
  responded_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  responded_at timestamptz,
  incident_id  uuid REFERENCES security_incidents(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (status = 'open' OR responded_at IS NOT NULL)
);
CREATE INDEX idx_admin_alerts_open ON admin_security_alerts (created_at DESC) WHERE status = 'open';
CREATE INDEX idx_admin_alerts_admin ON admin_security_alerts (admin_id, created_at DESC);
COMMENT ON TABLE admin_security_alerts IS 'v3.4 A8 A03f admin login anomaly alerts (new country / network in 90 days, impossible travel, spray, off-hours super admin, copied passkey) and the response. "This wasn''t me" locks the admin at once (no approval) and links a security incident; a network block still goes through security.ip_lists approval (spec A03 / A32). Audit security.alert.create / security.alert.ack. Retention 13 months. PII: personal (IP).';

-- A12 Results of audit-chain verification runs (nightly job audit.verify_chain or "Check a period now").
CREATE TABLE admin_audit_chain_runs (
  id                   uuid PRIMARY KEY DEFAULT uuid_v7(),
  started_at           timestamptz NOT NULL DEFAULT now(),
  finished_at          timestamptz,
  range_from           timestamptz NOT NULL,
  range_to             timestamptz NOT NULL,
  rows_checked         bigint CHECK (rows_checked >= 0),
  result               text CHECK (result IN ('ok','broken','failed')),
  first_bad_chain_seq  bigint,
  first_bad_created_at timestamptz,
  run_by               uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  incident_id          uuid REFERENCES security_incidents(id) ON DELETE SET NULL,
  CHECK (range_to > range_from),
  CHECK (run_by IS NULL OR range_to - range_from <= interval '7 days'),
  CHECK ((result IS NULL) = (finished_at IS NULL))
);
CREATE INDEX idx_audit_chain_runs ON admin_audit_chain_runs (started_at DESC);
COMMENT ON TABLE admin_audit_chain_runs IS 'v3.4 A12 A07c tamper check: each verification walks admin_audit_log by chain_seq and recomputes admin_audit_row_hash(); result broken records the first bad row and opens a security incident (chain.broken). Manual runs are limited to 7 days. Retention 7 years. PII: none.';

-- A15 Structured, append-only escalation updates (A15c: contacted member / authorities, resolve, false alarm).
CREATE TABLE safety_escalation_updates (
  id                  uuid PRIMARY KEY DEFAULT uuid_v7(),
  escalation_id       uuid NOT NULL REFERENCES safety_escalations(id) ON DELETE CASCADE,
  admin_id            uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  kind                text NOT NULL CHECK (kind IN ('acknowledged','contacted_member','contacted_authorities','note','reveal_phone','reveal_contact','reveal_location','resolved','false_alarm')),
  contact_method      text CHECK (contact_method IN ('phone_call','sms','whatsapp','in_app','other')),
  authority_name      text CHECK (char_length(authority_name) <= 120),
  contacted_at        timestamptz,
  authority_reference text CHECK (char_length(authority_reference) <= 80),
  outcome             text CHECK (outcome IN ('member_safe','member_unreachable','handed_to_authorities','other')),
  note                text CHECK (char_length(note) <= 2000),
  created_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (kind <> 'contacted_authorities' OR (authority_name IS NOT NULL AND contacted_at IS NOT NULL)),
  CHECK (kind NOT IN ('resolved','false_alarm') OR note IS NOT NULL)
);
CREATE INDEX idx_esc_updates ON safety_escalation_updates (escalation_id, created_at);
CREATE TRIGGER trg_esc_updates_immutable BEFORE UPDATE OR DELETE ON safety_escalation_updates FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
COMMENT ON TABLE safety_escalation_updates IS 'v3.4 A15 A15b timeline / A15c actions: one append-only row per step (acknowledge, contacted member, contacted authorities with who / when / reference, reveal, resolve with outcome, false alarm with why). Audit escalation.note.add. Retention: with the escalation. PII: sensitive.';

-- A18 Files attached to an appeal (A14c / A16b evidence viewer, watermarked).
CREATE TABLE appeal_evidence (
  id         uuid PRIMARY KEY DEFAULT uuid_v7(),
  appeal_id  uuid NOT NULL REFERENCES appeals(id) ON DELETE CASCADE,
  media_id   uuid NOT NULL REFERENCES media_assets(id) ON DELETE RESTRICT,
  caption    text CHECK (char_length(caption) <= 200),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_appeal_evidence ON appeal_evidence (appeal_id);
COMMENT ON TABLE appeal_evidence IS 'v3.4 A18 screenshots sent with an appeal (A14c "4 screenshots sent with her appeal", A16b "Open screenshots"). Opening is gated like reported evidence (conversations.read_reported) and audited. Retention 12 months, as appeal evidence. PII: personal.';

-- A21 + A27 Reason catalogue for sanctions, badge and media decisions (one catalogue, by domain).
CREATE TABLE decision_reasons (
  domain             text NOT NULL CHECK (domain IN ('sanction','badge_fix','badge_not_approved','media_reject')),
  code               text NOT NULL CHECK (code ~ '^[a-z_]{3,40}$'),
  category           text,
  label_key          text NOT NULL,
  member_message_key text,
  is_permanent       boolean NOT NULL DEFAULT false,
  is_active          boolean NOT NULL DEFAULT true,
  sort               smallint NOT NULL DEFAULT 0,
  PRIMARY KEY (domain, code),
  CHECK (domain <> 'sanction' OR category IS NOT NULL),
  CHECK (NOT is_permanent OR code LIKE 'permanent%')
);
COMMENT ON TABLE decision_reasons IS 'v3.4 A21 / A27 reason catalogue picked in A11 / A14 (sanctions: every sanction needs a reason_code, spec A11), A12 (badge needs-fix and not-approved) and A13 (media reject). category maps a sanction reason to its sanctions-ladder category. member_message_key is the fixed text the member sees (admins never write words for the member). account_restrictions / moderation_actions / badge_applications reason codes are validated against it by the API. Admin A17 (sanctions.manage). PII: none. Citus: reference.';

-- A23 Possible minor: "Ask for an age check" (A14b; macro "Possible minor · ask for an age check"). Owner decision: add the flow.
CREATE TABLE age_verification_requests (
  id           uuid PRIMARY KEY DEFAULT uuid_v7(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  case_id      uuid REFERENCES moderation_cases(id) ON DELETE SET NULL,
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open','passed','failed','expired')),
  requested_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  due_at       timestamptz,
  decided_at   timestamptz,
  decided_by   uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'open') = (decided_at IS NULL))
);
CREATE UNIQUE INDEX uq_age_check_open ON age_verification_requests (user_id) WHERE status = 'open';
COMMENT ON TABLE age_verification_requests IS 'v3.4 A23 A14b "Ask for age check": a possible (unconfirmed) minor is hidden (profiles.hidden_reason age_check), the case waits (case_status awaiting_member) and reopens when the member sends ID. failed = confirmed minor -> ban with reason minor (OD-27: minor cases first). Retention: 12 months after decision. PII: sensitive.';

-- A47 Case watchers ("Watch this case"; escalate keeps you as a watcher).
CREATE TABLE moderation_case_watchers (
  case_id    uuid NOT NULL REFERENCES moderation_cases(id) ON DELETE CASCADE,
  admin_id   uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (case_id, admin_id)
);
CREATE INDEX idx_case_watchers_admin ON moderation_case_watchers (admin_id);
COMMENT ON TABLE moderation_case_watchers IS 'v3.4 A47 A14b watchers of a moderation case (notified on decision). PII: none.';

-- B11 Reconciliation differences that persist across runs ("Found 12 Nov", "Mark explained").
CREATE TABLE reconciliation_items (
  id                      uuid PRIMARY KEY DEFAULT uuid_v7(),
  first_run_id            uuid NOT NULL REFERENCES reconciliation_runs(id) ON DELETE CASCADE,
  last_seen_run_id        uuid REFERENCES reconciliation_runs(id) ON DELETE SET NULL,
  provider                payment_provider_t NOT NULL,
  kind                    text NOT NULL CHECK (kind IN ('missing_ours','missing_provider','amount_mismatch','status_mismatch')),
  provider_transaction_id text NOT NULL,
  transaction_id          uuid REFERENCES transactions(id) ON DELETE SET NULL,
  ours                    jsonb,
  theirs                  jsonb,
  status                  text NOT NULL DEFAULT 'open' CHECK (status IN ('open','explained','resolved')),
  explained_by            uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  explained_at            timestamptz,
  note                    text CHECK (char_length(note) <= 2000),
  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, kind, provider_transaction_id),
  CHECK (status <> 'explained' OR (explained_at IS NOT NULL AND note IS NOT NULL))
);
CREATE INDEX idx_recon_items_open ON reconciliation_items (provider, created_at) WHERE status = 'open';
COMMENT ON TABLE reconciliation_items IS 'v3.4 B11 A19e reconciliation differences tracked across runs; "Mark explained" needs a note (audit billing.reconciliation.explain). Retention 7 years (finance). PII: none.';

-- B51 Cloudflare edge / WAF events copied to our database every 15 minutes (job edge.import).
CREATE TABLE edge_security_events (
  id                bigint GENERATED ALWAYS AS IDENTITY,
  occurred_at       timestamptz NOT NULL,
  rule_id           text NOT NULL,
  rule_name         text,
  action            text NOT NULL CHECK (action IN ('block','challenge','js_challenge','managed_challenge','log','allow','skip')),
  ip_prefix         cidr,
  asn               integer,
  country           text CHECK (country ~ '^[A-Z]{2}$'),
  user_agent_family text,
  host              text,
  path              text,
  imported_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (occurred_at, id)
) PARTITION BY RANGE (occurred_at);
CREATE TABLE edge_security_events_default PARTITION OF edge_security_events DEFAULT;
CREATE INDEX idx_edge_events_rule ON edge_security_events (rule_id, occurred_at DESC);
COMMENT ON TABLE edge_security_events IS 'v3.4 B51 A32b Cloudflare WAF / security events pulled by the Cloudflare API (OD-06 / OD-11 free plan) into our own table every 15 minutes (job edge.import); events by rule over 24 h. IP stored as a prefix only. Retention 90 days. PII: personal (pseudonymous prefixes).';

-- B59 Website publish pipeline runs (rebuild -> cache purge -> sitemap -> smoke test -> audit; rollback on failure).
CREATE TABLE cms_publish_runs (
  id          uuid PRIMARY KEY DEFAULT uuid_v7(),
  entity_type text NOT NULL,
  entity_id   text NOT NULL,
  version     integer NOT NULL CHECK (version >= 1),
  status      text NOT NULL DEFAULT 'running' CHECK (status IN ('running','succeeded','failed','rolled_back')),
  steps       jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(steps) = 'array'),
  error       text,
  started_by  uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  started_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  CHECK (status = 'running' OR finished_at IS NOT NULL),
  CHECK (status NOT IN ('failed','rolled_back') OR error IS NOT NULL)
);
CREATE INDEX idx_cms_runs_recent ON cms_publish_runs (started_at DESC);
CREATE INDEX idx_cms_runs_entity ON cms_publish_runs (entity_type, entity_id, started_at DESC);
COMMENT ON TABLE cms_publish_runs IS 'v3.4 B59 A28d publish pipeline per publish (job site.publish): steps with status and timing; a failed smoke test rolls back to the previous live revision and alerts ("Try again"). Retention 2 years. PII: none.';

-- W1 / W10 / W11 Website contact form defaults: safety reports get an SR- reference, urgent triage and an SLA.
CREATE OR REPLACE FUNCTION contact_submission_defaults() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.kind = 'safety' THEN
    NEW.reference := 'SR-' || nextval('contact_public_ref_seq');
    NEW.priority := CASE WHEN NEW.safety_category IN ('under_18','threats_violence') THEN 'urgent' ELSE 'normal' END;
    NEW.sla_due_at := coalesce(NEW.sla_due_at, NEW.created_at + make_interval(mins =>
      CASE WHEN NEW.priority = 'urgent' THEN config_int('contact.safety_sla_minutes.urgent', 60)
           ELSE config_int('contact.safety_sla_minutes.normal', 1440) END));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_contact_defaults BEFORE INSERT ON contact_submissions FOR EACH ROW EXECUTE FUNCTION contact_submission_defaults();
COMMENT ON FUNCTION contact_submission_defaults() IS 'v3.4 W10 / W11 BEFORE INSERT on contact_submissions: a W34 safety report gets reference SR-n (other kinds keep W-n), priority urgent for under-18 and threats (else normal) and sla_due_at from remote_config contact.safety_sla_minutes.urgent / .normal (60 / 1440, AD-36).';

-- B39 A published legal document never changes; a fix needs a new version (A30 acceptance).
CREATE OR REPLACE FUNCTION legal_published_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'published' AND (NEW.body_md, NEW.short_version_md, NEW.title, NEW.version, NEW.locale, NEW.kind,
         NEW.effective_at, NEW.reaccept_from, NEW.is_material_change)
       IS DISTINCT FROM (OLD.body_md, OLD.short_version_md, OLD.title, OLD.version, OLD.locale, OLD.kind,
         OLD.effective_at, OLD.reaccept_from, OLD.is_material_change) THEN
    RAISE EXCEPTION 'published legal document % v% is immutable: publish a new version', OLD.kind, OLD.version USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_legal_immutable BEFORE UPDATE ON legal_documents FOR EACH ROW EXECUTE FUNCTION legal_published_immutable();
COMMENT ON FUNCTION legal_published_immutable() IS 'v3.4 B39 A30: once published, the text, version and dates of a legal_documents row cannot change (archiving is still allowed). The workflow guard also refuses published -> draft for legal documents (row-per-version model).';

-- M49 P1 "up to 6" spoken languages.
CREATE CONSTRAINT TRIGGER trg_profile_languages_max AFTER INSERT ON profile_languages
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_max_children('user_id', '6');

-- Indexes on existing tables (v3.4).
CREATE INDEX idx_groups_topic ON groups (city_id, topic) WHERE status = 'active' AND join_rule <> 'invite';                 -- M4 D12 filter
CREATE UNIQUE INDEX uq_groups_slug ON groups (slug) WHERE deleted_at IS NULL AND slug IS NOT NULL;                          -- M5 GC5 link
CREATE INDEX idx_spotlight_rotation_order ON spotlight_rotations (city_id, starts_at, is_priority DESC, position);           -- M1 / B1 A24c order
CREATE UNIQUE INDEX uq_audit_chain_seq ON admin_audit_log (chain_seq, created_at);                                          -- A1 chain order
CREATE INDEX idx_admin_approvals_approver ON admin_approvals (approver_id, requested_at) WHERE status = 'pending';           -- A4 "Waiting for me"
CREATE INDEX idx_admin_login_country ON admin_login_attempts (admin_id, ip_country, created_at DESC) WHERE success;          -- A9 new-country rule
CREATE UNIQUE INDEX uq_one_break_glass ON admin_users ((true)) WHERE is_break_glass;                                        -- A10 one dormant account
CREATE INDEX idx_users_created_id ON users (created_at DESC, id DESC);                                                      -- A35 A09 keyset paging
CREATE INDEX idx_users_last_active ON users (last_active_at DESC NULLS LAST, id);                                           -- A35
CREATE INDEX idx_users_country ON users (country, created_at DESC);                                                         -- A35 country scope
CREATE INDEX idx_profiles_nick_prefix ON profiles (lower(nickname) text_pattern_ops);                                       -- A35 nickname search
CREATE INDEX idx_tx_env ON transactions (environment, occurred_at DESC);                                                    -- B3 sandbox filter
CREATE INDEX idx_notifications_broadcast ON notifications (broadcast_id, channel, locale, status) WHERE broadcast_id IS NOT NULL;  -- B4 A26c results
CREATE UNIQUE INDEX uq_notifications_recipient_dedupe ON notifications (recipient_hash, dedupe_key) WHERE recipient_hash IS NOT NULL AND dedupe_key IS NOT NULL;  -- W3 / B5
CREATE INDEX idx_announce_live ON in_app_announcements USING gin (placement) WHERE status = 'published';                   -- B31
CREATE INDEX idx_tickets_due ON support_tickets (reply_due_at) WHERE status IN ('open','pending_agent');                    -- B35 A27a sort
CREATE INDEX idx_help_stale ON help_articles (last_reviewed_at) WHERE status = 'published';                                 -- W14 review queue
CREATE UNIQUE INDEX uq_site_pages_campaign ON site_pages (campaign_code, locale) WHERE campaign_code IS NOT NULL;           -- W8
CREATE UNIQUE INDEX uq_journal_featured ON journal_articles (locale) WHERE is_featured AND status = 'published';             -- W30
CREATE INDEX idx_job_apps_dedupe ON job_applications (job_id, email, created_at DESC);                                      -- W26 "already applied"
CREATE INDEX idx_reports_duplicate ON reports (duplicate_of) WHERE duplicate_of IS NOT NULL;                               -- A49
CREATE INDEX idx_contact_safety ON contact_submissions (priority, sla_due_at) WHERE kind = 'safety' AND status IN ('new','triaged','routed','in_progress');  -- W11

-- Column comments that record v3.4 decisions.
COMMENT ON COLUMN profiles.incognito IS 'v3.4 M11 D17 Incognito (Gold): browse privately; only people you liked can see you in their specs. A different setting from presence_pref = invisible (D2 status: hidden from discovery and presence). Owner decision 21 Nov 2026: keep both.';
COMMENT ON COLUMN user_settings.send_read_receipts IS 'v3.4 M9 D17 global read-receipts switch (Gold, chat.read_receipts). conversation_participants.send_read_receipts overrides per chat (NULL = inherit).';
COMMENT ON COLUMN spotlight_rotations.turn_no IS 'v3.4 M1 / B1 rotation of the week (1-3; OD-18: 3 rotations, e.g. Mon / Wed / Fri). position = place within that rotation (Gold first, spotlight.gold_priority).';
COMMENT ON COLUMN admin_audit_log.chain_seq IS 'v3.4 A1 chain order: assigned inside admin_audit_chain() after the advisory lock, so it is the true chaining order (created_at is the transaction start and id is drawn before the lock). The verifier walks chain_seq.';
COMMENT ON COLUMN remote_config.permission_key IS 'v3.4 A3 permission a production change of this key must be approved under (enforce_config_approval). Default config.remote; the sanctions ladder uses sanctions.manage (A16c, Appendix A).';
COMMENT ON COLUMN transactions.environment IS 'v3.4 B3 sandbox (store / provider test) transactions are labelled and left out of revenue (mv_revenue_daily) and finance totals (A19 / A23 acceptance).';
COMMENT ON COLUMN notifications.recipient_kind IS 'v3.4 W3 / B5 who receives the message: member (user_id set) or a non-member reached by email / SMS only (waitlist, newsletter, contact, applicant, story partner, investor contact); recipient_enc holds the KMS-encrypted address, recipient_hash dedupes, recipient_ref_id points at the source row (e.g. waitlist_entries.id).';
COMMENT ON COLUMN notifications.broadcast_id IS 'v3.4 B4 A26 broadcast that produced this message; content broadcasts have no template_code (A26b "Write for this broadcast"). Results by channel and locale group on it (A26c).';
COMMENT ON COLUMN contact_submissions.safety_category IS 'v3.4 W11 W34 safety category (8 fixed values). under_18 and threats_violence are urgent (1 h SLA); others 24 h. Maps to report_reasons for the T&S case (minor, harass, money, fake, other).';
COMMENT ON COLUMN support_tickets.priority IS 'v3.4 B33 one direction for tickets and cases: higher number = more urgent (5 = urgent ... 1 = low), matching moderation_cases and OD-27 (priority desc). Board A27 labels "P1 urgent ... P4 low" must flip to this scale.';
COMMENT ON COLUMN dm_requests.expires_at IS 'v3.4 M19 T-7: the API sets expires_at = now() + remote_config dm_request.expiry_days; the column default (14 days) is the seeded value.';
COMMENT ON COLUMN intro_messages.body IS 'v3.4 M19 T-7: the API enforces remote_config intro.text_max_chars (seeded 280); the database keeps a 1000-character ceiling so the value stays admin-tunable.';
COMMENT ON COLUMN newsletter_subscribers.email_enc IS 'v3.4 W20 email encrypted with a KMS data key; email_hash (SHA-256 of the normalised address) is the unique lookup key. The plaintext column was removed.';
COMMENT ON COLUMN waitlist_entries.status IS 'v3.4 W5 pending -> confirmed -> invited (closed beta, beta_invites) or notified ("now open") -> deleted.';
COMMENT ON COLUMN legal_holds.status IS 'v3.4 B46 pending_approval (still blocks erasure, conservative) -> live, or rejected; released when lifted. has_legal_hold() counts pending_approval and live.';
COMMENT ON COLUMN admin_users.is_break_glass IS 'v3.4 A10 the single dormant break-glass account (A03g). Its grants are time-boxed to 4 h (admin_user_roles.is_break_glass) and do not count against max_holders.';

-- v3.4 late foreign keys from existing tables to tables defined after them.
ALTER TABLE i18n_strings ADD FOREIGN KEY (updated_by) REFERENCES admin_users(id) ON DELETE SET NULL;
ALTER TABLE admin_users ADD FOREIGN KEY (lock_incident_id) REFERENCES security_incidents(id) ON DELETE SET NULL;
ALTER TABLE admin_trusted_devices ADD FOREIGN KEY (incident_id) REFERENCES security_incidents(id) ON DELETE SET NULL;
ALTER TABLE notifications ADD FOREIGN KEY (broadcast_id) REFERENCES broadcast_campaigns(id) ON DELETE SET NULL;
ALTER TABLE data_export_requests ADD FOREIGN KEY (privacy_request_id) REFERENCES privacy_requests(id) ON DELETE SET NULL;
ALTER TABLE privacy_requests ADD FOREIGN KEY (contact_submission_id) REFERENCES contact_submissions(id) ON DELETE SET NULL;
ALTER TABLE ip_access_rules ADD FOREIGN KEY (detection_id) REFERENCES security_detections(id) ON DELETE SET NULL;
ALTER TABLE job_applications ADD CONSTRAINT job_applications_cv_upload_id_fkey FOREIGN KEY (cv_upload_id) REFERENCES web_uploads(id) ON DELETE SET NULL;

-- =====================================================================
-- 19. LATE FOREIGN KEYS (tables defined after their referrers)
-- =====================================================================
ALTER TABLE prompt_answers        ADD FOREIGN KEY (media_id) REFERENCES media_assets(id) ON DELETE CASCADE;
ALTER TABLE badge_applications    ADD FOREIGN KEY (payment_transaction_id) REFERENCES transactions(id) ON DELETE RESTRICT;
ALTER TABLE badge_applications    ADD FOREIGN KEY (refund_id) REFERENCES refunds(id) ON DELETE SET NULL;
ALTER TABLE face_templates        ADD FOREIGN KEY (consent_record_id) REFERENCES consent_records(id) ON DELETE SET NULL;
ALTER TABLE new_device_challenges ADD FOREIGN KEY (fraud_review_case_id) REFERENCES moderation_cases(id) ON DELETE SET NULL;
ALTER TABLE dm_requests           ADD FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL;
ALTER TABLE messages              ADD FOREIGN KEY (meetup_id) REFERENCES meetups(id) ON DELETE SET NULL;
ALTER TABLE group_messages        ADD FOREIGN KEY (meetup_id) REFERENCES meetups(id) ON DELETE SET NULL;
ALTER TABLE reports               ADD FOREIGN KEY (case_id) REFERENCES moderation_cases(id) ON DELETE SET NULL;
ALTER TABLE safety_escalations    ADD FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE SET NULL;
ALTER TABLE subscription_events   ADD FOREIGN KEY (webhook_event_id) REFERENCES webhook_events(id) ON DELETE SET NULL;

-- =====================================================================
-- 20. FUNCTIONS: ROLE, REACTIONS, INTRO, UNMATCH
-- =====================================================================

-- Effective role + plan from verification and live grants (D2: verification
-- survives a lapsed plan; Black Badge never lapses).
CREATE OR REPLACE FUNCTION compute_member_role(p_user uuid, p_at timestamptz DEFAULT now())
RETURNS TABLE (role member_role_t, plan plan_t) LANGUAGE sql STABLE AS $$
  WITH u AS (SELECT id, is_verified FROM users WHERE id = p_user),
  best AS (
    SELECT g.plan_code
    FROM entitlement_grants g JOIN plans p ON p.code = g.plan_code
    WHERE g.user_id = p_user AND g.revoked_at IS NULL AND g.plan_code IS NOT NULL
      AND g.starts_at <= p_at AND (g.ends_at IS NULL OR g.ends_at > p_at)
    ORDER BY p.rank DESC
    LIMIT 1)
  SELECT
    CASE
      WHEN u.is_verified AND (SELECT plan_code FROM best) = 'gold'    THEN 'SUPER'::member_role_t
      WHEN u.is_verified AND (SELECT plan_code FROM best) = 'premium' THEN 'CLASSIC'::member_role_t
      WHEN u.is_verified THEN 'ACTIVE'::member_role_t
      WHEN EXISTS (SELECT 1 FROM badge_applications b
                   WHERE b.user_id = p_user AND b.status IN ('submitted','in_review','needs_fix'))
           THEN 'PENDING_REVIEW'::member_role_t
      ELSE 'BASIC'::member_role_t
    END,
    CASE WHEN u.is_verified THEN coalesce((SELECT plan_code FROM best), 'free'::plan_t) ELSE 'free'::plan_t END
  FROM u;
$$;
COMMENT ON FUNCTION compute_member_role(uuid, timestamptz) IS 'Source of truth for BASIC -> PENDING_REVIEW -> ACTIVE -> CLASSIC -> SUPER and the plan (free/premium/gold).';

CREATE OR REPLACE FUNCTION refresh_member_role(p_user uuid, p_reason text, p_actor actor_kind_t DEFAULT 'system', p_admin uuid DEFAULT NULL)
RETURNS member_role_t LANGUAGE plpgsql AS $$
DECLARE v_old_role member_role_t; v_old_plan plan_t; v_new_role member_role_t; v_new_plan plan_t;
BEGIN
  SELECT u.role, u.plan INTO v_old_role, v_old_plan FROM users u WHERE u.id = p_user FOR UPDATE;
  SELECT c.role, c.plan INTO v_new_role, v_new_plan FROM compute_member_role(p_user) c;
  IF v_new_role IS DISTINCT FROM v_old_role OR v_new_plan IS DISTINCT FROM v_old_plan THEN
    UPDATE users SET role = v_new_role, plan = v_new_plan, role_recomputed_at = now() WHERE id = p_user;
    INSERT INTO role_history (user_id, from_role, to_role, from_plan, to_plan, reason, actor_kind, admin_id)
    VALUES (p_user, v_old_role, v_new_role, v_old_plan, v_new_plan, p_reason, p_actor, p_admin);
  END IF;
  RETURN v_new_role;
END $$;
COMMENT ON FUNCTION refresh_member_role(uuid, text, actor_kind_t, uuid) IS 'Called by the entitlement service after every billing, verification or moderation event; writes role_history on change.';

CREATE OR REPLACE FUNCTION config_int(p_key text, p_default int) RETURNS int LANGUAGE sql STABLE AS $$
  SELECT coalesce((SELECT (value #>> '{}')::int FROM remote_config WHERE key = p_key), p_default);
$$;

-- v3.2 OD-03 daily spec cap. NULL = no daily limit.
CREATE OR REPLACE FUNCTION daily_spec_cap(p_role member_role_t) RETURNS int LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN p_role IN ('CLASSIC','SUPER') THEN NULL::int                                      -- Premium / Gold
    WHEN p_role = 'ACTIVE' THEN config_int('discovery.daily_cap.verified_free', 50)       -- Free + Black Badge
    ELSE config_int('discovery.daily_cap.basic', 25)                                      -- BASIC, PENDING_REVIEW
  END;
$$;
COMMENT ON FUNCTION daily_spec_cap(member_role_t) IS 'v3.2 OD-03: BASIC and PENDING_REVIEW (unverified Free) 25, ACTIVE (verified Free) 50, CLASSIC / SUPER (Premium / Gold) NULL = unlimited. Numbers come from remote_config discovery.daily_cap.basic / discovery.daily_cap.verified_free (admin-tunable).';

-- v3.2 OD-03 spend one spec view for the member's local day (the API passes
-- the member's local date, so the reset is at local midnight). Row-locked.
CREATE OR REPLACE FUNCTION spend_spec_view(p_user uuid, p_local_day date)
RETURNS TABLE (o_allowed boolean, o_used int, o_limit int) LANGUAGE plpgsql AS $$
DECLARE v_role member_role_t; v_cap int; v_used int;
BEGIN
  SELECT u.role INTO v_role FROM users u WHERE u.id = p_user;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown member %', p_user USING ERRCODE = '22023'; END IF;
  v_cap := daily_spec_cap(v_role);
  INSERT INTO usage_counters (user_id, metric, period_start, period_kind, count)
  VALUES (p_user, 'specs_viewed', p_local_day, 'day', 0)
  ON CONFLICT (user_id, metric, period_start) DO NOTHING;
  SELECT c.count INTO v_used FROM usage_counters c
   WHERE c.user_id = p_user AND c.metric = 'specs_viewed' AND c.period_start = p_local_day FOR UPDATE;
  IF v_cap IS NOT NULL AND v_used >= v_cap THEN                  -- AS6 cap screen
    RETURN QUERY SELECT false, v_used, v_cap; RETURN;
  END IF;
  UPDATE usage_counters SET count = count + 1, limit_snapshot = v_cap, updated_at = now()
   WHERE user_id = p_user AND metric = 'specs_viewed' AND period_start = p_local_day;
  RETURN QUERY SELECT true, v_used + 1, v_cap;
END $$;
COMMENT ON FUNCTION spend_spec_view(uuid, date) IS 'v3.2 OD-03 durable quota check for D1 cards: o_allowed false means the cap is reached (AS6: unverified -> Black Badge upsell "50 specs a day and start liking people back"; verified Free -> Premium upsell "No daily limit with Premium"). o_limit NULL = no daily limit (Premium / Gold). Redis quota:* is the fast path; this is the source of truth.';

-- v3.2 OD-05 four-eyes on every admin-initiated refund. Threshold 0 (or not
-- set) = all refunds; amounts above the threshold need an approval decided by
-- a second admin, used once. Provider / system refunds (Play, Flutterwave automatic,
-- Apple mirrored) are not gated.
CREATE OR REPLACE FUNCTION refund_approval_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_threshold int;
BEGIN
  IF NEW.initiated_by <> 'admin' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.approval_id IS NOT DISTINCT FROM OLD.approval_id
     AND NEW.amount_usd_cents = OLD.amount_usd_cents AND NEW.transaction_id = OLD.transaction_id
     AND NEW.admin_id IS NOT DISTINCT FROM OLD.admin_id AND OLD.initiated_by = 'admin' THEN
    RETURN NEW;                                                    -- status progress only
  END IF;
  IF NEW.admin_id IS NULL THEN
    RAISE EXCEPTION 'admin refund needs admin_id' USING ERRCODE = '23502';
  END IF;
  v_threshold := coalesce(config_int('billing.refund_approval_threshold_usd_cents', 0), 0);
  IF NEW.amount_usd_cents <= v_threshold THEN RETURN NEW; END IF;
  IF NEW.approval_id IS NULL OR NOT EXISTS (
       SELECT 1 FROM admin_approvals a
        WHERE a.id = NEW.approval_id AND a.status = 'approved'
          AND a.permission_key IN ('billing.refund','billing.refund_large')
          AND a.target_type = 'transactions' AND a.target_id = NEW.transaction_id::text
          AND a.decided_by <> NEW.admin_id) THEN
    RAISE EXCEPTION 'four-eyes: admin refund of % cents needs a second admin''s approval (OD-05)', NEW.amount_usd_cents
      USING ERRCODE = '42501';
  END IF;
  UPDATE admin_approvals SET status = 'executed', executed_at = now() WHERE id = NEW.approval_id;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_refund_approval BEFORE INSERT OR UPDATE ON refunds FOR EACH ROW EXECUTE FUNCTION refund_approval_guard();
COMMENT ON FUNCTION refund_approval_guard() IS 'v3.2 OD-05: an admin refund above remote_config billing.refund_approval_threshold_usd_cents (seeded 0 = every refund) needs approval_id = an approved billing.refund / billing.refund_large approval for that transaction, decided by an admin other than the one issuing it; the approval is marked executed (single use). Enforced in every environment.';

-- Race-free, idempotent reaction + match creation (the swipe ledger).
-- A per-pair advisory lock serialises two people reacting to each other at
-- the same millisecond; the partial unique index on active matches makes a
-- duplicate impossible; client_reaction_id makes outbox replays safe.
CREATE OR REPLACE FUNCTION record_reaction(p_actor uuid, p_target uuid, p_kind reaction_t,
                                           p_client_id uuid, p_surface feed_surface_t DEFAULT 'for_you')
RETURNS TABLE (o_reaction_id uuid, o_replayed boolean, o_match_id uuid, o_match_kind match_kind_t, o_intro_session_id uuid)
LANGUAGE plpgsql AS $$
DECLARE
  v_low  uuid := LEAST(p_actor, p_target);
  v_high uuid := GREATEST(p_actor, p_target);
  v_rid  uuid; v_rev reaction_t; v_kind match_kind_t; v_mid uuid; v_sid uuid; v_role member_role_t;
BEGIN
  IF p_actor = p_target THEN
    RAISE EXCEPTION 'cannot react to yourself' USING ERRCODE = '22023';
  END IF;

  SELECT r.id INTO v_rid FROM reactions r WHERE r.actor_id = p_actor AND r.client_reaction_id = p_client_id;
  IF FOUND THEN                                         -- outbox replay: return the original outcome
    SELECT m.id, m.kind INTO v_mid, v_kind FROM matches m
      WHERE m.user_a = v_low AND m.user_b = v_high AND m.status = 'active';
    SELECT s.id INTO v_sid FROM intro_sessions s WHERE s.match_id = v_mid;
    RETURN QUERY SELECT v_rid, true, v_mid, v_kind, v_sid;
    RETURN;
  END IF;

  IF p_kind <> 'pass' THEN
    SELECT u.role INTO v_role FROM users u WHERE u.id = p_actor;
    IF v_role NOT IN ('ACTIVE','CLASSIC','SUPER') THEN
      RAISE EXCEPTION 'verification required to like' USING ERRCODE = '42501', HINT = 'black_badge';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM blocks b WHERE b.unblocked_at IS NULL AND
               ((b.blocker_id = p_actor AND b.blocked_id = p_target) OR (b.blocker_id = p_target AND b.blocked_id = p_actor))) THEN
    RAISE EXCEPTION 'pair is blocked' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_low::text || ':' || v_high::text, 0));

  INSERT INTO reactions AS r (actor_id, target_id, kind, surface, client_reaction_id, pass_count, undo_until)
  VALUES (p_actor, p_target, p_kind, p_surface, p_client_id,
          CASE WHEN p_kind = 'pass' THEN 1 ELSE 0 END,
          CASE WHEN p_kind = 'pass' THEN now() + make_interval(secs => config_int('discovery.pass_undo_seconds', 6)) END)
  ON CONFLICT (actor_id, target_id) DO UPDATE
    SET kind = EXCLUDED.kind, surface = EXCLUDED.surface, client_reaction_id = EXCLUDED.client_reaction_id,
        pass_count = r.pass_count + CASE WHEN EXCLUDED.kind = 'pass' THEN 1 ELSE 0 END,
        undo_until = EXCLUDED.undo_until, undone_at = NULL, undone_via = NULL, created_at = now()
  RETURNING r.id INTO v_rid;

  INSERT INTO reaction_history (actor_id, target_id, kind, event) VALUES (p_actor, p_target, p_kind, 'react');

  IF p_kind = 'pass' THEN
    INSERT INTO pair_cooldowns (user_id, other_id, reason, until)
    VALUES (p_actor, p_target, 'pass', now() + make_interval(days => config_int('discovery.pass_memory_days', 30)))
    ON CONFLICT (user_id, other_id, reason) DO UPDATE SET until = EXCLUDED.until;
    RETURN QUERY SELECT v_rid, false, NULL::uuid, NULL::match_kind_t, NULL::uuid;
    RETURN;
  END IF;

  SELECT r.kind INTO v_rev FROM reactions r
   WHERE r.actor_id = p_target AND r.target_id = p_actor AND r.undone_at IS NULL;

  IF v_rev IS NULL OR v_rev = 'pass' THEN
    RETURN QUERY SELECT v_rid, false, NULL::uuid, NULL::match_kind_t, NULL::uuid;
    RETURN;
  END IF;

  v_kind := CASE WHEN p_kind = 'like' AND v_rev = 'like' THEN 'match'::match_kind_t ELSE 'maybe'::match_kind_t END;

  INSERT INTO matches AS m (user_a, user_b, kind, completed_by, intro_expires_at)
  VALUES (v_low, v_high, v_kind, p_actor, now() + make_interval(hours => config_int('intro.window_hours', 24)))
  ON CONFLICT (user_a, user_b) WHERE status = 'active' DO UPDATE
    SET kind = CASE WHEN EXCLUDED.kind = 'match' THEN 'match'::match_kind_t ELSE m.kind END
  RETURNING m.id, m.kind INTO v_mid, v_kind;

  INSERT INTO intro_sessions (match_id, user_a, user_b, expires_at, duration_s)
  SELECT v_mid, v_low, v_high, m.intro_expires_at, config_int('intro.seconds', 60) FROM matches m WHERE m.id = v_mid
  ON CONFLICT (match_id) DO NOTHING;
  SELECT s.id INTO v_sid FROM intro_sessions s WHERE s.match_id = v_mid;

  RETURN QUERY SELECT v_rid, false, v_mid, v_kind, v_sid;
END $$;
COMMENT ON FUNCTION record_reaction(uuid, uuid, reaction_t, uuid, feed_surface_t) IS 'POST /v1/reactions. Like/Somewhat need ACTIVE or above (Black Badge); Pass is open to all. Returns the match and intro session when the reaction completes a pair.';

-- Pass undo (6 s toast) and Gold Rewind (any time, entitlement checked by the API).
CREATE OR REPLACE FUNCTION undo_reaction(p_actor uuid, p_target uuid, p_via text DEFAULT 'undo_toast')
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  UPDATE reactions
     SET undone_at = now(), undone_via = p_via, pass_count = greatest(pass_count - 1, 0)
   WHERE actor_id = p_actor AND target_id = p_target AND kind = 'pass' AND undone_at IS NULL
     AND (p_via = 'rewind' OR undo_until >= now())
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'nothing to undo or undo window passed' USING ERRCODE = '22023';
  END IF;
  DELETE FROM pair_cooldowns WHERE user_id = p_actor AND other_id = p_target AND reason = 'pass';
  INSERT INTO reaction_history (actor_id, target_id, kind, event)
  VALUES (p_actor, p_target, 'pass', CASE WHEN p_via = 'rewind' THEN 'rewind' ELSE 'undo' END);
  RETURN v_id;
END $$;
COMMENT ON FUNCTION undo_reaction(uuid, uuid, text) IS 'D1 "You passed on Zara, Undo" within discovery.pass_undo_seconds, or Gold Rewind.';

-- MF3 blind, final decision. When both have decided: both keep -> chat
-- thread; otherwise "didn't click" + 30-day cooldown both ways.
CREATE OR REPLACE FUNCTION decide_intro(p_session uuid, p_user uuid, p_decision intro_decision_t)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE s intro_sessions%ROWTYPE; v_keep int; v_n int; v_cid uuid;
BEGIN
  SELECT * INTO s FROM intro_sessions WHERE id = p_session FOR UPDATE;
  IF NOT FOUND OR p_user NOT IN (s.user_a, s.user_b) THEN
    RAISE EXCEPTION 'not a participant' USING ERRCODE = '42501';
  END IF;
  IF s.status IN ('decided','expired') THEN RETURN s.outcome; END IF;
  INSERT INTO intro_decisions (intro_session_id, user_id, decision) VALUES (p_session, p_user, p_decision)
  ON CONFLICT DO NOTHING;
  SELECT count(*), count(*) FILTER (WHERE decision = 'keep') INTO v_n, v_keep
    FROM intro_decisions WHERE intro_session_id = p_session;
  IF v_n < 2 AND p_decision = 'keep' THEN RETURN 'waiting'; END IF;

  IF v_keep = 2 THEN
    INSERT INTO conversations (kind, user_a, user_b, match_id, intro_session_id, state, opened_via)
    VALUES ('match', s.user_a, s.user_b, s.match_id, s.id, 'open', 'both_keep')
    RETURNING id INTO v_cid;
    INSERT INTO conversation_participants (conversation_id, user_id) VALUES (v_cid, s.user_a), (v_cid, s.user_b);
    UPDATE intro_messages SET kept = true WHERE intro_session_id = p_session;
    UPDATE intro_sessions SET status = 'decided', outcome = 'both_keep', decided_at = now() WHERE id = p_session;
    RETURN 'both_keep';
  END IF;

  UPDATE intro_sessions SET status = 'decided', outcome = 'moved_on', decided_at = now() WHERE id = p_session;
  UPDATE matches SET status = 'moved_on', ended_at = now(), ended_reason = 'moved_on', ended_by = p_user WHERE id = s.match_id;
  INSERT INTO pair_cooldowns (user_id, other_id, reason, until) VALUES
    (s.user_a, s.user_b, 'moved_on', now() + interval '30 days'),
    (s.user_b, s.user_a, 'moved_on', now() + interval '30 days')
  ON CONFLICT (user_id, other_id, reason) DO UPDATE SET until = EXCLUDED.until;
  RETURN 'moved_on';
END $$;
COMMENT ON FUNCTION decide_intro(uuid, uuid, intro_decision_t) IS 'POST /v1/intros/{id}/decision. Conversation slot checks (Premium 20) happen in the API before calling.';

-- D10 Unmatch (after the confirm sheet): chat disappears for both.
CREATE OR REPLACE FUNCTION unmatch(p_match uuid, p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE m matches%ROWTYPE;
BEGIN
  SELECT * INTO m FROM matches WHERE id = p_match FOR UPDATE;
  IF NOT FOUND OR p_user NOT IN (m.user_a, m.user_b) THEN
    RAISE EXCEPTION 'not a participant' USING ERRCODE = '42501';
  END IF;
  IF m.status <> 'active' THEN RETURN; END IF;
  UPDATE matches SET status = 'unmatched', ended_at = now(), ended_by = p_user, ended_reason = 'unmatch' WHERE id = p_match;
  UPDATE conversations SET state = 'closed', closed_at = now(), closed_reason = 'unmatched'
   WHERE match_id = p_match AND state <> 'closed';
  INSERT INTO pair_cooldowns (user_id, other_id, reason, until) VALUES
    (m.user_a, m.user_b, 'unmatched', now() + make_interval(days => config_int('unmatch.cooldown_days', 30))),   -- v3.4 M19 T-7 admin-tunable
    (m.user_b, m.user_a, 'unmatched', now() + make_interval(days => config_int('unmatch.cooldown_days', 30)))
  ON CONFLICT (user_id, other_id, reason) DO UPDATE SET until = EXCLUDED.until;
END $$;
COMMENT ON FUNCTION unmatch(uuid, uuid) IS 'Irreversible ("This can''t be undone"). Message rows are deleted by the purge job after reported evidence is snapshotted. Unmatch cooldown 30 days: DECIDED (19 Nov 2026, OD-31 / T-7): keep the seed (admin-tunable).';

-- =====================================================================
-- 21. VIEWS AND MATERIALIZED VIEWS
-- =====================================================================

CREATE VIEW v_member_entitlements AS
SELECT u.id AS user_id, u.role, u.plan, u.is_verified,
       EXISTS (SELECT 1 FROM account_restrictions r WHERE r.user_id = u.id AND r.lifted_at IS NULL
               AND (r.ends_at IS NULL OR r.ends_at > now())) AS is_restricted,
       jsonb_object_agg(re.entitlement_key, re.value) AS entitlements
FROM users u
JOIN role_entitlements re ON re.role = u.role
GROUP BY u.id, u.role, u.plan, u.is_verified;
COMMENT ON VIEW v_member_entitlements IS 'GET /v1/me/entitlements: role, plan, restriction flag and the full entitlement map (cached in Redis ent:{user_id}).';

CREATE VIEW v_role_drift AS
SELECT u.id AS user_id, u.role AS cached_role, c.role AS computed_role, u.plan AS cached_plan, c.plan AS computed_plan
FROM users u CROSS JOIN LATERAL compute_member_role(u.id) c
WHERE u.role IS DISTINCT FROM c.role OR u.plan IS DISTINCT FROM c.plan;
COMMENT ON VIEW v_role_drift IS 'Members whose cached role differs from the computed one (should be empty; alert if not). Job: entitlements.reconcile hourly.';

CREATE VIEW v_chat_list AS
SELECT cp.user_id, c.id AS conversation_id, c.kind, c.state,
       CASE WHEN c.user_a = cp.user_id THEN c.user_b ELSE c.user_a END AS other_user_id,
       p.nickname AS other_nickname, pm.media_id AS other_main_photo_id,
       c.last_message_at, c.last_message_preview, cp.unread_count, cp.holds_slot, cp.muted_until, cp.read_only_reason
FROM conversation_participants cp
JOIN conversations c ON c.id = cp.conversation_id AND c.state <> 'closed'
JOIN profiles p ON p.user_id = CASE WHEN c.user_a = cp.user_id THEN c.user_b ELSE c.user_a END
LEFT JOIN profile_media pm ON pm.user_id = p.user_id AND pm.is_main
WHERE cp.hidden_at IS NULL AND cp.archived_at IS NULL;
COMMENT ON VIEW v_chat_list IS 'D8 Chats list rows (order by last_message_at DESC, keyset paginated).';

CREATE VIEW v_fresh_matches AS
SELECT x.user_id, m.id AS match_id, m.kind, x.other_user_id, m.intro_expires_at, s.id AS intro_session_id, s.status AS intro_status
FROM matches m
JOIN intro_sessions s ON s.match_id = m.id
CROSS JOIN LATERAL (VALUES (m.user_a, m.user_b), (m.user_b, m.user_a)) AS x(user_id, other_user_id)
WHERE m.status = 'active' AND s.status IN ('waiting','live','ended') AND m.intro_expires_at > now();
COMMENT ON VIEW v_fresh_matches IS 'D8 fresh-matches row and ES3: matches with no intro decision yet and hours left.';

CREATE VIEW v_likes_received AS
SELECT r.target_id AS user_id, r.actor_id AS from_user_id, r.kind::text AS kind, r.created_at, r.seen_by_target_at
FROM reactions r
WHERE r.kind IN ('like','somewhat') AND r.undone_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM reactions back WHERE back.actor_id = r.target_id AND back.target_id = r.actor_id AND back.undone_at IS NULL)
UNION ALL
SELECT d.recipient_id, d.sender_id, 'direct', d.created_at, d.responded_at
FROM dm_requests d WHERE d.kind = 'direct_spec' AND d.status = 'pending';
COMMENT ON VIEW v_likes_received IS 'D7 "Liked you" grid and D7F kind filter (like, somewhat, direct) with counts; blurred for BASIC. Excludes people you already reacted to.';

CREATE VIEW v_unread_counts AS
SELECT u.id AS user_id,
  (SELECT count(*) FROM conversation_participants cp WHERE cp.user_id = u.id AND cp.unread_count > 0 AND cp.hidden_at IS NULL) AS chats_unread,
  (SELECT count(*) FROM inbox_items i WHERE i.user_id = u.id AND i.read_at IS NULL) AS activity_unread,
  (SELECT count(*) FROM dm_requests d WHERE d.recipient_id = u.id AND d.status = 'pending') AS requests_pending,
  (SELECT count(*) FROM v_likes_received l WHERE l.user_id = u.id AND l.seen_by_target_at IS NULL) AS likes_new
FROM users u;
COMMENT ON VIEW v_unread_counts IS 'Tab badges (Likes 12, Chats 2), D16 unread, H7 requests. Call with WHERE user_id = $1; cached in Redis badge:{user_id}.';

CREATE VIEW v_current_consents AS
SELECT DISTINCT ON (user_id, kind) user_id, kind, action, version, document_id, created_at
FROM consent_records ORDER BY user_id, kind, created_at DESC;
COMMENT ON VIEW v_current_consents IS 'Latest consent state per member and kind (LG6, NDPC audit).';

CREATE VIEW v_admin_effective_permissions AS
SELECT ur.admin_id, rp.permission_key, ur.scope_kind, ur.scope_value, r.key AS role_key
FROM admin_user_roles ur
JOIN admin_roles r ON r.id = ur.role_id AND r.archived_at IS NULL
JOIN admin_role_permissions rp ON rp.role_id = ur.role_id
JOIN admin_users au ON au.id = ur.admin_id AND au.status = 'active'
WHERE ur.revoked_at IS NULL AND (ur.expires_at IS NULL OR ur.expires_at > now());
COMMENT ON VIEW v_admin_effective_permissions IS 'Every permission an active admin holds right now, with scope. Checked server-side on each admin request.';

CREATE VIEW v_admin_mfa_gaps AS
SELECT au.id AS admin_id, au.email, au.status
FROM admin_users au
WHERE au.status = 'active'
  AND NOT EXISTS (SELECT 1 FROM admin_mfa_factors f WHERE f.admin_id = au.id AND f.revoked_at IS NULL AND f.confirmed_at IS NOT NULL);
COMMENT ON VIEW v_admin_mfa_gaps IS 'Active admins without a confirmed MFA factor (must be empty; they are blocked at sign-in).';

CREATE VIEW v_research_summary AS
SELECT st.id AS study_id, st.code,
       count(DISTINCT se.id) AS sessions,
       round(avg(se.sus_score), 1) AS mean_sus,
       st.target_sus,
       round(avg(se.trust_score), 1) AS mean_trust,
       st.target_trust,
       round(avg(CASE WHEN tr.outcome = 'success' AND NOT tr.critical_error THEN 1.0 ELSE 0.0 END), 3) AS task_success_rate,
       st.target_task_success
FROM research_studies st
LEFT JOIN research_sessions se ON se.study_id = st.id
LEFT JOIN research_task_results tr ON tr.session_id = se.id
GROUP BY st.id, st.code, st.target_sus, st.target_trust, st.target_task_success;
COMMENT ON VIEW v_research_summary IS 'Usability test scorecard vs targets (SUS >= 80, trust >= 8, success >= 90%). Exportable from the admin console.';

CREATE MATERIALIZED VIEW mv_admin_daily_kpis AS
SELECT d::date AS day,
  (SELECT count(*) FROM users u WHERE u.created_at >= d AND u.created_at < d + interval '1 day') AS signups,
  (SELECT count(*) FROM users u WHERE u.onboarding_completed_at >= d AND u.onboarding_completed_at < d + interval '1 day') AS onboarding_completed,
  (SELECT count(*) FROM users u WHERE u.verified_at >= d AND u.verified_at < d + interval '1 day') AS verified,
  (SELECT count(*) FROM matches m WHERE m.created_at >= d AND m.created_at < d + interval '1 day' AND m.kind = 'match') AS matches,
  (SELECT count(*) FROM matches m WHERE m.created_at >= d AND m.created_at < d + interval '1 day' AND m.kind = 'maybe') AS maybe_matches,
  (SELECT count(*) FROM intro_sessions s WHERE s.started_at >= d AND s.started_at < d + interval '1 day') AS intros_started,
  (SELECT count(*) FROM conversations c WHERE c.created_at >= d AND c.created_at < d + interval '1 day') AS chats_opened,
  (SELECT count(*) FROM reports r WHERE r.created_at >= d AND r.created_at < d + interval '1 day') AS reports,
  (SELECT coalesce(sum(t.amount_usd_cents), 0) FROM transactions t WHERE t.occurred_at >= d AND t.occurred_at < d + interval '1 day'
     AND t.status = 'succeeded' AND t.kind IN ('purchase','renewal','upgrade','trial_conversion')) AS gross_usd_cents,
  -- v3.1 (Appendix C.1-19)
  (SELECT count(*) FROM messages msg WHERE msg.created_at >= d AND msg.created_at < d + interval '1 day' AND msg.kind <> 'system') AS messages_sent,
  (SELECT count(*) FROM intro_sessions s WHERE s.ends_at >= d AND s.ends_at < d + interval '1 day' AND s.status IN ('ended','decided')) AS intros_completed,
  (SELECT count(*) FROM reports r WHERE r.created_at < d + interval '1 day'
     AND (r.resolved_at IS NULL OR r.resolved_at >= d + interval '1 day') AND r.status NOT IN ('dismissed','duplicate')) AS reports_open_end_of_day
FROM generate_series(date_trunc('day', now()) - interval '89 days', date_trunc('day', now()), interval '1 day') AS d
WITH NO DATA;
CREATE UNIQUE INDEX uq_mv_daily_kpis ON mv_admin_daily_kpis (day);
COMMENT ON MATERIALIZED VIEW mv_admin_daily_kpis IS 'Admin overview, last 90 days. REFRESH MATERIALIZED VIEW CONCURRENTLY every 15 min (job stats.refresh).';

CREATE MATERIALIZED VIEW mv_city_weekly_joins AS
SELECT p.city_id, date_trunc('week', u.verified_at)::date AS week_start, count(*) AS new_verified_members
FROM users u JOIN profiles p ON p.user_id = u.id
WHERE u.verified_at IS NOT NULL AND u.verified_at > now() - interval '8 weeks' AND p.city_id IS NOT NULL
GROUP BY p.city_id, date_trunc('week', u.verified_at)::date
WITH NO DATA;
CREATE UNIQUE INDEX uq_mv_city_weekly ON mv_city_weekly_joins (city_id, week_start);
COMMENT ON MATERIALIZED VIEW mv_city_weekly_joins IS 'Scarcity card "12 people joined Lagos this week" (D1, supply = few). Real counts only, never padded. Hourly refresh.';

CREATE MATERIALIZED VIEW mv_moderation_sla AS
SELECT kind, count(*) AS open_cases,
       count(*) FILTER (WHERE sla_due_at < now()) AS overdue,
       min(created_at) AS oldest_created_at
FROM moderation_cases WHERE status IN ('queued','claimed') GROUP BY kind
WITH NO DATA;
CREATE UNIQUE INDEX uq_mv_mod_sla ON mv_moderation_sla (kind);
COMMENT ON MATERIALIZED VIEW mv_moderation_sla IS 'Queue sizes and SLA risk per case kind (admin overview). Refresh every 5 min.';

CREATE MATERIALIZED VIEW mv_revenue_daily AS
SELECT date_trunc('day', t.occurred_at)::date AS day, t.provider, pr.code AS product_code,
       coalesce(p.country, 'ZZ')::text AS country,                                      -- v3.4 B3 A23 "By country" (member country; ZZ unknown)
       count(*) FILTER (WHERE t.kind IN ('purchase','renewal','upgrade','trial_conversion') AND t.status = 'succeeded') AS paid_count,
       coalesce(sum(t.amount_usd_cents) FILTER (WHERE t.kind IN ('purchase','renewal','upgrade','trial_conversion') AND t.status = 'succeeded'), 0) AS gross_usd_cents,
       coalesce(sum(t.amount_usd_cents) FILTER (WHERE t.kind IN ('refund','chargeback')), 0) AS refunds_usd_cents
FROM transactions t JOIN products pr ON pr.id = t.product_id
LEFT JOIN profiles p ON p.user_id = t.user_id
WHERE t.environment = 'production'                                                      -- v3.4 B3 sandbox left out of the totals
GROUP BY 1, 2, 3, 4
WITH NO DATA;
CREATE UNIQUE INDEX uq_mv_revenue ON mv_revenue_daily (day, provider, product_code, country);
COMMENT ON MATERIALIZED VIEW mv_revenue_daily IS 'Finance dashboard in USD by day, provider (App Store, Google Play, Flutterwave), product and (v3.4 B3) member country. Production transactions only: sandbox rows are labelled on transactions.environment and left out of the totals (A19 / A23 acceptance; the A23 "include sandbox" toggle reads transactions directly). Store fees are not deducted here.';

-- v3.1 C.1-19 Overview KPIs by country (member country = profiles.country).
CREATE MATERIALIZED VIEW mv_admin_daily_kpis_by_country AS
WITH signups AS (
  SELECT u.created_at::date AS day, coalesce(p.country::text, 'ZZ') AS country, count(*) AS signups
  FROM users u LEFT JOIN profiles p ON p.user_id = u.id
  WHERE u.created_at >= date_trunc('day', now()) - interval '89 days' GROUP BY 1, 2),
verified AS (
  SELECT u.verified_at::date AS day, coalesce(p.country::text, 'ZZ') AS country, count(*) AS verified
  FROM users u LEFT JOIN profiles p ON p.user_id = u.id
  WHERE u.verified_at >= date_trunc('day', now()) - interval '89 days' GROUP BY 1, 2),
matched AS (
  SELECT m.created_at::date AS day, coalesce(p.country::text, 'ZZ') AS country, count(*) AS matches
  FROM matches m LEFT JOIN profiles p ON p.user_id = m.user_a
  WHERE m.created_at >= date_trunc('day', now()) - interval '89 days' GROUP BY 1, 2),
msgs AS (
  SELECT msg.created_at::date AS day, coalesce(p.country::text, 'ZZ') AS country, count(*) AS messages_sent
  FROM messages msg LEFT JOIN profiles p ON p.user_id = msg.sender_id
  WHERE msg.created_at >= date_trunc('day', now()) - interval '89 days' AND msg.kind <> 'system' GROUP BY 1, 2),
intros AS (
  SELECT s.ends_at::date AS day, coalesce(p.country::text, 'ZZ') AS country, count(*) AS intros_completed
  FROM intro_sessions s LEFT JOIN profiles p ON p.user_id = s.user_a
  WHERE s.ends_at >= date_trunc('day', now()) - interval '89 days' AND s.status IN ('ended','decided') GROUP BY 1, 2),
rep AS (
  SELECT r.created_at::date AS day, coalesce(p.country::text, 'ZZ') AS country, count(*) AS reports
  FROM reports r LEFT JOIN profiles p ON p.user_id = r.reported_user_id
  WHERE r.created_at >= date_trunc('day', now()) - interval '89 days' GROUP BY 1, 2),
rev AS (
  SELECT t.occurred_at::date AS day, coalesce(p.country::text, 'ZZ') AS country, sum(t.amount_usd_cents) AS gross_usd_cents
  FROM transactions t LEFT JOIN profiles p ON p.user_id = t.user_id
  WHERE t.occurred_at >= date_trunc('day', now()) - interval '89 days' AND t.status = 'succeeded'
    AND t.kind IN ('purchase','renewal','upgrade','trial_conversion') GROUP BY 1, 2),
keys AS (
  SELECT day, country FROM signups UNION SELECT day, country FROM verified UNION SELECT day, country FROM matched
  UNION SELECT day, country FROM msgs UNION SELECT day, country FROM intros UNION SELECT day, country FROM rep
  UNION SELECT day, country FROM rev)
SELECT k.day, k.country,
       coalesce(su.signups, 0) AS signups, coalesce(v.verified, 0) AS verified, coalesce(ma.matches, 0) AS matches,
       coalesce(ms.messages_sent, 0) AS messages_sent, coalesce(i.intros_completed, 0) AS intros_completed,
       coalesce(r.reports, 0) AS reports, coalesce(rv.gross_usd_cents, 0) AS gross_usd_cents
FROM keys k
LEFT JOIN signups su ON su.day = k.day AND su.country = k.country
LEFT JOIN verified v ON v.day = k.day AND v.country = k.country
LEFT JOIN matched ma ON ma.day = k.day AND ma.country = k.country
LEFT JOIN msgs ms ON ms.day = k.day AND ms.country = k.country
LEFT JOIN intros i ON i.day = k.day AND i.country = k.country
LEFT JOIN rep r ON r.day = k.day AND r.country = k.country
LEFT JOIN rev rv ON rv.day = k.day AND rv.country = k.country
WITH NO DATA;
CREATE UNIQUE INDEX uq_mv_kpis_country ON mv_admin_daily_kpis_by_country (day, country);
COMMENT ON MATERIALIZED VIEW mv_admin_daily_kpis_by_country IS 'v3.1 A33 overview with a country filter (90 days; ZZ = no profile country). The API applies the viewing admin''s country scope. Refresh CONCURRENTLY every 15 min (stats.refresh).';

-- v3.1 C.1-20 Daily active members (AD-16 default source: consent-gated analytics_events).
CREATE MATERIALIZED VIEW mv_active_users_daily AS
SELECT e.occurred_at::date AS day, coalesce(e.country::text, 'ZZ') AS country, coalesce(e.platform::text, 'unknown') AS platform,
       count(DISTINCT e.user_id) AS active_members,
       'analytics_events'::text AS source
FROM analytics_events e
WHERE e.user_id IS NOT NULL AND e.occurred_at >= date_trunc('day', now()) - interval '89 days'
GROUP BY 1, 2, 3
WITH NO DATA;
CREATE UNIQUE INDEX uq_mv_active_daily ON mv_active_users_daily (day, country, platform);
COMMENT ON MATERIALIZED VIEW mv_active_users_daily IS 'v3.1 A33 / A34 daily active members per day, country and platform (90 days). Source per AD-16: consent-gated analytics_events, so the console labels it "members who allowed analytics"; the source switches to sessions only if legal approves a legitimate-interest basis. Refresh hourly (stats.refresh).';

-- v3.1 A22 pool stock (counts only; codes are never shown).
CREATE VIEW v_offer_pool_stock AS
SELECT p.id AS pool_id, p.campaign_id, p.platform, p.store_offer_ref, p.total, p.low_water_pct, p.expires_at,
       count(c.id) FILTER (WHERE c.status = 'available') AS available,
       count(c.id) FILTER (WHERE c.status = 'issued')    AS issued,
       count(c.id) FILTER (WHERE c.status = 'redeemed')  AS redeemed,
       count(c.id) FILTER (WHERE c.status = 'expired')   AS expired,
       count(c.id) FILTER (WHERE c.status = 'voided')    AS voided,
       (count(c.id) FILTER (WHERE c.status = 'available'))::numeric * 100 <= p.low_water_pct::numeric * greatest(p.total, 1) AS is_low
FROM offer_code_pools p LEFT JOIN offer_codes c ON c.pool_id = p.id
GROUP BY p.id;
COMMENT ON VIEW v_offer_pool_stock IS 'v3.1 A22 pool view: total / available / issued / redeemed / expired / voided and the low-water flag (available <= low_water_pct of total) that raises the notification.';

-- v3.1 A28 publishing queue across every CMS table.
CREATE VIEW v_content_queue AS
SELECT 'site_pages'::text AS entity_type, id, title AS label, locale::text AS locale, status, publish_at, unpublish_at, updated_by, approved_by, updated_at FROM site_pages WHERE status IN ('in_review','approved','scheduled')
UNION ALL SELECT 'site_blocks', id, coalesce(name, key), locale::text, status, publish_at, unpublish_at, updated_by, approved_by, updated_at FROM site_blocks WHERE status IN ('in_review','approved','scheduled')
UNION ALL SELECT 'stories', id, title, locale::text, status, publish_at, unpublish_at, updated_by, approved_by, updated_at FROM stories WHERE status IN ('in_review','approved','scheduled')
UNION ALL SELECT 'careers_jobs', id, title, NULL, status, publish_at, unpublish_at, updated_by, approved_by, updated_at FROM careers_jobs WHERE status IN ('in_review','approved','scheduled')
UNION ALL SELECT 'investor_documents', id, title, NULL, status, publish_at, unpublish_at, updated_by, approved_by, updated_at FROM investor_documents WHERE status IN ('in_review','approved','scheduled')
UNION ALL SELECT 'press_items', id, title, NULL, status, publish_at, unpublish_at, updated_by, approved_by, updated_at FROM press_items WHERE status IN ('in_review','approved','scheduled')
UNION ALL SELECT 'help_articles', id, title, locale::text, status, publish_at, unpublish_at, updated_by, approved_by, updated_at FROM help_articles WHERE status IN ('in_review','approved','scheduled')
UNION ALL SELECT 'legal_documents', id, title, locale::text, status, publish_at, unpublish_at, updated_by, approved_by, updated_at FROM legal_documents WHERE status IN ('in_review','approved','scheduled')
UNION ALL SELECT 'faqs', id, question, locale::text, status, publish_at, unpublish_at, updated_by, approved_by, updated_at FROM faqs WHERE status IN ('in_review','approved','scheduled')
UNION ALL SELECT 'journal_articles', id, title, locale::text, status, publish_at, unpublish_at, updated_by, approved_by, updated_at FROM journal_articles WHERE status IN ('in_review','approved','scheduled');
COMMENT ON VIEW v_content_queue IS 'v3.1 A28 /content/publishing: items in review, approved or scheduled across the 10 CMS tables (served by the idx_<table>_wf_queue partial indexes).';

-- =====================================================================
-- 22. ROW-LEVEL SECURITY (sketch)
--     The member API runs as role app_api and sets SET LOCAL app.user_id
--     per request. Workers and the admin API use roles with BYPASSRLS
--     (app_worker, app_admin_api). Table owners bypass RLS (no FORCE), so
--     migrations are unaffected. Extend to every member-owned table.
-- =====================================================================
ALTER TABLE profiles                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_items               ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_records           ENABLE ROW LEVEL SECURITY;
ALTER TABLE trusted_contacts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_export_requests      ENABLE ROW LEVEL SECURITY;
ALTER TABLE reverification_requests   ENABLE ROW LEVEL SECURITY;  -- v3.1

-- SECURITY DEFINER so the check sees blocks in both directions despite blocks RLS.
CREATE OR REPLACE FUNCTION is_blocked_pair(p_a uuid, p_b uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM blocks b WHERE b.unblocked_at IS NULL
                 AND ((b.blocker_id = p_a AND b.blocked_id = p_b) OR (b.blocker_id = p_b AND b.blocked_id = p_a)));
$$;
CREATE POLICY profiles_read ON profiles FOR SELECT
  USING (user_id = app_current_user_id()
         OR (NOT is_hidden AND NOT is_blocked_pair(app_current_user_id(), profiles.user_id)));
CREATE POLICY profiles_write ON profiles FOR UPDATE
  USING (user_id = app_current_user_id()) WITH CHECK (user_id = app_current_user_id());

CREATE POLICY reactions_own ON reactions FOR SELECT
  USING (actor_id = app_current_user_id() OR target_id = app_current_user_id());
CREATE POLICY reactions_insert ON reactions FOR INSERT WITH CHECK (actor_id = app_current_user_id());

CREATE POLICY cp_own ON conversation_participants FOR ALL
  USING (user_id = app_current_user_id()) WITH CHECK (user_id = app_current_user_id());

CREATE POLICY messages_read ON messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM conversation_participants cp
                 WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = app_current_user_id() AND cp.hidden_at IS NULL));
CREATE POLICY messages_send ON messages FOR INSERT
  WITH CHECK (sender_id = app_current_user_id()
              AND EXISTS (SELECT 1 FROM conversation_participants cp
                          WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = app_current_user_id()));

CREATE POLICY inbox_own     ON inbox_items          FOR ALL USING (user_id = app_current_user_id()) WITH CHECK (user_id = app_current_user_id());
CREATE POLICY consents_own  ON consent_records      FOR SELECT USING (user_id = app_current_user_id());
CREATE POLICY consents_add  ON consent_records      FOR INSERT WITH CHECK (user_id = app_current_user_id());
CREATE POLICY trusted_own   ON trusted_contacts     FOR ALL USING (user_id = app_current_user_id()) WITH CHECK (user_id = app_current_user_id());
CREATE POLICY blocks_own    ON blocks               FOR ALL USING (blocker_id = app_current_user_id()) WITH CHECK (blocker_id = app_current_user_id());
CREATE POLICY exports_own   ON data_export_requests FOR ALL USING (user_id = app_current_user_id()) WITH CHECK (user_id = app_current_user_id());
CREATE POLICY reverify_own  ON reverification_requests FOR SELECT USING (user_id = app_current_user_id());  -- v3.1 member reads own; writes are admin-only

-- =====================================================================
-- 23. PARTITIONS (Nov 2026 -> Dec 2027; job partitions.ensure keeps 3 months ahead)
-- =====================================================================
SELECT ensure_monthly_partitions(t, DATE '2026-11-01', 14)
FROM unnest(ARRAY['messages','group_messages','analytics_events','admin_audit_log',
                  'feed_impressions','api_request_rollups','api_request_samples',
                  'api_request_ip_rollups']) AS t;   -- v3.1 + api_request_ip_rollups

-- =====================================================================
-- 24. SEED DATA (reference data only; no member data)
-- =====================================================================

INSERT INTO countries (iso2, name_key, dial_code, emergency_number, is_launch_market, allows_international, default_locale, timezone_default) VALUES
 ('NG','country.ng','+234','112', true,  true,  'en','Africa/Lagos'),     -- v3.2 OD-09 only launch market
 ('GH','country.gh','+233', NULL, false, false, 'en','Africa/Accra'),     -- v3.2 waitlist
 ('KE','country.ke','+254', NULL, false, false, 'en','Africa/Nairobi'),   -- v3.2 waitlist
 ('CI','country.ci','+225', NULL, false, false, 'fr','Africa/Abidjan'),   -- v3.2 waitlist
 ('GB','country.gb','+44',  NULL, false, false, 'en','Europe/London'),
 ('US','country.us','+1',   NULL, false, false, 'en','America/New_York');
COMMENT ON COLUMN countries.emergency_number IS 'DECIDED (18 Nov 2026, OD-09): emergency numbers ship for Nigeria only (112); other numbers are added (with verified_by / at) as each market opens. Only NG is a launch market; GH, KE, CI and the diaspora (GB, US) are waitlist only and not allows_international until they open, so the Gold International tab shows "Opening soon" with a waitlist count.';

INSERT INTO cities (country, name, ascii_name, admin_area, centroid, timezone, is_popular, market_status, display_order) VALUES  -- v3.2 OD-09
 ('NG','Lagos','lagos','Lagos',  ST_SetSRID(ST_MakePoint(3.3792, 6.5244),4326)::geography,'Africa/Lagos',true,'live',1),
 ('NG','Abuja','abuja','FCT',    ST_SetSRID(ST_MakePoint(7.3986, 9.0765),4326)::geography,'Africa/Lagos',true,'beta',2),
 ('GH','Accra','accra','Greater Accra', ST_SetSRID(ST_MakePoint(-0.1870, 5.6037),4326)::geography,'Africa/Accra',true,'waitlist',3),
 ('KE','Nairobi','nairobi','Nairobi',   ST_SetSRID(ST_MakePoint(36.8219,-1.2921),4326)::geography,'Africa/Nairobi',true,'waitlist',4),
 ('CI','Abidjan','abidjan','Abidjan',   ST_SetSRID(ST_MakePoint(-4.0083, 5.3600),4326)::geography,'Africa/Abidjan',true,'waitlist',5);
COMMENT ON COLUMN cities.display_order IS 'v3.2 OD-09 seed: Lagos live (only live market), every other Nigerian city beta (closed beta by invite, remote_config markets.beta_requires_invite), Accra / Nairobi / Abidjan and the diaspora waitlist only.';

INSERT INTO languages (code, name_key, native_name, aliases, is_app_locale, popularity) VALUES
 ('en','lang.en','English','{}',true,100), ('pcm','lang.pcm','Naijá','{Pidgin,"Nigerian Pidgin"}',true,95),
 ('fr','lang.fr','Français','{French}',true,80), ('yo','lang.yo','Yorùbá','{Yoruba}',false,90),
 ('ig','lang.ig','Igbo','{}',false,88), ('ha','lang.ha','Hausa','{}',false,85),
 ('bin','lang.bin','Edo','{Bini}',false,40), ('efi','lang.efi','Efik','{}',false,35),
 ('ibb','lang.ibb','Ibibio','{}',false,35), ('tiv','lang.tiv','Tiv','{}',false,30),
 ('ijo','lang.ijo','Ijaw','{Izon}',false,30), ('urh','lang.urh','Urhobo','{}',false,30),
 ('tw','lang.tw','Twi','{Akan}',false,60), ('sw','lang.sw','Kiswahili','{Swahili}',false,60);

INSERT INTO option_sets (key, label_key, question_key, pii_class, needs_consent, multi_select, max_select, in_profile, in_preferences, can_be_dealbreaker, premium_only, show_on_profile, sort) VALUES
 ('traits','opt.traits','q.traits','personal',NULL,true,5,false,true,false,true,false,1),
 ('goal','opt.goal','q.goal','personal',NULL,true,NULL,false,true,true,true,false,2),
 ('kids','opt.kids','q.kids','personal',NULL,false,NULL,true,true,true,false,true,3),
 ('faith','opt.faith','q.faith','sensitive','faith',false,NULL,true,true,true,true,false,4),
 ('faith_practice','opt.faith_practice','q.faith_practice','sensitive','faith',false,NULL,true,true,true,true,false,5),
 ('genotype','opt.genotype','q.genotype','sensitive','genotype',false,NULL,true,true,true,true,false,6),
 ('drink','opt.drink','q.drink','personal',NULL,false,NULL,true,true,true,false,true,7),
 ('smoke','opt.smoke','q.smoke','personal',NULL,false,NULL,true,true,true,false,true,8),
 ('exercise','opt.exercise','q.exercise','personal',NULL,false,NULL,true,true,true,true,true,9),
 ('diet','opt.diet','q.diet','personal',NULL,false,NULL,true,false,false,true,true,10),
 ('sleep','opt.sleep','q.sleep','personal',NULL,false,NULL,true,false,false,true,true,11),
 ('education','opt.education','q.education','personal',NULL,false,NULL,true,true,true,true,true,12),
 ('work','opt.work','q.work','personal',NULL,false,NULL,true,true,true,true,true,13);

INSERT INTO options (set_key, key, label_key, sort, is_prefer_not_to_say)
SELECT s, k, 'opt.' || s || '.' || k, ord, k = 'prefer_not'
FROM (VALUES
 ('traits', ARRAY['kind','honest','loyal','respectful','emotionally_mature','funny','ambitious','hardworking','family_oriented','god_fearing','financially_responsible','good_listener','supportive','calm','generous','romantic','adventurous','intelligent','confident','patient']),
 ('goal', ARRAY['marriage','long_term','long_open_short','short_open_long','casual','new_friends','figuring_out']),
 ('kids', ARRAY['wants_children','doesnt_want_children','has_children','open_to_their_children','not_sure','prefer_not']),
 ('faith', ARRAY['christian','muslim','traditional','spiritual','not_religious','other_faith','prefer_not']),
 ('faith_practice', ARRAY['very_practising','somewhat','not_much','doesnt_matter']),
 ('genotype', ARRAY['aa','as','ac','ss','doesnt_know']),
 ('drink', ARRAY['doesnt_drink','sober_curious','special_occasions','social_weekends','most_nights','prefer_not']),
 ('smoke', ARRAY['non_smoker','social_smoker','smoker','trying_to_quit','prefer_not']),
 ('exercise', ARRAY['every_day','often','sometimes','never']),
 ('diet', ARRAY['eat_everything','vegetarian','halal','prefer_not']),
 ('sleep', ARRAY['early_bird','night_owl','depends']),
 ('education', ARRAY['secondary','ond_hnd','bachelors','masters','phd','trade_vocational','still_studying']),
 ('work', ARRAY['employed','self_employed','business_owner','civil_servant','student','between_jobs'])
) AS v(s, arr)
CROSS JOIN LATERAL unnest(arr) WITH ORDINALITY AS u(k, ord);

INSERT INTO vibe_tags (slug, category, label_key, popularity) VALUES  -- v3.4 M3: the 59 B7 vibes are the starter catalogue (T-8)
 ('afrobeats','music','vibe.afrobeats',100), ('live-music','going_out','vibe.live_music',90), ('jollof-judge','food','vibe.jollof_judge',90), ('non-smoker','lifestyle','vibe.non_smoker',90),
 ('church','faith','vibe.church',90), ('beach-days','travel','vibe.beach_days',90), ('gym','fitness','vibe.gym',90), ('foodie','food','vibe.foodie',90),
 ('road-trips','travel','vibe.road_trips',90), ('social-drinker','lifestyle','vibe.social_drinker',90), ('movies','culture','vibe.movies',90), ('football','sport','vibe.football',90),
 ('amapiano','music','vibe.amapiano',50), ('gospel','music','vibe.gospel',50), ('highlife','music','vibe.highlife',50), ('hip-hop','music','vibe.hip_hop',50),
 ('randb','music','vibe.randb',50), ('jazz','music','vibe.jazz',50), ('clubbing','going_out','vibe.clubbing',50), ('karaoke','going_out','vibe.karaoke',50),
 ('quiet-nights-in','going_out','vibe.quiet_nights_in',50), ('brunch','going_out','vibe.brunch',50), ('comedy-shows','going_out','vibe.comedy_shows',50), ('cooking','food','vibe.cooking',50),
 ('suya-runs','food','vibe.suya_runs',50), ('vegetarian','food','vibe.vegetarian',50), ('wine','food','vibe.wine',50), ('mosque','faith','vibe.mosque',50),
 ('spiritual','faith','vibe.spiritual',50), ('running','fitness','vibe.running',50), ('dance','fitness','vibe.dance',50), ('yoga','fitness','vibe.yoga',50),
 ('hiking','fitness','vibe.hiking',50), ('swimming','fitness','vibe.swimming',50), ('basketball','sport','vibe.basketball',50), ('tennis','sport','vibe.tennis',50),
 ('formula-1','sport','vibe.formula_1',50), ('abroad-trips','travel','vibe.abroad_trips',50), ('staycations','travel','vibe.staycations',50), ('camping','travel','vibe.camping',50),
 ('books','culture','vibe.books',50), ('art-galleries','culture','vibe.art_galleries',50), ('nollywood','culture','vibe.nollywood',50), ('anime','culture','vibe.anime',50),
 ('photography','culture','vibe.photography',50), ('fashion','culture','vibe.fashion',50), ('gaming','culture','vibe.gaming',50), ('podcasts','culture','vibe.podcasts',50),
 ('tech','culture','vibe.tech',50), ('startups','career','vibe.startups',50), ('investing','career','vibe.investing',50), ('volunteering','career','vibe.volunteering',50),
 ('dogs','pets','vibe.dogs',50), ('cats','pets','vibe.cats',50), ('plants','home','vibe.plants',50), ('interior-design','home','vibe.interior_design',50),
 ('non-drinker','lifestyle','vibe.non_drinker',50), ('early-riser','lifestyle','vibe.early_riser',50), ('night-owl','lifestyle','vibe.night_owl',50);
COMMENT ON COLUMN vibe_tags.slug IS 'v3.4 M3: the starter set is the 59-vibe B7 list (slugs = board ids; suya-nights, fitness, reading and travel became suya-runs, gym, books and road-trips / abroad-trips). DECIDED (19 Nov 2026, OD-31 / T-8): launch with the starter catalogue; revise after Lagos research.';

INSERT INTO industries (slug, label_key) VALUES  -- v3.4 M22: the 26 P2 industries + other
 ('design','ind.design'), ('technology','ind.technology'), ('finance','ind.finance'), ('health','ind.health'), ('education','ind.education'),
 ('creative','ind.creative'), ('own_business','ind.own_business'), ('public_service','ind.public_service'), ('law','ind.law'), ('engineering','ind.engineering'),
 ('oil_gas','ind.oil_gas'), ('agriculture','ind.agriculture'), ('retail','ind.retail'), ('hospitality','ind.hospitality'), ('fashion_beauty','ind.fashion_beauty'),
 ('real_estate','ind.real_estate'), ('logistics','ind.logistics'), ('telecoms','ind.telecoms'), ('ngo','ind.ngo'), ('military_security','ind.military_security'),
 ('aviation','ind.aviation'), ('sport_fitness','ind.sport_fitness'), ('music_entertainment','ind.music_entertainment'), ('student','ind.student'), ('science_research','ind.science_research'),
 ('consulting','ind.consulting'), ('other','ind.other');

INSERT INTO prompts (key, text_key, sort) VALUES
 ('win_me_over','prompt.win_me_over',1), ('green_flag','prompt.green_flag',2), ('most_lagos_habit','prompt.most_lagos_habit',3),
 ('get_along_if','prompt.get_along_if',4), ('weekends','prompt.weekends',5), ('two_truths','prompt.two_truths',6),
 ('perfect_sunday','prompt.perfect_sunday',7);

INSERT INTO report_reasons (key, label_key, severity, sla_minutes, human_within_1h, sort) VALUES
 ('fake','report.fake',3,1440,false,1), ('harass','report.harass',5,60,true,2), ('photos','report.photos',3,1440,false,3),
 ('minor','report.minor',5,60,true,4), ('money','report.money',4,1440,false,5), ('offline','report.offline',4,1440,false,6),
 ('other','report.other',2,1440,false,7);
COMMENT ON COLUMN report_reasons.sla_minutes IS 'Under-18 and threats (harass) 60 min; others 24 h (safety-rules). DECIDED (19 Nov 2026, OD-31 / AD-36): "Something happened on a date" (offline) is a 24 h case (1440 min).';

INSERT INTO plans (code, rank, grants_role, name_key, tier_colour_light, tier_colour_dark) VALUES
 ('free',   0, NULL,      'plan.free',    '#858583', '#737371'),
 ('premium',1, 'CLASSIC', 'plan.premium', '#6E737B', '#B4B9C1'),
 ('gold',   2, 'SUPER',   'plan.gold',    '#8A6414', '#D4A64A');
COMMENT ON COLUMN plans.tier_colour_dark IS 'Free shows grey dashed when unverified (BASIC); once verified (Black Badge) the ring is Ink #0A0A0A. The purple All Access colour is gone.';

INSERT INTO entitlements (key, value_type, description, ui_screens) VALUES
 ('discovery.specs_per_day','int_or_unlimited','Specs browsable per local day','{D1,AS6}'),
 ('discovery.international','bool','International tab and filter','{D1,D1F,GD2}'),
 ('discovery.international_countries','int','Max international countries','{GD2}'),
 ('discovery.rewind','bool','Undo a Pass after the 6 s toast','{D1}'),
 ('react.like_somewhat','bool','Like and Somewhat','{D1,D4}'),
 ('likes.see_who','bool','See who liked you (unblurred)','{D7,MF1}'),
 ('likes.sort_filter','bool','Likes sort & filter (D7F): Premium and Gold (OD-31 / P-3)','{D7F}'),
 ('intro.one_minute','bool','1-Minute Intro','{D5,D6,MF2,MF3}'),
 ('chat.full','bool','Keep chatting after the intro','{D9,MF3}'),
 ('chat.open_conversations','int_or_unlimited','Open conversation slots','{D8,P6}'),
 ('chat.skip_intro','bool','Skip intro, open chat','{D5}'),
 ('chat.message_effects','bool','Message effects tray','{D9}'),
 ('chat.read_receipts','bool','See read receipts','{D9}'),
 ('direct_specs.per_week','int','Direct Specs per ISO week','{D11,D4,GD6}'),
 ('presence.invisible','bool','Invisible / incognito presence','{D2}'),
 ('spotlight.turns_per_week','int','Spotlight turns a week (one per rotation; OD-18)','{MF6}'),
 ('spotlight.priority','bool','Placed first in each Spotlight rotation (Gold; OD-18)','{MF6}'),
 ('calls.audio_video','bool','Audio and video calls (later release)','{MF4}'),
 ('groups.post','bool','Post in groups','{D13}'),
 ('groups.own_max','int','Groups you can own','{D12,GC1,GC4}'),
 ('profile.premium_sections','bool','Lifestyle, career and preferences sections','{PM1,P1,P2,P3}'),
 ('media.photos_max','int','Photo slots','{PM1,B8,P4,GD4,BL6}'),
 ('media.clips_max','int','Clip slots (each <= 30 s)','{PM1,B8,P4,GD4,BL6}'),
 ('verification.carrier_check','bool','Live phone (carrier) check','{GD1}'),
 ('safety.cross_border_briefing','bool','Cross-border safety briefing','{GD3}');

INSERT INTO role_entitlements (role, entitlement_key, value)
SELECT r.role::member_role_t, e.key, (e.vals)[r.ord]
FROM (VALUES
  ('discovery.specs_per_day',        ARRAY['25','25','50','null','null']::jsonb[]),   -- v3.2 OD-03
  ('discovery.international',        ARRAY['false','false','false','false','true']::jsonb[]),
  ('discovery.international_countries', ARRAY['0','0','0','0','5']::jsonb[]),
  ('discovery.rewind',               ARRAY['false','false','false','false','true']::jsonb[]),
  ('react.like_somewhat',            ARRAY['false','false','true','true','true']::jsonb[]),
  ('likes.see_who',                  ARRAY['false','false','true','true','true']::jsonb[]),
  ('likes.sort_filter',              ARRAY['false','false','false','true','true']::jsonb[]),   -- v3.3 OD-31 / P-3
  ('intro.one_minute',               ARRAY['false','false','true','true','true']::jsonb[]),
  ('chat.full',                      ARRAY['false','false','false','true','true']::jsonb[]),
  ('chat.open_conversations',        ARRAY['0','0','0','20','null']::jsonb[]),
  ('chat.skip_intro',                ARRAY['false','false','false','true','true']::jsonb[]),
  ('chat.message_effects',           ARRAY['false','false','false','true','true']::jsonb[]),
  ('chat.read_receipts',             ARRAY['false','false','false','false','true']::jsonb[]),
  ('direct_specs.per_week',          ARRAY['0','0','0','0','20']::jsonb[]),
  ('presence.invisible',             ARRAY['false','false','false','false','true']::jsonb[]),
  ('spotlight.turns_per_week',       ARRAY['0','0','0','3','3']::jsonb[]),   -- v3.3 OD-18: a turn in each of the 3 rotations
  ('spotlight.priority',             ARRAY['false','false','false','false','true']::jsonb[]),
  ('calls.audio_video',              ARRAY['false','false','false','false','true']::jsonb[]),
  ('groups.post',                    ARRAY['false','false','false','true','true']::jsonb[]),
  ('groups.own_max',                 ARRAY['0','0','0','1','10']::jsonb[]),
  ('profile.premium_sections',       ARRAY['false','false','false','true','true']::jsonb[]),
  ('media.photos_max',               ARRAY['1','3','3','6','20']::jsonb[]),
  ('media.clips_max',                ARRAY['0','1','1','3','10']::jsonb[]),
  ('verification.carrier_check',     ARRAY['false','false','false','false','true']::jsonb[]),
  ('safety.cross_border_briefing',   ARRAY['false','false','false','false','true']::jsonb[])
) AS e(key, vals)
CROSS JOIN (VALUES ('BASIC',1),('PENDING_REVIEW',2),('ACTIVE',3),('CLASSIC',4),('SUPER',5)) AS r(role, ord);
COMMENT ON COLUMN role_entitlements.value IS 'Seeded from CHANGE_BRIEF section 2. (a) DECIDED (18 Nov 2026, OD-03): discovery.specs_per_day BASIC / PENDING_REVIEW 25, ACTIVE 50, CLASSIC / SUPER unlimited (the numbers are tuned in remote_config discovery.daily_cap.*; daily_spec_cap() reads them); (b) DECIDED (19 Nov 2026, OD-18): Spotlight rotates 3 times a week and every eligible Premium and Gold member gets a turn in each rotation (spotlight.turns_per_week 3 / 3), Gold placed first (spotlight.priority; remote_config spotlight.rotations_per_week, spotlight.gold_priority).';

INSERT INTO products (code, kind, plan_code, name_key) VALUES
 ('black_badge','one_off',NULL,'product.black_badge'),
 ('premium_monthly','subscription','premium','product.premium_monthly'),
 ('gold_monthly','subscription','gold','product.gold_monthly');

INSERT INTO prices (product_id, version, provider, provider_product_id, amount_usd_cents, interval, trial_days)
SELECT p.id, 1, pv.provider::payment_provider_t, 'TBD:' || p.code || ':' || pv.provider,
       CASE p.code WHEN 'black_badge' THEN 100 WHEN 'premium_monthly' THEN 250 ELSE 975 END,
       CASE p.kind WHEN 'one_off' THEN 'none'::billing_interval_t ELSE 'month'::billing_interval_t END,
       CASE p.code WHEN 'premium_monthly' THEN 3 ELSE 0 END
FROM products p CROSS JOIN (VALUES ('app_store'),('google_play'),('flutterwave')) AS pv(provider);   -- v3.3 OD-14: web = Flutterwave
COMMENT ON COLUMN prices.provider_product_id IS 'Store SKU / web provider (Flutterwave payment plan) id. Seeded as TBD:<product>:<provider> placeholders. DECIDED (19 Nov 2026, OD-12, updating OD-08): the App Store and Google Play products are live since 1 Jul 2026, so each price version carries its real id (entered by migration or admin A21); TBD:* ("Not set") is used only for a product not yet created, which includes the Flutterwave payment plans until web billing is set up (OD-14). A changed price is a new price version.';

INSERT INTO notification_categories (key, label_key, is_transactional, default_push, default_email, is_marketing, sort) VALUES
 ('likes','ncat.likes',false,true,false,false,1), ('msgs','ncat.msgs',false,true,false,false,2),
 ('groups','ncat.groups',false,false,false,false,3), ('daily','ncat.daily',false,true,false,false,4),
 ('news','ncat.news',false,false,false,true,5), ('account','ncat.account',true,true,true,false,6),
 ('billing','ncat.billing',true,true,true,false,7), ('security','ncat.security',true,true,true,false,8);

INSERT INTO notification_templates (code, category_key, channels, trigger_desc, title_key, body_key, deep_link, email_template, throttle_rule, bypass_quiet_hours) VALUES
 ('N01','likes',   '{push,in_app}','Someone likes you','n01.title','n01.body','D7-Likes',NULL,'batched, max 1 an hour',false),
 ('N02','likes',   '{push,in_app}','One-sided Somewhat','n02.title','n02.body','MF1-Maybe-Match',NULL,'batched, max 1 an hour',false),
 ('N03','likes',   '{push,in_app}','Mutual Like','n03.title','n03.body','D5-Match',NULL,'instant',false),
 ('N04','msgs',    '{push,in_app}','Other person opened the intro','n04.title','n04.body','MF2-Intro-Voice',NULL,'instant',false),
 ('N05','msgs',    '{push,in_app}','Both chose Keep talking','n05.title','n05.body','D9-Chat',NULL,'instant',false),
 ('N06','msgs',    '{push,in_app}','New chat message','n06.title','n06.body','D9-Chat',NULL,'collapsed per chat',false),
 ('N07','msgs',    '{push,in_app}','Direct Spec received','n07.title','n07.body','H7-DM-Requests',NULL,'instant',false),
 ('N08','groups',  '{push,in_app}','Group event reminder (24 h)','n08.title','n08.body','D13-Group-Room',NULL,'1 per event',false),
 ('N09','likes',   '{push,in_app}','Spotlight turn starts','n09.title','n09.body','MF6-Spotlight',NULL,'1 per turn',false),
 ('N10','daily',   '{push}','Basic daily specs reset','n10.title','n10.body','D1-Home',NULL,'max 1 a day, 18:00 local',false),
 ('N11','account', '{email}','Sign-up complete','n11.title','n11.body','D1-Home','welcome','once',false),
 ('N12','account', '{push,email,in_app}','Black Badge approved','n12.title','n12.body','B11-Approved','badge_approved','once',false),
 ('N13','account', '{push,email,in_app}','Review needs a fix','n13.title','n13.body','B4-Main-Photo','needs_fix','once + 24 h reminder',false),
 ('N14','billing', '{email}','Successful payment','n14.title','n14.body','BL2-History','receipt','per payment',false),
 ('N15','billing', '{push,email,in_app}','Renewal failed (day 1, 4, 6)','n15.title','n15.body','BL5-Payment-Failed','renewal_failed','day 1, 4, 6',false),
 ('N16','billing', '{push,email,in_app}','Trial ends in 24 h','n16.title','n16.body','BL7-Trial','trial_ending','once (store rule)',false),
 ('N17','billing', '{push,email,in_app}','Plan lapsed','n17.title','n17.body','BL6-Lapsed','plan_lapsed','once',false),
 ('N18','security','{push,email,in_app}','New device sign-in','n18.title','n18.body','PM6-New-Sign-In','new_sign_in','per new device',true),
 ('N19','security','{email}','Password changed','n19.title','n19.body','PM5-Security','password_changed','per change',true),
 ('N20','account', '{email}','Deletion requested (+ day 7)','n20.title','n20.body','AS5-Keep-Account','deletion_scheduled','day 0 and day 7',false),
 ('N21','security','{push,email,in_app}','Account restricted','n21.title','n21.body','AS1-Restricted','restricted','once',true),
 ('N22','security','{push,in_app}','Report reviewed','n22.title','n22.body','H2-Safety',NULL,'per report class',false);

INSERT INTO help_categories (key, title_key, icon, deep_link, sort) VALUES  -- v3.4 W15 the 8 W32 / H1 topics in spec order
 ('getting_started','help.cat.getting_started','rocket','H1A-Help-Article',1),
 ('verification','help.cat.verification','badge','B0-Get-Badge',2),
 ('matching','help.cat.matching','heart','H1A-Help-Article',3),
 ('chats_groups','help.cat.chats_groups','users','D12-Groups',4),
 ('billing','help.cat.billing','card','BL1-Plan-Billing',5),
 ('safety','help.cat.safety','shield','H2-Safety',6),
 ('privacy','help.cat.privacy','lock','LG6-Privacy-Data',7),
 ('account','help.cat.account','user','H1A-Help-Article',8);

INSERT INTO help_articles (category_id, slug, locale, title, cta_label_key, cta_deep_link, is_popular, status)
SELECT c.id, a.slug, 'en', a.title, a.cta, a.link, true, 'draft'
FROM (VALUES
  ('account','how-do-i-get-verified','How do I get verified?','help.cta.start_verification','B0-Get-Badge'),
  ('billing','cancel-or-change-my-plan','Cancel or change my plan','help.cta.plan_billing','BL1-Plan-Billing'),
  ('matching','why-cant-i-like-or-chat-on-free','Why can''t I like or chat on Free?','help.cta.get_badge','B0-Get-Badge'),   -- v3.4 B37 members never see "Basic"
  ('account','i-didnt-get-my-sign-in-code','I didn''t get my sign-in code',NULL,NULL)
) AS a(cat, slug, title, cta, link)
JOIN help_categories c ON c.key = a.cat;

INSERT INTO remote_config (key, value, value_type, description, is_public, source_ref) VALUES
 ('discovery.daily_cap.basic','25','int','Daily specs for Free unverified (BASIC, PENDING_REVIEW); the next card becomes AS6 (Black Badge upsell). Reset at local midnight',true,'OD-03'),
 ('discovery.daily_cap.verified_free','50','int','Daily specs for Free verified (ACTIVE); the next card becomes AS6 (Premium upsell). Premium / Gold: no limit',true,'OD-03'),
 ('discovery.pass_undo_seconds','6','int','Pass Undo toast window',true,'CHANGE_BRIEF 4'),
 ('discovery.pass_memory_days','30','int','Passed / moved-on specs hidden for',false,'D20'),
 ('discovery.scarcity_threshold','5','int','Show the scarcity card when new verified members who joined in the member''s city this week fall below this number (DECIDED 19 Nov 2026; pending change 5 -> 8)',false,'OD-31 / P-4'),
 ('intro.seconds','60','int','1-Minute Intro length',true,'matching-rules'),
 ('intro.window_hours','24','int','Time to start the 1-Minute Intro after a match or maybe-match (DECIDED 18 Nov 2026)',true,'OD-02'),
 ('intro.voice_max_seconds','20','int','Voice note cap (intro and prompts)',true,'MF2, PM8'),
 ('intro.audio_retention_days','30','int','Delete intro audio after, unless kept',false,'matching-rules'),
 ('presence.auto_away_minutes','10','int','Idle time before Away',true,'dashboard-rules'),
 ('nickname.change_cooldown_days','21','int','Nickname change cooldown',true,'CHANGE_BRIEF 3'),
 ('nickname.hold_days','90','int','Old nicknames held for',false,'profile-rules'),
 ('otp.ttl_minutes','10','int','Code validity',true,'auth-rules'),
 ('otp.resend_seconds','60','int','Resend cooldown',true,'auth-rules'),
 ('otp.max_sends_per_hour','5','int','Code sends per hour',false,'auth-rules'),
 ('login.max_wrong_passwords','5','int','Wrong passwords before X1',false,'auth-rules'),
 ('login.lockout_minutes','15','int','X1 pause length',true,'auth-rules'),
 ('block.undo_seconds','6','int','Block / unblock undo toast (DECIDED 19 Nov 2026: keep 6 s)',true,'OD-31 / T-7'),
 ('block.rematch_hours','48','int','Re-match allowed after unblock',false,'safety-rules'),
 ('deletion.grace_days','14','int','Days before erasure',true,'account-rules'),
 ('export.link_valid_days','7','int','Data export link validity',true,'legal-rules'),
 ('media.delete_undo_seconds','10','int','Photo delete undo',true,'profile-rules'),
 ('media.soft_delete_days','30','int','Soft-deleted media kept for',false,'profile-rules'),
 ('media.clip_max_seconds','30','int','Clip length cap',true,'CHANGE_BRIEF 6'),
 ('lapse.hide_extras_days','90','int','BL6 extras hidden before deletion',true,'billing-rules'),
 ('billing.grace_days','7','int','Payment-failed grace',true,'billing-rules'),
 ('billing.trial_days','3','int','Premium trial length',true,'billing-rules'),
 ('badge.sla_hours','24','int','Badge review SLA',false,'badge-rules'),
 ('badge.liveness_attempts','3','int','Face check tries before manual review',true,'badge-rules'),
 ('gold.carrier_recheck_days','90','int','Carrier re-check interval',false,'gold-rules'),
 ('gold.sim_swap_hold_hours','72','int','Hold after a recent SIM swap',true,'gold-rules'),
 ('gold.briefing_refresh_months','6','int','Safety briefing refresh',false,'gold-rules'),
 ('gold.new_account_abroad_ds_7d','2','int','Direct Specs abroad in first 7 days',false,'gold-rules'),
 ('checkin.response_minutes','15','int','Time to answer a check-in',true,'meetup-rules'),
 ('meetup.invite_expiry_hours','48','int','Date invite expiry',true,'meetup-rules'),
 ('share_link.expiry_hours_after','24','int','Trusted-contact link expiry after the meet-up',false,'legal-rules'),
 ('trusted_contacts.max','3','int','Trusted contacts per member',true,'legal-rules'),
 ('groups.max_members','500','int','Members per group',true,'CHANGE_BRIEF 5'),
 ('direct_spec.note_max','200','int','Direct Spec note length',true,'D11'),
 ('notifications.quiet_start','"23:00"','string','Quiet hours start (local)',true,'notif-rules'),
 ('notifications.quiet_end','"07:00"','string','Quiet hours end (local)',true,'notif-rules'),
 -- v3.1 Appendix C.3 keys (JSON null = not set: decision pending)
 ('billing.refund_approval_threshold_usd_cents','0','int','Admin refunds above this need a second admin''s approval (refund_approval_guard). 0 = every admin refund (DECIDED 18 Nov 2026) until a threshold is decided',false,'OD-05 (was AD-07)'),
 ('badge.qa_sample_percent','null','int','Share of auto-decided badges sampled for QA. Not set (AD-27): QA list shows only job-flagged cases',false,'ADMIN A12, AD-27'),
 ('cases.claim_timeout_minutes','30','int','A claim with no decision is released after this',false,'ADMIN A14, AD-26'),
 ('safety.sanctions_ladder','{"version": 1, "categories": {"minor": {"lookback_days": null, "steps": [{"action": "ban"}]}, "fake": {"lookback_days": null, "steps": []}, "harass": {"lookback_days": null, "steps": []}, "photos": {"lookback_days": null, "steps": []}, "money": {"lookback_days": null, "steps": []}, "offline": {"lookback_days": null, "steps": []}, "contact_details": {"lookback_days": null, "steps": []}, "other": {"lookback_days": null, "steps": []}, "abuse_rule": {"lookback_days": null, "steps": []}, "chargeback": {"lookback_days": null, "steps": []}, "ban_evasion": {"lookback_days": null, "steps": []}}, "step_shape": {"action": "warn | restrict | suspend | ban", "duration_hours": "int,  optional", "scope": "restriction scopes,  optional"}, "reason_codes": "decision_reasons (domain sanction)"}','json','Sanctions ladder: per-category look-back and steps set by the T&S lead (AD-29); minor always ban. v3.4 A20: per-category lookback_days, contact_details category, duration in hours; reason codes live in decision_reasons. Edits approved under sanctions.manage (permission_key)',false,'ADMIN A16, AD-29, v3.4 A20'),
 ('discovery.default_distance_km','25','int','Default discovery distance (mirrors the partner_preferences column default)',true,'ADMIN A24'),
 ('privacy.sla_days.access','30','int','Privacy request due-date days for kind access. PROVISIONAL 30 days (NDPA default) until counsel confirms (AD-18, v3.4 B45)',false,'ADMIN A36, AD-18'),
 ('privacy.sla_days.export','30','int','Privacy request due-date days for kind export. PROVISIONAL 30 days (NDPA default) until counsel confirms (AD-18, v3.4 B45)',false,'ADMIN A36, AD-18'),
 ('privacy.sla_days.rectify','30','int','Privacy request due-date days for kind rectify. PROVISIONAL 30 days (NDPA default) until counsel confirms (AD-18, v3.4 B45)',false,'ADMIN A36, AD-18'),
 ('privacy.sla_days.erase_account','30','int','Privacy request due-date days for kind erase_account. PROVISIONAL 30 days (NDPA default) until counsel confirms (AD-18, v3.4 B45)',false,'ADMIN A36, AD-18'),
 ('privacy.sla_days.erase_sensitive','30','int','Privacy request due-date days for kind erase_sensitive. Sensitive-field erasure within 30 days',false,'ADMIN A36, AD-18'),
 ('privacy.sla_days.object','30','int','Privacy request due-date days for kind object. PROVISIONAL 30 days (NDPA default) until counsel confirms (AD-18, v3.4 B45)',false,'ADMIN A36, AD-18'),
 ('privacy.sla_days.restrict_processing','30','int','Privacy request due-date days for kind restrict_processing. PROVISIONAL 30 days (NDPA default) until counsel confirms (AD-18, v3.4 B45)',false,'ADMIN A36, AD-18'),
 ('security.detect.credential_stuffing','null','json','Detection thresholds for credential_stuffing (window, threshold). None set (AD-41): rule off until configured',false,'ADMIN A32, AD-41'),
 ('security.detect.password_spraying','null','json','Detection thresholds for password_spraying (window, threshold). None set (AD-41): rule off until configured',false,'ADMIN A32, AD-41'),
 ('security.detect.otp_abuse','null','json','Detection thresholds for otp_abuse (window, threshold). None set (AD-41): rule off until configured',false,'ADMIN A32, AD-41'),
 ('security.detect.signup_farming','null','json','Detection thresholds for signup_farming (window, threshold). None set (AD-41): rule off until configured',false,'ADMIN A32, AD-41'),
 ('security.detect.scraping','null','json','Detection thresholds for scraping (window, threshold). None set (AD-41): rule off until configured',false,'ADMIN A32, AD-41'),
 ('security.detect.webhook_forgery','null','json','Detection thresholds for webhook_forgery (window, threshold). None set (AD-41): rule off until configured',false,'ADMIN A32, AD-41'),
 ('security.detect.error_spike','null','json','Detection thresholds for error_spike (window, threshold). None set (AD-41): rule off until configured',false,'ADMIN A32, AD-41'),
 ('security.detect.admin_attack','null','json','Detection thresholds for admin_attack (window, threshold). None set (AD-41): rule off until configured',false,'ADMIN A32, AD-41'),
 ('notifications.broadcast_max_per_day','1','int','Broadcasts a member can receive per day',false,'ADMIN A26, AD-38'),
 ('admin.invite_valid_hours','72','int','Admin invite link validity',false,'ADMIN A08, AD-01'),
 ('admin.password_min_length','12','int','Minimum admin password length (admins also need MFA)',false,'OD-07, ADMIN A02'),
 ('auth.password_min_length','8','int','Minimum member password length (strength meter may recommend longer)',true,'OD-07'),
 ('markets.beta_requires_invite','true','bool','Cities with market_status beta (Nigeria outside Lagos) need an invite to sign up',true,'OD-09'),
 -- v3.3 owner decisions of 19-20 Nov 2026
 ('spotlight.rotations_per_week','3','int','Spotlight rotations a week (e.g. Mon, Wed, Fri); every eligible Premium and Gold member gets a turn in each rotation',true,'OD-18'),
 ('spotlight.gold_priority','true','bool','Gold members are placed first in each Spotlight rotation',true,'OD-18'),
 ('chat.gold_new_conversations_daily_soft_cap','100','int','Gold fair use: new conversations a day before a gentle message; never blocks existing chats',false,'OD-31 / P-1'),
 ('appeals.sla_hours','48','int','An appeal is decided within this many hours of submission',false,'OD-28');

INSERT INTO feature_flags (key, description, enabled, is_kill_switch) VALUES
 ('calls.enabled','MF4 audio/video calls (Gold). Off until after public launch; daily.co (OD-20)',false,true),
 ('locale.fr','French UI (needs native review)',false,false),
 ('locale.pcm','Naija UI (needs native review)',true,false),
 ('groups.enabled','Groups tab and creation',true,true),
 ('spotlight.enabled','MF6 Spotlight rotation',true,true),
 ('discovery.international','International tab (Gold)',true,true),
 ('payments.flutterwave_web','Flutterwave checkout on the web app (billing only, OD-14 / OD-15)',true,true),
 ('payments.flutterwave_link_out','In-app link-out to the Flutterwave web checkout where stores allow',false,false),
 ('registration.open','Accept new sign-ups',true,true),
 ('offers.enabled','Offers module (A22 / W24). OFF at launch: no launch offer (OD-01); reserved for later',false,true),
 ('verification.carrier_check','GD1 live phone (carrier) check. Deferred until after launch and hidden (OD-06)',false,true);

INSERT INTO rate_limit_policies (key, scope, max_requests, window_seconds, lockout_seconds, applies_to, description) VALUES
 ('otp.send','phone',5,3600,NULL,'POST /v1/auth/*/start, /v1/verification/phone/start','5 sends an hour; 60 s between sends enforced separately'),
 ('otp.verify.sms','phone',3,600,1800,'POST /v1/verification/phone/confirm, /v1/auth/device/verify','3 wrong SMS codes then 30-minute lock'),
 ('otp.verify.email','email',5,600,900,'POST /v1/auth/email/verify, /v1/auth/password/reset/verify','5 wrong email codes then 15-minute wait'),
 ('login.account','account',5,900,900,'POST /v1/auth/password/login','5 wrong passwords then X1 15-minute pause'),
 ('login.ip','ip',50,900,NULL,'POST /v1/auth/password/login','Per IP'),
 ('signup.device','device',5,86400,NULL,'POST /v1/auth/email/start','Sign-ups per device per day'),
 ('signup.ip','ip',20,3600,NULL,'POST /v1/auth/email/start','Sign-ups per IP per hour'),
 ('reactions.user','account',120,60,NULL,'POST /v1/reactions','Reactions per minute'),
 ('messages.user','account',30,60,NULL,'POST /v1/conversations/*/messages, WS message.send','Messages per minute'),
 ('messages.daily','account',1000,86400,NULL,'POST /v1/conversations/*/messages','Messages per day'),
 ('media.upload','account',30,3600,NULL,'POST /v1/media/upload-url','Upload URLs per hour'),
 ('reports.user','account',20,86400,NULL,'POST /v1/reports','Reports per day'),
 ('export.user','account',1,86400,NULL,'POST /v1/me/export','Data exports per day'),
 ('public.forms','ip',10,3600,NULL,'POST /public/v1/*','Website forms per IP per hour (plus bot check)'),
 ('admin.login','account_ip',10,900,1800,'POST /admin/v1/auth/*','Admin sign-in attempts');

-- Admin permissions, system roles and grants.
INSERT INTO admin_permissions (key, domain, description, is_sensitive, requires_reason, requires_approval, requires_reauth) VALUES
 ('users.read','members','View member accounts (PII masked)',false,false,false,false),
 ('users.pii.read','members','Reveal email, phone, DOB (logged)',true,true,false,true),
 ('users.update','members','Edit member account fields',false,true,false,false),
 ('users.restrict','members','Restrict or lift a restriction',true,true,false,false),
 ('users.suspend','members','Suspend or unsuspend',true,true,false,true),
 ('users.ban','members','Ban or unban',true,true,true,true),
 ('users.erase','members','Run account erasure now',true,true,true,true),
 ('sessions.revoke','members','Sign a member out everywhere',false,true,false,false),
 ('badges.review','verification','Approve / needs fix / not approved',false,true,false,false),
 ('media.moderate','verification','Approve, hide or reject media',false,true,false,false),
 ('cases.read','safety','View moderation queues',false,false,false,false),
 ('cases.claim','safety','Claim and decide cases',false,true,false,false),
 ('reports.read','safety','View reports',false,false,false,false),
 ('reports.action','safety','Resolve reports',false,true,false,false),
 ('conversations.read_reported','safety','Read evidence attached to a report only',true,true,false,true),
 ('appeals.decide','safety','Decide appeals',true,true,false,false),
 ('safety.escalations','safety','Handle safety escalations and check-ins',true,true,false,false),
 ('abuse_rules.manage','safety','Edit keyword and abuse rules',true,true,true,false),
 ('groups.moderate','safety','Approve, pause or remove groups',false,true,false,false),
 ('billing.read','billing','View subscriptions and payments',false,false,false,false),
 ('billing.refund','billing','Issue refunds',true,true,false,true),
 ('billing.refund_large','billing','Refunds above the finance threshold (threshold 0: every admin refund needs approval, OD-05)',true,true,true,true),
 ('billing.disputes','billing','Respond to disputes',true,true,false,false),
 ('billing.webhooks_replay','billing','Replay failed webhooks',false,true,false,false),
 ('plans.manage','billing','Edit prices and the entitlement matrix',true,true,true,true),
 ('entitlements.grant','billing','Comp a plan or credit days',true,true,false,false),
 ('notifications.templates','comms','Edit notification templates',false,true,false,false),
 ('notifications.broadcast','comms','Send a broadcast push or email',true,true,true,false),
 ('support.tickets','support','Work support tickets and chat',false,false,false,false),
 ('help.manage','support','Edit help centre articles',false,true,false,false),
 ('content.manage','content','Website CMS, stories, careers, press, investors',false,true,false,false),
 ('legal.publish','content','Publish Terms, Privacy, Guidelines versions',true,true,true,true),
 ('i18n.manage','content','Edit and review translations',false,true,false,false),
 ('research.manage','research','Usability studies, sessions and exports',false,true,false,false),
 ('analytics.read','analytics','View dashboards',false,false,false,false),
 ('analytics.export','analytics','Export aggregated data',true,true,false,false),
 ('privacy.requests','privacy','Handle data-subject requests',true,true,false,true),
 ('config.flags','platform','Feature flags and kill switches (approval in production except kill switch off, AD-05)',true,true,true,true),
 ('config.remote','platform','Remote config values (approval in production, AD-05)',true,true,true,true),
 ('config.app_versions','platform','Forced / recommended update versions',true,true,false,true),
 ('config.maintenance','platform','Maintenance and offline mode',true,true,true,true),
 ('security.rate_limits','platform','Rate-limit policies',true,true,true,true),
 ('security.ip_lists','platform','IP allow / deny lists',true,true,true,true),
 ('network.read','platform','Network and vendor dashboards',false,false,false,false),
 ('admins.manage','access','Invite, suspend admins and reset MFA',true,true,true,true),
 ('roles.manage','access','Create roles and assign permissions',true,true,true,true),
 ('approvals.decide','access','Approve or reject sensitive requests',true,true,false,true),
 ('audit.read','access','Read the audit log',false,false,false,false),
 ('audit.export','access','Export the audit log for regulators',true,true,false,true),
 -- v3.1 the 37 permissions proposed in ADMIN_UI_MODULES_FLOWS Appendix A (now seeded; 86 in total)
 ('admins.read','access','View admin accounts',false,false,false,false),
 ('admins.sessions.revoke','access','Revoke another admin''s sessions',true,true,false,true),
 ('roles.read','access','View roles, permission catalogue and matrix',false,false,false,false),
 ('approvals.read','access','View all approval requests',false,false,false,false),
 ('security.break_glass','access','Use the break-glass account',true,true,true,true),
 ('users.export','members','Export member-level data (AD-06)',true,true,true,true),
 ('users.reverify','members','Ask a member to re-verify (AD-13)',false,true,false,false),
 ('users.merge','members','Merge duplicate accounts (AD-12)',true,true,true,true),
 ('cases.assign','safety','Assign cases to reviewers',false,true,false,false),
 ('sanctions.manage','safety','Edit the sanctions ladder and reason codes',true,true,true,false),
 ('macros.manage','safety','Edit safety and support macros',false,true,false,false),
 ('venues.manage','safety','Create and edit venues',false,true,false,false),
 ('billing.export','billing','Export member-level billing data (AD-06)',true,true,true,true),
 ('offers.read','billing','View offers, pools and claims',false,false,false,false),
 ('offers.manage','billing','Create and edit offer drafts, void codes',false,true,false,false),
 ('offers.publish','billing','Take an offer live, pause or end it',true,true,true,false),
 ('offers.codes.import','billing','Import store code pools',true,true,false,true),
 ('spotlight.manage','comms','Manage Spotlight scheduling',false,true,false,false),
 ('catalogues.manage','comms','Edit prompts, vibes, effects, options, industries, languages',false,true,false,false),
 ('notifications.read','comms','View delivery logs',false,false,false,false),
 ('announcements.manage','comms','In-app announcements (approval for an all-member audience, enforced in the API)',false,true,false,false),
 ('content.review','content','Approve CMS content',false,true,false,false),
 ('content.review_legal','content','Legal review: legal, offer, investor and price pages',false,true,false,false),
 ('content.review_safety','content','T&S review: safety pages, safety articles, emergency numbers',false,true,false,false),
 ('content.publish','content','Publish, schedule and unpublish CMS content',false,true,false,false),
 ('site_settings.manage','content','Site settings and redirects (approval for maintenance and emergency numbers, enforced in the database)',false,true,false,false),
 ('applications.read','content','Read job applications and open CVs',true,true,false,false),
 ('newsletter.export','content','Export newsletter / waitlist lists (AD-06)',true,true,true,false),
 ('config.markets','platform','Countries, cities, languages, market status',true,true,true,false),
 ('config.vendors','platform','Vendor settings and secret rotation',true,true,true,true),
 ('jobs.read','platform','View background jobs and queues',false,false,false,false),
 ('jobs.run','platform','Retry a run or run a safe job now',true,true,false,false),
 ('security.incidents','platform','Create and update security incidents',true,true,false,false),
 ('network.respond','platform','Propose network responses',false,true,false,false),
 ('analytics.reports.manage','analytics','Saved analytics reports',false,false,false,false),
 ('analytics.schedules.manage','analytics','Scheduled analytics exports',false,true,false,false),
 ('privacy.legal_holds','privacy','Place and release legal holds',true,true,true,false);

INSERT INTO admin_roles (key, name, description, is_system, max_holders) VALUES
 ('super_admin','Super admin','Everything, including admins, roles and config. Max 2 people.',true,2),
 ('admin','Admin','Runs the platform day to day; cannot manage admins, roles or config.',true,NULL),
 ('trust_safety_lead','Trust & Safety lead','Reports, restrictions, bans, escalations, appeals, reported evidence.',true,NULL),
 ('reviewer','Badge and media reviewer','Badge queue and media moderation; PII masked.',true,NULL),
 ('support','Support agent','Tickets, support chat, member lookups, billing status.',true,NULL),
 ('finance','Finance','Billing, refunds, disputes, prices and revenue.',true,NULL),
 ('content_editor','Content editor','Website CMS, help centre, translations.',true,NULL),
 ('analyst','Analyst','Read-only dashboards and aggregated exports.',true,NULL),
 ('researcher','UX researcher','Usability studies and research exports.',true,NULL),
 ('privacy_officer','Data Protection Officer','Data-subject requests, consent audits, audit export.',true,NULL);

INSERT INTO admin_role_permissions (role_id, permission_key)
SELECT r.id, p.key FROM admin_roles r CROSS JOIN admin_permissions p WHERE r.key = 'super_admin';

INSERT INTO admin_role_permissions (role_id, permission_key)
SELECT r.id, x.perm
FROM (VALUES
 ('admin', ARRAY['users.read','users.update','users.restrict','users.suspend','sessions.revoke','badges.review','media.moderate','cases.read','cases.claim','reports.read','reports.action','groups.moderate','billing.read','billing.webhooks_replay','support.tickets','help.manage','content.manage','notifications.templates','analytics.read','network.read','audit.read','approvals.decide',
   -- v3.1 Appendix A
   'admins.read','roles.read','approvals.read','users.reverify','cases.assign','macros.manage','venues.manage','offers.read','spotlight.manage','catalogues.manage','notifications.read','announcements.manage','content.review','content.publish','site_settings.manage','applications.read','jobs.read','security.incidents','network.respond','analytics.reports.manage']),
 ('trust_safety_lead', ARRAY['users.read','users.pii.read','users.restrict','users.suspend','users.ban','sessions.revoke','badges.review','media.moderate','cases.read','cases.claim','reports.read','reports.action','conversations.read_reported','appeals.decide','safety.escalations','abuse_rules.manage','groups.moderate','audit.read','approvals.decide',
   -- v3.1 Appendix A
   'users.reverify','users.merge','cases.assign','sanctions.manage','macros.manage','content.review_safety','security.incidents','privacy.legal_holds']),
 ('reviewer', ARRAY['users.read','badges.review','media.moderate','cases.read','cases.claim','reports.read']),
 ('support', ARRAY['users.read','users.update','sessions.revoke','reports.read','billing.read','support.tickets','help.manage',
   -- v3.1 Appendix A
   'notifications.read']),
 ('finance', ARRAY['billing.read','billing.refund','billing.refund_large','billing.disputes','billing.webhooks_replay','plans.manage','entitlements.grant','analytics.read','approvals.decide',
   -- v3.1 Appendix A
   'billing.export','offers.read','offers.manage','offers.publish','offers.codes.import','analytics.reports.manage']),
 ('content_editor', ARRAY['content.manage','help.manage','i18n.manage','notifications.templates',
   -- v3.1 Appendix A
   'offers.read','offers.manage','catalogues.manage','announcements.manage','content.review','content.publish']),
 ('analyst', ARRAY['analytics.read','analytics.export','network.read',
   -- v3.1 Appendix A
   'analytics.reports.manage','analytics.schedules.manage']),
 ('researcher', ARRAY['research.manage','analytics.read',
   -- v3.1 Appendix A
   'analytics.reports.manage']),
 ('privacy_officer', ARRAY['users.read','users.pii.read','privacy.requests','audit.read','audit.export','analytics.read',
   -- v3.1 Appendix A
   'roles.read','approvals.read','users.export','content.review_legal','security.incidents','privacy.legal_holds'])
) AS g(role_key, perms)
JOIN admin_roles r ON r.key = g.role_key
CROSS JOIN LATERAL unnest(g.perms) AS x(perm);

-- v3.1 Worker job catalogue (A31 Jobs page; runtime state is in pg-boss).
INSERT INTO worker_jobs (name, schedule, description, module, run_now_allowed, is_destructive, source_ref) VALUES
 ('media.process','on upload complete','Re-encode, strip EXIF, renditions, face match, moderation, colour-filter check','A13',false,false,'TR §11'),
 ('media.transcribe','on voice upload','Transcribe prompts and intro notes for moderation','A13',false,false,'TR §11'),
 ('badge.autodecide','on submit','Risk rules + vendor scores; auto-approve or route to a human','A12',false,false,'TR §11'),
 ('badge.reminders','every 15 min','Review and needs-fix reminders (N13)','A12',false,false,'TR §11'),
 ('badge.refund','on not_approved','Automatic Black Badge refund: Play / Flutterwave issued by us; iOS member guided to Apple (OD-04)','A20',false,false,'TR §11'),
 ('liveness.purge','daily','Delete liveness videos after review (max 30 days)','A36',false,true,'TR §11'),
 ('intro.expire','every 5 min','Expire intro sessions; close live sessions after 60 s','A24',false,false,'TR §11'),
 ('intro.audio.purge','daily','Delete intro audio after 30 days unless kept','A36',false,true,'TR §11'),
 ('cooldowns.purge','daily','Remove expired pair cooldowns','A24',false,true,'TR §11'),
 ('feed.refill','on low deck','Rebuild feed candidates','A24',false,false,'TR §11'),
 ('quota.reset','hourly','Free daily cap reset push N10 (BASIC 25, ACTIVE 50)','A24',false,false,'TR §11'),
 ('spotlight.schedule','weekly','Plan Spotlight turns','A24',false,false,'TR §11'),
 ('spotlight.start','on slot','Start a Spotlight turn','A24',false,false,'TR §11'),
 ('dm.expire','hourly','Expire pending DM requests','A24',false,false,'TR §11'),
 ('meetup.reminders','every 15 min','Group event reminders; date invite expiry','A18',false,false,'TR §11'),
 ('checkin.due','every minute','EV5 push at the planned end','A15',false,false,'TR §11'),
 ('checkin.escalate','every minute','Alert trusted contacts and T&S after 15 min','A15',false,false,'TR §11'),
 ('share_links.expire','hourly','Expire LG5 links 24 h after the meet-up','A15',false,false,'TR §11'),
 ('safety.location.purge','daily','Delete check-in locations after 30 days','A36',false,true,'TR §11'),
 ('notifications.deliver','continuous','Outbox delivery with throttles and quiet hours','A26',false,false,'TR §11'),
 ('billing.sync','on webhook','Normalise provider events, write grants, refresh roles','A19',false,false,'TR §11'),
 ('billing.grace','hourly','Grace reminders and lapse','A19',false,false,'TR §11'),
 ('billing.trial_reminder','hourly','N16 24 h before the trial charge','A19',false,false,'TR §11'),
 ('lapse.purge','daily','Delete media hidden more than 90 days after a lapse','A36',false,true,'TR §11'),
 ('entitlements.reconcile','hourly','Check v_role_drift and re-fetch provider state','A19',true,false,'TR §11'),
 ('restrictions.expire','every 15 min','Lift ended suspensions; credit paid days','A11',false,false,'TR §11'),
 ('carrier.recheck','daily','Gold carrier re-check every 90 days','A12',false,false,'TR §11'),
 ('briefing.refresh','daily','Ask Gold members to refresh GD3 after 6 months','A12',false,false,'TR §11'),
 ('deletion.remind','daily','Day-7 deletion reminder (N20)','A36',false,false,'TR §11'),
 ('erasure.run','daily','Day-14 erasure (skips members under legal hold)','A36',false,true,'TR §11'),
 ('sensitive.erase','daily','Erase genotype / faith answers within 30 days of withdrawal','A36',false,true,'TR §11'),
 ('export.build','on request','Build a member data export ZIP','A36',false,false,'TR §11'),
 ('exports.purge','daily','Delete expired member exports','A36',false,true,'TR §11'),
 ('partitions.ensure','monthly','Create the next 3 monthly partitions','A31',true,false,'TR §11'),
 ('partitions.retain','monthly','Detach and archive partitions past retention','A31',false,true,'TR §11'),
 ('stats.refresh','5-60 min','Refresh materialized views concurrently','A33',true,false,'TR §11'),
 ('audit.verify_chain','nightly','Verify the audit-log hash chain','A07',false,false,'TR §11'),
 ('webhooks.retry','every minute','Retry failed inbound processing with backoff','A19',true,false,'TR §11'),
 ('vendor.health','every minute','Probe vendors; OTP failover','A31',true,false,'TR §11'),
 ('retention.purge','daily','Apply retention to logs, impressions, notifications, OTPs, tokens, consent receipts','A36',false,true,'TR §11'),
 ('billing.reconcile','daily','Write a reconciliation_runs row per provider','A19',true,false,'Appendix C.3'),
 ('security.detect','every minute','Evaluate security.detect.* rules into security_detections','A32',false,false,'Appendix C.3'),
 ('approvals.expire','every 15 min','Expire pending approvals past expires_at','A06',true,false,'Appendix C.3'),
 ('exports.admin.build','on request','Build admin_exports files','A07',false,false,'Appendix C.3'),
 ('exports.admin.purge','daily','Delete expired admin export files','A07',false,true,'Appendix C.3'),
 ('offers.end','every minute','End offers at ends_at (offer_end_expired)','A22',true,false,'Appendix C.3'),
 ('holds.review','daily','Notify owners of legal holds due for review','A36',false,false,'Appendix C.3'),
 ('content.schedule','every minute','Publish / unpublish scheduled CMS content (content_run_schedule)','A28',true,false,'v3.1'),
 ('media.expiry','daily','Unpublish blocks using media whose licence or consent expired','A29',false,false,'v3.1'),
 ('ip_rollups.purge','daily','Delete api_request_ip_rollups buckets older than 30 days','A32',false,true,'v3.1'),
 ('offers.purge_identifiers','daily','Delete plain claim identifiers 30 days after an offer ends (DN-24)','A22',false,true,'v3.1'),
 ('waitlist.purge','daily','Delete unconfirmed waitlist entries after 7 days','A29',false,true,'v3.1'),
 ('offers.pool_watch','every 5 min','Low-water alert from v_offer_pool_stock','A22',true,false,'v3.1'),
 ('exports.scheduled','every 15 min','Run due scheduled_exports','A34',false,false,'v3.1');

-- v3.1 Site settings keys (values are filled in the CMS; maintenance off).
INSERT INTO site_settings (key, value) VALUES
 ('navigation','{"header": [], "footer": []}'),
 ('socials','[]'),
 ('app','{"ios": {"status": "live", "app_store_id": null, "url": null, "provider_token": null}, "android": {"status": "live", "package_name": null, "url": null}, "countries_available": ["NG"], "min_os": {"ios": "15", "android": "9"}, "cta_label": {"en": "Get the app"}, "badge_assets": {}, "qr_target": null}'),   -- v3.4 W19 W07 per-store status, NG only (OD-09)
 ('markets_default_order','[]'),
 ('banner','{"enabled": false}'),
 ('maintenance','{"enabled": false, "message": null, "until": null, "status_url": null, "exempt_forms": ["safety_report"]}'),   -- v3.4 W12 decision: the safety report form stays open during maintenance (boards W33 / W34 / W38 / W39 / W01, the safer rule)
 ('offline_message','{"en": "You are offline. Check your connection and try again."}'),
 ('consent','{"policy_version": null, "cookie_lifetime_days": 180, "categories": [{"key": "necessary", "locked": true, "storage": [{"name": "mm_consent", "lifetime": "6 months"}, {"name": "mm_locale", "lifetime": "12 months"}, {"name": "mm-theme", "type": "local_storage"}]}, {"key": "analytics", "locked": false, "vendors": [{"name": "PostHog Cloud", "retention": "1 year"}]}, {"key": "marketing", "locked": false, "vendors": []}]}'),   -- v3.4 W38 W03 / W35 cookie table
 ('locales','["en","pcm","fr"]'),
 ('company_facts','[]'),
 ('support_reply_times','{"en": "We reply in about 2 hours"}'),   -- v3.4 B60 AD-39
 ('emergency_numbers','[{"country": "NG", "number": "112", "verified_by": null, "verified_at": null}]'),   -- v3.2 OD-09 Nigeria only
 ('feature_flags','{"calls_announced": false, "interest_tiles": false, "circle": false, "stories": false, "press": false, "offer": false}'),
 ('analytics','{"vendor": "posthog", "site_id": null}'),   -- v3.2 OD-06 PostHog Cloud free tier
 ('contacts','{"help": "help@1minitman.com", "press": "press@1minitman.com", "careers": "careers@1minitman.com", "investors": "investors@1minitman.com", "privacy": "privacy@1minitman.com", "security": "security@1minitman.com"}');   -- v3.4 B60 OD-23 (privacy@ mailbox, other aliases)

-- v3.1 Vendor cards (no secrets: references are set when the vendor is configured).
INSERT INTO vendor_settings (vendor) VALUES
 ('termii'),('twilio'),('whatsapp'),('expo_push'),('flutterwave'),('revenuecat'),('daily'),('google_places');   -- v3.3 OD-14: flutterwave replaces stripe
-- v3.2 OD-06 lean vendors: upgrade each only when usage outgrows the free / pay-as-you-go tier.
-- No attribution vendor: UTM links + our own /get deep-link redirect + store consoles.
INSERT INTO vendor_settings (vendor, settings) VALUES
 ('liveness',   '{"provider": "aws_rekognition_face_liveness", "pricing": "pay_per_check"}'),
 ('resend',     '{"plan": "free"}'),
 ('posthog',    '{"plan": "cloud_free"}'),
 ('cloudflare', '{"plan": "free", "services": ["pages", "cdn", "waf", "dns"]}'),
 ('carrier',    '{"enabled": false, "status": "deferred_post_launch"}');

-- Usability study Lagos round 1 (research/Lagos_Usability_Test_Pack_R1.md)
WITH s AS (
  INSERT INTO research_studies (code, name, city_id, target_sus, target_trust, target_task_success, status)
  SELECT 'LAGOS-R1', 'Lagos usability test, round 1', c.id, 80, 8, 0.90, 'planned' FROM cities c WHERE c.ascii_name = 'lagos'
  RETURNING id)
INSERT INTO research_tasks (study_id, task_no, title, start_screen, end_screen, success_criteria)
SELECT s.id, t.no, t.title, t.a, t.b, t.crit FROM s CROSS JOIN (VALUES
 (1,'Sign up and get verified','E1','B11','Reaches B11 without help'),
 (2,'Find someone who wants what you want and like them','D1','D1','Likes a spec with a matching intention'),
 (3,'You matched: start your minute','D5','D6','Opens the 1-Minute Intro from D5'),
 (4,'Plan a safe first date from the chat','D9','EV1','Opens EV1 from the safe-date bar and reaches review'),
 (5,'Pick the plan you would pay for','D15','D15','Selects a plan and explains why'),
 (6,'Undo a pass; unmatch someone','D1','D10','Uses Undo within 6 s and completes the unmatch confirm')
) AS t(no, title, a, b, crit);

-- ---------------------------------------------------------------------
-- v3.4 design-review seeds (21 Nov 2026). Idempotent: the same statements
-- run in schema.sql and in migration 0005.
-- ---------------------------------------------------------------------

-- M21 P1 34 spoken languages (14 seeded in v3).
INSERT INTO languages (code, name_key, native_name, aliases, is_app_locale, popularity) VALUES
 ('ar','lang.ar','العربية','{Arabic}',false,20), ('ee','lang.ee','Eʋegbe','{Ewe}',false,20), ('ff','lang.ff','Fulfulde','{Fula,Fulani}',false,25),
 ('kr','lang.kr','Kanuri','{}',false,20), ('nup','lang.nup','Nupe','{}',false,20), ('zu','lang.zu','isiZulu','{Zulu}',false,15),
 ('am','lang.am','አማርኛ','{Amharic}',false,15), ('wo','lang.wo','Wolof','{}',false,15), ('pt','lang.pt','Português','{Portuguese}',false,20),
 ('es','lang.es','Español','{Spanish}',false,20), ('de','lang.de','Deutsch','{German}',false,15), ('it','lang.it','Italiano','{Italian}',false,15),
 ('zh','lang.zh','中文','{Mandarin,Chinese}',false,15), ('hi','lang.hi','हिन्दी','{Hindi}',false,15), ('nl','lang.nl','Nederlands','{Dutch}',false,10),
 ('ru','lang.ru','Русский','{Russian}',false,10), ('tr','lang.tr','Türkçe','{Turkish}',false,10), ('ja','lang.ja','日本語','{Japanese}',false,10),
 ('ko','lang.ko','한국어','{Korean}',false,10), ('asl','lang.asl','Sign language','{ASL,"Sign language"}',false,10)
ON CONFLICT (code) DO NOTHING;

-- M15 / M16 / M17 option sets: children split (B6), love language and keeping in touch (P3), languages pseudo set (P3 deal-breaker).
INSERT INTO option_sets (key, label_key, question_key, pii_class, needs_consent, multi_select, max_select, in_profile, in_preferences, can_be_dealbreaker, premium_only, show_on_profile, sort) VALUES
 ('kids_have','opt.kids_have','q.kids_have','personal',NULL,false,NULL,true,true,true,false,true,14),
 ('kids_want','opt.kids_want','q.kids_want','personal',NULL,false,NULL,true,true,true,false,true,15),
 ('love_language','opt.love_language','q.love_language','personal',NULL,true,NULL,true,true,false,true,true,16),
 ('comms_style','opt.comms_style','q.comms_style','personal',NULL,true,NULL,true,true,false,true,true,17),
 ('languages','opt.languages','q.languages','personal',NULL,true,NULL,false,true,true,true,false,18)
ON CONFLICT (key) DO NOTHING;
INSERT INTO options (set_key, key, label_key, sort, is_prefer_not_to_say)
SELECT s, k, 'opt.' || s || '.' || k, ord, k = 'prefer_not'
FROM (VALUES
 ('kids_have', ARRAY['no','yes','prefer_not']),
 ('kids_want', ARRAY['want','dont_want','not_sure','prefer_not']),
 ('love_language', ARRAY['words','quality_time','gifts','acts_of_service','touch']),
 ('comms_style', ARRAY['big_texter','phone_caller','video_chatter','in_person','voice_notes'])
) AS v(s, arr)
CROSS JOIN LATERAL unnest(arr) WITH ORDINALITY AS u(k, ord)
ON CONFLICT (set_key, key) DO NOTHING;
COMMENT ON COLUMN option_sets.key IS 'v3.4 M15: B6 asks kids_have and kids_want separately; kids stays for P3 "what works for you". M17: languages is a pseudo set with no options (values in languages / partner_preference_languages) so the P3 deal-breaker switch can use partner_preference_sections.';

-- M47 dial-code countries (phone picker B1 / P1-Phone / LG4; GD2 list). Not launch markets, not international.
INSERT INTO countries (iso2, name_key, dial_code, emergency_number, is_launch_market, allows_international, default_locale, timezone_default) VALUES
 ('ZA','country.za','+27',NULL,false,false,'en','Africa/Johannesburg'), ('FR','country.fr','+33',NULL,false,false,'fr','Europe/Paris'),
 ('CA','country.ca','+1',NULL,false,false,'en','America/Toronto'),     ('AE','country.ae','+971',NULL,false,false,'en','Asia/Dubai'),
 ('DE','country.de','+49',NULL,false,false,'en','Europe/Berlin'),      ('IE','country.ie','+353',NULL,false,false,'en','Europe/Dublin'),
 ('IT','country.it','+39',NULL,false,false,'en','Europe/Rome'),        ('NL','country.nl','+31',NULL,false,false,'en','Europe/Amsterdam'),
 ('BE','country.be','+32',NULL,false,false,'fr','Europe/Brussels'),    ('ES','country.es','+34',NULL,false,false,'en','Europe/Madrid'),
 ('PT','country.pt','+351',NULL,false,false,'en','Europe/Lisbon'),     ('SE','country.se','+46',NULL,false,false,'en','Europe/Stockholm'),
 ('CM','country.cm','+237',NULL,false,false,'fr','Africa/Douala')
ON CONFLICT (iso2) DO NOTHING;
UPDATE countries SET default_market_status = CASE iso2 WHEN 'NG' THEN 'beta' ELSE 'waitlist' END WHERE default_market_status IS NULL;   -- W18 OD-09

-- M23 / W17 / B61 cities: Nigerian beta cities (OD-09), Lagos areas for C6 search, London (diaspora) waitlist.
INSERT INTO cities (country, name, ascii_name, admin_area, centroid, timezone, is_popular, market_status, display_order) VALUES
 ('NG','Port Harcourt','port harcourt','Rivers', ST_SetSRID(ST_MakePoint(7.0134, 4.8156),4326)::geography,'Africa/Lagos',true,'beta',3),
 ('NG','Ibadan','ibadan','Oyo',                  ST_SetSRID(ST_MakePoint(3.9470, 7.3775),4326)::geography,'Africa/Lagos',true,'beta',4),
 ('NG','Kano','kano','Kano',                     ST_SetSRID(ST_MakePoint(8.5167,12.0000),4326)::geography,'Africa/Lagos',false,'beta',NULL),
 ('NG','Enugu','enugu','Enugu',                  ST_SetSRID(ST_MakePoint(7.4951, 6.4584),4326)::geography,'Africa/Lagos',false,'beta',NULL),
 ('NG','Benin City','benin city','Edo',          ST_SetSRID(ST_MakePoint(5.6037, 6.3350),4326)::geography,'Africa/Lagos',false,'beta',NULL),
 ('NG','Kaduna','kaduna','Kaduna',               ST_SetSRID(ST_MakePoint(7.4383,10.5222),4326)::geography,'Africa/Lagos',false,'beta',NULL),
 ('NG','Jos','jos','Plateau',                    ST_SetSRID(ST_MakePoint(8.8921, 9.8965),4326)::geography,'Africa/Lagos',false,'beta',NULL),
 ('NG','Calabar','calabar','Cross River',        ST_SetSRID(ST_MakePoint(8.3417, 4.9757),4326)::geography,'Africa/Lagos',false,'beta',NULL),
 ('NG','Uyo','uyo','Akwa Ibom',                  ST_SetSRID(ST_MakePoint(7.9128, 5.0377),4326)::geography,'Africa/Lagos',false,'beta',NULL),
 ('NG','Owerri','owerri','Imo',                  ST_SetSRID(ST_MakePoint(7.0352, 5.4836),4326)::geography,'Africa/Lagos',false,'beta',NULL),
 ('NG','Abeokuta','abeokuta','Ogun',             ST_SetSRID(ST_MakePoint(3.3381, 7.1475),4326)::geography,'Africa/Lagos',false,'beta',NULL),
 ('NG','Ilorin','ilorin','Kwara',                ST_SetSRID(ST_MakePoint(4.5418, 8.4966),4326)::geography,'Africa/Lagos',false,'beta',NULL),
 ('NG','Warri','warri','Delta',                  ST_SetSRID(ST_MakePoint(5.7500, 5.5167),4326)::geography,'Africa/Lagos',false,'beta',NULL),
 ('NG','Lafia','lafia','Nasarawa',               ST_SetSRID(ST_MakePoint(8.5167, 8.4833),4326)::geography,'Africa/Lagos',false,'beta',NULL),
 ('NG','Lekki','lekki','Lagos',                  ST_SetSRID(ST_MakePoint(3.4746, 6.4698),4326)::geography,'Africa/Lagos',true,NULL,NULL),
 ('NG','Ikeja','ikeja','Lagos',                  ST_SetSRID(ST_MakePoint(3.3515, 6.6018),4326)::geography,'Africa/Lagos',true,NULL,NULL),
 ('NG','Yaba','yaba','Lagos',                    ST_SetSRID(ST_MakePoint(3.3792, 6.5095),4326)::geography,'Africa/Lagos',false,NULL,NULL),
 ('NG','Victoria Island','victoria island','Lagos', ST_SetSRID(ST_MakePoint(3.4219, 6.4281),4326)::geography,'Africa/Lagos',true,NULL,NULL),
 ('GB','London','london','England',              ST_SetSRID(ST_MakePoint(-0.1276,51.5072),4326)::geography,'Europe/London',true,'waitlist',8)
ON CONFLICT (country, ascii_name, admin_area) DO NOTHING;
UPDATE cities SET display_order = CASE ascii_name WHEN 'accra' THEN 5 WHEN 'nairobi' THEN 6 WHEN 'abidjan' THEN 7 END
 WHERE ascii_name IN ('accra','nairobi','abidjan');
COMMENT ON COLUMN cities.admin_area IS 'v3.4 M23 Lagos areas (Lekki, Ikeja, Yaba, Victoria Island) are rows with admin_area Lagos and no market_status: searchable in C6, not shown on the website strip (Lagos is the live market).';

-- A46 prompt used on A10a / A13c.
INSERT INTO prompts (key, text_key, sort) VALUES ('simple_pleasures','prompt.simple_pleasures',8) ON CONFLICT (key) DO NOTHING;

-- M18 / B19 starter message effects (OD-31 / T-8; D9 tray). Premium and Gold (min_role CLASSIC).
INSERT INTO message_effects (key, label_key, animation_ref, min_role) VALUES
 ('confetti','fx.confetti','lottie/confetti','CLASSIC'), ('hearts','fx.hearts','lottie/hearts','CLASSIC'),
 ('wink','fx.wink','lottie/wink','CLASSIC'), ('spotlight','fx.spotlight','lottie/spotlight','CLASSIC')
ON CONFLICT (key) DO NOTHING;

-- M24 starter Lagos venues from the EV2 board (approximate centroids; replaced by the Google Places import, google_place_id).
INSERT INTO venues (name, area, city_id, category, location, tags)
SELECT v.name, v.area, c.id, v.cat, ST_SetSRID(ST_MakePoint(v.lon, v.lat),4326)::geography, '{starter_seed}'
FROM (VALUES
 ('Terra Kulture','Victoria Island','culture',3.4219,6.4281),
 ('Nike Art Gallery','Lekki','gallery',3.4846,6.4433),
 ('Café Neo','Ikoyi','cafe',3.4370,6.4520),
 ('Lekki Conservation Centre','Lekki','park',3.5361,6.4413),
 ('The Palms','Lekki','mall',3.4500,6.4350),
 ('Yellow Chilli','Victoria Island','restaurant',3.4247,6.4296)
) AS v(name, area, cat, lon, lat)
JOIN cities c ON c.country = 'NG' AND c.ascii_name = 'lagos'
WHERE NOT EXISTS (SELECT 1 FROM venues x WHERE x.name = v.name);

-- B28 transactional category for service broadcasts (A26 "Service update").
INSERT INTO notification_categories (key, label_key, is_transactional, default_push, default_email, is_marketing, sort) VALUES
 ('service','ncat.service',true,true,true,false,9) ON CONFLICT (key) DO NOTHING;

-- M20 N23-N36 templates the boards promise; W3 W01-W08 website (non-member) templates.
INSERT INTO notification_templates (code, category_key, channels, trigger_desc, title_key, body_key, deep_link, email_template, throttle_rule, bypass_quiet_hours) VALUES
 ('N23','msgs',    '{push,in_app}','Date invite received','n23.title','n23.body','EV4-Invite',NULL,'instant',false),
 ('N24','msgs',    '{push,in_app}','Date invite accepted / new time suggested','n24.title','n24.body','EV4-Invite',NULL,'instant',false),
 ('N25','security','{push}','Safety check-in due (planned end of the date)','n25.title','n25.body','EV5-Check-In',NULL,'per check-in',true),
 ('N26','billing', '{push,email,in_app}','Plan renews in 3 days','n26.title','n26.body','BL1-Plan-Billing','renewal_upcoming','once per period',false),
 ('N27','account', '{email,in_app}','Data export ready (link emailed)','n27.title','n27.body','LG6-Privacy-Data','export_ready','per export',false),
 ('N28','security','{push,email,in_app}','Appeal decided','n28.title','n28.body','H6-Suspended','appeal_decided','per appeal',false),
 ('N29','account', '{push,email,in_app}','Black Badge not approved (refund)','n29.title','n29.body','B10-Under-Review','badge_not_approved','once',false),
 ('N30','account', '{push,in_app}','Support agent replied','n30.title','n30.body','H1B-Support-Chat',NULL,'collapsed per ticket',false),
 ('N31','groups',  '{push,in_app}','Group invite received','n31.title','n31.body','D13-Group-Room',NULL,'instant',false),
 ('N32','groups',  '{push,in_app}','Group approved / join request approved','n32.title','n32.body','D13-Group-Room',NULL,'instant',false),
 ('N33','msgs',    '{push}','Incoming / missed call','n33.title','n33.body','MF4-Call',NULL,'instant',false),
 ('N34','daily',   '{push}','New people near you','n34.title','n34.body','D1-Home',NULL,'max 1 a day',false),
 ('N35','security','{push,email,in_app}','Restriction lifted','n35.title','n35.body','AS1-Restricted','restriction_lifted','once',false),
 ('N36','security','{push,email,in_app}','Account suspended','n36.title','n36.body','H6-Suspended','suspended','once',true),
 ('W01','account', '{email,sms}','Waitlist: confirm link or 6-digit code (W25)','w01.title','w01.body','/waitlist/confirm','waitlist_confirm','once per address per 24 h',false),
 ('W02','account', '{email,sms}','Waitlist: your city is now open (A29)','w02.title','w02.body','/get','waitlist_now_open','once per entry',false),
 ('W03','account', '{email}','Newsletter: confirm subscription (W36)','w03.title','w03.body','/newsletter/confirm','newsletter_confirm','once per address per 24 h',false),
 ('W04','account', '{email}','Contact form acknowledgement with reference (W33)','w04.title','w04.body','/contact','contact_ack','per submission',false),
 ('W05','account', '{email}','Safety report acknowledgement (W34, when an email was given)','w05.title','w05.body','/safety','safety_ack','per submission',false),
 ('W06','account', '{email}','Job application received (W30)','w06.title','w06.body','/careers','application_ack','per application',false),
 ('W07','account', '{email}','New application notice to the hiring inbox (W30)','w07.title','w07.body','/careers','application_hiring_notice','per application',false),
 ('W08','account', '{email}','Story partner: confirm your story (W27)','w08.title','w08.body','/stories/confirm','story_partner_confirm','once + 1 reminder',false)
ON CONFLICT (code) DO NOTHING;
UPDATE notification_templates SET required_channels = channels
 WHERE category_key IN ('account','billing','security') AND required_channels = '{}';   -- B25 A25b
COMMENT ON COLUMN notification_templates.code IS 'v3.4 N01-N36 member templates (NT4) and W01-W08 website templates sent to non-members (notifications.recipient_kind).';

-- remote_config: T-7 timings (M19), board timers and limits.
INSERT INTO remote_config (key, value, value_type, description, is_public, source_ref) VALUES
 ('intro.text_max_chars','280','int','1-Minute Intro text cap (database ceiling 1000; the API enforces this value)',true,'OD-31 / T-7, D6'),
 ('dm_request.expiry_days','14','int','Direct Spec / DM request expiry; the API sets dm_requests.expires_at (column default = seeded 14 days)',false,'OD-31 / T-7, H7'),
 ('unmatch.cooldown_days','30','int','Pair hidden after an unmatch (read by unmatch())',false,'OD-31 / T-7, D10'),
 ('calls.ring_timeout_seconds','45','int','MF4 ring time before a call is missed',true,'OD-31 / T-7, MF4'),
 ('app.recommended_update_snooze_days','3','int','OB1 recommended-update snooze',true,'OB1'),
 ('meetup.default_duration_minutes','120','int','Date plan length used for meetups.ends_at and the EV5 check-in',true,'EV1, EV5'),
 ('intro.decision_window_hours','24','int','Time to choose Keep talking / Move on after the intro (intro_sessions.decide_by)',true,'MF3'),
 ('groups.invite_batch_max','20','int','GC3 invites per batch',true,'GC3'),
 ('safety.ack_target_minutes','15','int','Safety desk: acknowledge an escalation within this many minutes of creation; overdue after',false,'AD-28, A15'),
 ('appeals.window_days','30','int','Days after a sanction during which the member can appeal',true,'A11'),
 ('media.review_sla_hours','24','int','Media and face-match review SLA',false,'A13'),
 ('notifications.broadcast_rate_per_minute','2000','int','Broadcast send-rate ceiling per minute',false,'A26'),
 ('support.first_response_hours','2','int','Support first-response target (H1B "about 2 h"); sets support_tickets.reply_due_at',true,'AD-39, A27'),
 ('privacy.ndpc_registration','null','json','{reference, filed_at, tier} of the NDPC data-controller registration (biometric data); shown on A36 Biometrics once filed',false,'OD-10, A36'),
 ('contact.safety_sla_minutes.urgent','60','int','Website safety report (W34) SLA for under-18 and threats',false,'W34, AD-36'),
 ('contact.safety_sla_minutes.normal','1440','int','Website safety report (W34) SLA for other categories',false,'W34')
ON CONFLICT (key) DO NOTHING;
UPDATE remote_config SET permission_key = 'sanctions.manage' WHERE key = 'safety.sanctions_ladder';   -- A3 A16c
UPDATE remote_config SET min_value = 5, max_value = 20, unit = 'seconds', group_key = 'intro' WHERE key = 'intro.voice_max_seconds';   -- B13
UPDATE remote_config SET min_value = 25, max_value = 200, unit = 'specs a day', group_key = 'discovery' WHERE key IN ('discovery.daily_cap.basic','discovery.daily_cap.verified_free');
UPDATE remote_config SET min_value = 1, max_value = 1000, unit = 'characters', group_key = 'intro' WHERE key = 'intro.text_max_chars';
UPDATE remote_config SET group_key = 'spotlight' WHERE key IN ('spotlight.rotations_per_week','spotlight.gold_priority') AND group_key IS NULL;

-- B17 flags that are on are on for everyone (enabled AND hash(user) < rollout_percent).
UPDATE feature_flags SET rollout_percent = 100 WHERE enabled AND rollout_percent = 0;

-- A7 / W5 / W23 permissions (Appendix A additions) and grants.
INSERT INTO admin_permissions (key, domain, description, is_sensitive, requires_reason, requires_approval, requires_reauth) VALUES
 ('admins.unlock','access','Unlock a locked admin early; needs a second admin while a linked security incident is open (OD-29)',true,true,false,true),
 ('waitlist.invite','content','Send closed-beta invites to selected waitlist entries (OD-09)',true,true,false,false),
 ('investors.grant_access','content','Approve a time-limited link to an on-request investor document',true,true,false,false)
ON CONFLICT (key) DO NOTHING;
INSERT INTO admin_role_permissions (role_id, permission_key)
SELECT r.id, x.perm
FROM (VALUES ('super_admin','admins.unlock'), ('super_admin','waitlist.invite'), ('super_admin','investors.grant_access'),
             ('admin','admins.unlock'), ('admin','waitlist.invite'), ('admin','investors.grant_access')) AS x(role_key, perm)
JOIN admin_roles r ON r.key = x.role_key
ON CONFLICT (role_id, permission_key) DO NOTHING;
-- A13 scopes each permission allows (Appendix A "Scope": G global; C country; Ci city; Q queue). Unlisted keys are global only.
UPDATE admin_permissions p SET allowed_scopes = s.scopes::scope_kind_t[]
FROM (VALUES
 ('users.read','{global,country,city}'), ('users.pii.read','{global,country,city}'), ('users.update','{global,country,city}'),
 ('users.restrict','{global,country,city}'), ('users.suspend','{global,country,city}'), ('users.ban','{global,country,city}'),
 ('users.export','{global,country}'), ('users.reverify','{global,country,city}'), ('users.merge','{global,country}'),
 ('sessions.revoke','{global,country,city}'), ('badges.review','{global,country,city,queue}'), ('media.moderate','{global,country,city,queue}'),
 ('cases.read','{global,country,city,queue}'), ('cases.claim','{global,country,city,queue}'), ('cases.assign','{global,country,queue}'),
 ('reports.read','{global,country,city,queue}'), ('reports.action','{global,country,city,queue}'), ('conversations.read_reported','{global,country,queue}'),
 ('appeals.decide','{global,country,queue}'), ('safety.escalations','{global,country,city,queue}'), ('groups.moderate','{global,country,city}'),
 ('venues.manage','{global,country,city}'), ('spotlight.manage','{global,country,city}'), ('support.tickets','{global,country}')
) AS s(key, scopes)
WHERE p.key = s.key;
UPDATE admin_permissions SET depends_on = '{users.read}' WHERE key = 'users.ban';          -- A58
UPDATE admin_permissions SET depends_on = '{cases.read}' WHERE key IN ('cases.assign','safety.escalations');

-- Worker jobs promised by the website and admin flows (W24, B51, W5).
INSERT INTO worker_jobs (name, schedule, description, module, run_now_allowed, is_destructive, source_ref) VALUES
 ('web_uploads.purge','hourly','Delete web uploads not attached to a submission after 24 h; infected files at once','A29',false,true,'v3.4 W2'),
 ('newsletter.purge','daily','Delete unconfirmed subscribers after 7 days and unsubscribed ones after 30 days','A29',false,true,'v3.4 W24 W36'),
 ('contact.retention','daily','Delete contact submissions past retention_until (unless on legal hold)','A29',false,true,'v3.4 W24 DN-24'),
 ('applications.purge','daily','Delete job applications past retention_until unless consent_future_roles','A29',false,true,'v3.4 W24 DN-15'),
 ('careers.close','hourly','Archive jobs whose closes_at has passed (drops the JobPosting)','A29',true,false,'v3.4 W24 W30'),
 ('stories.withdraw','every 15 min','Unpublish withdrawn stories and purge caches within the 24 h SLA','A29',true,false,'v3.4 W24 DN-18'),
 ('help.stale_review','daily','Queue published help articles not reviewed for 180 days','A28',true,false,'v3.4 W14'),
 ('waitlist.notify_launch','on demand (approval)','Queue the "now open" message (W02) to confirmed entries of a city that went live','A29',false,false,'v3.4 W24 A29'),
 ('site.publish','on publish','Cloudflare Pages deploy hook, cache purge, sitemap and smoke test (cms_publish_runs)','A28',false,false,'v3.4 B59'),
 ('edge.import','every 15 min','Import Cloudflare analytics and security events into edge_security_events','A32',true,false,'v3.4 B51 OD-06'),
 ('ip_rules.sync','every 5 min','Push ip_access_rules to Cloudflare IP Access Rules; remove expired rules','A32',true,false,'v3.4 B51'),
 ('beta_invites.expire','hourly','Mark unredeemed beta invites past expires_at as expired','A29',true,false,'v3.4 W5')
ON CONFLICT (name) DO NOTHING;

-- W42 footer family links.
INSERT INTO site_settings (key, value) VALUES ('family','[]') ON CONFLICT (key) DO NOTHING;

-- M25 starter abuse rules (A17 names; empty locales = all languages).
INSERT INTO abuse_rules (key, name, kind, pattern, applies_to, action) VALUES
 ('reserved_names','Reserved names in first name and nickname','keyword','admin|support|1minitman|moderator|official','{first_name,nickname}','block_inline'),
 ('contact_details','Contact details in profile, group and request text','regex',
  '(\+?\d[\d\s-]{4,}\d|@[a-z0-9_.]{3,}|https?://|www\.|\.(com|ng|net|org)(\W|$)|whatsapp|telegram|instagram|snapchat|wa\.me|t\.me)',
  '{nickname,bio,job_title,group_name,group_rule,dm_note,prompt_text,status_note}','block_inline'),
 ('money.early_chat','Money requests in early chats','regex','(send (me )?money|bank|account number|gift ?card|crypto|usdt|airtime)','{message_early}','block_inline')
ON CONFLICT (key) DO NOTHING;

-- A21 / A27 decision reasons.
INSERT INTO decision_reasons (domain, code, category, label_key, member_message_key, is_permanent, sort) VALUES
 ('sanction','money_request','money','reason.sanction.money_request','sanction.money_request',false,1),
 ('sanction','money_request_repeat','money','reason.sanction.money_request_repeat','sanction.money_request',false,2),
 ('sanction','harassment','harass','reason.sanction.harassment','sanction.harassment',false,3),
 ('sanction','fake_identity','fake','reason.sanction.fake_identity','sanction.fake_identity',false,4),
 ('sanction','inappropriate_photos','photos','reason.sanction.inappropriate_photos','sanction.inappropriate_photos',false,5),
 ('sanction','contact_details','contact_details','reason.sanction.contact_details','sanction.contact_details',false,6),
 ('sanction','minor','minor','reason.sanction.minor','sanction.minor',false,7),
 ('sanction','offline_behaviour','offline','reason.sanction.offline_behaviour','sanction.offline_behaviour',false,8),
 ('sanction','ban_evasion','ban_evasion','reason.sanction.ban_evasion','sanction.ban_evasion',false,9),
 ('sanction','chargeback','chargeback','reason.sanction.chargeback','sanction.chargeback',false,10),
 ('sanction','no_breach','other','reason.sanction.no_breach',NULL,false,11),
 ('sanction','permanent_minor','minor','reason.sanction.permanent_minor','sanction.minor',true,12),
 ('badge_fix','photo_filter',NULL,'reason.badge_fix.photo_filter','badge.fix.photo_filter',false,1),
 ('badge_fix','face_not_clear',NULL,'reason.badge_fix.face_not_clear','badge.fix.face_not_clear',false,2),
 ('badge_not_approved','identity',NULL,'reason.badge_not_approved.identity','badge.not_approved.identity',false,1),
 ('badge_not_approved','photo_mismatch',NULL,'reason.badge_not_approved.photo_mismatch','badge.not_approved.photo_mismatch',false,2),
 ('badge_not_approved','fraud_ban_evasion',NULL,'reason.badge_not_approved.fraud_ban_evasion','badge.not_approved.identity',false,3),
 ('badge_not_approved','other',NULL,'reason.badge_not_approved.other','badge.not_approved.other',false,4),
 ('media_reject','contact_details_in_image',NULL,'reason.media_reject.contact_details_in_image','media.reject.contact_details',false,1),
 ('media_reject','nudity',NULL,'reason.media_reject.nudity','media.reject.nudity',false,2),
 ('media_reject','not_you',NULL,'reason.media_reject.not_you','media.reject.not_you',false,3),
 ('media_reject','colour_filter',NULL,'reason.media_reject.colour_filter','media.reject.colour_filter',false,4),
 ('media_reject','other_person_main',NULL,'reason.media_reject.other_person_main','media.reject.other_person_main',false,5)
ON CONFLICT (domain, code) DO NOTHING;

-- W16 journal categories (DN-30, decided by owner instruction).
INSERT INTO journal_categories (slug, name_key, sort, requires_ts_review) VALUES
 ('dating-with-intention','journal.cat.intention',1,false), ('safety','journal.cat.safety',2,true),
 ('product-news','journal.cat.product',3,false), ('culture','journal.cat.culture',4,false),
 ('stories-behind-the-app','journal.cat.behind',5,false)
ON CONFLICT (slug) DO NOTHING;

-- B58 Lagos round 1 (OD-26: 1-12 Dec 2026, 5 participants a round).
UPDATE research_studies SET starts_on = DATE '2026-12-01', ends_on = DATE '2026-12-12', target_sessions = 5
 WHERE code = 'LAGOS-R1' AND target_sessions IS NULL;

-- W6 plan card taglines (i18n keys; text in the CMS).
UPDATE plans SET tagline_key = 'plan.' || code || '.tagline' WHERE tagline_key IS NULL;

-- A3 remote_config.permission_key FK (added here because remote_config is seeded before admin_permissions).
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'remote_config_permission_key_fkey') THEN
  ALTER TABLE remote_config ADD CONSTRAINT remote_config_permission_key_fkey FOREIGN KEY (permission_key) REFERENCES admin_permissions(key);
END IF; END $$;

-- First population of the materialized views (later refreshes are CONCURRENTLY).
REFRESH MATERIALIZED VIEW mv_admin_daily_kpis;
REFRESH MATERIALIZED VIEW mv_city_weekly_joins;
REFRESH MATERIALIZED VIEW mv_moderation_sla;
REFRESH MATERIALIZED VIEW mv_revenue_daily;
REFRESH MATERIALIZED VIEW mv_admin_daily_kpis_by_country;   -- v3.1
REFRESH MATERIALIZED VIEW mv_active_users_daily;            -- v3.1

-- =====================================================================
-- 25. CITUS SCALE-OUT PLAN (reference; run only on a Citus cluster)
--     Single PostgreSQL 16 primary until write volume needs it (T4).
--     Distribution keys:
--       user_id  -> users(id), profiles, password_credentials, oauth_identities,
--                   phone_numbers, devices, sessions, otp_challenges(user_id),
--                   profile_*, prompt_answers, media_assets, profile_media,
--                   partner_preference*, international_countries, user_settings,
--                   badge_applications, verification_records, liveness_sessions,
--                   face_templates, carrier_checks, usage_counters,
--                   reactions(actor_id), feed_impressions, pair_cooldowns,
--                   hidden_profiles, blocks(blocker_id), notifications,
--                   inbox_items, push_tokens, notification_preferences,
--                   consent_records, data_export_requests, subscriptions,
--                   transactions, invoices, entitlement_grants, trials ...
--       conversation_id -> conversations(id), conversation_participants,
--                   messages, message_attachments, message_reactions, calls
--       group_id -> groups(id), group_members, group_rules, group_invites, group_messages
--       meetup_id -> meetups(id), meetup_rsvps, meetup_time_proposals,
--                   meetup_feedback, meetup_shares, safety_checkins
--       user_a   -> matches, intro_sessions (pair tables; reverse lookups
--                   by user_b use a colocated pair_index(user_id, match_id))
--     Reference tables (replicated): countries, cities, languages,
--       option_sets, options, vibe_tags, industries, prompts,
--       report_reasons, message_effects, venues, plans, entitlements,
--       role_entitlements, products, prices, i18n_strings,
--       notification_categories, notification_templates, legal_documents,
--       help_categories, help_articles, abuse_rules, remote_config,
--       feature_flags, rate_limit_policies, all admin_* tables except the
--       audit log, admin_notifications and admin_exports; v3.1 adds
--       vendor_settings, worker_jobs, site_settings, journal_categories,
--       analytics_saved_reports, scheduled_exports.
--     v3.1 distributed by user_id: reverification_requests (colocate users).
--     Coordinator-local: admin_audit_log, analytics_events (or ship to the
--       warehouse), api_request_* (incl. v3.1 api_request_ip_rollups),
--       webhook_events, CMS tables (incl. v3.1 content_revisions, faqs,
--       redirects, journal_*, waitlist_entries, consent_receipts), offer_*
--       (claims need one lock per campaign), security_detections,
--       security_incidents, legal_holds, reconciliation_runs, payouts,
--       store_installs_daily, broadcast_campaigns, in_app_announcements,
--       admin_notifications, admin_exports.
--     Citus caveats: foreign keys between distributed tables must include
--     the distribution column; cross-shard FKs (e.g. messages.sender_id ->
--     users) are enforced in the API in Citus mode and dropped there.
--     Partitioned tables are distributed by their key (messages by
--     conversation_id) and keep time partitions on each shard.
--
-- SELECT create_reference_table(t) FROM unnest(ARRAY['countries','cities','languages','option_sets','options',
--   'vibe_tags','industries','prompts','report_reasons','message_effects','venues','plans','entitlements',
--   'role_entitlements','products','prices','i18n_strings','notification_categories','notification_templates',
--   'legal_documents','help_categories','help_articles','abuse_rules','remote_config','feature_flags',
--   'rate_limit_policies',
--   -- v3.1
--   'vendor_settings','worker_jobs','site_settings','journal_categories','admin_recovery_codes',
--   'admin_trusted_devices','admin_saved_views','admin_macros','analytics_saved_reports','scheduled_exports']) t;
-- SELECT create_distributed_table('reverification_requests', 'user_id', colocate_with => 'users');  -- v3.1
-- SELECT create_distributed_table('users', 'id');
-- SELECT create_distributed_table('profiles', 'user_id', colocate_with => 'users');
-- SELECT create_distributed_table('reactions', 'actor_id', colocate_with => 'users');
-- SELECT create_distributed_table('conversations', 'id');
-- SELECT create_distributed_table('messages', 'conversation_id', colocate_with => 'conversations');
-- SELECT create_distributed_table('groups', 'id');
-- SELECT create_distributed_table('group_messages', 'group_id', colocate_with => 'groups');
-- ... (one call per table listed above)

-- =====================================================================
-- 26. DATABASE ROLES (run once by the platform owner; shown for reference)
-- =====================================================================
-- CREATE ROLE app_migrator LOGIN;                 -- owns the schema, runs migrations only (CI)
-- CREATE ROLE app_api LOGIN;                      -- member API: DML only, subject to RLS
-- CREATE ROLE app_worker LOGIN BYPASSRLS;         -- jobs: erasure, billing sync, notifications
-- CREATE ROLE app_admin_api LOGIN BYPASSRLS;      -- admin API: permission checks in code + audit
-- CREATE ROLE app_readonly LOGIN;                 -- analytics replica, no PII columns
-- GRANT USAGE ON SCHEMA public TO app_api, app_worker, app_admin_api, app_readonly;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_api, app_worker, app_admin_api;
-- REVOKE UPDATE, DELETE ON admin_audit_log, consent_records, moderation_actions FROM app_api, app_worker, app_admin_api;
-- REVOKE UPDATE, DELETE ON content_revisions, consent_receipts FROM app_api, app_worker, app_admin_api;   -- v3.1 append-only
-- REVOKE ALL ON admin_recovery_codes, vendor_settings, offer_codes, offer_claims, waitlist_entries FROM app_api, app_readonly;  -- v3.1 admin / worker only
-- REVOKE ALL ON password_credentials, face_templates, otp_challenges FROM app_readonly;
-- GRANT SELECT ON mv_admin_daily_kpis, mv_revenue_daily, mv_moderation_sla, v_research_summary TO app_readonly;
-- GRANT SELECT ON mv_admin_daily_kpis_by_country, mv_active_users_daily, store_installs_daily, api_request_ip_rollups TO app_readonly;  -- v3.1
-- =====================================================================
-- End of schema v3.4
-- =====================================================================
