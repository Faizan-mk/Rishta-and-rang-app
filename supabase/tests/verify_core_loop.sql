-- ============================================================================
-- The whole core loop, in one transaction, between two real accounts.
--
-- The individual verify_*.sql scripts each prove one piece. This walks the
-- journey the smoke test walks — match → chat both ways → per-side unread →
-- Move to Rishta → report → block — in order, so the pieces are measured
-- against each other rather than one at a time. It is the data half of
-- docs/smoke-test.md: everything here is what the two devices should be showing
-- while it runs.
--
-- Everything is done through the same RPCs and policies the app uses, with the
-- two members impersonated (`role` + both jwt claim GUCs, what PostgREST sets
-- per request), so nothing here is measured from a seat the app never sits in.
-- Nothing is inserted directly that the app would obtain by calling something.
--
-- SAFE ON A LIVE PROJECT: the closing `raise exception` rolls the whole thing
-- back, results included — they arrive as that error's message. Two caveats
-- worth knowing before running it against production data:
--
--   · It picks the two lowest-id profiles as A and B. If those are real
--     members, their real rows are what it edits and then rolls back.
--   · It edits A's rishta profile and both members' notification prefs, so the
--     gate and the prefs check are measured deliberately rather than tripped
--     over. Rolled back with everything else.
--
-- Run after 32_rishta_notifications.sql.
-- ============================================================================

do $$
declare
  v_a         uuid;
  v_b         uuid;
  v_c         uuid;
  v_match     uuid;
  v_match2    uuid;
  v_role      text;
  v_uid       uuid;
  v_by        uuid;
  v_answered  uuid;
  v_mode      text;
  v_outcome   text;
  v_matched   boolean;
  v_is_new    boolean;
  v_count     integer;
  v_notif_a   integer;
  v_notif_b   integer;
  v_refused   boolean;
  v_a_unread  boolean;
  v_b_unread  boolean;
  v_results   text := '';
