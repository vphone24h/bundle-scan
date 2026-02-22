import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BellRing } from 'lucide-react';
import {
  useVapidPublicKey,
  usePushSubscriptionStatus,
  useSubscribePush,
  useGenerateVapidKeys,
} from '@/hooks/usePushNotifications';
import { useAuth } from '@/hooks/useAuth';

const PUSH_ENABLED_KEY = 'push_notification_enabled';

export function PushPermissionPopup() {
  const { user } = useAuth();
  const { data: vapidKey, isLoading: vapidLoading } = useVapidPublicKey();
  const { data: isSubscribed, isLoading: statusLoading } = usePushSubscriptionStatus();
  const subscribePush = useSubscribePush();
  const generateKeys = useGenerateVapidKeys();
  const [open, setOpen] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setSupported(false);
    }
  }, []);

  const alreadyEnabled =
    localStorage.getItem(PUSH_ENABLED_KEY) === 'true' ||
    (supported && 'Notification' in window && Notification.permission === 'granted');

  useEffect(() => {
    if (!user || !supported || statusLoading || vapidLoading) return;
    if (isSubscribed || alreadyEnabled) return;

    const timer = setTimeout(() => setOpen(true), 2000);
    return () => clearTimeout(timer);
  }, [user, supported, isSubscribed, statusLoading, vapidLoading, alreadyEnabled]);

  // Sync: if DB says subscribed, persist flag
  useEffect(() => {
    if (isSubscribed) {
      localStorage.setItem(PUSH_ENABLED_KEY, 'true');
    }
  }, [isSubscribed]);

  if (!supported || !user || isSubscribed || alreadyEnabled) return null;

  const isLoading = subscribePush.isPending || generateKeys.isPending;

  const handleEnable = async () => {
    try {
      if (!vapidKey) {
        const result = await generateKeys.mutateAsync();
        if (result?.public_key) {
          await subscribePush.mutateAsync(result.public_key);
        }
      } else {
        await subscribePush.mutateAsync(vapidKey);
      }
    } catch {
      // Ignore errors
    }
    // Always mark as handled so we never ask again
    localStorage.setItem(PUSH_ENABLED_KEY, 'true');
    setOpen(false);
  };

  const handleLater = () => {
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleLater}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-primary/10">
              <BellRing className="h-6 w-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base">Bật thông báo đẩy</DialogTitle>
              <DialogDescription className="pt-1">
                Nhận thông báo quan trọng ngay trên điện thoại, không bỏ lỡ đơn hàng hay cập nhật nào!
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogFooter className="flex-row gap-2 sm:justify-end">
          <Button variant="ghost" size="sm" onClick={handleLater} disabled={isLoading}>
            Để sau
          </Button>
          <Button size="sm" onClick={handleEnable} disabled={isLoading}>
            <BellRing className="h-4 w-4 mr-1" />
            {isLoading ? 'Đang bật...' : 'Bật ngay'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
