import { useState, useEffect } from 'react';
import { useTenantLandingSettings, useUpdateTenantLandingSettings } from '@/hooks/useTenantLanding';
import { useCurrentTenant } from '@/hooks/useTenant';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Loader2, Save, Mail, HelpCircle, Trash2, Settings as SettingsIcon } from 'lucide-react';
import { ZaloZnsManager } from './ZaloZnsManager';

function AppPasswordHelpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Hướng dẫn lấy App Password Gmail
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <p className="font-medium">Bước 1: Bật xác minh 2 bước</p>
            <p className="text-muted-foreground text-xs">Vào Google Account → Security → 2-Step Verification → Bật lên</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <p className="font-medium">Bước 2: Tạo App Password</p>
            <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline break-all">
              https://myaccount.google.com/apppasswords
            </a>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <p className="font-medium">Bước 3: Tạo mật khẩu mới</p>
            <p className="text-muted-foreground text-xs">Đặt tên app (VD: "VKho Email") → Create → Copy mật khẩu 16 ký tự.</p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            <p className="text-xs text-amber-800 dark:text-amber-200">⚠️ Phải tạo App Password riêng, không dùng mật khẩu Gmail thường.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function OrderEmailZaloConfigTab() {
  const { data: tenant } = useCurrentTenant();
  const { data: settings } = useTenantLandingSettings();
  const updateSettings = useUpdateTenantLandingSettings();

  const [formData, setFormData] = useState<any>({});
  const [showHelp, setShowHelp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (settings) setFormData(settings);
  }, [settings]);

  const handleChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const hasCredentials = !!(formData.order_email_sender && formData.order_email_app_password);
  const showFields = !hasCredentials || editing;
  const tenantId = tenant?.id || null;

  const maskEmail = (email: string) => {
    if (!email) return '';
    const [user, domain] = email.split('@');
    if (!domain) return email;
    return user.slice(0, 2) + '•••' + '@' + domain;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings.mutateAsync(formData);
      setEditing(false);
      toast({ title: '✅ Đã lưu cài đặt email!' });
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message || 'Không thể lưu', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = async (checked: boolean) => {
    const updated = { ...formData, order_email_enabled: checked };
    setFormData(updated);
    try {
      await updateSettings.mutateAsync(updated);
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    const cleared = { ...formData, order_email_sender: '', order_email_app_password: '' };
    setFormData(cleared);
    setEditing(false);
    try {
      await updateSettings.mutateAsync(cleared);
      toast({ title: '🗑️ Đã xóa thông tin email' });
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      {/* Email config */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4 text-primary" />
            Cấu hình Email tự động
          </CardTitle>
          <CardDescription>Gửi email xác nhận đơn hàng tự động cho khách</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Bật email tự động đơn hàng</Label>
            <Switch
              checked={formData.order_email_enabled ?? false}
              onCheckedChange={handleToggleEnabled}
            />
          </div>

          {formData.order_email_enabled && (
            <div className="space-y-3 border-l-2 border-primary/20 pl-3">
              {hasCredentials && !editing && (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">Tài khoản gửi mail</p>
                      <p className="text-sm font-medium">{maskEmail(formData.order_email_sender)}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => setEditing(true)}>
                        <Save className="h-3 w-3" /> Sửa
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1 text-destructive hover:text-destructive" onClick={handleDelete}>
                        <Trash2 className="h-3 w-3" /> Xóa
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">App Password: ••••••••••••••••</p>
                </div>
              )}

              {showFields && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Email gửi (Gmail)</Label>
                    <Input
                      value={formData.order_email_sender || ''}
                      onChange={e => handleChange('order_email_sender', e.target.value)}
                      placeholder="yourstore@gmail.com"
                      type="email"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Mail App Password</Label>
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-primary" onClick={() => setShowHelp(true)}>
                        <HelpCircle className="h-3.5 w-3.5 mr-1" /> Hướng dẫn
                      </Button>
                    </div>
                    <Input
                      value={formData.order_email_app_password || ''}
                      onChange={e => handleChange('order_email_app_password', e.target.value)}
                      placeholder="Mật khẩu ứng dụng Gmail"
                      type="password"
                    />
                  </div>
                  {editing && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="text-xs" onClick={() => setEditing(false)}>Hủy</Button>
                    </div>
                  )}
                </>
              )}

              <Separator />
              <Button
                variant="default"
                size="sm"
                className="w-full gap-1.5"
                disabled={!formData.order_email_sender || !formData.order_email_app_password || saving}
                onClick={handleSave}
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Lưu cài đặt mail
              </Button>
            </div>
          )}

          <AppPasswordHelpDialog open={showHelp} onOpenChange={setShowHelp} />
        </CardContent>
      </Card>

      {/* Zalo ZNS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <SettingsIcon className="h-4 w-4 text-primary" />
            Cấu hình Zalo OA
          </CardTitle>
          <CardDescription>Kết nối Zalo OA và cấu hình gửi tin nhắn ZNS tự động cho khách hàng</CardDescription>
        </CardHeader>
        <CardContent>
          <ZaloZnsManager />
        </CardContent>
      </Card>
    </div>
  );
}
