import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';

// Proves schema change set 0007 (migration 0007_trx_schema_change_set.sql, changes SC-01 to SC-11)
// on a real database: `pnpm services:up && pnpm db:migrate && pnpm db:roles`.
// The member API login is subject to row-level security; the worker and admin logins bypass it.
// Every row written here is synthetic and is removed again (or rolled back).
const urls = {
  api: process.env.DATABASE_URL,
  worker: process.env.WORKER_DATABASE_URL,
  admin: process.env.ADMIN_DATABASE_URL,
  queue: process.env.QUEUE_DATABASE_URL,
};
const ready = Object.values(urls).every(Boolean);
const connect = (url: string | undefined) => postgres(url ?? '', { max: 1, onnotice: () => {} });
const api = connect(urls.api);
const worker = connect(urls.worker);
const admin = connect(urls.admin);
const queue = connect(urls.queue);

type Tx = postgres.TransactionSql;
type Members = Record<'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'hidden', string>;
let m: Members;

/** One member API transaction with the member context set, as the API will do per request. */
const asMember = <T>(memberId: string, run: (tx: Tx) => Promise<T>) =>
  api.begin(async (tx) => {
    await tx`SELECT set_config('app.user_id', ${memberId}, true)`;
    return run(tx);
  }) as Promise<T>;

/** Runs `run` in a transaction that is always rolled back; assertion failures still surface. */
const rolledBack = async (sql: postgres.Sql, run: (tx: Tx) => Promise<void>) => {
  const rollback = new Error('rollback');
  await sql
    .begin(async (tx) => {
      await run(tx);
      throw rollback;
    })
    .catch((error: unknown) => {
      if (error !== rollback) throw error;
    });
};

/** The query must fail with this SQLSTATE (and message, when given). */
const refused = async (query: PromiseLike<unknown>, code: string, message?: RegExp) => {
  const error = await Promise.resolve(query).then(
    () => null,
    (reason: unknown) => reason as { code?: string; message?: string },
  );
  expect(error).not.toBeNull();
  expect(error?.code).toBe(code);
  if (message) expect(error?.message ?? '').toMatch(message);
};

const react = (sql: postgres.Sql | Tx, actor: string, target: string, kind: string) =>
  sql<
    {
      o_reaction_id: string;
      o_replayed: boolean;
      o_match_id: string | null;
      o_match_kind: string | null;
      o_intro_session_id: string | null;
    }[]
  >`SELECT * FROM record_reaction(${actor}, ${target}, ${kind}::reaction_t, ${randomUUID()})`;

beforeAll(async () => {
  if (!ready) return;
  const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'hidden'] as const;
  const created = {} as Members;
  for (const name of names) {
    const [user] = await worker<{ id: string }[]>`
      INSERT INTO users (email, first_name, role, is_verified, verified_at)
      VALUES (${`sc0007-${randomUUID()}@example.test`}, 'Synthetic', 'ACTIVE', true, now())
      RETURNING id`;
    if (!user) throw new Error('fixture user was not created');
    created[name] = user.id;
    await worker`
      INSERT INTO profiles (user_id, nickname, birth_date, gender, interested_in, intention, is_hidden)
      VALUES (${user.id}, ${`Synth ${name}`}, DATE '1995-01-01', 'man', 'women', 'long_term', ${name === 'hidden'})`;
  }
  m = created;
  // d has blocked a. Under blocks_own, a cannot see this row.
  await worker`INSERT INTO blocks (blocker_id, blocked_id, surface) VALUES (${m.d}, ${m.a}, 'spec_profile')`;
});

afterAll(async () => {
  if (ready && m) {
    const ids = Object.values(m);
    await worker`DELETE FROM conversations WHERE user_a = ANY(${ids}) OR user_b = ANY(${ids})`;
    // reaction_history has no foreign key to users, so the cascade does not reach it.
    await worker`DELETE FROM reaction_history WHERE actor_id = ANY(${ids})`;
    await worker`DELETE FROM users WHERE id = ANY(${ids})`;
  }
  await Promise.all([api.end(), worker.end(), admin.end(), queue.end()]);
});

