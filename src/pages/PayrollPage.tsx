import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DollarSign, Settings, BarChart3, Banknote } from 'lucide-react';
import { SalaryTemplatesTab } from '@/components/payroll/SalaryTemplatesTab';
import { CommissionRulesTab } from '@/components/payroll/CommissionRulesTab';
import { PayrollPeriodsTab } from '@/components/payroll/PayrollPeriodsTab';
import { SalaryAdvancesTab } from '@/components/payroll/SalaryAdvancesTab';

export default function PayrollPage() {
  const [activeTab, setActiveTab] = useState('templates');

  return (
    <MainLayout>
      <PageHeader
        title="Bảng lương"
        description="Quản lý mẫu lương, hoa hồng, kỳ lương và tạm ứng"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="templates" className="flex items-center gap-1.5">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Mẫu lương</span>
          </TabsTrigger>
          <TabsTrigger value="commission" className="flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Hoa hồng</span>
          </TabsTrigger>
          <TabsTrigger value="payroll" className="flex items-center gap-1.5">
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">Kỳ lương</span>
          </TabsTrigger>
          <TabsTrigger value="advances" className="flex items-center gap-1.5">
            <Banknote className="h-4 w-4" />
            <span className="hidden sm:inline">Tạm ứng</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates"><SalaryTemplatesTab /></TabsContent>
        <TabsContent value="commission"><CommissionRulesTab /></TabsContent>
        <TabsContent value="payroll"><PayrollPeriodsTab /></TabsContent>
        <TabsContent value="advances"><SalaryAdvancesTab mode="admin" /></TabsContent>
      </Tabs>
    </MainLayout>
  );
}
