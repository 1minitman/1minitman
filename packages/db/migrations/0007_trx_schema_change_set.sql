-- 0007 · Schema change set 0007: the corrections, seeds, indexes and security fixes of Technical
-- Reference v3.6 (changes SC-01 to SC-11 in docs/1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md §3).
--
-- Authorised by extensions TRX-043 to TRX-051. Phase: expand. Nothing is dropped except one CHECK
-- that is replaced by a wider one (SC-03), so code written against 0006 keeps working.
--
-- Run notes
--   * Run `pnpm db:roles` straight after this file. SC-05 and SC-06 revoke EXECUTE from PUBLIC on
--     five functions; the matching GRANT lines are in roles/roles.sql. Between the two commands
--     the application roles cannot call them.
--   * The migrator session must not carry app.env = 'production': the four-eyes trigger on
--     remote_config would refuse the config rows of SC-03, SC-04, SC-10 and SC-11.
--   * Every statement is safe to run a second time.
--
-- SC-06 (and the definer half of SC-02): how the actor guard decides
--   record_reaction(), undo_reaction(), decide_intro() and unmatch() now run with their owner's
--   rights, because the member role cannot run them under its own policies (no UPDATE policy on
--   reactions, cp_own refuses the other member's participant row, blocks_own hides a block placed
--   by the target). A definer function bypasses row-level security, so each one checks the caller
--   itself before it does anything:
--     1. A member context is set (app.user_id): the actor argument must equal it. This is the
--        member API. Acting as another member, or with a NULL actor, is refused (42501).
--     2. No member context: the call is allowed only when the session's login could write these
--        tables past row-level security anyway, that is, it has BYPASSRLS (the worker and admin
--        logins; the attribute belongs to the login, see roles/local-logins.sql) or it is, or is a
--        member of, the role that owns the function (migrations and owner-run tests). Any other
--        login, which means the member API with no member context, is refused (42501).
--   Rule 2 is stricter than the change set as written, whose guard let every caller with no
--   member context through. That would have let the member role act as any member simply by not
--   setting app.user_id: the same fail-open that SC-05 removes from profiles_read. session_user is
--   used because inside a definer function current_user is the owner, not the caller.
--   EXECUTE is granted to app_api and app_worker only (roles.sql). app_admin_api gets no grant: no
--   module plan has the admin API call these functions, and the admin role can end a match through
--   its own audited table writes. Adding it later is one GRANT line.
--   Each body below is the baseline body (0001, section 20) with only these differences: the
--   definer clause in the header, the guard as the first statement, and in decide_intro() the two
--   `interval '30 days'` literals replaced by the config read (SC-02).

-- ---------------------------------------------------------------------------------------------
-- SC-01 (TRX-043, GAP-DB01-01) · Monthly partitions for edge_security_events, Nov 2026 to Dec 2027,
-- like the other eight partitioned tables. The baseline created only its default partition.
-- ---------------------------------------------------------------------------------------------
SELECT ensure_monthly_partitions('edge_security_events', DATE '2026-11-01', 14);

-- ---------------------------------------------------------------------------------------------
-- SC-02 (TRX-044, TRX-048; GAP-MOD08-03, GAP-DB05-02) · decide_intro() reads the move-on cooldown
-- from discovery.pass_memory_days (seeded 30) instead of a literal, and runs as definer.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION decide_intro(p_session uuid, p_user uuid, p_decision intro_decision_t)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE s intro_sessions%ROWTYPE; v_keep int; v_n int; v_cid uuid;
BEGIN
  -- 0007 actor guard (see the file header).
  IF app_current_user_id() IS NOT NULL THEN
    IF p_user IS DISTINCT FROM app_current_user_id() THEN
      RAISE EXCEPTION 'actor mismatch' USING ERRCODE = '42501';
    END IF;
  ELSIF NOT (pg_has_role(session_user, current_user, 'MEMBER')
             OR EXISTS (SELECT 1 FROM pg_catalog.pg_roles g WHERE g.rolname = session_user AND g.rolbypassrls)) THEN
    RAISE EXCEPTION 'member context required' USING ERRCODE = '42501';
  END IF;
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
    (s.user_a, s.user_b, 'moved_on', now() + make_interval(days => config_int('discovery.pass_memory_days', 30))),
    (s.user_b, s.user_a, 'moved_on', now() + make_interval(days => config_int('discovery.pass_memory_days', 30)))
  ON CONFLICT (user_id, other_id, reason) DO UPDATE SET until = EXCLUDED.until;
  RETURN 'moved_on';
