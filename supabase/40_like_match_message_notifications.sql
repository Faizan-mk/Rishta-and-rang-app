-- ============================================================================
-- 40. Likes, matches and messages, said out loud in-app.
--
-- 32_rishta_notifications.sql wired the Rishta handshake into the
-- `notifications` feed and gave `notify_member` its preference-column map —
-- which already listed 'like', 'match' and 'message', because `send-push`
-- (supabase/functions/send-push) has sent the *push* half of all three since
-- day one. What never happened is the in-app half: `like_profile` never
-- called `notify_member`, and nothing wrote a row when a message landed. A
-- member who liked back, matched, or was written to saw nothing in the
-- Notifications tab, and if push failed to reach them (Expo Go, a killed
-- token, permission denied) they saw nothing at all.
--
-- This closes that gap the same way 32 closed it for Rishta: definer
-- functions write the row, because `notifications_insert` (15) is
-- `profile_id = auth.uid()` and a member cannot write to someone else's feed
-- from the client.
--
-- Run after 32_rishta_notifications.sql and 29_entitlements.sql.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The wording — kept word for word in step with `send-push`'s own COPY
--    (supabase/functions/send-push/index.ts), which sends the push half of
--    the same three events. The same sentence should not arrive twice in two
--    wordings.
-- ---------------------------------------------------------------------------

