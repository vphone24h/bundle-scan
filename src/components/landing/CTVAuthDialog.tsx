import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, UserPlus, LogIn, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface CTVAuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  storeName: string;
  accentColor?: string;
  onSuccess: () => void;
  /** Pre-filled referrer code from ?ref= URL param — read-only */
  referrerCode?: string | null;
}

export function CTVAuthDialog({ open, onOpenChange, tenantId, storeName, accentColor, onSuccess, referrerCode }: CTVAuthDialogProps) {
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', full_name: '', phone: '' });

  const handleLogin = async () => {
    setLoading(true);
    try {
      localStorage.setItem('ctv_store_mode', tenantId);
      const { error } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });
      if (error) {
        localStorage.removeItem('ctv_store_mode');
        if (error.message?.includes('Email not confirmed')) {
          throw new Error('Email chưa được xác thực. Vui lòng kiểm tra hộp thư.');
        }
        throw error;
      }
      toast({ title: 'Đăng nhập thành công!' });
      onSuccess();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Lỗi đăng nhập', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!form.full_name.trim()) {
      toast({ title: 'Vui lòng nhập họ tên', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('signup-ctv', {
        body: {
          email: form.email,
          password: form.password,
          full_name: form.full_name,
          phone: form.phone || undefined,
          tenant_id: tenantId,
          redirect_url: window.location.origin,
          referrer_code: referrerCode || undefined,
        },
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      // Auto-login after successful registration (email is auto-confirmed)
      if (data?.auto_login) {
        localStorage.setItem('ctv_store_mode', tenantId);
        const { error: loginErr } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        });
        if (loginErr) {
          toast({ title: 'Đăng ký thành công!', description: 'Vui lòng đăng nhập.' });
          setMode('login');
        } else {
          toast({ title: 'Đăng ký thành công! Đang đăng nhập...' });
          onSuccess();
          onOpenChange(false);
        }
      } else {
        toast({ title: 'Đăng ký thành công!', description: 'Vui lòng đăng nhập.' });
        setMode('login');
      }
    } catch (e: any) {
      toast({ title: 'Lỗi đăng ký', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-center">
            {mode === 'login' ? 'Đăng nhập CTV' : 'Đăng ký CTV'}
          </DialogTitle>
          <p className="text-sm text-muted-foreground text-center">
            {storeName}
          </p>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {mode === 'register' && (
            <>
              <div className="space-y-2">
                <Label>Họ tên *</Label>
                <Input
                  value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder="Nguyễn Văn A"
                />
              </div>
              <div className="space-y-2">
                <Label>Số điện thoại</Label>
                <Input
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="0912345678"
                />
              </div>
              {referrerCode && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    Mã giới thiệu
                  </Label>
                  <Input
                    readOnly
                    value={referrerCode}
                    className="font-mono bg-muted/50 text-muted-foreground"
                  />
                </div>
              )}
            </>
          )}

          <div className="space-y-2">
            <Label>Email *</Label>
            <Input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="email@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label>Mật khẩu *</Label>
            <Input
              type="password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="••••••••"
            />
          </div>

          <Button
            className="w-full"
            onClick={mode === 'login' ? handleLogin : handleRegister}
            disabled={loading || !form.email || !form.password}
            style={accentColor ? { backgroundColor: accentColor } : {}}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'login' ? (
              <><LogIn className="mr-2 h-4 w-4" />Đăng nhập</>
            ) : (
              <><UserPlus className="mr-2 h-4 w-4" />Đăng ký</>
            )}
          </Button>

          <div className="text-center">
            {mode === 'login' ? (
              <button onClick={() => setMode('register')} className="text-sm text-primary hover:underline">
                Chưa có tài khoản? Đăng ký CTV
              </button>
            ) : (
              <button onClick={() => setMode('login')} className="text-sm text-primary hover:underline">
                Đã có tài khoản? Đăng nhập
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
