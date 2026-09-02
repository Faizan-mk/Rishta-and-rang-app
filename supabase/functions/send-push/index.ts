// send-push — the one place a notification actually leaves the building.
//
// Skeleton, deliberately: it takes a recipient and an event, checks that
// person's notification_prefs, looks up their devices, and calls Expo. What it
// does NOT do yet is decide *when* to fire — nothing calls it automatically.
// The triggers (new match / new message / new like) land once Day 5-6 makes
// those events real server-side; until then this is invoked by hand, which is
// also how you verify it works.
//
// Deploy:
//   supabase functions deploy send-push
//
// Invoke (service_role key — never ship this key in the app):
//   curl -X POST 'https://<project>.supabase.co/functions/v1/send-push' \
//     -H 'Authorization: Bearer <SERVICE_ROLE_KEY>' \
//     -H 'Content-Type: application/json' \
//     -d '{"userId":"<uuid>","event":"message","title":"Ayesha","body":"Assalam o alaikum"}'

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// Which notification_prefs column gates which event. An event with no entry
// here is not gated — keep this in step with types/content.ts NotificationType.
const PREF_COLUMN: Record<string, string> = {
  match: 'new_matches',
  message: 'messages',
  like: 'likes',
  rishta_request: 'rishta_requests',
  system: 'product_updates',
};

interface SendPushBody {
  userId: string;
  event: keyof typeof PREF_COLUMN | string;
  title: string;
  body: string;
  // Routed on tap by the app's notification handler.
  data?: Record<string, unknown>;
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let payload: SendPushBody;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const { userId, event, title, body, data } = payload ?? {};
  if (!userId || !event || !title || !body) {
    return json({ error: 'missing_fields', required: ['userId', 'event', 'title', 'body'] }, 400);
  }

  // Service role: this function has to read another member's prefs and tokens,
  // which is exactly what RLS stops the app from doing.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // 1. Has this person asked for this kind of notification?
  const prefColumn = PREF_COLUMN[event];
  if (prefColumn) {
    const { data: prefs, error } = await supabase
      .from('notification_prefs')
      .select(prefColumn)
      .eq('id', userId)
      .maybeSingle();

    if (error) return json({ error: 'prefs_lookup_failed', detail: error.message }, 500);

    // No prefs row means the member never opened Settings. The table's own
    // defaults are the answer then — everything on except product updates.
    const enabled = prefs
      ? (prefs as Record<string, boolean>)[prefColumn]
      : prefColumn !== 'product_updates';

    if (!enabled) return json({ skipped: 'muted_by_prefs', event }, 200);
  }

  // 2. Where can we reach them?
  const { data: tokens, error: tokenError } = await supabase
    .from('push_tokens')
    .select('expo_push_token')
    .eq('user_id', userId);

  if (tokenError) return json({ error: 'token_lookup_failed', detail: tokenError.message }, 500);
  if (!tokens?.length) return json({ skipped: 'no_devices', userId }, 200);

  // 3. Hand it to Expo. One request carries every device this member has.
  const messages = tokens.map((row: { expo_push_token: string }) => ({
    to: row.expo_push_token,
    title,
    body,
    sound: 'default',
    data: { event, ...(data ?? {}) },
  }));

  const expoResponse = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
    },
    body: JSON.stringify(messages),
  });

  const result = await expoResponse.json().catch(() => null);
  if (!expoResponse.ok) {
    return json({ error: 'expo_rejected', status: expoResponse.status, detail: result }, 502);
  }

  // Expo reports per-message errors inside a 200. DeviceNotRegistered means the
  // app was uninstalled — drop that row so we stop paying for it every time.
  const tickets: { status?: string; details?: { error?: string } }[] = result?.data ?? [];
  const dead = tickets
    .map((ticket, index) => (ticket?.details?.error === 'DeviceNotRegistered' ? messages[index].to : null))
    .filter((token): token is string => Boolean(token));

  if (dead.length) {
    await supabase.from('push_tokens').delete().in('expo_push_token', dead);
  }

  return json({
    sent: messages.length,
    pruned: dead.length,
    tickets,
  });
});
