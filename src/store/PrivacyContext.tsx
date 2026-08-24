import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { privacyService } from '../services/privacyService';
import { DEFAULT_PRIVACY_PREFS, PrivacyPrefs } from '../types/content';
import { useAuth } from './AuthContext';

export type { PrivacyPrefs };
export { DEFAULT_PRIVACY_PREFS };

interface PrivacyContextValue {
  prefs: PrivacyPrefs;
  setPref: (key: keyof PrivacyPrefs, value: boolean) => void;
}

const PrivacyContext = createContext<PrivacyContextValue | undefined>(undefined);

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<PrivacyPrefs>(DEFAULT_PRIVACY_PREFS);

  useEffect(() => {
    if (!user) {
      setPrefs(DEFAULT_PRIVACY_PREFS);
      return;
    }
    privacyService.fetchPrefs(user.id).then(setPrefs);
  }, [user?.id]);

  const setPref = (key: keyof PrivacyPrefs, value: boolean) => {
    if (!user) return;
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      privacyService.setPrefs(user.id, next);
      return next;
    });
  };

  const value = useMemo(() => ({ prefs, setPref }), [prefs, user?.id]);

  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>;
}

export function usePrivacy(): PrivacyContextValue {
  const ctx = useContext(PrivacyContext);
  if (!ctx) throw new Error('usePrivacy must be used within a PrivacyProvider');
  return ctx;
}
