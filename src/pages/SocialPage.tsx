import { useState, lazy, Suspense, useRef, useCallback } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { MessageCircle, Users, Home, User, Bell, Loader2, Search, X } from 'lucide-react';
import { useUnreadSocialNotifCount, useSearchUsers } from '@/hooks/useSocial';
import { useUnreadChatCount } from '@/hooks/useChat';
import { usePendingFriendCount } from '@/hooks/useFriends';
import { PageHeader } from '@/components/layout/PageHeader';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Conversation, useStartConversation } from '@/hooks/useChat';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

const SocialProfileTab = lazy(() => import('@/components/social/SocialProfileTab').then(m => ({ default: m.SocialProfileTab })));
const SocialFeedTab = lazy(() => import('@/components/social/SocialFeedTab').then(m => ({ default: m.SocialFeedTab })));
const SocialNotificationsTab = lazy(() => import('@/components/social/SocialNotificationsTab').then(m => ({ default: m.SocialNotificationsTab })));
const ChatListTab = lazy(() => import('@/components/social/ChatListTab').then(m => ({ default: m.ChatListTab })));
const ChatScreen = lazy(() => import('@/components/social/ChatScreen').then(m => ({ default: m.ChatScreen })));
const ContactsTab = lazy(() => import('@/components/social/ContactsTab').then(m => ({ default: m.ContactsTab })));

const TabFallback = () => <div className="text-center py-8 text-muted-foreground">Đang tải...</div>;

const PULL_THRESHOLD = 80;

