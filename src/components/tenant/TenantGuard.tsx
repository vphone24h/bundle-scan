import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useCurrentTenant } from '@/hooks/useTenant';
import { Loader2 } from 'lucide-react';

interface TenantGuardProps {
  children: ReactNode;
  allowExpired?: boolean;
}

/**
 * Guard component that checks tenant status and restricts access
 * to certain features when tenant is expired or locked
 */
export function TenantGuard({ children, allowExpired = false }: TenantGuardProps) {
  const { data: tenant, isLoading } = useCurrentTenant();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If tenant is locked, redirect to subscription page
  if (tenant?.status === 'locked') {
    return <Navigate to="/subscription" replace />;
  }

  // If tenant is expired and this route doesn't allow expired access
  if (tenant?.status === 'expired' && !allowExpired) {
    return <Navigate to="/subscription" replace />;
  }

  return <>{children}</>;
}