import { ReactNode, useMemo } from 'react';
import { useTenantResolver } from '@/hooks/useTenantResolver';
import { useAuth } from '@/hooks/useAuth';

interface SubdomainRouterProps {
  /** Component hiển thị khi là landing page (chưa đăng nhập + có subdomain) */
  landingPage: ReactNode;
  /** Component hiển thị khi đã đăng nhập hoặc là main domain */
  children: ReactNode;
}

/**
 * Router component xử lý logic hiển thị landing page hoặc app chính
 * - Nếu có subdomain + chưa đăng nhập → hiển thị landing page
 * - Nếu đã đăng nhập hoặc main domain → hiển thị app chính
 */
export function SubdomainRouter({ landingPage, children }: SubdomainRouterProps) {
  const resolvedTenant = useTenantResolver();
  const { user, loading: authLoading } = useAuth();
  
  const shouldShowLandingPage = useMemo(() => {
    // Đang loading → không quyết định
    if (resolvedTenant.status === 'loading' || authLoading) {
      return null; // undefined = loading
    }
    
    // Đã đăng nhập → luôn hiển thị app
    if (user) {
      return false;
    }
    
    // Main domain (vkho.vn, localhost, lovable.app) → hiển thị app/auth
    if (resolvedTenant.isMainDomain) {
      return false;
    }
    
    // Có subdomain + tenant tồn tại + chưa đăng nhập → landing page
    if (resolvedTenant.status === 'resolved' && resolvedTenant.subdomain) {
      return true;
    }
    
    // Subdomain không tồn tại → landing page sẽ hiển thị "không tìm thấy"
    if (resolvedTenant.status === 'not_found' && resolvedTenant.subdomain) {
      return true;
    }
    
    return false;
  }, [resolvedTenant, user, authLoading]);

  // Loading state
  if (shouldShowLandingPage === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (shouldShowLandingPage) {
    return <>{landingPage}</>;
  }

  return <>{children}</>;
}
