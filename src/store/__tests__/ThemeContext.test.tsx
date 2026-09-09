import React from 'react';
import { Appearance } from 'react-native';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { ThemeProvider, useTheme } from '../ThemeContext';
import { storage } from '../../services/storage';
import { lightPalette, darkPalette } from '../../theme/palettes';

jest.mock('../../services/storage', () => ({
  storage: { KEYS: { themeMode: 'rishta.themeMode.v1' }, getJSON: jest.fn(), setJSON: jest.fn() },
}));

function renderTheme() {
  return renderHook(() => useTheme(), { wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider> });
}

beforeEach(() => {
  jest.clearAllMocks();
  (storage.getJSON as jest.Mock).mockResolvedValue('system');
  (storage.setJSON as jest.Mock).mockResolvedValue(undefined);
  jest.spyOn(Appearance, 'getColorScheme').mockReturnValue('light');
  jest.spyOn(Appearance, 'addChangeListener').mockReturnValue({ remove: jest.fn() });
});

describe('ThemeProvider', () => {
  it('defaults to system mode resolved against the current appearance', async () => {
    const { result } = renderTheme();
    await waitFor(() => expect(result.current.mode).toBe('system'));
    expect(result.current.resolvedMode).toBe('light');
    expect(result.current.isDark).toBe(false);
    expect(result.current.colors).toBe(lightPalette);
  });

  it('loads a previously saved mode from storage', async () => {
    (storage.getJSON as jest.Mock).mockResolvedValue('dark');
    const { result } = renderTheme();
    await waitFor(() => expect(result.current.mode).toBe('dark'));
    expect(result.current.isDark).toBe(true);
    expect(result.current.colors).toBe(darkPalette);
  });

  it('setMode updates state immediately and persists the choice', async () => {
    const { result } = renderTheme();
    await waitFor(() => expect(result.current.mode).toBe('system'));

    act(() => {
      result.current.setMode('dark');
    });

    expect(result.current.mode).toBe('dark');
    expect(result.current.isDark).toBe(true);
    expect(storage.setJSON).toHaveBeenCalledWith('rishta.themeMode.v1', 'dark');
  });

  it('resolves system mode to dark when the OS appearance is dark', async () => {
    (Appearance.getColorScheme as jest.Mock).mockReturnValue('dark');
    const { result } = renderTheme();
    await waitFor(() => expect(result.current.mode).toBe('system'));
    expect(result.current.resolvedMode).toBe('dark');
  });

  it('reacts to a system appearance change while in system mode', async () => {
    let listener!: (pref: { colorScheme: string | null | undefined }) => void;
    (Appearance.addChangeListener as jest.Mock).mockImplementation((cb) => {
      listener = cb;
      return { remove: jest.fn() };
    });
    const { result } = renderTheme();
    await waitFor(() => expect(result.current.mode).toBe('system'));
    expect(result.current.resolvedMode).toBe('light');

    act(() => {
      listener({ colorScheme: 'dark' });
    });

    expect(result.current.resolvedMode).toBe('dark');
  });

  it('an explicit mode ignores subsequent system appearance changes', async () => {
    let listener!: (pref: { colorScheme: string | null | undefined }) => void;
    (Appearance.addChangeListener as jest.Mock).mockImplementation((cb) => {
      listener = cb;
      return { remove: jest.fn() };
    });
    const { result } = renderTheme();
    await waitFor(() => expect(result.current.mode).toBe('system'));

    act(() => {
      result.current.setMode('light');
    });
    act(() => {
      listener({ colorScheme: 'dark' });
    });

    expect(result.current.resolvedMode).toBe('light');
  });
});

describe('useTheme', () => {
  it('throws when used outside a ThemeProvider', () => {
    const { result } = renderHook(() => {
      try {
        return useTheme();
      } catch (e) {
        return e;
      }
    });
    expect(result.current).toBeInstanceOf(Error);
  });
});
