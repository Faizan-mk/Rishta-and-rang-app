import { useEffect } from 'react';
import { configureBilling, logOutBilling } from '../services/billingService';
import { useAuth } from '../store/AuthContext';

/**
 * Points RevenueCat at this member once they're signed in, and logs it out
 * again on sign-out — the same shape as usePushRegistration, one device
 * identity swapped for another account's.
 *
 * Silent by design: no Android key yet, no native module in Expo Go, and no
 * network are all ordinary states this app already runs in, and none of them
 * should be a startup error.
 */
export function useBillingRegistration(): void {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      logOutBilling().catch(() => undefined);
      return;
    }
    configureBilling(user.id);
  }, [user?.id]);
}
