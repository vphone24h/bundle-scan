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
          description="Cấu hình trang web bán hàng cho khách hàng"
          helpText="Thiết lập trang web bán hàng công khai: sản phẩm, tin tức, tra cứu bảo hành. Khách hàng có thể truy cập qua subdomain riêng của bạn."
        />
        <div className="mt-6">
          <Tabs defaultValue="settings">
            <TabsList className="mb-4">
              <TabsTrigger value="settings">Cấu hình</TabsTrigger>
              <TabsTrigger value="products">Sản phẩm</TabsTrigger>
              <TabsTrigger value="articles">Tin tức</TabsTrigger>
              <TabsTrigger value="orders" className="relative">
                Đơn đặt hàng
                <PendingBadge />
              </TabsTrigger>
            </TabsList>
            <TabsContent value="settings">
              <LandingPageSettings />
            </TabsContent>
            <TabsContent value="products">
              <LandingProductsTab />
            </TabsContent>
            <TabsContent value="articles">
              <LandingArticlesTab />
            </TabsContent>
            <TabsContent value="orders">
              <LandingOrdersTab />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </MainLayout>
  );
}
