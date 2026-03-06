import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCurrentTenant } from '@/hooks/useTenant';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { toast as sonnerToast } from 'sonner';
import { Globe, Store, Save, Eye, EyeOff, QrCode } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { ImportHistoricalOrdersSection } from '@/components/admin/ImportHistoricalOrdersSection';
import { SecurityPasswordSettings } from '@/components/security/SecurityPasswordSettings';
import { DataManagementSection } from '@/components/admin/DataManagementSection';
import { cn } from '@/lib/utils';

function BusinessModeSection({ tenantId, currentMode }: { tenantId: string; currentMode: string }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState(currentMode);

  useEffect(() => {
    setMode(currentMode);
  }, [currentMode]);

  const updateMode = useMutation({
    mutationFn: async (newMode: string) => {
      const { error } = await supabase
        .from('tenants')
        .update({ business_mode: newMode } as any)
        .eq('id', tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-tenant-combined'] });
      sonnerToast.success('Đã cập nhật hình thức quản lý');
    },
    onError: () => {
      setMode(currentMode);
      sonnerToast.error('Lỗi khi cập nhật');
    },
  });

  const handleChange = (newMode: string) => {
    setMode(newMode);
    updateMode.mutate(newMode);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {mode === 'secret' ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          Hình thức quản lý
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 max-w-md">
          <label
            className={cn(
              'flex flex-col items-center gap-2 p-4 border-2 rounded-lg cursor-pointer transition-all text-center',
              mode === 'public'
                ? 'border-primary bg-primary/5'
                : 'border-muted hover:border-primary/40'
            )}
          >
            <input
              type="radio"
              name="businessMode"
              value="public"
              checked={mode === 'public'}
              onChange={() => handleChange('public')}
              className="sr-only"
            />
            <span className="text-2xl">🏪</span>
            <span className="font-medium text-sm">Công khai</span>
            <span className="text-[11px] text-muted-foreground leading-tight">Đầy đủ: thuế, HĐĐT, báo cáo thuế</span>
          </label>
          <label
            className={cn(
              'flex flex-col items-center gap-2 p-4 border-2 rounded-lg cursor-pointer transition-all text-center',
              mode === 'secret'
                ? 'border-primary bg-primary/5'
                : 'border-muted hover:border-primary/40'
            )}
          >
            <input
              type="radio"
              name="businessMode"
              value="secret"
              checked={mode === 'secret'}
              onChange={() => handleChange('secret')}
              className="sr-only"
            />
            <span className="text-2xl">🔒</span>
            <span className="font-medium text-sm">Bí mật</span>
            <span className="text-[11px] text-muted-foreground leading-tight">Ẩn thuế, HĐĐT, báo cáo thuế</span>
          </label>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Khi chọn "Bí mật", tất cả tài khoản trong cửa hàng sẽ không thấy các chức năng liên quan đến thuế và hoá đơn điện tử.
        </p>
      </CardContent>
    </Card>
  );
}

function QRPrintPromptToggle() {
  const [showPrompt, setShowPrompt] = useState(() => localStorage.getItem('hide_qr_print_prompt') !== 'true');

  const handleToggle = (checked: boolean) => {
    setShowPrompt(checked);
    if (checked) {
      localStorage.removeItem('hide_qr_print_prompt');
    } else {
      localStorage.setItem('hide_qr_print_prompt', 'true');
    }
  };

  return (
    <Card>
      <CardContent className="flex items-center justify-between py-4 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <QrCode className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-medium">Hiện mẫu in QR sau nhập hàng</p>
            <p className="text-xs text-muted-foreground">Hiện hộp thoại hỏi in tem QR sau khi thanh toán nhập hàng</p>
          </div>
        </div>
        <Switch checked={showPrompt} onCheckedChange={handleToggle} />
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { data: tenant } = useCurrentTenant();
  const { data: permissions } = usePermissions();

  const [storeName, setStoreName] = useState('');
  const [storePhone, setStorePhone] = useState('');
  const [language, setLanguage] = useState(i18n.language);
  const [saving, setSaving] = useState(false);

  const isSuperAdmin = permissions?.role === 'super_admin';

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

        {/* QR Print Prompt Toggle */}
        <QRPrintPromptToggle />

        {/* Security Password - Super Admin only */}
        {isSuperAdmin && <SecurityPasswordSettings />}

        {/* Business Mode - Super Admin only */}
        {isSuperAdmin && tenant && (
          <BusinessModeSection tenantId={tenant.id} currentMode={tenant.business_mode || 'public'} />
        )}

        {/* Data Management (Backup, Test mode, etc.) - Super Admin only */}
        {isSuperAdmin && (
          <DataManagementSection />
        )}

        {/* Historical order import - Super Admin only */}
        {isSuperAdmin && (
          <ImportHistoricalOrdersSection />
        )}
      </div>
    </MainLayout>
  );
}