describe.skipIf(!ready)(
  'change set 0007 · matching functions as the member API (SC-02, SC-06)',
  () => {
    let matchId = '';
    let sessionId = '';

    test('the four functions run as definer with a pinned search_path, closed to PUBLIC', async () => {
      const rows = await api<{ proname: string; ok: boolean; open: boolean }[]>`
      SELECT proname,
             prosecdef AND proconfig @> ARRAY['search_path=public, pg_temp'] AS ok,
             has_function_privilege('public', oid, 'EXECUTE') AS open
        FROM pg_proc
       WHERE pronamespace = 'public'::regnamespace
         AND proname IN ('record_reaction', 'undo_reaction', 'decide_intro', 'unmatch', 'is_blocked_pair')
       ORDER BY proname`;
      expect(rows.map((row) => row.proname)).toEqual([
        'decide_intro',
        'is_blocked_pair',
        'record_reaction',
        'undo_reaction',
        'unmatch',
      ]);
      expect(rows.every((row) => row.ok)).toBe(true);
      expect(rows.some((row) => row.open)).toBe(false);
    });

    test('a first reaction is recorded', async () => {
      const [row] = await asMember(m.a, (tx) => react(tx, m.a, m.b, 'like'));
      expect(row?.o_replayed).toBe(false);
      expect(row?.o_match_id).toBeNull();
    });

    test('a repeat reaction on the same member takes the upsert path', async () => {
      const [pass] = await asMember(m.a, (tx) => react(tx, m.a, m.c, 'pass'));
      const [like] = await asMember(m.a, (tx) => react(tx, m.a, m.c, 'like'));
      expect(like?.o_reaction_id).toBe(pass?.o_reaction_id ?? 'missing');
      const rows = await worker<{ kind: string; pass_count: number }[]>`
      SELECT kind, pass_count FROM reactions WHERE actor_id = ${m.a} AND target_id = ${m.c}`;
      expect([...rows]).toEqual([{ kind: 'like', pass_count: 1 }]);
    });

    test('a mutual like creates one match and one intro session', async () => {
      const [row] = await asMember(m.b, (tx) => react(tx, m.b, m.a, 'like'));
      expect(row?.o_match_kind).toBe('match');
      matchId = row?.o_match_id ?? '';
      sessionId = row?.o_intro_session_id ?? '';
      expect(matchId).not.toBe('');
      expect(sessionId).not.toBe('');
      const [count] = await worker<{ matches: number; sessions: number }[]>`
      SELECT (SELECT count(*)::int FROM matches WHERE id = ${matchId}) AS matches,
             (SELECT count(*)::int FROM intro_sessions WHERE match_id = ${matchId}) AS sessions`;
      expect(count).toEqual({ matches: 1, sessions: 1 });
    });

    test('a pass can be undone inside the undo window', async () => {
      await asMember(m.a, (tx) => react(tx, m.a, m.e, 'pass'));
      const [undone] = await asMember(
        m.a,
        (tx) => tx<{ id: string | null }[]>`SELECT undo_reaction(${m.a}, ${m.e}) AS id`,
      );
      expect(undone?.id).toBeTruthy();
      const [left] = await worker<{ n: number }[]>`
      SELECT count(*)::int AS n FROM pair_cooldowns
       WHERE user_id = ${m.a} AND other_id = ${m.e} AND reason = 'pass'`;
      expect(left?.n).toBe(0);
    });

    test('a caller cannot act as another member', async () => {
      const actorMismatch = /actor mismatch/;
      await refused(
        asMember(m.a, (tx) => react(tx, m.b, m.c, 'pass')),
        '42501',
        actorMismatch,
      );
      await refused(
        asMember(m.a, (tx) => tx`SELECT undo_reaction(${m.b}, ${m.a})`),
        '42501',
        actorMismatch,
      );
      await refused(
        asMember(m.a, (tx) => tx`SELECT decide_intro(${sessionId}, ${m.b}, 'keep')`),
        '42501',
        actorMismatch,
      );
      await refused(
        asMember(m.a, (tx) => tx`SELECT unmatch(${matchId}, ${m.b})`),
        '42501',
        actorMismatch,
      );
      // A member who is in neither the context's pair nor the session is refused by the body as before.
      await refused(
        asMember(m.c, (tx) => tx`SELECT decide_intro(${sessionId}, ${m.c}, 'keep')`),
        '42501',
        /not a participant/,
      );
    });

    test('the member API with no member context cannot call them at all', async () => {
      const noContext = /member context required/;
      await refused(react(api, m.a, m.f, 'pass'), '42501', noContext);
      await refused(api`SELECT undo_reaction(${m.a}, ${m.e})`, '42501', noContext);
      await refused(api`SELECT decide_intro(${sessionId}, ${m.a}, 'keep')`, '42501', noContext);
      await refused(api`SELECT unmatch(${matchId}, ${m.a})`, '42501', noContext);
      await refused(api`SELECT unmatch(${matchId}, NULL)`, '42501', noContext);
    });

    test('a block placed by the target is honoured', async () => {
      await refused(
        asMember(m.a, (tx) => react(tx, m.a, m.d, 'like')),
        '42501',
        /pair is blocked/,
      );
    });

    test('both keep creates the conversation and both participant rows', async () => {
      const decide = (member: string) =>
        asMember(
          member,
          (tx) =>
            tx<
              { outcome: string }[]
            >`SELECT decide_intro(${sessionId}, ${member}, 'keep') AS outcome`,
        );
      expect((await decide(m.a))[0]?.outcome).toBe('waiting');
      expect((await decide(m.b))[0]?.outcome).toBe('both_keep');
      const participants = await worker<{ user_id: string }[]>`
      SELECT cp.user_id FROM conversation_participants cp
        JOIN conversations c ON c.id = cp.conversation_id
       WHERE c.match_id = ${matchId} AND c.state = 'open'`;
      expect(participants.map((row) => row.user_id).sort()).toEqual([m.a, m.b].sort());
    });

    test('unmatch closes the match and the conversation', async () => {
      await asMember(m.a, (tx) => tx`SELECT unmatch(${matchId}, ${m.a})`);
      const [row] = await worker<{ status: string; state: string }[]>`
      SELECT mt.status, c.state FROM matches mt JOIN conversations c ON c.match_id = mt.id
       WHERE mt.id = ${matchId}`;
      expect(row).toEqual({ status: 'unmatched', state: 'closed' });
    });

    test('the admin API holds no grant on the matching functions', async () => {
      await refused(admin`SELECT unmatch(${matchId}, ${m.a})`, '42501', /permission denied/);
      await refused(react(admin, m.f, m.g, 'pass'), '42501', /permission denied/);
    });

    test('the worker calls them with no member context; the cooldown follows discovery.pass_memory_days', async () => {
      const moveOn = async (tx: Tx) => {
        await react(tx, m.f, m.g, 'like');
        const [pair] = await react(tx, m.g, m.f, 'like');
        const [decision] = await tx<{ outcome: string }[]>`
        SELECT decide_intro(${pair?.o_intro_session_id ?? null}, ${m.f}, 'move_on') AS outcome`;
        expect(decision?.outcome).toBe('moved_on');
        return tx<{ days: number }[]>`
        SELECT round(extract(epoch FROM until - now()) / 86400)::int AS days
          FROM pair_cooldowns
         WHERE reason = 'moved_on' AND user_id IN (${m.f}, ${m.g}) AND other_id IN (${m.f}, ${m.g})`;
      };
      await rolledBack(worker, async (tx) => {
        expect([...(await moveOn(tx))]).toEqual([{ days: 30 }, { days: 30 }]);
      });
      await rolledBack(worker, async (tx) => {
        await tx`UPDATE remote_config SET value = '7'::jsonb WHERE key = 'discovery.pass_memory_days'`;
        expect([...(await moveOn(tx))]).toEqual([{ days: 7 }, { days: 7 }]);
      });
      const [seed] = await worker<{ value: number }[]>`
      SELECT value FROM remote_config WHERE key = 'discovery.pass_memory_days'`;
      expect(seed?.value).toBe(30);
    });
  },
);

