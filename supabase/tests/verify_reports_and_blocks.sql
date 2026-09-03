-- ============================================================================
-- Verification for 21_reports.sql and 22_block_hardening.sql.
--
-- Paste into the Supabase SQL Editor and Run. Safe to run against a live
-- project: every write happens inside a transaction that is deliberately
-- aborted at the end, so nothing survives. The results arrive as the error
-- message — that abort is the cleanup, not a failure.
--
-- Needs at least 4 accounts in auth.users (one target, three reporters). It
-- says so and stops if there are fewer.
--
-- What it proves:
--   1. Three distinct reporters trip the auto-hide.
--   2. One reporter reporting repeatedly does NOT — nobody can hide someone
--      on their own.
--   3. is_blocked_pair answers true from BOTH directions off a single row.
--   4. Blocking clears any like already sitting between the two.
--   5. match_counterpart resolves a thread to the other person.
--
-- Every local is v_-prefixed on purpose: a variable sharing a name with a
-- column (`target_id`) is ambiguous inside an ON CONFLICT clause.
-- ============================================================================

do $$
declare
  v_target       uuid;
  v_reporter_a   uuid;
  v_reporter_b   uuid;
  v_reporter_c   uuid;
  v_user_count   integer;
  v_hidden       timestamptz;
  v_pair_forward boolean;
  v_pair_reverse boolean;
  v_pair_other   boolean;
  v_likes_left   integer;
  v_counterpart  uuid;
  v_match        uuid;
  v_report_count integer;
  v_has_profile  boolean;
  v_results      text := '';
