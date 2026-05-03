import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SalaryTemplatesTab } from '@/components/payroll/SalaryTemplatesTab';
import { PayrollPeriodsTab } from '@/components/payroll/PayrollPeriodsTab';
import { OvertimeReviewsTab } from '@/components/payroll/OvertimeReviewsTab';
import { LeaveApprovalsTab } from '@/components/payroll/LeaveApprovalsTab';
import { usePendingApprovals } from '@/hooks/usePendingApprovals';
import { PendingBadge } from '@/components/ui/pending-badge';

export default function PayrollPage() {
  const [tab, setTab] = useState('templates');
  const pending = usePendingApprovals();

  return (
    <MainLayout>
      <PageHeader
        title="Bảng lương"
        description="Quản lý mẫu lương và tính lương tự động"
      />
      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList className="inline-flex w-auto min-w-full sm:min-w-0 h-auto p-1 gap-1">
            <TabsTrigger value="templates" className="text-xs px-3 py-1.5">Mẫu lương</TabsTrigger>
            <TabsTrigger value="periods" className="text-xs px-3 py-1.5">Bảng lương</TabsTrigger>
            <TabsTrigger value="leave" className="text-xs px-3 py-1.5">Duyệt xin nghỉ <PendingBadge count={pending.leaveRequests} /></TabsTrigger>
            <TabsTrigger value="overtime" className="text-xs px-3 py-1.5">Duyệt tăng ca <PendingBadge count={pending.overtime} /></TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="templates" className="mt-4">
          <SalaryTemplatesTab />
        </TabsContent>
        <TabsContent value="periods" className="mt-4">
          <PayrollPeriodsTab />
        </TabsContent>
        <TabsContent value="leave" className="mt-4">
          <LeaveApprovalsTab />
        </TabsContent>
        <TabsContent value="overtime" className="mt-4">
          <OvertimeReviewsTab />
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
