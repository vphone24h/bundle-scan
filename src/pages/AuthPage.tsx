import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { toast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft } from 'lucide-react';
import vkhoLogo from '@/assets/vkho-logo.png';
import { useTenantResolver } from '@/hooks/useTenantResolver';

const CURRENT_STORE_ID_KEY = 'current_store_id';

export default function AuthPage() {
  const navigate = useNavigate();
  const { signIn, signOut, user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState<string | null>(null);
  
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

  // If a user is already logged in but selects a different Store ID, force sign-out to prevent cross-store confusion.
  // This is especially important in main-domain mode where multiple stores can be accessed from the same origin.
  useEffect(() => {
    if (!user || authLoading) return;

    const desiredStoreId = (storeId || '').toLowerCase().trim();
    if (!desiredStoreId) return;

    // In subdomain mode, storeId is auto-filled from the hostname.
    // In main-domain mode, user can type storeId.
    const check = async () => {
      try {
        // Fetch current user's tenant subdomain
        const { data: platformUser } = await supabase
          .from('platform_users')
          .select('tenant_id, platform_role')
          .eq('user_id', user.id)
          .maybeSingle();

        // Platform admin is allowed anywhere
        if (platformUser?.platform_role === 'platform_admin') return;

        const { data: userRole } = await supabase
          .from('user_roles')
          .select('tenant_id')
          .eq('user_id', user.id)
          .maybeSingle();

        const userTenantId = platformUser?.tenant_id || userRole?.tenant_id;
        if (!userTenantId) return;

        const { data: tenant } = await supabase
          .from('tenants')
          .select('subdomain')
          .eq('id', userTenantId)
          .maybeSingle();

        if (tenant?.subdomain && tenant.subdomain !== desiredStoreId) {
          await signOut();
          toast({
            title: 'Đã chuyển cửa hàng',
            description: 'Bạn đang đăng nhập ở cửa hàng khác. Vui lòng đăng nhập lại đúng ID cửa hàng.',
            variant: 'destructive',
          });
          setPendingRedirect(null);
          setLoading(false);
        }
      } catch {
        // If anything fails, do nothing (we still have store-id verification after sign-in)
      }
    };

    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading, storeId, isSubdomainMode]);

  // Redirect after auth state is updated
  useEffect(() => {
    if (pendingRedirect && user && !authLoading) {
      navigate(pendingRedirect, { replace: true });
      setPendingRedirect(null);
      setLoading(false);
    }
  }, [user, authLoading, pendingRedirect, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Persist selected store id for main-domain mode so we can validate tenant-session consistency
      // (In subdomain mode, storeId is derived from hostname, but keeping this doesn't hurt.)
      localStorage.setItem(CURRENT_STORE_ID_KEY, storeId.toLowerCase().trim());

      // Sign in first (tenants table is protected by RLS when not authenticated)
      const { error } = await signIn(loginEmail, loginPassword);
      
      if (error) {
        toast({
          title: 'Đăng nhập thất bại',
          description: 'ID cửa hàng, email hoặc mật khẩu không đúng',
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
          setPendingRedirect('/platform-admin');
          return;
        }

        if (!userTenantId) {
          await supabase.auth.signOut();
          toast({
            title: 'Đăng nhập thất bại',
            description: 'ID cửa hàng, email hoặc mật khẩu không đúng',
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
            title: 'Đăng nhập thất bại',
            description: 'ID cửa hàng, email hoặc mật khẩu không đúng',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }

        if (!tenant) {
          await supabase.auth.signOut();
          toast({
            title: 'Đăng nhập thất bại',
            description: 'ID cửa hàng, email hoặc mật khẩu không đúng',
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
            title: 'Đăng nhập thất bại',
            description: 'ID cửa hàng, email hoặc mật khẩu không đúng',
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
      setPendingRedirect('/');
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message || 'Đã xảy ra lỗi khi đăng nhập',
        variant: 'destructive',
      });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md shadow-xl relative">
        <CardHeader className="text-center">
          {/* Nút quay về trang chủ - chỉ hiển thị khi ở main domain */}
          {!isSubdomainMode && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="absolute left-4 top-4"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Trang chủ
            </Button>
          )}
          <div className="flex justify-center mb-4 pt-6">
            <img 
              src={vkhoLogo} 
              alt="VKho Logo" 
              className="h-20 w-20 object-contain"
            />
          </div>
          <CardTitle className="text-2xl">
            {isSubdomainMode && resolvedTenant.tenantName 
              ? resolvedTenant.tenantName 
              : 'Quản lý kho Dễ Dàng chi tiết'}
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
                    placeholder="vkho"
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
