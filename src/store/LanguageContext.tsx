import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { translate, isRTL } from '../i18n';
import type { AppLanguage } from '../types/user';

type TranslateParams = Record<string, string | number>;

interface LanguageContextValue {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  t: (path: string, params?: TranslateParams) => string;
  rtl: boolean;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<AppLanguage>('en');

  const t = useCallback((path: string, params?: TranslateParams) => translate(language, path, params), [language]);

  const value = useMemo(
    () => ({ language, setLanguage, t, rtl: isRTL(language) }),
    [language, t]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}
