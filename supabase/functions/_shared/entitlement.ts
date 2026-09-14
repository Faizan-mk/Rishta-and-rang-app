// Shared by sync-entitlement and revenuecat-webhook — the two callers of
// grant_explore_plus / revoke_explore_plus (supabase/29_entitlements.sql),
// which trust nothing but a service_role caller. Both functions land here
// after they've each verified, their own way, that RevenueCat really said
// what they're about to write.

export const EXPLORE_PLUS_ENTITLEMENT = 'explore_plus';

export type SupabaseServiceClient = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
};

/** "explore_plus_yearly" -> "yearly"; anything else (incl. "explore_plus_monthly") -> "monthly". */
function planFromProductId(productId: string | null | undefined): 'monthly' | 'yearly' {
  return productId?.toLowerCase().includes('year') ? 'yearly' : 'monthly';
}

export interface EntitlementState {
  active: boolean;
  productId: string | null;
  periodType: string | null;
  expiresAtMs: number | null;
}

/** Applies what RevenueCat reported for one member to their profile row. */
export async function applyEntitlementState(
  supabase: SupabaseServiceClient,
  userId: string,
  state: EntitlementState
): Promise<void> {
  if (!state.active) {
    const { error } = await supabase.rpc('revoke_explore_plus', { p_user: userId });
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase.rpc('grant_explore_plus', {
    p_user: userId,
    p_plan: state.periodType === 'TRIAL' ? 'trial' : planFromProductId(state.productId),
    p_renews_at: state.expiresAtMs ? new Date(state.expiresAtMs).toISOString() : null,
    p_used_trial: state.periodType === 'TRIAL',
  });
  if (error) throw new Error(error.message);
}
