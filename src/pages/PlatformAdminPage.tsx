import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TenantsManagement } from '@/components/platform/TenantsManagement';
import { PaymentsManagement } from '@/components/platform/PaymentsManagement';
import { PlansManagement } from '@/components/platform/PlansManagement';
import { PaymentConfigManagement } from '@/components/platform/PaymentConfigManagement';
import { PaymentHistoryTable } from '@/components/platform/PaymentHistoryTable';
import { PlatformStats } from '@/components/platform/PlatformStats';
import { AffiliateManagement } from '@/components/platform/AffiliateManagement';
import { usePlatformUser } from '@/hooks/useTenant';
import { Navigate } from 'react-router-dom';
import { Loader2, Users } from 'lucide-react';

export default function PlatformAdminPage() {
  const { data: platformUser, isLoading } = usePlatformUser();
  const [activeTab, setActiveTab] = useState('overview');

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Only platform admins can access this page
  if (!platformUser || platformUser.platform_role !== 'platform_admin') {
    return <Navigate to="/" replace />;
  }

  return (
    <MainLayout>
      <div className="p-4 sm:p-6 space-y-6">
        <PageHeader 
          title="Quản trị nền tảng" 
          description="Quản lý doanh nghiệp, gói dịch vụ và thanh toán"
        />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 md:grid-cols-7">
            <TabsTrigger value="overview">Tổng quan</TabsTrigger>
            <TabsTrigger value="tenants">Doanh nghiệp</TabsTrigger>
            <TabsTrigger value="payments">Thanh toán</TabsTrigger>
            <TabsTrigger value="history">Lịch sử</TabsTrigger>
            <TabsTrigger value="plans">Gói dịch vụ</TabsTrigger>
            <TabsTrigger value="affiliate" className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Affiliate</span>
            </TabsTrigger>
            <TabsTrigger value="config">Cấu hình</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <PlatformStats />
          </TabsContent>

          <TabsContent value="tenants" className="mt-6">
            <TenantsManagement />
          </TabsContent>

          <TabsContent value="payments" className="mt-6">
            <PaymentsManagement />
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <PaymentHistoryTable />
          </TabsContent>

          <TabsContent value="plans" className="mt-6">
            <PlansManagement />
          </TabsContent>

          <TabsContent value="affiliate" className="mt-6">
            <AffiliateManagement />
          </TabsContent>

          <TabsContent value="config" className="mt-6">
            <PaymentConfigManagement />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}