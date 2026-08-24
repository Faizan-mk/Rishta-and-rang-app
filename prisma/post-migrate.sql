-- Everything Prisma's schema can't express: the cross-schema FK to
-- auth.users, CHECK constraints, RLS + policies, the updated_at trigger,
-- the email_exists() RPC, and the storage buckets media uploads to.
-- Run once after `prisma migrate dev` creates the tables (idempotent —
-- safe to re-run after future migrations).

-- ============================================================================
-- Cross-schema FK: Prisma only manages the public schema, so this can't be
-- expressed in schema.prisma.
-- ============================================================================
alter table public.profiles
  drop constraint if exists profiles_id_fkey,
  add constraint profiles_id_fkey foreign key (id) references auth.users (id) on delete cascade;

-- ============================================================================
-- CHECK constraints — Prisma has no native equivalent, so the enum-like
-- columns are only guarded on the TypeScript side without these.
-- ============================================================================
alter table public.profiles drop constraint if exists profiles_gender_check;
alter table public.profiles add constraint profiles_gender_check check (gender in ('male', 'female', 'other'));

alter table public.profiles drop constraint if exists profiles_intent_check;
alter table public.profiles add constraint profiles_intent_check check (intent in ('casual', 'serious', 'matrimonial'));

alter table public.profiles drop constraint if exists profiles_language_check;
alter table public.profiles add constraint profiles_language_check check (language in ('en', 'ur', 'roman'));

alter table public.profiles drop constraint if exists profiles_active_mode_check;
alter table public.profiles add constraint profiles_active_mode_check check (active_mode in ('dating', 'rishta'));

alter table public.profiles drop constraint if exists profiles_dating_intention_label_check;
alter table public.profiles add constraint profiles_dating_intention_label_check
  check (dating_intention_label in ('exploring', 'dating', 'open_to_marriage'));

alter table public.profiles drop constraint if exists profiles_rishta_readiness_check;
alter table public.profiles add constraint profiles_rishta_readiness_check
  check (rishta_readiness in ('browsing', 'few_months', 'ready_now'));

alter table public.profiles drop constraint if exists profiles_marital_status_check;
alter table public.profiles add constraint profiles_marital_status_check
  check (marital_status in ('single', 'divorced', 'widowed'));

alter table public.profiles drop constraint if exists profiles_subscription_plan_check;
alter table public.profiles add constraint profiles_subscription_plan_check
  check (subscription_plan in ('trial', 'monthly', 'yearly'));

-- ============================================================================
-- email_exists — lets the signup screen check availability before the user
-- fills out the rest of the multi-step form. Supabase deliberately keeps
-- auth.users unreadable via the anon key to avoid enumeration; this function
-- is a narrow, intentional exception that only ever returns a boolean.
-- ============================================================================
create or replace function public.email_exists(check_email text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from auth.users where lower(email) = lower(check_email)
  );
$$;

grant execute on function public.email_exists(text) to anon, authenticated;

-- ============================================================================
-- updated_at trigger — Prisma's @updatedAt only fires for writes made
-- through Prisma Client, and the app writes through supabase-js instead.
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on public.profiles;
create trigger set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.profile_verification;
create trigger set_updated_at
  before update on public.profile_verification
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Row-level security
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.profile_verification enable row level security;
alter table public.profile_photos enable row level security;

drop policy if exists "profiles readable by authenticated" on public.profiles;
create policy "profiles readable by authenticated"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "profiles delete own" on public.profiles;
create policy "profiles delete own"
  on public.profiles for delete
  to authenticated
  using (auth.uid() = id);

drop policy if exists "verification owner only" on public.profile_verification;
create policy "verification owner only"
  on public.profile_verification for all
  to authenticated
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

drop policy if exists "photos readable by authenticated" on public.profile_photos;
create policy "photos readable by authenticated"
  on public.profile_photos for select
  to authenticated
  using (true);

drop policy if exists "photos owner write" on public.profile_photos;
create policy "photos owner write"
  on public.profile_photos for all
  to authenticated
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

-- ============================================================================
-- Storage buckets
--   public-media         → photos, video intro, voice intro (publicly viewable)
--   private-verification → CNIC photo, selfie (owner-only, signed URLs)
-- Folder layout: {user_id}/photos/*, {user_id}/video-intro/*, {user_id}/voice-intro/*
--                {user_id}/cnic.*, {user_id}/selfie.*
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('public-media', 'public-media', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('private-verification', 'private-verification', false)
on conflict (id) do nothing;

drop policy if exists "public-media public read" on storage.objects;
create policy "public-media public read"
  on storage.objects for select
  to public
  using (bucket_id = 'public-media');

drop policy if exists "public-media owner insert" on storage.objects;
create policy "public-media owner insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'public-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "public-media owner update" on storage.objects;
create policy "public-media owner update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'public-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'public-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "public-media owner delete" on storage.objects;
create policy "public-media owner delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'public-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "private-verification owner read" on storage.objects;
create policy "private-verification owner read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'private-verification' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "private-verification owner insert" on storage.objects;
create policy "private-verification owner insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'private-verification' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "private-verification owner update" on storage.objects;
create policy "private-verification owner update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'private-verification' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'private-verification' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "private-verification owner delete" on storage.objects;
create policy "private-verification owner delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'private-verification' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================================
-- Per-user app data — matches, chat, favorites, notifications, blocked
-- users, view history, daily like counter, privacy prefs. All owner-only:
-- one "own rows" policy per table, no cross-user read (unlike profiles).
-- ============================================================================
alter table public.matches drop constraint if exists matches_mode_check;
alter table public.matches add constraint matches_mode_check check (mode in ('dating', 'rishta'));

alter table public.chat_messages drop constraint if exists chat_messages_kind_check;
alter table public.chat_messages add constraint chat_messages_kind_check check (kind in ('text', 'voice', 'image'));

alter table public.favorites drop constraint if exists favorites_kind_check;
alter table public.favorites add constraint favorites_kind_check check (kind in ('dating', 'rishta'));

alter table public.view_history drop constraint if exists view_history_kind_check;
alter table public.view_history add constraint view_history_kind_check check (kind in ('dating', 'rishta'));

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('match', 'like', 'message', 'rishta_request', 'system'));

do $$
declare
  t text;
begin
  foreach t in array array[
    'matches', 'chat_messages', 'favorites', 'notifications',
    'notification_prefs', 'blocked_users', 'view_history', 'daily_likes', 'privacy_prefs'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows only" on public.%I', t);
    execute format(
      'create policy "own rows only" on public.%I for all to authenticated using (auth.uid() = profile_id) with check (auth.uid() = profile_id)',
      t
    );
  end loop;
end $$;
