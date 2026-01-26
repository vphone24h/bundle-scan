import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EInvoiceConfigForm } from '@/components/einvoice/EInvoiceConfigForm';
import { EInvoiceList } from '@/components/einvoice/EInvoiceList';
import { EInvoiceLogs } from '@/components/einvoice/EInvoiceLogs';
import { EInvoiceStats } from '@/components/einvoice/EInvoiceStats';
import { FileText, Settings, History, BarChart3, Lock, Loader2 } from 'lucide-react';
import { useCurrentTenant } from '@/hooks/useTenant';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function EInvoicePage() {
  const [activeTab, setActiveTab] = useState('invoices');
  const { data: tenant, isLoading: loadingTenant } = useCurrentTenant();

  if (loadingTenant) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  // Check if e-invoice is enabled for this tenant
  if (!tenant?.einvoice_enabled) {
    return (
      <MainLayout>
        <div className="p-4 sm:p-6 space-y-6">
          <PageHeader
            title="Hoá Đơn Điện Tử"
            description="Quản lý và phát hành hoá đơn điện tử kết nối cơ quan thuế"
          />
          
          <Card className="max-w-lg mx-auto">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Lock className="h-8 w-8 text-muted-foreground" />
              </div>
              <CardTitle>Tính năng chưa được kích hoạt</CardTitle>
              <CardDescription>
                Tính năng Hoá đơn điện tử chưa được bật cho cửa hàng của bạn.
                Vui lòng liên hệ quản trị viên để được hỗ trợ kích hoạt.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button variant="outline" onClick={() => window.history.back()}>
                Quay lại
              </Button>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Hoá Đơn Điện Tử"
          description="Quản lý và phát hành hoá đơn điện tử kết nối cơ quan thuế"
        />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="invoices" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Hoá đơn</span>
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Thống kê</span>
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Nhật ký</span>
            </TabsTrigger>
            <TabsTrigger value="config" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Cấu hình</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="invoices" className="mt-6">
            <EInvoiceList />
          </TabsContent>

          <TabsContent value="stats" className="mt-6">
            <EInvoiceStats />
          </TabsContent>

          <TabsContent value="logs" className="mt-6">
            <EInvoiceLogs />
          </TabsContent>

          <TabsContent value="config" className="mt-6">
            <EInvoiceConfigForm />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
