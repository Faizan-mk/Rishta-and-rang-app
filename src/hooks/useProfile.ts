import { useMemo } from 'react';
import { useAuth } from '../store/authStore';
import { profileCompletion } from '../utils/profileCompletion';
import type { UserProfile } from '../types/user';

interface UseProfileResult {
  profile: UserProfile | null;
  /** 0-100, the same score the profile screen shows. */
  completion: number;
  updateProfile: (updated: UserProfile) => Promise<UserProfile>;
}

// Profile-shaped view of the auth store, for screens that care about the
// member's own profile rather than about being signed in.
export function useProfile(): UseProfileResult {
  const { user, updateUser } = useAuth();

  const completion = useMemo(() => (user ? profileCompletion(user) : 0), [user]);

  return {
    profile: user,
    completion,
    updateProfile: updateUser,
  };
}
