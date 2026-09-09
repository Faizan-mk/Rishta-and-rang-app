import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../AuthContext';
import { authService } from '../../services/authService';
import { supabase } from '../../services/supabase';
import { cache } from '../../services/cache';
import type { UserProfile } from '../../types/user';

jest.mock('../../services/authService', () => ({
  authService: {
    touchLastActive: jest.fn().mockResolvedValue(undefined),
    getCurrentUser: jest.fn(),
    signup: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    updateUser: jest.fn(),
    setActiveMode: jest.fn(),
    setIntent: jest.fn(),
    setReadiness: jest.fn(),
    deleteAccount: jest.fn(),
  },
}));

jest.mock('../../services/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: jest.fn(),
      getSession: jest.fn(),
    },
  },
}));

jest.mock('../../services/cache', () => ({
  cache: { read: jest.fn(), write: jest.fn(), clearUser: jest.fn() },
  CACHE_KEYS: { profile: 'profile' },
}));

const onAuthStateChange = supabase.auth.onAuthStateChange as jest.Mock;
const getSession = supabase.auth.getSession as jest.Mock;

function baseProfile(overrides: Partial<UserProfile> = {}): UserProfile {
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

let authChangeHandler: (event: string, session: unknown) => void;

beforeEach(() => {
  jest.clearAllMocks();
  (cache.read as jest.Mock).mockResolvedValue(null);
  (cache.write as jest.Mock).mockResolvedValue(undefined);
  (cache.clearUser as jest.Mock).mockResolvedValue(undefined);
  onAuthStateChange.mockImplementation((cb: typeof authChangeHandler) => {
    authChangeHandler = cb;
    return { data: { subscription: { unsubscribe: jest.fn() } } };
  });
  getSession.mockResolvedValue({ data: { session: null } });
});

function renderAuth() {
  return renderHook(() => useAuth(), { wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider> });
}

describe('AuthProvider hydration', () => {
  it('starts initializing and settles to signed-out when there is no session', async () => {
    const { result } = renderAuth();
    expect(result.current.initializing).toBe(true);

    await waitFor(() => expect(result.current.initializing).toBe(false));
    expect(result.current.user).toBeNull();
  });

  it('hydrates the user from a restored session', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    (authService.getCurrentUser as jest.Mock).mockResolvedValue(baseProfile());

    const { result } = renderAuth();

    await waitFor(() => expect(result.current.user?.id).toBe('u1'));
    expect(result.current.initializing).toBe(false);
    expect(authService.touchLastActive).toHaveBeenCalledWith('u1');
  });

  it('shows the cached profile immediately, then replaces it with the fresh one', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    (cache.read as jest.Mock).mockResolvedValue(baseProfile({ fullName: 'Cached Name' }));
    let resolveFresh!: (value: UserProfile) => void;
    (authService.getCurrentUser as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveFresh = resolve;
      })
    );

    const { result } = renderAuth();

    await waitFor(() => expect(result.current.user?.fullName).toBe('Cached Name'));
    expect(result.current.initializing).toBe(false); // cache alone is enough to stop the spinner

    await act(async () => {
      resolveFresh(baseProfile({ fullName: 'Fresh Name' }));
    });
    await waitFor(() => expect(result.current.user?.fullName).toBe('Fresh Name'));
  });

  it('falls back to signed-out on a failed fetch with nothing cached', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    (authService.getCurrentUser as jest.Mock).mockRejectedValue(new Error('offline'));

    const { result } = renderAuth();

    await waitFor(() => expect(result.current.initializing).toBe(false));
    expect(result.current.user).toBeNull();
  });

  it('stays on the cached profile when offline rather than signing out', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    (cache.read as jest.Mock).mockResolvedValue(baseProfile({ fullName: 'Cached Name' }));
    (authService.getCurrentUser as jest.Mock).mockRejectedValue(new Error('offline'));

    const { result } = renderAuth();

    await waitFor(() => expect(result.current.initializing).toBe(false));
    expect(result.current.user?.fullName).toBe('Cached Name');
  });

  it('reacts to a SIGNED_OUT auth state change by clearing the user', async () => {
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.initializing).toBe(false));

    (authService.getCurrentUser as jest.Mock).mockResolvedValue(baseProfile());
    await act(async () => {
      authChangeHandler('SIGNED_IN', { user: { id: 'u1' } });
    });
    await waitFor(() => expect(result.current.user?.id).toBe('u1'));

    act(() => {
      authChangeHandler('SIGNED_OUT', null);
    });
    expect(result.current.user).toBeNull();
  });

  it('ignores a TOKEN_REFRESHED event rather than re-hydrating', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    (authService.getCurrentUser as jest.Mock).mockResolvedValue(baseProfile());
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.user?.id).toBe('u1'));

    (authService.getCurrentUser as jest.Mock).mockClear();
    act(() => {
      authChangeHandler('TOKEN_REFRESHED', { user: { id: 'u1' } });
    });
    expect(authService.getCurrentUser).not.toHaveBeenCalled();
  });
});

