import { useState } from 'react';
import { Bell, CheckCheck, Pin, ExternalLink, Info, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useSystemNotifications,
  useUnreadSystemNotificationCount,
  useMarkSystemNotificationRead,
  useMarkAllSystemNotificationsRead,
  type SystemNotification,
} from '@/hooks/useSystemNotifications';
import { NotificationDetailDialog } from './NotificationDetailDialog';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export function SystemNotificationBell() {
  const [open, setOpen] = useState(false);
  const { data: notifications = [] } = useSystemNotifications();
  const unreadCount = useUnreadSystemNotificationCount();
  const markRead = useMarkSystemNotificationRead();
  const markAllRead = useMarkAllSystemNotificationsRead();
  const [selectedNotification, setSelectedNotification] = useState<SystemNotification | null>(null);

  const pinnedNotifications = notifications.filter(n => n.is_pinned);
  const otherNotifications = notifications.filter(n => !n.is_pinned);

  const handleClick = (notification: SystemNotification) => {
    if (!notification.is_read) {
      markRead.mutate(notification.id);
    }

    if (notification.notification_type === 'article' && notification.link_url) {
      window.open(notification.link_url, '_blank');
    } else {
      setSelectedNotification(notification);
      setOpen(false);
    }
  };

  const renderNotification = (notification: SystemNotification) => (
    <div
      key={notification.id}
      className={cn(
        'p-3 hover:bg-muted/50 cursor-pointer transition-colors',
        !notification.is_read && 'bg-primary/5'
      )}
      onClick={() => handleClick(notification)}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          'mt-0.5 p-1.5 rounded-full shrink-0',
          notification.is_pinned
            ? 'bg-accent text-accent-foreground'
            : 'bg-muted text-muted-foreground'
        )}>
          {notification.is_pinned ? <Pin className="h-4 w-4" /> : <Info className="h-4 w-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className={cn(
              'text-sm truncate',
              !notification.is_read && 'font-medium'
            )}>
              {notification.title}
            </p>
            <div className="flex items-center gap-1 shrink-0">
              {notification.link_url && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
              {!notification.is_read && (
                <div className="h-2 w-2 rounded-full bg-primary" />
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
            {notification.message}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            {formatDistanceToNow(new Date(notification.created_at), {
              addSuffix: true,
              locale: vi,
            })}
          </p>
        </div>
      </div>
    </div>
  );

  const EmptyState = () => (
    <div className="p-8 text-center text-muted-foreground">
      <Megaphone className="h-8 w-8 mx-auto mb-2 opacity-50" />
      <p className="text-sm">Chưa có thông báo</p>
    </div>
  );

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 px-1 text-xs"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 sm:w-96 p-0" align="end">
          <div className="flex items-center justify-between p-3 border-b">
            <h4 className="font-semibold text-sm">Thông báo hệ thống</h4>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
                Đọc tất cả
              </Button>
            )}
          </div>

          <Tabs defaultValue="pinned" className="w-full">
            <TabsList className="w-full rounded-none border-b h-9">
              <TabsTrigger value="pinned" className="flex-1 text-xs">
                <Pin className="h-3 w-3 mr-1" />
                Quan trọng {pinnedNotifications.length > 0 && `(${pinnedNotifications.length})`}
              </TabsTrigger>
              <TabsTrigger value="other" className="flex-1 text-xs">
                Thông báo khác {otherNotifications.length > 0 && `(${otherNotifications.length})`}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pinned" className="mt-0">
              <ScrollArea className="h-[300px]">
                {pinnedNotifications.length === 0 ? (
                  <EmptyState />
                ) : (
                  <div className="divide-y">
                    {pinnedNotifications.map(renderNotification)}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="other" className="mt-0">
              <ScrollArea className="h-[300px]">
                {otherNotifications.length === 0 ? (
                  <EmptyState />
                ) : (
                  <div className="divide-y">
                    {otherNotifications.map(renderNotification)}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </PopoverContent>
      </Popover>

      {selectedNotification && (
        <NotificationDetailDialog
          notification={selectedNotification}
          open={!!selectedNotification}
          onClose={() => setSelectedNotification(null)}
        />
      )}
    </>
  );
}
