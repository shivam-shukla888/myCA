'use client';

import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { AuthRequiredState } from '../auth/AuthRequiredState';

export interface AuthGuardProps {
  children: React.ReactNode;
  modeTag?: string;
  title?: string;
  description?: string;
}

export default function AuthGuard({
  children,
  modeTag = 'SECURE OPERATIONAL MODE',
  title = 'Identity Verification Required',
  description = 'This workspace area accesses isolated financial records and requires verified authentication.',
}: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        style={{
          padding: '64px 20px',
          textAlign: 'center',
          color: 'var(--ink-secondary)',
          fontFamily: 'var(--font-mono)',
          fontSize: '13px',
        }}
      >
        Verifying secure workspace session...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <AuthRequiredState
        modeTag={modeTag}
        title={title}
        description={description}
      />
    );
  }

  return <>{children}</>;
}
