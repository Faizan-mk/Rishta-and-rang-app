import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { LanguageProvider, useLanguage } from '../LanguageContext';
import { translate } from '../../i18n';

function renderLanguage() {
  return renderHook(() => useLanguage(), { wrapper: ({ children }) => <LanguageProvider>{children}</LanguageProvider> });
}

describe('LanguageProvider', () => {
  it('defaults to English and left-to-right', () => {
    const { result } = renderLanguage();
    expect(result.current.language).toBe('en');
    expect(result.current.rtl).toBe(false);
  });

  it('t() delegates to the real translate() for the active language', () => {
    const { result } = renderLanguage();
    expect(result.current.t('common.save')).toBe(translate('en', 'common.save'));
  });

  it('switches language and flips rtl for Urdu', () => {
    const { result } = renderLanguage();
    act(() => {
      result.current.setLanguage('ur');
    });
    expect(result.current.language).toBe('ur');
    expect(result.current.rtl).toBe(true);
    expect(result.current.t('common.save')).toBe(translate('ur', 'common.save'));
  });

  it('stays left-to-right for the roman-script option', () => {
    const { result } = renderLanguage();
    act(() => {
      result.current.setLanguage('roman');
    });
    expect(result.current.rtl).toBe(false);
  });
});

describe('useLanguage', () => {
  it('throws when used outside a LanguageProvider', () => {
    const { result } = renderHook(() => {
      try {
        return useLanguage();
      } catch (e) {
        return e;
      }
    });
    expect(result.current).toBeInstanceOf(Error);
  });
});
