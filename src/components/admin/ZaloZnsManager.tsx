import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenant } from '@/hooks/useTenant';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchInput } from '@/components/ui/search-input';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  MessageCircle, Plus, Trash2, RefreshCw, Loader2, Send, CheckCircle2,
  AlertTriangle, Eye, EyeOff, ExternalLink, Unplug, Zap, Shield, Key, Settings, FileText, History
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { toast } from 'sonner';

const EVENT_TYPES = [
  { value: 'ORDER_CREATED', label: 'Tạo đơn hàng' },
  { value: 'ORDER_SHIPPED', label: 'Đang giao hàng' },
  { value: 'ORDER_COMPLETED', label: 'Hoàn tất đơn' },
  { value: 'EXPORT_CREATED', label: 'Xuất hàng (bán)' },
  { value: 'WARRANTY_REMINDER', label: 'Nhắc bảo hành' },
];

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  sent: { label: 'Đã gửi', className: 'bg-green-100 text-green-700' },
  success: { label: 'Thành công', className: 'bg-green-100 text-green-700' },
  failed: { label: 'Lỗi', className: 'bg-red-100 text-red-700' },
  error: { label: 'Lỗi', className: 'bg-red-100 text-red-700' },
  pending: { label: 'Đang gửi', className: 'bg-yellow-100 text-yellow-700' },
  skipped: { label: 'Bỏ qua', className: 'bg-muted text-muted-foreground' },
};

