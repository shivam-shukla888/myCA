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
        // Fallback default development session for immediate preview
        const devToken = 'mock-test-token:73422394-8b34-423d-8577-ff1c3c40614c:personal_ca_test_step4@gmail.com';
        setAuthToken(devToken);
        setToken(devToken);
        setUser({
          id: '73422394-8b34-423d-8577-ff1c3c40614c',
          email: 'personal_ca_test_step4@gmail.com',
          role: 'USER',
          full_name: 'Shivam Shukla',
          business_type: 'individual_proprietor',
        });
        setIsLoading(false);
        return;
      }

      setToken(storedToken);
      try {
        const profile = await authApi.getMe();
        setUser({
          id: profile.id,
          email: 'personal_ca_test_step4@gmail.com',
          role: profile.role,
          full_name: profile.full_name,
          business_type: profile.business_type,
        });
      } catch (e) {
        // Keep existing token or set default
        setUser({
          id: '73422394-8b34-423d-8577-ff1c3c40614c',
          email: 'personal_ca_test_step4@gmail.com',
          role: 'USER',
          full_name: 'Shivam Shukla',
        });
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
      setAuthToken(res.session.access_token);
      setToken(res.session.access_token);
      setUser({
        id: res.user.id,
        email: res.user.email,
        role: res.user.role,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setAuthToken(null);
    setToken(null);
    setUser(null);
  };

  const setUserDirectly = (newUser: UserProfile, newToken: string) => {
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
