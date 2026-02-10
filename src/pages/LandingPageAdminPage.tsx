import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { LandingPageSettings } from '@/components/admin/LandingPageSettings';
import { usePermissions } from '@/hooks/usePermissions';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export default function LandingPageAdminPage() {
  const { data: permissions, isLoading } = usePermissions();

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  // Chỉ admin mới có thể cấu hình
  const isSuperAdmin = permissions?.role === 'super_admin';
  const isBranchAdmin = permissions?.role === 'branch_admin';
  
  if (!isSuperAdmin && !isBranchAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <MainLayout>
      <div className="p-4 sm:p-6">
        <PageHeader 
          title="Landing Page" 
          description="Cấu hình trang giới thiệu cửa hàng cho khách hàng"
          helpText="Thiết lập trang giới thiệu công khai cho cửa hàng: banner, thông tin liên hệ, sản phẩm nổi bật. Khách hàng có thể truy cập qua subdomain riêng của bạn."
        />
        <div className="mt-6">
          <LandingPageSettings />
        </div>
      </div>
    </MainLayout>
  );
}
