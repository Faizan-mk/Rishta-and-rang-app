import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { OnboardingProvider, useOnboarding } from '../onboardingStore';
import type { OnboardingDraft } from '../../types/user';

function renderOnboarding() {
  return renderHook(() => useOnboarding(), {
    wrapper: ({ children }) => <OnboardingProvider>{children}</OnboardingProvider>,
  });
}

function draft(overrides: Partial<OnboardingDraft> = {}): OnboardingDraft {
  return {
    fullName: 'Ayesha',
    email: 'a@example.com',
    password: 'Password1!',
    dob: '1998-01-01',
    gender: 'female',
    city: 'Lahore',
    cnicNumber: '12345-1234567-8',
    ...overrides,
  };
}

describe('OnboardingProvider', () => {
  it('starts with no draft', () => {
    const { result } = renderOnboarding();
    expect(result.current.draft).toBeNull();
  });

  it('startDraft sets the draft', () => {
    const { result } = renderOnboarding();
    act(() => {
      result.current.startDraft(draft());
    });
    expect(result.current.draft?.fullName).toBe('Ayesha');
  });

  it('patchDraft merges fields into an existing draft', () => {
    const { result } = renderOnboarding();
    act(() => {
      result.current.startDraft(draft());
    });
    act(() => {
      result.current.patchDraft({ city: 'Karachi', bio: 'Hello' });
    });
    expect(result.current.draft).toMatchObject({ fullName: 'Ayesha', city: 'Karachi', bio: 'Hello' });
  });

  it('patchDraft is a no-op when there is no draft yet', () => {
    const { result } = renderOnboarding();
    act(() => {
      result.current.patchDraft({ city: 'Karachi' });
    });
    expect(result.current.draft).toBeNull();
  });

  it('clearDraft resets to null', () => {
    const { result } = renderOnboarding();
    act(() => {
      result.current.startDraft(draft());
    });
    act(() => {
      result.current.clearDraft();
    });
    expect(result.current.draft).toBeNull();
  });
});

describe('useOnboarding', () => {
  it('throws when used outside an OnboardingProvider', () => {
    const { result } = renderHook(() => {
      try {
        return useOnboarding();
      } catch (e) {
        return e;
      }
    });
    expect(result.current).toBeInstanceOf(Error);
  });
});
