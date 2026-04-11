import { useState, useEffect, useRef } from 'react';
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

  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const latestFormRef = useRef({ smtpUser: '', smtpPass: '', isEnabled: false });

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
      const nextState = {
        smtpUser: config.smtp_user || '',
        smtpPass: config.smtp_pass || '',
        isEnabled: config.is_enabled || false,
      };

      latestFormRef.current = nextState;
      setSmtpUser(nextState.smtpUser);
      setSmtpPass(nextState.smtpPass);
      setIsEnabled(nextState.isEnabled);
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('Không tìm thấy công ty');

      const latestForm = latestFormRef.current;
      const normalizedSmtpUser = latestForm.smtpUser.trim();
      const normalizedSmtpPass = latestForm.smtpPass.trim();

      if (latestForm.isEnabled && (!normalizedSmtpUser || !normalizedSmtpPass)) {
        throw new Error('Vui lòng nhập Gmail và App Password trước khi bật Email riêng');
      }

      const payload = {
        company_id: companyId,
        smtp_host: 'smtp.gmail.com',
        smtp_port: 465,
        smtp_user: normalizedSmtpUser || null,
        smtp_pass: normalizedSmtpPass || null,
        from_email: normalizedSmtpUser || null,
        from_name: null,
        is_enabled: latestForm.isEnabled,
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Cấu hình Email gửi thông báo
        </CardTitle>
        <CardDescription>
          Nhập email Gmail và App Password để hệ thống gửi thông báo tự động cho tài khoản thuộc công ty.
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
                  ? 'Hệ thống sẽ dùng email này để gửi thông báo'
                  : 'Hệ thống gốc vẫn gửi email thông báo'}
              </p>
            </div>
          </div>
          <Switch
            checked={isEnabled}
            onCheckedChange={(checked) => {
              latestFormRef.current = { ...latestFormRef.current, isEnabled: checked };
              setIsEnabled(checked);
            }}
          />
        </div>

        <div className="space-y-2">
          <Label>Email Gmail</Label>
          <Input
            value={smtpUser}
            onChange={e => {
              const value = e.target.value;
              latestFormRef.current = { ...latestFormRef.current, smtpUser: value };
              setSmtpUser(value);
            }}
            placeholder="your-email@gmail.com"
          />
        </div>

        <div className="space-y-2">
          <Label>App Password (Mật khẩu ứng dụng)</Label>
          <div className="relative">
            <Input
              type={showPass ? 'text' : 'password'}
              value={smtpPass}
              onChange={e => {
                const value = e.target.value;
                latestFormRef.current = { ...latestFormRef.current, smtpPass: value };
                setSmtpPass(value);
              }}
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
            Vào Google Account → Bảo mật → Xác minh 2 bước → Mật khẩu ứng dụng → Tạo mật khẩu cho "Mail"
          </p>
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