begin
  -- Sourced from `profiles`, not `auth.users`: the auto-hide updates a profile
  -- row, so an auth user left over from a half-finished signup has nothing for
  -- the trigger to hide and would fail the test for the wrong reason.
  select count(*) into v_user_count from public.profiles;

  if v_user_count < 4 then
    raise exception E'NOT ENOUGH PROFILES\n\nFound % profile row(s); this test needs 4.\nFinish signup on a few test accounts and run it again.', v_user_count;
  end if;

  select id into v_target      from public.profiles order by created_at limit 1 offset 0;
  select id into v_reporter_a  from public.profiles order by created_at limit 1 offset 1;
  select id into v_reporter_b  from public.profiles order by created_at limit 1 offset 2;
  select id into v_reporter_c  from public.profiles order by created_at limit 1 offset 3;

  select exists (select 1 from public.profiles p where p.id = v_target) into v_has_profile;
  v_results := v_results || format(
    E'0. target has a profile    %s   -> %s\n',
    v_has_profile,
    case when v_has_profile then 'PASS' else 'FAIL (nothing for the trigger to hide)' end
  );

  -- --- 1. one reporter is not enough ---------------------------------------
  insert into public.reports (reporter_id, target_id, reason, context)
  values (v_reporter_a, v_target, 'harassment', 'chat');

  select p.hidden_at into v_hidden from public.profiles p where p.id = v_target;
  v_results := v_results || format(
    E'1. after 1 reporter        hidden_at = %s   -> %s\n',
    coalesce(v_hidden::text, 'null'),
    case when v_hidden is null then 'PASS (still visible)' else 'FAIL (hidden too early)' end
  );

  -- --- 2. the same person reporting again changes nothing -------------------
  insert into public.reports as r (reporter_id, target_id, reason, context)
  values (v_reporter_a, v_target, 'spam', 'discover')
  on conflict (reporter_id, target_id) do update set reason = excluded.reason;

  select p.hidden_at into v_hidden from public.profiles p where p.id = v_target;
  v_results := v_results || format(
    E'2. same reporter, twice    hidden_at = %s   -> %s\n',
    coalesce(v_hidden::text, 'null'),
    case when v_hidden is null then 'PASS (one person cannot hide anyone)' else 'FAIL' end
  );

  -- --- 3. three distinct reporters trip it ---------------------------------
  insert into public.reports (reporter_id, target_id, reason, context)
  values (v_reporter_b, v_target, 'fakeProfile', 'discover');
  insert into public.reports (reporter_id, target_id, reason, context)
  values (v_reporter_c, v_target, 'underage', 'profile');

  -- Reported alongside the result so a failure names its own cause: too few
  -- rows means the inserts did not land, three rows and no hide means the
  -- trigger is the problem.
  select count(*) into v_report_count from public.reports r where r.target_id = v_target;
  select p.hidden_at into v_hidden from public.profiles p where p.id = v_target;
  v_results := v_results || format(
    E'3. after 3 reporters       %s report row(s), hidden_at = %s   -> %s\n',
    v_report_count,
    coalesce(v_hidden::text, 'null'),
    case
      when v_hidden is not null then 'PASS (auto-hidden)'
      when v_report_count < 3 then 'FAIL (reports did not land)'
      else 'FAIL (3 reports but no hide - check the trigger)'
    end
  );

  -- --- 4. blocks read true from both sides ---------------------------------
  insert into public.blocked_users (profile_id, blocked_user_id, name, photo)
  values (v_reporter_a, v_reporter_b, 'test-block', '');

  v_pair_forward := public.is_blocked_pair(v_reporter_a, v_reporter_b);
  v_pair_reverse := public.is_blocked_pair(v_reporter_b, v_reporter_a);
  v_pair_other   := public.is_blocked_pair(v_reporter_b, v_reporter_c);

  v_results := v_results || format(
    E'4. block A->B, asked A->B  %s   -> %s\n',
    v_pair_forward,
    case when v_pair_forward then 'PASS' else 'FAIL' end
  );
  v_results := v_results || format(
    E'5. block A->B, asked B->A  %s   -> %s\n',
    v_pair_reverse,
    case when v_pair_reverse then 'PASS (enforced both ways)' else 'FAIL (one-directional)' end
  );
  v_results := v_results || format(
    E'6. unrelated pair          %s   -> %s\n',
    v_pair_other,
    case when not v_pair_other then 'PASS' else 'FAIL (blocks everyone)' end
  );

  -- --- 5. blocking clears a like that was already there ---------------------
  insert into public.likes_received (profile_id, liker_id, kind, name, age)
  values (v_reporter_c, v_reporter_a::text, 'dating', 'test-like', 30)
  on conflict (profile_id, liker_id) do nothing;

  insert into public.blocked_users (profile_id, blocked_user_id, name, photo)
  values (v_reporter_c, v_reporter_a, 'test-block-2', '');

  select count(*) into v_likes_left
  from public.likes_received l
  where l.profile_id = v_reporter_c and l.liker_id = v_reporter_a::text;

  v_results := v_results || format(
    E'7. like cleared on block   %s row(s) left   -> %s\n',
    v_likes_left,
    case when v_likes_left = 0 then 'PASS' else 'FAIL (stale like survives the block)' end
  );

  -- --- 6. a thread resolves to the other person ----------------------------
  -- Since 24_matching.sql a match is a paired row, so "a thread with a real
  -- counterpart" is any row the caller is one half of; RLS already limits the
  -- select to those.
  select m.id into v_match from public.matches m limit 1;

  if v_match is null then
    v_results := v_results || E'8. match_counterpart       SKIPPED (this account has no matches yet)\n';
  else
    v_counterpart := public.match_counterpart(v_match);
    v_results := v_results || format(
      E'8. match_counterpart       %s   -> %s\n',
      coalesce(v_counterpart::text, 'null'),
      case when v_counterpart is not null then 'PASS' else 'FAIL' end
    );
  end if;

  -- Aborting is how the test cleans up: every insert above, and the hidden_at
  -- the trigger set, disappears with the transaction.
  raise exception E'\n\n===== RESULTS =====\n\n%\nAll test rows rolled back; nothing was kept.\n', v_results;
end
$$;
