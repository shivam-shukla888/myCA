'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../lib/api';

export interface UserProfile {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
  full_name?: string;
  business_type?: string;
  onboarding_completed?: boolean;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  signup: (email: string, pass: string, fullName: string) => Promise<{ requiresEmailVerification: boolean; message: string }>;
  logout: () => Promise<void>;
  setUserDirectly: (user: UserProfile, token?: string) => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshProfile = async () => {
    try {
      const profile = await authApi.getMe();
      setUser({
        id: profile.id,
        email: (profile as Record<string, unknown>).email as string || '',
        role: profile.role,
        full_name: profile.full_name,
        business_type: profile.business_type,
        onboarding_completed: profile.onboarding_completed,
      });
    } catch (e: unknown) {
      console.warn('[AuthContext] Failed to refresh profile:', e);
    }
  };

  useEffect(() => {
    async function initAuth() {
      try {
        const profile = await authApi.getMe();
        setUser({
          id: profile.id,
          email: (profile as Record<string, unknown>).email as string || '',
          role: profile.role,
          full_name: profile.full_name,
          business_type: profile.business_type,
          onboarding_completed: profile.onboarding_completed,
        });
      } catch (e: unknown) {
        console.warn('[AuthContext] No active session or failed to fetch profile:', e);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }
    initAuth();
  }, []);

  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      const res = await authApi.login({ email, password: pass });
      setUser({
        id: res.user.id,
        email: res.user.email,
        role: res.user.role,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (email: string, pass: string, fullName: string) => {
    setIsLoading(true);
    try {
      const res = await authApi.signup({
        email,
        password: pass,
        full_name: fullName,
      });

      if (res.session?.access_token) {
        setUser({
          id: res.user.id,
          email: res.user.email,
          role: (res.user.role as 'USER' | 'ADMIN') || 'USER',
          full_name: fullName,
          onboarding_completed: false,
        });

        return {
          requiresEmailVerification: false,
          message: res.message || 'Account created successfully',
        };
      } else {
        // Email verification required by Supabase Auth (session is null)
        return {
          requiresEmailVerification: true,
          message: res.message || 'Check your email to verify your account.',
        };
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    // Call backend logout endpoint to clear HttpOnly session cookies
    try {
      await authApi.logout();
    } catch (e) {
      console.warn('[AuthContext] Logout backend call failed:', e);
    }
    setUser(null);
  };

  const setUserDirectly = (newUser: UserProfile, _newToken?: string) => {
    setUser(newUser);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token: null,
        isAuthenticated: Boolean(user),
        isLoading,
        login,
        signup,
        logout,
        setUserDirectly,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
