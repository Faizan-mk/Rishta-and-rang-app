import React from 'react';
import { renderHook } from '@testing-library/react-native';
import { useProfile } from '../useProfile';
import { useAuth } from '../../store/authStore';
import type { UserProfile } from '../../types/user';

jest.mock('../../store/authStore', () => ({ useAuth: jest.fn() }));

const mockUseAuth = useAuth as jest.Mock;

function profile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'u1',
    fullName: 'Ayesha',
    email: 'a@example.com',
    dob: '1998-01-01',
    gender: 'female',
    city: 'Lahore',
    bio: '',
    photos: [],
    selfieVerified: false,
    intent: 'matrimonial',
    language: 'en',
    dating: { vibeTags: [] },
    rishta: { religion: '', sect: '', familyBackground: '', education: '', readiness: 'browsing' },
    activeMode: 'rishta',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('useProfile', () => {
  it('returns 0 completion and dating default mode when signed out', () => {
    mockUseAuth.mockReturnValue({ user: null, setActiveMode: jest.fn(), updateUser: jest.fn() });
    const { result } = renderHook(() => useProfile());
    expect(result.current.profile).toBeNull();
    expect(result.current.completion).toBe(0);
    expect(result.current.mode).toBe('dating');
  });

  it('computes completion from the real profileCompletion logic', () => {
    const complete = profile({
      photos: ['a.jpg', 'b.jpg'],
      bio: 'Hello there',
      selfieVerified: true,
      city: 'Lahore',
      activeMode: 'rishta',
      rishta: { religion: 'Islam', sect: 'Sunni', familyBackground: '', education: 'BSc', readiness: 'ready_now' },
    });
    mockUseAuth.mockReturnValue({ user: complete, setActiveMode: jest.fn(), updateUser: jest.fn() });
    const { result } = renderHook(() => useProfile());
    expect(result.current.completion).toBe(100);
  });

  it('reflects the signed-in user activeMode', () => {
    mockUseAuth.mockReturnValue({ user: profile({ activeMode: 'dating' }), setActiveMode: jest.fn(), updateUser: jest.fn() });
    const { result } = renderHook(() => useProfile());
    expect(result.current.mode).toBe('dating');
  });

  it('delegates setMode to the auth store setActiveMode', () => {
    const setActiveMode = jest.fn();
    mockUseAuth.mockReturnValue({ user: profile(), setActiveMode, updateUser: jest.fn() });
    const { result } = renderHook(() => useProfile());

    result.current.setMode('dating');

    expect(setActiveMode).toHaveBeenCalledWith('dating');
  });

  it('delegates updateProfile to the auth store updateUser', async () => {
    const updateUser = jest.fn().mockResolvedValue(profile());
    mockUseAuth.mockReturnValue({ user: profile(), setActiveMode: jest.fn(), updateUser });
    const { result } = renderHook(() => useProfile());

    await result.current.updateProfile(profile());

    expect(updateUser).toHaveBeenCalled();
  });
});
