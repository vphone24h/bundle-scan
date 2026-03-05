import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BulkCareEmailDialogProps {
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

export function BulkCareEmailDialog({ open, onOpenChange, customerIds, onSuccess }: BulkCareEmailDialogProps) {
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!subject.trim() || !content.trim()) {
      toast.error('Vui lòng nhập tiêu đề và nội dung');
      return;
    }

    setSending(true);
    try {
      // Convert newlines to HTML
      const htmlContent = content
        .split('\n')
        .map(line => line.trim() ? `<p style="margin:8px 0;font-size:15px;line-height:1.7;color:#374151">${line}</p>` : '<br/>')
        .join('\n');

      const { data, error } = await supabase.functions.invoke('send-care-email', {
        body: {
          customerIds,
          subject: subject.trim(),
          htmlContent,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const { sent, failed, skipped } = data;
      let msg = `Đã gửi ${sent} email thành công`;
      if (failed > 0) msg += `, ${failed} thất bại`;
      if (skipped > 0) msg += `, ${skipped} KH không có email`;
      toast.success(msg);
      
      setSubject('');
      setContent('');
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Lỗi gửi email');
    } finally {
      setSending(false);
    }
  };

  const insertVariable = (variable: string) => {
    setContent(prev => prev + variable);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Gửi email chăm sóc
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
            <Info className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground">
              Gửi đến {customerIds.length} khách hàng đã chọn. Email sử dụng SMTP đã cấu hình trong Cấu hình Website.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Tiêu đề email</Label>
            <Input
              placeholder="VD: Chào {{customer_name}}, ưu đãi đặc biệt dành cho bạn!"
              value={subject}
              onChange={e => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Nội dung email</Label>
            <Textarea
              placeholder="Nhập nội dung email..."
              value={content}
              onChange={e => setContent(e.target.value)}
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
          <Button onClick={handleSend} disabled={sending || !subject.trim() || !content.trim()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Gửi {customerIds.length} email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
