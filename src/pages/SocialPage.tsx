import { useState, lazy, Suspense, useRef, useCallback } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, Home, Bell, Loader2 } from 'lucide-react';
import { useUnreadSocialNotifCount } from '@/hooks/useSocial';
import { PageHeader } from '@/components/layout/PageHeader';
import { useQueryClient } from '@tanstack/react-query';

const SocialProfileTab = lazy(() => import('@/components/social/SocialProfileTab').then(m => ({ default: m.SocialProfileTab })));
const SocialFeedTab = lazy(() => import('@/components/social/SocialFeedTab').then(m => ({ default: m.SocialFeedTab })));
const SocialNotificationsTab = lazy(() => import('@/components/social/SocialNotificationsTab').then(m => ({ default: m.SocialNotificationsTab })));

const TabFallback = () => <div className="text-center py-8 text-muted-foreground">Đang tải...</div>;

const PULL_THRESHOLD = 80;

const SocialPage = () => {
  const [activeTab, setActiveTab] = useState('feed');
  const [viewUserId, setViewUserId] = useState<string | undefined>();
  const { data: unreadCount } = useUnreadSocialNotifCount();
  const queryClient = useQueryClient();
  
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const isPulling = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setPullDistance(0);
    await queryClient.invalidateQueries({ queryKey: ['social-feed'] });
    await queryClient.invalidateQueries({ queryKey: ['social-profile'] });
    await queryClient.invalidateQueries({ queryKey: ['social-notifications'] });
    await queryClient.invalidateQueries({ queryKey: ['social-notif-count'] });
    // Small delay for visual feedback
    await new Promise(r => setTimeout(r, 500));
    setIsRefreshing(false);
  }, [queryClient]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    // Only enable pull-to-refresh when scrolled to top
    const scrollEl = containerRef.current;
    if (scrollEl && scrollEl.scrollTop <= 0) {
      touchStartY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling.current || isRefreshing) return;
    const diff = e.touches[0].clientY - touchStartY.current;
    if (diff > 0) {
      // Dampen the pull distance
      setPullDistance(Math.min(diff * 0.4, PULL_THRESHOLD + 20));
    } else {
      isPulling.current = false;
      setPullDistance(0);
    }
  }, [isRefreshing]);

  const onTouchEnd = useCallback(() => {
    if (!isPulling.current) return;
    isPulling.current = false;
    if (pullDistance >= PULL_THRESHOLD) {
      handleRefresh();
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, handleRefresh]);

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
      <div
        ref={containerRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="relative"
      >
        {/* Pull-to-refresh indicator */}
        <div
          className="flex items-center justify-center overflow-hidden transition-all duration-200"
          style={{ height: isRefreshing ? 48 : pullDistance > 10 ? pullDistance : 0 }}
        >
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} 
              style={{ transform: !isRefreshing ? `rotate(${pullDistance * 3}deg)` : undefined }} />
            <span>{isRefreshing ? 'Đang làm mới...' : pullDistance >= PULL_THRESHOLD ? 'Thả để làm mới' : 'Kéo xuống để làm mới'}</span>
          </div>
        </div>

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
      </div>
    </MainLayout>
  );
};

export default SocialPage;
