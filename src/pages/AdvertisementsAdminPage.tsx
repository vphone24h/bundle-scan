import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Plus, Loader2 } from 'lucide-react';
import { useAdvertisements } from '@/hooks/useAdvertisements';
import { AdvertisementList } from '@/components/advertisements/AdvertisementList';
import { AdvertisementFormDialog } from '@/components/advertisements/AdvertisementFormDialog';
import { Advertisement } from '@/hooks/useAdvertisements';
import { useTranslation } from 'react-i18next';

export default function AdvertisementsAdminPage() {
  const { t } = useTranslation();
  const { data: ads, isLoading } = useAdvertisements();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<Advertisement | null>(null);

  const handleCreate = () => {
    setEditingAd(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (ad: Advertisement) => {
    setEditingAd(ad);
    setIsDialogOpen(true);
  };

  const handleClose = () => {
    setIsDialogOpen(false);
    setEditingAd(null);
  };

  // Shell-first: no spinner

  return (
    <MainLayout>
      <PageHeader 
        title={t('pages.advertisements.title')}
        description={t('pages.advertisements.description')}
        helpText={t('pages.advertisements.helpText')}
      />

      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            Tổng cộng: {ads?.length || 0} quảng cáo
          </div>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Thêm quảng cáo
          </Button>
        </div>

        <AdvertisementList 
          advertisements={ads || []} 
          onEdit={handleEdit}
        />

        <AdvertisementFormDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          advertisement={editingAd}
          onClose={handleClose}
        />
      </div>
    </MainLayout>
  );
}
