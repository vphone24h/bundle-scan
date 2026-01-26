import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { AffiliateUserDashboard } from '@/components/affiliate/AffiliateUserDashboard';

export default function AffiliatePage() {
  return (
    <MainLayout>
      <div className="p-4 sm:p-6 space-y-6">
        <PageHeader 
          title="Chương trình Affiliate" 
          description="Giới thiệu khách hàng mới và nhận hoa hồng"
        />
        <AffiliateUserDashboard />
      </div>
    </MainLayout>
  );
}
