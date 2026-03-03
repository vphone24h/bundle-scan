import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import vkhoLogo from '@/assets/vkho-logo.png';
import { useTranslation } from 'react-i18next';

export default function PlatformAuthPage() {
  const { t } = useTranslation();
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
          title: t('pages.platformAuth.loginFailed'),
          description: error.message === 'Invalid login credentials' 
            ? t('pages.platformAuth.wrongCredentials')
            : error.message,
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

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
            title: t('pages.platformAuth.noAccess'),
            description: t('pages.platformAuth.notAdmin'),
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }

        toast({
          title: t('pages.platformAuth.loginSuccess'),
          description: t('pages.platformAuth.welcomeAdmin'),
        });
        navigate('/platform-admin');
      }
    } catch (error: any) {
      toast({
        title: t('pages.platformAuth.error'),
        description: error.message || t('pages.platformAuth.loginError'),
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
            <img 
              src={vkhoLogo} 
              alt="VKho Logo" 
              className="h-20 w-20 object-contain"
            />
          </div>
          <CardTitle className="text-2xl">{t('pages.platformAuth.title')}</CardTitle>
          <CardDescription>{t('pages.platformAuth.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-email">{t('pages.platformAuth.email')}</Label>
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
              <Label htmlFor="admin-password">{t('pages.platformAuth.password')}</Label>
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
              {t('pages.platformAuth.loginBtn')}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                {t('pages.platformAuth.or')}
              </span>
            </div>
          </div>

          <Button variant="outline" className="w-full" asChild>
            <Link to="/auth">
              {t('pages.platformAuth.loginAsUser')}
            </Link>
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            {t('pages.platformAuth.adminOnly')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
