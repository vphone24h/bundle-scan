import { useState, useEffect } from 'react';
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
import { OnboardingTourOverlay, TourStep } from '@/components/onboarding/OnboardingTourOverlay';
import { useOnboardingTour } from '@/hooks/useOnboardingTour';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenant } from '@/hooks/useTenant';
import { formatNumber } from '@/lib/formatNumber';
import { format, subDays } from 'date-fns';

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
  const { data: tenant } = useCurrentTenant();

  // Onboarding tour
  const { isCompleted: reportsTourDone, completeTour: completeReportsTour, isLoading: tourLoading } = useOnboardingTour('reports_overview');
  const [profit7Days, setProfit7Days] = useState<number | null>(null);

  // Fetch 7-day revenue for WOW moment (use total_amount as proxy)
  useEffect(() => {
    if (!tenant?.id || reportsTourDone) return;
    const fetchProfit = async () => {
      const endDate = format(new Date(), 'yyyy-MM-dd');
      const startDate = format(subDays(new Date(), 6), 'yyyy-MM-dd');
      const { data: exportData } = await supabase
        .from('export_receipts')
        .select('total_amount')
        .eq('tenant_id', tenant.id)
        .gte('created_at', startDate)
        .lte('created_at', endDate + 'T23:59:59');
      if (exportData) {
        const revenue = exportData.reduce((sum, r) => sum + (r.total_amount || 0), 0);
        setProfit7Days(revenue);
      } else {
        setProfit7Days(0);
      }
    };
    fetchProfit();
  }, [tenant?.id, reportsTourDone]);

  const buildTourSteps = (): TourStep[] => {
    const hasData = profit7Days !== null && profit7Days > 0;
    const wowStep: TourStep = hasData
      ? {
          title: `🎉 Doanh thu 7 ngày: ${formatNumber(profit7Days!)}đ`,
          description: 'Bạn đang có doanh thu! Vào mục Doanh thu & Lợi nhuận để xem chi tiết lợi nhuận thực tế của từng giai đoạn.',
          isInfo: true,
          position: 'center',
        }
      : {
          title: '⚠️ Bạn chưa có dữ liệu để phân tích',
          description: 'Hãy tạo đơn hàng đầu tiên để xem lợi nhuận. Mỗi đơn bán ra, hệ thống sẽ tự tính lời/lỗ cho bạn.',
          isInfo: true,
          position: 'center',
        };

    return [
      {
        title: '📊 Đây là trung tâm tài chính của bạn',
        description: 'Xem doanh thu, chi phí và lợi nhuận theo ngày, tháng hoặc năm. Tất cả dữ liệu được tổng hợp tự động.',
        isInfo: true,
        position: 'center',
      },
      {
        title: 'Chọn khoảng thời gian phân tích',
        description: 'Lọc theo Hôm nay, Tuần này, Tháng này... hoặc tùy chỉnh ngày bất kỳ để xem kết quả kinh doanh.',
        targetSelector: '[data-tour="report-date-filter"]',
        position: 'bottom',
      },
      {
        title: '💰 Báo cáo Doanh thu & Lợi nhuận',
        description: 'Đây là báo cáo quan trọng nhất. Giúp bạn biết đang lời hay lỗ, từng đơn hàng, từng danh mục sản phẩm.',
        targetSelector: '[data-tour="report-selector"]',
        position: 'bottom',
      },
      wowStep,
    ];
  };

  // Chỉ super_admin và branch_admin mới thấy báo cáo thuế
  const canViewTaxReport = permissions?.role === 'super_admin' || permissions?.role === 'branch_admin';
  const reportTabs = canViewTaxReport ? [...baseReportTabs, taxTab] : baseReportTabs;

  const activeReport = reportTabs.find(t => t.id === activeTab);
  const ActiveIcon = activeReport?.icon || DollarSign;

  const showTour = !tourLoading && !reportsTourDone && profit7Days !== null;

  return (
    <MainLayout>
      {showTour && (
        <OnboardingTourOverlay
          steps={buildTourSteps()}
          isActive={showTour}
          onComplete={completeReportsTour}
          onSkip={completeReportsTour}
          tourKey="reports_overview"
        />
      )}

      <PageHeader
        title="Báo cáo"
        description={activeReport?.description || 'Phân tích chi tiết hoạt động kinh doanh'}
        helpText="Xem báo cáo chi tiết về doanh thu, lợi nhuận, hàng bán chạy, hiệu suất nhân viên và tình hình nhà cung cấp. Lọc theo khoảng thời gian và xuất Excel."
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
        <Select value={activeTab} onValueChange={(v) => setActiveTab(v)}>
          <SelectTrigger className="w-full sm:w-72" data-tour="report-selector">
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
