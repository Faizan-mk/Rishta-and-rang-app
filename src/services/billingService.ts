import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { config } from '../constants/Config';
import { supabase } from './supabase';

// ---------------------------------------------------------------------------
// Explore+ billing — Google Play Billing via RevenueCat.
//
// RevenueCat is the receipt-validating middleman: it talks to Google Play on
// our behalf, and `sync-entitlement` / `revenuecat-webhook`
// (supabase/functions) are the only callers of `grant_explore_plus` /
// `revoke_explore_plus` (supabase/29_entitlements.sql) — never this file and
// never the screen. A purchase here proves nothing on its own; it is what
// unlocks the *ask* to those functions, which check RevenueCat's own record
// before writing anything.
//
// Android only for now — no Apple developer account or iOS RevenueCat key
// exist yet. `configureBilling` is a no-op on iOS until that changes.
//
// Needs a development or store build, same as push (pushService.ts):
// `react-native-purchases` is a native module and does not exist in Expo Go.
// ---------------------------------------------------------------------------

export const EXPLORE_PLUS_ENTITLEMENT = 'explore_plus';

function isExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

type PurchasesModule = typeof import('react-native-purchases');
type PurchasesStatic = PurchasesModule['default'];
export type ExplorePlusPackage = import('react-native-purchases').PurchasesPackage;

let Purchases: PurchasesStatic | null = null;
let configuredFor: string | null = null;

/** Loads the native module on first use, behind the same guards as pushService's expo-notifications. */
function loadPurchases(): PurchasesStatic | null {
  if (isExpoGo() || Platform.OS !== 'android') return null;
  if (Purchases) return Purchases;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('react-native-purchases') as PurchasesModule;
  Purchases = mod.default;
  return Purchases;
}

/**
 * Call once a member is signed in, so RevenueCat's `app_user_id` is our own
 * Supabase user id — the id `sync-entitlement` and the webhook both key off.
 */
export function configureBilling(userId: string): void {
  const RC = loadPurchases();
  if (!RC || !config.revenueCatAndroidApiKey || configuredFor === userId) return;
  RC.configure({ apiKey: config.revenueCatAndroidApiKey, appUserID: userId });
  configuredFor = userId;
}

/** Drops the RevenueCat identity on sign-out, so the next account on this device starts clean. */
export async function logOutBilling(): Promise<void> {
  const RC = loadPurchases();
  if (!RC || !configuredFor) return;
  configuredFor = null;
  try {
    await RC.logOut();
  } catch {
    // Already logged out, or never fully configured — nothing to undo.
  }
}

export interface ExplorePlusPackages {
  monthly: ExplorePlusPackage | null;
  yearly: ExplorePlusPackage | null;
}

/** The current offering's packages, or null if billing isn't available on this build/device. */
export async function fetchExplorePlusPackages(): Promise<ExplorePlusPackages | null> {
  const RC = loadPurchases();
  if (!RC || !config.revenueCatAndroidApiKey) return null;
  const offerings = await RC.getOfferings();
  const current = offerings.current;
  if (!current) return null;
  return { monthly: current.monthly, yearly: current.annual };
}

export class PurchaseCancelledError extends Error {}

/** Runs the Play purchase sheet. Resolves once RevenueCat reports the entitlement active. */
export async function purchaseExplorePlus(pkg: ExplorePlusPackage): Promise<boolean> {
  const RC = loadPurchases();
  if (!RC) return false;
  try {
    const { customerInfo } = await RC.purchasePackage(pkg);
    return Boolean(customerInfo.entitlements.active[EXPLORE_PLUS_ENTITLEMENT]);
  } catch (e) {
    const code = (e as { code?: unknown })?.code;
    if (code === RC.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
      throw new PurchaseCancelledError();
    }
    throw e;
  }
}

export async function restoreExplorePlus(): Promise<boolean> {
  const RC = loadPurchases();
  if (!RC) return false;
  const info = await RC.restorePurchases();
  return Boolean(info.entitlements.active[EXPLORE_PLUS_ENTITLEMENT]);
}

/**
 * Asks `sync-entitlement` to check RevenueCat's own record for this member and
 * grant or revoke accordingly. The purchase above only unlocks the ask — this
 * is the write that actually reaches `profiles.is_explore_plus`.
 */
export async function syncExplorePlusEntitlement(): Promise<void> {
  const { error } = await supabase.functions.invoke('sync-entitlement');
  if (error) throw error;
}
