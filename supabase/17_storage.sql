-- ============================================================================
-- 17. Storage buckets + policies (replaces the old storage.rules).
--   · public-media          profile photos / voice / video / chat media —
--                           anyone signed in may read; only the owner uploads
--                           or deletes under their own {uid}/ prefix.
--   · private-verification  CNIC / selfie — owner only (reads via signed URL).
--
-- Run after all the table files.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('public-media', 'public-media', true),
       ('private-verification', 'private-verification', false)
on conflict (id) do nothing;

create policy "public_media_read" on storage.objects
  for select to public using (bucket_id = 'public-media');
create policy "public_media_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'public-media' and (storage.foldername(name))[1] = (auth.uid())::text
  );
create policy "public_media_update" on storage.objects
  for update to authenticated using (
    bucket_id = 'public-media' and (storage.foldername(name))[1] = (auth.uid())::text
  );
create policy "public_media_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'public-media' and (storage.foldername(name))[1] = (auth.uid())::text
  );

create policy "verification_select" on storage.objects
  for select to authenticated using (
    bucket_id = 'private-verification' and (storage.foldername(name))[1] = (auth.uid())::text
  );
create policy "verification_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'private-verification' and (storage.foldername(name))[1] = (auth.uid())::text
  );
create policy "verification_update" on storage.objects
  for update to authenticated using (
    bucket_id = 'private-verification' and (storage.foldername(name))[1] = (auth.uid())::text
  );
create policy "verification_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'private-verification' and (storage.foldername(name))[1] = (auth.uid())::text
  );