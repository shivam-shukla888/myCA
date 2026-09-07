'use client';

import React from 'react';
import { useAuth } from '../../context/AuthContext';

export function MainCanvas({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return (
    <main className="content-canvas" role="main" key={user?.id || 'anonymous'}>
      {children}
    </main>
  );
}
