import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { config } from '../../constants/Config';
import { supabase } from '../supabase';
import * as billingService from '../billingService';

jest.mock('../supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));
jest.mock('../../constants/Config', () => ({ config: { revenueCatAndroidApiKey: 'rc-android-key' } }));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { executionEnvironment: 'bare' },
  ExecutionEnvironment: { StoreClient: 'storeClient', Bare: 'bare', Standalone: 'standalone' },
}));

const PURCHASE_CANCELLED = 'PURCHASE_CANCELLED_ERROR';

const mockPurchases = {
  configure: jest.fn(),
  logOut: jest.fn(),
  getOfferings: jest.fn(),
  purchasePackage: jest.fn(),
  restorePurchases: jest.fn(),
  PURCHASES_ERROR_CODE: { PURCHASE_CANCELLED_ERROR: PURCHASE_CANCELLED },
};

jest.mock('react-native-purchases', () => ({ __esModule: true, default: mockPurchases }));

const invoke = supabase.functions.invoke as jest.Mock;

function setPlatform(os: string) {
  (Platform as unknown as { OS: string }).OS = os;
}

function setExpoGo(isExpoGo: boolean) {
  (Constants as unknown as { executionEnvironment: string }).executionEnvironment = isExpoGo
    ? ExecutionEnvironment.StoreClient
    : 'bare';
}

beforeEach(() => {
  jest.clearAllMocks();
  setPlatform('android');
  setExpoGo(false);
  (config as unknown as { revenueCatAndroidApiKey: string }).revenueCatAndroidApiKey = 'rc-android-key';
});

// `configureBilling`'s "already configured" memo is module-level state, so
// each scenario below uses its own member id to stay independent of the
// others' calls — only the dedupe test itself relies on reusing one id.
describe('configureBilling', () => {
  it('configures RevenueCat with the member id as appUserID', () => {
    billingService.configureBilling('config-u1');
    expect(mockPurchases.configure).toHaveBeenCalledWith({ apiKey: 'rc-android-key', appUserID: 'config-u1' });
  });

  it('does nothing on iOS — no key or store setup for it yet', () => {
    setPlatform('ios');
    billingService.configureBilling('config-u2');
    expect(mockPurchases.configure).not.toHaveBeenCalled();
  });

  it('does nothing without an API key configured', () => {
    (config as unknown as { revenueCatAndroidApiKey: string }).revenueCatAndroidApiKey = '';
    billingService.configureBilling('config-u3');
    expect(mockPurchases.configure).not.toHaveBeenCalled();
  });

  it('does nothing inside Expo Go', () => {
    setExpoGo(true);
    billingService.configureBilling('config-u4');
    expect(mockPurchases.configure).not.toHaveBeenCalled();
  });

  it('does not reconfigure for the same member twice', () => {
    billingService.configureBilling('config-dedupe');
    billingService.configureBilling('config-dedupe');
    expect(mockPurchases.configure).toHaveBeenCalledTimes(1);
  });
});

describe('logOutBilling', () => {
  it('logs the RevenueCat identity out once configured', async () => {
    billingService.configureBilling('logout-u1');
    await billingService.logOutBilling();
    expect(mockPurchases.logOut).toHaveBeenCalled();
  });

  it('lets a new member reconfigure after logout', async () => {
    billingService.configureBilling('logout-u2');
    await billingService.logOutBilling();
    billingService.configureBilling('logout-u2');
    expect(mockPurchases.configure).toHaveBeenCalledTimes(2);
  });

  it('swallows a logOut failure', async () => {
    billingService.configureBilling('logout-u3');
    mockPurchases.logOut.mockRejectedValue(new Error('network'));
    await expect(billingService.logOutBilling()).resolves.toBeUndefined();
  });
});

describe('fetchExplorePlusPackages', () => {
  it('returns null when RevenueCat is unavailable (Expo Go)', async () => {
    setExpoGo(true);
    await expect(billingService.fetchExplorePlusPackages()).resolves.toBeNull();
  });

  it('returns null without an API key', async () => {
    (config as unknown as { revenueCatAndroidApiKey: string }).revenueCatAndroidApiKey = '';
    await expect(billingService.fetchExplorePlusPackages()).resolves.toBeNull();
  });

  it('returns null when there is no current offering', async () => {
    mockPurchases.getOfferings.mockResolvedValue({ current: null });
    await expect(billingService.fetchExplorePlusPackages()).resolves.toBeNull();
  });

  it('maps the current offering to monthly/yearly packages', async () => {
    const monthly = { identifier: '$rc_monthly' };
    const annual = { identifier: '$rc_annual' };
    mockPurchases.getOfferings.mockResolvedValue({ current: { monthly, annual } });

    await expect(billingService.fetchExplorePlusPackages()).resolves.toEqual({ monthly, yearly: annual });
  });
});

describe('purchaseExplorePlus', () => {
  const pkg = { identifier: '$rc_monthly' } as never;

  it('returns false when RevenueCat is unavailable', async () => {
    setExpoGo(true);
    await expect(billingService.purchaseExplorePlus(pkg)).resolves.toBe(false);
  });

  it('returns true when the entitlement comes back active', async () => {
    mockPurchases.purchasePackage.mockResolvedValue({
      customerInfo: { entitlements: { active: { explore_plus: {} } } },
    });
    await expect(billingService.purchaseExplorePlus(pkg)).resolves.toBe(true);
  });

  it('returns false when the purchase succeeds but the entitlement is not active', async () => {
    mockPurchases.purchasePackage.mockResolvedValue({ customerInfo: { entitlements: { active: {} } } });
    await expect(billingService.purchaseExplorePlus(pkg)).resolves.toBe(false);
  });

  it('throws PurchaseCancelledError when the member dismisses the Play sheet', async () => {
    mockPurchases.purchasePackage.mockRejectedValue({ code: PURCHASE_CANCELLED });
    await expect(billingService.purchaseExplorePlus(pkg)).rejects.toBeInstanceOf(billingService.PurchaseCancelledError);
  });

  it('rethrows any other purchase error', async () => {
    const error = new Error('network down');
    mockPurchases.purchasePackage.mockRejectedValue(error);
    await expect(billingService.purchaseExplorePlus(pkg)).rejects.toBe(error);
  });
});

describe('restoreExplorePlus', () => {
  it('returns true when a restored purchase carries the entitlement', async () => {
    mockPurchases.restorePurchases.mockResolvedValue({ entitlements: { active: { explore_plus: {} } } });
    await expect(billingService.restoreExplorePlus()).resolves.toBe(true);
  });

  it('returns false when RevenueCat is unavailable', async () => {
    setPlatform('ios');
    await expect(billingService.restoreExplorePlus()).resolves.toBe(false);
  });
});

describe('syncExplorePlusEntitlement', () => {
  it('invokes the sync-entitlement Edge Function', async () => {
    invoke.mockResolvedValue({ error: null });
    await billingService.syncExplorePlusEntitlement();
    expect(invoke).toHaveBeenCalledWith('sync-entitlement');
  });

  it('throws when the function reports an error', async () => {
    invoke.mockResolvedValue({ error: new Error('billing_not_configured') });
    await expect(billingService.syncExplorePlusEntitlement()).rejects.toThrow('billing_not_configured');
  });
});
