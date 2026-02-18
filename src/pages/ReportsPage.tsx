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
  PlayCircle,
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

// --- Tour steps per tab ---
const TOUR_STEPS: Record<string, TourStep[]> = {
  revenue: [
    {
      title: '📊 Đây là trung tâm tài chính của bạn',
      description: 'Xem **doanh thu**, **chi phí** và **lợi nhuận** theo ngày, tháng hoặc năm. Tất cả dữ liệu được tổng hợp tự động.',
      isInfo: true,
      position: 'center',
    },
    {
      title: '⏱ Chọn nhanh khoảng thời gian',
      description: 'Nhấn **Hôm nay**, **Hôm qua**, **Tuần này**, **Tháng này**... để lọc nhanh doanh thu theo mốc bất kỳ.',
      targetSelector: '[data-tour="report-time-presets"]',
      position: 'bottom',
    },
    {
      title: '📅 Hoặc tùy chỉnh ngày cụ thể',
      description: 'Nhập **ngày bắt đầu** và **kết thúc** để xem báo cáo theo khoảng thời gian bất kỳ.',
      targetSelector: '[data-tour="report-date-filter"]',
      position: 'bottom',
    },
    {
      title: '💰 Báo cáo Doanh thu & Lợi nhuận',
      description: 'Đây là báo cáo quan trọng nhất. Cho biết bạn đang **lời hay lỗ**, dựa trên từng đơn hàng thực tế.',
      targetSelector: '[data-tour="report-selector"]',
      position: 'bottom',
    },
  ],
  products: [
    {
      title: '📦 Báo cáo Hàng hóa',
      description: 'Theo dõi sản phẩm **bán chạy**, **tồn kho** hiện tại và lịch sử **nhập-xuất** theo từng danh mục.',
      isInfo: true,
      position: 'center',
    },
    {
      title: '⏱ Chọn khoảng thời gian',
      description: 'Lọc nhanh theo **Hôm nay**, **Tuần này**, **Tháng này** để xem sản phẩm nào **bán chạy nhất** trong kỳ.',
      targetSelector: '[data-tour="product-report-filter"]',
      position: 'bottom',
    },
    {
      title: '🏆 Tab Bán hàng & Tồn kho',
      description: 'Xem top sản phẩm **bán chạy**, **doanh thu** và **lợi nhuận** từng mặt hàng. Sắp xếp theo nhiều tiêu chí.',
      isInfo: true,
      position: 'center',
    },
    {
      title: '🔄 Tab Nhập – Xuất',
      description: 'Theo dõi **số lượng nhập kho** và **xuất bán** theo từng sản phẩm trong kỳ.',
      isInfo: true,
      position: 'center',
    },
  ],
  customers: [
    {
      title: '👥 Báo cáo Khách hàng',
      description: 'Xem danh sách khách hàng **mua nhiều nhất**, tổng **công nợ** và **khách hàng mới** trong kỳ.',
      isInfo: true,
      position: 'center',
    },
    {
      title: '⏱ Lọc theo thời gian',
      description: 'Chọn khoảng thời gian để xem **top khách hàng**, **doanh thu** và **công nợ** trong kỳ đó.',
      targetSelector: '[data-tour="customer-report-filter"]',
      position: 'bottom',
    },
    {
      title: '📊 Sắp xếp theo tiêu chí',
      description: 'Sắp xếp theo **Mua nhiều nhất**, **Nhiều đơn hàng**, **Công nợ cao** hoặc **Mua gần đây** để phân tích từng nhóm khách.',
      isInfo: true,
      position: 'center',
    },
    {
      title: '📥 Xuất Excel',
      description: 'Tải toàn bộ danh sách khách hàng ra **file Excel** để báo cáo hoặc phân tích thêm.',
      isInfo: true,
      position: 'center',
    },
  ],
  suppliers: [
    {
      title: '🏭 Báo cáo Nhà cung cấp',
      description: 'Theo dõi **tổng nhập hàng** từ từng nhà cung cấp, **công nợ chưa trả** và lịch sử **trả hàng**.',
      isInfo: true,
      position: 'center',
    },
    {
      title: '📦 Tab Nhập hàng & Công nợ',
      description: 'Xem **tổng tiền đã nhập** từ mỗi NCC, số tiền **còn nợ** và trạng thái **thanh toán**.',
      isInfo: true,
      position: 'center',
    },
    {
      title: '🔄 Tab Trả hàng NCC',
      description: 'Theo dõi **lý do trả hàng**, **tỷ lệ lỗi** từng nhà cung cấp để đánh giá chất lượng nguồn hàng.',
      isInfo: true,
      position: 'center',
    },
  ],
  staff: [
    {
      title: '👤 Báo cáo Nhân viên',
      description: 'Xem **doanh thu**, **số đơn hàng** và tiến độ **KPI** của từng nhân viên trong kỳ.',
      isInfo: true,
      position: 'center',
    },
    {
      title: '⏱ Lọc theo kỳ',
      description: 'Chọn **Tuần này**, **Tháng này** hoặc **Tháng trước** để so sánh hiệu suất nhân viên theo từng giai đoạn.',
      targetSelector: '[data-tour="staff-report-filter"]',
      position: 'bottom',
    },
    {
      title: '🏆 Xem chi tiết từng nhân viên',
      description: 'Nhấn vào **tên nhân viên** để xem chi tiết **đơn hàng**, **nhật ký chăm sóc** khách và tiến độ **KPI**.',
      isInfo: true,
      position: 'center',
    },
    {
      title: '🎯 Sắp xếp theo KPI thấp nhất',
      description: 'Dùng chế độ **"KPI thấp nhất"** để phát hiện nhân viên cần hỗ trợ và điều chỉnh **mục tiêu** kịp thời.',
      isInfo: true,
      position: 'center',
    },
  ],
  tax: [
    {
      title: '🧾 Báo cáo thuế Hộ kinh doanh',
      description: 'Ước tính **thuế GTGT** và **TNCN** phải nộp theo chuẩn mẫu **S2a-HKD** (Thông tư 152/2025). Chỉ mang tính tham khảo.',
      isInfo: true,
      position: 'center',
    },
    {
      title: '📅 Chọn kỳ kê khai',
      description: 'Chọn **Tháng này**, **Quý 1-4** hoặc **Năm nay** để tính thuế theo đúng **kỳ cần kê khai**.',
      targetSelector: '[data-tour="tax-report-period"]',
      position: 'bottom',
    },
    {
      title: '📋 Điền đủ 3 bước',
      description: 'Chọn **ngành nghề** → Ước chừng **doanh thu năm** → Cách tính **thuế TNCN**. Hệ thống sẽ tự tính **số thuế phải nộp**.',
      isInfo: true,
      position: 'center',
    },
    {
      title: '📤 Xuất mẫu S2a chính thức',
      description: 'Nhấn **"Xuất Excel S2a"** để tải file Excel **đúng mẫu kê khai** nộp thuế, có đủ tiêu đề và chữ ký.',
      isInfo: true,
      position: 'center',
    },
  ],
};

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('revenue');
  const reportsGuideUrl = useReportsGuideUrl();
  const { data: permissions } = usePermissions();
  const { data: tenant } = useCurrentTenant();
  const [manualTourActive, setManualTourActive] = useState(false);

  // Main onboarding tour (revenue tab)
  const { isCompleted: reportsTourDone, completeTour: completeReportsTour, isLoading: tourLoading } = useOnboardingTour('reports_overview');
  const { isCompleted: productsTourDone, completeTour: completeProductsTour, isLoading: productsTourLoading } = useOnboardingTour('reports_products');
  const { isCompleted: customersTourDone, completeTour: completeCustomersTour, isLoading: customersTourLoading } = useOnboardingTour('reports_customers');
  const { isCompleted: suppliersTourDone, completeTour: completeSuppliersTour, isLoading: suppliersTourLoading } = useOnboardingTour('reports_suppliers');
  const { isCompleted: staffTourDone, completeTour: completeStaffTour, isLoading: staffTourLoading } = useOnboardingTour('reports_staff');
  const { isCompleted: taxTourDone, completeTour: completeTaxTour, isLoading: taxTourLoading } = useOnboardingTour('reports_tax');

  const [profit7Days, setProfit7Days] = useState<number | null>(null);

  // Fetch 7-day revenue for WOW moment
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

  const buildRevenueTourSteps = (): TourStep[] => {
    const hasData = profit7Days !== null && profit7Days > 0;
    const wowStep: TourStep = hasData
      ? {
          title: `🎉 Doanh thu 7 ngày: ${formatNumber(profit7Days!)}đ`,
          description: 'Tuyệt vời! Bạn đang có **doanh thu**. Vào mục **Doanh thu & Lợi nhuận** để xem chi tiết **lợi nhuận thực tế**.',
          isInfo: true,
          position: 'center',
        }
      : {
          title: '⚠️ Bạn chưa có dữ liệu để phân tích',
          description: 'Hãy tạo **đơn hàng đầu tiên** để xem lợi nhuận. Mỗi đơn bán ra, hệ thống sẽ tự tính **lời/lỗ** cho bạn.',
          isInfo: true,
          position: 'center',
        };
    return [...TOUR_STEPS.revenue, wowStep];
  };

  // Chỉ super_admin và branch_admin mới thấy báo cáo thuế
  const canViewTaxReport = permissions?.role === 'super_admin' || permissions?.role === 'branch_admin';
  const reportTabs = canViewTaxReport ? [...baseReportTabs, taxTab] : baseReportTabs;

  const activeReport = reportTabs.find(t => t.id === activeTab);
  const ActiveIcon = activeReport?.icon || DollarSign;

  const showRevenueTour = manualTourActive || (!tourLoading && !reportsTourDone && profit7Days !== null && activeTab === 'revenue');
  const showProductsTour = manualTourActive || (!productsTourLoading && !productsTourDone && activeTab === 'products');
  const showCustomersTour = manualTourActive || (!customersTourLoading && !customersTourDone && activeTab === 'customers');
  const showSuppliersTour = manualTourActive || (!suppliersTourLoading && !suppliersTourDone && activeTab === 'suppliers');
  const showStaffTour = manualTourActive || (!staffTourLoading && !staffTourDone && activeTab === 'staff');
  const showTaxTour = manualTourActive || (!taxTourLoading && !taxTourDone && activeTab === 'tax' && canViewTaxReport);

  return (
    <MainLayout>
      {showRevenueTour && (
        <OnboardingTourOverlay
          steps={buildRevenueTourSteps()}
          isActive={showRevenueTour}
          onComplete={() => { completeReportsTour(); setManualTourActive(false); }}
          onSkip={() => { completeReportsTour(); setManualTourActive(false); }}
          tourKey="reports_overview"
        />
      )}
      {showProductsTour && (
        <OnboardingTourOverlay
          steps={TOUR_STEPS.products}
          isActive={showProductsTour}
          onComplete={() => { completeProductsTour(); setManualTourActive(false); }}
          onSkip={() => { completeProductsTour(); setManualTourActive(false); }}
          tourKey="reports_products"
        />
      )}
      {showCustomersTour && (
        <OnboardingTourOverlay
          steps={TOUR_STEPS.customers}
          isActive={showCustomersTour}
          onComplete={() => { completeCustomersTour(); setManualTourActive(false); }}
          onSkip={() => { completeCustomersTour(); setManualTourActive(false); }}
          tourKey="reports_customers"
        />
      )}
      {showSuppliersTour && (
        <OnboardingTourOverlay
          steps={TOUR_STEPS.suppliers}
          isActive={showSuppliersTour}
          onComplete={() => { completeSuppliersTour(); setManualTourActive(false); }}
          onSkip={() => { completeSuppliersTour(); setManualTourActive(false); }}
          tourKey="reports_suppliers"
        />
      )}
      {showStaffTour && (
        <OnboardingTourOverlay
          steps={TOUR_STEPS.staff}
          isActive={showStaffTour}
          onComplete={() => { completeStaffTour(); setManualTourActive(false); }}
          onSkip={() => { completeStaffTour(); setManualTourActive(false); }}
          tourKey="reports_staff"
        />
      )}
      {showTaxTour && (
        <OnboardingTourOverlay
          steps={TOUR_STEPS.tax}
          isActive={showTaxTour}
          onComplete={() => { completeTaxTour(); setManualTourActive(false); }}
          onSkip={() => { completeTaxTour(); setManualTourActive(false); }}
          tourKey="reports_tax"
        />
      )}

      <PageHeader
        title="Báo cáo"
        description={activeReport?.description || 'Phân tích chi tiết hoạt động kinh doanh'}
        helpText="Xem báo cáo chi tiết về doanh thu, lợi nhuận, hàng bán chạy, hiệu suất nhân viên và tình hình nhà cung cấp. Lọc theo khoảng thời gian và xuất Excel."
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={manualTourActive ? "default" : "outline"}
              size="sm"
              onClick={() => setManualTourActive(v => !v)}
              className="h-8 text-xs sm:text-sm"
            >
              <PlayCircle className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">{manualTourActive ? 'Tắt hướng dẫn' : 'Xem hướng dẫn'}</span>
              <span className="sm:hidden">{manualTourActive ? 'Tắt HD' : 'Xem HD'}</span>
            </Button>
            {reportsGuideUrl && (
              <Button variant="secondary" size="sm" asChild>
                <a href={reportsGuideUrl} target="_blank" rel="noopener noreferrer">
                  <BookOpen className="mr-2 h-4 w-4" />
                  Hướng dẫn
                </a>
              </Button>
            )}
          </div>
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
