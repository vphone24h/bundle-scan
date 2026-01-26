import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TenantsManagement } from '@/components/platform/TenantsManagement';
import { PaymentsManagement } from '@/components/platform/PaymentsManagement';
import { PlansManagement } from '@/components/platform/PlansManagement';
import { PlatformStats } from '@/components/platform/PlatformStats';
import { usePlatformUser } from '@/hooks/useTenant';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

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
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Tổng quan</TabsTrigger>
            <TabsTrigger value="tenants">Doanh nghiệp</TabsTrigger>
            <TabsTrigger value="payments">Thanh toán</TabsTrigger>
            <TabsTrigger value="plans">Gói dịch vụ</TabsTrigger>
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

          <TabsContent value="plans" className="mt-6">
            <PlansManagement />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}