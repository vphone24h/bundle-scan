import { ReactNode, useMemo } from 'react';
import { useTenantResolver } from '@/hooks/useTenantResolver';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompanyResolver';
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
 * - Company domain (cty.vphone.vn) + chưa đăng nhập + path "/" → trang giới thiệu công ty
 * - Subdomain (shop1.vkho.vn) + chưa đăng nhập → landing page cửa hàng
 * - Đã đăng nhập → app chính
 */
export function SubdomainRouter({ landingPage, publicLandingPage, children }: SubdomainRouterProps) {
  const resolvedTenant = useTenantResolver();
  const { user, loading: authLoading } = useAuth();
  const company = useCompany();
  const location = useLocation();
  const hostInfo = useMemo(() => detectTenantFromHostname(), []);
  const isAdminEntryRoute = useMemo(
    () => location.pathname === '/admin' || location.pathname.startsWith('/platform-admin'),
    [location.pathname]
  );

  // Check if current hostname IS a company domain (not a shop subdomain of a company domain)
  const isCompanyDomain = useMemo(() => {
    if (company.status !== 'resolved' || !company.domain) return false;
    const hostname = window.location.hostname.toLowerCase().replace(/^www\./, '');
    // If the hostname exactly matches the company domain, this is a company website
    return hostname === company.domain.toLowerCase();
  }, [company.status, company.domain]);
  
  const routerState = useMemo(() => {
    // Unknown custom root domain must wait for company resolution.
    // CRITICAL: Never flash vkho's public landing on a custom tenant domain (e.g. depadian.com).
    // While company lookup is in flight, show store landing — it will switch to public_landing
    // only if the domain is later confirmed as a company domain.
    if (company.status === 'loading' && !hostInfo.isMainDomain && !hostInfo.subdomain) {
      if (isAdminEntryRoute) return 'app';
      return 'store_landing';
    }

    if (company.status === 'resolved' && isCompanyDomain) {
      if (authLoading) return 'app';
      if (user) return 'app';
      if (location.pathname === '/' && publicLandingPage) return 'public_landing';
      return 'app';
    }

    // CRITICAL: On custom domain/subdomain, ALWAYS show store landing while loading
    // Never show admin app to store visitors during loading states
    if (!hostInfo.isMainDomain && !isCompanyDomain) {
      if (!user && (resolvedTenant.status === 'loading' || authLoading)) {
        return 'store_landing';
      }
      if (authLoading && !user) {
        return 'store_landing';
      }
    }

    // OPTIMIZATION: For main domains, skip loading state entirely
    // as tenant resolution is synchronous
    if (resolvedTenant.isMainDomain && resolvedTenant.status !== 'loading') {
      // INSTANT: If on "/" and no logged-in user yet, show public landing immediately.
      // Don't wait for authLoading — public landing is safe to show; if a user is
      // detected later, we can re-render to 'app'.
      if (!user && location.pathname === '/' && publicLandingPage) {
        return 'public_landing';
      }

      if (authLoading) {
        return 'app';
      }
      
      // CTV user on main domain → redirect to store (they cannot access admin)
      if (user) {
        const ctvStoreMode = localStorage.getItem('ctv_store_mode');
        const ctvTenantId = user.user_metadata?.ctv_tenant_id;
        if (ctvStoreMode || ctvTenantId) {
          const storeId = ctvStoreMode || ctvTenantId;
          const storeUrl = buildStoreUrl(storeId);
          if (storeUrl !== window.location.href && !storeUrl.includes(window.location.hostname)) {
            window.location.href = storeUrl;
            return 'app';
          }
        }
        return 'app';
      }
      
      if (location.pathname === '/' && publicLandingPage) {
        return 'public_landing';
      }
      return 'app';
    }
    
    // For subdomains/custom domains during loading — show store landing (not admin)
    if (resolvedTenant.status === 'loading') {
      return 'store_landing';
    }
    
    if (authLoading) {
      return 'store_landing';
    }
    
    // CTV store mode OR CTV user on store page → ALWAYS show store landing
    const ctvStoreMode = localStorage.getItem('ctv_store_mode');
    const isCTVUser = !!user?.user_metadata?.ctv_tenant_id;
    if (user && (ctvStoreMode || isCTVUser) && (resolvedTenant.subdomain || resolvedTenant.tenantId)) {
      return 'store_landing';
    }

    // Regular staff/admin user on subdomain → show admin app
    if (user) {
      return 'app';
    }
    
    // No user + subdomain/custom domain resolved → show store landing
    if (resolvedTenant.status === 'resolved' && (resolvedTenant.subdomain || resolvedTenant.tenantId)) {
      return 'store_landing';
    }
    
    // Subdomain/custom domain not found → store landing will show "not found"
    if (resolvedTenant.status === 'not_found' && (resolvedTenant.subdomain || !resolvedTenant.isMainDomain)) {
      return 'store_landing';
    }
    
    return 'app';
  }, [resolvedTenant, user, authLoading, publicLandingPage, hostInfo.isMainDomain, isCompanyDomain, isAdminEntryRoute, company.status, hostInfo.subdomain, location.pathname]);

  // No loading spinner - app shell renders immediately

  if (routerState === 'public_landing' && publicLandingPage) {
    return <>{publicLandingPage}</>;
  }

  if (routerState === 'store_landing') {
    return <>{landingPage}</>;
  }

  return <>{children}</>;
}
