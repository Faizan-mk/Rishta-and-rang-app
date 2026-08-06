import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authService, SignupInput } from '../services/authService';
import type { UserProfile } from '../types/user';

interface AuthContextValue {
  user: UserProfile | null;
  initializing: boolean;
  signup: (input: SignupInput) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updated: UserProfile) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    authService
      .getCurrentUser()
      .then(setUser)
      .finally(() => setInitializing(false));
  }, []);

  const signup = useCallback(async (input: SignupInput) => {
    const created = await authService.signup(input);
    setUser(created);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const found = await authService.login(email, password);
    setUser(found);
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  const updateUser = useCallback(async (updated: UserProfile) => {
    const saved = await authService.updateUser(updated);
    setUser(saved);
  }, []);

  const deleteAccount = useCallback(async () => {
    if (!user) return;
    await authService.deleteAccount(user.id, user.email);
    setUser(null);
  }, [user]);

  const value = useMemo(
    () => ({ user, initializing, signup, login, logout, updateUser, deleteAccount }),
    [user, initializing, signup, login, logout, updateUser, deleteAccount]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
