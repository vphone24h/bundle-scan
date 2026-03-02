import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCurrentTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Settings, Globe, Store, Save } from 'lucide-react';

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { data: tenant } = useCurrentTenant();

  const [storeName, setStoreName] = useState('');
  const [storePhone, setStorePhone] = useState('');
  const [language, setLanguage] = useState(i18n.language);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (tenant) {
      setStoreName(tenant.name || '');
      setStorePhone(tenant.phone || '');
    }
  }, [tenant]);

  const handleLanguageChange = (lng: string) => {
    setLanguage(lng);
    i18n.changeLanguage(lng);
    localStorage.setItem('app_language', lng);
  };

  const handleSave = async () => {
    if (!tenant) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('tenants')
        .update({ name: storeName, phone: storePhone })
        .eq('id', tenant.id);

      if (error) throw error;
      toast({ title: t('settings.saved') });
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainLayout>
      <PageHeader title={t('settings.title')} description={t('settings.description')} />
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-2xl">
        {/* Store Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Store className="h-5 w-5 text-primary" />
              {t('settings.storeInfo')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('settings.storeName')}</Label>
              <Input value={storeName} onChange={e => setStoreName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('settings.storePhone')}</Label>
              <Input value={storePhone} onChange={e => setStorePhone(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* App Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-5 w-5 text-primary" />
              {t('settings.appSettings')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('settings.language')}</Label>
              <p className="text-xs text-muted-foreground">{t('settings.languageDesc')}</p>
              <Select value={language} onValueChange={handleLanguageChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vi">🇻🇳 {t('settings.vietnamese')}</SelectItem>
                  <SelectItem value="en">🇬🇧 {t('settings.english')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
          <Save className="h-4 w-4 mr-2" />
          {t('settings.save')}
        </Button>
      </div>
    </MainLayout>
  );
}
