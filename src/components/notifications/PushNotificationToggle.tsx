import { useState, useEffect } from 'react';
import { Bell, BellRing, BellOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useVapidPublicKey,
  usePushSubscriptionStatus,
  useSubscribePush,
  useUnsubscribePush,
} from '@/hooks/usePushNotifications';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function PushNotificationToggle({ className }: { className?: string }) {
  const { data: vapidKey, isLoading: vapidLoading } = useVapidPublicKey();
  const { data: isSubscribed, isLoading: statusLoading } = usePushSubscriptionStatus();
  const subscribePush = useSubscribePush();
  const unsubscribePush = useUnsubscribePush();
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setSupported(false);
    }
  }, []);

  if (!supported) return null;

  const isLoading = vapidLoading || statusLoading || subscribePush.isPending || unsubscribePush.isPending;

  const handleToggle = async () => {
    if (isSubscribed) {
      unsubscribePush.mutate();
    } else {
      if (!vapidKey) {
        toast.error('Chưa có cấu hình thông báo đẩy. Vui lòng liên hệ quản trị viên.');
      } else {
        subscribePush.mutate(vapidKey);
      }
    }
  };

  return (
    <Button
      variant={isSubscribed ? 'default' : 'outline'}
      size="sm"
      className={cn('gap-2', className)}
      onClick={handleToggle}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isSubscribed ? (
        <BellRing className="h-4 w-4" />
      ) : (
        <BellOff className="h-4 w-4" />
      )}
      {isSubscribed ? 'Đang bật thông báo' : 'Bật thông báo đẩy'}
    </Button>
  );
}
