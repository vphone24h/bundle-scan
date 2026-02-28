import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ExternalLink, Bell } from 'lucide-react';
import {
  useStartupNotification,
  useDismissStartupNotification,
} from '@/hooks/useSystemNotifications';
import { usePopupPriority } from '@/hooks/usePopupPriority';

export function StartupNotificationPopup() {
  const { data: notification } = useStartupNotification();
  const dismiss = useDismissStartupNotification();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { activeLayer, claim, release } = usePopupPriority();

  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (notification) {
      const dismissKey = `startup_popup_dismissed_${notification.id}`;
      const lastDismissed = localStorage.getItem(dismissKey);
      if (lastDismissed) {
        const dismissedDate = new Date(lastDismissed);
        const today = new Date();
        if (
          dismissedDate.getFullYear() === today.getFullYear() &&
          dismissedDate.getMonth() === today.getMonth() &&
          dismissedDate.getDate() === today.getDate()
        ) {
          return;
        }
      }
      const timer = setTimeout(() => setReady(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Try to claim when ready and no higher-priority popup is active
  useEffect(() => {
    if (ready && !open && (activeLayer === 'none' || activeLayer === 'notification')) {
      const granted = claim('notification');
      if (granted) setOpen(true);
    }
  }, [ready, open, activeLayer, claim]);

  if (!notification) return null;

  const handleClose = () => {
    setOpen(false);
    setReady(false);
    release('notification');
    const dismissKey = `startup_popup_dismissed_${notification.id}`;
    localStorage.setItem(dismissKey, new Date().toISOString());
    dismiss.mutate(notification.id);
  };

  const handleAction = () => {
    if (notification.link_url) {
      if (notification.link_url.startsWith('/')) {
        navigate(notification.link_url);
      } else {
        window.open(notification.link_url, '_blank');
      }
    }
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-primary/10">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle className="text-base">{notification.title}</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            {notification.message}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-row gap-2 sm:justify-end">
          <Button variant="ghost" size="sm" onClick={handleClose}>
            Đóng
          </Button>
          {notification.link_url && (
            <Button size="sm" onClick={handleAction}>
              <ExternalLink className="h-4 w-4 mr-1" />
              Xem ngay
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
