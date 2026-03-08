import { useState } from 'react';
import { buildStoreUrl } from '@/lib/tenantResolver';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, UserPlus, LogIn } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface CTVAuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  storeName: string;
  accentColor?: string;
  onSuccess: () => void;
}

export function CTVAuthDialog({ open, onOpenChange, tenantId, storeName, accentColor, onSuccess }: CTVAuthDialogProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', full_name: '', phone: '' });

  const handleLogin = async () => {
    setLoading(true);
    try {
      // Mark as CTV login BEFORE signing in to prevent redirect
      localStorage.setItem('ctv_store_mode', tenantId);
      const { error } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });
      if (error) {
        localStorage.removeItem('ctv_store_mode');
        if (error.message?.includes('Email not confirmed')) {
          throw new Error('Email chưa được xác thực. Vui lòng kiểm tra hộp thư (kể cả Spam) để xác nhận email trước khi đăng nhập.');
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
      // Use edge function to signup CTV and send verification via store's SMTP
      const { data, error } = await supabase.functions.invoke('signup-ctv', {
        body: {
          email: form.email,
          password: form.password,
          full_name: form.full_name,
          phone: form.phone || undefined,
          tenant_id: tenantId,
          redirect_url: window.location.origin,
        },
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      toast({
        title: 'Đăng ký thành công!',
        description: 'Vui lòng kiểm tra email để xác thực tài khoản. Email được gửi từ cửa hàng.',
      });
      setMode('login');
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
