import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Settings, Gift, Rocket, Loader2 } from 'lucide-react';
import { useMinigameCampaign, useMinigamePrizes } from '@/hooks/useMinigame';
import { MinigameConfigTab } from '@/components/minigame/settings/MinigameConfigTab';
import { MinigamePrizesTab } from '@/components/minigame/settings/MinigamePrizesTab';
import { MinigamePublishTab } from '@/components/minigame/settings/MinigamePublishTab';

export default function MinigameSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('config');

  const { data: campaign, isLoading: isLoadingCampaign } = useMinigameCampaign(id);
  const { data: prizes, isLoading: isLoadingPrizes } = useMinigamePrizes(id);

  if (isLoadingCampaign || isLoadingPrizes) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  if (!campaign) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
          <p className="text-muted-foreground">Không tìm thấy dự án</p>
          <Button variant="outline" onClick={() => navigate('/minigame')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Quay lại
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageHeader title="Cài đặt dự án" />

      <div className="p-4 sm:p-6">
        <Button variant="ghost" className="mb-4" onClick={() => navigate('/minigame')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Quay lại
        </Button>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="config" className="flex items-center gap-1">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Bước 1:</span> Cấu hình
            </TabsTrigger>
            <TabsTrigger value="prizes" className="flex items-center gap-1">
              <Gift className="h-4 w-4" />
              <span className="hidden sm:inline">Bước 2:</span> Giải thưởng
            </TabsTrigger>
            <TabsTrigger value="publish" className="flex items-center gap-1">
              <Rocket className="h-4 w-4" />
              <span className="hidden sm:inline">Bước 3:</span> Xuất bản
            </TabsTrigger>
          </TabsList>

          <TabsContent value="config">
            <MinigameConfigTab campaign={campaign} />
          </TabsContent>

          <TabsContent value="prizes">
            <MinigamePrizesTab campaign={campaign} prizes={prizes || []} />
          </TabsContent>

          <TabsContent value="publish">
            <MinigamePublishTab campaign={campaign} />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
