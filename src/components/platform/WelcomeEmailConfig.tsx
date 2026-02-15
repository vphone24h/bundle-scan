import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2, Save, Mail, Eye, Send, Link2, FileText
} from 'lucide-react';
import { usePublishedPlatformArticles } from '@/hooks/usePlatformArticles';

// Default welcome email body (HTML)
const DEFAULT_WELCOME_BODY = `<p>Xin chào <strong>{{admin_name}}</strong>,</p>
<p>Chào mừng bạn đã đến với <strong>VKHO</strong> – nền tảng quản lý kho chi tiết, đầy đủ và an toàn nhất!</p>
<div style="background:#eff6ff;border-left:4px solid #1a56db;padding:16px 20px;border-radius:0 8px 8px 0;margin:16px 0">
<p style="margin:0 0 12px;font-weight:bold;color:#1e40af">✨ Tính năng nổi bật:</p>
<ul style="margin:0;padding:0 0 0 20px;line-height:2">
<li><strong>Xuất – Nhập – Tồn</strong> chi tiết đến từng sản phẩm</li>
<li>Giúp bạn dễ dàng <strong>quản lý sản phẩm</strong> và tư vấn khách hàng, gia tăng tỉ lệ chốt đơn</li>
<li>Tích hợp <strong>báo cáo thuế</strong> cho người mới chưa rành – Nhấp là ra chi tiết</li>
<li>Tích hợp <strong>website bán hàng</strong> và <strong>tra cứu bảo hành</strong> miễn phí</li>
</ul>
</div>
<p>ID cửa hàng của bạn: <strong>{{subdomain}}</strong></p>
<p>Mọi thắc mắc vui lòng liên hệ: <strong>📞 0396-793-883 (Zalo)</strong></p>`;

const DEFAULT_WELCOME_SUBJECT = '🎉 Chào mừng bạn đến với VKHO – Hệ thống quản lý kho thông minh!';

interface PaymentConfig {
  id: string;
  config_key: string;
  config_value: string | null;
}

