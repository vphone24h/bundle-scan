import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, Home, Bell } from 'lucide-react';
import { SocialProfileTab } from '@/components/social/SocialProfileTab';
import { SocialFeedTab } from '@/components/social/SocialFeedTab';
import { SocialNotificationsTab } from '@/components/social/SocialNotificationsTab';
import { useUnreadSocialNotifCount } from '@/hooks/useSocial';
import { PageHeader } from '@/components/layout/PageHeader';

const SocialPage = () => {
  const [activeTab, setActiveTab] = useState('feed');
  const [viewUserId, setViewUserId] = useState<string | undefined>();
  const { data: unreadCount } = useUnreadSocialNotifCount();

  const handleViewProfile = (userId: string) => {
    setViewUserId(userId);
    setActiveTab('profile');
  };

  const handleGoToPost = (postId: string) => {
    setActiveTab('feed');
  };

  return (
    <MainLayout>
      <PageHeader title="Mạng xã hội" description="Kết nối cộng đồng VKHO" />
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); if (v === 'profile') setViewUserId(undefined); }}>
        <TabsList className="w-full grid grid-cols-3 mb-4">
          <TabsTrigger value="profile" className="gap-1.5">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Trang cá nhân</span>
            <span className="sm:hidden">Cá nhân</span>
          </TabsTrigger>
          <TabsTrigger value="feed" className="gap-1.5">
            <Home className="h-4 w-4" />
            <span className="hidden sm:inline">Tường nhà</span>
            <span className="sm:hidden">Tường</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5 relative">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Thông báo</span>
            <span className="sm:hidden">TB</span>
            {(unreadCount || 0) > 0 && (
              <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full h-4 min-w-4 flex items-center justify-center px-1">
                {unreadCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <SocialProfileTab userId={viewUserId} onViewProfile={handleViewProfile} />
        </TabsContent>
        <TabsContent value="feed">
          <SocialFeedTab onViewProfile={handleViewProfile} />
        </TabsContent>
        <TabsContent value="notifications">
          <SocialNotificationsTab onViewProfile={handleViewProfile} onGoToPost={handleGoToPost} />
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
};

export default SocialPage;
