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
import { PlatformAdvertisementsManagement } from '@/components/platform/PlatformAdvertisementsManagement';
import { AdGateManagement } from '@/components/platform/AdGateManagement';
import { TaxPolicyArticleEditor } from '@/components/admin/TaxPolicyArticleEditor';
import { EmailHistoryTable } from '@/components/platform/EmailHistoryTable';
import { CustomDomainsManagement } from '@/components/platform/CustomDomainsManagement';
import { PlatformArticlesManagement } from '@/components/platform/PlatformArticlesManagement';
import { WelcomeEmailConfig } from '@/components/platform/WelcomeEmailConfig';
import { usePlatformUser } from '@/hooks/useTenant';
import { Navigate } from 'react-router-dom';
 import { Loader2, Users, Megaphone, FileText, Mail, Globe, MailPlus, Bell, Zap } from 'lucide-react';
import { SystemNotificationsManagement } from '@/components/platform/SystemNotificationsManagement';
import { AutomationNotificationsManagement } from '@/components/platform/AutomationNotificationsManagement';

export default function PlatformAdminPage() {
  const { data: platformUser, isLoading } = usePlatformUser();
  const [activeTab, setActiveTab] = useState('overview');

  // Shell-first: no spinner

  // Only platform admins can access this page (skip guard while loading)
  if (!isLoading && (!platformUser || platformUser.platform_role !== 'platform_admin')) {
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
          <TabsList className="flex flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="overview" className="text-xs sm:text-sm px-2 sm:px-3">Tổng quan</TabsTrigger>
            <TabsTrigger value="tenants" className="text-xs sm:text-sm px-2 sm:px-3">DN</TabsTrigger>
            <TabsTrigger value="payments" className="text-xs sm:text-sm px-2 sm:px-3">Thanh toán</TabsTrigger>
            <TabsTrigger value="history" className="text-xs sm:text-sm px-2 sm:px-3">Lịch sử</TabsTrigger>
            <TabsTrigger value="plans" className="text-xs sm:text-sm px-2 sm:px-3">Gói DV</TabsTrigger>
            <TabsTrigger value="affiliate" className="text-xs sm:text-sm px-2 sm:px-3 flex items-center gap-1">
              <Users className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Affiliate</span>
            </TabsTrigger>
            <TabsTrigger value="ads" className="text-xs sm:text-sm px-2 sm:px-3 flex items-center gap-1">
              <Megaphone className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Quảng cáo</span>
            </TabsTrigger>
             <TabsTrigger value="domains" className="text-xs sm:text-sm px-2 sm:px-3 flex items-center gap-1">
               <Globe className="h-3 w-3 sm:h-4 sm:w-4" />
               <span className="hidden sm:inline">Domain</span>
             </TabsTrigger>
             <TabsTrigger value="config" className="text-xs sm:text-sm px-2 sm:px-3">Cấu hình</TabsTrigger>
            <TabsTrigger value="welcome-email" className="text-xs sm:text-sm px-2 sm:px-3 flex items-center gap-1">
              <MailPlus className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Email tự động</span>
            </TabsTrigger>
            <TabsTrigger value="email-history" className="text-xs sm:text-sm px-2 sm:px-3 flex items-center gap-1">
              <Mail className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">LS Email</span>
            </TabsTrigger>
             <TabsTrigger value="tax-article" className="text-xs sm:text-sm px-2 sm:px-3 flex items-center gap-1">
               <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
               <span className="hidden sm:inline">Thuế 2026</span>
             </TabsTrigger>
             <TabsTrigger value="guides" className="text-xs sm:text-sm px-2 sm:px-3 flex items-center gap-1">
               <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
               <span className="hidden sm:inline">Bài viết</span>
             </TabsTrigger>
             <TabsTrigger value="system-notifications" className="text-xs sm:text-sm px-2 sm:px-3 flex items-center gap-1">
               <Bell className="h-3 w-3 sm:h-4 sm:w-4" />
               <span className="hidden sm:inline">Thông báo</span>
             </TabsTrigger>
             <TabsTrigger value="automation" className="text-xs sm:text-sm px-2 sm:px-3 flex items-center gap-1">
               <Zap className="h-3 w-3 sm:h-4 sm:w-4" />
               <span className="hidden sm:inline">Automation</span>
             </TabsTrigger>
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

          <TabsContent value="ads" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="text-base font-semibold mb-4">Danh sách quảng cáo</h3>
                <PlatformAdvertisementsManagement />
              </div>
              <div>
                <h3 className="text-base font-semibold mb-4">Cài đặt Ad Gate (người dùng hết hạn)</h3>
                <AdGateManagement />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="domains" className="mt-6">
            <CustomDomainsManagement />
          </TabsContent>

          <TabsContent value="config" className="mt-6">
            <PaymentConfigManagement />
          </TabsContent>

          <TabsContent value="welcome-email" className="mt-6">
            <WelcomeEmailConfig />
          </TabsContent>

          <TabsContent value="email-history" className="mt-6">
            <EmailHistoryTable />
          </TabsContent>
 
           <TabsContent value="tax-article" className="mt-6">
             <TaxPolicyArticleEditor />
           </TabsContent>

           <TabsContent value="guides" className="mt-6">
             <PlatformArticlesManagement />
           </TabsContent>

           <TabsContent value="system-notifications" className="mt-6">
             <SystemNotificationsManagement />
           </TabsContent>

           <TabsContent value="automation" className="mt-6">
             <AutomationNotificationsManagement />
           </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}