create or replace function public.activity_copy(p_event text, p_language text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case coalesce(p_language, 'en')
    when 'ur' then case p_event
      when 'like'    then 'نے آپ کی پروفائل پسند کی۔'
      when 'match'   then 'آپ کی میچ ہو گئی — سلام کہیے۔'
      when 'message' then 'نے آپ کو پیغام بھیجا۔'
    end
    when 'roman' then case p_event
      when 'like'    then 'ne aap ki profile pasand ki.'
      when 'match'   then 'Aap ki match ho gayi — salaam kahiye.'
      when 'message' then 'ne aap ko paigham bheja.'
    end
    else case p_event
      when 'like'    then 'liked your profile.'
      when 'match'   then 'You matched! Say salaam.'
      when 'message' then 'sent you a message.'
    end
  end;
$$;

revoke all on function public.activity_copy(text, text) from public;
grant execute on function public.activity_copy(text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Like and match — one member's name, in the language the *recipient*
--    reads the app in. Same shape as `notify_rishta`.
-- ---------------------------------------------------------------------------

create or replace function public.notify_activity(
  p_recipient uuid,
  p_about     uuid,
  p_event     text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_lang text;
begin
  select p.full_name into v_name from public.profiles p where p.id = p_about;
  select p.language  into v_lang from public.profiles p where p.id = p_recipient;
  perform public.notify_member(p_recipient, p_event, coalesce(v_name, ''), public.activity_copy(p_event, v_lang));
exception
  -- Called from inside `like_profile`'s own transaction — a notification
  -- that fails to write must never take the like or the match it is
  -- reporting down with it. Same rule pushService.ts's `notify()` states for
  -- the push half ("never throws"), enforced here for the in-app half too.
  when others then
    return;
end;
$$;

revoke all on function public.notify_activity(uuid, uuid, text) from public;
revoke all on function public.notify_activity(uuid, uuid, text) from authenticated;

-- `like_profile` (29_entitlements.sql's version — the daily-cap one, which is
-- what is actually deployed; 27's own body was superseded before this file
-- was written), unchanged apart from the two notify calls: one when a like
-- does not (yet) complete a pair, two when it does — each side is told about
-- the other, off the one write that created the match.
--
-- `create or replace` cannot be used here: this function's return type has
-- not changed since 29 added `likes_left`, but if the database this runs
-- against still has an older (pre-29) `like_profile` sitting in it for any
-- reason, Postgres refuses to change a return type in place. Dropping first
-- is what 29 itself did for the same reason, and makes this re-runnable
-- regardless of which version is currently live.
drop function if exists public.like_profile(uuid, text);

create function public.like_profile(p_target uuid, p_mode text)
returns table (matched boolean, match_id uuid, is_new boolean, likes_left integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_daily_free constant integer := 15;
  v_me         uuid := auth.uid();
  v_low        uuid;
  v_high       uuid;
  v_reciprocal boolean;
  v_match_id   uuid;
  v_created    boolean := false;
  v_unlimited  boolean;
  v_first_time boolean;
  v_today      text := to_char(current_date, 'YYYY-MM-DD');
  v_used       integer := 0;
  v_left       integer;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  if p_target = v_me then
    raise exception 'cannot_like_self';
  end if;
  if public.is_blocked_pair(v_me, p_target) then
    raise exception 'blocked';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_target) then
    raise exception 'no_such_profile';
  end if;

  select coalesce(p.is_explore_plus, false) into v_unlimited
  from public.profiles p where p.id = v_me;

  -- Re-liking someone already liked costs nothing: the row is the same row, and
  -- charging for it would let the count be run up on one person.
  v_first_time := not exists (
    select 1 from public.likes l where l.liker_id = v_me and l.target_id = p_target
  );

  if not v_unlimited then
    -- Read the count whether or not this like is chargeable: `likes_left` has
    -- to be right on a re-like too, and a re-like reports without spending.
    select case when d.date = v_today then d.count else 0 end into v_used
    from public.daily_likes d where d.id = v_me;
    v_used := coalesce(v_used, 0);

    if v_first_time then
      if v_used >= c_daily_free then
        raise exception 'daily_like_limit_reached';
      end if;

      insert into public.daily_likes (id, date, count)
      values (v_me, v_today, v_used + 1)
      on conflict (id) do update set date = v_today, count = v_used + 1;
      v_used := v_used + 1;
    end if;
  end if;

  v_left := case when v_unlimited then -1 else greatest(c_daily_free - v_used, 0) end;

  insert into public.likes (liker_id, target_id, mode)
  values (v_me, p_target, p_mode)
  on conflict (liker_id, target_id) do update set mode = excluded.mode;

  insert into public.likes_received (profile_id, liker_id, kind, name, age, city, photo, created_at)
  select
    p_target,
    v_me::text,
    p_mode,
    p.full_name,
    case
      when p.dob ~ '^\d{4}-\d{2}-\d{2}$'
        then greatest(0, extract(year from age(current_date, p.dob::date))::integer)
      else 0
    end,
    p.city,
    coalesce(p.photos[1], ''),
    now()
  from public.profiles p
  where p.id = v_me
  on conflict (profile_id, liker_id) do update set
    kind = excluded.kind,
    name = excluded.name,
    age = excluded.age,
    city = excluded.city,
    photo = excluded.photo,
    created_at = excluded.created_at;

  select exists (
    select 1 from public.likes l where l.liker_id = p_target and l.target_id = v_me
  ) into v_reciprocal;

  if not v_reciprocal then
    perform public.notify_activity(p_target, v_me, 'like');
    return query select false, null::uuid, false, v_left;
    return;
  end if;

  v_low  := least(v_me, p_target);
  v_high := greatest(v_me, p_target);

  -- A brand-new match always opens in Dating, regardless of which mode
  -- either of them was browsing in when they liked — `p_mode` still
  -- categorises the *like* itself (`likes`/`likes_received.kind`, the
  -- Explore+ card's badge), but Rishta is reached only by the explicit
  -- "Move to Rishta" handshake (`request_rishta`/`respond_rishta`,
  -- 32_rishta_notifications.sql), never by starting there. `on conflict do
  -- nothing` means this only ever applies at the moment a match is created —
  -- an existing match (already moved to Rishta or not) is never touched by
  -- this insert.
  insert into public.matches (user_a, user_b, mode)
  values (v_low, v_high, 'dating')
  on conflict (user_a, user_b) do nothing
  returning id into v_match_id;

  v_created := v_match_id is not null;

  if v_match_id is null then
    select m.id into v_match_id
    from public.matches m
    where m.user_a = v_low and m.user_b = v_high;
  end if;

  if v_created then
    perform public.notify_activity(v_me, p_target, 'match');
    perform public.notify_activity(p_target, v_me, 'match');
  end if;

  return query select true, v_match_id, v_created, v_left;
end;
$$;

revoke all on function public.like_profile(uuid, text) from public;
grant execute on function public.like_profile(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Messages — a trigger, not an RPC: `chat_messages` is written by a plain
--    client insert (26_two_way_messaging.sql's `messages_insert` policy), so
--    there is no single function call to hang this off. The recipient is
--    resolved against `new.sender_id` — the row's own author — rather than
--    `match_counterpart`/`auth.uid()`: a later migration delivers a pending
--    profile note into a fresh match from inside `like_profile`, where the
--    note's original sender and the session's `auth.uid()` are not the same
--    person, and this must still notify the right side.
-- ---------------------------------------------------------------------------

create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient uuid;
  v_name      text;
  v_lang      text;
  v_preview   text;
begin
  select case when m.user_a = new.sender_id then m.user_b else m.user_a end
  into v_recipient
  from public.matches m
  where m.id = new.match_id;

  if v_recipient is null then
    return new;
  end if;

  select p.full_name into v_name from public.profiles p where p.id = new.sender_id;
  select p.language  into v_lang from public.profiles p where p.id = v_recipient;

  -- Their own words when there are any — a photo or a voice note has none, so
  -- it falls back to the fixed line, same as `send-push`'s own preview rule.
  v_preview := btrim(coalesce(new.text, ''));
  if new.kind = 'text' and v_preview <> '' then
    if char_length(v_preview) > 140 then
      v_preview := left(v_preview, 139) || '…';
    end if;
  else
    v_preview := public.activity_copy('message', v_lang);
  end if;

  perform public.notify_member(v_recipient, 'message', coalesce(v_name, ''), v_preview);
  return new;
exception
  -- This trigger fires *inside* the message's own insert transaction. Any
  -- unhandled error here would roll that insert back — the message would
  -- silently never send, which is worse than the notification never firing.
  when others then
    return new;
end;
$$;

drop trigger if exists chat_messages_notify_after_insert on public.chat_messages;
create trigger chat_messages_notify_after_insert
  after insert on public.chat_messages
  for each row execute function public.notify_new_message();
