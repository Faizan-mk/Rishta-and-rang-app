// sync-entitlement — the client-triggered half of Explore+ billing.
//
// Called by the app right after a Google Play purchase (ExplorePlusScreen),
// and safe to call any time after that (e.g. on app foreground) to reconcile.
// It trusts nothing the client says: it reads the caller's own id off their
// session token, then asks RevenueCat's REST API — not the purchase result
// the client just saw — whether `explore_plus` is actually active for that
// id, and only then calls grant_explore_plus / revoke_explore_plus
// (supabase/29_entitlements.sql, service_role only).
//
// This is the direct, synchronous half. revenuecat-webhook is the other
// half — it keeps the entitlement correct on renewal/expiry while the app
// isn't open, which nothing hitting this endpoint on demand can do.
//
// Needs a Supabase secret this repo does not ship:
//   supabase secrets set REVENUECAT_SECRET_KEY=sk_...
// (RevenueCat dashboard -> Project -> API keys -> Secret key. Never the
// public SDK key from EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY — that one only
// grants read access to the app's own offerings.)
//
// Deploy:
//   supabase functions deploy sync-entitlement
//
// From the app (the member's own session token is attached by supabase-js):
//   supabase.functions.invoke('sync-entitlement')

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { applyEntitlementState, EXPLORE_PLUS_ENTITLEMENT, type EntitlementState } from '../_shared/entitlement.ts';

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface RevenueCatSubscriber {
  subscriber?: {
    entitlements?: Record<string, { expires_date?: string | null; product_identifier?: string }>;
    subscriptions?: Record<string, { period_type?: string }>;
  };
}

async function fetchEntitlementState(appUserId: string, secretKey: string): Promise<EntitlementState> {
  const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });

  // A member who has never purchased anything is a 404 in RevenueCat's API,
  // not an error — same shape as "not active".
  if (response.status === 404) {
    return { active: false, productId: null, periodType: null, expiresAtMs: null };
  }
  if (!response.ok) {
    throw new Error(`revenuecat_lookup_failed:${response.status}`);
  }

  const body = (await response.json()) as RevenueCatSubscriber;
  const entitlement = body.subscriber?.entitlements?.[EXPLORE_PLUS_ENTITLEMENT];
  if (!entitlement) {
    return { active: false, productId: null, periodType: null, expiresAtMs: null };
  }

  const expiresAtMs = entitlement.expires_date ? Date.parse(entitlement.expires_date) : null;
  // No expiry date at all means a non-expiring (lifetime) grant; a parsed one
  // in the future means still active.
  const active = !entitlement.expires_date || (Number.isFinite(expiresAtMs) && (expiresAtMs as number) > Date.now());

  return {
    active,
    productId: entitlement.product_identifier ?? null,
    periodType: body.subscriber?.subscriptions?.[entitlement.product_identifier ?? '']?.period_type ?? null,
    expiresAtMs,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const revenueCatSecret = Deno.env.get('REVENUECAT_SECRET_KEY') ?? '';

  if (!revenueCatSecret) {
    // Not deployed/configured yet. Same shape as "not entitled" — the app's
    // own billingPending copy is what a member sees either way.
    return json({ error: 'billing_not_configured' }, 503);
  }

  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  const asCaller = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: `Bearer ${bearer}` } },
  });
  const { data: auth } = await asCaller.auth.getUser();
  const callerId = auth?.user?.id;
  if (!callerId) return json({ error: 'not_authenticated' }, 401);

  let state: EntitlementState;
  try {
    state = await fetchEntitlementState(callerId, revenueCatSecret);
  } catch (e) {
    return json({ error: 'revenuecat_lookup_failed', detail: e instanceof Error ? e.message : String(e) }, 502);
  }

  // Service role from here: grant/revoke_explore_plus are not callable by the
  // member themselves (supabase/29_entitlements.sql).
  const supabase = createClient(supabaseUrl, serviceKey);
  try {
    await applyEntitlementState(supabase, callerId, state);
  } catch (e) {
    return json({ error: 'grant_failed', detail: e instanceof Error ? e.message : String(e) }, 500);
  }

  return json({ active: state.active });
});