describe.skipIf(!ready)('change set 0007 · profiles_read and is_blocked_pair (SC-05)', () => {
  test('with no member context the member API reads no profile', async () => {
    const [seen] = await api<{ n: number }[]>`SELECT count(*)::int AS n FROM profiles`;
    expect(seen?.n).toBe(0);
    const [real] = await worker<{ n: number }[]>`SELECT count(*)::int AS n FROM profiles`;
    expect(real?.n).toBeGreaterThanOrEqual(8);
  });

  test('a member sees their own row and visible members, not a hidden or blocked one', async () => {
    const ids = Object.values(m);
    const rows = await asMember(
      m.a,
      (tx) => tx<{ user_id: string }[]>`SELECT user_id FROM profiles WHERE user_id = ANY(${ids})`,
    );
    const seen = new Set(rows.map((row) => row.user_id));
    expect(seen.has(m.a)).toBe(true);
    expect(seen.has(m.b)).toBe(true);
    expect(seen.has(m.d)).toBe(false); // d blocked a
    expect(seen.has(m.hidden)).toBe(false);
    expect(seen.size).toBe(6);
  });

  test('is_blocked_pair is callable by the application roles only', async () => {
    const [asApi] = await api<{ blocked: boolean }[]>`
      SELECT is_blocked_pair(${m.a}, ${m.d}) AS blocked`;
    expect(asApi?.blocked).toBe(true);
    const [asAdmin] = await admin<{ blocked: boolean }[]>`
      SELECT is_blocked_pair(${m.a}, ${m.b}) AS blocked`;
    expect(asAdmin?.blocked).toBe(false);
    await expect(queue`SELECT is_blocked_pair(${m.a}, ${m.d})`).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe.skipIf(!ready)('change set 0007 · tables, indexes and seeds', () => {
  test('edge_security_events has 14 monthly partitions and the default (SC-01)', async () => {
    const [parts] = await worker<{ n: number }[]>`
      SELECT count(*)::int AS n FROM pg_inherits WHERE inhparent = 'edge_security_events'::regclass`;
    expect(parts?.n).toBeGreaterThanOrEqual(15);
    const named = await worker<{ name: string }[]>`
      SELECT inhrelid::regclass::text AS name FROM pg_inherits
       WHERE inhparent = 'edge_security_events'::regclass`;
    const names = new Set(named.map((row) => row.name));
    for (const month of ['202611', '202612', '202701', '202706', '202712']) {
      expect(names.has(`edge_security_events_p${month}`)).toBe(true);
    }
    await rolledBack(worker, async (tx) => {
      const [row] = await tx<{ part: string }[]>`
        INSERT INTO edge_security_events (occurred_at, rule_id, action)
        VALUES ('2027-03-15T12:00:00Z', 'synthetic-rule', 'log')
        RETURNING tableoid::regclass::text AS part`;
      expect(row?.part).toBe('edge_security_events_p202703');
    });
  });

  test('a check-in accepts a response window up to 60 minutes and refuses others (SC-03)', async () => {
    await rolledBack(worker, async (tx) => {
      const [conversation] = await tx<{ id: string }[]>`
        INSERT INTO conversations (kind, user_a, user_b, state, closed_at)
        VALUES ('match', LEAST(${m.a}::uuid, ${m.b}::uuid), GREATEST(${m.a}::uuid, ${m.b}::uuid), 'closed', now())
        RETURNING id`;
      const [meetup] = await tx<{ id: string }[]>`
        INSERT INTO meetups (kind, title, created_by, venue_id, starts_at, ends_at, conversation_id)
        SELECT 'date', 'Synthetic meet-up', ${m.a}, v.id, now() + interval '1 day',
               now() + interval '1 day 2 hours', ${conversation?.id ?? null}
          FROM venues v LIMIT 1
        RETURNING id`;
      expect(meetup?.id).toBeTruthy();
      const insert = (sql: Tx, minutes: number, snoozes = 0) => sql`
        INSERT INTO safety_checkins (meetup_id, user_id, due_at, respond_by, snooze_count)
        VALUES (${meetup?.id ?? null}, ${m.a}, now(), now() + make_interval(mins => ${minutes}), ${snoozes})`;

      for (const minutes of [5, 15, 30, 60]) {
        await insert(tx, minutes);
        await tx`DELETE FROM safety_checkins WHERE meetup_id = ${meetup?.id ?? null}`;
      }
      for (const minutes of [0, 61, -15]) {
        await refused(
          tx.savepoint((sp) => insert(sp, minutes)),
          '23514',
          /ck_checkins_respond_by/,
        );
      }
      await refused(
        tx.savepoint((sp) => insert(sp, 15, 7)),
        '23514',
        /snooze_count/,
      );
    });
  });

  test('the new indexes exist, are valid and serve their lookups (SC-08, SC-09)', async () => {
    const lookups: Record<string, string> = {
      idx_rule_hits_rule: `SELECT id FROM abuse_rule_hits WHERE rule_id = '${m.a}' ORDER BY created_at DESC`,
      idx_users_id_last8: `SELECT id FROM users WHERE right(id::text, 8) = '${m.a.slice(-8)}'`,
      idx_phone_e164: `SELECT id FROM phone_numbers WHERE e164 = '+2348000000000'`,
      idx_appeals_user: `SELECT id FROM appeals WHERE user_id = '${m.a}' ORDER BY created_at DESC`,
      idx_checkins_user: `SELECT id FROM safety_checkins WHERE user_id = '${m.a}'`,
      idx_escalations_user: `SELECT id FROM safety_escalations WHERE user_id = '${m.a}'`,
      idx_privacy_user: `SELECT id FROM privacy_requests WHERE user_id = '${m.a}'`,
      idx_trials_user: `SELECT id FROM trials WHERE user_id = '${m.a}'`,
      idx_credits_user: `SELECT id FROM billing_credits WHERE user_id = '${m.a}'`,
      idx_intro_sessions_a: `SELECT id FROM intro_sessions WHERE user_a = '${m.a}'`,
      idx_intro_sessions_b: `SELECT id FROM intro_sessions WHERE user_b = '${m.a}'`,
      idx_meetups_creator: `SELECT id FROM meetups WHERE created_by = '${m.a}'`,
    };
    const names = Object.keys(lookups);
    const valid = await worker<{ name: string }[]>`
      SELECT c.relname AS name FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
       WHERE c.relname = ANY(${names}) AND i.indisvalid AND i.indisready`;
    expect(valid.map((row) => row.name).sort()).toEqual([...names].sort());

    await rolledBack(worker, async (tx) => {
      await tx`SET LOCAL enable_seqscan = off`;
      for (const [index, query] of Object.entries(lookups)) {
        const plan = await tx.unsafe<{ 'QUERY PLAN': string }[]>(`EXPLAIN ${query}`);
        expect(plan.map((row) => row['QUERY PLAN']).join('\n')).toContain(index);
      }
    });
  });

  test('the four job rows and the fixed crons are seeded (SC-07)', async () => {
    const rows = await worker<{ name: string; cron: string | null }[]>`
      SELECT name, cron FROM worker_jobs
       WHERE name IN ('backups.dump', 'cases.release_stale', 'messages.purge',
                      'group_invites.expire', 'partitions.ensure')
       ORDER BY name`;
    expect([...rows]).toEqual([
      { name: 'backups.dump', cron: null },
      { name: 'cases.release_stale', cron: '*/5 * * * *' },
      { name: 'group_invites.expire', cron: '0 * * * *' },
      { name: 'messages.purge', cron: '0 * * * *' },
      { name: 'partitions.ensure', cron: '0 3 1 * *' },
    ]);
  });

  test('the config keys are seeded once, inside their bounds (SC-03, SC-04, SC-10, SC-11)', async () => {
    const expected: Record<string, [value: number, min: number, max: number, isPublic: boolean]> = {
      'checkin.response_minutes': [15, 5, 60, true],
      'checkin.snooze_minutes': [60, 15, 120, true],
      'checkin.max_snoozes': [6, 0, 6, true],
      'deletion.grace_days': [14, 14, 14, true],
      'auth.age_gate_block_days': [30, 1, 365, false],
      'badge.review_reminder_hours': [12, 1, 72, false],
      'badge.needs_fix_reminder_hours': [24, 1, 168, false],
      'help.stale_review_days': [180, 30, 730, false],
      'newsletter.unconfirmed_purge_days': [7, 1, 30, false],
      'newsletter.unsubscribed_purge_days': [30, 1, 90, false],
      'groups.invite_expiry_days': [14, 1, 90, false],
      'chat.message_max_chars': [2000, 1, 2000, true],
      'groups.message_max_chars': [2000, 1, 2000, true],
    };
    const rows = await api<
      { key: string; value: number; min: number; max: number; is_public: boolean; unit: string }[]
    >`
      SELECT key, value, min_value::int AS min, max_value::int AS max, is_public, unit
        FROM remote_config WHERE key = ANY(${Object.keys(expected)})`;
    expect(rows.length).toBe(Object.keys(expected).length);
    for (const row of rows) {
      expect([row.key, row.value, row.min, row.max, row.is_public]).toEqual([
        row.key,
        ...(expected[row.key] ?? []),
      ]);
      expect(row.unit).toBeTruthy();
    }
    const sla = await api<{ key: string; is_public: boolean }[]>`
      SELECT key, is_public FROM remote_config
       WHERE key IN ('contact.safety_sla_minutes.urgent', 'contact.safety_sla_minutes.normal')`;
    expect(sla.length).toBe(2);
    expect(sla.every((row) => row.is_public)).toBe(true);
  });
});
