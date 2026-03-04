import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Calendar, History, BarChart3, FileText, ShoppingCart, Wallet, Ticket } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { CustomerListTab } from '@/components/customers/CustomerListTab';
import { CareScheduleTab } from '@/components/customers/CareScheduleTab';
import { CareTimelineTab } from '@/components/customers/CareTimelineTab';
import { CRMDashboardTab } from '@/components/customers/CRMDashboardTab';
import { CRMReportsTab } from '@/components/customers/CRMReportsTab';
import { VoucherHistoryTab } from '@/components/voucher/VoucherHistoryTab';
import { useCustomerDetail, useCustomerStats } from '@/hooks/useCustomerPoints';
import { formatNumber } from '@/lib/formatNumber';
import { useSearchParams } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';

export default function CustomersPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') || 'list';
  const customerIdFromUrl = searchParams.get('customerId');
  
  const [activeTab, setActiveTab] = useState(tabFromUrl);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(customerIdFromUrl);
  const [branchFilter, setBranchFilter] = useState('_all_');
  
  const { data: permissions } = usePermissions();
  const isSuperAdmin = permissions?.canViewAllBranches === true;
  
  const { data: selectedCustomer } = useCustomerDetail(selectedCustomerId);
  const { data: customerStats, isLoading: statsLoading } = useCustomerStats(branchFilter);

  useEffect(() => {
    if (!isSuperAdmin && permissions?.branchId) { setBranchFilter(permissions.branchId); }
  }, [isSuperAdmin, permissions?.branchId]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', value);
    setSearchParams(newParams);
  };

  const handleViewCare = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setActiveTab('care');
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', 'care');
    newParams.set('customerId', customerId);
    setSearchParams(newParams);
  };

  const handleViewTimeline = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setActiveTab('timeline');
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', 'timeline');
    newParams.set('customerId', customerId);
    setSearchParams(newParams);
  };

  const totalCustomers = customerStats?.totalCustomers || 0;
  const customersWithPoints = customerStats?.customersWithPoints || 0;
  const vipCustomers = customerStats?.vipCustomers || 0;
  const customersWithPurchase = customerStats?.customersWithPurchase || 0;

  return (
    <MainLayout>
      <PageHeader title={t('pages.customers.title')} helpText={t('pages.customers.helpText')} />

      <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-4 sm:mb-6">
        <Card>
          <CardContent className="pt-3 sm:pt-4 px-3 sm:px-4">
            <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg"><Users className="h-4 w-4 sm:h-5 sm:w-5 text-primary" /></div>
              <div className="text-center sm:text-left">
                <p className="text-lg sm:text-2xl font-bold">{totalCustomers}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">{t('pages.customers.totalCustomers')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 sm:pt-4 px-3 sm:px-4">
            <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-amber-500/10 rounded-lg"><Wallet className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" /></div>
              <div className="text-center sm:text-left">
                <p className="text-lg sm:text-2xl font-bold">{customersWithPoints}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">{t('pages.customers.hasPoints')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 sm:pt-4 px-3 sm:px-4">
            <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-purple-500/10 rounded-lg"><Users className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" /></div>
              <div className="text-center sm:text-left">
                <p className="text-lg sm:text-2xl font-bold">{vipCustomers}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">{t('pages.customers.vip')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 sm:pt-4 px-3 sm:px-4">
            <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-emerald-500/10 rounded-lg"><ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" /></div>
              <div className="text-center sm:text-left">
                <p className="text-lg sm:text-2xl font-bold">{customersWithPurchase}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">{t('pages.customers.purchased')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-3 sm:space-y-4">
        <TabsList className="grid w-full grid-cols-6 h-auto">
          <TabsTrigger value="list" className="text-xs sm:text-sm py-2 px-1 sm:px-3 gap-1 sm:gap-2">
            <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" /><span className="hidden sm:inline">{t('pages.customers.list')}</span>
          </TabsTrigger>
          <TabsTrigger value="care" className="text-xs sm:text-sm py-2 px-1 sm:px-3 gap-1 sm:gap-2">
            <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" /><span className="hidden sm:inline">{t('pages.customers.care')}</span>
          </TabsTrigger>
          <TabsTrigger value="timeline" className="text-xs sm:text-sm py-2 px-1 sm:px-3 gap-1 sm:gap-2">
            <History className="h-3.5 w-3.5 sm:h-4 sm:w-4" /><span className="hidden sm:inline">{t('pages.customers.timeline')}</span>
          </TabsTrigger>
          <TabsTrigger value="vouchers" className="text-xs sm:text-sm py-2 px-1 sm:px-3 gap-1 sm:gap-2">
            <Ticket className="h-3.5 w-3.5 sm:h-4 sm:w-4" /><span className="hidden sm:inline">{t('pages.customers.vouchers')}</span>
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="text-xs sm:text-sm py-2 px-1 sm:px-3 gap-1 sm:gap-2">
            <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" /><span className="hidden sm:inline">{t('pages.customers.performance')}</span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="text-xs sm:text-sm py-2 px-1 sm:px-3 gap-1 sm:gap-2">
            <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" /><span className="hidden sm:inline">{t('pages.customers.reports')}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list"><CustomerListTab onViewCare={handleViewCare} onViewTimeline={handleViewTimeline} branchFilter={branchFilter} onBranchFilterChange={setBranchFilter} /></TabsContent>
        <TabsContent value="care"><CareScheduleTab customerId={selectedCustomerId} customerName={selectedCustomer?.name} /></TabsContent>
        <TabsContent value="timeline"><CareTimelineTab customerId={selectedCustomerId} customerName={selectedCustomer?.name} customerPhone={selectedCustomer?.phone} customerEmail={selectedCustomer?.email} /></TabsContent>
        <TabsContent value="vouchers"><VoucherHistoryTab /></TabsContent>
        <TabsContent value="dashboard"><CRMDashboardTab /></TabsContent>
        <TabsContent value="reports"><CRMReportsTab /></TabsContent>
      </Tabs>
    </MainLayout>
  );
}
