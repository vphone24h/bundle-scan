import { useEffect, memo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useSocialNotifications, useMarkNotificationsRead, SocialNotification } from '@/hooks/useSocial';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Heart, MessageCircle, UserPlus, FileText, Reply } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  onViewProfile: (userId: string) => void;
  onGoToPost: (postId: string) => void;
}

const getNotifIcon = (type: string) => {
  switch (type) {
    case 'like': return <Heart className="h-4 w-4 text-red-500 fill-red-500" />;
    case 'comment': return <MessageCircle className="h-4 w-4 text-blue-500" />;
    case 'reply': return <Reply className="h-4 w-4 text-blue-500" />;
    case 'follow': return <UserPlus className="h-4 w-4 text-green-500" />;
    case 'new_post': return <FileText className="h-4 w-4 text-primary" />;
    default: return <Heart className="h-4 w-4" />;
  }
};

const getNotifText = (notif: SocialNotification) => {
  switch (notif.type) {
    case 'like': return 'đã thích bài viết của bạn';
    case 'comment': return 'đã bình luận bài viết của bạn';
    case 'reply': return 'đã trả lời bình luận của bạn';
    case 'follow': return 'đã theo dõi bạn';
    case 'new_post': return 'đã đăng bài viết mới';
    default: return 'đã tương tác';
  }
};

export const SocialNotificationsTab = memo(function SocialNotificationsTab({ onViewProfile, onGoToPost }: Props) {
  const { data: notifications, isLoading } = useSocialNotifications();
  const markRead = useMarkNotificationsRead();

  useEffect(() => {
    markRead.mutate();
  }, []);

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Đang tải...</div>;

  if (!notifications?.length) {
    return <div className="text-center py-8 text-muted-foreground">Chưa có thông báo nào</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-2">
      {notifications.map(notif => (
        <Card
          key={notif.id}
          className={cn('cursor-pointer hover:bg-accent/50 transition-colors', !notif.is_read && 'bg-primary/5 border-primary/20')}
          onClick={() => {
            if (notif.post_id) onGoToPost(notif.post_id);
            else onViewProfile(notif.actor_id);
          }}
        >
          <CardContent className="py-3 flex items-center gap-3">
            <button onClick={(e) => { e.stopPropagation(); onViewProfile(notif.actor_id); }}>
              <Avatar className="h-10 w-10">
                <AvatarImage src={notif.actor_avatar || undefined} />
                <AvatarFallback>{(notif.actor_name || 'U')[0]}</AvatarFallback>
              </Avatar>
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm">
                <span className="font-semibold">{notif.actor_name}</span>{' '}
                {getNotifText(notif)}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: vi })}
              </p>
            </div>
            <div className="shrink-0">{getNotifIcon(notif.type)}</div>
            {!notif.is_read && <div className="h-2.5 w-2.5 rounded-full bg-primary shrink-0" />}
          </CardContent>
        </Card>
      ))}
    </div>
  );
});
