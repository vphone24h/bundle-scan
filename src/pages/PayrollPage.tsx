import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { SalaryTemplatesTab } from '@/components/payroll/SalaryTemplatesTab';

export default function PayrollPage() {
  return (
    <MainLayout>
      <PageHeader
        title="Bảng lương"
        description="Quản lý mẫu lương: lương chính, thưởng, phụ cấp, hoa hồng, KPI"
      />
      <SalaryTemplatesTab />
    </MainLayout>
  );
}
