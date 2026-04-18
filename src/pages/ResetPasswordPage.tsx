import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Warehouse, Loader2, ArrowLeft, CheckCircle, Eye, EyeOff } from 'lucide-react';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const [validSession, setValidSession] = useState(false);

  useEffect(() => {
    // Listen for auth state changes (when user clicks the reset link)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setValidSession(true);
      }
    });

    // Handle different recovery link formats from email
    const handleRecoveryLink = async () => {
      try {
        const url = new URL(window.location.href);
        const hash = window.location.hash.startsWith('#')
          ? new URLSearchParams(window.location.hash.slice(1))
          : new URLSearchParams();

        // Format 1: PKCE flow — ?code=xxx
        const code = url.searchParams.get('code');
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error) {
            setValidSession(true);
            window.history.replaceState({}, '', '/reset-password');
            return;
          }
        }

        // Format 2: OTP token — ?token_hash=xxx&type=recovery
        const tokenHash = url.searchParams.get('token_hash') || hash.get('token_hash');
        const type = url.searchParams.get('type') || hash.get('type');
        if (tokenHash && type === 'recovery') {
          const { error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash });
          if (!error) {
            setValidSession(true);
            window.history.replaceState({}, '', '/reset-password');
            return;
          }
        }

        // Format 3: Implicit flow — #access_token=xxx&refresh_token=xxx
        const accessToken = hash.get('access_token');
        const refreshToken = hash.get('refresh_token');
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (!error) {
            setValidSession(true);
            window.history.replaceState({}, '', '/reset-password');
            return;
          }
        }

        // Fallback: existing session
        const { data: { session } } = await supabase.auth.getSession();
        if (session) setValidSession(true);
      } catch (err) {
        console.error('Reset password link error:', err);
      }
    };

    handleRecoveryLink();

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: 'Lỗi',
        description: 'Mật khẩu xác nhận không khớp',
        variant: 'destructive',
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: 'Lỗi',
        description: 'Mật khẩu phải có ít nhất 6 ký tự',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        throw error;
      }

      setSuccess(true);
      toast({
        title: 'Thành công',
        description: 'Mật khẩu đã được đặt lại thành công!',
      });

      // Sign out and redirect to login
      setTimeout(async () => {
        await supabase.auth.signOut();
        navigate('/auth');
      }, 2000);
    } catch (error: any) {
      const msg = error?.message || '';
      let friendly = msg || 'Không thể đặt lại mật khẩu';
      if (/pwned|leaked|known to be|weak|easy to guess/i.test(msg)) {
        friendly = 'Mật khẩu này đã bị lộ trong các vụ rò rỉ dữ liệu hoặc quá yếu. Vui lòng chọn mật khẩu mạnh hơn (kết hợp chữ hoa, chữ thường, số, ký tự đặc biệt).';
      } else if (/should be different|same as the old/i.test(msg)) {
        friendly = 'Mật khẩu mới phải khác mật khẩu cũ.';
      } else if (/short|length|at least/i.test(msg)) {
        friendly = 'Mật khẩu quá ngắn. Vui lòng nhập ít nhất 6 ký tự.';
      }
      toast({
        title: 'Lỗi',
        description: friendly,
        variant: 'destructive',
      });
    }

    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-green-500">
                <CheckCircle className="h-8 w-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl">Đặt lại thành công!</CardTitle>
            <CardDescription>
              Mật khẩu của bạn đã được cập nhật. Đang chuyển đến trang đăng nhập...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!validSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
                <Warehouse className="h-8 w-8 text-primary-foreground" />
              </div>
            </div>
            <CardTitle className="text-2xl">Link không hợp lệ</CardTitle>
            <CardDescription>
              Link đặt lại mật khẩu đã hết hạn hoặc không hợp lệ.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" asChild>
              <Link to="/forgot-password">
                Yêu cầu link mới
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
              <Warehouse className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl">Đặt mật khẩu mới</CardTitle>
          <CardDescription>
            Nhập mật khẩu mới cho tài khoản của bạn
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Mật khẩu mới</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Xác nhận mật khẩu</Label>
              <Input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Đặt mật khẩu mới
            </Button>
          </form>

          <Button variant="ghost" className="w-full" asChild>
            <Link to="/auth">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Quay lại đăng nhập
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
