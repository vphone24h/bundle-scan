import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Loader2, Copy, Users, Coins, Wallet, ShoppingBag,
  ArrowLeft, Banknote, LogOut, Link2, Package, ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';
import { formatNumber } from '@/lib/formatNumber';
import {
  useMyShopCTV, useRegisterShopCTV, useMyCTVOrders,
  useMyCTVWithdrawals, useCreateCTVWithdrawal, useShopCTVSettings,
  useMyReferredCTVs,
} from '@/hooks/useShopCTV';
import { usePublicLandingProducts } from '@/hooks/useLandingProducts';
import { supabase } from '@/integrations/supabase/client';
import { VIETNAMESE_BANKS } from '@/lib/vietnameseBanks';

interface CTVDashboardProps {
  tenantId: string;
  storeName: string;
  storeUrl: string;
  accentColor?: string;
  onBack: () => void;
}

export function CTVDashboard({ tenantId, storeName, storeUrl, accentColor, onBack }: CTVDashboardProps) {
  const { data: ctv, isLoading: ctvLoading } = useMyShopCTV(tenantId);
  const { data: settings } = useShopCTVSettings(tenantId);
  const { data: orders } = useMyCTVOrders(ctv?.id);
  const { data: withdrawals } = useMyCTVWithdrawals(ctv?.id);
  const { data: referredCTVs } = useMyReferredCTVs(ctv?.id);
  const { data: products } = usePublicLandingProducts(tenantId);
  const registerCTV = useRegisterShopCTV();
  const createWithdrawal = useCreateCTVWithdrawal();

  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [selectedF1, setSelectedF1] = useState<any>(null);
  const [registerForm, setRegisterForm] = useState({ full_name: '', phone: '', referrer_code: '' });
  const [withdrawForm, setWithdrawForm] = useState({
    amount: '', bank_name: '', bank_account_number: '', bank_account_holder: '', note: '',
  });

  const handleLogout = async () => {
    localStorage.removeItem('ctv_store_mode');
    await supabase.auth.signOut();
    window.location.reload();
  };

  if (ctvLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Registration form
  if (!ctv) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto pt-8">
          <Button variant="ghost" size="sm" onClick={onBack} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />Quay lại
          </Button>

          <Card>
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                <Users className="h-5 w-5" />
                Đăng ký CTV - {storeName}
              </CardTitle>
              <CardDescription>
                Trở thành cộng tác viên và nhận hoa hồng khi giới thiệu khách hàng
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {settings?.program_description && (
                <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 text-sm">
                  {settings.program_description}
                </div>
              )}
              <div className="space-y-2">
                <Label>Họ tên *</Label>
                <Input
                  value={registerForm.full_name}
                  onChange={e => setRegisterForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder="Nguyễn Văn A"
                />
              </div>
              <div className="space-y-2">
                <Label>Số điện thoại</Label>
                <Input
                  value={registerForm.phone}
                  onChange={e => setRegisterForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="0912345678"
                />
              </div>
              <div className="space-y-2">
                <Label>Mã giới thiệu (nếu có)</Label>
                <Input
                  value={registerForm.referrer_code}
                  onChange={e => setRegisterForm(f => ({ ...f, referrer_code: e.target.value }))}
                  placeholder="CTV..."
                />
              </div>
              <Button
                className="w-full"
                disabled={registerCTV.isPending || !registerForm.full_name.trim()}
                onClick={async () => {
                  const { data: { user } } = await supabase.auth.getUser();
                  if (!user) return;
                  await registerCTV.mutateAsync({
                    tenant_id: tenantId,
                    full_name: registerForm.full_name,
                    email: user.email || '',
                    phone: registerForm.phone || undefined,
                    referrer_code: registerForm.referrer_code || undefined,
                  });
                }}
                style={accentColor ? { backgroundColor: accentColor } : {}}
              >
                {registerCTV.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Đăng ký CTV
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Pending / blocked
  if (ctv.status === 'pending') {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto pt-8 text-center">
          <Button variant="ghost" size="sm" onClick={onBack} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />Quay lại
          </Button>
          <Card>
            <CardContent className="pt-6">
              <Loader2 className="h-12 w-12 text-yellow-500 mx-auto mb-4 animate-spin" />
              <h3 className="font-semibold text-lg">Đang chờ duyệt</h3>
              <p className="text-muted-foreground text-sm mt-2">Mã CTV: {ctv.ctv_code}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (ctv.status === 'blocked') {
    return (
      <div className="min-h-screen bg-gray-50 p-4 text-center pt-20">
        <h3 className="font-semibold text-lg text-destructive">Tài khoản CTV đã bị khóa</h3>
        <Button variant="ghost" className="mt-4" onClick={onBack}>Quay lại</Button>
      </div>
    );
  }

  // Active CTV Dashboard
  const canWithdraw = ctv.available_balance >= (settings?.min_withdrawal_amount || 200000);
  const products = landingData?.products || [];

  const handleCopyLink = (path?: string) => {
    const base = storeUrl.replace(/\/$/, '');
    const link = path
      ? `${base}${path}?ref=${ctv.ctv_code}`
      : `${base}?ref=${ctv.ctv_code}`;
    navigator.clipboard.writeText(link);
    toast({ title: 'Đã sao chép link!' });
  };

  const handleWithdraw = async () => {
    await createWithdrawal.mutateAsync({
      ctv_id: ctv.id,
      tenant_id: tenantId,
      amount: parseFloat(withdrawForm.amount),
      bank_name: withdrawForm.bank_name,
      bank_account_number: withdrawForm.bank_account_number,
      bank_account_holder: withdrawForm.bank_account_holder,
      note: withdrawForm.note || undefined,
    });
    setWithdrawDialogOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-semibold text-sm">CTV Dashboard</h1>
            <p className="text-xs text-muted-foreground">{storeName} • {ctv.ctv_code}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-1" />Thoát
        </Button>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Đơn hàng</span>
              </div>
              <p className="text-xl font-bold mt-1">{ctv.total_orders || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Doanh thu</span>
              </div>
              <p className="text-xl font-bold mt-1">{formatNumber(ctv.total_revenue || 0)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Khả dụng</span>
              </div>
              <p className="text-xl font-bold mt-1" style={{ color: accentColor }}>{formatNumber(ctv.available_balance || 0)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Banknote className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Đã rút</span>
              </div>
              <p className="text-xl font-bold mt-1">{formatNumber(ctv.paid_balance || 0)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Referral link */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Link2 className="h-4 w-4" />Link giới thiệu
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                readOnly
                value={`${storeUrl}?ref=${ctv.ctv_code}`}
                className="text-xs font-mono"
              />
              <Button variant="outline" size="icon" onClick={() => handleCopyLink()}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Badge variant="outline" className="font-mono text-xs">Mã: {ctv.ctv_code}</Badge>
              <Badge variant="secondary" className="text-xs">
                Hoa hồng: {ctv.commission_type === 'percentage' ? `${ctv.commission_rate}%` : formatNumber(ctv.commission_rate)}
              </Badge>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setWithdrawForm({
                  amount: ctv.available_balance?.toString() || '',
                  bank_name: ctv.bank_name || '',
                  bank_account_number: ctv.bank_account_number || '',
                  bank_account_holder: ctv.bank_account_holder || '',
                  note: '',
                });
                setWithdrawDialogOpen(true);
              }}
              disabled={!canWithdraw}
              style={accentColor ? { backgroundColor: accentColor } : {}}
            >
              <Wallet className="mr-2 h-4 w-4" />Rút tiền
            </Button>
            {!canWithdraw && (ctv.available_balance || 0) > 0 && (
              <p className="text-xs text-muted-foreground">
                Tối thiểu: {formatNumber(settings?.min_withdrawal_amount || 200000)}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="products">
          <TabsList className="w-full">
            <TabsTrigger value="products" className="flex-1 text-xs">Sản phẩm</TabsTrigger>
            <TabsTrigger value="orders" className="flex-1 text-xs">Đơn hàng</TabsTrigger>
            <TabsTrigger value="team" className="flex-1 text-xs">Đội nhóm</TabsTrigger>
            <TabsTrigger value="withdrawals" className="flex-1 text-xs">Rút tiền</TabsTrigger>
          </TabsList>

          {/* Products with CTV links */}
          <TabsContent value="products" className="mt-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Link sản phẩm của bạn
                </CardTitle>
                <CardDescription className="text-xs">
                  Sao chép link sản phẩm có mã CTV để chia sẻ. Khi khách mua qua link, đơn sẽ tính hoa hồng cho bạn.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!products.length ? (
                  <p className="text-center text-muted-foreground text-sm py-6">Chưa có sản phẩm</p>
                ) : (
                  <div className="space-y-2">
                    {products.map((p: any) => (
                      <div key={p.id} className="flex items-center gap-3 p-3 border rounded-lg">
                        {p.image_url && (
                          <img src={p.image_url} alt={p.name} className="w-12 h-12 rounded object-cover flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{p.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.sale_price ? (
                              <><span className="line-through">{formatNumber(p.price)}</span> <span className="text-red-500 font-semibold">{formatNumber(p.sale_price)}</span></>
                            ) : (
                              formatNumber(p.price)
                            )}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-shrink-0"
                          onClick={() => handleCopyLink(`/product/${p.id}`)}
                        >
                          <Copy className="h-3 w-3 mr-1" />Link
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orders" className="mt-3">
            <Card>
              <CardContent className="pt-4">
                {!orders?.length ? (
                  <p className="text-center text-muted-foreground text-sm py-6">Chưa có đơn hàng</p>
                ) : (
                  <div className="space-y-3">
                    {orders.map((o: any) => (
                      <div key={o.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium text-sm">{o.customer_name || o.order_code}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(o.created_at), 'dd/MM/yyyy', { locale: vi })}
                            {' • '}
                            <Badge variant={o.status === 'approved' ? 'default' : o.status === 'paid' ? 'outline' : 'secondary'} className="text-[10px]">
                              {o.status === 'pending' ? 'Chờ' : o.status === 'approved' ? 'Duyệt' : o.status === 'paid' ? 'Đã trả' : 'Hủy'}
                            </Badge>
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">{formatNumber(o.order_amount)}</p>
                          <p className="text-xs text-green-600">+{formatNumber(o.commission_amount)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Referred CTVs (F1) */}
          <TabsContent value="team" className="mt-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  CTV đã giới thiệu (F1)
                </CardTitle>
                <CardDescription className="text-xs">
                  Những CTV đăng ký qua mã giới thiệu của bạn
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedF1 ? (
                  // Detail view of an F1
                  <div className="space-y-3">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedF1(null)}>
                      <ArrowLeft className="mr-1 h-3 w-3" />Quay lại
                    </Button>
                    <div className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold">{selectedF1.full_name}</h4>
                        <Badge variant={selectedF1.status === 'active' ? 'default' : 'secondary'}>
                          {selectedF1.status === 'active' ? 'Hoạt động' : selectedF1.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-muted/50 rounded-lg text-center">
                          <p className="text-xs text-muted-foreground">Đơn hàng</p>
                          <p className="text-lg font-bold">{selectedF1.total_orders || 0}</p>
                        </div>
                        <div className="p-3 bg-muted/50 rounded-lg text-center">
                          <p className="text-xs text-muted-foreground">Doanh thu</p>
                          <p className="text-lg font-bold">{formatNumber(selectedF1.total_revenue || 0)}</p>
                        </div>
                        <div className="p-3 bg-muted/50 rounded-lg text-center col-span-2">
                          <p className="text-xs text-muted-foreground">Hoa hồng</p>
                          <p className="text-lg font-bold text-green-600">{formatNumber(selectedF1.total_commission || 0)}</p>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>Mã CTV: <span className="font-mono">{selectedF1.ctv_code}</span></p>
                        {selectedF1.phone && <p>SĐT: {selectedF1.phone}</p>}
                        <p>Ngày tham gia: {format(new Date(selectedF1.created_at), 'dd/MM/yyyy', { locale: vi })}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  // List view
                  !referredCTVs?.length ? (
                    <div className="text-center py-6">
                      <Users className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-50" />
                      <p className="text-muted-foreground text-sm">Chưa có CTV nào đăng ký qua mã của bạn</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Chia sẻ mã <span className="font-mono font-semibold">{ctv.ctv_code}</span> để mời CTV mới
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {referredCTVs.map((f1: any) => (
                        <button
                          key={f1.id}
                          className="w-full flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors text-left"
                          onClick={() => setSelectedF1(f1)}
                        >
                          <div>
                            <p className="font-medium text-sm">{f1.full_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {f1.ctv_code} • {f1.total_orders || 0} đơn • {formatNumber(f1.total_revenue || 0)}
                            </p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  )
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="withdrawals" className="mt-3">
            <Card>
              <CardContent className="pt-4">
                {!withdrawals?.length ? (
                  <p className="text-center text-muted-foreground text-sm py-6">Chưa có yêu cầu rút tiền</p>
                ) : (
                  <div className="space-y-3">
                    {withdrawals.map((w: any) => (
                      <div key={w.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium text-sm">{formatNumber(w.amount)}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(w.created_at), 'dd/MM/yyyy', { locale: vi })}
                            {' • '}{w.bank_name}
                          </p>
                        </div>
                        <Badge variant={w.status === 'approved' ? 'default' : w.status === 'rejected' ? 'destructive' : 'secondary'}>
                          {w.status === 'pending' ? 'Chờ' : w.status === 'approved' ? 'Đã duyệt' : 'Từ chối'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Withdraw Dialog */}
      <Dialog open={withdrawDialogOpen} onOpenChange={setWithdrawDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Yêu cầu rút tiền</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Số tiền</Label>
              <Input
                type="number"
                value={withdrawForm.amount}
                onChange={e => setWithdrawForm(f => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Ngân hàng</Label>
              <Select value={withdrawForm.bank_name} onValueChange={v => setWithdrawForm(f => ({ ...f, bank_name: v }))}>
                <SelectTrigger><SelectValue placeholder="Chọn ngân hàng" /></SelectTrigger>
                <SelectContent>
                  {VIETNAMESE_BANKS.map(b => (
                    <SelectItem key={b.code} value={b.shortName}>{b.shortName} - {b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Số tài khoản</Label>
              <Input
                value={withdrawForm.bank_account_number}
                onChange={e => setWithdrawForm(f => ({ ...f, bank_account_number: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Chủ tài khoản</Label>
              <Input
                value={withdrawForm.bank_account_holder}
                onChange={e => setWithdrawForm(f => ({ ...f, bank_account_holder: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Ghi chú</Label>
              <Textarea
                value={withdrawForm.note}
                onChange={e => setWithdrawForm(f => ({ ...f, note: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawDialogOpen(false)}>Hủy</Button>
            <Button
              onClick={handleWithdraw}
              disabled={createWithdrawal.isPending || !withdrawForm.amount || !withdrawForm.bank_name || !withdrawForm.bank_account_number}
              style={accentColor ? { backgroundColor: accentColor } : {}}
            >
              {createWithdrawal.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Gửi yêu cầu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
