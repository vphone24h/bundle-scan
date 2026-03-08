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
import { PlatformEmailAutomationManagement } from '@/components/platform/PlatformEmailAutomationManagement';
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
import { useTranslation } from 'react-i18next';

export default function PlatformAdminPage() {
  const { t } = useTranslation();
  const { data: platformUser, isLoading } = usePlatformUser();
  const [activeTab, setActiveTab] = useState('overview');
  const [isExportingAll, setIsExportingAll] = useState(false);

  const handleExportAllData = async () => {
    setIsExportingAll(true);
    try {
      const { data, error } = await supabase.functions.invoke('export-all-data');
      if (error) throw error;
      if (!data) throw new Error(t('pages.platformAdmin.noDataReturned'));

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
      toast.success(t('pages.platformAdmin.exportSuccess', { rows: totalRows.toLocaleString(), tables: totalTables }));
    } catch (error) {
      console.error('Full export error:', error);
      toast.error(t('pages.platformAdmin.exportError') + ': ' + (error as Error).message);
    } finally {
      setIsExportingAll(false);
    }
  };

  if (!isLoading && (!platformUser || platformUser.platform_role !== 'platform_admin')) {
    return <Navigate to="/" replace />;
  }

  return (
    <MainLayout>
      <div className="p-4 sm:p-6 space-y-6">
        <PageHeader 
          title={t('pages.platformAdmin.title')} 
          description={t('pages.platformAdmin.description')}
        />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="overview" className="text-xs sm:text-sm px-2 sm:px-3">{t('pages.platformAdmin.overview')}</TabsTrigger>
            <TabsTrigger value="tenants" className="text-xs sm:text-sm px-2 sm:px-3">{t('pages.platformAdmin.tenants')}</TabsTrigger>
            <TabsTrigger value="payments" className="text-xs sm:text-sm px-2 sm:px-3">{t('pages.platformAdmin.payments')}</TabsTrigger>
            <TabsTrigger value="history" className="text-xs sm:text-sm px-2 sm:px-3">{t('pages.platformAdmin.history')}</TabsTrigger>
            <TabsTrigger value="plans" className="text-xs sm:text-sm px-2 sm:px-3">{t('pages.platformAdmin.plans')}</TabsTrigger>
            <TabsTrigger value="affiliate" className="text-xs sm:text-sm px-2 sm:px-3 flex items-center gap-1">
              <Users className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Affiliate</span>
            </TabsTrigger>
            <TabsTrigger value="ads" className="text-xs sm:text-sm px-2 sm:px-3 flex items-center gap-1">
              <Megaphone className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">{t('pages.platformAdmin.ads')}</span>
            </TabsTrigger>
             <TabsTrigger value="domains" className="text-xs sm:text-sm px-2 sm:px-3 flex items-center gap-1">
               <Globe className="h-3 w-3 sm:h-4 sm:w-4" />
               <span className="hidden sm:inline">{t('pages.platformAdmin.domains')}</span>
             </TabsTrigger>
             <TabsTrigger value="config" className="text-xs sm:text-sm px-2 sm:px-3">{t('pages.platformAdmin.config')}</TabsTrigger>
            <TabsTrigger value="welcome-email" className="text-xs sm:text-sm px-2 sm:px-3 flex items-center gap-1">
              <MailPlus className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">{t('pages.platformAdmin.welcomeEmail')}</span>
            </TabsTrigger>
            <TabsTrigger value="email-history" className="text-xs sm:text-sm px-2 sm:px-3 flex items-center gap-1">
              <Mail className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">{t('pages.platformAdmin.emailHistory')}</span>
            </TabsTrigger>
             <TabsTrigger value="tax-article" className="text-xs sm:text-sm px-2 sm:px-3 flex items-center gap-1">
               <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
               <span className="hidden sm:inline">{t('pages.platformAdmin.taxArticle')}</span>
             </TabsTrigger>
             <TabsTrigger value="guides" className="text-xs sm:text-sm px-2 sm:px-3 flex items-center gap-1">
               <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
               <span className="hidden sm:inline">{t('pages.platformAdmin.guides')}</span>
             </TabsTrigger>
              <TabsTrigger value="system-notifications" className="text-xs sm:text-sm px-2 sm:px-3 flex items-center gap-1">
                <Bell className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">{t('pages.platformAdmin.notifications')}</span>
              </TabsTrigger>
              <TabsTrigger value="export-all" className="text-xs sm:text-sm px-2 sm:px-3 flex items-center gap-1">
                <Database className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">{t('pages.platformAdmin.exportDB')}</span>
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
                <h3 className="text-base font-semibold mb-4">{t('pages.platformAdmin.adList')}</h3>
                <PlatformAdvertisementsManagement />
              </div>
              <div>
                <h3 className="text-base font-semibold mb-4">{t('pages.platformAdmin.adGateSettings')}</h3>
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
            <Tabs defaultValue="history">
              <TabsList className="mb-4">
                <TabsTrigger value="history" className="text-xs sm:text-sm">
                  <Mail className="h-3 w-3 mr-1" /> Lịch sử email
                </TabsTrigger>
                <TabsTrigger value="email-automation" className="text-xs sm:text-sm">
                  <Zap className="h-3 w-3 mr-1" /> Email Automation
                </TabsTrigger>
              </TabsList>
              <TabsContent value="history">
                <EmailHistoryTable />
              </TabsContent>
              <TabsContent value="email-automation">
                <PlatformEmailAutomationManagement />
              </TabsContent>
            </Tabs>
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
                    {t('pages.platformAdmin.manualNotifications')}
                  </TabsTrigger>
                  <TabsTrigger value="automation" className="text-xs sm:text-sm">
                    <Zap className="h-3 w-3 mr-1" />
                    {t('pages.platformAdmin.automation')}
                  </TabsTrigger>
                  <TabsTrigger value="send-history" className="text-xs sm:text-sm">
                    <History className="h-3 w-3 mr-1" />
                    {t('pages.platformAdmin.sendHistory')}
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
                    {t('pages.platformAdmin.exportAllTitle')}
                  </CardTitle>
                  <CardDescription>
                    {t('pages.platformAdmin.exportAllDesc')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>• {t('pages.platformAdmin.exportAllNote1')}</p>
                    <p>• {t('pages.platformAdmin.exportAllNote2')}</p>
                    <p>• {t('pages.platformAdmin.exportAllNote3')}</p>
                  </div>
                  <Button
                    onClick={handleExportAllData}
                    disabled={isExportingAll}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    {isExportingAll ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {t('pages.platformAdmin.exportingAll')}
                      </>
                    ) : (
                      <>
                        <Database className="h-4 w-4 mr-2" />
                        {t('pages.platformAdmin.exportAllBtn')}
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    {t('pages.platformAdmin.exportWarning')}
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
