-- ============================================================================
-- 63. Two ticks as soon as the other member is online.
--
-- The delivered mark (58) only moved when the recipient's app called
-- mark_delivered — on a new message over realtime, or on coming back to the
-- foreground. Whenever that call didn't happen (an older build, a missed
-- realtime event) the sender saw one tick for a message the other person, sat
-- in the app, had plainly received, until they opened the chat and it jumped
-- straight to blue.
--
-- The server now marks delivery itself, from the same presence signal the
-- "Online" badge uses:
--
--   · a message sent to someone who is online right now is delivered on the
--     spot (their app has the realtime stream open and gets it immediately)
--   · every heartbeat (touch_last_active: app opened, and every two minutes
--     while it is open) marks everything waiting for them as delivered
--
-- mark_delivered and the realtime path stay as they are; this only fills in
-- where they didn't fire. A member who hides their online status never has
-- is_online set, so their ticks still move only through their own app.
--
-- Run after 58_delivery_receipts.sql and 43_online_presence.sql. Safe to run
-- more than once.
-- ============================================================================

-- Everything sent to p_user up to now counts as delivered (mark_delivered's
-- body, for a given member rather than the caller).
create or replace function public.mark_delivered_for(p_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.match_deliveries (match_id, user_id, delivered_until)
  select m.id, p_user, latest.sent_at
  from public.matches m
  cross join lateral (
    select c.sent_at
    from public.chat_messages c
    where c.match_id = m.id and c.sender_id <> p_user
    order by c.sent_at desc, c.id desc
    limit 1
  ) latest
  where p_user in (m.user_a, m.user_b)
  on conflict (match_id, user_id) do update
    set delivered_until = excluded.delivered_until
    where public.match_deliveries.delivered_until < excluded.delivered_until;
$$;

revoke all on function public.mark_delivered_for(uuid) from public, anon, authenticated;

-- The heartbeat now also delivers. Delivery comes first and regardless of the
-- online-status setting: it is about the message reaching the phone, not about
-- being seen as online.
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
  update public.profiles set last_active_at = now(), is_online = true where id = v_me;
end;
$$;

revoke all on function public.touch_last_active() from public;
grant execute on function public.touch_last_active() to authenticated;

-- A message to someone online right now is delivered as it lands.
create or replace function public.deliver_if_online()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_other uuid;
begin
  select case when m.user_a = new.sender_id then m.user_b else m.user_a end
    into v_other
  from public.matches m
  where m.id = new.match_id;

  if v_other is not null and exists (
    select 1 from public.profiles p
    where p.id = v_other
      and p.is_online
      -- Same "now" window as the badge: an app that died without saying
      -- goodbye stops counting as online after five minutes.
      and p.last_active_at > now() - interval '5 minutes'
  ) then
    insert into public.match_deliveries (match_id, user_id, delivered_until)
    values (new.match_id, v_other, new.sent_at)
    on conflict (match_id, user_id) do update
      set delivered_until = excluded.delivered_until
      where public.match_deliveries.delivered_until < excluded.delivered_until;
  end if;
  return null;
exception
  -- A tick is never worth failing the message over.
  when others then
    return null;
end;
$$;

drop trigger if exists chat_messages_deliver_if_online on public.chat_messages;
create trigger chat_messages_deliver_if_online
  after insert on public.chat_messages
  for each row execute function public.deliver_if_online();

-- Catch up: anyone online now has everything sent to them delivered.
select public.mark_delivered_for(p.id)
from public.profiles p
where p.is_online and p.last_active_at > now() - interval '5 minutes';
