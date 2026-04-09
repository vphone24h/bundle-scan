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
  const queryClient = useQueryClient();

  const [storeName, setStoreName] = useState('');
  const [storePhone, setStorePhone] = useState('');
  const [storeSubdomain, setStoreSubdomain] = useState('');
  const [storeEmail, setStoreEmail] = useState('');
  const [language, setLanguage] = useState(i18n.language);
  const [saving, setSaving] = useState(false);

  const isSuperAdmin = permissions?.role === 'super_admin';

  useEffect(() => {
    if (tenant) {
      setStoreName(tenant.name || '');
      setStorePhone(tenant.phone || '');
      setStoreSubdomain(tenant.subdomain || '');
      setStoreEmail(tenant.email || '');
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
      const changedFields: string[] = [];

      // Validate subdomain if changed
      if (storeSubdomain !== tenant.subdomain) {
        const subdomainRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
        if (storeSubdomain.length < 2 || !subdomainRegex.test(storeSubdomain)) {
          toast({ title: 'ID cửa hàng chỉ chứa chữ thường, số và dấu gạch ngang (tối thiểu 2 ký tự)', variant: 'destructive' });
          setSaving(false);
          return;
        }
        const { data: isDuplicate } = await supabase.rpc('check_tenant_unique_field', {
          _field: 'subdomain',
          _value: storeSubdomain,
          _exclude_tenant_id: tenant.id,
        });
        if (isDuplicate) {
          toast({ title: 'ID cửa hàng đã tồn tại trong hệ thống', description: 'Vui lòng chọn ID khác.', variant: 'destructive' });
          setSaving(false);
          return;
        }
        changedFields.push('ID cửa hàng');
      }

      // Validate email uniqueness if changed
      const newEmail = storeEmail.trim();
      if (newEmail && newEmail !== (tenant.email || '')) {
        const { data: isDuplicateEmail } = await supabase.rpc('check_tenant_unique_field', {
          _field: 'email',
          _value: newEmail,
          _exclude_tenant_id: tenant.id,
        });
        if (isDuplicateEmail) {
          toast({ title: 'Email đã được sử dụng bởi cửa hàng khác trong hệ thống', description: 'Vui lòng dùng email khác.', variant: 'destructive' });
          setSaving(false);
          return;
        }
        changedFields.push('Email');
      }

      const { error } = await supabase
        .from('tenants')
        .update({ 
          name: storeName, 
          phone: storePhone,
          subdomain: storeSubdomain.trim().toLowerCase(),
          email: newEmail || null,
        })
        .eq('id', tenant.id);

      if (error) throw error;

      // Đồng bộ email đăng nhập (auth) khi email cửa hàng thay đổi
      if (newEmail && newEmail !== (tenant.email || '')) {
        const { error: authError } = await supabase.auth.updateUser({ email: newEmail });
        if (authError) {
          console.warn('Could not update auth email:', authError.message);
          toast({ 
            title: 'Email cửa hàng đã lưu, nhưng email đăng nhập chưa cập nhật được', 
            description: authError.message,
            variant: 'destructive' 
          });
        } else {
          toast({ 
            title: 'Đã gửi email xác nhận', 
            description: `Vui lòng kiểm tra hộp thư ${newEmail} để xác nhận. Sau khi xác nhận, lần đăng nhập sau hãy dùng email mới.`,
          });
        }
      }

      const normalizedSubdomain = storeSubdomain.trim().toLowerCase();
      const normalizedEmail = newEmail || null;

      queryClient.setQueriesData({ queryKey: ['current-tenant-combined'] }, (old: any) => {
        if (!old || old.id !== tenant.id) return old;
        return {
          ...old,
          name: storeName,
          phone: storePhone,
          subdomain: normalizedSubdomain,
          email: normalizedEmail,
        };
      });

      queryClient.setQueriesData({ queryKey: ['all-tenants'] }, (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((item: any) =>
          item.id === tenant.id
            ? {
                ...item,
                name: storeName,
                phone: storePhone,
                subdomain: normalizedSubdomain,
                email: normalizedEmail,
              }
            : item
        );
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['current-tenant-combined'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['all-tenants'], refetchType: 'all' }),
      ]);

      // Thông báo rõ ràng khi đổi thông tin đăng nhập
      if (changedFields.length > 0) {
        toast({ 
          title: '✅ Đã lưu thành công', 
          description: `Đã thay đổi: ${changedFields.join(', ')}. Lần đăng nhập sau vui lòng sử dụng thông tin mới.`,
        });
      } else {
        toast({ title: t('settings.saved') });
      }
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
              <Label>ID cửa hàng (subdomain)</Label>
              <Input 
                value={storeSubdomain} 
                onChange={e => setStoreSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="vd: cuahang123"
              />
              <p className="text-xs text-muted-foreground">Dùng để đăng nhập và truy cập website. Chỉ chữ thường, số, gạch ngang.</p>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input 
                type="email"
                value={storeEmail} 
                onChange={e => setStoreEmail(e.target.value)}
                placeholder="email@example.com"
              />
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
