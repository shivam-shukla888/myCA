'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi, setAuthToken, getAuthToken } from '../lib/api';

export interface UserProfile {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
  full_name?: string;
  business_type?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => void;
  setUserDirectly: (user: UserProfile, token: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function initAuth() {
      const storedToken = getAuthToken();

      if (!storedToken) {
        setToken(null);
        setUser(null);
        setIsLoading(false);
        return;
      }

      setToken(storedToken);
      try {
        const profile = await authApi.getMe();
        setUser({
          id: profile.id,
          email: (profile as Record<string, unknown>).email as string || '',
          role: profile.role,
          full_name: profile.full_name,
          business_type: profile.business_type,
        });
      } catch (e: unknown) {
        console.warn('[AuthContext] Failed to restore auth session:', e);
        // Token is invalid or expired, clear session
        setAuthToken(null);
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    initAuth();
  }, []);

  // Multi-tab session synchronization
  useEffect(() => {
    function handleStorageChange(e: StorageEvent) {
      if (e.key === 'personal_ca_auth_token') {
        if (!e.newValue) {
          setUser(null);
          setToken(null);
        } else if (e.newValue !== token) {
          setToken(e.newValue);
          authApi.getMe().then((p) => {
            setUser({
              id: p.id,
              email: (p as Record<string, unknown>).email as string || '',
              role: p.role,
              full_name: p.full_name,
              business_type: p.business_type,
            });
          }).catch(() => {
            setUser(null);
            setToken(null);
          });
        }
      }
    }
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [token]);

  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      const res = await authApi.login({ email, password: pass });
      const accessToken = res.session.access_token;
      const refreshToken = res.session.refresh_token;
      setAuthToken(accessToken);
      if (typeof window !== 'undefined' && refreshToken) {
        localStorage.setItem('personal_ca_refresh_token', refreshToken);
      }
      setToken(accessToken);
      setUser({
        id: res.user.id,
        email: res.user.email,
        role: res.user.role,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    // Call backend logout endpoint to clear httpOnly session cookie
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
      await fetch(`${baseUrl ? `${baseUrl}` : ''}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (e) {
      console.warn('Logout backend call failed:', e);
    }
    // Clear client-side tokens
    setAuthToken(null);
    setToken(null);
    setUser(null);
  };

  const setUserDirectly = (newUser: UserProfile, newToken: string) => {
    if (process.env.NODE_ENV !== 'development' && newToken.startsWith('mock-test-token:')) {
      console.warn('[Auth] Mock tokens are strictly rejected in production');
      return;
    }
    setAuthToken(newToken);
    setToken(newToken);
    setUser(newUser);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(user),
        isLoading,
        login,
        logout,
        setUserDirectly,
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