export function WelcomeEmailConfig() {
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(true);
  const [subject, setSubject] = useState(DEFAULT_WELCOME_SUBJECT);
  const [body, setBody] = useState(DEFAULT_WELCOME_BODY);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sendGuideOpen, setSendGuideOpen] = useState(false);
  const [guideEmail, setGuideEmail] = useState('');
  const [selectedArticleId, setSelectedArticleId] = useState('');
  const [sendingGuide, setSendingGuide] = useState(false);

  const { data: articles } = usePublishedPlatformArticles();

  const { data: configs, isLoading } = useQuery({
    queryKey: ['payment-config'],
    queryFn: async () => {
      const { data, error } = await supabase.from('payment_config').select('*');
      if (error) throw error;
      return data as PaymentConfig[];
    },
  });

  useEffect(() => {
    if (configs) {
      const e = configs.find(c => c.config_key === 'welcome_email_enabled');
      const s = configs.find(c => c.config_key === 'welcome_email_subject');
      const b = configs.find(c => c.config_key === 'welcome_email_body');
      if (e?.config_value !== undefined && e?.config_value !== null) setEnabled(e.config_value === 'true');
      if (s?.config_value) setSubject(s.config_value);
      if (b?.config_value) setBody(b.config_value);
    }
  }, [configs]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = [
        { config_key: 'welcome_email_enabled', config_value: String(enabled) },
        { config_key: 'welcome_email_subject', config_value: subject },
        { config_key: 'welcome_email_body', config_value: body },
      ];
      for (const u of updates) {
        const { error } = await supabase.from('payment_config').upsert(u, { onConflict: 'config_key' });
        if (error) throw error;
      }
      toast({ title: 'Thành công', description: 'Đã lưu mẫu email chào mừng' });
      queryClient.invalidateQueries({ queryKey: ['payment-config'] });
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const getPreviewHtml = useCallback(() => {
    const wrappedBody = body
      .replace(/\{\{admin_name\}\}/g, 'Nguyễn Văn A')
      .replace(/\{\{subdomain\}\}/g, 'demo-store')
      .replace(/\{\{business_name\}\}/g, 'Cửa Hàng Demo');

    return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;border-radius:12px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#1a56db,#2563eb);color:#fff;padding:32px 24px;text-align:center">
        <h1 style="margin:0 0 8px;font-size:24px;font-weight:bold">🎉 Chào mừng đến với VKHO!</h1>
        <p style="margin:0;font-size:14px;opacity:0.9">Hệ thống quản lý kho thông minh</p>
      </div>
      <div style="background:#fff;padding:32px 24px">${wrappedBody}</div>
      <div style="background:#f3f4f6;padding:16px 24px;text-align:center">
        <p style="margin:0;font-size:12px;color:#9ca3af">© 2026 VKHO – Hệ thống quản lý kho hàng thông minh</p>
      </div>
    </div>`;
  }, [body]);

  const handleSendGuide = async () => {
    if (!guideEmail || !selectedArticleId) {
      toast({ title: 'Thiếu thông tin', description: 'Vui lòng nhập email và chọn bài viết', variant: 'destructive' });
      return;
    }
    const article = articles?.find(a => a.id === selectedArticleId);
    if (!article) return;

    setSendingGuide(true);
    try {
      const { error } = await supabase.functions.invoke('send-guide-email', {
        body: {
          toEmail: guideEmail,
          articleTitle: article.title,
          articleSummary: article.summary || '',
          articleUrl: `${window.location.origin}/guides`,
        },
      });
      if (error) throw error;
      toast({ title: 'Thành công', description: `Đã gửi hướng dẫn đến ${guideEmail}` });
      setSendGuideOpen(false);
      setGuideEmail('');
      setSelectedArticleId('');
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message, variant: 'destructive' });
    }
    setSendingGuide(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Email Template */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email chào mừng tự động
              </CardTitle>
              <CardDescription>
                Tự động gửi khi khách hàng đăng ký tài khoản mới. Biến: {'{{admin_name}}'}, {'{{subdomain}}'}, {'{{business_name}}'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="welcome-enabled" className="text-sm">Bật/Tắt</Label>
              <Switch
                id="welcome-enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
              />
              {enabled ? (
                <Badge variant="default" className="text-xs">Đang bật</Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">Đã tắt</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Tiêu đề email</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Tiêu đề email chào mừng..."
            />
          </div>

          <div className="space-y-2">
            <Label>Nội dung email</Label>
            <RichTextEditor
              value={body}
              onChange={setBody}
              placeholder="Soạn nội dung email chào mừng..."
              minHeight="300px"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              Lưu mẫu email
            </Button>
            <Button variant="outline" onClick={() => setPreviewOpen(true)}>
              <Eye className="mr-2 h-4 w-4" />
              Xem trước
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Send Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Gửi link hướng dẫn nhanh
          </CardTitle>
          <CardDescription>
            Gửi email chứa link bài viết hướng dẫn đến khách hàng
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setSendGuideOpen(true)}>
            <Send className="mr-2 h-4 w-4" />
            Gửi hướng dẫn
          </Button>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Xem trước email chào mừng</DialogTitle>
          </DialogHeader>
          <div className="border rounded-lg overflow-hidden">
            <div className="p-2 bg-muted text-xs text-muted-foreground">
              <strong>Tiêu đề:</strong> {subject.replace(/\{\{admin_name\}\}/g, 'Nguyễn Văn A').replace(/\{\{subdomain\}\}/g, 'demo-store')}
            </div>
            <div dangerouslySetInnerHTML={{ __html: getPreviewHtml() }} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Send Guide Dialog */}
      <Dialog open={sendGuideOpen} onOpenChange={setSendGuideOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Gửi link hướng dẫn
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email người nhận</Label>
              <Input
                type="email"
                value={guideEmail}
                onChange={(e) => setGuideEmail(e.target.value)}
                placeholder="email@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Chọn bài viết hướng dẫn</Label>
              <Select value={selectedArticleId} onValueChange={setSelectedArticleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn bài viết..." />
                </SelectTrigger>
                <SelectContent>
                  {articles?.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendGuideOpen(false)}>Hủy</Button>
            <Button onClick={handleSendGuide} disabled={sendingGuide}>
              {sendingGuide && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Send className="mr-2 h-4 w-4" />
              Gửi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
