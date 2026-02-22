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
import { ExternalLink, Bell } from 'lucide-react';
import {
  useStartupNotification,
  useDismissStartupNotification,
} from '@/hooks/useSystemNotifications';

export function StartupNotificationPopup() {
  const { data: notification } = useStartupNotification();
  const dismiss = useDismissStartupNotification();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (notification) {
      // Small delay so it doesn't pop immediately
      const timer = setTimeout(() => {
        // Don't show if onboarding tour is active
        if (document.querySelector('[data-tour-active="true"]')) return;
        setOpen(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  if (!notification) return null;

  const handleClose = () => {
    setOpen(false);
    dismiss.mutate(notification.id);
  };

  const handleAction = () => {
    if (notification.link_url) {
      window.open(notification.link_url, '_blank');
    }
    handleClose();
  };

  return (
    <div data-notification-popup={open ? "true" : "false"}>
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
    </div>
  );
}
