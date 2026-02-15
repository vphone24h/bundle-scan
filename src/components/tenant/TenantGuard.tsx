import { ReactNode, useEffect, useMemo, useState, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useCurrentTenant, usePlatformUser } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { getStoreIdFromSubdomain } from '@/lib/tenantResolver';

const CURRENT_STORE_ID_KEY = 'current_store_id';

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
  // All hooks called in parallel - no waterfall!
  const { user, loading: authLoading } = useAuth();
  const { data: tenant, isLoading: tenantLoading } = useCurrentTenant();
  const { data: platformUser, isLoading: platformUserLoading } = usePlatformUser();
  const expectedSubdomain = useRef(getStoreIdFromSubdomain());
  const location = useLocation();
  const [forceAuth, setForceAuth] = useState(false);

  // Optimized loading: only wait for auth first, then check others in parallel
  // This prevents the full waterfall effect
  const isLoading = authLoading || (!user ? false : (tenantLoading || platformUserLoading));

  // Calculate effective status based on dates
  const effectiveStatus = useMemo(() => {
    if (!tenant) return null;
    return getEffectiveStatus(tenant);
  }, [tenant]);

  // Hard guard: ensure the authenticated session belongs to the intended store.
  // If mismatch happens (common on main domain when switching stores/accounts), we force sign-out
  // so the UI never shows another store's data or "0 data" due to RLS.
  useEffect(() => {
    if (!user?.id) return;
    if (!tenant?.subdomain) return;

    const expectedStoreId = (() => {
      // Subdomain mode: expected store is derived from hostname.
      if (expectedSubdomain.current) {
        return expectedSubdomain.current.toLowerCase();
      }
      // Main domain: expected store is the last store user selected at login.
      const stored = (localStorage.getItem(CURRENT_STORE_ID_KEY) || '').trim().toLowerCase();
      return stored || null;
    })();

    // If we can't determine expected store, don't block—AuthPage will capture it on next login.
    if (!expectedStoreId) return;

    const currentStoreId = tenant.subdomain.toLowerCase();
    if (currentStoreId !== expectedStoreId) {
      // Avoid loops: set local flag for immediate redirect.
      setForceAuth(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, tenant?.subdomain]);

  // Show loading only briefly - use a smaller spinner
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // Platform admin bypass - they can access everything
  if (platformUser?.platform_role === 'platform_admin') {
    return <>{children}</>;
  }

  if (forceAuth) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
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