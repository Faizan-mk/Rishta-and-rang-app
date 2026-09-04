-- ============================================================================
-- Proves the half of "turning the pref off actually stops it" that does not
-- need a phone: a muted category writes no notification, an unmuted one does,
-- and muting never breaks the thing being notified about.
--
-- That last point is the one worth stating. A gate on the wrong side of the
-- write would mean a member who dislikes notifications also stops receiving
-- rishta requests — the request must still land on the row and still show up in
-- their chat; only the telling is suppressed.
--
-- This covers the in-app path (`notify_member`, supabase/32_rishta_notifications.sql).
-- The push path has the same gate written twice over — `PREF_COLUMN` in
-- supabase/functions/send-push/index.ts, with the same "no prefs row means the
-- table's defaults" fallback — and can only be measured with a real device;
-- docs/smoke-test.md says how.
--
-- SAFE ON A LIVE PROJECT: rolled back by the closing exception, including the
-- edits to A's rishta profile and B's notification prefs.
--
-- Run after 32_rishta_notifications.sql.
-- ============================================================================

do $$
declare
  v_a       uuid;
  v_b       uuid;
  v_match   uuid;
  v_role    text;
  v_before  integer;
  v_muted   integer;
  v_after   integer;
  v_by      uuid;
  v_results text := '';
begin
  v_role := coalesce(current_setting('role', true), 'none');

  select p.id into v_a from public.profiles p where p.hidden_at is null order by p.id limit 1;
  select p.id into v_b from public.profiles p
    where p.hidden_at is null and p.id <> v_a and not public.is_blocked_pair(v_a, p.id)
    order by p.id limit 1;

  if v_b is null then
    raise exception E'NEED AT LEAST TWO UNBLOCKED PROFILES\n\nCreate a second test account, then run this again.';
  end if;

  -- A conversation to ask inside of, and a filled-in rishta profile so the gate
  -- being measured here is the notification one and not 28's request gate.
  insert into public.likes (liker_id, target_id, mode) values (v_a, v_b, 'dating')
    on conflict (liker_id, target_id) do nothing;
  insert into public.likes (liker_id, target_id, mode) values (v_b, v_a, 'dating')
    on conflict (liker_id, target_id) do nothing;
  insert into public.matches (user_a, user_b, mode)
  values (least(v_a, v_b), greatest(v_a, v_b), 'dating')
  on conflict (user_a, user_b) do update set mode = 'dating';
  select m.id into v_match from public.matches m
  where m.user_a = least(v_a, v_b) and m.user_b = greatest(v_a, v_b);

  update public.matches
  set rishta_requested_by = null, rishta_requested_at = null
  where id = v_match;

  update public.profiles
  set rishta_religion = 'test', rishta_education = 'test',
      rishta_family_background = 'test', rishta_readiness = 'ready_now'
  where id = v_a;

  -- Counted from the seat this script started in throughout, so the two counts
  -- are read the same way and the comparison means something.
  select count(*) into v_before from public.notifications n
   where n.profile_id = v_b and n.type = 'rishta_request';

  -- --- B turns rishta requests off ------------------------------------------
  insert into public.notification_prefs (id, rishta_requests) values (v_b, false)
    on conflict (id) do update set rishta_requests = false;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_a, 'role', 'authenticated')::text, true);

  if auth.uid() is distinct from v_a then
    raise exception E'IMPERSONATION DID NOT TAKE\n\nauth.uid() = %, expected %.',
      coalesce(auth.uid()::text, 'null'), v_a;
  end if;

  perform public.request_rishta(v_match);

  perform set_config('role', v_role, true);
  select count(*) into v_muted from public.notifications n
   where n.profile_id = v_b and n.type = 'rishta_request';
  select m.rishta_requested_by into v_by from public.matches m where m.id = v_match;

  v_results := v_results || format(
    E'1. B muted, A asks         notifications %s -> %s -> %s\n',
    v_before, v_muted,
    case when v_muted = v_before then 'PASS (nothing written)' else 'FAIL (the pref is ignored)' end
  );
  v_results := v_results || format(
    E'2. ...and the request still landed   requested_by = %s -> %s\n',
    coalesce(v_by::text, 'null'),
    case when v_by = v_a then 'PASS (muted the telling, not the feature)'
         else 'FAIL (muting notifications broke the request itself)' end
  );

  -- --- B turns them back on --------------------------------------------------
  update public.notification_prefs set rishta_requests = true where id = v_b;
  update public.matches
  set rishta_requested_by = null, rishta_requested_at = null
  where id = v_match;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_a, 'role', 'authenticated')::text, true);

  perform public.request_rishta(v_match);

  perform set_config('role', v_role, true);
  select count(*) into v_after from public.notifications n
   where n.profile_id = v_b and n.type = 'rishta_request';

  v_results := v_results || format(
    E'3. B unmuted, A asks       notifications %s -> %s -> %s\n',
    v_muted, v_after,
    case when v_after = v_muted + 1 then 'PASS (written once)'
         when v_after > v_muted then 'FAIL (written more than once)'
         else 'FAIL (nothing written even with the pref on)' end
  );

  -- --- and a member with no prefs row at all --------------------------------
  -- The table's defaults are the answer then, which is the fallback both the
  -- function and the Edge Function have to agree on: everything on except
  -- product updates.
  delete from public.notification_prefs where id = v_b;
  update public.matches
  set rishta_requested_by = null, rishta_requested_at = null
  where id = v_match;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_a, 'role', 'authenticated')::text, true);

  perform public.request_rishta(v_match);

  perform set_config('role', v_role, true);
  select count(*) into v_before from public.notifications n
   where n.profile_id = v_b and n.type = 'rishta_request';

  v_results := v_results || format(
    E'4. B has no prefs row      notifications %s -> %s -> %s\n',
    v_after, v_before,
    case when v_before = v_after + 1 then 'PASS (defaults to on, as the table does)'
         else 'FAIL (a member who never opened Settings hears nothing)' end
  );

  raise exception E'\n\n===== NOTIFICATION PREFS =====\n\nA = %\nB = %\n\n%\n(rolled back - nothing above was kept)\n',
    v_a, v_b, v_results;
end
$$;
