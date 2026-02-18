import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { LandingPageSettings } from '@/components/admin/LandingPageSettings';
import { LandingProductsTab } from '@/components/admin/LandingProductsTab';
import { LandingArticlesTab } from '@/components/admin/LandingArticlesTab';
import { LandingOrdersTab } from '@/components/admin/LandingOrdersTab';
import { usePermissions } from '@/hooks/usePermissions';
import { usePendingOrderCount } from '@/hooks/useLandingOrders';
import { useLandingGuideUrl } from '@/hooks/useAppConfig';
import { useOnboardingTour } from '@/hooks/useOnboardingTour';
import { OnboardingTourOverlay, TourStep } from '@/components/onboarding/OnboardingTourOverlay';
import { Navigate } from 'react-router-dom';
import { Loader2, BookOpen } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

const LANDING_TOUR_STEPS: TourStep[] = [
  // ====== TỔNG QUAN ======
  {
    title: '🌐 Website bán hàng',
    description: 'Đây là trang quản trị **Website bán hàng** — nơi bạn thiết lập trang web riêng để giới thiệu sản phẩm và nhận đơn hàng từ khách hàng **hoàn toàn miễn phí**! Hãy cùng khám phá từng chức năng nhé 🚀',
    isInfo: true,
    navigateTo: '/landing-settings',
  },

  // ====== TAB CẤU HÌNH ======
  {
    title: '⚙️ Tab Cấu hình',
    description: 'Đây là trung tâm cài đặt website. Tất cả thông tin cửa hàng, hình ảnh, màu sắc đều được thiết lập tại đây. Nhấn **Cấu hình** để vào!',
    targetSelector: '[data-tour="landing-tab-settings"]',
    position: 'bottom',
    navigateTo: '/landing-settings',
  },
  {
    title: '🔗 Link & Mã QR website',
    description: 'Đây là **link website** của bạn — chia sẻ cho khách hàng để họ truy cập. Bạn có thể **sao chép link**, in **mã QR** dán lên cửa hàng, hoặc nâng cấp lên tên miền riêng!',
    targetSelector: '[data-tour="landing-link-card"]',
    position: 'bottom',
    navigateTo: '/landing-settings',
  },
  {
    title: '🏪 Thông tin cửa hàng',
    description: 'Nhập **tên cửa hàng**, **logo**, **địa chỉ**, **số điện thoại** và **mô tả**. Đây là thông tin hiển thị đầu tiên khi khách vào website của bạn.',
    targetSelector: '[data-tour="landing-store-info-card"]',
    position: 'top',
    navigateTo: '/landing-settings',
  },
  {
    title: '🛡️ Tra cứu bảo hành',
    description: 'Bật tính năng này để khách hàng tự tra cứu **tình trạng bảo hành** bằng IMEI hoặc SĐT. Cài thêm **hotline** và **link nhóm Zalo/Facebook** để hỗ trợ khách sau mua.',
    targetSelector: '[data-tour="landing-warranty-card"]',
    position: 'top',
    navigateTo: '/landing-settings',
  },
  {
    title: '🖼️ Banner quảng cáo',
    description: 'Upload **ảnh banner** khuyến mãi hiển thị nổi bật trên trang chủ website. Có thể gắn **link click** vào banner để dẫn khách đến sản phẩm hoặc bài viết cụ thể.',
    targetSelector: '[data-tour="landing-banner-card"]',
    position: 'top',
    navigateTo: '/landing-settings',
  },
  {
    title: '🎨 Giao diện & Màu sắc',
    description: 'Chọn **màu chủ đạo** phù hợp với thương hiệu của bạn. Màu này sẽ được áp dụng cho toàn bộ nút, tiêu đề và điểm nhấn trên website.',
    targetSelector: '[data-tour="landing-color-card"]',
    position: 'top',
    navigateTo: '/landing-settings',
  },
  {
    title: '📱 Kênh mạng xã hội',
    description: 'Gắn link **Facebook**, **Zalo** (chỉ cần số điện thoại) và **TikTok**. Khách nhấn vào sẽ được dẫn thẳng tới trang mạng xã hội của cửa hàng để liên hệ hoặc theo dõi.',
    targetSelector: '[data-tour="landing-social-card"]',
    position: 'top',
    navigateTo: '/landing-settings',
  },

  // ====== TAB SẢN PHẨM ======
  {
    title: '📦 Tab Sản phẩm',
    description: 'Thêm sản phẩm để hiển thị lên website bán hàng. Khách có thể xem thông tin và **đặt hàng trực tiếp** từ đây.',
    targetSelector: '[data-tour="landing-tab-products"]',
    position: 'bottom',
    navigateTo: '/landing-settings',
  },
  {
    title: '🗂️ Danh mục sản phẩm',
    description: 'Tạo **danh mục** để phân loại sản phẩm (VD: iPhone, Samsung, Phụ kiện...). Khách hàng có thể lọc theo danh mục để tìm nhanh hơn.',
    targetSelector: '[data-tour="landing-products-category"]',
    position: 'bottom',
    navigateTo: '/landing-settings',
  },
  {
    title: '➕ Thêm sản phẩm',
    description: 'Nhấn **"Thêm sản phẩm"** để tạo sản phẩm mới. Bạn có thể upload nhiều ảnh, thêm **biến thể** (màu sắc, dung lượng) với giá riêng, và bật/tắt hiển thị từng sản phẩm.',
    targetSelector: '[data-tour="landing-products-add-btn"]',
    position: 'bottom',
    navigateTo: '/landing-settings',
  },

  // ====== TAB TIN TỨC ======
  {
    title: '📰 Tab Tin tức',
    description: 'Đăng **bài viết** khuyến mãi, tin tức, hướng dẫn sử dụng lên website. Tin tức giúp giữ chân khách hàng và tăng độ uy tín của cửa hàng.',
    targetSelector: '[data-tour="landing-tab-articles"]',
    position: 'bottom',
    navigateTo: '/landing-settings',
  },

  // ====== TAB ĐƠN HÀNG ======
  {
    title: '🛒 Tab Đơn đặt hàng',
    description: 'Khi khách đặt hàng qua website, đơn xuất hiện tại đây. Bạn có thể **duyệt**, **gọi điện cho khách** và **chốt đơn**. Chấm đỏ báo có đơn mới chờ xử lý!',
    targetSelector: '[data-tour="landing-tab-orders"]',
    position: 'bottom',
    navigateTo: '/landing-settings',
  },
  {
    title: '🔍 Lọc & Tìm kiếm đơn',
    description: 'Lọc đơn theo trạng thái: **Chờ duyệt** / **Đã duyệt** / **Đã hủy**. Tìm kiếm theo tên khách, SĐT hoặc tên sản phẩm để xử lý nhanh.',
    targetSelector: '[data-tour="landing-orders-filter"]',
    position: 'bottom',
    navigateTo: '/landing-settings',
  },

  // ====== KẾT THÚC ======
  {
    title: '🎊 Sẵn sàng ra mắt!',
    description: 'Bạn đã nắm hết các chức năng! Hãy **hoàn thiện thông tin cửa hàng**, thêm sản phẩm rồi **chia sẻ link website** cho khách hàng. Chúc bạn bán hàng thật hiệu quả! 🚀',
    isInfo: true,
    navigateTo: '/landing-settings',
  },
];


