import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, Info, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BulkCareZaloDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerIds: string[];
  onSuccess: () => void;
}

const VARIABLES = [
  { key: '{{customer_name}}', label: 'Tên KH' },
  { key: '{{phone}}', label: 'SĐT' },
  { key: '{{store_name}}', label: 'Tên cửa hàng' },
];

export function BulkCareZaloDialog({ open, onOpenChange, customerIds, onSuccess }: BulkCareZaloDialogProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error('Vui lòng nhập nội dung tin nhắn');
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-care-zalo', {
        body: { customerIds, message: message.trim() },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const { sent, failed, skipped } = data;
      let msg = `Đã gửi ${sent} Zalo thành công`;
      if (failed > 0) msg += `, ${failed} thất bại (chưa follow OA)`;
      if (skipped > 0) msg += `, ${skipped} KH không có SĐT`;
      toast.success(msg);

      setMessage('');
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Lỗi gửi Zalo');
    } finally {
      setSending(false);
    }
  };

  const insertVariable = (variable: string) => {
    setMessage(prev => prev + variable);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-blue-500" />
            Gửi Zalo OA hàng loạt
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-start gap-2 p-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
            <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-900 dark:text-blue-200">
              Gửi đến {customerIds.length} KH đã chọn qua Zalo OA. Chỉ gửi được cho KH đã follow OA của shop.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Nội dung tin nhắn</Label>
            <Textarea
              placeholder="Nhập nội dung Zalo..."
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={8}
              className="resize-none"
            />
            <div className="flex flex-wrap gap-1">
              <span className="text-xs text-muted-foreground mr-1">Biến:</span>
              {VARIABLES.map(v => (
                <Badge
                  key={v.key}
                  variant="outline"
                  className="cursor-pointer text-xs hover:bg-primary/10"
                  onClick={() => insertVariable(v.key)}
                >
                  {v.label}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Hủy
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || !message.trim()}
            className="bg-blue-500 hover:bg-blue-600 text-white"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Gửi {customerIds.length} Zalo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
