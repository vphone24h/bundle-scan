import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Warehouse, Loader2, Store } from 'lucide-react';

export default function AuthPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);

  // Login form
  const [storeId, setStoreId] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // First verify the store ID exists
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('id, subdomain, status')
        .eq('subdomain', storeId.toLowerCase().trim())
        .maybeSingle();

      if (tenantError) {
        throw new Error('Không thể kiểm tra ID cửa hàng');
      }

      if (!tenant) {
        toast({
          title: 'Không tìm thấy cửa hàng',
          description: 'ID cửa hàng không tồn tại. Vui lòng kiểm tra lại.',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      if (tenant.status === 'locked') {
        toast({
          title: 'Cửa hàng bị khóa',
          description: 'Cửa hàng này đã bị khóa. Vui lòng liên hệ hỗ trợ.',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // Now sign in
      const { error } = await signIn(loginEmail, loginPassword);
      
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

      // Verify user belongs to this tenant
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: platformUser } = await supabase
          .from('platform_users')
          .select('tenant_id, platform_role')
          .eq('user_id', user.id)
          .maybeSingle();

        const { data: userRole } = await supabase
          .from('user_roles')
          .select('tenant_id')
          .eq('user_id', user.id)
          .maybeSingle();

        const userTenantId = platformUser?.tenant_id || userRole?.tenant_id;

        // Platform admin can access any store
        if (platformUser?.platform_role === 'platform_admin') {
          toast({
            title: 'Đăng nhập thành công',
            description: 'Chào mừng Platform Admin!',
          });
          navigate('/platform-admin');
          return;
        }

        if (userTenantId !== tenant.id) {
          await supabase.auth.signOut();
          toast({
            title: 'Không có quyền truy cập',
            description: 'Tài khoản của bạn không thuộc cửa hàng này.',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }
      }

      toast({
        title: 'Đăng nhập thành công',
        description: 'Chào mừng bạn quay lại!',
      });
      navigate('/');
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
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
              <Warehouse className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl">Kho Hàng Pro</CardTitle>
          <CardDescription>Đăng nhập vào cửa hàng của bạn</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="store-id">ID Cửa hàng</Label>
              <div className="flex items-center gap-0">
                <Input
                  id="store-id"
                  type="text"
                  placeholder="vphone"
                  value={storeId}
                  onChange={(e) => setStoreId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  className="rounded-r-none border-r-0"
                  required
                />
                <span className="inline-flex items-center px-3 h-10 border border-l-0 rounded-r-md bg-muted text-muted-foreground text-sm">
                  .khohangpro.vn
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Nhập ID cửa hàng bạn đã đăng ký (không có dấu chấm)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                placeholder="email@example.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="login-password">Mật khẩu</Label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                  Quên mật khẩu?
                </Link>
              </div>
              <Input
                id="login-password"
                type="password"
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Đăng nhập
            </Button>
            
            <div className="text-center">
              <Link to="/forgot-store-id" className="text-sm text-muted-foreground hover:text-primary hover:underline">
                Quên ID cửa hàng?
              </Link>
            </div>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Chưa có tài khoản?
              </span>
            </div>
          </div>

          <Button variant="outline" className="w-full" asChild>
            <Link to="/register">
              Đăng ký doanh nghiệp mới
            </Link>
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Dùng thử miễn phí 30 ngày, đầy đủ tính năng
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
