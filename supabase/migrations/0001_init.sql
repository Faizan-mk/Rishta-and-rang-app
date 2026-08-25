-- Rishta & Rang — complete database schema.
--
-- Paste this into the Supabase SQL Editor (Project → SQL Editor → New query)
-- and run it. No CLI, no DB password, no local tooling needed — this is the
-- only thing required to stand up the schema from scratch, and it's safe to
-- re-run (every statement is idempotent).
--
-- To change the schema later: add a new numbered file in this folder
-- (0002_..., 0003_...) with just the delta, and run that one in the SQL
-- Editor. Don't edit this file after it's been applied to a real project —
-- treat it as history, the same way you would a migration file.

-- ============================================================================
-- profiles — one row per auth.users row. Browsable profile data: readable by
-- any signed-in user, writable only by its owner.
-- ============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,

  -- Identity
  full_name text not null,
  email text not null,
  dob date not null,
  gender text not null check (gender in ('male', 'female', 'other')),
  city text not null,
  bio text not null default '',
  intent text not null check (intent in ('casual', 'serious', 'matrimonial')),
  language text not null default 'en' check (language in ('en', 'ur', 'roman')),
  active_mode text not null default 'dating' check (active_mode in ('dating', 'rishta')),

  -- Dating section
  dating_vibe_tags text[] not null default '{}',
  dating_intention_label text check (dating_intention_label in ('exploring', 'dating', 'open_to_marriage')),

  -- Rishta / matrimonial section
  rishta_religion text not null default '',
  rishta_sect text not null default '',
  rishta_family_background text not null default '',
  rishta_education text not null default '',
  rishta_readiness text not null default 'browsing' check (rishta_readiness in ('browsing', 'few_months', 'ready_now')),
  rishta_prayer_habits text,
  rishta_income_range text,
  rishta_living_abroad boolean,

  -- About me
  height_cm int,
  marital_status text check (marital_status in ('single', 'divorced', 'widowed')),
  has_children boolean,
  occupation text,

  -- Faith
  practising boolean,
  prayer_habits text,
  halal_only boolean,
  smoking boolean,
  drinking boolean,
  religious_dress text,

  -- Future plans
  open_to_relocate boolean,
  preferred_country text,
  career_plans text,

  -- Education & career
  education_level text,
  degree text,
  job_title text,
  industry text,

  -- Languages & background
  languages text[],
  nationality text,
  grew_up_in text,
  country text,

  -- Media (storage paths, not full URLs — resolved client-side)
  selfie_verified boolean not null default false,
  voice_intro_path text,
  voice_intro_duration_sec int,
  video_intro_path text,

  -- Wali (guardian) contact
  wali_name text,
  wali_contact text,
  wali_invited_at timestamptz,

  -- Monetization
  is_explore_plus boolean not null default false,
  subscription_plan text check (subscription_plan in ('trial', 'monthly', 'yearly')),
  has_used_trial boolean not null default false,
  subscription_renews_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Browsable profile data — one row per auth.users row. Sensitive verification data lives in profile_verification instead.';

-- ============================================================================
-- profile_verification — CNIC + selfie: kept out of profiles so it never
-- gets swept up in a future "make profiles readable to other users" policy.
-- ============================================================================
create table if not exists public.profile_verification (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  cnic_number text,
  cnic_photo_path text,
  cnic_verified boolean not null default false,
  bureau_verified boolean not null default false,
  selfie_photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profile_verification is 'CNIC + selfie verification data. Owner-only, never joined into public browse queries.';

-- ============================================================================
-- profile_photos — ordered gallery, position 0 is the primary photo.
-- ============================================================================
create table if not exists public.profile_photos (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  unique (profile_id, position)
);

-- ============================================================================
-- Per-user app data — matches, chat, favorites, notifications, blocked
-- users, view history, daily like counter, privacy prefs. All owner-only
-- (RLS below scopes every row to profile_id = auth.uid()); none of it is
-- browsable by other users. Matches/chat still model the counterpart side
-- locally — this app has no live second-user backend — only the signed-in
-- user's own rows are persisted here.
-- ============================================================================
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  photo text not null,
  last_message text not null default '',
  last_message_at timestamptz not null default now(),
  unread boolean not null default false,
  mode text not null check (mode in ('dating', 'rishta')),
  moved_to_rishta boolean not null default false,
  rishta_request_pending boolean not null default false,
  source_profile_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  from_me boolean not null,
  text text not null default '',
  kind text not null default 'text' check (kind in ('text', 'voice', 'image')),
  audio_path text,
  duration_sec int,
  image_path text,
  sent_at timestamptz not null default now()
);

create table if not exists public.favorites (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  target_id text not null,
  kind text not null check (kind in ('dating', 'rishta')),
  name text not null,
  age int not null,
  city text not null,
  photo text not null,
  created_at timestamptz not null default now(),
  primary key (profile_id, target_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('match', 'like', 'message', 'rishta_request', 'system')),
  title text not null,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_prefs (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  new_matches boolean not null default true,
  messages boolean not null default true,
  likes boolean not null default true,
  rishta_requests boolean not null default true,
  product_updates boolean not null default false
);

create table if not exists public.blocked_users (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id text not null,
  source_profile_id text,
  name text not null,
  photo text not null,
  blocked_at timestamptz not null default now(),
  primary key (profile_id, blocked_id)
);

create table if not exists public.view_history (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  viewed_id text not null,
  kind text not null check (kind in ('dating', 'rishta')),
  name text not null,
  age int not null,
  city text not null,
  photo text not null,
  viewed_at timestamptz not null default now(),
  primary key (profile_id, viewed_id)
);

create table if not exists public.daily_likes (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  date text not null,
  count int not null default 0
);

create table if not exists public.privacy_prefs (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  profile_visible boolean not null default true,
  online_status_visible boolean not null default true,
  blur_photos boolean not null default false
);

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
-- updated_at triggers
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

-- ============================================================================
-- Storage buckets
--   public-media         → photos, video intro, voice intro (publicly viewable)
--   private-verification → CNIC photo, selfie (owner-only, signed URLs)
-- Folder layout: {user_id}/photos/*, {user_id}/video-intro/*, {user_id}/voice-intro/*,
--                {user_id}/chat/{match_id}/*, {user_id}/cnic.*, {user_id}/selfie.*
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
