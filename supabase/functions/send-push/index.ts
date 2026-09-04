// send-push — the one place a notification actually leaves the building.
//
// Two ways in, and they trust the caller very differently.
//
//   · service_role (curl, a cron, a future server job): the body is taken as
//     written — recipient, title and text. This is the manual path, and how you
//     test the pipeline end to end.
//
//   · a signed-in member (the app): the body is NOT trusted. `userId` and
//     `title` are ignored and worked out here instead, from a relationship the
//     caller demonstrably has — a match they are in, a like they actually sent.
//     Otherwise any member could push any text to any stranger, which is worse
//     than having no notifications at all.
//
// What it does either way: check the recipient's notification_prefs, look up
// their devices, hand the batch to Expo, and prune tokens Expo reports as dead.
//
// Deploy:
//   supabase functions deploy send-push
//
// Manual invoke (service_role key — never ship this key in the app):
//   curl -X POST 'https://<project>.supabase.co/functions/v1/send-push' //     -H 'Authorization: Bearer <SERVICE_ROLE_KEY>' //     -H 'Content-Type: application/json' //     -d '{"userId":"<uuid>","event":"message","title":"Ayesha","body":"Assalam o alaikum"}'
//
// From the app (the member's own session token is already attached by
// supabase-js):
//   supabase.functions.invoke('send-push', { body: { event: 'message', matchId, preview } })

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// Which notification_prefs column gates which event. An event with no entry
// here is not gated. The three rishta events are one stored notification type
// (types/content.ts NotificationType) under one preference switch — a member
// who wants to hear about rishta requests wants to hear the answer to their own.
const PREF_COLUMN: Record<string, string> = {
  match: 'new_matches',
  message: 'messages',
  like: 'likes',
  rishta_request: 'rishta_requests',
  rishta_accepted: 'rishta_requests',
  rishta_declined: 'rishta_requests',
  system: 'product_updates',
};

// The events a member may send about a match they are in. `rishta_accepted`
// and `rishta_declined` are additionally checked against the row itself below —
// a member cannot announce an answer they did not give.
const MATCH_EVENTS = ['message', 'rishta_request', 'rishta_accepted', 'rishta_declined'];

// How long after answering a request that answer may still be pushed. Long
// enough for a slow network on the call that follows the RPC, short enough that
// a stale row is not a standing licence to re-send it.
const ANSWER_WINDOW_MS = 5 * 60 * 1000;

interface SendPushBody {
  event: keyof typeof PREF_COLUMN | string;
  // Service-role path only: taken as written.
  userId?: string;
  title?: string;
  body?: string;
  // Member path: the relationship the notification hangs off. `matchId` for a
  // message or a rishta request, `targetId` for a like or a new match.
  matchId?: string;
  targetId?: string;
  // The message's own preview text. Only used for `message`, and only from the
  // person who wrote it, so there is nothing here they could not already send.
  preview?: string;
  // Routed on tap by the app's notification handler.
  data?: Record<string, unknown>;
}

// The fixed lines, in the language the recipient reads the app in. A push is
// often the only thing a member sees of an event, so it should not arrive in
// English because that is what the server happens to speak.
const COPY: Record<string, Record<string, string>> = {
  match: {
    en: 'You matched! Say salaam.',
    ur: 'آپ کی میچ ہو گئی — سلام کہیے۔',
    roman: 'Aap ki match ho gayi — salaam kahiye.',
  },
  like: {
    en: 'liked your profile.',
    ur: 'نے آپ کی پروفائل پسند کی۔',
    roman: 'ne aap ki profile pasand ki.',
  },
  rishta_request: {
    en: 'would like to move to Rishta stage.',
    ur: 'آپ کے ساتھ رشتہ مرحلے میں جانا چاہتے ہیں۔',
    roman: 'aap ke sath Rishta marhale mein jana chahte hain.',
  },
  // Kept word for word in step with public.rishta_copy
  // (supabase/32_rishta_notifications.sql), which writes the in-app row for the
  // same event — the same sentence should not arrive twice in two wordings.
  rishta_accepted: {
    en: 'accepted your Rishta request — you are both in Rishta stage now.',
    ur: 'نے آپ کی رشتہ درخواست قبول کر لی — اب آپ دونوں رشتہ مرحلے میں ہیں۔',
    roman: 'ne aap ki Rishta darkhwast qubool kar li — ab aap dono Rishta marhale mein hain.',
  },
  rishta_declined: {
    en: 'is not ready for Rishta stage yet.',
    ur: 'ابھی رشتہ مرحلے کے لیے تیار نہیں ہیں۔',
    roman: 'abhi Rishta marhale ke liye tayyar nahi hain.',
  },
  message: {
    en: 'sent you a message.',
    ur: 'نے آپ کو پیغام بھیجا۔',
    roman: 'ne aap ko paigham bheja.',
  },
};

