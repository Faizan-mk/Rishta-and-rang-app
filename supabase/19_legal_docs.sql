-- ============================================================================
-- 19. legal — a public bucket for the hosted Privacy Policy and Terms of
-- Service pages. Both stores require a publicly reachable URL for each
-- document, and the signup consent line links to them before anyone agrees.
--
-- UPLOAD THE PDFs, NOT THE HTML. Supabase serves an .html object from a public
-- bucket as `Content-Type: text/plain` with `X-Content-Type-Options: nosniff`
-- (their guard against anyone hosting a phishing page on a supabase.co domain),
-- so an .html URL shows raw source instead of a rendered page, and the browser
-- will not override it. PDFs come back as `application/pdf` and open normally.
-- The .html files are still what the documents are authored as — they are the
-- input to the PDF, and what you would deploy if you move to a static host
-- (GitHub Pages, Netlify) where a real webpage is served.
--
-- After running this:
--   1. npm run legal:build      (regenerates docs/legal/*.html from
--                                src/i18n/en.json, and *.pdf alongside them
--                                when a Chrome/Edge binary is available)
--   2. Dashboard → Storage → legal → upload privacy-policy.pdf and
--      terms-of-service.pdf
--   3. Put the two public URLs in .env as EXPO_PUBLIC_PRIVACY_POLICY_URL and
--      EXPO_PUBLIC_TERMS_URL:
--        https://<project>.supabase.co/storage/v1/object/public/legal/privacy-policy.pdf
--        https://<project>.supabase.co/storage/v1/object/public/legal/terms-of-service.pdf
--
-- Writes are service-role only: these documents are published by whoever ships
-- the build, never by a signed-in member.
--
-- Run after 17_storage.sql.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('legal', 'legal', true)
on conflict (id) do nothing;

-- Readable by anyone, signed in or not — an app-store reviewer opens these
-- URLs without an account.
create policy "legal_read" on storage.objects
  for select to public using (bucket_id = 'legal');
