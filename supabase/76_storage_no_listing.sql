-- ============================================================================
-- 76. Nobody can list another member's files.
--
-- public-media and voice-media had a SELECT policy open to everyone. A public
-- bucket doesn't need one to serve a file: its URLs skip RLS. All that policy
-- added was the Storage list API, so anyone holding the app's anon key could
-- list every member's photos, voice intros and older chat files.
--
-- Members keep SELECT on their own folder, which an overwriting upload and a
-- delete both need. Public URLs keep working, so existing builds are unaffected.
-- Safe to run more than once.
-- ============================================================================

drop policy if exists public_media_read on storage.objects;
create policy public_media_read on storage.objects
  for select to authenticated
  using (bucket_id = 'public-media' and (storage.foldername(name))[1] = (auth.uid())::text);

drop policy if exists voice_media_read on storage.objects;
create policy voice_media_read on storage.objects
  for select to authenticated
  using (bucket_id = 'voice-media' and (storage.foldername(name))[1] = (auth.uid())::text);
