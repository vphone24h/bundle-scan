import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { LandingPageSettings } from '@/components/admin/LandingPageSettings';
import { LandingProductsTab } from '@/components/admin/LandingProductsTab';
import { LandingArticlesTab } from '@/components/admin/LandingArticlesTab';
import { LandingOrdersTab } from '@/components/admin/LandingOrdersTab';
import { usePermissions } from '@/hooks/usePermissions';
import { usePendingOrderCount } from '@/hooks/useLandingOrders';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  const role = permissions?.role;
  const isSuperAdmin = role === 'super_admin';
  const isBranchAdmin = role === 'branch_admin';
  const isStaff = role === 'staff';
  const isCashier = role === 'cashier';
  
  // Kế toán không có quyền truy cập Landing Page
  if (isCashier || (!isSuperAdmin && !isBranchAdmin && !isStaff)) {
    return <Navigate to="/" replace />;
  }

  // Xác định tab mặc định và tab hiển thị theo vai trò
  // Super Admin: tất cả tab (Cấu hình, Sản phẩm, Tin tức, Đơn hàng)
  // Branch Admin: Tin tức, Đơn đặt hàng
  // Staff: Sản phẩm, Tin tức, Đơn đặt hàng
  const showSettings = isSuperAdmin;
  const showProducts = isSuperAdmin || isStaff;
  const showArticles = true; // Tất cả role đều thấy
  const showOrders = true;   // Tất cả role đều thấy

  const defaultTab = isSuperAdmin ? 'settings' : (isStaff ? 'products' : 'articles');

  return (
    <MainLayout>
      <div className="p-4 sm:p-6">
        <PageHeader 
          title="Landing Page" 
          description="Cấu hình trang web bán hàng cho khách hàng"
          helpText="Thiết lập trang web bán hàng công khai: sản phẩm, tin tức, tra cứu bảo hành. Khách hàng có thể truy cập qua subdomain riêng của bạn."
        />
        <div className="mt-6">
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
