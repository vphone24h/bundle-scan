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
import { validateTenantCompany } from '@/lib/companyHelpers';
import { useCompany } from '@/hooks/useCompanyResolver';
import { useCompanySettings } from '@/hooks/useCompanySettings';

const CURRENT_STORE_ID_KEY = 'current_store_id';

export default function AuthPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { signOut, user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  
  const resolvedTenant = useTenantResolver();
  const isSubdomainMode = resolvedTenant.status === 'resolved' && resolvedTenant.subdomain;
  const company = useCompany();
  const { data: companySettings } = useCompanySettings();
  const companyLogo = companySettings?.logo_url;
  const companyDomain = company.domain || 'vkho.vn';

  const [storeId, setStoreId] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const waitForSessionReady = async (userId: string) => {
    for (let attempt = 0; attempt < 8; attempt++) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id === userId) return session;
      await new Promise((resolve) => window.setTimeout(resolve, 120));
    }
    throw new Error('Phiên đăng nhập chưa sẵn sàng. Vui lòng thử lại.');
  };
  
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
        if (platformUser?.platform_role === 'platform_admin' || platformUser?.platform_role === 'company_admin') return;
        const { data: userRole } = await supabase.from('user_roles').select('tenant_id').eq('user_id', user.id).maybeSingle();
        const userTenantId = platformUser?.tenant_id || userRole?.tenant_id;
        if (!userTenantId) return;
        const { data: tenant } = await supabase.from('tenants').select('subdomain').eq('id', userTenantId).maybeSingle();
        if (tenant?.subdomain && tenant.subdomain !== desiredStoreId) {
          await signOut();
          toast({ title: t('pages.auth.switchedStore'), description: t('pages.auth.switchedStoreDesc'), variant: 'destructive' });
          setLoading(false);
        }
      } catch { }
    };
    check();
  }, [user?.id, authLoading, storeId, isSubdomainMode, signOut, t]);


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const inputStoreId = storeId.toLowerCase().trim();
      localStorage.setItem(CURRENT_STORE_ID_KEY, inputStoreId);
      
      const { error, data: signInData } = await supabase.auth.signInWithPassword({ 
        email: loginEmail, 
        password: loginPassword 
      });
      if (error) {
        toast({ title: t('pages.auth.loginFailed'), description: t('pages.auth.wrongCredentials'), variant: 'destructive' });
        setLoading(false);
        return;
      }
      
      const loggedInUser = signInData.user;
      if (!loggedInUser) {
        setLoading(false);
        return;
      }

      await waitForSessionReady(loggedInUser.id);

      // Parallel queries instead of sequential
      const [platformRes, roleRes] = await Promise.all([
        supabase.from('platform_users').select('tenant_id, platform_role').eq('user_id', loggedInUser.id).maybeSingle(),
        supabase.from('user_roles').select('tenant_id').eq('user_id', loggedInUser.id).maybeSingle(),
      ]);

      const platformUser = platformRes.data;
      const userRole = roleRes.data;
      const userTenantId = platformUser?.tenant_id || userRole?.tenant_id;

      // Fire-and-forget cảnh báo đăng nhập
      sendLoginAlert(loggedInUser.id, loggedInUser.email ?? loginEmail, userTenantId ?? null);

      if (platformUser?.platform_role === 'platform_admin' || platformUser?.platform_role === 'company_admin') {
        toast({ title: t('pages.auth.loginSuccess'), description: t('pages.auth.welcomeAdmin') });
        navigate('/platform-admin', { replace: true });
        return;
      }

      if (!userTenantId) {
        await supabase.auth.signOut({ scope: 'local' });
        toast({ title: t('pages.auth.loginFailed'), description: t('pages.auth.wrongCredentials'), variant: 'destructive' });
        setLoading(false);
        return;
      }

      const { data: tenant } = await supabase.from('tenants').select('id, subdomain, status, company_id').eq('id', userTenantId).maybeSingle();
      
      if (!tenant) {
        await supabase.auth.signOut({ scope: 'local' });
        toast({ title: t('pages.auth.loginFailed'), description: t('pages.auth.wrongCredentials'), variant: 'destructive' });
        setLoading(false);
        return;
      }
      if (tenant.status === 'locked') {
        await supabase.auth.signOut({ scope: 'local' });
        toast({ title: t('pages.auth.storeLocked'), description: t('pages.auth.storeLockedDesc'), variant: 'destructive' });
        setLoading(false);
        return;
      }
      if (tenant.subdomain !== inputStoreId) {
        await supabase.auth.signOut({ scope: 'local' });
        toast({ title: t('pages.auth.loginFailed'), description: t('pages.auth.wrongCredentials'), variant: 'destructive' });
        setLoading(false);
        return;
      }

      // Company validation: ensure tenant belongs to current company/domain
      const isValidCompany = await validateTenantCompany(userTenantId);
      if (!isValidCompany) {
        await supabase.auth.signOut({ scope: 'local' });
        toast({ title: t('pages.auth.loginFailed'), description: 'Tài khoản không thuộc hệ thống này.', variant: 'destructive' });
        setLoading(false);
        return;
      }

      toast({ title: t('pages.auth.loginSuccess'), description: t('pages.auth.welcomeBack') });
      navigate('/', { replace: true });
    } catch (error: any) {
      const { translateAuthError } = await import('@/lib/authErrors');
      toast({ title: t('common.error'), description: translateAuthError(error, t('pages.auth.wrongCredentials')), variant: 'destructive' });
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
            <img src={companyLogo || vkhoLogo} alt="Logo" className="h-20 w-20 object-contain" />
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
                  <span className="inline-flex items-center px-3 h-10 border border-l-0 rounded-r-md bg-muted text-muted-foreground text-sm">.{companyDomain}</span>
                </div>
                <p className="text-xs text-muted-foreground">{t('pages.auth.storeIdHint')}</p>
              </div>
            )}
            {isSubdomainMode && (
              <div className="bg-muted p-3 rounded-lg text-center">
                <p className="text-sm text-muted-foreground">{t('pages.auth.loggingInTo')}</p>
                <p className="font-mono font-semibold text-primary">{resolvedTenant.subdomain}.{companyDomain}</p>
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