begin
  -- The seat this script started from, so the report row (which no member may
  -- read back, by design) can be counted at the end.
  v_role := coalesce(current_setting('role', true), 'none');

  select p.id into v_a from public.profiles p where p.hidden_at is null order by p.id limit 1;
  select p.id into v_b from public.profiles p
    where p.hidden_at is null and p.id <> v_a and not public.is_blocked_pair(v_a, p.id)
    order by p.id limit 1;
  select p.id into v_c from public.profiles p
    where p.hidden_at is null and p.id not in (v_a, v_b)
    order by p.id limit 1;

  if v_b is null then
    raise exception E'NEED AT LEAST TWO UNBLOCKED PROFILES\n\nCreate a second test account, then run this again.';
  end if;

  -- A clean slate for this pair only: whatever they already have between them
  -- would otherwise decide steps 1 and 2 for us.
  delete from public.matches where user_a = least(v_a, v_b) and user_b = greatest(v_a, v_b);
  delete from public.likes where (liker_id = v_a and target_id = v_b) or (liker_id = v_b and target_id = v_a);
  delete from public.blocked_users
   where (profile_id = v_a and blocked_user_id = v_b) or (profile_id = v_b and blocked_user_id = v_a);
  delete from public.reports where reporter_id = v_a and target_id = v_b;

  -- Both members want to hear about rishta requests, so step 7 measures the
  -- notification and not somebody's muted preference.
  insert into public.notification_prefs (id, rishta_requests) values (v_a, true), (v_b, true)
    on conflict (id) do update set rishta_requests = true;

  -- ==========================================================================
  -- 1. Two accounts, and a match that forms out of two likes
  -- ==========================================================================

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_a, 'role', 'authenticated')::text, true);

  v_uid := auth.uid();
  if v_uid is distinct from v_a then
    raise exception E'IMPERSONATION DID NOT TAKE\n\nauth.uid() = %, expected %.',
      coalesce(v_uid::text, 'null'), v_a;
  end if;
  v_results := v_results || format(E'0.  impersonating A            auth.uid() = %s -> PASS\n', v_uid);

  select l.matched, l.match_id, l.is_new into v_matched, v_match, v_is_new
  from public.like_profile(v_b, 'dating') l;
  v_results := v_results || format(
    E'1.  A likes B                  matched = %s -> %s\n',
    v_matched, case when not v_matched then 'PASS (one-sided, no conversation yet)' else 'FAIL' end
  );

  perform set_config('request.jwt.claim.sub', v_b::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_b, 'role', 'authenticated')::text, true);

  select l.matched, l.match_id, l.is_new into v_matched, v_match, v_is_new
  from public.like_profile(v_a, 'dating') l;
  v_results := v_results || format(
    E'2.  B likes back               matched = %s, is_new = %s -> %s\n',
    v_matched, v_is_new,
    case when v_matched and v_is_new and v_match is not null
         then 'PASS (the pair has a conversation)' else 'FAIL' end
  );

  -- The same row from A's side. One id, or the two of them are not in the same
  -- conversation at all.
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  select m.id into v_match2 from public.matches m where m.id = v_match;
  v_results := v_results || format(
    E'3.  A reads the same match     id = %s -> %s\n',
    coalesce(v_match2::text, 'null'),
    case when v_match2 = v_match then 'PASS (one row, both sides)' else 'FAIL' end
  );

  -- ==========================================================================
  -- 2. Messages, both directions
  -- ==========================================================================

  insert into public.chat_messages (match_id, sender_id, text, kind)
  values (v_match, v_a, 'core-loop: from A', 'text');

  perform set_config('request.jwt.claim.sub', v_b::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_b, 'role', 'authenticated')::text, true);

  insert into public.chat_messages (match_id, sender_id, text, kind)
  values (v_match, v_b, 'core-loop: from B', 'text');

  select count(*) into v_count from public.chat_messages c where c.match_id = v_match;
  v_results := v_results || format(
    E'4.  B reads the thread         %s message(s) -> %s\n',
    v_count, case when v_count = 2 then 'PASS (both halves)' else 'FAIL' end
  );

  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  select count(*) into v_count from public.chat_messages c where c.match_id = v_match;
  v_results := v_results || format(
    E'5.  A reads the thread         %s message(s) -> %s\n',
    v_count, case when v_count = 2 then 'PASS (both halves)' else 'FAIL' end
  );

  if v_c is not null then
    perform set_config('request.jwt.claim.sub', v_c::text, true);
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_c, 'role', 'authenticated')::text, true);
    select count(*) into v_count from public.chat_messages c where c.match_id = v_match;
    v_results := v_results || format(
      E'6.  a third member reads it   %s message(s) -> %s\n',
      v_count, case when v_count = 0 then 'PASS (not their conversation)' else 'FAIL (thread is readable by a stranger)' end
    );
  else
    v_results := v_results || E'6.  a third member reads it   SKIPPED (only two profiles exist)\n';
  end if;

  -- --- unread is per side ---------------------------------------------------
  -- A opens the thread. B's copy of "unread" must not move, which is the thing
  -- a preview column on the shared row could never get right.
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_a, 'role', 'authenticated')::text, true);

  insert into public.match_reads (match_id, user_id, last_read_at)
  values (v_match, v_a, now())
  on conflict (match_id, user_id) do update set last_read_at = now();

  -- "Unread" as the app computes it: their last message, after my last read.
  select exists (
    select 1 from public.chat_messages c
    where c.match_id = v_match and c.sender_id <> v_a
      and c.sent_at > coalesce((select r.last_read_at from public.match_reads r
                                where r.match_id = v_match and r.user_id = v_a), 'epoch')
  ) into v_a_unread;

  perform set_config('request.jwt.claim.sub', v_b::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
  select exists (
    select 1 from public.chat_messages c
    where c.match_id = v_match and c.sender_id <> v_b
      and c.sent_at > coalesce((select r.last_read_at from public.match_reads r
                                where r.match_id = v_match and r.user_id = v_b), 'epoch')
  ) into v_b_unread;

  v_results := v_results || format(
    E'7.  A opens it, B does not     A unread = %s, B unread = %s -> %s\n',
    v_a_unread, v_b_unread,
    case when not v_a_unread and v_b_unread then 'PASS (per side)' else 'FAIL' end
  );

  -- ==========================================================================
  -- 3. Move to Rishta
  -- ==========================================================================

  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_a, 'role', 'authenticated')::text, true);

  -- A member owns their own card, so both edits below are the writes the app
  -- makes when they edit their profile — no role change needed for either.
  update public.profiles
  set rishta_religion = '', rishta_education = '', rishta_family_background = '', rishta_readiness = 'browsing'
  where id = v_a;

  begin
    perform public.request_rishta(v_match);
    v_refused := false;
  exception when others then
    v_refused := sqlerrm like '%rishta_profile_incomplete%';
  end;
  v_results := v_results || format(
    E'8.  A asks, rishta half empty  -> %s\n',
    case when v_refused then 'PASS (refused)' else 'FAIL (the gate is not enforced)' end
  );

  update public.profiles
  set rishta_religion = 'test', rishta_education = 'test',
      rishta_family_background = 'test', rishta_readiness = 'ready_now'
  where id = v_a;

  perform public.request_rishta(v_match);
  select m.rishta_requested_by into v_by from public.matches m where m.id = v_match;
  select count(*) into v_notif_a from public.notifications n where n.profile_id = v_a;
  v_results := v_results || format(
    E'9.  A asks, filled in          requested_by = %s -> %s\n',
    coalesce(v_by::text, 'null'), case when v_by = v_a then 'PASS' else 'FAIL' end
  );

  -- B sees the pending request off the same row, and has been told about it.
  perform set_config('request.jwt.claim.sub', v_b::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_b, 'role', 'authenticated')::text, true);

  select m.rishta_requested_by into v_by from public.matches m where m.id = v_match;
  select count(*) into v_notif_b from public.notifications n
   where n.profile_id = v_b and n.type = 'rishta_request';
  v_results := v_results || format(
    E'10. B sees it pending          requested_by = %s, notifications = %s -> %s\n',
    coalesce(v_by::text, 'null'), v_notif_b,
    case when v_by = v_a and v_notif_b > 0 then 'PASS (same row, and B was told)'
         when v_by = v_a then 'FAIL (B sees it but was never notified)'
         else 'FAIL' end
  );

  select public.respond_rishta(v_match, true) into v_outcome;
  select m.mode, m.rishta_requested_by, m.rishta_answered_by
    into v_mode, v_by, v_answered
  from public.matches m where m.id = v_match;
  v_results := v_results || format(
    E'11. B accepts                  mode = %s, pending = %s, answered_by = %s -> %s\n',
    v_mode, coalesce(v_by::text, 'null'), coalesce(v_answered::text, 'null'),
    case when v_outcome = 'accepted' and v_mode = 'rishta' and v_by is null and v_answered = v_b
         then 'PASS'
         when v_outcome = 'accepted' and v_mode = 'rishta' and v_by is null
         then 'FAIL (the row does not record who answered, so a push cannot be attributed)'
         else 'FAIL' end
  );

  select count(*) into v_count from public.notifications n
   where n.profile_id = v_b and n.type = 'rishta_request';
  v_results := v_results || format(
    E'12. B was notified too         %s row(s), was %s -> %s\n',
    v_count, v_notif_b, case when v_count > v_notif_b then 'PASS' else 'FAIL (only one side heard)' end
  );

  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_a, 'role', 'authenticated')::text, true);

  select m.mode into v_mode from public.matches m where m.id = v_match;
  select count(*) into v_count from public.notifications n where n.profile_id = v_a;
  v_results := v_results || format(
    E'13. A is in rishta as well     mode = %s, notifications = %s (was %s) -> %s\n',
    v_mode, v_count, v_notif_a,
    case when v_mode = 'rishta' and v_count > v_notif_a then 'PASS (both sides moved, both told)'
         when v_mode = 'rishta' then 'FAIL (A moved but was never told)'
         else 'FAIL' end
  );

  -- ==========================================================================
  -- 4. Report
  -- ==========================================================================

  insert into public.reports (reporter_id, target_id, reason, details, context)
  values (v_a, v_b, 'harassment', 'core-loop test', 'chat');

  -- Counted from the seat this script started in: `reports` has no select
  -- policy at all, so not even the reporter may read their own row back.
  perform set_config('role', v_role, true);
  select count(*) into v_count from public.reports r
   where r.reporter_id = v_a and r.target_id = v_b;
  v_results := v_results || format(
    E'14. A reports B                %s row(s) in reports -> %s\n',
    v_count, case when v_count = 1 then 'PASS' else 'FAIL' end
  );

  -- ==========================================================================
  -- 5. Block
  -- ==========================================================================

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_b::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_b, 'role', 'authenticated')::text, true);

  -- `source_profile_id` is the older text column the app still writes beside
  -- the uuid one; it is cast here for the same reason (supabase/22_block_hardening.sql).
  insert into public.blocked_users (profile_id, blocked_user_id, source_profile_id, name, photo)
  values (v_b, v_a, v_a::text, 'core-loop', '');

  select count(*) into v_count from public.matches m where m.id = v_match;
  v_results := v_results || format(
    E'15. B blocks A                 match rows left = %s -> %s\n',
    v_count, case when v_count = 0 then 'PASS (the conversation is gone for both)' else 'FAIL' end
  );

  select count(*) into v_count from public.profiles p where p.id = v_a;
  v_results := v_results || format(
    E'16. B looks for A              %s profile row(s) -> %s\n',
    v_count, case when v_count = 0 then 'PASS' else 'FAIL (blocked member still visible)' end
  );

  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_a, 'role', 'authenticated')::text, true);

  select count(*) into v_count from public.profiles p where p.id = v_b;
  v_results := v_results || format(
    E'17. A looks for B              %s profile row(s) -> %s\n',
    v_count, case when v_count = 0 then 'PASS (blocked both ways)'
                  else 'FAIL (the person who was blocked can still see the blocker)' end
  );

  -- A cannot start it up again either: the like is refused, so no second match
  -- can form behind the block.
  begin
    perform public.like_profile(v_b, 'dating');
    v_refused := false;
  exception when others then
    v_refused := sqlerrm like '%blocked%';
  end;
  v_results := v_results || format(
    E'18. A likes B again            -> %s\n',
    case when v_refused then 'PASS (refused)' else 'FAIL (a block can be liked through)' end
  );

  raise exception E'\n\n===== CORE LOOP =====\n\nA = %\nB = %\n\n%\n(rolled back - nothing above was kept)\n',
    v_a, v_b, v_results;
end
$$;
