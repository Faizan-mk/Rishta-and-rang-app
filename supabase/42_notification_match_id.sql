-- ============================================================================
-- 42. Notifications know which conversation they belong to.
--
-- Opening a thread and reading its messages already marks the thread itself
-- read (`match_reads`, 26_two_way_messaging.sql), but the "X sent you a
-- message" row that landed in the Notifications tab (40) had no way to be
-- found again from a match id — `notifications` carried no link back to the
-- conversation, so it stayed unread until someone opened the Notifications
-- tab itself and tapped it, even though they had just read the very message
-- it was about.
--
-- Run after 40_like_match_message_notifications.sql.
-- ============================================================================

alter table public.notifications
  add column if not exists match_id uuid references public.matches (id) on delete cascade;

-- Reading a thread looks this up as "my unread message-notifications for this
-- match" — the column doing the work in that query, is what this indexes.
create index if not exists notifications_profile_match_idx
  on public.notifications (profile_id, match_id)
  where match_id is not null;

-- `notify_member` gains a 5th, optional parameter — a new signature, not a
-- change to the existing one, so it is dropped and recreated the same way 40
-- did for `like_profile`. Every existing call (notify_rishta, notify_activity)
-- keeps working unchanged: the default is null, which is exactly what a like,
-- a match or a Rishta event already means — there is no single conversation
-- to attach those to.
drop function if exists public.notify_member(uuid, text, text, text);

create function public.notify_member(
  p_user     uuid,
  p_type     text,
  p_title    text,
  p_body     text,
  p_match_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_column  text := case p_type
                      when 'match'          then 'new_matches'
                      when 'like'           then 'likes'
                      when 'message'        then 'messages'
                      when 'rishta_request' then 'rishta_requests'
                      when 'system'         then 'product_updates'
                    end;
  v_enabled boolean;
begin
  if p_user is null then
    return;
  end if;

  if v_column is not null then
    execute format(
      'select coalesce(np.%I, true) from public.notification_prefs np where np.id = $1',
      v_column
    )
    into v_enabled
    using p_user;

    if v_enabled is null then
      v_enabled := v_column <> 'product_updates';
    end if;
    if not v_enabled then
      return;
    end if;
  end if;

  insert into public.notifications (profile_id, type, title, body, match_id)
  values (p_user, p_type, p_title, p_body, p_match_id);
end;
$$;

revoke all on function public.notify_member(uuid, text, text, text, uuid) from public;
revoke all on function public.notify_member(uuid, text, text, text, uuid) from authenticated;

-- `notify_new_message` (40) now passes its own match along.
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

  v_preview := btrim(coalesce(new.text, ''));
  if new.kind = 'text' and v_preview <> '' then
    if char_length(v_preview) > 140 then
      v_preview := left(v_preview, 139) || '…';
    end if;
  else
    v_preview := public.activity_copy('message', v_lang);
  end if;

  perform public.notify_member(v_recipient, 'message', coalesce(v_name, ''), v_preview, new.match_id);
  return new;
exception
  when others then
    return new;
end;
$$;
