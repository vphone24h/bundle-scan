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
    
    // For subdomains/custom domains, need to wait for tenant resolution
    if (resolvedTenant.status === 'loading') {
      return 'loading';
    }
    
    // Auth loading on subdomain
    if (authLoading) {
      return 'loading';
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

  // Loading state - only for subdomains, main domain resolves instantly
  if (routerState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (routerState === 'public_landing' && publicLandingPage) {
    return <>{publicLandingPage}</>;
  }

  if (routerState === 'store_landing') {
    return <>{landingPage}</>;
  }

  return <>{children}</>;
}
