import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { PriceInput } from '@/components/ui/price-input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Users, Settings, Wallet, Plus,
  Lock, Unlock, Loader2, Search, Trash2,
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { formatNumber } from '@/lib/formatNumber';
import { useCurrentTenant } from '@/hooks/useTenant';
import {
  useShopCTVSettings, useUpdateShopCTVSettings,
  useShopCTVList, useUpdateShopCTV, useCreateShopCTV,
  useShopCTVWithdrawals, useProcessCTVWithdrawal,
} from '@/hooks/useShopCTV';

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
  

  const [searchQuery, setSearchQuery] = useState('');
  const [addCTVOpen, setAddCTVOpen] = useState(false);
  const [addForm, setAddForm] = useState({ full_name: '', phone: '', email: '', commission_rate: '' });
  const [rejectOpen, setRejectOpen] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

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

  const commissionTiers = activeSettings.commission_tiers || defaultTiers;

  const handleSaveSettings = async () => {
    await updateSettings.mutateAsync({
      tenantId: currentTenantId,
      is_enabled: activeSettings.is_enabled ?? false,
      default_commission_rate: parseFloat(activeSettings.default_commission_rate) || 5,
      default_commission_type: activeSettings.default_commission_type || 'percentage',
      cookie_tracking_days: parseInt(activeSettings.cookie_tracking_days) || 30,
      min_withdrawal_amount: parseFloat(activeSettings.min_withdrawal_amount) || 200000,
      allow_self_register: activeSettings.allow_self_register ?? true,
      auto_approve_ctv: activeSettings.auto_approve_ctv ?? true,
      program_description: activeSettings.program_description || '',
      commission_tiers: commissionTiers,
      // Keep legacy fields in sync with first/last tier
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
    // Insert before the last "unlimited" tier
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
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => updateCTV.mutate({ id: c.id, status: 'blocked' })}
                          >
                            <Lock className="h-4 w-4" />
                          </Button>
                        ) : c.status === 'blocked' ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => updateCTV.mutate({ id: c.id, status: 'active' })}
                          >
                            <Unlock className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateCTV.mutate({ id: c.id, status: 'active' })}
                          >
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
                              size="sm"
                              variant="default"
                              onClick={() => processWithdrawal.mutate({ id: w.id, status: 'approved' })}
                              disabled={processWithdrawal.isPending}
                            >
                              Duyệt
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
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
              disabled={createCTV.isPending || !addForm.full_name.trim()}
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
