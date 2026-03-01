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
import { PlatformAISettings } from '@/components/platform/PlatformAISettings';
import { usePlatformUser } from '@/hooks/useTenant';
import { Navigate } from 'react-router-dom';
import { Loader2, Users, Megaphone, FileText, Mail, Globe, MailPlus, Bell, Zap, Database } from 'lucide-react';
import { SystemNotificationsManagement } from '@/components/platform/SystemNotificationsManagement';
import { AutomationNotificationsManagement } from '@/components/platform/AutomationNotificationsManagement';
import { ManualNotificationHistoryTable, AutomationHistoryTable } from '@/components/platform/NotificationSendHistory';
import { History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function PlatformAdminPage() {
  const { data: platformUser, isLoading } = usePlatformUser();
  const [activeTab, setActiveTab] = useState('overview');
  const [isExportingAll, setIsExportingAll] = useState(false);

  const handleExportAllData = async () => {
    setIsExportingAll(true);
    try {
      const { data, error } = await supabase.functions.invoke('export-all-data');
      if (error) throw error;
      if (!data) throw new Error('Không có dữ liệu trả về');

      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      a.href = url;
      a.download = `full_project_export_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const totalRows = data._metadata?.total_rows || 0;
      const totalTables = data._metadata?.total_tables || 0;
      toast.success(`Đã xuất ${totalRows.toLocaleString()} bản ghi từ ${totalTables} bảng`);
    } catch (error) {
      console.error('Full export error:', error);
      toast.error('Lỗi khi xuất dữ liệu: ' + (error as Error).message);
    } finally {
      setIsExportingAll(false);
    }
  };

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
              <TabsTrigger value="export-all" className="text-xs sm:text-sm px-2 sm:px-3 flex items-center gap-1">
                <Database className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Xuất DB</span>
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
            <div className="space-y-6">
              <PlatformAISettings />
              <PaymentConfigManagement />
            </div>
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
              <Tabs defaultValue="manual" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="manual" className="text-xs sm:text-sm">
                    <Bell className="h-3 w-3 mr-1" />
                    Thông báo thủ công
                  </TabsTrigger>
                  <TabsTrigger value="automation" className="text-xs sm:text-sm">
                    <Zap className="h-3 w-3 mr-1" />
                    Automation
                  </TabsTrigger>
                  <TabsTrigger value="send-history" className="text-xs sm:text-sm">
                    <History className="h-3 w-3 mr-1" />
                    Lịch sử gửi
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="manual">
                  <SystemNotificationsManagement />
                </TabsContent>
                <TabsContent value="automation">
                  <AutomationNotificationsManagement />
                </TabsContent>
                <TabsContent value="send-history">
                  <div className="space-y-6">
                    <ManualNotificationHistoryTable />
                    <AutomationHistoryTable />
                  </div>
                </TabsContent>
              </Tabs>
            </TabsContent>

            <TabsContent value="export-all" className="mt-6">
              <Card className="border-green-200 bg-green-50/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-700">
                    <Database className="h-5 w-5" />
                    Xuất toàn bộ dữ liệu dự án
                  </CardTitle>
                  <CardDescription>
                    Xuất tất cả dữ liệu của toàn bộ các cửa hàng (tenants) thành 1 file JSON duy nhất để đồng bộ sang Supabase khác.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>• Bao gồm tất cả bảng: tenants, branches, products, customers, receipts, cash_book, audit_logs, v.v.</p>
                    <p>• Không giới hạn theo cửa hàng — xuất toàn bộ dự án.</p>
                    <p>• File JSON có thể import vào Supabase bằng SQL Editor hoặc script migration.</p>
                  </div>
                  <Button
                    onClick={handleExportAllData}
                    disabled={isExportingAll}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    {isExportingAll ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Đang xuất toàn bộ dữ liệu...
                      </>
                    ) : (
                      <>
                        <Database className="h-4 w-4 mr-2" />
                        Xuất toàn bộ Database (JSON)
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    ⚠️ Quá trình xuất có thể mất vài phút nếu dữ liệu lớn
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}