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

  useEffect(() => {
    // Show popup after a delay if user is logged in, push is supported, and not yet subscribed
    if (!user || !supported || statusLoading || vapidLoading) return;
    if (isSubscribed) return;

    const timer = setTimeout(() => setOpen(true), 2000);
    return () => clearTimeout(timer);
  }, [user, supported, isSubscribed, statusLoading, vapidLoading]);

  if (!supported || !user || isSubscribed) return null;

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
      // Permission denied or error - close popup, will ask again next session
    }
    setOpen(false);
  };

  const handleLater = () => {
    setOpen(false);
    // Don't persist - will ask again next time they open the app
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
