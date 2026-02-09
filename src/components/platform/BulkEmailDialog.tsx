import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Mail, Send, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface TenantEmail {
  name: string;
  email: string;
}

interface BulkEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenants: TenantEmail[];
}

export function BulkEmailDialog({ open, onOpenChange, tenants }: BulkEmailDialogProps) {
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);

  const validEmails = tenants.filter(t => t.email);
  const invalidCount = tenants.length - validEmails.length;

  const handleSend = async () => {
    if (!subject.trim()) {
      toast({ title: 'Lỗi', description: 'Vui lòng nhập tiêu đề email', variant: 'destructive' });
      return;
    }
    if (!content.trim()) {
      toast({ title: 'Lỗi', description: 'Vui lòng nhập nội dung email', variant: 'destructive' });
      return;
    }
    if (validEmails.length === 0) {
      toast({ title: 'Lỗi', description: 'Không có email hợp lệ để gửi', variant: 'destructive' });
      return;
    }

    setIsSending(true);
    try {
      // Convert plain text content to HTML paragraphs
      const htmlContent = content
        .split('\n')
        .map(line => line.trim() ? `<p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 12px">${line}</p>` : '<br/>')
        .join('');

      const { data, error } = await supabase.functions.invoke('send-bulk-email', {
        body: {
          emails: validEmails.map(t => t.email),
          subject: subject.trim(),
          htmlContent,
        },
      });

      if (error) throw error;

      toast({
        title: 'Gửi email thành công',
        description: `Đã gửi ${data.sent}/${validEmails.length} email${data.failed > 0 ? `. ${data.failed} thất bại` : ''}`,
      });

      setSubject('');
      setContent('');
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Lỗi gửi email',
        description: error.message || 'Không thể gửi email',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleRemoveTenant = (email: string) => {
    // This is visual only - parent manages the selection
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Gửi email hàng loạt
          </DialogTitle>
          <DialogDescription>
            Gửi email đến {validEmails.length} doanh nghiệp đã chọn
            {invalidCount > 0 && (
              <span className="text-destructive"> ({invalidCount} DN không có email)</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Recipients preview */}
          <div className="space-y-2">
            <Label>Người nhận ({validEmails.length})</Label>
            <div className="flex flex-wrap gap-1.5 p-2 bg-muted/50 rounded-lg max-h-24 overflow-y-auto">
              {validEmails.map((t) => (
                <Badge key={t.email} variant="secondary" className="text-xs">
                  {t.name}
                  <span className="text-muted-foreground ml-1">({t.email})</span>
                </Badge>
              ))}
              {invalidCount > 0 && (
                <Badge variant="outline" className="text-xs text-destructive">
                  {invalidCount} DN thiếu email
                </Badge>
              )}
            </div>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="email-subject">Tiêu đề *</Label>
            <Input
              id="email-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="VD: Thông báo cập nhật tính năng mới"
            />
          </div>

          {/* Content */}
          <div className="space-y-2">
            <Label htmlFor="email-content">Nội dung *</Label>
            <Textarea
              id="email-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Nhập nội dung email..."
              rows={8}
              className="min-h-[160px]"
            />
            <p className="text-xs text-muted-foreground">
              Nội dung sẽ được gửi dưới dạng email có thương hiệu VKHO
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            Hủy
          </Button>
          <Button onClick={handleSend} disabled={isSending || validEmails.length === 0}>
            {isSending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Gửi {validEmails.length} email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
