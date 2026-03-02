import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { signIn, signOut, user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState<string | null>(null);
  
  const resolvedTenant = useTenantResolver();
  const isSubdomainMode = resolvedTenant.status === 'resolved' && resolvedTenant.subdomain;

  const [storeId, setStoreId] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  useEffect(() => {
    if (resolvedTenant.subdomain && resolvedTenant.status === 'resolved') {
      setStoreId(resolvedTenant.subdomain);
    }
  }, [resolvedTenant.subdomain, resolvedTenant.status]);

  useEffect(() => {
    const storedStoreId = localStorage.getItem(CURRENT_STORE_ID_KEY) || '';
    if (storedStoreId && !storeId && !isSubdomainMode) {
      setStoreId(storedStoreId);
    }
  }, [isSubdomainMode, storeId]);

  useEffect(() => {
    if (!user || authLoading) return;
    const desiredStoreId = (storeId || '').toLowerCase().trim();
    if (!desiredStoreId) return;
    const check = async () => {
      try {
        const { data: platformUser } = await supabase.from('platform_users').select('tenant_id, platform_role').eq('user_id', user.id).maybeSingle();
        if (platformUser?.platform_role === 'platform_admin') return;
        const { data: userRole } = await supabase.from('user_roles').select('tenant_id').eq('user_id', user.id).maybeSingle();
        const userTenantId = platformUser?.tenant_id || userRole?.tenant_id;
        if (!userTenantId) return;
        const { data: tenant } = await supabase.from('tenants').select('subdomain').eq('id', userTenantId).maybeSingle();
        if (tenant?.subdomain && tenant.subdomain !== desiredStoreId) {
          await signOut();
          toast({ title: t('pages.auth.switchedStore'), description: t('pages.auth.switchedStoreDesc'), variant: 'destructive' });
          setPendingRedirect(null);
          setLoading(false);
        }
      } catch { }
    };
    check();
  }, [user?.id, authLoading, storeId, isSubdomainMode, signOut, t]);

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
      localStorage.setItem(CURRENT_STORE_ID_KEY, storeId.toLowerCase().trim());
      const { error } = await signIn(loginEmail, loginPassword);
      if (error) {
        toast({ title: t('pages.auth.loginFailed'), description: t('pages.auth.wrongCredentials'), variant: 'destructive' });
        setLoading(false);
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: platformUser } = await supabase.from('platform_users').select('tenant_id, platform_role').eq('user_id', user.id).maybeSingle();
        const { data: userRole } = await supabase.from('user_roles').select('tenant_id').eq('user_id', user.id).maybeSingle();
        const userTenantId = platformUser?.tenant_id || userRole?.tenant_id;
        if (platformUser?.platform_role === 'platform_admin') {
          toast({ title: t('pages.auth.loginSuccess'), description: t('pages.auth.welcomeAdmin') });
          setPendingRedirect('/platform-admin');
          return;
        }
        if (!userTenantId) {
          await supabase.auth.signOut();
          toast({ title: t('pages.auth.loginFailed'), description: t('pages.auth.wrongCredentials'), variant: 'destructive' });
          setLoading(false);
          return;
        }
        const { data: tenant, error: tenantError } = await supabase.from('tenants').select('id, subdomain, status').eq('id', userTenantId).maybeSingle();
        if (tenantError || !tenant) {
          await supabase.auth.signOut();
          toast({ title: t('pages.auth.loginFailed'), description: t('pages.auth.wrongCredentials'), variant: 'destructive' });
          setLoading(false);
          return;
        }
        if (tenant.status === 'locked') {
          await supabase.auth.signOut();
          toast({ title: t('pages.auth.storeLocked'), description: t('pages.auth.storeLockedDesc'), variant: 'destructive' });
          setLoading(false);
          return;
        }
        const inputStoreId = storeId.toLowerCase().trim();
        if (tenant.subdomain !== inputStoreId) {
          await supabase.auth.signOut();
          toast({ title: t('pages.auth.loginFailed'), description: t('pages.auth.wrongCredentials'), variant: 'destructive' });
          setLoading(false);
          return;
        }
      }
      toast({ title: t('pages.auth.loginSuccess'), description: t('pages.auth.welcomeBack') });
      setPendingRedirect('/');
    } catch (error: any) {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md shadow-xl relative">
        <CardHeader className="text-center">
          {!isSubdomainMode && (
            <Button variant="ghost" size="sm" className="absolute left-4 top-4" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4 mr-1" />{t('pages.auth.homePage')}
            </Button>
          )}
          <div className="flex justify-center mb-4 pt-6">
            <img src={vkhoLogo} alt="VKho Logo" className="h-20 w-20 object-contain" />
          </div>
          <CardTitle className="text-2xl">
            {isSubdomainMode && resolvedTenant.tenantName ? resolvedTenant.tenantName : t('pages.auth.title')}
          </CardTitle>
          <CardDescription>
            {isSubdomainMode ? t('pages.auth.loginDescSub') : t('pages.auth.loginDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleLogin} className="space-y-4">
            {!isSubdomainMode && (
              <div className="space-y-2">
                <Label htmlFor="store-id">{t('pages.auth.storeId')}</Label>
                <div className="flex items-center gap-0">
                  <Input id="store-id" type="text" placeholder={t('pages.auth.storeIdPlaceholder')} value={storeId} onChange={(e) => setStoreId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} className="rounded-r-none border-r-0" required />
                  <span className="inline-flex items-center px-3 h-10 border border-l-0 rounded-r-md bg-muted text-muted-foreground text-sm">.vkho.vn</span>
                </div>
                <p className="text-xs text-muted-foreground">{t('pages.auth.storeIdHint')}</p>
              </div>
            )}
            {isSubdomainMode && (
              <div className="bg-muted p-3 rounded-lg text-center">
                <p className="text-sm text-muted-foreground">{t('pages.auth.loggingInTo')}</p>
                <p className="font-mono font-semibold text-primary">{resolvedTenant.subdomain}.vkho.vn</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="login-email">{t('pages.auth.email')}</Label>
              <Input id="login-email" type="email" placeholder="email@example.com" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="login-password">{t('pages.auth.password')}</Label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">{t('pages.auth.forgotPassword')}</Link>
              </div>
              <Input id="login-password" type="password" placeholder="••••••••" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('pages.auth.login')}
            </Button>
            {!isSubdomainMode && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">{t('pages.auth.noAccount')}</span></div>
                </div>
                <Button variant="outline" className="w-full" asChild>
                  <Link to="/register">{t('pages.auth.registerBusiness')}</Link>
                </Button>
              </>
            )}
          </form>
          {!isSubdomainMode && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">{t('pages.auth.noAccount')}</span></div>
              </div>
              <Button variant="outline" className="w-full" asChild>
                <Link to="/register">{t('pages.auth.registerBusiness')}</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
