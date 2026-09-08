import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// The single source of truth for "has this device seen the pre-welcome
// intro yet". RootNavigator uses it to structurally gate the whole (auth)
// group behind onboarding (see src/app/_layout.tsx) — the intro isn't just
// the default first route, it's the only reachable route until this flips
// true, so no direct link, restored nav state, or stale redirect can skip
// it. Bump the suffix if the intro changes enough that even devices which
// already saw it should see it again.
const ONBOARDING_SEEN_KEY = 'onboarding_seen_v4';

interface OnboardingGateValue {
  // null while the AsyncStorage read is still in flight.
  seenOnboarding: boolean | null;
  markOnboardingSeen: () => void;
  // Dev/testing escape hatch — flips the flag back off so the intro can be
  // replayed without clearing the device's storage or reinstalling the app.
  resetOnboardingSeen: () => void;
}

const OnboardingGateContext = createContext<OnboardingGateValue | undefined>(undefined);

export function OnboardingGateProvider({ children }: { children: React.ReactNode }) {
  const [seenOnboarding, setSeenOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_SEEN_KEY)
      .then((value) => setSeenOnboarding(value === '1'))
      .catch(() => setSeenOnboarding(true));
  }, []);

  const markOnboardingSeen = useCallback(() => {
    // Flip the in-memory flag immediately so the Stack.Protected guard in
    // RootNavigator re-renders and mounts the (auth) group in the same
    // pass — the AsyncStorage write is fire-and-forget persistence for next
    // launch, not what unblocks navigation right now.
    setSeenOnboarding(true);
    AsyncStorage.setItem(ONBOARDING_SEEN_KEY, '1').catch(() => {});
  }, []);

  const resetOnboardingSeen = useCallback(() => {
    setSeenOnboarding(false);
    AsyncStorage.removeItem(ONBOARDING_SEEN_KEY).catch(() => {});
  }, []);

  const value = useMemo(
    () => ({ seenOnboarding, markOnboardingSeen, resetOnboardingSeen }),
    [seenOnboarding, markOnboardingSeen, resetOnboardingSeen]
  );

  return <OnboardingGateContext.Provider value={value}>{children}</OnboardingGateContext.Provider>;
}

export function useOnboardingGate(): OnboardingGateValue {
  const ctx = useContext(OnboardingGateContext);
  if (!ctx) throw new Error('useOnboardingGate must be used within an OnboardingGateProvider');
  return ctx;
}
