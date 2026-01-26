import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Shield, Loader2 } from 'lucide-react';

export default function PlatformAuthPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await signIn(email, password);
      
      if (error) {
        toast({
          title: 'Đăng nhập thất bại',
          description: error.message === 'Invalid login credentials' 
            ? 'Email hoặc mật khẩu không đúng'
            : error.message,
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // Verify user is platform admin
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: platformUser } = await supabase
          .from('platform_users')
          .select('platform_role')
          .eq('user_id', user.id)
          .maybeSingle();

        if (platformUser?.platform_role !== 'platform_admin') {
          await supabase.auth.signOut();
          toast({
            title: 'Không có quyền truy cập',
            description: 'Tài khoản của bạn không phải Platform Admin.',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }

        toast({
          title: 'Đăng nhập thành công',
          description: 'Chào mừng Platform Admin!',
        });
        navigate('/platform-admin');
      }
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message || 'Đã xảy ra lỗi khi đăng nhập',
        variant: 'destructive',
      });
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md shadow-xl border-primary/20">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
              <Shield className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl">Quản trị Nền tảng</CardTitle>
          <CardDescription>Đăng nhập dành cho Platform Admin</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-email">Email</Label>
              <Input
                id="admin-email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password">Mật khẩu</Label>
              <Input
                id="admin-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Đăng nhập Admin
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Hoặc
              </span>
            </div>
          </div>

          <Button variant="outline" className="w-full" asChild>
            <Link to="/auth">
              Đăng nhập với tư cách người dùng
            </Link>
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Trang này chỉ dành cho quản trị viên hệ thống
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
