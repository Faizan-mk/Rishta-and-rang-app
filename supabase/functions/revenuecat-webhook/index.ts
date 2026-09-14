// revenuecat-webhook — keeps Explore+ correct while the app isn't open.
//
// sync-entitlement handles the moment right after a purchase, on demand, with
// the app in the foreground. This is the other half: a renewal that succeeds
// silently, a subscription that lapses, a refund — RevenueCat tells us these
// happened by calling here, whether or not the member ever opens the app
// again. Both paths end at the same place, applyEntitlementState
// (../_shared/entitlement.ts), so neither can disagree with the other about
// what "active" means.
//
// Authenticated by a shared secret, not a member session — RevenueCat's
// servers call this, not the app. Set the same value in both places:
//   supabase secrets set REVENUECAT_WEBHOOK_SECRET=<a random string you pick>
//   RevenueCat dashboard -> Project -> Integrations -> Webhooks
//     -> URL: https://<project>.supabase.co/functions/v1/revenuecat-webhook
//     -> Authorization header value: <the same random string>
//
// Deploy:
//   supabase functions deploy revenuecat-webhook --no-verify-jwt
// (--no-verify-jwt because the caller is RevenueCat, not a Supabase session —
// the Authorization header carries our own shared secret instead, checked
// below, not a Supabase JWT.)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { applyEntitlementState, EXPLORE_PLUS_ENTITLEMENT, type EntitlementState } from '../_shared/entitlement.ts';

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Events that mean "the entitlement is active, make sure the row says so" and
// events that mean "it just ended, make sure the row says that instead".
// Anything else (BILLING_ISSUE during its own retry/grace window,
// CANCELLATION before the period is actually up, TRANSFER, TEST, …) is left
// alone on purpose — acting on those here would either jump ahead of what
// Play/RevenueCat itself still considers active, or move a column this
// function has no real information about.
const GRANT_EVENTS = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE', 'NON_RENEWING_PURCHASE']);
const REVOKE_EVENTS = new Set(['EXPIRATION']);

interface RevenueCatWebhookBody {
  event?: {
    type?: string;
    app_user_id?: string;
    product_id?: string;
    period_type?: string;
    expiration_at_ms?: number | null;
    entitlement_ids?: string[] | null;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const webhookSecret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET') ?? '';
  const authHeader = req.headers.get('Authorization') ?? '';
  // RevenueCat sends whatever string was configured, verbatim — not
  // necessarily "Bearer <value>" — so this compares the raw header rather
  // than assuming a scheme.
  if (!webhookSecret || authHeader !== webhookSecret) {
    return json({ error: 'unauthorized' }, 401);
  }

  let body: RevenueCatWebhookBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const event = body.event;
  if (!event?.type || !event.app_user_id) {
    return json({ error: 'missing_fields', required: ['event.type', 'event.app_user_id'] }, 400);
  }

  // Not about our one entitlement (a different product in the same
  // RevenueCat project, say) — acknowledge and do nothing.
  if (event.entitlement_ids && !event.entitlement_ids.includes(EXPLORE_PLUS_ENTITLEMENT)) {
    return json({ skipped: 'unrelated_entitlement' });
  }

  if (!GRANT_EVENTS.has(event.type) && !REVOKE_EVENTS.has(event.type)) {
    return json({ skipped: 'event_not_actioned', type: event.type });
  }

  const state: EntitlementState = {
    active: GRANT_EVENTS.has(event.type),
    productId: event.product_id ?? null,
    periodType: event.period_type ?? null,
    expiresAtMs: event.expiration_at_ms ?? null,
  };

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
  try {
    await applyEntitlementState(supabase, event.app_user_id, state);
  } catch (e) {
    // A non-2xx tells RevenueCat to retry with backoff, which is the right
    // response to our own database being briefly unreachable.
    return json({ error: 'grant_failed', detail: e instanceof Error ? e.message : String(e) }, 500);
  }

  return json({ applied: event.type });
});
