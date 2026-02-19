import { ReactNode, useEffect, useMemo, useState, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useCurrentTenant, usePlatformUser } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { getStoreIdFromSubdomain } from '@/lib/tenantResolver';
import { useAdGateSettings } from '@/hooks/useAdGate';
import { useActiveAdvertisements } from '@/hooks/useAdvertisements';

const CURRENT_STORE_ID_KEY = 'current_store_id';

interface TenantGuardProps {
  children: ReactNode;
  allowExpired?: boolean;
}

function getEffectiveStatus(tenant: {
  status: string;
  trial_end_date: string;
  subscription_end_date: string | null;
}): 'trial' | 'active' | 'expired' | 'locked' {
  if (tenant.status === 'locked') return 'locked';
  // Miễn phí trọn đời - không bao giờ hết hạn
  return 'active';
}

export function TenantGuard({ children, allowExpired = false }: TenantGuardProps) {
  const { user, loading: authLoading } = useAuth();
  const { data: tenant, isLoading: tenantLoading } = useCurrentTenant();
  const { data: platformUser, isLoading: platformUserLoading } = usePlatformUser();
  const { data: adGateSettings } = useAdGateSettings();
  const { data: activeAds } = useActiveAdvertisements();
  const expectedSubdomain = useRef(getStoreIdFromSubdomain());
  const location = useLocation();
  const [forceAuth, setForceAuth] = useState(false);

  // Don't block rendering while loading – let children render with their own skeletons.
  // Only enforce guards once data has arrived.
  const isLoading = authLoading || (!user ? false : (tenantLoading || platformUserLoading));

  const effectiveStatus = useMemo(() => {
    if (!tenant) return null;
    return getEffectiveStatus(tenant);
  }, [tenant]);

  useEffect(() => {
    if (!user?.id || !tenant?.subdomain) return;
    const expectedStoreId = (() => {
      if (expectedSubdomain.current) return expectedSubdomain.current.toLowerCase();
      const stored = (localStorage.getItem(CURRENT_STORE_ID_KEY) || '').trim().toLowerCase();
      return stored || null;
    })();
    if (!expectedStoreId) return;
    if (tenant.subdomain.toLowerCase() !== expectedStoreId) {
      setForceAuth(true);
    }
  }, [user?.id, tenant?.subdomain]);

  // SHELL-FIRST: While loading, render children immediately.
  // Pages will show skeleton placeholders for data they haven't received yet.
  if (isLoading) {
    return <>{children}</>;
  }

  if (platformUser?.platform_role === 'platform_admin') {
    return <>{children}</>;
  }

  if (forceAuth) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  if (effectiveStatus === 'locked') {
    return <Navigate to="/subscription" replace />;
  }

  // If ad gate is enabled and there are active ads, allow expired users through
  // (they'll see ads in MainLayout instead of being blocked)
  const adGateActive =
    adGateSettings?.is_enabled === true && (activeAds?.length ?? 0) > 0;

  if (effectiveStatus === 'expired' && !allowExpired && !adGateActive) {
    return <Navigate to="/subscription" replace />;
  }

  return <>{children}</>;
}
