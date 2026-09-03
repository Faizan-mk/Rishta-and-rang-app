-- ============================================================================
-- Can a member still write the row that signup writes?
--
-- "permission denied for table profiles" names the table and never the column,
-- which is what made this hard to place twice over. This lists exactly the
-- columns signup's upsert sends — the payload of `blankProfileDoc` in
-- src/services/authService.ts, plus the `id` it is spread into — and says
-- whether `authenticated` may update each one.
--
-- Why UPDATE and not INSERT: an upsert is INSERT ... ON CONFLICT DO UPDATE, and
-- PostgREST puts every column of the payload in that DO UPDATE, the key
-- included. So it needs UPDATE rights on all of them, even the first time,
-- when nothing conflicts and no update happens.
--
-- Any row that comes back PROTECTED is a column signup cannot write, and
-- therefore the cause. An empty result means the grants are right and the
-- failure is elsewhere — most likely the app running older JS than this
-- database expects.
--
-- Writes nothing. Run it after 30_revoke_entitlement_writes.sql.
-- ============================================================================

with signup_payload(column_name) as (
  values
    ('id'),
    ('full_name'), ('dob'), ('gender'), ('city'), ('bio'), ('intent'), ('language'),
    ('active_mode'), ('dating_vibe_tags'), ('dating_intention_label'),
    ('rishta_religion'), ('rishta_sect'), ('rishta_family_background'),
    ('rishta_education'), ('rishta_readiness'), ('rishta_prayer_habits'),
    ('rishta_income_range'), ('rishta_living_abroad'),
    ('height_cm'), ('marital_status'), ('has_children'), ('occupation'),
    ('practising'), ('prayer_habits'), ('halal_only'), ('smoking'), ('drinking'),
    ('religious_dress'), ('open_to_relocate'), ('preferred_country'), ('career_plans'),
    ('education_level'), ('degree'), ('job_title'), ('industry'),
    ('languages'), ('nationality'), ('grew_up_in'), ('country'),
    ('selfie_verified'), ('last_active_at'), ('photos'),
    ('voice_intro_url'), ('voice_intro_duration_sec'), ('video_intro_url'),
    ('wali_name'), ('wali_invited_at')
)
select
  p.column_name,
  case
    when not exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = 'profiles'
        and c.column_name = p.column_name
    ) then 'MISSING FROM TABLE'
    when has_column_privilege('authenticated', 'public.profiles', p.column_name, 'UPDATE')
      then 'writable'
    else 'PROTECTED'
  end as member_update
from signup_payload p
where
  not exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'profiles'
      and c.column_name = p.column_name
  )
  or not has_column_privilege('authenticated', 'public.profiles', p.column_name, 'UPDATE');
