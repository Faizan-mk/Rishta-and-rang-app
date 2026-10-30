-- ============================================================================
-- 70. Closing the holes a review found in 61, 62, 68 and 69.
--
--  1. "Who liked you" was locked only in the app. likes_received still
--     returned every liker's name and photo, and a locked like notification
--     still carried the liker's id. Now:
--       · likes_received only returns likers the member may see (Explore+, or
--         one of their three trials); locked_likes_count() gives the rest as a
--         number for the "N people liked you" card
--       · a locked like notification keeps the liker in hidden_about, a column
--         members can't read, instead of related_id. Upgrading moves them back.
--  2. (Not here.) The raw photos / video_intro_url columns stay readable: a
--     column-level revoke breaks visible_photos(), which takes the whole row,
--     and the signup upsert. Hiding them for real means moving photos into
--     their own table.
--  3. has_connection / profile_visible_to could be called with any two ids and
--     told who had liked or matched whom. has_connection is no longer callable
--     by members; profile_visible_to only answers for the caller.
--  4. A deactivated liker stayed in "who liked you": the check ran under the
--     viewer's RLS, which already hid the row. Now a definer helper.
--  5. Any heartbeat (a second device still signed in) brought a deactivated
--     profile back. Coming back is now reactivate_account(), called on an
--     actual sign-in.
--  6. Cancelling a rishta request found the notification by the asker's name
--     (wrong after a rename); it now uses the match id 64 stores.
--
-- Run after 69_deactivate_account.sql. Safe to run more than once.
-- ============================================================================

-- 1 ---------------------------------------------------------------------------

-- A column-level revoke does nothing while the table-level SELECT grant
-- stands, so: take SELECT off the table, then give back every column but
-- the ones named. New columns added later need their own grant.
create or replace function public.select_all_columns_except(p_table text, p_except text[])
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_cols text;
begin
  select string_agg(quote_ident(c.column_name), ', ')
    into v_cols
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = p_table and c.column_name <> all (p_except);
  execute format('revoke select on public.%I from authenticated, anon', p_table);
  execute format('grant select (%s) on public.%I to authenticated', v_cols, p_table);
end;
$$;
revoke all on function public.select_all_columns_except(text, text[]) from public, anon, authenticated;

alter table public.notifications add column if not exists hidden_about uuid
  references auth.users (id) on delete cascade;
select public.select_all_columns_except('notifications', array['hidden_about']);

