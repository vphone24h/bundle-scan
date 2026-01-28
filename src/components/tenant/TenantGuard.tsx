import { ReactNode, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useCurrentTenant, usePlatformUser } from '@/hooks/useTenant';
import { Loader2 } from 'lucide-react';

interface TenantGuardProps {
  children: ReactNode;
  allowExpired?: boolean;
}

/**
 * Determine effective tenant status based on dates
 * This ensures real-time status check regardless of DB status field
 */
function getEffectiveStatus(tenant: {
  status: string;
  trial_end_date: string;
  subscription_end_date: string | null;
}): 'trial' | 'active' | 'expired' | 'locked' {
  // If locked, always return locked
  if (tenant.status === 'locked') {
    return 'locked';
  }

  const now = new Date();
  
  // Check subscription first (has priority over trial)
  if (tenant.subscription_end_date) {
    const subEndDate = new Date(tenant.subscription_end_date);
    if (subEndDate > now) {
      return 'active';
    }
    // Subscription expired
    return 'expired';
  }
  
  // Check trial period
  const trialEndDate = new Date(tenant.trial_end_date);
  if (trialEndDate > now) {
    return 'trial';
  }
  
  // Trial expired
  return 'expired';
}

/**
 * Guard component that checks tenant status and restricts access
 * to certain features when tenant is expired or locked.
 * 
 * - Trial: 30 days free after registration
 * - Active: Paid subscription active
 * - Expired: Trial or subscription ended - can only access /subscription
 * - Locked: Admin locked - can only access /subscription
 */
export function TenantGuard({ children, allowExpired = false }: TenantGuardProps) {
  const { data: tenant, isLoading: tenantLoading } = useCurrentTenant();
  const { data: platformUser, isLoading: platformUserLoading } = usePlatformUser();

  const isLoading = tenantLoading || platformUserLoading;

  // Calculate effective status based on dates
  const effectiveStatus = useMemo(() => {
    if (!tenant) return null;
    return getEffectiveStatus(tenant);
  }, [tenant]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Platform admin bypass - they can access everything
  if (platformUser?.platform_role === 'platform_admin') {
    return <>{children}</>;
  }

  // If tenant is locked, redirect to subscription page
  if (effectiveStatus === 'locked') {
    return <Navigate to="/subscription" replace />;
  }

  // If tenant is expired and this route doesn't allow expired access
  if (effectiveStatus === 'expired' && !allowExpired) {
    return <Navigate to="/subscription" replace />;
  }

  return <>{children}</>;
}