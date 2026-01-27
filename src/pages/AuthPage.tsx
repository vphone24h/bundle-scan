import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Warehouse, Loader2 } from 'lucide-react';
import { useTenantResolver } from '@/hooks/useTenantResolver';

export default function AuthPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  
  // Auto-detect tenant from subdomain
  const resolvedTenant = useTenantResolver();
  const isSubdomainMode = resolvedTenant.status === 'resolved' && resolvedTenant.subdomain;

  // Login form - pre-fill store ID if detected from subdomain
  const [storeId, setStoreId] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Auto-fill store ID from subdomain
  useEffect(() => {
    if (resolvedTenant.subdomain && resolvedTenant.status === 'resolved') {
      setStoreId(resolvedTenant.subdomain);
    }
  }, [resolvedTenant.subdomain, resolvedTenant.status]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Sign in first (tenants table is protected by RLS when not authenticated)
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

      // Verify user belongs to the entered store (by checking user's tenant_id then comparing subdomain)
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

        if (!userTenantId) {
          await supabase.auth.signOut();
          toast({
            title: 'Không có quyền truy cập',
            description: 'Tài khoản của bạn chưa được gán cửa hàng.',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }

        const { data: tenant, error: tenantError } = await supabase
          .from('tenants')
          .select('id, subdomain, status')
          .eq('id', userTenantId)
          .maybeSingle();

        if (tenantError) {
          await supabase.auth.signOut();
          toast({
            title: 'Lỗi',
            description: 'Không thể kiểm tra cửa hàng của bạn. Vui lòng thử lại.',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }

        if (!tenant) {
          await supabase.auth.signOut();
          toast({
            title: 'Không có quyền truy cập',
            description: 'Không tìm thấy thông tin cửa hàng của tài khoản này.',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }

        if (tenant.status === 'locked') {
          await supabase.auth.signOut();
          toast({
            title: 'Cửa hàng bị khóa',
            description: 'Cửa hàng này đã bị khóa. Vui lòng liên hệ hỗ trợ.',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }

        const inputStoreId = storeId.toLowerCase().trim();
        if (tenant.subdomain !== inputStoreId) {
          await supabase.auth.signOut();
          toast({
            title: 'Sai ID cửa hàng',
            description: `Tài khoản này thuộc cửa hàng "${tenant.subdomain}". Vui lòng nhập đúng ID cửa hàng.`,
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
          <CardTitle className="text-2xl">
            {isSubdomainMode && resolvedTenant.tenantName 
              ? resolvedTenant.tenantName 
              : 'Kho Hàng Pro'}
          </CardTitle>
          <CardDescription>
            {isSubdomainMode 
              ? 'Đăng nhập vào cửa hàng' 
              : 'Đăng nhập vào cửa hàng của bạn'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Ẩn Store ID input nếu đang ở subdomain mode */}
            {!isSubdomainMode && (
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
                    .vkho.vn
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Nhập ID cửa hàng bạn đã đăng ký (không có dấu chấm)
                </p>
              </div>
            )}
            
            {/* Hiển thị store info nếu đang ở subdomain mode */}
            {isSubdomainMode && (
              <div className="bg-muted p-3 rounded-lg text-center">
                <p className="text-sm text-muted-foreground">Đang đăng nhập vào</p>
                <p className="font-mono font-semibold text-primary">
                  {resolvedTenant.subdomain}.vkho.vn
                </p>
              </div>
            )}
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
            
            {/* Chỉ hiển thị link "Quên ID cửa hàng" khi không ở subdomain mode */}
            {!isSubdomainMode && (
              <div className="text-center">
                <Link to="/forgot-store-id" className="text-sm text-muted-foreground hover:text-primary hover:underline">
                  Quên ID cửa hàng?
                </Link>
              </div>
            )}
          </form>

          {/* Chỉ hiển thị đăng ký khi ở main domain */}
          {!isSubdomainMode && (
            <>
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
            </>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
