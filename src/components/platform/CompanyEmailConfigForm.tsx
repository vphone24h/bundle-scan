import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAdminCompanyId } from '@/hooks/useAdminCompanyId';
import { toast } from '@/hooks/use-toast';
import { Mail, Save, Loader2, Eye, EyeOff, Info, ShieldCheck } from 'lucide-react';

export function CompanyEmailConfigForm() {
  const { companyId, isCompanyAdmin } = useAdminCompanyId();
  const queryClient = useQueryClient();

  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState(465);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [fromName, setFromName] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [testing, setTesting] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ['company-email-config', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_email_config')
        .select('*')
        .eq('company_id', companyId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (config) {
      setSmtpHost(config.smtp_host || 'smtp.gmail.com');
      setSmtpPort(config.smtp_port || 465);
      setSmtpUser(config.smtp_user || '');
      setSmtpPass(config.smtp_pass || '');
      setFromEmail(config.from_email || '');
      setFromName(config.from_name || '');
      setIsEnabled(config.is_enabled || false);
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('Không tìm thấy công ty');

      const payload = {
        company_id: companyId,
        smtp_host: smtpHost || null,
        smtp_port: smtpPort || null,
        smtp_user: smtpUser || null,
        smtp_pass: smtpPass || null,
        from_email: fromEmail || smtpUser || null,
        from_name: fromName || null,
        is_enabled: isEnabled,
        updated_at: new Date().toISOString(),
      };

      if (config?.id) {
        const { error } = await supabase
          .from('company_email_config')
          .update(payload)
          .eq('id', config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('company_email_config')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-email-config'] });
      toast({ title: 'Đã lưu cấu hình email' });
    },
    onError: (err: any) => {
      toast({ title: 'Lỗi', description: err.message, variant: 'destructive' });
    },
  });

  if (!isCompanyAdmin || !companyId) return null;
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card id="company-email-config">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Cấu hình Email (SMTP / App Password)
        </CardTitle>
        <CardDescription>
          Cấu hình email riêng cho công ty. Khi bật, hệ thống sẽ sử dụng email này thay cho email hệ thống gốc để gửi thông báo tự động cho tài khoản thuộc công ty.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
          <div className="flex items-center gap-3">
            <ShieldCheck className={`h-5 w-5 ${isEnabled ? 'text-green-600' : 'text-muted-foreground'}`} />
            <div>
              <p className="text-sm font-medium">
                {isEnabled ? 'Email riêng đang BẬT' : 'Email riêng đang TẮT'}
              </p>
              <p className="text-xs text-muted-foreground">
                {isEnabled
                  ? 'Hệ thống gốc sẽ không gửi email cho tài khoản thuộc công ty này'
                  : 'Hệ thống gốc vẫn gửi email thông báo cho tài khoản thuộc công ty này'}
              </p>
            </div>
          </div>
          <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>SMTP Host</Label>
            <Input value={smtpHost} onChange={e => setSmtpHost(e.target.value)} placeholder="smtp.gmail.com" />
          </div>
          <div className="space-y-2">
            <Label>SMTP Port</Label>
            <Input type="number" value={smtpPort} onChange={e => setSmtpPort(Number(e.target.value))} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Email đăng nhập (SMTP User)</Label>
          <Input value={smtpUser} onChange={e => setSmtpUser(e.target.value)} placeholder="your-email@gmail.com" />
        </div>

        <div className="space-y-2">
          <Label>App Password / Mật khẩu ứng dụng</Label>
          <div className="relative">
            <Input
              type={showPass ? 'text' : 'password'}
              value={smtpPass}
              onChange={e => setSmtpPass(e.target.value)}
              placeholder="xxxx xxxx xxxx xxxx"
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full"
              onClick={() => setShowPass(!showPass)}
            >
              {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground flex items-start gap-1">
            <Info className="h-3 w-3 mt-0.5 shrink-0" />
            Với Gmail: Vào Google Account → Bảo mật → Xác minh 2 bước → Mật khẩu ứng dụng → Tạo mật khẩu cho "Mail"
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Tên hiển thị (From Name)</Label>
            <Input value={fromName} onChange={e => setFromName(e.target.value)} placeholder="Tên công ty" />
          </div>
          <div className="space-y-2">
            <Label>Email gửi (From Email)</Label>
            <Input value={fromEmail} onChange={e => setFromEmail(e.target.value)} placeholder="Mặc định = SMTP User" />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
            Lưu cấu hình
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
