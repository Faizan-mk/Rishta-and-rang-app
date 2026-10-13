-- ============================================================================
-- 50. "X liked your story" — in-app and push.
--
-- A trigger on `story_likes` (49_story_likes.sql) writes the Notifications-tab
-- row through `notify_member` and sends the push through `send-push` with the
-- service-role key, the same Vault secrets the story purge cron reads
-- (48_story_purge_cron.sql). Doing both here, not from the app, means a like
-- can only ever announce itself once the row that proves it exists.
--
-- Once per (story, liker): `story_like_notified` remembers who has already been
-- announced, so liking, unliking and liking again does not ping the owner
-- three times. It goes when the story does.
--
-- Gated by the same "Likes" switch as profile likes (notification_prefs.likes).
--
-- Run after 49_story_likes.sql, 44_notification_related_profile.sql and
-- 48_story_purge_cron.sql (for the Vault secrets and pg_net).
-- ============================================================================

create extension if not exists pg_net;

create table if not exists public.story_like_notified (
  story_id  uuid not null references public.stories (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  primary key (story_id, user_id)
);

-- Only the trigger below (a definer function) touches it.
alter table public.story_like_notified enable row level security;
grant all on public.story_like_notified to service_role;

-- Kept word for word in step with send-push's COPY.story_like.
create or replace function public.story_like_copy(p_language text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case coalesce(p_language, 'en')
    when 'ur'    then 'نے آپ کی اسٹوری پسند کی۔'
    when 'roman' then 'ne aap ki story pasand ki.'
    else 'liked your story.'
  end;
$$;

revoke all on function public.story_like_copy(text) from public;
grant execute on function public.story_like_copy(text) to authenticated, service_role;

create or replace function public.notify_story_like()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner    uuid;
  v_first    integer;
  v_enabled  boolean;
  v_name     text;
  v_lang     text;
  v_body     text;
  v_kind     text;
  v_url      text;
  v_key      text;
begin
  select s.user_id into v_owner from public.stories s where s.id = new.story_id;
  if v_owner is null or v_owner = new.user_id then
    return new;
  end if;

  insert into public.story_like_notified (story_id, user_id)
  values (new.story_id, new.user_id)
  on conflict do nothing;
  get diagnostics v_first = row_count;
  if v_first = 0 then
    return new;
  end if;

  -- No prefs row means the member never opened Settings: likes are on.
  select np.likes into v_enabled from public.notification_prefs np where np.id = v_owner;
  if v_enabled is false then
    return new;
  end if;

  select p.full_name into v_name from public.profiles p where p.id = new.user_id;
  select p.language  into v_lang from public.profiles p where p.id = v_owner;
  v_name := coalesce(nullif(btrim(v_name), ''), 'Someone');
  v_body := public.story_like_copy(v_lang);

  -- Which pool the liker's profile opens in when the row is tapped.
  select m.mode into v_kind
  from public.matches m
  where m.user_a = least(v_owner, new.user_id)
    and m.user_b = greatest(v_owner, new.user_id);

  perform public.notify_member(v_owner, 'story_like', v_name, v_body, null, new.user_id, v_kind);

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key';
  if v_url is not null and v_key is not null then
    perform net.http_post(
      url := v_url || '/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      body := jsonb_build_object(
        'userId', v_owner,
        'event', 'story_like',
        'title', v_name,
        'body', v_body,
        'data', jsonb_build_object('storyId', new.story_id)
      )
    );
  end if;

  return new;
exception
  -- Fires inside the like's own insert. A notification that fails must never
  -- take the like down with it.
  when others then
    return new;
end;
$$;

revoke all on function public.notify_story_like() from public;

drop trigger if exists story_likes_notify_after_insert on public.story_likes;
create trigger story_likes_notify_after_insert
  after insert on public.story_likes
  for each row execute function public.notify_story_like();
