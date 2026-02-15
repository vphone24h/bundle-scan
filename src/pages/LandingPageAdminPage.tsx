import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { LandingPageSettings } from '@/components/admin/LandingPageSettings';
import { LandingProductsTab } from '@/components/admin/LandingProductsTab';
import { LandingArticlesTab } from '@/components/admin/LandingArticlesTab';
import { LandingOrdersTab } from '@/components/admin/LandingOrdersTab';
import { usePermissions } from '@/hooks/usePermissions';
import { usePendingOrderCount } from '@/hooks/useLandingOrders';
import { useLandingGuideUrl } from '@/hooks/useAppConfig';
import { Navigate } from 'react-router-dom';
import { Loader2, BookOpen } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

function PendingBadge() {
  const { data: count } = usePendingOrderCount();
  if (!count) return null;
  return (
    <span className="ml-1.5 inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
      {count > 99 ? '99+' : count}
    </span>
  );
}

export default function LandingPageAdminPage() {
  const { data: permissions, isLoading } = usePermissions();
  const landingGuideUrl = useLandingGuideUrl();

  // Shell-first: no spinner, render layout immediately

  const role = permissions?.role;
  const isSuperAdmin = role === 'super_admin';
  const isBranchAdmin = role === 'branch_admin';
  const isStaff = role === 'staff';
  const isCashier = role === 'cashier';
  
  // Kế toán không có quyền truy cập Landing Page (only enforce after loading)
  if (!isLoading && (isCashier || (!isSuperAdmin && !isBranchAdmin && !isStaff))) {
    return <Navigate to="/" replace />;
  }

  // Xác định tab mặc định và tab hiển thị theo vai trò
  // Super Admin: tất cả tab (Cấu hình, Sản phẩm, Tin tức, Đơn hàng)
  // Branch Admin: Tin tức, Đơn đặt hàng
  // Staff: Sản phẩm, Tin tức, Đơn đặt hàng
  const showSettings = isSuperAdmin;
  const showProducts = isSuperAdmin || isBranchAdmin || isStaff;
  const showArticles = true; // Tất cả role đều thấy
  const showOrders = true;   // Tất cả role đều thấy

  const defaultTab = isSuperAdmin ? 'settings' : (isStaff ? 'products' : 'articles');

  return (
    <MainLayout>
      <div className="p-4 sm:p-6">
        <PageHeader 
          title="Website bán hàng" 
          description="Cấu hình website bán hàng cho khách hàng"
          helpText="Thiết lập website bán hàng công khai: sản phẩm, tin tức, tra cứu bảo hành. Khách hàng có thể truy cập qua subdomain hoặc tên miền riêng của bạn."
        />
        {landingGuideUrl && (
          <div className="mt-4">
            <Button variant="outline" size="sm" asChild>
              <a href={landingGuideUrl} target="_blank" rel="noopener noreferrer">
                <BookOpen className="mr-2 h-4 w-4" />
                Hướng dẫn sử dụng
              </a>
            </Button>
          </div>
        )}
        <div className="mt-4">
          <Tabs defaultValue={defaultTab}>
            <TabsList className="mb-4">
              {showSettings && <TabsTrigger value="settings">Cấu hình</TabsTrigger>}
              {showProducts && <TabsTrigger value="products">Sản phẩm</TabsTrigger>}
              {showArticles && <TabsTrigger value="articles">Tin tức</TabsTrigger>}
              {showOrders && (
                <TabsTrigger value="orders" className="relative">
                  Đơn đặt hàng
                  <PendingBadge />
                </TabsTrigger>
              )}
            </TabsList>
            {showSettings && (
              <TabsContent value="settings">
                <LandingPageSettings />
              </TabsContent>
            )}
            {showProducts && (
              <TabsContent value="products">
                <LandingProductsTab />
              </TabsContent>
            )}
            {showArticles && (
              <TabsContent value="articles">
                <LandingArticlesTab />
              </TabsContent>
            )}
            {showOrders && (
              <TabsContent value="orders">
                <LandingOrdersTab />
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>
    </MainLayout>
  );
}
