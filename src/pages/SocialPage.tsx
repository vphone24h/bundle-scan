import { useState, lazy, Suspense } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, Home, Bell } from 'lucide-react';
import { useUnreadSocialNotifCount } from '@/hooks/useSocial';
import { PageHeader } from '@/components/layout/PageHeader';

const SocialProfileTab = lazy(() => import('@/components/social/SocialProfileTab').then(m => ({ default: m.SocialProfileTab })));
const SocialFeedTab = lazy(() => import('@/components/social/SocialFeedTab').then(m => ({ default: m.SocialFeedTab })));
const SocialNotificationsTab = lazy(() => import('@/components/social/SocialNotificationsTab').then(m => ({ default: m.SocialNotificationsTab })));

const TabFallback = () => <div className="text-center py-8 text-muted-foreground">Đang tải...</div>;

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

        <TabsContent value="profile" forceMount={activeTab === 'profile' ? undefined : true} className={activeTab !== 'profile' ? 'hidden' : ''}>
          <Suspense fallback={<TabFallback />}>
            <SocialProfileTab userId={viewUserId} onViewProfile={handleViewProfile} />
          </Suspense>
        </TabsContent>
        <TabsContent value="feed" forceMount={activeTab === 'feed' ? undefined : true} className={activeTab !== 'feed' ? 'hidden' : ''}>
          <Suspense fallback={<TabFallback />}>
            <SocialFeedTab onViewProfile={handleViewProfile} />
          </Suspense>
        </TabsContent>
        <TabsContent value="notifications" forceMount={activeTab === 'notifications' ? undefined : true} className={activeTab !== 'notifications' ? 'hidden' : ''}>
          <Suspense fallback={<TabFallback />}>
            <SocialNotificationsTab onViewProfile={handleViewProfile} onGoToPost={handleGoToPost} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
};

export default SocialPage;
