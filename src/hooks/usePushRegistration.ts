import { useEffect, useRef } from 'react';
import { pushService } from '../services/pushService';
import { useAuth } from '../store/AuthContext';

/**
 * Registers this device for push once a member is signed in, and drops it again
 * when they sign out.
 *
 * Silent about failure on purpose. A member who declines the permission, a
 * simulator with no push hardware, or a build without FCM credentials all end
 * up in the same place — no token — and none of them is a reason to interrupt
 * someone who opened the app to look at their matches.
 */
export function usePushRegistration(): void {
  const { user } = useAuth();
  // Held so sign-out can unregister the exact token sign-in stored.
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!user) {
      const token = tokenRef.current;
      tokenRef.current = null;
      if (token) pushService.unregisterPushToken(token).catch(() => undefined);
      return;
    }

    (async () => {
      const token = await pushService.requestPushToken();
      if (cancelled || !token) return;
      tokenRef.current = token;
      await pushService.registerPushToken(token);
    })().catch(() => {
      // Offline, or the RPC is not deployed yet. The next sign-in tries again.
    });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);
}