END $$;
REVOKE EXECUTE ON FUNCTION decide_intro(uuid, uuid, intro_decision_t) FROM PUBLIC;

-- ---------------------------------------------------------------------------------------------
-- SC-03 (TRX-045, GAP-MOD13-02) · The check-in response window is no longer fixed at 15 minutes.
-- The editable key checkin.response_minutes made every insert fail at any other value; the CHECK
-- becomes a range (more than 0, at most 60 minutes) and the key is bounded to 5-60.
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE c text;
BEGIN
  -- The baseline CHECK is unnamed (PostgreSQL calls it safety_checkins_check); find it by definition.
  FOR c IN SELECT conname FROM pg_constraint
            WHERE conrelid = 'safety_checkins'::regclass AND contype = 'c'
              AND pg_get_constraintdef(oid) LIKE '%respond_by = %'
  LOOP
    EXECUTE format('ALTER TABLE safety_checkins DROP CONSTRAINT %I', c);
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'safety_checkins'::regclass AND conname = 'ck_checkins_respond_by') THEN
    ALTER TABLE safety_checkins ADD CONSTRAINT ck_checkins_respond_by
      CHECK (respond_by > due_at AND respond_by <= due_at + interval '60 minutes');
  END IF;
END $$;

UPDATE remote_config SET min_value = 5, max_value = 60, unit = 'minutes'
 WHERE key = 'checkin.response_minutes';

INSERT INTO remote_config (key, value, value_type, description, is_public, source_ref, unit, min_value, max_value) VALUES
 ('checkin.snooze_minutes','60','int','EV5 "Add 1 hour": length of one check-in snooze',true,'EV5, GAP-MOD13-02','minutes',15,120),
 ('checkin.max_snoozes','6','int','EV5 snoozes allowed per check-in (database ceiling 6)',true,'EV5, GAP-MOD13-02','snoozes',0,6)
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------------------------
-- SC-04 (TRX-046, GAP-MOD16-06) · deletion.grace_days is pinned to 14: account_deletions keeps its
-- CHECK scheduled_for = requested_at + 14 days, so the console must not offer another value.
-- ---------------------------------------------------------------------------------------------
UPDATE remote_config SET min_value = 14, max_value = 14, unit = 'days'
 WHERE key = 'deletion.grace_days';

-- ---------------------------------------------------------------------------------------------
-- SC-05 (TRX-047, GAP-DB05-03) · profiles_read returns nothing when no member context is set (it
-- returned every non-hidden profile); is_blocked_pair() pins pg_temp last in its search_path and
-- is no longer executable by PUBLIC (grants in roles.sql).
-- ---------------------------------------------------------------------------------------------
ALTER POLICY profiles_read ON profiles
  USING (app_current_user_id() IS NOT NULL
         AND (user_id = app_current_user_id()
              OR (NOT is_hidden AND NOT is_blocked_pair(app_current_user_id(), profiles.user_id))));

ALTER FUNCTION is_blocked_pair(uuid, uuid) SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION is_blocked_pair(uuid, uuid) FROM PUBLIC;

-- ---------------------------------------------------------------------------------------------
-- SC-06 (TRX-048, GAP-DB05-02) · The other three matching functions run as definer with the actor
-- guard (decide_intro() is above). See the file header for the guard and the grants.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION record_reaction(p_actor uuid, p_target uuid, p_kind reaction_t,
                                           p_client_id uuid, p_surface feed_surface_t DEFAULT 'for_you')