function PendingBadge() {
  const { data: count } = usePendingOrderCount();
  if (!count) return null;
  return (
    <span className="ml-1.5 inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
      {count > 99 ? '99+' : count}
    </span>
  );
}

export default function LandingPageAdminPage() {
  const { data: permissions, isLoading } = usePermissions();
  const landingGuideUrl = useLandingGuideUrl();
  const { isCompleted: tourCompleted, completeTour } = useOnboardingTour('landing-page-admin-v2');
  const [tourDismissed, setTourDismissed] = useState(false);

  // Shell-first: no spinner, render layout immediately

  const role = permissions?.role;
  const isSuperAdmin = role === 'super_admin';
  const isBranchAdmin = role === 'branch_admin';
  const isStaff = role === 'staff';
  const isCashier = role === 'cashier';
  
  // Kế toán không có quyền truy cập Landing Page (only enforce after loading)
  if (!isLoading && (isCashier || (!isSuperAdmin && !isBranchAdmin && !isStaff))) {
    return <Navigate to="/" replace />;
  }

  // Xác định tab mặc định và tab hiển thị theo vai trò
  // Super Admin: tất cả tab (Cấu hình, Sản phẩm, Tin tức, Đơn hàng)
  // Branch Admin: Tin tức, Đơn đặt hàng
  // Staff: Sản phẩm, Tin tức, Đơn đặt hàng
  const showSettings = isSuperAdmin;
  const showProducts = isSuperAdmin || isBranchAdmin || isStaff;
  const showArticles = true; // Tất cả role đều thấy
  const showOrders = true;   // Tất cả role đều thấy

  const defaultTab = isSuperAdmin ? 'settings' : (isStaff ? 'products' : 'articles');

  return (
    <MainLayout>
      <div className="p-4 sm:p-6">
        <PageHeader 
          title="Website bán hàng" 
          description="Cấu hình website bán hàng cho khách hàng"
          helpText="Thiết lập website bán hàng công khai: sản phẩm, tin tức, tra cứu bảo hành. Khách hàng có thể truy cập qua subdomain hoặc tên miền riêng của bạn."
        />
        {landingGuideUrl && (
          <div className="mt-4">
            <Button variant="outline" size="sm" asChild>
              <a href={landingGuideUrl} target="_blank" rel="noopener noreferrer">
                <BookOpen className="mr-2 h-4 w-4" />
                Hướng dẫn sử dụng
              </a>
            </Button>
          </div>
        )}
        <div className="mt-4">
          <Tabs defaultValue={defaultTab}>
            <TabsList className="mb-4">
              {showSettings && <TabsTrigger value="settings" data-tour="landing-tab-settings">Cấu hình</TabsTrigger>}
              {showProducts && <TabsTrigger value="products" data-tour="landing-tab-products">Sản phẩm</TabsTrigger>}
              {showArticles && <TabsTrigger value="articles" data-tour="landing-tab-articles">Tin tức</TabsTrigger>}
              {showOrders && (
                <TabsTrigger value="orders" className="relative" data-tour="landing-tab-orders">
                  Đơn đặt hàng
                  <PendingBadge />
                </TabsTrigger>
              )}
            </TabsList>
            {showSettings && (
              <TabsContent value="settings">
                <LandingPageSettings />
              </TabsContent>
            )}
            {showProducts && (
              <TabsContent value="products">
                <LandingProductsTab />
              </TabsContent>
            )}
            {showArticles && (
              <TabsContent value="articles">
                <LandingArticlesTab />
              </TabsContent>
            )}
            {showOrders && (
              <TabsContent value="orders">
                <LandingOrdersTab />
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>
      <OnboardingTourOverlay
        steps={LANDING_TOUR_STEPS}
        isActive={!tourCompleted && !tourDismissed}
        onComplete={completeTour}
        onSkip={() => { completeTour(); setTourDismissed(true); }}
        tourKey="landing-page-admin-v2"
      />
    </MainLayout>
  );
}
