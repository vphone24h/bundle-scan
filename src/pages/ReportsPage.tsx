import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  BookOpen,
  DollarSign,
  Package,
  Users,
  Factory,
  UserCheck,
} from 'lucide-react';
import { useReportsGuideUrl } from '@/hooks/useAppConfig';
import { RevenueProfitReport } from '@/components/reports/RevenueProfitReport';
import { ProductReport } from '@/components/reports/ProductReport';
import { CustomerReport } from '@/components/reports/CustomerReport';
import { SupplierReport } from '@/components/reports/SupplierReport';
import { StaffReport } from '@/components/reports/StaffReport';

const reportTabs = [
  { id: 'revenue', label: 'Doanh thu & Lợi nhuận', icon: DollarSign, description: 'Phân tích doanh thu, chi phí, lợi nhuận' },
  { id: 'products', label: 'Hàng hóa', icon: Package, description: 'Bán chạy, tồn kho, nhập xuất' },
  { id: 'customers', label: 'Khách hàng', icon: Users, description: 'Top khách hàng, công nợ, CRM' },
  { id: 'suppliers', label: 'Nhà cung cấp', icon: Factory, description: 'Nhập hàng, công nợ NCC' },
  { id: 'staff', label: 'Nhân viên', icon: UserCheck, description: 'Hiệu suất, KPI, doanh thu' },
];

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('revenue');
  const reportsGuideUrl = useReportsGuideUrl();

  const activeReport = reportTabs.find(t => t.id === activeTab);

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
        {/* Report Navigation Tabs */}
        <div className="flex flex-wrap gap-2">
          {reportTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <Button
                key={tab.id}
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'gap-2 transition-all',
                  isActive && 'shadow-md'
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
              </Button>
            );
          })}
        </div>

        {/* Report Content */}
        {activeTab === 'revenue' && <RevenueProfitReport />}
        {activeTab === 'products' && <ProductReport />}
        {activeTab === 'customers' && <CustomerReport />}
        {activeTab === 'suppliers' && <SupplierReport />}
        {activeTab === 'staff' && <StaffReport />}
      </div>
    </MainLayout>
  );
}
