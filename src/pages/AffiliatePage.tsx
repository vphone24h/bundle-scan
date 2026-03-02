import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { AffiliateUserDashboard } from '@/components/affiliate/AffiliateUserDashboard';
import { useTranslation } from 'react-i18next';

export default function AffiliatePage() {
  const { t } = useTranslation();
  return (
    <MainLayout>
      <div className="p-4 sm:p-6 space-y-6">
        <PageHeader 
          title={t('pages.affiliate.title')}
          description={t('pages.affiliate.description')}
          helpText={t('pages.affiliate.helpText')}
        />
        <AffiliateUserDashboard />
      </div>
    </MainLayout>
  );
}
