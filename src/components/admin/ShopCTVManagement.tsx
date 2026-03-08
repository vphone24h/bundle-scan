import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Users, Settings, ShoppingBag, Wallet, Plus,
  Lock, Unlock, Loader2, Search,
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
  const { data: orders } = useShopCTVOrders(currentTenantId);

  const [searchQuery, setSearchQuery] = useState('');
  const [addCTVOpen, setAddCTVOpen] = useState(false);
  const [addForm, setAddForm] = useState({ full_name: '', phone: '', email: '', commission_rate: '' });
  const [rejectOpen, setRejectOpen] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Settings form
  const [settingsForm, setSettingsForm] = useState<any>(null);
  const activeSettings = settingsForm || settings || {};

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
    });
    setSettingsForm(null);
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
          <TabsTrigger value="orders"><ShoppingBag className="h-4 w-4 mr-1" />Đơn hàng</TabsTrigger>
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

        {/* Orders */}
        <TabsContent value="orders" className="mt-4">
          <Card>
            <CardContent className="pt-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ngày</TableHead>
                    <TableHead>CTV</TableHead>
                    <TableHead>Khách</TableHead>
                    <TableHead>Nguồn</TableHead>
                    <TableHead className="text-right">Đơn hàng</TableHead>
                    <TableHead className="text-right">Hoa hồng</TableHead>
                    <TableHead className="text-center">TT</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(orders || []).map((o: any) => (
                    <TableRow key={o.id}>
                      <TableCell className="text-xs">{format(new Date(o.created_at), 'dd/MM/yy', { locale: vi })}</TableCell>
                      <TableCell className="text-xs font-mono">{o.shop_collaborators?.ctv_code}</TableCell>
                      <TableCell className="text-sm">{o.customer_name || '-'}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{o.source === 'link' ? 'Link' : 'Mã'}</Badge></TableCell>
                      <TableCell className="text-right">{formatNumber(o.order_amount)}</TableCell>
                      <TableCell className="text-right text-green-600">{formatNumber(o.commission_amount)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={o.status === 'approved' ? 'default' : o.status === 'paid' ? 'outline' : 'secondary'} className="text-[10px]">
                          {o.status === 'pending' ? 'Chờ' : o.status === 'approved' ? 'Duyệt' : o.status === 'paid' ? 'Đã trả' : 'Hủy'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!orders?.length && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">Chưa có đơn hàng</TableCell>
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

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Hoa hồng mặc định (%)</Label>
                  <Input
                    type="number"
                    value={activeSettings.default_commission_rate ?? 5}
                    onChange={e => updateField('default_commission_rate', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Loại hoa hồng</Label>
                  <Select value={activeSettings.default_commission_type || 'percentage'} onValueChange={v => updateField('default_commission_type', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Phần trăm (%)</SelectItem>
                      <SelectItem value="fixed">Cố định (VND)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
                  <Input
                    type="number"
                    value={activeSettings.min_withdrawal_amount ?? 200000}
                    onChange={e => updateField('min_withdrawal_amount', e.target.value)}
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
              <Label>Email</Label>
              <Input value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} />
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
