-- ============================================================================
-- 4. profile_verification — owner-only: CNIC number, CNIC / selfie photo paths.
-- Photo files live in the private-verification storage bucket (see 17_storage).
--
-- Run after 1_extension.sql.
-- ============================================================================

create table public.profile_verification (
  id                 uuid primary key references auth.users (id) on delete cascade,
  cnic_number        text,
  cnic_photo_path    text,          -- private-verification storage path
  cnic_verified      boolean not null default false,
  bureau_verified    boolean not null default false,
  selfie_photo_path  text           -- private-verification storage path
);

alter table public.profile_verification enable row level security;

create policy "verification_select" on public.profile_verification
  for select to authenticated using (auth.uid() = id);
create policy "verification_insert" on public.profile_verification
  for insert to authenticated with check (auth.uid() = id);
create policy "verification_update" on public.profile_verification
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "verification_delete" on public.profile_verification
  for delete to authenticated using (auth.uid() = id);

grant all on public.profile_verification to authenticated, service_role;