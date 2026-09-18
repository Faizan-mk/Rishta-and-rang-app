-- ============================================================================
-- 41. Profile notes — the "Send salaam" box a full profile ends with
-- (src/components/discover/ProfileActionsFooter.tsx), made real.
--
-- The client (HomeScreen's `onSendCompliment`) was a stub: it waited half a
-- second and showed a local "Compliment sent" toast, but never wrote
-- anything anywhere. Its own copy already states the intended contract —
-- `discover.complimentSentBody`: "{name} will see your message if you
-- match." — which is a deliberate anti-spam rule: a stranger cannot land a
-- message in someone's chat before that someone has actually matched with
-- them, the same rule `messages_insert` (26_two_way_messaging.sql) already
-- enforces for ordinary messages (it requires an existing `matches` row).
--
-- So a note sent before a match is held here, not in `chat_messages`. If a
-- match later forms, `like_profile` delivers every pending note between the
-- new pair into the fresh thread as the conversation's opening messages, in
-- the order they were written, then clears them. Delivering them as ordinary
-- `chat_messages` rows means `notify_new_message` (40) fires on each one
-- exactly as it would for any other message — the note's reader gets the
-- same in-app/push notification a message they received after matching
-- would get, no special case needed. A note that is never matched on is
-- never delivered and never seen, which is the whole point of holding it
-- here instead of in the thread table.
--
-- Run after 40_like_match_message_notifications.sql.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The pending note
-- ---------------------------------------------------------------------------

create table if not exists public.profile_notes (
  id          uuid primary key default gen_random_uuid(),
  sender_id   uuid not null references auth.users (id) on delete cascade,
  target_id   uuid not null references auth.users (id) on delete cascade,
  text        text not null,
  created_at  timestamptz not null default now(),
  constraint profile_notes_not_self check (sender_id <> target_id),
  -- Sending again replaces the pending note rather than stacking a queue of
  -- them — the box only ever holds the one thing to say before a match.
  unique (sender_id, target_id)
);

create index if not exists profile_notes_target_id_idx on public.profile_notes (target_id);

alter table public.profile_notes enable row level security;

-- No select policy at all, in either direction — deliberately, the same as
-- `likes` withholding the outgoing side (24_matching.sql): the sender does
-- not need to read it back (the RPC below upserts blind, same as
-- `like_profile`), and the target must not be able to tell a note is sitting
-- there before the match that is supposed to reveal it.
drop policy if exists "profile_notes_insert" on public.profile_notes;
create policy "profile_notes_insert" on public.profile_notes
  for insert to authenticated with check (
    sender_id = auth.uid()
    and not public.is_blocked_pair(auth.uid(), target_id)
  );

grant all on public.profile_notes to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Writing one — validation lives here rather than in the policy so the
--    length cap and the trim are enforced the same way regardless of what a
--    future client sends.
-- ---------------------------------------------------------------------------

create or replace function public.send_profile_note(p_target uuid, p_text text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me   uuid := auth.uid();
  v_text text := btrim(coalesce(p_text, ''));
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  if p_target = v_me then
    raise exception 'cannot_note_self';
  end if;
  if v_text = '' then
    raise exception 'empty_note';
  end if;
  if public.is_blocked_pair(v_me, p_target) then
    raise exception 'blocked';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_target) then
    raise exception 'no_such_profile';
  end if;

  -- Matches ProfileActionsFooter's own COMPLIMENT_MAX_LENGTH (200) — trimmed
  -- rather than rejected, since the client already stops someone typing past
  -- it and a hard error here would only be reachable by going around it.
  if char_length(v_text) > 200 then
    v_text := left(v_text, 200);
  end if;

  insert into public.profile_notes (sender_id, target_id, text)
  values (v_me, p_target, v_text)
  on conflict (sender_id, target_id) do update set text = excluded.text, created_at = now();
end;
$$;

revoke all on function public.send_profile_note(uuid, text) from public;
grant execute on function public.send_profile_note(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Delivery — `like_profile` (29_entitlements.sql's daily-cap version,
--    redefined in 40 to add the notify calls), unchanged apart from this:
--    right after a match is created, any note either side wrote to the other
--    becomes that thread's opening message(s). Return type is unchanged from
--    40, so `create or replace` is fine here.
-- ---------------------------------------------------------------------------

create or replace function public.like_profile(p_target uuid, p_mode text)
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
  v_note       public.profile_notes%rowtype;
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

  v_first_time := not exists (
    select 1 from public.likes l where l.liker_id = v_me and l.target_id = p_target
  );

  if not v_unlimited then
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

  -- Always opens in Dating — see the matching comment in 40. `p_mode` still
  -- categorises the like itself, not the match it produces.
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

    -- Whatever either of them wrote before this moment, oldest first, so a
    -- note sent days ago does not jump ahead of one sent an hour ago.
    for v_note in
      select * from public.profile_notes n
      where (n.sender_id = v_me and n.target_id = p_target)
         or (n.sender_id = p_target and n.target_id = v_me)
      order by n.created_at asc
    loop
      insert into public.chat_messages (match_id, sender_id, text, kind, sent_at)
      values (v_match_id, v_note.sender_id, v_note.text, 'text', v_note.created_at);
    end loop;

    delete from public.profile_notes n
    where (n.sender_id = v_me and n.target_id = p_target)
       or (n.sender_id = p_target and n.target_id = v_me);
  end if;

  return query select true, v_match_id, v_created, v_left;
end;
$$;

revoke all on function public.like_profile(uuid, text) from public;
grant execute on function public.like_profile(uuid, text) to authenticated;