create or replace function public.can_see_liker(p_viewer uuid, p_liker uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce((select p.is_explore_plus from public.profiles p where p.id = p_viewer), false)
    or exists (select 1 from public.like_reveals r where r.viewer_id = p_viewer and r.liker_id = p_liker);
$$;
revoke all on function public.can_see_liker(uuid, uuid) from public, anon, authenticated;

create or replace function public.is_deactivated(p_user uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce((select p.deactivated_until > now() from public.profiles p where p.id = p_user), false);
$$;
grant execute on function public.is_deactivated(uuid) to authenticated;

-- A thin wrapper the policy can call: it only ever answers for the caller.
create or replace function public.i_can_see_liker(p_liker text)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select public.can_see_liker(auth.uid(), p_liker::uuid);
$$;
grant execute on function public.i_can_see_liker(text) to authenticated;

drop policy if exists "likes_received_select" on public.likes_received;
create policy "likes_received_select" on public.likes_received
  for select to authenticated
  using (
    profile_id = auth.uid()
    and not public.is_deactivated(liker_id::uuid)
    and public.i_can_see_liker(liker_id)
  );

-- How many likers the caller can't see yet (0 for Explore+).
create or replace function public.locked_likes_count()
returns integer
language sql
security definer
stable
set search_path = ''
as $$
  select count(*)::integer
  from public.likes_received r
  where r.profile_id = auth.uid()
    and not public.is_deactivated(r.liker_id::uuid)
    and not public.can_see_liker(auth.uid(), r.liker_id::uuid);
$$;
revoke all on function public.locked_likes_count() from public, anon;
grant execute on function public.locked_likes_count() to authenticated;

-- notify_activity as in 61, with a locked like's liker in hidden_about.
create or replace function public.notify_activity(
  p_recipient uuid,
  p_about     uuid,
  p_event     text,
  p_kind      text default 'dating'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name   text;
  v_lang   text;
  v_plus   boolean;
  v_locked boolean := false;
begin
  select p.full_name into v_name from public.profiles p where p.id = p_about;
  select p.language, coalesce(p.is_explore_plus, false) into v_lang, v_plus
    from public.profiles p where p.id = p_recipient;
  if p_event = 'like'
     and not v_plus
     and not exists (select 1 from public.like_reveals r where r.viewer_id = p_recipient and r.liker_id = p_about) then
    if (select count(*) from public.like_reveals r where r.viewer_id = p_recipient) < public.free_like_reveals() then
      insert into public.like_reveals (viewer_id, liker_id) values (p_recipient, p_about)
        on conflict do nothing;
    else
      v_name := public.someone_word(v_lang);
      v_locked := true;
    end if;
  end if;
  perform public.notify_member(
    p_recipient,
    p_event,
    coalesce(v_name, ''),
    public.activity_copy(p_event, v_lang),
    null,
    case when v_locked then null else p_about end,
    p_kind
  );
  if v_locked then
    -- notify_member just wrote the row; mark whom it's about, out of sight.
    update public.notifications n
    set hidden_about = p_about
    where n.id = (
      select n2.id from public.notifications n2
      where n2.profile_id = p_recipient and n2.type = 'like' and n2.related_id is null and n2.hidden_about is null
      order by n2.created_at desc limit 1
    );
  end if;
exception
  when others then
    return;
end;
$$;
revoke all on function public.notify_activity(uuid, uuid, text, text) from public;

-- Locked notifications already written: move the id out of sight.
update public.notifications n
set hidden_about = n.related_id, related_id = null
from public.profiles p
where p.id = n.profile_id
  and n.type = 'like'
  and n.related_id is not null
  and not coalesce(p.is_explore_plus, false)
  -- a like received (not the member's own "interest sent")
  and exists (select 1 from public.likes l where l.liker_id = n.related_id and l.target_id = n.profile_id)
  and not exists (select 1 from public.like_reveals r where r.viewer_id = n.profile_id and r.liker_id = n.related_id);

-- Upgrading reveals them: name and id back on the notification.
create or replace function public.reveal_hidden_likes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_explore_plus and not coalesce(old.is_explore_plus, false) then
    update public.notifications n
    set related_id = n.hidden_about,
        hidden_about = null,
        title = coalesce((select p.full_name from public.profiles p where p.id = n.hidden_about), n.title)
    where n.profile_id = new.id and n.hidden_about is not null;
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_reveal_hidden_likes on public.profiles;
create trigger profiles_reveal_hidden_likes
  after update of is_explore_plus on public.profiles
  for each row execute function public.reveal_hidden_likes();

-- Taking a like back also finds a locked notification about it.
create or replace function public.withdraw_like(p_target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  if exists (
    select 1 from public.matches m
    where (m.user_a = v_me and m.user_b = p_target)
       or (m.user_a = p_target and m.user_b = v_me)
  ) then
    raise exception 'already_matched';
  end if;

  delete from public.likes l where l.liker_id = v_me and l.target_id = p_target;
  delete from public.likes_received r where r.profile_id = p_target and r.liker_id = v_me::text;
  delete from public.notifications n
  where (n.profile_id = p_target and n.type = 'like' and (n.related_id = v_me or n.hidden_about = v_me))
     or (n.profile_id = v_me and n.type = 'like' and n.related_id = p_target);
  delete from public.like_reveals r where r.viewer_id = p_target and r.liker_id = v_me;
end;
$$;
revoke all on function public.withdraw_like(uuid) from public, anon;
grant execute on function public.withdraw_like(uuid) to authenticated;


-- 3 ---------------------------------------------------------------------------

revoke all on function public.has_connection(uuid, uuid) from public, anon, authenticated;

create or replace function public.profile_visible_to(p_profile uuid, p_viewer uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select p_viewer = auth.uid() and (
    p_profile = p_viewer
    or case
      when coalesce((select p.deactivated_until > now() from public.profiles p where p.id = p_profile), false)
        then exists (
          select 1 from public.matches m
          where (m.user_a = p_profile and m.user_b = p_viewer) or (m.user_a = p_viewer and m.user_b = p_profile)
        )
      else coalesce((select pp.profile_visible from public.privacy_prefs pp where pp.id = p_profile), true)
        or public.has_connection(p_profile, p_viewer)
    end
  );
$$;

-- 5 ---------------------------------------------------------------------------

create or replace function public.reactivate_account()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles set deactivated_until = null
  where id = auth.uid() and deactivated_until is not null;
$$;
revoke all on function public.reactivate_account() from public, anon;
grant execute on function public.reactivate_account() to authenticated;

-- The heartbeat no longer reactivates (63's version, unchanged otherwise).
create or replace function public.touch_last_active()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    return;
  end if;
  perform public.mark_delivered_for(v_me);
  if not public.shows_online_status(v_me) then
    return;
  end if;
  -- A deactivated member's other devices don't put them back "online".
  if public.is_deactivated(v_me) then
    return;
  end if;
  update public.profiles set last_active_at = now(), is_online = true where id = v_me;
end;
$$;
revoke all on function public.touch_last_active() from public;
grant execute on function public.touch_last_active() to authenticated;

-- 6 ---------------------------------------------------------------------------

create or replace function public.cancel_rishta_request(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me    uuid := auth.uid();
  v_other uuid;
  v_match public.matches%rowtype;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_match from public.matches m where m.id = p_match_id for update;
  if not found or v_me not in (v_match.user_a, v_match.user_b) then
    raise exception 'not_a_participant';
  end if;
  if v_match.rishta_requested_by is distinct from v_me or v_match.mode = 'rishta' then
    raise exception 'no_pending_request';
  end if;

  update public.matches
  set rishta_requested_by = null,
      rishta_requested_at = null
  where id = p_match_id;

  v_other := case when v_me = v_match.user_a then v_match.user_b else v_match.user_a end;

  delete from public.notifications n
  where n.profile_id = v_other
    and n.type = 'rishta_request'
    and n.match_id = p_match_id
    and n.created_at >= v_match.rishta_requested_at - interval '1 minute';

  delete from public.chat_messages c
  where c.match_id = p_match_id
    and c.sender_id = v_me
    and c.kind = 'text'
    and c.text like '💫%'
    and c.sent_at >= v_match.rishta_requested_at - interval '1 minute';
end;
$$;
revoke all on function public.cancel_rishta_request(uuid) from public;
grant execute on function public.cancel_rishta_request(uuid) to authenticated;
