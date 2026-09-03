-- ============================================================================
-- Proves the database half of "two-way messaging": a message written by A is
-- readable by B, unreadable by anyone else, and unread clears per side.
--
-- The other half — "appears on device B within a second" — is Realtime, and
-- only two signed-in devices can show that. What this settles is the thing the
-- old schema made impossible: that the row exists once and both people can read
-- it. If this passes and a message still does not arrive live, the fault is in
-- the subscription, not the policies.
--
-- Impersonation sets both jwt claim GUCs, for the same reason
-- verify_mutual_match.sql does; step 0 aborts loudly if it did not take.
--
-- Seeds a match and one message, then reads from three seats. The closing
-- exception rolls all of it back; the results arrive as that error's message.
--
-- Run after 26_two_way_messaging.sql.
-- ============================================================================

do $$
declare
  v_a          uuid;
  v_b          uuid;
  v_c          uuid;
  v_low        uuid;
  v_high       uuid;
  v_match      uuid;
  v_message    uuid;
  v_uid        uuid;
  v_count      integer;
  v_from_me    boolean;
  v_refused    boolean;
  v_results    text := '';
begin
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

  v_low  := least(v_a, v_b);
  v_high := greatest(v_a, v_b);

  -- --- seed a match and A's message, as the owner ---------------------------
  insert into public.likes (liker_id, target_id, mode) values (v_a, v_b, 'dating')
    on conflict (liker_id, target_id) do nothing;
  insert into public.likes (liker_id, target_id, mode) values (v_b, v_a, 'dating')
    on conflict (liker_id, target_id) do nothing;
  insert into public.matches (user_a, user_b, mode) values (v_low, v_high, 'dating')
    on conflict (user_a, user_b) do nothing;
  select m.id into v_match from public.matches m where m.user_a = v_low and m.user_b = v_high;

  insert into public.chat_messages (match_id, sender_id, text, kind)
  values (v_match, v_a, 'test-message', 'text')
  returning id into v_message;

  -- --- A: their own message, and it reads as theirs -------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_a, 'role', 'authenticated')::text, true);

  v_uid := auth.uid();
  if v_uid is distinct from v_a then
    raise exception E'IMPERSONATION DID NOT TAKE\n\nauth.uid() = %, expected %.',
      coalesce(v_uid::text, 'null'), v_a;
  end if;
  v_results := v_results || format(E'0. impersonating A        auth.uid() = %s -> PASS\n', v_uid);

  select count(*) into v_count from public.chat_messages c where c.id = v_message;
  select (c.sender_id = auth.uid()) into v_from_me from public.chat_messages c where c.id = v_message;
  v_results := v_results || format(
    E'1. A reads own message               %s row(s), from_me = %s -> %s\n',
    v_count, coalesce(v_from_me::text, 'n/a'),
    case when v_count = 1 and v_from_me then 'PASS' else 'FAIL' end
  );

  -- --- B: the same row, and it reads as the other person's ------------------
  perform set_config('request.jwt.claim.sub', v_b::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_b, 'role', 'authenticated')::text, true);

  select count(*) into v_count from public.chat_messages c where c.id = v_message;
  select (c.sender_id = auth.uid()) into v_from_me from public.chat_messages c where c.id = v_message;
  v_results := v_results || format(
    E'2. B reads A''s message               %s row(s), from_me = %s -> %s\n',
    v_count, coalesce(v_from_me::text, 'n/a'),
    case when v_count = 1 and v_from_me is false then 'PASS'
         else 'FAIL (the thread is still one-sided)' end
  );

  -- B may reply into the same thread, but not sign it as A.
  begin
    insert into public.chat_messages (match_id, sender_id, text, kind)
    values (v_match, v_b, 'test-reply', 'text');
    v_refused := false;
  exception when insufficient_privilege then
    v_refused := true;
  end;
  v_results := v_results || format(
    E'3. B replies in the thread           -> %s\n',
    case when v_refused then 'FAIL (participant cannot reply)' else 'PASS' end
  );

  begin
    insert into public.chat_messages (match_id, sender_id, text, kind)
    values (v_match, v_a, 'forged', 'text');
    v_refused := false;
  exception when insufficient_privilege then
    v_refused := true;
  end;
  v_results := v_results || format(
    E'4. B writes a message as A           -> %s\n',
    case when v_refused then 'PASS (refused)' else 'FAIL (messages are forgeable)' end
  );

  -- Read state is per side: B marking the thread read says nothing about A.
  insert into public.match_reads (match_id, user_id, last_read_at)
  values (v_match, v_b, now())
  on conflict (match_id, user_id) do update set last_read_at = excluded.last_read_at;

  select count(*) into v_count from public.match_reads r where r.match_id = v_match;
  v_results := v_results || format(
    E'5. B sees read marks                 %s row(s) -> %s\n',
    v_count, case when v_count = 1 then 'PASS (only their own)' else 'FAIL (read state is shared)' end
  );

  -- --- C: none of it -------------------------------------------------------
  if v_c is null then
    v_results := v_results || E'6. C control                         SKIPPED (no third profile)\n';
  else
    perform set_config('request.jwt.claim.sub', v_c::text, true);
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_c, 'role', 'authenticated')::text, true);

    select count(*) into v_count from public.chat_messages c where c.match_id = v_match;
    v_results := v_results || format(
      E'6. C reads the A-B thread            %s row(s) -> %s\n',
      v_count, case when v_count = 0 then 'PASS' else 'FAIL (the thread leaks to outsiders)' end
    );

    begin
      insert into public.chat_messages (match_id, sender_id, text, kind)
      values (v_match, v_c, 'intruder', 'text');
      v_refused := false;
    exception when insufficient_privilege then
      v_refused := true;
    end;
    v_results := v_results || format(
      E'7. C writes into the thread          -> %s\n',
      case when v_refused then 'PASS (refused)' else 'FAIL (outsiders can post)' end
    );
  end if;

  -- --- back to A: their unread is their own --------------------------------
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_a, 'role', 'authenticated')::text, true);

  select count(*) into v_count from public.match_reads r
  where r.match_id = v_match and r.user_id = v_a;
  v_results := v_results || format(
    E'8. B''s read mark reached A           %s row(s) -> %s\n',
    v_count,
    case when v_count = 0 then 'PASS (A is still unread)'
         else 'FAIL (one side reading cleared the other)' end
  );

  raise exception E'\n\n===== RESULTS =====\n\n%\n(rolled back - nothing above was kept)\n', v_results;
end
$$;
