import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Bot, Image as ImageIcon, Loader2, Search, Phone, MessageCircle, Save } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface TenantAISetting {
  tenant_id: string;
  tenant_name: string;
  subdomain: string;
  ai_description_enabled: boolean;
  auto_image_enabled: boolean;
}

export function PlatformAISettings() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminZalo, setAdminZalo] = useState('');

  // Fetch admin contact info
  const { data: platformSettings } = useQuery({
    queryKey: ['platform-settings-contact'],
    queryFn: async () => {
      const { data } = await supabase
        .from('platform_settings')
        .select('id, admin_phone, admin_zalo')
        .limit(1)
        .single();
      return data as { id: string; admin_phone: string; admin_zalo: string } | null;
    },
  });

  useEffect(() => {
    if (platformSettings) {
      setAdminPhone(platformSettings.admin_phone || '');
      setAdminZalo(platformSettings.admin_zalo || '');
    }
  }, [platformSettings]);

  const saveContactMutation = useMutation({
    mutationFn: async () => {
      if (!platformSettings?.id) return;
      const { error } = await supabase
        .from('platform_settings')
        .update({ admin_phone: adminPhone, admin_zalo: adminZalo })
        .eq('id', platformSettings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-settings-contact'] });
      toast({ title: 'Đã lưu thông tin liên hệ' });
    },
    onError: () => toast({ title: 'Lỗi', variant: 'destructive' }),
  });

  const contactChanged = platformSettings && (adminPhone !== (platformSettings.admin_phone || '') || adminZalo !== (platformSettings.admin_zalo || ''));

  const { data: tenants, isLoading } = useQuery({
    queryKey: ['platform-tenant-ai-settings'],
    queryFn: async () => {
      // Get all tenants with their landing settings
      const { data: allTenants, error: tErr } = await supabase
        .from('tenants')
        .select('id, name, subdomain')
        .order('created_at', { ascending: false });
      if (tErr) throw tErr;

      const { data: settings, error: sErr } = await supabase
        .from('tenant_landing_settings' as any)
        .select('tenant_id, ai_description_enabled, auto_image_enabled');
      if (sErr) throw sErr;

      const settingsMap = new Map((settings as any[]).map((s: any) => [s.tenant_id, s]));

      return (allTenants || []).map((t): TenantAISetting => {
        const s = settingsMap.get(t.id);
        return {
          tenant_id: t.id,
          tenant_name: t.name,
          subdomain: t.subdomain,
          ai_description_enabled: s?.ai_description_enabled ?? false,
          auto_image_enabled: s?.auto_image_enabled ?? false,
        };
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ tenantId, field, value }: { tenantId: string; field: 'ai_description_enabled' | 'auto_image_enabled'; value: boolean }) => {
      // Upsert tenant_landing_settings
      const { data: existing } = await supabase
        .from('tenant_landing_settings' as any)
        .select('id')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('tenant_landing_settings' as any)
          .update({ [field]: value })
          .eq('tenant_id', tenantId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tenant_landing_settings' as any)
          .insert([{ tenant_id: tenantId, [field]: value }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-tenant-ai-settings'] });
      toast({ title: 'Đã cập nhật' });
    },
    onError: () => {
      toast({ title: 'Lỗi khi cập nhật', variant: 'destructive' });
    },
  });

  const filtered = tenants?.filter(t =>
    !search || t.tenant_name.toLowerCase().includes(search.toLowerCase()) || t.subdomain.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="h-4 w-4" />
          Cài đặt AI theo từng cửa hàng
        </CardTitle>
        <CardDescription>
          Bật/tắt tính năng AI mô tả & ảnh tự động cho từng cửa hàng — mặc định là TẮT
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Admin contact info */}
        <div className="p-3 rounded-lg border bg-muted/30 space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Thông tin liên hệ Admin (hiển thị cho cửa hàng chưa kích hoạt AI)</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1"><Phone className="h-3 w-3" /> SĐT Admin</Label>
              <Input value={adminPhone} onChange={e => setAdminPhone(e.target.value)} placeholder="0912345678" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1"><MessageCircle className="h-3 w-3" /> Zalo Admin</Label>
              <Input value={adminZalo} onChange={e => setAdminZalo(e.target.value)} placeholder="0912345678" className="h-8 text-sm" />
            </div>
          </div>
          {contactChanged && (
            <Button size="sm" onClick={() => saveContactMutation.mutate()} disabled={saveContactMutation.isPending} className="gap-1.5">
              {saveContactMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Lưu liên hệ
            </Button>
          )}
        </div>

        <Separator />

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm cửa hàng..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {filtered?.map(t => (
            <div key={t.tenant_id} className="p-3 rounded-lg border bg-card space-y-2">
              <div className="font-medium text-sm">{t.tenant_name}</div>
              <div className="text-xs text-muted-foreground">{t.subdomain}</div>
              <Separator />
              <div className="flex items-center justify-between">
                <Label className="text-xs flex items-center gap-1.5">
                  <Bot className="h-3 w-3" />
                  AI mô tả
                </Label>
                <Switch
                  checked={t.ai_description_enabled}
                  onCheckedChange={v => toggleMutation.mutate({ tenantId: t.tenant_id, field: 'ai_description_enabled', value: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs flex items-center gap-1.5">
                  <ImageIcon className="h-3 w-3" />
                  Ảnh tự động
                </Label>
                <Switch
                  checked={t.auto_image_enabled}
                  onCheckedChange={v => toggleMutation.mutate({ tenantId: t.tenant_id, field: 'auto_image_enabled', value: v })}
                />
              </div>
            </div>
          ))}
          {filtered?.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Không tìm thấy cửa hàng</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
