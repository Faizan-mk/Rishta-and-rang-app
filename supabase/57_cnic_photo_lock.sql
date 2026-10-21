-- ============================================================================
-- 57. The CNIC is fixed once signup has written it.
--
-- The app checks at signup that the number on the CNIC photo is the number
-- typed (src/utils/cnicPhotoMatch.ts), but that check runs on the phone. With
-- the photo still owner-writable afterwards, a member could swap the card photo
-- straight through the API — skipping the check — or move to another CNIC
-- through the cnic function's `claim`. Now neither moves once set; a genuine
-- change is made by the team (service role / SQL editor).
--
--   · cnic_photo_path   pinned for member sessions once it is non-null
--   · storage           a member can upload or overwrite a file under
--                       <uid>/cnic/ only while their cnic_photo_path is still
--                       null — i.e. during signup, before it is recorded
--   · profile_verification rows can no longer be deleted by the member (which
--                       would have unpinned everything); they cascade away
--                       with the account
--   · cnic_claim        refuses ('locked') to move an account that already
--                       holds a CNIC to a different one
--
-- Deleting the file stays allowed: account deletion removes it from the app
-- before the account goes. A deleted card photo can't be replaced.
--
-- Run after 56_cnic_unique.sql. Safe to run more than once.
-- ============================================================================

-- 1 ---------------------------------------------------------------------------

create or replace function public.guard_profile_verification_cnic()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'UPDATE' then
      new.cnic_number := old.cnic_number;
      -- Signup writes the path once, after the upload; from then on it stays.
      if old.cnic_photo_path is not null then
        new.cnic_photo_path := old.cnic_photo_path;
      end if;
    else
      new.cnic_number := null;
    end if;
  end if;
  return new;
end;
$$;

drop policy if exists "verification_delete" on public.profile_verification;

-- 2 ---------------------------------------------------------------------------

-- True while the caller has no CNIC photo on record yet. Definer so the storage
-- policies below can ask without depending on profile_verification's own RLS.
create or replace function public.cnic_photo_open()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select not exists (
    select 1 from public.profile_verification
    where id = auth.uid() and cnic_photo_path is not null
  );
$$;

revoke all on function public.cnic_photo_open() from public, anon;
grant execute on function public.cnic_photo_open() to authenticated, service_role;

drop policy if exists "verification_insert" on storage.objects;
create policy "verification_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'private-verification'
    and (storage.foldername(name))[1] = (auth.uid())::text
    and ((storage.foldername(name))[2] is distinct from 'cnic' or public.cnic_photo_open())
  );

drop policy if exists "verification_update" on storage.objects;
create policy "verification_update" on storage.objects
  for update to authenticated using (
    bucket_id = 'private-verification'
    and (storage.foldername(name))[1] = (auth.uid())::text
    and ((storage.foldername(name))[2] is distinct from 'cnic' or public.cnic_photo_open())
  );

-- 3 ---------------------------------------------------------------------------

create or replace function public.cnic_claim(p_user_id uuid, p_cnic_hash text, p_cnic_number text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_holder uuid;
begin
  -- Already holds a different CNIC: changing it is the team's job, not the
  -- member's. Claiming the same one again stays a no-op 'ok'.
  if exists (
    select 1 from public.cnic_registry
    where user_id = p_user_id and cnic_hash <> p_cnic_hash
  ) then
    return 'locked';
  end if;

  select user_id into v_holder from public.cnic_registry where cnic_hash = p_cnic_hash;
  if v_holder is not null and v_holder <> p_user_id then
    return 'taken';
  end if;

  begin
    insert into public.cnic_registry (cnic_hash, user_id)
    values (p_cnic_hash, p_user_id)
    on conflict (user_id) do nothing;
  exception when unique_violation then
    return 'taken';
  end;
  if not exists (select 1 from public.cnic_registry where user_id = p_user_id and cnic_hash = p_cnic_hash) then
    return 'taken';
  end if;

  insert into public.profile_verification (id, cnic_number)
  values (p_user_id, p_cnic_number)
  on conflict (id) do update set cnic_number = excluded.cnic_number;

  return 'ok';
end;
$$;

revoke all on function public.cnic_claim(uuid, text, text) from public, anon, authenticated;
grant execute on function public.cnic_claim(uuid, text, text) to service_role;