RETURNS TABLE (o_reaction_id uuid, o_replayed boolean, o_match_id uuid, o_match_kind match_kind_t, o_intro_session_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_low  uuid := LEAST(p_actor, p_target);
  v_high uuid := GREATEST(p_actor, p_target);
  v_rid  uuid; v_rev reaction_t; v_kind match_kind_t; v_mid uuid; v_sid uuid; v_role member_role_t;
BEGIN
  -- 0007 actor guard (see the file header).
  IF app_current_user_id() IS NOT NULL THEN
    IF p_actor IS DISTINCT FROM app_current_user_id() THEN
      RAISE EXCEPTION 'actor mismatch' USING ERRCODE = '42501';
    END IF;
  ELSIF NOT (pg_has_role(session_user, current_user, 'MEMBER')
             OR EXISTS (SELECT 1 FROM pg_catalog.pg_roles g WHERE g.rolname = session_user AND g.rolbypassrls)) THEN
    RAISE EXCEPTION 'member context required' USING ERRCODE = '42501';
  END IF;
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
REVOKE EXECUTE ON FUNCTION record_reaction(uuid, uuid, reaction_t, uuid, feed_surface_t) FROM PUBLIC;

CREATE OR REPLACE FUNCTION undo_reaction(p_actor uuid, p_target uuid, p_via text DEFAULT 'undo_toast')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_id uuid;
BEGIN
  -- 0007 actor guard (see the file header).
  IF app_current_user_id() IS NOT NULL THEN
    IF p_actor IS DISTINCT FROM app_current_user_id() THEN
      RAISE EXCEPTION 'actor mismatch' USING ERRCODE = '42501';
    END IF;
  ELSIF NOT (pg_has_role(session_user, current_user, 'MEMBER')
             OR EXISTS (SELECT 1 FROM pg_catalog.pg_roles g WHERE g.rolname = session_user AND g.rolbypassrls)) THEN
    RAISE EXCEPTION 'member context required' USING ERRCODE = '42501';
  END IF;
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
REVOKE EXECUTE ON FUNCTION undo_reaction(uuid, uuid, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION unmatch(p_match uuid, p_user uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE m matches%ROWTYPE;
BEGIN
  -- 0007 actor guard (see the file header).
  IF app_current_user_id() IS NOT NULL THEN
    IF p_user IS DISTINCT FROM app_current_user_id() THEN
      RAISE EXCEPTION 'actor mismatch' USING ERRCODE = '42501';
    END IF;
  ELSIF NOT (pg_has_role(session_user, current_user, 'MEMBER')
             OR EXISTS (SELECT 1 FROM pg_catalog.pg_roles g WHERE g.rolname = session_user AND g.rolbypassrls)) THEN
    RAISE EXCEPTION 'member context required' USING ERRCODE = '42501';
  END IF;
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
REVOKE EXECUTE ON FUNCTION unmatch(uuid, uuid) FROM PUBLIC;

-- ---------------------------------------------------------------------------------------------
-- SC-07 (TRX-049) · Job catalogue rows that jobs named in the Technical Reference lacked, and the
-- machine-readable cron of the jobs whose schedule is fixed. A row does not start a job.
-- backups.dump keeps cron NULL: MOD-00 sets the hour with its deploy window (ruling R20).
-- ---------------------------------------------------------------------------------------------
INSERT INTO worker_jobs (name, schedule, description, module, run_now_allowed, is_destructive, source_ref) VALUES
 ('backups.dump','nightly','pg_dump to the R2 backups bucket, encrypted; monthly copy kept 12 months','A31',true,false,'TR §10.3, TRX-049'),
 ('cases.release_stale','every 5 min','Release case, badge and media claims idle longer than cases.claim_timeout_minutes; expire age checks past due_at','A14',true,false,'ADMIN A12, AD-26, TRX-049'),
 ('messages.purge','hourly','Delete messages of closed conversations after the evidence snapshot; skips legal holds','A36',false,true,'TR §16.1, TRX-049'),
 ('group_invites.expire','hourly','Set pending group invites past expires_at to expired','A18',false,false,'TRX-049')
ON CONFLICT (name) DO NOTHING;

UPDATE worker_jobs SET cron = '0 3 1 * *'   WHERE name = 'partitions.ensure'    AND cron IS NULL;
UPDATE worker_jobs SET cron = '*/5 * * * *' WHERE name = 'cases.release_stale'  AND cron IS NULL;
UPDATE worker_jobs SET cron = '0 * * * *'   WHERE name = 'messages.purge'       AND cron IS NULL;
UPDATE worker_jobs SET cron = '0 * * * *'   WHERE name = 'group_invites.expire' AND cron IS NULL;

-- ---------------------------------------------------------------------------------------------
-- SC-08 (TRX-050; GAP-MOD09-05, GAP-DB04-01) · Indexes for the abuse-rule hits view and the console
-- member search (last 8 characters of the id; any phone number, verified or not).
-- Plain CREATE INDEX: the tables are empty or small before launch, and the runner cannot build
-- CONCURRENTLY (one transaction per file).
-- ---------------------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_rule_hits_rule ON abuse_rule_hits (rule_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_id_last8 ON users (right(id::text, 8));
CREATE INDEX IF NOT EXISTS idx_phone_e164     ON phone_numbers (e164);

-- ---------------------------------------------------------------------------------------------
-- SC-09 (TRX-050, GAP-DB04-02) · Indexes on foreign keys to users that member screens, the export
-- and the erasure cascade read by member. The two calls indexes wait for the calls feature.
-- ---------------------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_appeals_user      ON appeals (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_checkins_user     ON safety_checkins (user_id);
CREATE INDEX IF NOT EXISTS idx_escalations_user  ON safety_escalations (user_id);
CREATE INDEX IF NOT EXISTS idx_privacy_user      ON privacy_requests (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trials_user       ON trials (user_id);
CREATE INDEX IF NOT EXISTS idx_credits_user      ON billing_credits (user_id);
CREATE INDEX IF NOT EXISTS idx_intro_sessions_a  ON intro_sessions (user_a);
CREATE INDEX IF NOT EXISTS idx_intro_sessions_b  ON intro_sessions (user_b);
CREATE INDEX IF NOT EXISTS idx_meetups_creator   ON meetups (created_by);

-- ---------------------------------------------------------------------------------------------
-- SC-10 (TRX-051) · Config keys whose value the Technical Reference or the schema already states.
-- Seeds only; a key is inert until a module reads it. min/max are guards for the A24 editor.
-- ---------------------------------------------------------------------------------------------
INSERT INTO remote_config (key, value, value_type, description, is_public, source_ref, unit, min_value, max_value) VALUES
 ('auth.age_gate_block_days','30','int','Days a device stays blocked after an under-18 birth date',false,'TR §13.2','days',1,365),
 ('badge.review_reminder_hours','12','int','Hours after submit before the still-reviewing reminder',false,'TR §11','hours',1,72),
 ('badge.needs_fix_reminder_hours','24','int','Hours after needs-fix before the reminder',false,'TR §11','hours',1,168),
 ('help.stale_review_days','180','int','Days after last review before a published help article is queued for review',false,'TR §11','days',30,730),
 ('newsletter.unconfirmed_purge_days','7','int','Days before an unconfirmed newsletter subscriber is deleted',false,'TR §11','days',1,30),
 ('newsletter.unsubscribed_purge_days','30','int','Days before an unsubscribed newsletter subscriber is deleted',false,'TR §11','days',1,90),
 ('groups.invite_expiry_days','14','int','Group invite validity; the API sets group_invites.expires_at (column default = 14 days)',false,'GC3','days',1,90),
 ('chat.message_max_chars','2000','int','Chat message length (database ceiling 2000)',true,'D9','characters',1,2000),
 ('groups.message_max_chars','2000','int','Group message length (database ceiling 2000)',true,'D13','characters',1,2000)
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------------------------
-- SC-11 (TRX-051, GAP-MOD14-14) · The website safety SLA keys become public, so the site build
-- reads the values it prints ("1 hour", "24 hours") instead of repeating them by hand.
-- ---------------------------------------------------------------------------------------------
UPDATE remote_config SET is_public = true
 WHERE key IN ('contact.safety_sla_minutes.urgent','contact.safety_sla_minutes.normal');
