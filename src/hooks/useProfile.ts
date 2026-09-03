import { useMemo } from 'react';
import { useAuth } from '../store/authStore';
import { profileCompletion } from '../utils/profileCompletion';
import type { ProfileMode, UserProfile } from '../types/user';

interface UseProfileResult {
  profile: UserProfile | null;
  /** 0-100, the same score the profile screen shows. */
  completion: number;
  /** Which of the two faces of the app the member is currently in. */
  mode: ProfileMode;
  setMode: (mode: ProfileMode) => void;
  updateProfile: (updated: UserProfile) => Promise<UserProfile>;
}

// Profile-shaped view of the auth store, for screens that care about the
// member's own profile rather than about being signed in.
export function useProfile(): UseProfileResult {
  const { user, setActiveMode, updateUser } = useAuth();

  const completion = useMemo(() => (user ? profileCompletion(user) : 0), [user]);

  return {
    profile: user,
    completion,
    mode: user?.activeMode ?? 'dating',
    setMode: setActiveMode,
    updateProfile: updateUser,
  };
}
