import { ReactNode, useMemo } from 'react';
import { useTenantResolver } from '@/hooks/useTenantResolver';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'react-router-dom';

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
  
  const routerState = useMemo(() => {
    // OPTIMIZATION: For main domains, skip loading state entirely
    // as tenant resolution is synchronous
    if (resolvedTenant.isMainDomain && resolvedTenant.status !== 'loading') {
      // Auth still loading but on main domain - don't block, let children handle auth
      if (authLoading) {
        // Return app immediately - AuthPage and ProtectedRoute will handle auth loading
        return 'app';
      }
      
      if (user) return 'app';
      
      // Main domain + not logged in + at root
      if (location.pathname === '/' && publicLandingPage) {
        return 'public_landing';
      }
      return 'app';
    }
    
    // For subdomains/custom domains, don't block with spinner
    // Let the app render immediately, data will load in background
    if (resolvedTenant.status === 'loading') {
      return 'app';
    }
    
    // Auth loading on subdomain - render app shell immediately
    if (authLoading) {
      return 'app';
    }
    
    // Đã đăng nhập → luôn hiển thị app
    if (user) {
      return 'app';
    }
    
    // Có subdomain + tenant tồn tại + chưa đăng nhập → landing page cửa hàng
    if (resolvedTenant.status === 'resolved' && resolvedTenant.subdomain) {
      return 'store_landing';
    }
    
    // Subdomain không tồn tại → landing page sẽ hiển thị "không tìm thấy"
    if (resolvedTenant.status === 'not_found' && resolvedTenant.subdomain) {
      return 'store_landing';
    }
    
    return 'app';
  }, [resolvedTenant, user, authLoading, location.pathname, publicLandingPage]);

  // No loading spinner - app shell renders immediately

  if (routerState === 'public_landing' && publicLandingPage) {
    return <>{publicLandingPage}</>;
  }

  if (routerState === 'store_landing') {
    return <>{landingPage}</>;
  }

  return <>{children}</>;
}
