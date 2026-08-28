-- ============================================================================
-- 2. profiles — one row per member. Publicly readable by any signed-in member;
-- only the owner may insert / update / delete their card.
--
-- Run after 1_extension.sql.
-- ============================================================================

create table public.profiles (
  id                          uuid primary key references auth.users (id) on delete cascade,
  full_name                   text not null,
  dob                         text not null,               -- 'YYYY-MM-DD'
  gender                      text not null check (gender in ('male', 'female', 'other')),
  city                        text not null default '',
  bio                         text not null default '',
  intent                      text not null,
  language                    text not null default 'en',
  active_mode                 text not null default 'dating',
  dating_vibe_tags            text[] not null default '{}',
  dating_intention_label      text,
  rishta_religion             text not null default '',
  rishta_sect                 text not null default '',
  rishta_family_background    text not null default '',
  rishta_education            text not null default '',
  rishta_readiness            text not null default 'browsing',
  rishta_prayer_habits        text,
  rishta_income_range         text,
  rishta_living_abroad        boolean,
  height_cm                   numeric,
  marital_status              text,
  has_children                boolean,
  occupation                  text,
  practising                  boolean,
  prayer_habits               text,
  halal_only                  boolean,
  smoking                     boolean,
  drinking                    boolean,
  religious_dress             text,
  open_to_relocate            boolean,
  preferred_country           text,
  career_plans                text,
  education_level             text,
  degree                      text,
  job_title                   text,
  industry                    text,
  languages                   text[],
  nationality                 text,
  grew_up_in                  text,
  country                     text,
  selfie_verified             boolean not null default false,
  bureau_verified             boolean not null default false,
  last_active_at              timestamptz,
  photos                      text[] not null default '{}',  -- public storage URLs
  voice_intro_url             text,
  voice_intro_duration_sec    numeric,
  video_intro_url             text,
  wali_name                   text,
  wali_invited_at             timestamptz,
  is_explore_plus             boolean not null default false,
  subscription_plan           text,
  has_used_trial              boolean not null default false,
  subscription_renews_at      timestamptz,
  created_at                  timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select" on public.profiles
  for select to authenticated using (true);
create policy "profiles_insert" on public.profiles
  for insert to authenticated with check (auth.uid() = id);
create policy "profiles_update" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_delete" on public.profiles
  for delete to authenticated using (auth.uid() = id);

grant all on public.profiles to authenticated, service_role;