import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BookOpen,
  DollarSign,
  Package,
  Users,
  Factory,
  UserCheck,
  Receipt,
} from 'lucide-react';
import { useReportsGuideUrl } from '@/hooks/useAppConfig';
import { usePermissions } from '@/hooks/usePermissions';
import { RevenueProfitReport } from '@/components/reports/RevenueProfitReport';
import { ProductReport } from '@/components/reports/ProductReport';
import { CustomerReport } from '@/components/reports/CustomerReport';
import { SupplierReport } from '@/components/reports/SupplierReport';
import { StaffReport } from '@/components/reports/StaffReport';
import { TaxReport } from '@/components/reports/TaxReport';

const baseReportTabs = [
  { id: 'revenue', label: 'Doanh thu & Lợi nhuận', icon: DollarSign, description: 'Phân tích doanh thu, chi phí, lợi nhuận' },
  { id: 'products', label: 'Hàng hóa', icon: Package, description: 'Bán chạy, tồn kho, nhập xuất' },
  { id: 'customers', label: 'Khách hàng', icon: Users, description: 'Top khách hàng, công nợ, CRM' },
  { id: 'suppliers', label: 'Nhà cung cấp', icon: Factory, description: 'Nhập hàng, công nợ NCC' },
  { id: 'staff', label: 'Nhân viên', icon: UserCheck, description: 'Hiệu suất, KPI, doanh thu' },
];

const taxTab = { id: 'tax', label: 'Báo cáo thuế', icon: Receipt, description: 'Ước tính thuế GTGT, TNCN phải nộp' };

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('revenue');
  const reportsGuideUrl = useReportsGuideUrl();
  const { data: permissions } = usePermissions();

  // Chỉ super_admin và branch_admin mới thấy báo cáo thuế
  const canViewTaxReport = permissions?.role === 'super_admin' || permissions?.role === 'branch_admin';
  const reportTabs = canViewTaxReport ? [...baseReportTabs, taxTab] : baseReportTabs;

  const activeReport = reportTabs.find(t => t.id === activeTab);
  const ActiveIcon = activeReport?.icon || DollarSign;

  return (
    <MainLayout>
      <PageHeader
        title="Báo cáo"
        description={activeReport?.description || 'Phân tích chi tiết hoạt động kinh doanh'}
        actions={
          reportsGuideUrl && (
            <Button variant="secondary" size="sm" asChild>
              <a href={reportsGuideUrl} target="_blank" rel="noopener noreferrer">
                <BookOpen className="mr-2 h-4 w-4" />
                Hướng dẫn
              </a>
            </Button>
          )
        }
      />

      <div className="p-6 space-y-6">
        {/* Report Selector Dropdown */}
        <Select value={activeTab} onValueChange={setActiveTab}>
          <SelectTrigger className="w-full sm:w-72">
            <div className="flex items-center gap-2">
              <ActiveIcon className="h-4 w-4" />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent className="bg-popover">
            {reportTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <SelectItem key={tab.id} value={tab.id}>
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        {/* Report Content */}
        {activeTab === 'revenue' && <RevenueProfitReport />}
        {activeTab === 'products' && <ProductReport />}
        {activeTab === 'customers' && <CustomerReport />}
        {activeTab === 'suppliers' && <SupplierReport />}
        {activeTab === 'staff' && <StaffReport />}
        {activeTab === 'tax' && canViewTaxReport && <TaxReport />}
      </div>
    </MainLayout>
  );
}
