-- Database roles (schema v3.4, section 26). Idempotent: safe to run after every migration.
-- Run as the role that owns the schema (the migration role). `pnpm db:roles` does it.
--
-- These are GROUP roles: they hold privileges and cannot log in. Each environment creates its
-- own login users (with its own passwords) as members of exactly one group:
--
--   app_migrator   owns the schema; used only by `pnpm db:migrate` in a release step
--   app_api        member API: read/write rows, subject to row-level security, no DDL
--   app_admin_api  admin API: read/write rows, bypasses RLS (permissions enforced in code + audit)
--   app_worker     background jobs: read/write rows, bypasses RLS
--   app_queue      pg-boss: owns the `pgboss` schema and can touch nothing else
--   app_readonly   analytics: aggregates only, no personal data
DO $$
DECLARE
  spec record;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('app_migrator', false), ('app_api', false), ('app_admin_api', true),
      ('app_worker', true), ('app_queue', false), ('app_readonly', false)
    ) AS t(name, bypass_rls)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = spec.name) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN %s', spec.name, CASE WHEN spec.bypass_rls THEN 'BYPASSRLS' ELSE '' END);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------- application data (public)
GRANT USAGE ON SCHEMA public TO app_api, app_admin_api, app_worker, app_readonly;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_api, app_admin_api, app_worker;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_api, app_admin_api, app_worker;
-- Tables created by later migrations get the same grants automatically.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_api, app_admin_api, app_worker;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_api, app_admin_api, app_worker;

-- Append-only ledgers: nobody edits or deletes history.
REVOKE UPDATE, DELETE ON admin_audit_log, consent_records, moderation_actions FROM app_api, app_admin_api, app_worker;
REVOKE UPDATE, DELETE ON content_revisions, consent_receipts FROM app_api, app_admin_api, app_worker;
-- Admin / worker only: the member API never sees these.
REVOKE ALL ON admin_recovery_codes, vendor_settings, offer_codes, offer_claims, waitlist_entries FROM app_api;
-- The migration ledger belongs to the migration role alone.
REVOKE ALL ON schema_migrations FROM app_api, app_admin_api, app_worker;

-- The one DDL action the worker may perform, through a SECURITY DEFINER function (migration 0006).
GRANT EXECUTE ON FUNCTION ensure_monthly_partitions(text, date, int) TO app_worker;

-- Migration 0007 revoked EXECUTE from PUBLIC on the functions below; these are the only callers.
-- is_blocked_pair() is called by the profiles_read policy, so every role that reads profiles needs it.
GRANT EXECUTE ON FUNCTION is_blocked_pair(uuid, uuid) TO app_api, app_admin_api, app_worker;
-- The matching functions run as SECURITY DEFINER with an actor guard: the member API calls them
-- with app.user_id set to the acting member; the worker calls them with no member context.
-- The admin API does not call them (no grant).
GRANT EXECUTE ON FUNCTION record_reaction(uuid, uuid, reaction_t, uuid, feed_surface_t) TO app_api, app_worker;
GRANT EXECUTE ON FUNCTION undo_reaction(uuid, uuid, text) TO app_api, app_worker;
GRANT EXECUTE ON FUNCTION decide_intro(uuid, uuid, intro_decision_t) TO app_api, app_worker;
GRANT EXECUTE ON FUNCTION unmatch(uuid, uuid) TO app_api, app_worker;

-- Analytics: aggregates only.
GRANT SELECT ON mv_admin_daily_kpis, mv_revenue_daily, mv_moderation_sla, v_research_summary TO app_readonly;
GRANT SELECT ON mv_admin_daily_kpis_by_country, mv_active_users_daily, store_installs_daily, api_request_ip_rollups TO app_readonly;

-- ---------------------------------------------------------------- job queue (pgboss)
-- pg-boss keeps its tables in its own schema. Its role owns that schema and has no privileges
-- on business tables, so a compromised queue connection cannot read or change member data.
CREATE SCHEMA IF NOT EXISTS pgboss;
ALTER SCHEMA pgboss OWNER TO app_queue;
DO $$
DECLARE
  item record;
BEGIN
  -- Hand over anything pg-boss created before this file first ran.
  FOR item IN SELECT c.oid::regclass AS name, c.relkind FROM pg_class c
              JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE n.nspname = 'pgboss' AND c.relkind IN ('r', 'p', 'v')
  LOOP
    EXECUTE format('ALTER %s %s OWNER TO app_queue',
      CASE item.relkind WHEN 'v' THEN 'VIEW' ELSE 'TABLE' END, item.name);
  END LOOP;
  -- Sequences owned by a column follow their table; only free-standing ones need handing over.
  FOR item IN SELECT c.oid::regclass AS name FROM pg_class c
              JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE n.nspname = 'pgboss' AND c.relkind = 'S'
                AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype IN ('a', 'i'))
  LOOP
    EXECUTE format('ALTER SEQUENCE %s OWNER TO app_queue', item.name);
  END LOOP;
  FOR item IN SELECT t.oid::regtype AS name FROM pg_type t
              JOIN pg_namespace n ON n.oid = t.typnamespace
              WHERE n.nspname = 'pgboss' AND t.typtype = 'e'
  LOOP
    EXECUTE format('ALTER TYPE %s OWNER TO app_queue', item.name);
  END LOOP;
  FOR item IN SELECT p.oid::regprocedure AS name FROM pg_proc p
              JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'pgboss'
  LOOP
    EXECUTE format('ALTER ROUTINE %s OWNER TO app_queue', item.name);
  END LOOP;
END $$;
