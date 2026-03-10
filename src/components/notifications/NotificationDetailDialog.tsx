import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { type SystemNotification } from '@/hooks/useSystemNotifications';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import DOMPurify from 'dompurify';

interface NotificationDetailDialogProps {
  notification: SystemNotification;
  open: boolean;
  onClose: () => void;
}

export function NotificationDetailDialog({ notification, open, onClose }: NotificationDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{notification.title}</DialogTitle>
          <DialogDescription>
            {format(new Date(notification.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div
            className="prose prose-sm dark:prose-invert max-w-none text-foreground"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(notification.message) }}
          />

          {notification.full_content && (
            <div
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(notification.full_content) }}
            />
          )}

          {notification.link_url && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.open(notification.link_url!, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Xem chi tiết
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
