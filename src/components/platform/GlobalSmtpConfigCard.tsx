import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, KeyRound, Save, Loader2, Eye, EyeOff, Info, ExternalLink } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function GlobalSmtpConfigCard() {
  const qc = useQueryClient();
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [showPass, setShowPass] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['global-smtp-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('global_smtp_config')
        .select('smtp_user, smtp_password, updated_at')
        .eq('id', 1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (data) {
      setSmtpUser(data.smtp_user || '');
      setSmtpPass(data.smtp_password || '');
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: res, error } = await supabase.functions.invoke('update-global-smtp', {
        body: { smtp_user: smtpUser, smtp_password: smtpPass },
      });
      if (error) {
        const msg = (res as any)?.error || error.message;
        throw new Error(msg);
      }
      if ((res as any)?.error) throw new Error((res as any).error);
      return res;
    },
    onSuccess: () => {
      toast.success('Đã lưu cấu hình Email gốc');
      qc.invalidateQueries({ queryKey: ['global-smtp-config'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="border-amber-200 bg-amber-50/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-amber-700" />
          Cấu hình Email gốc (Platform fallback)
        </CardTitle>
        <CardDescription>
          Email Gmail dùng làm <strong>fallback toàn nền tảng</strong> khi công ty chưa cấu hình SMTP riêng.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> Email Gmail gốc (SMTP_USER)
              </Label>
              <Input
                type="email"
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
                placeholder="your-email@gmail.com"
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5" /> App Password (SMTP_PASSWORD - 16 ký tự)
              </Label>
              <div className="relative">
                <Input
                  type={showPass ? 'text' : 'password'}
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                  placeholder="xxxx xxxx xxxx xxxx"
                  autoComplete="off"
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
                Tạo tại Google Account → Bảo mật → Xác minh 2 bước → Mật khẩu ứng dụng → "Mail"
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1.5" />
                )}
                Lưu cấu hình
              </Button>
              <a
                href="https://myaccount.google.com/apppasswords"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Mở trang tạo App Password
              </a>
            </div>

            {data?.updated_at && (
              <p className="text-xs text-muted-foreground">
                Cập nhật lần cuối: {new Date(data.updated_at).toLocaleString('vi-VN')}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
