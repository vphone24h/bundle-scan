import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Gift, LayoutDashboard, List, History } from 'lucide-react';
import { MinigameDashboard } from '@/components/minigame/MinigameDashboard';
import { MinigameCampaignList } from '@/components/minigame/MinigameCampaignList';
import { MinigameHistory } from '@/components/minigame/MinigameHistory';

export default function MinigamePage() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <MainLayout>
      <PageHeader title="Mini Game - Quay số may mắn" />

      <div className="p-4 sm:p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="flex flex-wrap h-auto gap-1 p-1 w-full">
            <TabsTrigger value="dashboard" className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3">
              <LayoutDashboard className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Tổng quan</span>
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3">
              <List className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Dự án</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3">
              <History className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Lịch sử</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <MinigameDashboard />
          </TabsContent>

          <TabsContent value="campaigns">
            <MinigameCampaignList />
          </TabsContent>

          <TabsContent value="history">
            <MinigameHistory />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
