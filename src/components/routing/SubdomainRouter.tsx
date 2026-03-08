import { ReactNode, useMemo, useEffect } from 'react';
import { useTenantResolver } from '@/hooks/useTenantResolver';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'react-router-dom';
import { detectTenantFromHostname, buildStoreUrl } from '@/lib/tenantResolver';

interface SubdomainRouterProps {
  /** Component hiển thị khi là landing page của store (subdomain) */
  landingPage: ReactNode;
  /** Component hiển thị khi là trang chủ main domain */
  publicLandingPage?: ReactNode;
  /** Component hiển thị khi đã đăng nhập */
  children: ReactNode;
}

/**
 * Router component xử lý logic hiển thị:
 * - Main domain (vkho.vn) + chưa đăng nhập + path "/" → trang giới thiệu
 * - Subdomain + chưa đăng nhập → landing page cửa hàng
 * - Đã đăng nhập → app chính
 */
export function SubdomainRouter({ landingPage, publicLandingPage, children }: SubdomainRouterProps) {
  const resolvedTenant = useTenantResolver();
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const hostInfo = useMemo(() => detectTenantFromHostname(), []);
  
  const routerState = useMemo(() => {
    console.log('[SubdomainRouter]', {
      status: resolvedTenant.status,
      isMainDomain: resolvedTenant.isMainDomain,
      tenantId: resolvedTenant.tenantId,
      subdomain: resolvedTenant.subdomain,
      authLoading,
      hasUser: !!user,
      pathname: location.pathname,
      hostIsMainDomain: hostInfo.isMainDomain,
    });

    // Không cho custom domain/subdomain rơi vào /auth khi đang loading
    if (!user && !hostInfo.isMainDomain && location.pathname === '/' && (resolvedTenant.status === 'loading' || authLoading)) {
      return 'store_landing';
    }
    
    // OPTIMIZATION: For main domains, skip loading state entirely
    // as tenant resolution is synchronous
    if (resolvedTenant.isMainDomain && resolvedTenant.status !== 'loading') {
      if (authLoading) {
        return 'app';
      }
      
      // CTV user on main domain after email verification → redirect to store
      if (user) {
        const ctvStoreMode = localStorage.getItem('ctv_store_mode');
        const ctvTenantId = user.user_metadata?.ctv_tenant_id;
        if (ctvStoreMode || ctvTenantId) {
          const storeId = ctvStoreMode || ctvTenantId;
          // On main domain, redirect CTV to their store
          const storeUrl = buildStoreUrl(storeId);
          if (storeUrl !== window.location.href && !storeUrl.includes(window.location.hostname)) {
            window.location.href = storeUrl;
            return 'app'; // Show app shell while redirecting
          }
        }
        return 'app';
      }
      
      if (location.pathname === '/' && publicLandingPage) {
        return 'public_landing';
      }
      return 'app';
    }
    
    // For subdomains/custom domains, don't block with spinner
    if (resolvedTenant.status === 'loading') {
      return 'app';
    }
    
    if (authLoading) {
      return 'app';
    }
    
    // CTV store mode: user logged in as CTV on a store page — keep showing store
    const ctvStoreMode = localStorage.getItem('ctv_store_mode');
    if (user && ctvStoreMode && (resolvedTenant.subdomain || resolvedTenant.tenantId)) {
      return 'store_landing';
    }

    if (user) {
      return 'app';
    }
    
    // Có subdomain hoặc custom domain + tenant tồn tại + chưa đăng nhập → landing page cửa hàng
    if (resolvedTenant.status === 'resolved' && (resolvedTenant.subdomain || resolvedTenant.tenantId)) {
      return 'store_landing';
    }
    
    // Subdomain/custom domain không tồn tại → landing page sẽ hiển thị "không tìm thấy"
    if (resolvedTenant.status === 'not_found' && (resolvedTenant.subdomain || !resolvedTenant.isMainDomain)) {
      return 'store_landing';
    }
    
    return 'app';
  }, [resolvedTenant, user, authLoading, location.pathname, publicLandingPage, hostInfo.isMainDomain]);

  // No loading spinner - app shell renders immediately

  if (routerState === 'public_landing' && publicLandingPage) {
    return <>{publicLandingPage}</>;
  }

  if (routerState === 'store_landing') {
    return <>{landingPage}</>;
  }

  return <>{children}</>;
}
