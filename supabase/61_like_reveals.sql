-- ============================================================================
-- 61. Three free looks at who liked you.
--
-- A like notification named the liker, so a free member always knew who liked
-- them and Explore+'s "who liked you" sold nothing. Now a free member gets
-- three free trials: the first three people who like them show up with name
-- and photo, as before. From the fourth like on, the notification still comes
-- ("Someone liked your profile") but who it was stays locked until they
-- upgrade. Explore+ sees everyone. Sending likes is unchanged (15 a day free).
--
--   · like_reveals        the likers this member may see. Readable by its
--                         owner; written only by notify_activity.
--   · like_reveals_left() trials remaining for the caller (-1 = unlimited).
--   · notify_activity     on a like: a free recipient with a trial left gets
--                         that liker revealed and named; past three, "Someone".
--
-- The liker's id stays on the notification row (related_id), so it opens up
-- the moment the member upgrades.
--
-- Existing members: their first three likers are revealed, and older like
-- notifications from anyone past that are retitled "Someone".
--
-- Run after 44_notification_related_profile.sql. Safe to run more than once.
-- ============================================================================

create table if not exists public.like_reveals (
  viewer_id  uuid not null references auth.users (id) on delete cascade,
  liker_id   uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (viewer_id, liker_id)
);

alter table public.like_reveals enable row level security;

drop policy if exists "like_reveals_select" on public.like_reveals;
create policy "like_reveals_select" on public.like_reveals
  for select to authenticated using (viewer_id = auth.uid());
-- No insert/update/delete policy: notify_activity is the only way in.

-- The app reads its own rows to know whose likes it may show. Without this the
-- read fails, and the app falls back to showing everyone.
grant select on public.like_reveals to authenticated;

create or replace function public.free_like_reveals()
returns integer
language sql
immutable
set search_path = ''
as $$ select 3 $$;

create or replace function public.like_reveals_left()
returns integer
language sql
security definer
set search_path = ''
stable
as $$
  select case
    when coalesce((select p.is_explore_plus from public.profiles p where p.id = auth.uid()), false) then -1
    else greatest(
      public.free_like_reveals() - (select count(*)::integer from public.like_reveals r where r.viewer_id = auth.uid()),
      0
    )
  end;
$$;

revoke all on function public.like_reveals_left() from public, anon;
grant execute on function public.like_reveals_left() to authenticated;

drop function if exists public.reveal_liker(uuid);

-- "Someone", in the recipient's language, for a like they can't see yet.
create or replace function public.someone_word(p_language text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case coalesce(p_language, 'en') when 'ur' then 'کسی' when 'roman' then 'Kisi' else 'Someone' end;
$$;

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
  v_name text;
  v_lang text;
  v_plus boolean;
begin
  select p.full_name into v_name from public.profiles p where p.id = p_about;
  select p.language, coalesce(p.is_explore_plus, false) into v_lang, v_plus
    from public.profiles p where p.id = p_recipient;
  -- A like names the liker for Explore+, for someone already revealed, and
  -- while the recipient still has a free trial (which this like then uses).
  if p_event = 'like'
     and not v_plus
     and not exists (select 1 from public.like_reveals r where r.viewer_id = p_recipient and r.liker_id = p_about) then
    if (select count(*) from public.like_reveals r where r.viewer_id = p_recipient) < public.free_like_reveals() then
      insert into public.like_reveals (viewer_id, liker_id) values (p_recipient, p_about)
        on conflict do nothing;
    else
      v_name := public.someone_word(v_lang);
    end if;
  end if;
  perform public.notify_member(
    p_recipient,
    p_event,
    coalesce(v_name, ''),
    public.activity_copy(p_event, v_lang),
    null,
    p_about,
    p_kind
  );
exception
  -- Same rule as before: a notification that fails to write must never take
  -- the like or the match it is reporting down with it.
  when others then
    return;
end;
$$;

revoke all on function public.notify_activity(uuid, uuid, text, text) from public;

-- Existing members: their first three likers (oldest first) count as the trials.
insert into public.like_reveals (viewer_id, liker_id, created_at)
select l.target_id, l.liker_id, l.created_at
from (
  select target_id, liker_id, min(created_at) as created_at,
         row_number() over (partition by target_id order by min(created_at)) as n
  from public.likes
  group by target_id, liker_id
) l
join public.profiles p on p.id = l.target_id
where l.n <= public.free_like_reveals()
  and not coalesce(p.is_explore_plus, false)
on conflict do nothing;

-- ...and older like notifications from anyone past those stop naming them.
update public.notifications n
set title = public.someone_word(p.language)
from public.profiles p
where p.id = n.profile_id
  and n.type = 'like'
  and n.related_id is not null
  and not coalesce(p.is_explore_plus, false)
  -- a like received, not the member's own "interest sent" row
  and exists (select 1 from public.likes l where l.liker_id = n.related_id and l.target_id = n.profile_id)
  and not exists (
    select 1 from public.like_reveals r where r.viewer_id = n.profile_id and r.liker_id = n.related_id
  );