const SocialPage = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('feed');
  const [viewUserId, setViewUserId] = useState<string | undefined>();
  const [focusPostId, setFocusPostId] = useState<string | null>(null);
  const [focusCommentId, setFocusCommentId] = useState<string | null>(null);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const { data: unreadNotifCount } = useUnreadSocialNotifCount();
  const { data: unreadChatCount } = useUnreadChatCount();
  const { data: pendingFriendCount } = usePendingFriendCount();
  const queryClient = useQueryClient();
  const startConversation = useStartConversation();
  const [showSearchOverlay, setShowSearchOverlay] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { data: searchResults } = useSearchUsers(searchQuery);

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
    await queryClient.invalidateQueries({ queryKey: ['conversations'] });
    await new Promise(r => setTimeout(r, 500));
    setIsRefreshing(false);
  }, [queryClient]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
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
    setShowSearchOverlay(false);
    setSearchQuery('');
  };

  const handleGoToPost = (postId: string, commentId?: string) => {
    setFocusPostId(postId);
    setFocusCommentId(commentId || null);
    setActiveTab('feed');
  };

  const handleStartChat = async (userId: string) => {
    try {
      const convId = await startConversation.mutateAsync(userId);
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
      // Create a minimal conversation object to navigate
      setActiveConversation({
        id: convId,
        type: 'direct',
        name: null,
        avatar_url: null,
        updated_at: new Date().toISOString(),
        other_user_id: userId,
        other_user_name: 'Đang tải...',
      });
      setActiveTab('messages');
    } catch {
      // ignore
    }
  };

  const handleSelectConversation = (conv: Conversation) => {
    setActiveConversation(conv);
  };

  // If we're in a chat screen, render only that
  if (activeTab === 'messages' && activeConversation) {
    return (
      <MainLayout>
        <div className="-mx-4 -mt-2 sm:mx-0 sm:mt-0">
          <Suspense fallback={<TabFallback />}>
            <ChatScreen
              conversation={activeConversation}
              onBack={() => setActiveConversation(null)}
            />
          </Suspense>
        </div>
      </MainLayout>
    );
  }

  const tabTitles: Record<string, { title: string; description: string }> = {
    messages: { title: 'Tin nhắn', description: 'Trò chuyện với bạn bè' },
    contacts: { title: 'Danh bạ', description: 'Bạn bè & kết bạn' },
    feed: { title: 'Mạng xã hội', description: 'Kết nối cộng đồng VKHO' },
    profile: { title: 'Cá nhân', description: 'Trang cá nhân' },
    notifications: { title: 'Thông báo', description: '' },
  };

  const currentTitle = tabTitles[activeTab] || tabTitles.feed;

  return (
    <MainLayout>
      {/* Sticky header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b pb-2 -mx-4 px-4 pt-2 sm:static sm:border-0 sm:pb-0 sm:mx-0 sm:px-0 sm:pt-0 sm:bg-transparent sm:backdrop-blur-none">
        <div className="flex items-center justify-between">
          <PageHeader title={currentTitle.title} description={currentTitle.description} />
          {activeTab === 'feed' && (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-9 w-9 relative"
                onClick={() => { setActiveTab('notifications'); }}>
                <Bell className="h-5 w-5" />
                {(unreadNotifCount || 0) > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full h-4 min-w-4 flex items-center justify-center px-1">
                    {unreadNotifCount}
                  </span>
                )}
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0"
                onClick={() => setShowSearchOverlay(!showSearchOverlay)}>
                <Search className="h-5 w-5" />
              </Button>
            </div>
          )}
          {activeTab === 'notifications' && (
            <Button variant="ghost" size="sm" onClick={() => setActiveTab('feed')}>
              <X className="h-4 w-4 mr-1" /> Đóng
            </Button>
          )}
        </div>

        {/* Search overlay */}
        {showSearchOverlay && (
          <div className="mt-2 relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                autoFocus
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Tìm người dùng theo tên hoặc SĐT..."
                className="pl-9 pr-9 h-9"
              />
              <button
                onClick={() => { setSearchQuery(''); setShowSearchOverlay(false); }}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            {searchQuery.trim().length >= 2 && (
              <Card className="absolute z-50 w-full mt-1 shadow-lg max-h-64 overflow-auto">
                <CardContent className="p-2">
                  {!searchResults?.length ? (
                    <p className="text-sm text-muted-foreground text-center py-3">Không tìm thấy</p>
                  ) : (
                    searchResults.map(u => (
                      <button
                        key={u.user_id}
                        className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-accent transition-colors text-left"
                        onClick={() => handleViewProfile(u.user_id)}
                      >
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={u.avatar_url || undefined} />
                          <AvatarFallback className="text-sm">{(u.display_name || 'U')[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{u.display_name || 'Người dùng'}</p>
                          {u.phone && <p className="text-xs text-muted-foreground">{u.phone}</p>}
                        </div>
                      </button>
                    ))
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

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

        <Tabs value={activeTab} onValueChange={(v) => {
          setActiveTab(v);
          if (v === 'profile') setViewUserId(undefined);
          setActiveConversation(null);
        }}>
          <div className="pb-16 sm:pb-0">
            {/* Desktop tabs at top */}
            <TabsList className="w-full grid-cols-4 mb-4 hidden sm:grid">
              <TabsTrigger value="messages" className="gap-1.5 relative">
                <MessageCircle className="h-4 w-4" />
                <span>Tin nhắn</span>
                {(unreadChatCount || 0) > 0 && (
                  <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full h-4 min-w-4 flex items-center justify-center px-1">
                    {unreadChatCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="contacts" className="gap-1.5 relative">
                <Users className="h-4 w-4" />
                <span>Danh bạ</span>
                {(pendingFriendCount || 0) > 0 && (
                  <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full h-4 min-w-4 flex items-center justify-center px-1">
                    {pendingFriendCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="feed" className="gap-1.5">
                <Home className="h-4 w-4" />
                <span>Tường</span>
              </TabsTrigger>
              <TabsTrigger value="profile" className="gap-1.5">
                <User className="h-4 w-4" />
                <span>Cá nhân</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="messages" forceMount={activeTab === 'messages' ? undefined : true} className={activeTab !== 'messages' ? 'hidden' : ''}>
              <Suspense fallback={<TabFallback />}>
                <ChatListTab
                  onSelectConversation={handleSelectConversation}
                  onStartChat={handleStartChat}
                />
              </Suspense>
            </TabsContent>

            <TabsContent value="contacts" forceMount={activeTab === 'contacts' ? undefined : true} className={activeTab !== 'contacts' ? 'hidden' : ''}>
              <Suspense fallback={<TabFallback />}>
                <ContactsTab
                  onViewProfile={handleViewProfile}
                  onStartChat={handleStartChat}
                />
              </Suspense>
            </TabsContent>

            <TabsContent value="feed" forceMount={activeTab === 'feed' ? undefined : true} className={activeTab !== 'feed' ? 'hidden' : ''}>
              <Suspense fallback={<TabFallback />}>
                <SocialFeedTab onViewProfile={handleViewProfile} focusPostId={focusPostId} focusCommentId={focusCommentId} onFocusHandled={() => { setFocusPostId(null); setFocusCommentId(null); }} />
              </Suspense>
            </TabsContent>

            <TabsContent value="profile" forceMount={activeTab === 'profile' ? undefined : true} className={activeTab !== 'profile' ? 'hidden' : ''}>
              <Suspense fallback={<TabFallback />}>
                <SocialProfileTab userId={viewUserId} onViewProfile={handleViewProfile} onBack={() => { setViewUserId(undefined); setActiveTab('feed'); }} />
              </Suspense>
            </TabsContent>

            <TabsContent value="notifications" forceMount={activeTab === 'notifications' ? undefined : true} className={activeTab !== 'notifications' ? 'hidden' : ''}>
              <Suspense fallback={<TabFallback />}>
                <SocialNotificationsTab onViewProfile={handleViewProfile} onGoToPost={handleGoToPost} />
              </Suspense>
            </TabsContent>
          </div>

          {/* Mobile bottom tab bar - Zalo style */}
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t sm:hidden safe-area-bottom">
            <TabsList className="w-full grid grid-cols-4 h-14 rounded-none border-0 bg-background">
              <TabsTrigger value="messages" className="flex-col gap-0.5 h-full data-[state=active]:bg-transparent data-[state=active]:text-primary rounded-none relative">
                <MessageCircle className="h-5 w-5" />
                <span className="text-[10px]">Tin nhắn</span>
                {(unreadChatCount || 0) > 0 && (
                  <span className="absolute top-1 left-1/2 ml-2 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full h-4 min-w-4 flex items-center justify-center px-1">
                    {unreadChatCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="contacts" className="flex-col gap-0.5 h-full data-[state=active]:bg-transparent data-[state=active]:text-primary rounded-none relative">
                <Users className="h-5 w-5" />
                <span className="text-[10px]">Danh bạ</span>
                {(pendingFriendCount || 0) > 0 && (
                  <span className="absolute top-1 left-1/2 ml-2 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full h-4 min-w-4 flex items-center justify-center px-1">
                    {pendingFriendCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="feed" className="flex-col gap-0.5 h-full data-[state=active]:bg-transparent data-[state=active]:text-primary rounded-none">
                <Home className="h-5 w-5" />
                <span className="text-[10px]">Tường</span>
              </TabsTrigger>
              <TabsTrigger value="profile" className="flex-col gap-0.5 h-full data-[state=active]:bg-transparent data-[state=active]:text-primary rounded-none">
                <User className="h-5 w-5" />
                <span className="text-[10px]">Cá nhân</span>
              </TabsTrigger>
            </TabsList>
          </div>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default SocialPage;
