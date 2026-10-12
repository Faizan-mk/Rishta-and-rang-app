import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance } from 'react-native';
import { storage } from '../services/storage';
import { APP_THEMES, AppThemeId, DEFAULT_THEME_ID, Palette } from '../theme/palettes';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  mode: ThemeMode;
  resolvedMode: 'light' | 'dark';
  isDark: boolean;
  colors: Palette;
  setMode: (mode: ThemeMode) => void;
  themeId: AppThemeId;
  setThemeId: (id: AppThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [themeId, setThemeIdState] = useState<AppThemeId>(DEFAULT_THEME_ID);
  const [systemScheme, setSystemScheme] = useState(Appearance.getColorScheme() ?? 'light');

  useEffect(() => {
    storage.getJSON<ThemeMode>(storage.KEYS.themeMode, 'system').then(setModeState);
    // A stored id from a theme that has since been removed falls back to the default.
    storage.getJSON<AppThemeId>(storage.KEYS.appTheme, DEFAULT_THEME_ID).then((id) => {
      if (id in APP_THEMES) setThemeIdState(id);
    });
  }, []);

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme ?? 'light');
    });
    return () => sub.remove();
  }, []);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    storage.setJSON(storage.KEYS.themeMode, next);
  };

  const setThemeId = (next: AppThemeId) => {
    setThemeIdState(next);
    storage.setJSON(storage.KEYS.appTheme, next);
  };

  const resolvedMode: 'light' | 'dark' = mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      resolvedMode,
      isDark: resolvedMode === 'dark',
      colors: resolvedMode === 'dark' ? APP_THEMES[themeId].dark : APP_THEMES[themeId].light,
      setMode,
      themeId,
      setThemeId,
    }),
    [mode, resolvedMode, themeId]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
