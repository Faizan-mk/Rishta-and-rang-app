// purge-stories — deletes stories that are past their 24 hours, files first.
//
// Expired stories are already invisible to everyone (supabase/46_stories.sql
// filters them out of every read). This reclaims the space: it removes each
// one's file from the public-media bucket, then its row. It goes through the
// Storage API rather than SQL because Supabase does not allow deleting from
// storage.objects directly.
//
// Service role only. It is run hourly by the cron job in
// supabase/48_story_purge_cron.sql, and can be run by hand the same way.
//
// Deploy:
//   supabase functions deploy purge-stories --no-verify-jwt
//
// Manual invoke:
//   curl -X POST 'https://<project>.supabase.co/functions/v1/purge-stories' \
//     -H 'Authorization: Bearer <SERVICE_ROLE_KEY>'

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BUCKET = 'public-media';
const PUBLIC_URL_MARKER = `/storage/v1/object/public/${BUCKET}/`;
// Per run. Anything left over goes on the next hourly run.
const BATCH = 500;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function storagePath(url: string): string | null {
  const index = url.indexOf(PUBLIC_URL_MARKER);
  if (index === -1) return null;
  return decodeURIComponent(url.slice(index + PUBLIC_URL_MARKER.length).split('?')[0]);
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!serviceKey || bearer !== serviceKey) return json({ error: 'forbidden' }, 403);

  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: expired, error } = await supabase
    .from('stories')
    .select('id, media_url')
    .lte('expires_at', new Date().toISOString())
    .limit(BATCH);
  if (error) return json({ error: error.message }, 500);
  if (!expired?.length) return json({ deleted: 0 });

  const paths = expired.map((s) => storagePath(s.media_url)).filter((p): p is string => Boolean(p));
  if (paths.length) {
    const { error: removeError } = await supabase.storage.from(BUCKET).remove(paths);
    // Keep the rows if the files could not go, so the next run tries again
    // rather than leaving files nothing points to.
    if (removeError) return json({ error: removeError.message }, 500);
  }

  const { error: deleteError } = await supabase
    .from('stories')
    .delete()
    .in('id', expired.map((s) => s.id));
  if (deleteError) return json({ error: deleteError.message }, 500);

  return json({ deleted: expired.length });
});
