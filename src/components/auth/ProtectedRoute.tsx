import { ReactNode, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  // While loading auth, render children immediately so the layout shell appears.
  // Children (TenantGuard / pages) will show their own skeleton/loading states.
  // Only redirect to /auth once we are sure there is no user.
  if (loading) {
    // Still loading – render children so the shell (sidebar etc.) shows instantly.
    // Pages should handle their own data-loading states gracefully.
    return <>{children}</>;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}
