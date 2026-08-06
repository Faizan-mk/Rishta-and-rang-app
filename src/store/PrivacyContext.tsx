import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { storage } from '../services/storage';

export interface PrivacyPrefs {
  profileVisible: boolean;
  onlineStatusVisible: boolean;
  blurPhotos: boolean;
}

export const DEFAULT_PRIVACY_PREFS: PrivacyPrefs = {
  profileVisible: true,
  onlineStatusVisible: true,
  blurPhotos: false,
};

interface PrivacyContextValue {
  prefs: PrivacyPrefs;
  setPref: (key: keyof PrivacyPrefs, value: boolean) => void;
}

const PrivacyContext = createContext<PrivacyContextValue | undefined>(undefined);

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<PrivacyPrefs>(DEFAULT_PRIVACY_PREFS);

  useEffect(() => {
    storage.getJSON(storage.KEYS.privacyPrefs, DEFAULT_PRIVACY_PREFS).then(setPrefs);
  }, []);

  const setPref = (key: keyof PrivacyPrefs, value: boolean) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      storage.setJSON(storage.KEYS.privacyPrefs, next);
      return next;
    });
  };

  const value = useMemo(() => ({ prefs, setPref }), [prefs]);

  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>;
}

export function usePrivacy(): PrivacyContextValue {
  const ctx = useContext(PrivacyContext);
  if (!ctx) throw new Error('usePrivacy must be used within a PrivacyProvider');
  return ctx;
}
