import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { OnboardingGateProvider, useOnboardingGate } from '../OnboardingGateContext';

const KEY = 'onboarding_seen_v4';

beforeEach(async () => {
  await AsyncStorage.clear();
});

function renderGate() {
  return renderHook(() => useOnboardingGate(), {
    wrapper: ({ children }) => <OnboardingGateProvider>{children}</OnboardingGateProvider>,
  });
}

describe('OnboardingGateProvider', () => {
  it('starts null while the AsyncStorage read is in flight, then resolves to unseen', async () => {
    const { result } = renderGate();
    expect(result.current.seenOnboarding).toBeNull();
    await waitFor(() => expect(result.current.seenOnboarding).toBe(false));
  });

  it('resolves to seen when the stored flag is set', async () => {
    await AsyncStorage.setItem(KEY, '1');
    const { result } = renderGate();
    await waitFor(() => expect(result.current.seenOnboarding).toBe(true));
  });

  it('markOnboardingSeen flips state immediately and persists it', async () => {
    const { result } = renderGate();
    await waitFor(() => expect(result.current.seenOnboarding).toBe(false));

    act(() => {
      result.current.markOnboardingSeen();
    });
    expect(result.current.seenOnboarding).toBe(true);

    await waitFor(async () => expect(await AsyncStorage.getItem(KEY)).toBe('1'));
  });

  it('resetOnboardingSeen flips state back and clears storage', async () => {
    await AsyncStorage.setItem(KEY, '1');
    const { result } = renderGate();
    await waitFor(() => expect(result.current.seenOnboarding).toBe(true));

    act(() => {
      result.current.resetOnboardingSeen();
    });
    expect(result.current.seenOnboarding).toBe(false);

    await waitFor(async () => expect(await AsyncStorage.getItem(KEY)).toBeNull());
  });

  it('treats a storage read failure as already seen, so a broken device is never stuck on the intro', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk error'));
    const { result } = renderGate();
    await waitFor(() => expect(result.current.seenOnboarding).toBe(true));
  });
});

describe('useOnboardingGate', () => {
  it('throws when used outside an OnboardingGateProvider', () => {
    const { result } = renderHook(() => {
      try {
        return useOnboardingGate();
      } catch (e) {
        return e;
      }
    });
    expect(result.current).toBeInstanceOf(Error);
  });
});