describe('AuthProvider.signup / login / logout', () => {
  it('signup sets the user returned by authService and caches it', async () => {
    (authService.signup as jest.Mock).mockResolvedValue(baseProfile());
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.initializing).toBe(false));

    await act(async () => {
      await result.current.signup({
        fullName: 'Ayesha',
        email: 'a@example.com',
        password: 'Password1!',
        dob: '1998-01-01',
        gender: 'female',
        city: 'Lahore',
        intent: 'matrimonial',
        language: 'en',
        cnicNumber: '12345-1234567-8',
      });
    });

    expect(result.current.user?.id).toBe('u1');
    expect(cache.write).toHaveBeenCalledWith('u1', 'profile', expect.objectContaining({ id: 'u1' }));
  });

  it('login sets the user on success', async () => {
    (authService.login as jest.Mock).mockResolvedValue(baseProfile());
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.initializing).toBe(false));

    await act(async () => {
      await result.current.login('a@example.com', 'Password1!');
    });

    expect(result.current.user?.id).toBe('u1');
  });

  it('login propagates the error and does not set a user on failure', async () => {
    (authService.login as jest.Mock).mockRejectedValue(new Error('invalid credentials'));
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.initializing).toBe(false));

    await act(async () => {
      await expect(result.current.login('a@example.com', 'wrong')).rejects.toThrow('invalid credentials');
    });
    expect(result.current.user).toBeNull();
  });

  it('logout clears the user and this user’s cache', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    (authService.getCurrentUser as jest.Mock).mockResolvedValue(baseProfile());
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.user?.id).toBe('u1'));

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(cache.clearUser).toHaveBeenCalledWith('u1');
  });
});

describe('AuthProvider optimistic writes', () => {
  it('setActiveMode flips immediately and keeps the value on a successful write', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    (authService.getCurrentUser as jest.Mock).mockResolvedValue(baseProfile({ activeMode: 'rishta' }));
    (authService.setActiveMode as jest.Mock).mockResolvedValue(undefined);
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.user?.activeMode).toBe('rishta'));

    act(() => {
      result.current.setActiveMode('dating');
    });

    expect(result.current.user?.activeMode).toBe('dating'); // optimistic, before the write settles
    await waitFor(() => expect(authService.setActiveMode).toHaveBeenCalledWith('u1', 'dating'));
  });

  it('setActiveMode rolls back to the previous value when the write fails', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    (authService.getCurrentUser as jest.Mock).mockResolvedValue(baseProfile({ activeMode: 'rishta' }));
    (authService.setActiveMode as jest.Mock).mockRejectedValue(new Error('offline'));
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.user?.activeMode).toBe('rishta'));

    await act(async () => {
      result.current.setActiveMode('dating');
      await Promise.resolve(); // let the rejected write settle
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.user?.activeMode).toBe('rishta'));
  });

  it('setActiveMode is a no-op when the mode is already current', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    (authService.getCurrentUser as jest.Mock).mockResolvedValue(baseProfile({ activeMode: 'rishta' }));
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.user?.activeMode).toBe('rishta'));

    act(() => {
      result.current.setActiveMode('rishta');
    });

    expect(authService.setActiveMode).not.toHaveBeenCalled();
  });

  it('setIntent switches the active mode to rishta for a matrimonial intent', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    (authService.getCurrentUser as jest.Mock).mockResolvedValue(baseProfile({ intent: 'casual', activeMode: 'dating' }));
    (authService.setIntent as jest.Mock).mockResolvedValue(undefined);
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.user?.intent).toBe('casual'));

    act(() => {
      result.current.setIntent('matrimonial');
    });

    expect(result.current.user?.activeMode).toBe('rishta');
  });
});

describe('AuthProvider.updateUser / deleteAccount', () => {
  it('updateUser saves and returns the server-kept row', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    (authService.getCurrentUser as jest.Mock).mockResolvedValue(baseProfile());
    (authService.updateUser as jest.Mock).mockResolvedValue(baseProfile({ fullName: 'Updated Name' }));
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.user?.id).toBe('u1'));

    let saved: UserProfile | undefined;
    await act(async () => {
      saved = await result.current.updateUser(baseProfile({ fullName: 'Updated Name' }));
    });

    expect(saved?.fullName).toBe('Updated Name');
    expect(result.current.user?.fullName).toBe('Updated Name');
  });

  it('deleteAccount clears the user and cache', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    (authService.getCurrentUser as jest.Mock).mockResolvedValue(baseProfile());
    (authService.deleteAccount as jest.Mock).mockResolvedValue(undefined);
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.user?.id).toBe('u1'));

    await act(async () => {
      await result.current.deleteAccount();
    });

    expect(result.current.user).toBeNull();
    expect(cache.clearUser).toHaveBeenCalledWith('u1');
  });
});

describe('useAuth', () => {
  it('throws when used outside an AuthProvider', () => {
    const { result } = renderHook(() => {
      try {
        return useAuth();
      } catch (e) {
        return e;
      }
    });
    expect(result.current).toBeInstanceOf(Error);
  });
});
