import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { buildStoreUrl } from '@/lib/tenantResolver';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  // While loading auth, render children immediately so the layout shell appears.
  if (loading) {
    return <>{children}</>;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // BLOCK CTV users from accessing admin/warehouse management
  // CTV users have ctv_tenant_id in their metadata — they belong to the store website only
  const ctvTenantId = user.user_metadata?.ctv_tenant_id;
  const ctvStoreMode = localStorage.getItem('ctv_store_mode');
  
  if (ctvTenantId || ctvStoreMode) {
    // CTV user trying to access admin → redirect to their store website
    const storeId = ctvStoreMode || ctvTenantId;
    if (storeId) {
      // Clean up and redirect to store
      const storeUrl = buildStoreUrl(storeId);
      window.location.replace(storeUrl);
      return null;
    }
    // Fallback: just go to auth page
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}
