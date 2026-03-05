import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { LandingPageSettings } from '@/components/admin/LandingPageSettings';
import { LandingProductsTab } from '@/components/admin/LandingProductsTab';
import { LandingArticlesTab } from '@/components/admin/LandingArticlesTab';
import { LandingOrdersTab } from '@/components/admin/LandingOrdersTab';
import { LandingZaloMailTab } from '@/components/admin/LandingZaloMailTab';
import { EmailAutomationTab } from '@/components/admin/EmailAutomationTab';
import { usePermissions } from '@/hooks/usePermissions';
import { usePendingOrderCount } from '@/hooks/useLandingOrders';
import { useLandingGuideUrl } from '@/hooks/useAppConfig';
import { useOnboardingTour } from '@/hooks/useOnboardingTour';
import { OnboardingTourOverlay, TourStep } from '@/components/onboarding/OnboardingTourOverlay';
import { Navigate, useNavigate } from 'react-router-dom';
import { BookOpen, Pencil } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

const LANDING_TOUR_STEPS: TourStep[] = [
  {
    title: '🌐 Website bán hàng',
    description: 'Đây là trang quản trị **Website bán hàng** — nơi bạn thiết lập trang web riêng để giới thiệu sản phẩm và nhận đơn hàng từ khách hàng **hoàn toàn miễn phí**!',
    isInfo: true,
    navigateTo: '/landing-settings',
  },
  {
    title: '⚙️ Tab Cấu hình',
    description: 'Tại đây bạn cài đặt **tên cửa hàng**, **logo**, **số điện thoại**, **màu sắc**, **banner** và **tên miền riêng** cho website. Đây là bước đầu tiên cần làm!',
    targetSelector: '[data-tour="landing-tab-settings"]',
    position: 'bottom',
    navigateTo: '/landing-settings',
  },
  {
    title: '📦 Tab Sản phẩm',
    description: 'Chọn những sản phẩm từ kho muốn **hiển thị lên website**. Bạn có thể thêm ảnh, giá bán, mô tả và chọn thứ tự hiển thị cho từng sản phẩm.',
    targetSelector: '[data-tour="landing-tab-products"]',
    position: 'bottom',
    navigateTo: '/landing-settings',
  },
  {
    title: '📰 Tab Tin tức',
    description: 'Đăng các **bài viết tin tức**, khuyến mãi, thông báo lên website. Tin tức giúp giữ chân khách hàng và tăng uy tín cửa hàng.',
    targetSelector: '[data-tour="landing-tab-articles"]',
    position: 'bottom',
    navigateTo: '/landing-settings',
  },
  {
    title: '🛒 Tab Đơn đặt hàng',
    description: 'Khi khách đặt hàng qua website, đơn sẽ xuất hiện ở đây. Bạn **xác nhận**, **liên hệ khách** và chốt đơn. Badge đỏ sẽ báo số đơn chờ xử lý.',
    targetSelector: '[data-tour="landing-tab-orders"]',
    position: 'bottom',
    navigateTo: '/landing-settings',
  },
  {
    title: '🔗 Xem website công khai',
    description: 'Sau khi cấu hình xong, nhấn nút **"Xem website"** để xem trang bán hàng như khách hàng thấy. Chia sẻ link này cho khách để nhận đơn hàng! 🎊',
    targetSelector: '[data-tour="landing-link-card"]',
    position: 'bottom',
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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: permissions, isLoading } = usePermissions();
  const landingGuideUrl = useLandingGuideUrl();
  const { isCompleted: tourCompleted, completeTour } = useOnboardingTour('landing-page-admin-v3');
  const [tourDismissed, setTourDismissed] = useState(false);

  const role = permissions?.role;
  const isSuperAdmin = role === 'super_admin';
  const isBranchAdmin = role === 'branch_admin';
  const isStaff = role === 'staff';
  const isCashier = role === 'cashier';
  
  if (!isLoading && (isCashier || (!isSuperAdmin && !isBranchAdmin && !isStaff))) {
    return <Navigate to="/" replace />;
  }

  const showSettings = isSuperAdmin;
  const showProducts = isSuperAdmin || isBranchAdmin || isStaff;
  const showArticles = true;
  const showOrders = true;

  const defaultTab = isSuperAdmin ? 'settings' : (isStaff ? 'products' : 'articles');
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || defaultTab;

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  return (
    <MainLayout>
      <div className="p-4 sm:p-6">
        <PageHeader 
          title={t('pages.landingPage.title')}
          description={t('pages.landingPage.description')}
          helpText={t('pages.landingPage.helpText')}
          actions={
            isSuperAdmin ? (
              <Button onClick={() => navigate('/website-editor')} className="gap-1.5">
                <Pencil className="h-4 w-4" />
                Chỉnh sửa Website
              </Button>
            ) : undefined
          }
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
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="mb-4 w-full overflow-x-auto justify-start scrollbar-hide">
              {showSettings && <TabsTrigger value="settings" data-tour="landing-tab-settings">Cấu hình</TabsTrigger>}
              {showProducts && <TabsTrigger value="products" data-tour="landing-tab-products">Sản phẩm</TabsTrigger>}
              {showArticles && <TabsTrigger value="articles" data-tour="landing-tab-articles">Tin tức</TabsTrigger>}
              {showOrders && (
                <TabsTrigger value="orders" className="relative" data-tour="landing-tab-orders">
                  Đơn đặt hàng
                  <PendingBadge />
                </TabsTrigger>
              )}
              {showSettings && (
                <TabsTrigger value="zalo-mail">
                  <span className="flex items-center gap-1">Quản lý Zalo/Mail</span>
                </TabsTrigger>
              )}
              {showSettings && (
                <TabsTrigger value="email-automation">
                  <span className="flex items-center gap-1">Email Automation</span>
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
            {showSettings && (
              <TabsContent value="zalo-mail">
                <LandingZaloMailTab />
              </TabsContent>
            )}
            {showSettings && (
              <TabsContent value="email-automation">
                <EmailAutomationTab />
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
        tourKey="landing-page-admin-v3"
      />
    </MainLayout>
  );
}
