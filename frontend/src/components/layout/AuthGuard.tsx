import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';

type AuthGuardProps = {
  children: React.ReactNode;
};

export default function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Redirect unauthenticated users to login page
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    // Optionally render a loading placeholder
    return <div>Loading...</div>;
  }

  // While redirect is happening, render nothing to avoid flash of content
  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
