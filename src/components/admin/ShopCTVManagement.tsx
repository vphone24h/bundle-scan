import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { PriceInput } from '@/components/ui/price-input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Users, Settings, Wallet, Plus, Mail,
  Lock, Unlock, Loader2, Search, Trash2, Send, CheckCircle, XCircle, RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { formatNumber } from '@/lib/formatNumber';
import { useCurrentTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  useShopCTVSettings, useUpdateShopCTVSettings,
  useShopCTVList, useUpdateShopCTV, useCreateShopCTV,
  useShopCTVWithdrawals, useProcessCTVWithdrawal,
} from '@/hooks/useShopCTV';

// ===== CTV Email Variables =====
const CTV_EMAIL_VARIABLES = [
  { key: '{{ctv_name}}', label: 'Tên CTV' },
  { key: '{{ctv_code}}', label: 'Mã CTV' },
  { key: '{{ctv_phone}}', label: 'SĐT CTV' },
  { key: '{{store_name}}', label: 'Tên cửa hàng' },
];

export function ShopCTVManagement() {
  const { data: tenant } = useCurrentTenant();
  const currentTenantId = tenant?.id || null;
  const { data: settings, isLoading: settingsLoading } = useShopCTVSettings(currentTenantId);
  const updateSettings = useUpdateShopCTVSettings();
  const { data: ctvList } = useShopCTVList(currentTenantId);
  const updateCTV = useUpdateShopCTV();
  const createCTV = useCreateShopCTV();
  const { data: withdrawals } = useShopCTVWithdrawals(currentTenantId);
  const processWithdrawal = useProcessCTVWithdrawal();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [addCTVOpen, setAddCTVOpen] = useState(false);
  const [addForm, setAddForm] = useState({ full_name: '', phone: '', email: '', commission_rate: '' });
  const [rejectOpen, setRejectOpen] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Multi-select for email
  const [selectedCTVIds, setSelectedCTVIds] = useState<Set<string>>(new Set());
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailContent, setEmailContent] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  // Email history
  const [logStatusFilter, setLogStatusFilter] = useState<'all' | 'sent' | 'failed'>('all');
  const { data: emailLogs, isLoading: logsLoading } = useQuery({
    queryKey: ['ctv-email-logs', currentTenantId],
    enabled: !!currentTenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_automation_logs' as any)
        .select('*')
        .eq('tenant_id', currentTenantId!)
        .eq('source', 'ctv_bulk')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Settings form
  const [settingsForm, setSettingsForm] = useState<any>(null);
  const activeSettings = settingsForm || settings || {};

  const defaultTiers = [
    { threshold: 1000000, rate: 15, type: 'percentage' },
    { threshold: 3000000, rate: 12, type: 'percentage' },
    { threshold: 5000000, rate: 10, type: 'percentage' },
    { threshold: 10000000, rate: 200000, type: 'fixed' },
    { threshold: null, rate: 500000, type: 'fixed' },
  ];

  const defaultF1Tiers = [
    { threshold: 3000000, rate: 100000, type: 'fixed' },
    { threshold: null, rate: 300000, type: 'fixed' },
  ];

  const commissionTiers = activeSettings.commission_tiers || defaultTiers;
  const f1CommissionTiers = activeSettings.f1_commission_tiers && (activeSettings.f1_commission_tiers as any[]).length > 0
    ? activeSettings.f1_commission_tiers
    : defaultF1Tiers;

  const handleSaveSettings = async () => {
    await updateSettings.mutateAsync({
      tenantId: currentTenantId,
      is_enabled: activeSettings.is_enabled ?? false,
      default_commission_rate: parseFloat(activeSettings.default_commission_rate) || 5,
      default_commission_type: activeSettings.default_commission_type || 'percentage',
      f1_commission_rate: parseFloat(activeSettings.f1_commission_rate) || 0,
      f1_commission_type: activeSettings.f1_commission_type || 'percentage',
      cookie_tracking_days: parseInt(activeSettings.cookie_tracking_days) || 30,
      min_withdrawal_amount: parseFloat(activeSettings.min_withdrawal_amount) || 200000,
      allow_self_register: activeSettings.allow_self_register ?? true,
      auto_approve_ctv: activeSettings.auto_approve_ctv ?? true,
      program_description: activeSettings.program_description || '',
      commission_tiers: commissionTiers,
      f1_commission_tiers: f1CommissionTiers,
      commission_threshold: commissionTiers[0]?.threshold || 5000000,
      low_commission_rate: commissionTiers[0]?.rate || 10,
      low_commission_type: commissionTiers[0]?.type || 'percentage',
      high_commission_rate: commissionTiers[commissionTiers.length - 1]?.rate || 200000,
      high_commission_type: commissionTiers[commissionTiers.length - 1]?.type || 'fixed',
    });
    setSettingsForm(null);
  };

  const updateTier = (index: number, field: string, value: any) => {
    const newTiers = [...commissionTiers];
    newTiers[index] = { ...newTiers[index], [field]: value };
    updateField('commission_tiers', newTiers);
  };

  const addTier = () => {
    const lastThreshold = commissionTiers.filter((t: any) => t.threshold).pop()?.threshold || 5000000;
    const newTiers = [...commissionTiers];
    const insertIdx = newTiers.length > 0 && newTiers[newTiers.length - 1].threshold === null
      ? newTiers.length - 1
      : newTiers.length;
    newTiers.splice(insertIdx, 0, { threshold: lastThreshold + 5000000, rate: 8, type: 'percentage' });
    updateField('commission_tiers', newTiers);
  };

  const removeTier = (index: number) => {
    if (commissionTiers.length <= 2) return;
    const newTiers = commissionTiers.filter((_: any, i: number) => i !== index);
    updateField('commission_tiers', newTiers);
  };

  // F1 tier helpers
  const updateF1Tier = (index: number, field: string, value: any) => {
    const newTiers = [...f1CommissionTiers];
    newTiers[index] = { ...newTiers[index], [field]: value };
    updateField('f1_commission_tiers', newTiers);
  };

  const addF1Tier = () => {
    const lastThreshold = f1CommissionTiers.filter((t: any) => t.threshold).pop()?.threshold || 3000000;
    const newTiers = [...f1CommissionTiers];
    const insertIdx = newTiers.length > 0 && newTiers[newTiers.length - 1].threshold === null
      ? newTiers.length - 1
      : newTiers.length;
    newTiers.splice(insertIdx, 0, { threshold: lastThreshold + 5000000, rate: 100000, type: 'fixed' });
    updateField('f1_commission_tiers', newTiers);
  };

  const removeF1Tier = (index: number) => {
    if (f1CommissionTiers.length <= 2) return;
    const newTiers = f1CommissionTiers.filter((_: any, i: number) => i !== index);
    updateField('f1_commission_tiers', newTiers);
  };

  const updateField = (field: string, value: any) => {
    setSettingsForm((prev: any) => ({ ...(prev || settings || {}), [field]: value }));
  };

  const filteredCTVs = (ctvList || []).filter((c: any) =>
    !searchQuery ||
    c.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone?.includes(searchQuery) ||
    c.ctv_code?.includes(searchQuery.toUpperCase())
  );

  // Stats
  const totalCTV = ctvList?.length || 0;
  const totalRevenue = ctvList?.reduce((s: number, c: any) => s + (c.total_revenue || 0), 0) || 0;
  const totalCommission = ctvList?.reduce((s: number, c: any) => s + (c.total_commission || 0), 0) || 0;
  const totalOrders = ctvList?.reduce((s: number, c: any) => s + (c.total_orders || 0), 0) || 0;

  // Toggle select CTV
  const toggleSelect = (id: string) => {
    setSelectedCTVIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const ctvsWithEmail = filteredCTVs.filter((c: any) => c.email);
    if (selectedCTVIds.size === ctvsWithEmail.length) {
      setSelectedCTVIds(new Set());
    } else {
      setSelectedCTVIds(new Set(ctvsWithEmail.map((c: any) => c.id)));
    }
  };

  // Send bulk email
  const handleSendEmail = async () => {
    if (!emailSubject.trim() || !emailContent.trim()) {
      toast.error('Vui lòng nhập tiêu đề và nội dung email');
      return;
    }
    setSendingEmail(true);
    try {
      const htmlContent = emailContent.replace(/\n/g, '<br/>');
      const { data, error } = await supabase.functions.invoke('send-ctv-email', {
        body: {
          ctvIds: Array.from(selectedCTVIds),
          subject: emailSubject,
          htmlContent,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Đã gửi ${data.sent}/${data.total} email${data.failed ? `, ${data.failed} thất bại` : ''}`);
      setEmailDialogOpen(false);
      setEmailSubject('');
      setEmailContent('');
      setSelectedCTVIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['ctv-email-logs'] });
    } catch (e: any) {
      toast.error('Lỗi gửi email: ' + e.message);
    } finally {
      setSendingEmail(false);
    }
  };

  // Filter logs
  const filteredLogs = (emailLogs || []).filter((l: any) =>
    logStatusFilter === 'all' ? true : l.status === logStatusFilter
  );

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Tổng CTV</p>
          <p className="text-xl font-bold">{totalCTV}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Tổng đơn</p>
          <p className="text-xl font-bold">{totalOrders}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Doanh thu CTV</p>
          <p className="text-xl font-bold">{formatNumber(totalRevenue)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Hoa hồng</p>
          <p className="text-xl font-bold">{formatNumber(totalCommission)}</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="list">
        <TabsList className="overflow-x-auto w-full justify-start">
          <TabsTrigger value="list"><Users className="h-4 w-4 mr-1" />Danh sách</TabsTrigger>
          <TabsTrigger value="email"><Mail className="h-4 w-4 mr-1" />Email</TabsTrigger>
          <TabsTrigger value="withdrawals"><Wallet className="h-4 w-4 mr-1" />Rút tiền</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="h-4 w-4 mr-1" />Cài đặt</TabsTrigger>
        </TabsList>

        {/* CTV List */}
        <TabsContent value="list" className="mt-4 space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Tìm CTV..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
            <Button size="sm" onClick={() => setAddCTVOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />Thêm CTV
            </Button>
          </div>

          <Card>
            <CardContent className="pt-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mã CTV</TableHead>
                    <TableHead>Họ tên</TableHead>
                    <TableHead>SĐT</TableHead>
                    <TableHead className="text-right">Đơn</TableHead>
                    <TableHead className="text-right">Doanh thu</TableHead>
                    <TableHead className="text-right">Hoa hồng</TableHead>
                    <TableHead className="text-center">Trạng thái</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCTVs.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">{c.ctv_code}</TableCell>
                      <TableCell className="font-medium">{c.full_name}</TableCell>
                      <TableCell className="text-sm">{c.phone || '-'}</TableCell>
                      <TableCell className="text-right">{c.total_orders}</TableCell>
                      <TableCell className="text-right">{formatNumber(c.total_revenue)}</TableCell>
                      <TableCell className="text-right">{formatNumber(c.total_commission)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={c.status === 'active' ? 'default' : c.status === 'pending' ? 'secondary' : 'destructive'}>
                          {c.status === 'active' ? 'Hoạt động' : c.status === 'pending' ? 'Chờ duyệt' : 'Khóa'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {c.status === 'active' ? (
                          <Button variant="ghost" size="icon" onClick={() => updateCTV.mutate({ id: c.id, status: 'blocked' })}>
                            <Lock className="h-4 w-4" />
                          </Button>
                        ) : c.status === 'blocked' ? (
                          <Button variant="ghost" size="icon" onClick={() => updateCTV.mutate({ id: c.id, status: 'active' })}>
                            <Unlock className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => updateCTV.mutate({ id: c.id, status: 'active' })}>
                            Duyệt
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!filteredCTVs.length && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        Chưa có CTV nào
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Tab */}
        <TabsContent value="email" className="mt-4 space-y-4">
          {/* Select CTVs to email */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Send className="h-4 w-4" />
                Gửi Email cho CTV
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Checkbox
                  checked={
                    filteredCTVs.filter((c: any) => c.email).length > 0 &&
                    selectedCTVIds.size === filteredCTVs.filter((c: any) => c.email).length
                  }
                  onCheckedChange={toggleSelectAll}
                />
                <span className="text-sm">Chọn tất cả ({filteredCTVs.filter((c: any) => c.email).length} có email)</span>
                {selectedCTVIds.size > 0 && (
                  <Badge variant="secondary">{selectedCTVIds.size} đã chọn</Badge>
                )}
                {selectedCTVIds.size > 0 && (
                  <Button size="sm" onClick={() => setEmailDialogOpen(true)}>
                    <Mail className="h-4 w-4 mr-1" />Soạn email
                  </Button>
                )}
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm CTV..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="max-h-[300px] overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Mã CTV</TableHead>
                      <TableHead>Họ tên</TableHead>
                      <TableHead>Email</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCTVs.map((c: any) => (
                      <TableRow key={c.id} className={!c.email ? 'opacity-50' : ''}>
                        <TableCell>
                          <Checkbox
                            checked={selectedCTVIds.has(c.id)}
                            onCheckedChange={() => toggleSelect(c.id)}
                            disabled={!c.email}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs">{c.ctv_code}</TableCell>
                        <TableCell className="text-sm font-medium">{c.full_name}</TableCell>
                        <TableCell className="text-xs">{c.email || <span className="text-destructive">Chưa có email</span>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Email History */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Lịch sử gửi email</CardTitle>
                <div className="flex gap-1">
                  <Button
                    variant={logStatusFilter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setLogStatusFilter('all')}
                  >
                    Tất cả
                  </Button>
                  <Button
                    variant={logStatusFilter === 'sent' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setLogStatusFilter('sent')}
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />Thành công
                  </Button>
                  <Button
                    variant={logStatusFilter === 'failed' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setLogStatusFilter('failed')}
                  >
                    <XCircle className="h-3 w-3 mr-1" />Thất bại
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {logsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : !filteredLogs.length ? (
                <p className="text-center py-8 text-muted-foreground text-sm">
                  {logStatusFilter === 'all' ? 'Chưa gửi email CTV nào' : `Không có email ${logStatusFilter === 'sent' ? 'thành công' : 'thất bại'}`}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Thời gian</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Tên CTV</TableHead>
                      <TableHead>Tiêu đề</TableHead>
                      <TableHead className="text-center">TT</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log: any) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {format(new Date(log.created_at), 'dd/MM/yy HH:mm', { locale: vi })}
                        </TableCell>
                        <TableCell className="text-xs">{log.customer_email}</TableCell>
                        <TableCell className="text-xs">{log.customer_name || '-'}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{log.subject}</TableCell>
                        <TableCell className="text-center">
                          {log.status === 'sent' ? (
                            <Badge variant="default" className="text-[10px]"><CheckCircle className="h-3 w-3 mr-0.5" />OK</Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[10px]"><XCircle className="h-3 w-3 mr-0.5" />Lỗi</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Withdrawals */}
        <TabsContent value="withdrawals" className="mt-4">
          <Card>
            <CardContent className="pt-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ngày</TableHead>
                    <TableHead>CTV</TableHead>
                    <TableHead className="text-right">Số tiền</TableHead>
                    <TableHead>Ngân hàng</TableHead>
                    <TableHead>STK</TableHead>
                    <TableHead className="text-center">TT</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(withdrawals || []).map((w: any) => (
                    <TableRow key={w.id}>
                      <TableCell className="text-xs">{format(new Date(w.created_at), 'dd/MM/yy', { locale: vi })}</TableCell>
                      <TableCell className="text-xs">{w.shop_collaborators?.full_name}</TableCell>
                      <TableCell className="text-right font-semibold">{formatNumber(w.amount)}</TableCell>
                      <TableCell className="text-xs">{w.bank_name}</TableCell>
                      <TableCell className="text-xs font-mono">{w.bank_account_number}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={w.status === 'approved' ? 'default' : w.status === 'rejected' ? 'destructive' : 'secondary'}>
                          {w.status === 'pending' ? 'Chờ' : w.status === 'approved' ? 'Đã duyệt' : 'Từ chối'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {w.status === 'pending' && (
                          <div className="flex gap-1">
                            <Button
                              size="sm" variant="default"
                              onClick={() => processWithdrawal.mutate({ id: w.id, status: 'approved' })}
                              disabled={processWithdrawal.isPending}
                            >
                              Duyệt
                            </Button>
                            <Button
                              size="sm" variant="destructive"
                              onClick={() => { setRejectOpen(w.id); setRejectReason(''); }}
                              disabled={processWithdrawal.isPending}
                            >
                              Từ chối
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!withdrawals?.length && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">Chưa có yêu cầu</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings */}
        <TabsContent value="settings" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cài đặt chương trình CTV</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Bật chương trình CTV</Label>
                  <p className="text-xs text-muted-foreground">Cho phép CTV đăng ký và bán hàng trên website</p>
                </div>
                <Switch
                  checked={activeSettings.is_enabled ?? false}
                  onCheckedChange={v => updateField('is_enabled', v)}
                />
              </div>

              {/* Multi-tier Commission Config */}
              <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm">Cấu hình hoa hồng theo giá trị đơn</h4>
                  <Button variant="outline" size="sm" onClick={addTier}>
                    <Plus className="h-3 w-3 mr-1" />Thêm mức
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Thiết lập nhiều mức hoa hồng theo ngưỡng giá trị đơn hàng. Mỗi mức có thể tính theo % hoặc số tiền cố định.
                </p>

                <div className="space-y-3">
                  {commissionTiers.map((tier: any, index: number) => {
                    const prevThreshold = index > 0 ? commissionTiers[index - 1]?.threshold : 0;
                    const isLast = tier.threshold === null;
                    const label = isLast
                      ? `Trên ${formatNumber(prevThreshold || 0)}đ`
                      : index === 0
                        ? `Dưới ${formatNumber(tier.threshold)}đ`
                        : `${formatNumber(prevThreshold)}đ - ${formatNumber(tier.threshold)}đ`;

                    return (
                      <div key={index} className="border rounded-md p-3 space-y-2 bg-background">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-semibold">{isLast ? '📈' : index === 0 ? '📉' : '📊'} {label}</Label>
                          {commissionTiers.length > 2 && (
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeTier(index)}>
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                          {!isLast && (
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">Ngưỡng (VND)</Label>
                              <PriceInput
                                value={tier.threshold || 0}
                                onChange={(v) => updateTier(index, 'threshold', v)}
                                suffix="đ"
                              />
                            </div>
                          )}
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Loại</Label>
                            <Select value={tier.type} onValueChange={(v) => updateTier(index, 'type', v)}>
                              <SelectTrigger className="h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="percentage">Phần trăm (%)</SelectItem>
                                <SelectItem value="fixed">Cố định (VND)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">
                              {tier.type === 'percentage' ? 'Hoa hồng (%)' : 'Hoa hồng (VND)'}
                            </Label>
                            {tier.type === 'percentage' ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  value={tier.rate}
                                  onChange={e => updateTier(index, 'rate', parseFloat(e.target.value) || 0)}
                                  className="flex-1"
                                />
                                <span className="text-sm text-muted-foreground">%</span>
                              </div>
                            ) : (
                              <PriceInput
                                value={tier.rate || 0}
                                onChange={(v) => updateTier(index, 'rate', v)}
                                suffix="đ"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* F1 Referral Commission Config */}
              <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
                <div>
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Hoa hồng F1 (giới thiệu CTV)
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Khi CTV A giới thiệu CTV B, mỗi đơn hàng CTV B bán được thì CTV A nhận thêm hoa hồng F1.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Loại hoa hồng F1</Label>
                    <Select
                      value={activeSettings.f1_commission_type || 'percentage'}
                      onValueChange={v => updateField('f1_commission_type', v)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Phần trăm (%)</SelectItem>
                        <SelectItem value="fixed">Cố định (VND)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">
                      {(activeSettings.f1_commission_type || 'percentage') === 'percentage' ? 'Tỷ lệ F1 (%)' : 'Hoa hồng F1 (VND)'}
                    </Label>
                    {(activeSettings.f1_commission_type || 'percentage') === 'percentage' ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          value={activeSettings.f1_commission_rate ?? 0}
                          onChange={e => updateField('f1_commission_rate', parseFloat(e.target.value) || 0)}
                          className="flex-1 h-9"
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                    ) : (
                      <PriceInput
                        value={activeSettings.f1_commission_rate ?? 0}
                        onChange={v => updateField('f1_commission_rate', v)}
                        suffix="đ"
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Cookie tracking (ngày)</Label>
                  <Input
                    type="number"
                    value={activeSettings.cookie_tracking_days ?? 30}
                    onChange={e => updateField('cookie_tracking_days', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rút tiền tối thiểu (VND)</Label>
                  <PriceInput
                    value={activeSettings.min_withdrawal_amount ?? 200000}
                    onChange={v => updateField('min_withdrawal_amount', v)}
                    suffix="đ"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Cho phép CTV tự đăng ký</Label>
                  <p className="text-xs text-muted-foreground">CTV có thể tự đăng ký qua website</p>
                </div>
                <Switch
                  checked={activeSettings.allow_self_register ?? true}
                  onCheckedChange={v => updateField('allow_self_register', v)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Tự động duyệt CTV</Label>
                  <p className="text-xs text-muted-foreground">CTV được kích hoạt ngay khi đăng ký</p>
                </div>
                <Switch
                  checked={activeSettings.auto_approve_ctv ?? true}
                  onCheckedChange={v => updateField('auto_approve_ctv', v)}
                />
              </div>

              <div className="space-y-2">
                <Label>Mô tả chương trình</Label>
                <Textarea
                  value={activeSettings.program_description || ''}
                  onChange={e => updateField('program_description', e.target.value)}
                  placeholder="Mô tả chương trình CTV sẽ hiển thị trên trang đăng ký..."
                  rows={3}
                />
              </div>

              <Button onClick={handleSaveSettings} disabled={updateSettings.isPending}>
                {updateSettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Lưu cài đặt
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add CTV Dialog */}
      <Dialog open={addCTVOpen} onOpenChange={setAddCTVOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Thêm CTV</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Họ tên *</Label>
              <Input value={addForm.full_name} onChange={e => setAddForm(f => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>SĐT</Label>
              <Input value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" />
            </div>
            <div className="space-y-2">
              <Label>Hoa hồng (%)</Label>
              <Input type="number" value={addForm.commission_rate} onChange={e => setAddForm(f => ({ ...f, commission_rate: e.target.value }))} placeholder={`Mặc định: ${settings?.default_commission_rate || 5}%`} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddCTVOpen(false)}>Hủy</Button>
            <Button
              disabled={createCTV.isPending || !addForm.full_name.trim() || !addForm.email.trim()}
              onClick={async () => {
                await createCTV.mutateAsync({
                  tenant_id: currentTenantId!,
                  full_name: addForm.full_name,
                  phone: addForm.phone || undefined,
                  email: addForm.email || undefined,
                  commission_rate: parseFloat(addForm.commission_rate) || undefined,
                });
                setAddCTVOpen(false);
                setAddForm({ full_name: '', phone: '', email: '', commission_rate: '' });
              }}
            >
              {createCTV.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Thêm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Compose Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Gửi Email cho {selectedCTVIds.size} CTV</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tiêu đề *</Label>
              <Input
                value={emailSubject}
                onChange={e => setEmailSubject(e.target.value)}
                placeholder="Tiêu đề email..."
              />
            </div>
            <div className="space-y-2">
              <Label>Nội dung *</Label>
              <Textarea
                value={emailContent}
                onChange={e => setEmailContent(e.target.value)}
                placeholder="Nội dung email..."
                rows={8}
              />
            </div>
            <div className="flex flex-wrap gap-1">
              <span className="text-xs text-muted-foreground mr-1">Biến:</span>
              {CTV_EMAIL_VARIABLES.map(v => (
                <Badge
                  key={v.key}
                  variant="outline"
                  className="cursor-pointer text-[10px] hover:bg-primary/10"
                  onClick={() => setEmailContent(prev => prev + v.key)}
                >
                  {v.key} - {v.label}
                </Badge>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>Hủy</Button>
            <Button
              onClick={handleSendEmail}
              disabled={sendingEmail || !emailSubject.trim() || !emailContent.trim()}
            >
              {sendingEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Gửi email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Withdrawal Dialog */}
      <Dialog open={!!rejectOpen} onOpenChange={() => setRejectOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Từ chối yêu cầu rút tiền</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Lý do</Label>
            <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(null)}>Hủy</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (rejectOpen) {
                  processWithdrawal.mutate({ id: rejectOpen, status: 'rejected', rejected_reason: rejectReason });
                  setRejectOpen(null);
                }
              }}
            >
              Từ chối
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
