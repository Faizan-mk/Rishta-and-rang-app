import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { OnboardingDraft } from '../types/user';

// The 3-step signup flow (signup -> intent-photos -> selfie-verification) builds
// one draft before a single account is created at the end. Under file-based
// routing the steps are separate URLs, and route params are strings — so the
// draft lives here in memory instead of being handed screen to screen.
interface OnboardingContextValue {
  draft: OnboardingDraft | null;
  startDraft: (draft: OnboardingDraft) => void;
  patchDraft: (patch: Partial<OnboardingDraft>) => void;
  clearDraft: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<OnboardingDraft | null>(null);

  const startDraft = useCallback((next: OnboardingDraft) => setDraft(next), []);
  const patchDraft = useCallback(
    (patch: Partial<OnboardingDraft>) => setDraft((prev) => (prev ? { ...prev, ...patch } : prev)),
    []
  );
  const clearDraft = useCallback(() => setDraft(null), []);

  const value = useMemo(
    () => ({ draft, startDraft, patchDraft, clearDraft }),
    [draft, startDraft, patchDraft, clearDraft]
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within an OnboardingProvider');
  return ctx;
}
