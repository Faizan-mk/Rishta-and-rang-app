-- ============================================================================
-- 54. Voice limits.
--
-- Voice notes and voice intros went to public-media like every other file, so
-- the only thing holding them was that bucket's 50 MB cap, and the length the
-- client reported for a voice note was taken on trust. A script could post a
-- 50 MB "voice note", claim it ran for a week, and send them as fast as the
-- general chat limit allowed.
--
--   · voice-media bucket   audio only, 10 MB a file. Five minutes of the
--                          app's HIGH_QUALITY recording (AAC, ~128 kbit/s) is
--                          about 5 MB, so 10 MB is twice the longest honest one.
--   · public-media         stops taking audio, so the big bucket can't be
--                          used for voice instead.
--   · chat_messages        a voice note's length must be 0–300 seconds.
--   · rate limit           voice notes get their own, tighter, limit on top of
--                          the general chat one (53_rate_limits.sql).
--
-- Voice files already in public-media keep working: their URLs don't change
-- and the bucket still serves them. Only new uploads are refused there, which
-- means an app build from before this change can no longer send voice until
-- it is updated.
-- Safe to run more than once.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('voice-media', 'voice-media', true, 10 * 1024 * 1024, array['audio/*'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Same rules as public-media (17_storage.sql): anyone may read, only the
-- owner writes, and only under their own {uid}/ prefix.
drop policy if exists "voice_media_read" on storage.objects;
create policy "voice_media_read" on storage.objects
  for select to public using (bucket_id = 'voice-media');

drop policy if exists "voice_media_insert" on storage.objects;
create policy "voice_media_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'voice-media' and (storage.foldername(name))[1] = (auth.uid())::text
  );

drop policy if exists "voice_media_update" on storage.objects;
create policy "voice_media_update" on storage.objects
  for update to authenticated using (
    bucket_id = 'voice-media' and (storage.foldername(name))[1] = (auth.uid())::text
  );

drop policy if exists "voice_media_delete" on storage.objects;
create policy "voice_media_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'voice-media' and (storage.foldername(name))[1] = (auth.uid())::text
  );

-- public-media: everything 51 allowed, minus audio.
update storage.buckets
set allowed_mime_types = array[
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
      'image/heic', 'image/heif', 'image/gif',
      'video/*'
    ]
where id = 'public-media';

-- A voice note's reported length. Matches profiles_voice_len_range (52).
alter table public.chat_messages drop constraint if exists chat_messages_duration_range;
alter table public.chat_messages add constraint chat_messages_duration_range
  check (duration_sec is null or duration_sec between 0 and 300) not valid;

-- Voice notes: 10 a minute, on top of the general 40-a-minute chat limit.
insert into public.rate_limit_config (name, max_hits, window_seconds)
values ('voice_message', 10, 60)
on conflict (name) do nothing;

drop trigger if exists chat_messages_voice_rate_limit on public.chat_messages;
create trigger chat_messages_voice_rate_limit before insert on public.chat_messages
  for each row when (new.kind = 'voice')
  execute function public.enforce_rate_limit('voice_message', 'sender_id');
