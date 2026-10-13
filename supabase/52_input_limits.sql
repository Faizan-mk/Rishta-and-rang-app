-- ============================================================================
-- 52. Input limits on member-written columns.
--
-- RLS decides whose rows a member may write, but nothing limited what went
-- into them: a direct API call could store a megabyte bio, a 10,000-entry
-- photos array or a height of -5. The app's own fields now cap what can be
-- typed (TextField: 200 single-line / 1000 multiline; chat composer: 2000),
-- and these checks hold the same line for anything that skips the app.
--
-- Limits sit at or above the app's, so no honest edit is refused. They are
-- added NOT VALID: existing rows are left alone, every new insert and update
-- is checked. Safe to run more than once.
-- ============================================================================

do $$
declare
  c record;
begin
  for c in
    select * from (values
      -- profiles: identity and free text
      ('profiles', 'profiles_full_name_len',   'char_length(full_name) between 1 and 100'),
      ('profiles', 'profiles_dob_format',      $c$dob ~ '^\d{4}-\d{2}-\d{2}$'$c$),
      ('profiles', 'profiles_bio_len',         'char_length(bio) <= 1000'),
      ('profiles', 'profiles_city_len',        'char_length(city) <= 200'),
      ('profiles', 'profiles_short_text_len',
        'char_length(coalesce(occupation, ''''))          <= 200 and
         char_length(coalesce(job_title, ''''))           <= 200 and
         char_length(coalesce(industry, ''''))            <= 200 and
         char_length(coalesce(degree, ''''))              <= 200 and
         char_length(coalesce(education_level, ''''))     <= 200 and
         char_length(coalesce(career_plans, ''''))        <= 1000 and
         char_length(coalesce(prayer_habits, ''''))       <= 200 and
         char_length(coalesce(religious_dress, ''''))     <= 200 and
         char_length(coalesce(preferred_country, ''''))   <= 200 and
         char_length(coalesce(nationality, ''''))         <= 200 and
         char_length(coalesce(grew_up_in, ''''))          <= 200 and
         char_length(coalesce(country, ''''))             <= 200 and
         char_length(coalesce(wali_name, ''''))           <= 200 and
         char_length(coalesce(marital_status, ''''))      <= 64 and
         char_length(coalesce(dating_intention_label, '''')) <= 200 and
         char_length(rishta_religion)                    <= 200 and
         char_length(rishta_sect)                        <= 200 and
         char_length(rishta_family_background)           <= 1000 and
         char_length(rishta_education)                   <= 200 and
         char_length(intent)                             <= 32 and
         char_length(language)                           <= 16 and
         char_length(active_mode)                        <= 32'),
      -- profiles: arrays and numbers
      ('profiles', 'profiles_photos_count',    'cardinality(photos) <= 6'),
      ('profiles', 'profiles_tags_count',
        'cardinality(dating_vibe_tags) <= 20 and coalesce(cardinality(languages), 0) <= 20'),
      ('profiles', 'profiles_height_range',    'height_cm is null or height_cm between 100 and 250'),
      ('profiles', 'profiles_voice_len_range',
        'voice_intro_duration_sec is null or voice_intro_duration_sec between 0 and 300'),
      ('profiles', 'profiles_media_url_len',
        'char_length(coalesce(voice_intro_url, '''')) <= 1000 and char_length(coalesce(video_intro_url, '''')) <= 1000'),
      -- private and verification details
      ('profile_private', 'profile_private_len',
        'char_length(email) <= 254 and char_length(coalesce(wali_contact, '''')) <= 200'),
      ('profile_verification', 'profile_verification_cnic_format',
        $c$cnic_number is null or cnic_number = '' or cnic_number ~ '^\d{5}-?\d{7}-?\d$'$c$),
      -- chat, reports, stories
      ('chat_messages', 'chat_messages_text_len', 'char_length(text) <= 2000'),
      ('chat_messages', 'chat_messages_kind_len', 'char_length(kind) <= 32'),
      ('reports', 'reports_text_len',
        'char_length(reason) <= 64 and char_length(details) <= 1000 and char_length(context) <= 32'),
      ('stories', 'stories_media_url_len',      'char_length(media_url) <= 1000')
    ) as t(tbl, name, expr)
  loop
    execute format('alter table public.%I drop constraint if exists %I', c.tbl, c.name);
    execute format('alter table public.%I add constraint %I check (%s) not valid', c.tbl, c.name, c.expr);
  end loop;
end
$$;
