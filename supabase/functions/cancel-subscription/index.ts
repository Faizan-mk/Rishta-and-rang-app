// cancel-subscription — stops a member's Google Play subscription before
// their account is deleted.
//
// Deleting the account removes everything on our side, but the Play
// subscription is Google's: left alone it keeps renewing and charging someone
// who can no longer open the app. The app calls this first, as the signed-in
// member; it looks up what RevenueCat holds for them and asks RevenueCat to
// cancel each active Google subscription (no refund, no further renewals —
// the same as cancelling in the Play Store).
//
// Deploy:
//   supabase functions deploy cancel-subscription
//
// Called from the app:
//   supabase.functions.invoke('cancel-subscription')

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface RevenueCatSubscriber {
  subscriber?: {
    subscriptions?: Record<
      string,
      {
        store?: string;
        expires_date?: string | null;
        unsubscribe_detected_at?: string | null;
        billing_issues_detected_at?: string | null;
        product_plan_identifier?: string | null;
      }
    >;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const revenueCatSecret = Deno.env.get('REVENUECAT_SECRET_KEY') ?? '';
  if (!revenueCatSecret) return json({ error: 'billing_not_configured' }, 503);

  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  const asCaller = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: `Bearer ${bearer}` } },
  });
  const { data: auth } = await asCaller.auth.getUser();
  const callerId = auth?.user?.id;
  if (!callerId) return json({ error: 'not_authenticated' }, 401);

  const base = `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(callerId)}`;
  const headers = { Authorization: `Bearer ${revenueCatSecret}`, 'Content-Type': 'application/json' };

  const lookup = await fetch(base, { headers });
  // Never bought anything: nothing to cancel.
  if (lookup.status === 404) return json({ cancelled: [] });
  if (!lookup.ok) return json({ error: `revenuecat_lookup_failed:${lookup.status}` }, 502);

  const body = (await lookup.json()) as RevenueCatSubscriber;
  const now = Date.now();
  const live = Object.entries(body.subscriber?.subscriptions ?? {}).filter(([, s]) => {
    const expires = s.expires_date ? Date.parse(s.expires_date) : Infinity;
    // From Play, not already cancelled, and either still running or on a
    // billing hold (expired on paper, but Google can still recover and charge).
    return (
      s.store === 'play_store' &&
      !s.unsubscribe_detected_at &&
      (expires > now || Boolean(s.billing_issues_detected_at))
    );
  });

  const cancelled: string[] = [];
  const failed: string[] = [];
  for (const [productId] of live) {
    // Google base plans may be keyed "explore_plus:monthly" or "explore_plus":
    // try the key as RevenueCat listed it, then the bare subscription id.
    const ids = [...new Set([productId, productId.split(':')[0]])];
    let res: Response | null = null;
    for (const id of ids) {
      res = await fetch(`${base}/subscriptions/${encodeURIComponent(id)}/cancel`, { method: 'POST', headers });
      if (res.status !== 404) break;
    }
    if (res?.ok) cancelled.push(productId);
    else {
      failed.push(productId);
      console.error('cancel-subscription: cancel failed', productId, res?.status, await res?.text().catch(() => ''));
    }
  }

  if (failed.length) return json({ error: 'cancel_failed', cancelled, failed }, 502);
  return json({ cancelled });
});