// ─── Connection Tab ───
function ZaloConnectionTab({ tenantId }: { tenantId: string }) {
  const [showSecret, setShowSecret] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [testing, setTesting] = useState(false);
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['zalo-zns-config', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_landing_settings' as any)
        .select('zalo_app_id, zalo_app_secret, zalo_oa_id, zalo_access_token, zalo_refresh_token, zalo_enabled, zalo_on_export, zalo_zns_template_id, store_name, store_phone')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!tenantId,
  });

  const [formData, setFormData] = useState<any>({});

  // Sync form when settings load
  const isInitialized = useState(false);
  if (settings && !isInitialized[0]) {
    setFormData({
      zalo_app_id: settings?.zalo_app_id || '',
      zalo_app_secret: settings?.zalo_app_secret || '',
      zalo_oa_id: settings?.zalo_oa_id || '',
      zalo_on_export: settings?.zalo_on_export ?? false,
    });
    isInitialized[1](true);
  }

  const isConnected = !!settings?.zalo_oa_id && !!settings?.zalo_access_token;

  const handleConnect = async () => {
    if (!formData.zalo_app_id?.trim()) {
      toast.error('Vui lòng nhập App ID');
      return;
    }
    setConnecting(true);
    try {
      // Get OAuth URL
      const { data, error } = await supabase.functions.invoke('zalo-oauth-callback', {
        body: {
          action: 'get_oauth_url',
          app_id: formData.zalo_app_id,
          tenant_id: tenantId,
        },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);

      // Save app_id and secret first
      await supabase
        .from('tenant_landing_settings' as any)
        .update({
          zalo_app_id: formData.zalo_app_id,
          zalo_app_secret: formData.zalo_app_secret,
        })
        .eq('tenant_id', tenantId);

      // Open OAuth popup
      const popup = window.open(data.oauth_url, 'zalo-oauth', 'width=600,height=700');

      // Listen for callback
      const handler = async (event: MessageEvent) => {
        if (event.data?.type === 'zalo-oauth-callback') {
          window.removeEventListener('message', handler);
          const { code } = event.data;
          if (code) {
            const { data: exchangeData, error: exchangeErr } = await supabase.functions.invoke('zalo-oauth-callback', {
              body: {
                action: 'exchange_code',
                code,
                tenant_id: tenantId,
                app_id: formData.zalo_app_id,
                app_secret: formData.zalo_app_secret,
              },
            });
            if (exchangeErr || exchangeData?.error) {
              toast.error(exchangeData?.error || exchangeErr?.message || 'Lỗi kết nối');
            } else {
              toast.success(`✅ ${exchangeData.message || 'Kết nối thành công!'}`);
              queryClient.invalidateQueries({ queryKey: ['zalo-zns-config'] });
            }
          }
          setConnecting(false);
        }
      };
      window.addEventListener('message', handler);

      // Timeout
      setTimeout(() => {
        window.removeEventListener('message', handler);
        setConnecting(false);
      }, 120000);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi kết nối');
      setConnecting(false);
    }
  };

  const handleRefreshToken = async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('zalo-oauth-callback', {
        body: { action: 'refresh_token', tenant_id: tenantId },
      });
      if (error || data?.error) throw new Error(data?.error || data?.details || error?.message);
      toast.success('✅ Đã gia hạn token thành công!');
      queryClient.invalidateQueries({ queryKey: ['zalo-zns-config'] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setRefreshing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Bạn có chắc muốn ngắt kết nối Zalo OA?')) return;
    try {
      const { error } = await supabase.functions.invoke('zalo-oauth-callback', {
        body: { action: 'disconnect', tenant_id: tenantId },
      });
      if (error) throw error;
      toast.success('Đã ngắt kết nối Zalo OA');
      queryClient.invalidateQueries({ queryKey: ['zalo-zns-config'] });
      isInitialized[1](false);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-zalo-message', {
        body: {
          tenant_id: tenantId,
          customer_name: 'Test',
          customer_phone: settings?.store_phone || '0123456789',
          message_type: 'test',
        },
      });
      if (error) throw new Error(data?.details || error.message);
      if (data?.error) throw new Error(data.details || data.error);
      toast.success('✅ Đã gửi tin nhắn test thành công!');
    } catch (err: any) {
      toast.error('Lỗi: ' + err.message);
    } finally {
      setTesting(false);
    }
  };

  const handleToggleExport = async (checked: boolean) => {
    setFormData((p: any) => ({ ...p, zalo_on_export: checked }));
    await supabase
      .from('tenant_landing_settings' as any)
      .update({ zalo_on_export: checked })
      .eq('tenant_id', tenantId);
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      {/* Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <MessageCircle className="h-4.5 w-4.5 text-blue-500" />
          </div>
          <div>
            <p className="text-sm font-semibold">Kết nối Zalo OA</p>
            <p className="text-[11px] text-muted-foreground">Gửi ZNS tự động cho khách hàng</p>
          </div>
        </div>
        {isConnected ? (
          <Badge className="bg-green-500/10 text-green-700 border-green-500/20 gap-1">
            <CheckCircle2 className="h-3 w-3" /> Đã kết nối
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground gap-1">
            <Unplug className="h-3 w-3" /> Chưa kết nối
          </Badge>
        )}
      </div>

      {/* Instructions */}
      <div className="rounded-lg bg-muted/50 p-3 space-y-2 text-xs">
        <p className="font-medium">📋 Hướng dẫn kết nối:</p>
        <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
          <li>Truy cập{' '}
            <a href="https://developers.zalo.me" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 inline-flex items-center gap-0.5">
              developers.zalo.me <ExternalLink className="h-3 w-3" />
            </a> → Tạo ứng dụng → Copy <strong>App ID</strong> và <strong>Secret Key</strong>
          </li>
          <li>Nhập thông tin bên dưới → Nhấn <strong>"Kết nối OAuth"</strong></li>
          <li>Cấp quyền cho ứng dụng trên Zalo</li>
        </ol>
      </div>

      {/* Form */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">App ID <span className="text-destructive">*</span></Label>
          <Input
            value={formData.zalo_app_id || ''}
            onChange={e => setFormData((p: any) => ({ ...p, zalo_app_id: e.target.value }))}
            placeholder="App ID từ developers.zalo.me"
            className="text-sm font-mono"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Secret Key</Label>
          <div className="relative">
            <Input
              value={formData.zalo_app_secret || ''}
              onChange={e => setFormData((p: any) => ({ ...p, zalo_app_secret: e.target.value }))}
              placeholder="Secret Key từ developers.zalo.me"
              type={showSecret ? 'text' : 'password'}
              className="text-sm font-mono pr-10"
            />
            <button type="button" onClick={() => setShowSecret(!showSecret)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {isConnected && settings?.zalo_oa_id && (
          <div className="rounded-lg border p-2.5 space-y-1">
            <p className="text-xs"><span className="text-muted-foreground">OA ID:</span> <span className="font-mono">{settings.zalo_oa_id}</span></p>
            <p className="text-xs"><span className="text-muted-foreground">Token:</span>
              <span className="font-mono ml-1">{showToken ? settings.zalo_access_token?.slice(0, 30) + '...' : '••••••••'}</span>
              <button type="button" onClick={() => setShowToken(!showToken)} className="ml-1 text-muted-foreground hover:text-foreground">
                {showToken ? <EyeOff className="h-3 w-3 inline" /> : <Eye className="h-3 w-3 inline" />}
              </button>
            </p>
          </div>
        )}
      </div>

      <Separator />

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {!isConnected ? (
          <Button onClick={handleConnect} disabled={connecting} className="gap-1.5">
            {connecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Key className="h-3.5 w-3.5" />}
            Kết nối OAuth
          </Button>
        ) : (
          <>
            <Button variant="outline" size="sm" onClick={handleTest} disabled={testing} className="gap-1.5">
              {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Test gửi
            </Button>
            <Button variant="outline" size="sm" onClick={handleRefreshToken} disabled={refreshing} className="gap-1.5">
              {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Gia hạn token
            </Button>
            <Button variant="ghost" size="sm" onClick={handleDisconnect} className="gap-1.5 text-destructive hover:text-destructive">
              <Unplug className="h-3.5 w-3.5" /> Ngắt
            </Button>
          </>
        )}
      </div>

      {/* Auto-send settings */}
      {isConnected && (
        <>
          <Separator />
          <div className="space-y-2">
            <p className="text-xs font-semibold flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-primary" /> Tự động gửi ZNS khi:
            </p>
            <div className="flex items-center justify-between py-1">
              <Label className="text-xs">Khách đặt hàng trên website</Label>
              <Badge variant="secondary" className="text-[10px]">Luôn bật</Badge>
            </div>
            <div className="flex items-center justify-between py-1">
              <Label className="text-xs">Xuất hàng (bán hàng)</Label>
              <Switch checked={formData.zalo_on_export ?? false} onCheckedChange={handleToggleExport} />
            </div>
          </div>

          <div className="rounded-lg border border-blue-500/20 bg-blue-50/50 dark:bg-blue-900/10 p-2.5">
            <p className="text-[11px] text-blue-700 dark:text-blue-400">
              <strong>Cách gửi:</strong> Ưu tiên CS (miễn phí, cần follow) → Fallback ZNS (tính phí, không cần follow). Template ZNS cần được Zalo duyệt trước.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Templates Tab ───
function ZaloTemplatesTab({ tenantId }: { tenantId: string }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ template_id: '', template_name: '', event_type: 'ORDER_CREATED' });

  const { data: templates, isLoading } = useQuery({
    queryKey: ['zalo-zns-templates', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zalo_zns_templates' as any)
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async (values: any) => {
      if (editItem) {
        const { error } = await supabase
          .from('zalo_zns_templates' as any)
          .update({
            template_id: values.template_id,
            template_name: values.template_name,
            event_type: values.event_type,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('zalo_zns_templates' as any)
          .insert([{
            tenant_id: tenantId,
            template_id: values.template_id,
            template_name: values.template_name,
            event_type: values.event_type,
          }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editItem ? 'Đã cập nhật template' : 'Đã thêm template');
      queryClient.invalidateQueries({ queryKey: ['zalo-zns-templates'] });
      setDialogOpen(false);
      setEditItem(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('zalo_zns_templates' as any)
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['zalo-zns-templates'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('zalo_zns_templates' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Đã xóa template');
      queryClient.invalidateQueries({ queryKey: ['zalo-zns-templates'] });
    },
  });

  const openAdd = () => {
    setEditItem(null);
    setForm({ template_id: '', template_name: '', event_type: 'ORDER_CREATED' });
    setDialogOpen(true);
  };

  const openEdit = (item: any) => {
    setEditItem(item);
    setForm({ template_id: item.template_id, template_name: item.template_name, event_type: item.event_type });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Quản lý template ZNS đã được Zalo phê duyệt</p>
        <Button size="sm" onClick={openAdd} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Thêm template
        </Button>
      </div>

      <div className="rounded-lg bg-muted/50 p-2.5 text-[11px] text-muted-foreground">
        💡 Tạo template tại{' '}
        <a href="https://zns.zalo.me" target="_blank" rel="noopener noreferrer" className="text-primary underline">
          zns.zalo.me <ExternalLink className="h-3 w-3 inline" />
        </a>{' '}→ Copy Template ID → Thêm vào đây
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !templates?.length ? (
        <p className="text-center text-sm text-muted-foreground py-8">Chưa có template ZNS nào</p>
      ) : (
        <div className="border rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Template ID</TableHead>
                <TableHead className="text-xs">Tên</TableHead>
                <TableHead className="text-xs">Sự kiện</TableHead>
                <TableHead className="text-xs">Trạng thái</TableHead>
                <TableHead className="text-xs w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((t: any) => (
                <TableRow key={t.id} className="cursor-pointer" onClick={() => openEdit(t)}>
                  <TableCell className="text-xs font-mono">{t.template_id}</TableCell>
                  <TableCell className="text-xs">{t.template_name || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {EVENT_TYPES.find(e => e.value === t.event_type)?.label || t.event_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={t.is_active}
                      onCheckedChange={checked => { toggleMutation.mutate({ id: t.id, is_active: checked }); }}
                      onClick={e => e.stopPropagation()}
                    />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive"
                      onClick={e => { e.stopPropagation(); if (confirm('Xóa template này?')) deleteMutation.mutate(t.id); }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editItem ? 'Chỉnh sửa template' : 'Thêm template ZNS'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Template ID <span className="text-destructive">*</span></Label>
              <Input value={form.template_id} onChange={e => setForm(p => ({ ...p, template_id: e.target.value }))}
                placeholder="VD: 123456" className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tên template</Label>
              <Input value={form.template_name} onChange={e => setForm(p => ({ ...p, template_name: e.target.value }))}
                placeholder="VD: Xác nhận đơn hàng" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Loại sự kiện</Label>
              <Select value={form.event_type} onValueChange={v => setForm(p => ({ ...p, event_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map(e => (
                    <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Hủy</Button>
            <Button
              disabled={!form.template_id.trim() || saveMutation.isPending}
              onClick={() => saveMutation.mutate(form)}
            >
              {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              {editItem ? 'Cập nhật' : 'Thêm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Logs Tab ───
function ZaloLogsTab({ tenantId }: { tenantId: string }) {
  const [search, setSearch] = useState('');
  const [resending, setResending] = useState<string | null>(null);

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ['zalo-zns-logs', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zalo_message_logs' as any)
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!tenantId,
  });

  const filtered = (logs || []).filter(log =>
    !search ||
    log.customer_phone?.includes(search) ||
    log.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    log.message_type?.toLowerCase().includes(search.toLowerCase())
  );

  const handleResend = async (log: any) => {
    setResending(log.id);
    try {
      const { data, error } = await supabase.functions.invoke('send-zalo-message', {
        body: {
          tenant_id: log.tenant_id,
          customer_name: log.customer_name,
          customer_phone: log.customer_phone,
          message_type: log.message_type,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.details || data.error);
      toast.success('Đã gửi lại!');
      refetch();
    } catch (err: any) {
      toast.error('Gửi lại thất bại: ' + err.message);
    } finally {
      setResending(null);
    }
  };

  const stats = {
    total: logs?.length || 0,
    sent: logs?.filter(l => l.status === 'sent' || l.status === 'success').length || 0,
    failed: logs?.filter(l => l.status === 'failed' || l.status === 'error').length || 0,
  };

  return (
    <div className="space-y-3">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border p-2 text-center">
          <p className="text-lg font-bold">{stats.total}</p>
          <p className="text-[10px] text-muted-foreground">Tổng tin</p>
        </div>
        <div className="rounded-lg border p-2 text-center">
          <p className="text-lg font-bold text-green-600">{stats.sent}</p>
          <p className="text-[10px] text-muted-foreground">Thành công</p>
        </div>
        <div className="rounded-lg border p-2 text-center">
          <p className="text-lg font-bold text-red-600">{stats.failed}</p>
          <p className="text-[10px] text-muted-foreground">Lỗi</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm SĐT, tên khách..." className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !filtered.length ? (
        <p className="text-center text-sm text-muted-foreground py-8">Chưa có lịch sử gửi Zalo</p>
      ) : (
        <div className="border rounded-lg overflow-auto max-h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Thời gian</TableHead>
                <TableHead className="text-xs">Khách</TableHead>
                <TableHead className="text-xs">SĐT</TableHead>
                <TableHead className="text-xs">Loại</TableHead>
                <TableHead className="text-xs">Trạng thái</TableHead>
                <TableHead className="text-xs">Lỗi</TableHead>
                <TableHead className="text-xs w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(log => {
                const st = STATUS_BADGE[log.status] || STATUS_BADGE.pending;
                const isFailed = log.status === 'failed' || log.status === 'error';
                return (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {format(new Date(log.created_at), 'dd/MM HH:mm', { locale: vi })}
                    </TableCell>
                    <TableCell className="text-xs max-w-[100px] truncate">{log.customer_name || '-'}</TableCell>
                    <TableCell className="text-xs font-mono">{log.customer_phone}</TableCell>
                    <TableCell className="text-xs">
                      {log.message_type === 'order_confirmation' ? 'Đặt hàng' :
                       log.message_type === 'export_confirmation' ? 'Xuất hàng' :
                       log.message_type === 'test' ? 'Test' : log.message_type}
                    </TableCell>
                    <TableCell><Badge className={`text-[10px] ${st.className}`}>{st.label}</Badge></TableCell>
                    <TableCell className="text-xs text-destructive max-w-[120px] truncate">{log.error_message || '-'}</TableCell>
                    <TableCell>
                      {isFailed && (
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs"
                          disabled={resending === log.id} onClick={() => handleResend(log)}>
                          {resending === log.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ─── Main ZNS Manager ───
export function ZaloZnsManager() {
  const { data: tenant } = useCurrentTenant();
  const tenantId = tenant?.id;

  if (!tenantId) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircle className="h-4 w-4" />
          Zalo ZNS - Gửi tin tự động
        </CardTitle>
        <CardDescription>
          Kết nối Zalo OA và cấu hình gửi tin nhắn ZNS tự động cho khách hàng
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="connection" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="connection" className="flex-1 gap-1.5 text-xs">
              <Settings className="h-3.5 w-3.5" /> Kết nối
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex-1 gap-1.5 text-xs">
              <FileText className="h-3.5 w-3.5" /> Templates
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex-1 gap-1.5 text-xs">
              <History className="h-3.5 w-3.5" /> Lịch sử
            </TabsTrigger>
          </TabsList>
          <TabsContent value="connection">
            <ZaloConnectionTab tenantId={tenantId} />
          </TabsContent>
          <TabsContent value="templates">
            <ZaloTemplatesTab tenantId={tenantId} />
          </TabsContent>
          <TabsContent value="logs">
            <ZaloLogsTab tenantId={tenantId} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