function copyFor(event: string, language: string | null | undefined): string {
  const lines = COPY[event];
  if (!lines) return '';
  return lines[language ?? 'en'] ?? lines.en;
}

/** A message preview is the sender's own words, but it still has to fit. */
function clamp(text: string, max = 140): string {
  const trimmed = text.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
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

  const { event, data } = payload ?? {};
  if (!event) return json({ error: 'missing_fields', required: ['event'] }, 400);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  // Service role: this function has to read another member's prefs and tokens,
  // which is exactly what RLS stops the app from doing.
  const supabase = createClient(supabaseUrl, serviceKey);

  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  const isService = Boolean(serviceKey) && bearer === serviceKey;

  let userId = payload.userId;
  let title = payload.title;
  let body = payload.body;
  let routing: Record<string, unknown> = {};

  if (!isService) {
    // --- the member path -----------------------------------------------------
    // Who is asking? Their own token answers that; nothing in the body does.
    const asCaller = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    });
    const { data: auth } = await asCaller.auth.getUser();
    const callerId = auth?.user?.id;
    if (!callerId) return json({ error: 'not_authenticated' }, 401);

    // Their own name is the only title they may send under.
    const { data: sender } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', callerId)
      .maybeSingle();

    if (MATCH_EVENTS.includes(event)) {
      const matchId = payload.matchId;
      if (!matchId) return json({ error: 'missing_fields', required: ['matchId'] }, 400);

      const { data: match } = await supabase
        .from('matches')
        .select('id, user_a, user_b, mode, rishta_requested_by, rishta_answered_by, rishta_answered_at')
        .eq('id', matchId)
        .maybeSingle();

      if (!match) return json({ error: 'no_such_match' }, 404);
      if (match.user_a !== callerId && match.user_b !== callerId) {
        return json({ error: 'not_a_participant' }, 403);
      }

      // "They accepted your request" is the one line the *other* half of the
      // pair would want to be able to send, so an answer is only carried for
      // the member the row says actually gave it, and only while it is the
      // answer the row still holds. `respond_rishta` stamps both
      // (supabase/32_rishta_notifications.sql); the client sends this the
      // moment that call returns, so the window is generous on purpose.
      if (event === 'rishta_accepted' || event === 'rishta_declined') {
        if (match.rishta_answered_by !== callerId) {
          return json({ error: 'not_the_answerer' }, 403);
        }
        const answeredAt = match.rishta_answered_at ? Date.parse(match.rishta_answered_at) : NaN;
        if (!Number.isFinite(answeredAt) || Date.now() - answeredAt > ANSWER_WINDOW_MS) {
          return json({ error: 'answer_too_old' }, 403);
        }
        if (event === 'rishta_accepted' && match.mode !== 'rishta') {
          return json({ error: 'not_in_rishta' }, 403);
        }
        if (event === 'rishta_declined' && match.rishta_requested_by !== null) {
          return json({ error: 'request_still_pending' }, 403);
        }
      }

      userId = match.user_a === callerId ? match.user_b : match.user_a;
      routing = { matchId };
    } else if (event === 'like' || event === 'match') {
      const targetId = payload.targetId;
      if (!targetId) return json({ error: 'missing_fields', required: ['targetId'] }, 400);

      // You may only tell someone you liked them if you actually did. The row is
      // the proof, and the caller cannot write it as anyone but themselves.
      const { data: like } = await supabase
        .from('likes')
        .select('id')
        .eq('liker_id', callerId)
        .eq('target_id', targetId)
        .maybeSingle();

      if (!like) return json({ error: 'no_such_like' }, 403);
      userId = targetId;
    } else {
      // `system` and anything else is not a member's to send.
      return json({ error: 'event_not_allowed_for_members', event }, 403);
    }

    // What the recipient reads the app in decides the wording.
    const { data: recipient } = await supabase
      .from('profiles')
      .select('language')
      .eq('id', userId)
      .maybeSingle();

    const senderName = sender?.full_name ?? '';
    const line = copyFor(event, recipient?.language);

    if (event === 'match') {
      title = senderName;
      body = line;
    } else if (event === 'message') {
      title = senderName;
      // Their own words when there are any — a photo or a voice note has none.
      body = payload.preview ? clamp(payload.preview) : line;
    } else {
      title = senderName;
      body = line;
    }
  }

  if (!userId || !title || !body) {
    return json({ error: 'missing_fields', required: ['userId', 'title', 'body'] }, 400);
  }

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
    data: { event, ...routing, ...(data ?? {}) },
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
