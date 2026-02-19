import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Loader2,
  Link2,
  Copy,
  QrCode,
  Users,
  Coins,
  Wallet,
  TrendingUp,
  MousePointerClick,
  CheckCircle2,
  Clock,
  Banknote,
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';
import {
  useAffiliateSettings,
  useMyAffiliate,
  useCreateAffiliate,
  useMyReferrals,
  useMyCommissions,
  useMyWithdrawals,
  useCreateWithdrawal,
  useUpdateAffiliateBank,
} from '@/hooks/useAffiliate';
import { useCurrentTenant } from '@/hooks/useTenant';
import { VIETNAMESE_BANKS } from '@/lib/vietnameseBanks';

const commissionStatusConfig = {
  pending: { label: 'Chờ duyệt', variant: 'secondary' as const },
  approved: { label: 'Được rút', variant: 'default' as const },
  paid: { label: 'Đã chi', variant: 'outline' as const },
  cancelled: { label: 'Hủy', variant: 'destructive' as const },
};

const withdrawalStatusConfig = {
  pending: { label: 'Chờ duyệt', variant: 'secondary' as const },
  approved: { label: 'Đã duyệt', variant: 'default' as const },
  paid: { label: 'Đã thanh toán', variant: 'outline' as const },
  rejected: { label: 'Từ chối', variant: 'destructive' as const },
};

export function AffiliateUserDashboard() {
  const { data: settings, isLoading: settingsLoading } = useAffiliateSettings();
  const { data: affiliate, isLoading: affiliateLoading } = useMyAffiliate();
  const { data: tenant } = useCurrentTenant();
  const createAffiliate = useCreateAffiliate();
  const { data: referrals } = useMyReferrals();
  const { data: commissions } = useMyCommissions();
  const { data: withdrawals } = useMyWithdrawals();
  const createWithdrawal = useCreateWithdrawal();
  const updateBank = useUpdateAffiliateBank();

  const [withdrawalDialogOpen, setWithdrawalDialogOpen] = useState(false);
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [withdrawalForm, setWithdrawalForm] = useState({
    amount: '',
    bank_name: '',
    bank_account_number: '',
    bank_account_holder: '',
    note: '',
  });
  const [bankForm, setBankForm] = useState({
    bank_name: '',
    bank_account_number: '',
    bank_account_holder: '',
  });

  const isLoading = settingsLoading || affiliateLoading;

  // Kiểm tra điều kiện: đăng ký gói từ 3 tháng trở lên (không phải gói tháng)
  // Các gói hợp lệ: yearly, lifetime và bất kỳ gói nào không phải 'monthly'
  const meetsSubscriptionRequirement = (() => {
    if (!tenant) return false;
    const plan = tenant.subscription_plan;
    if (!plan) return false;
    // Chỉ loại trừ gói tháng (monthly)
    return plan !== 'monthly';
  })();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!settings?.is_enabled) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">Chương trình Affiliate đang tạm dừng</h3>
          <p className="text-muted-foreground">
            Vui lòng quay lại sau khi chương trình được kích hoạt.
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleRegister = async () => {
    if (!tenant?.id) return;
    await createAffiliate.mutateAsync({ tenant_id: tenant.id });
  };

  const handleCopyLink = () => {
    if (affiliate?.affiliate_code) {
      const link = `${window.location.origin}/register?ref=${affiliate.affiliate_code}`;
      navigator.clipboard.writeText(link);
      toast({ title: 'Đã sao chép link giới thiệu!' });
    }
  };

  const handleWithdraw = async () => {
    await createWithdrawal.mutateAsync({
      amount: parseFloat(withdrawalForm.amount),
      bank_name: withdrawalForm.bank_name,
      bank_account_number: withdrawalForm.bank_account_number,
      bank_account_holder: withdrawalForm.bank_account_holder,
      note: withdrawalForm.note || undefined,
    });
    setWithdrawalDialogOpen(false);
    setWithdrawalForm({
      amount: '',
      bank_name: '',
      bank_account_number: '',
      bank_account_holder: '',
      note: '',
    });
  };

  const handleUpdateBank = async () => {
    await updateBank.mutateAsync(bankForm);
    setBankDialogOpen(false);
  };

  const openBankDialog = () => {
    setBankForm({
      bank_name: affiliate?.bank_name || '',
      bank_account_number: affiliate?.bank_account_number || '',
      bank_account_holder: affiliate?.bank_account_holder || '',
    });
    setBankDialogOpen(true);
  };

  const openWithdrawDialog = () => {
    setWithdrawalForm({
      amount: affiliate?.available_balance?.toString() || '',
      bank_name: affiliate?.bank_name || '',
      bank_account_number: affiliate?.bank_account_number || '',
      bank_account_holder: affiliate?.bank_account_holder || '',
      note: '',
    });
    setWithdrawalDialogOpen(true);
  };

  // Chưa đăng ký affiliate
  if (!affiliate) {
    const description = (settings as any)?.commission_description;
    
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Chương trình Affiliate
          </CardTitle>
          <CardDescription>
            Giới thiệu bạn bè và nhận hoa hồng khi họ mua gói subscription
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Mô tả từ admin */}
          {description && (
            <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
              <p className="text-sm whitespace-pre-wrap">{description}</p>
            </div>
          )}

          {/* Thông báo điều kiện chưa đủ */}
          {!meetsSubscriptionRequirement && (
            <div className="flex items-start gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/5">
              <CheckCircle2 className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-destructive">Yêu cầu đăng ký gói từ 3 tháng trở lên</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Để tham gia chương trình Affiliate, bạn cần đăng ký <strong>gói 3 tháng, 6 tháng, 12 tháng, 24 tháng hoặc Vĩnh viễn</strong>. Gói tháng không đủ điều kiện.
                </p>
              </div>
            </div>
          )}
          
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-start gap-3 p-4 rounded-lg border">
              <Link2 className="h-8 w-8 text-primary shrink-0" />
              <div>
                <h4 className="font-medium">1. Lấy link giới thiệu</h4>
                <p className="text-sm text-muted-foreground">
                  Đăng ký affiliate và nhận link giới thiệu độc quyền
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-lg border">
              <Users className="h-8 w-8 text-primary shrink-0" />
              <div>
                <h4 className="font-medium">2. Chia sẻ link</h4>
                <p className="text-sm text-muted-foreground">
                  Gửi link cho bạn bè, đồng nghiệp hoặc đăng lên mạng xã hội
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-lg border">
              <Coins className="h-8 w-8 text-primary shrink-0" />
              <div>
                <h4 className="font-medium">3. Nhận hoa hồng</h4>
                <p className="text-sm text-muted-foreground">
                  Nhận hoa hồng khi người được giới thiệu mua gói thành công
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2 pt-4">
            <Button
              size="lg"
              onClick={handleRegister}
              disabled={createAffiliate.isPending || !meetsSubscriptionRequirement}
            >
              {createAffiliate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Đăng ký làm Affiliate
            </Button>
            {!meetsSubscriptionRequirement && (
              <p className="text-xs text-muted-foreground">
                Cần đăng ký <strong>gói từ 3 tháng trở lên</strong> để tham gia
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Affiliate đang chờ duyệt
  if (affiliate.status === 'pending') {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Clock className="h-12 w-12 text-yellow-500 mb-4" />
          <h3 className="text-lg font-semibold">Đang chờ duyệt</h3>
          <p className="text-muted-foreground text-center max-w-md">
            Yêu cầu đăng ký affiliate của bạn đang được xem xét. 
            Chúng tôi sẽ thông báo khi tài khoản được kích hoạt.
          </p>
          <Badge variant="secondary" className="mt-4">
            Mã: {affiliate.affiliate_code}
          </Badge>
        </CardContent>
      </Card>
    );
  }

  // Affiliate bị khóa
  if (affiliate.status === 'blocked') {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Users className="h-12 w-12 text-destructive mb-4" />
          <h3 className="text-lg font-semibold">Tài khoản đã bị khóa</h3>
          <p className="text-muted-foreground text-center max-w-md">
            {affiliate.blocked_reason || 'Tài khoản affiliate của bạn đã bị khóa. Vui lòng liên hệ hỗ trợ.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Dashboard affiliate đang hoạt động
  const affiliateLink = `${window.location.origin}/register?ref=${affiliate.affiliate_code}`;
  const canWithdraw = affiliate.available_balance >= (settings?.min_withdrawal_amount || 500000);

  // Lấy mô tả chương trình từ settings
  const programDescription = (settings as any)?.commission_description;

  return (
    <div className="space-y-6">
      {/* Banner mô tả chương trình Affiliate */}
      {programDescription && (
        <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-primary" />
              Về chương trình Affiliate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {programDescription}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Thông tin nhanh */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <MousePointerClick className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Lượt click</p>
                <p className="text-2xl font-bold">{affiliate.total_clicks.toLocaleString('vi-VN')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Đăng ký</p>
                <p className="text-2xl font-bold">{affiliate.total_referrals.toLocaleString('vi-VN')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Chuyển đổi</p>
                <p className="text-2xl font-bold">{affiliate.total_conversions.toLocaleString('vi-VN')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Số dư khả dụng</p>
                <p className="text-2xl font-bold text-primary">
                  {affiliate.available_balance.toLocaleString('vi-VN')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Link giới thiệu */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Link giới thiệu
          </CardTitle>
          <CardDescription>
            Chia sẻ link này để giới thiệu bạn bè
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input value={affiliateLink} readOnly className="font-mono text-sm" />
            <Button variant="outline" onClick={handleCopyLink}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="font-mono">
              Mã: {affiliate.affiliate_code}
            </Badge>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={openBankDialog}>
                <Banknote className="mr-2 h-4 w-4" />
                Cập nhật ngân hàng
              </Button>
              <Button
                size="sm"
                onClick={openWithdrawDialog}
                disabled={!canWithdraw}
              >
                <Wallet className="mr-2 h-4 w-4" />
                Rút tiền
              </Button>
            </div>
          </div>
          {!canWithdraw && affiliate.available_balance > 0 && (
            <p className="text-sm text-muted-foreground">
              Số dư tối thiểu để rút: {(settings?.min_withdrawal_amount || 500000).toLocaleString('vi-VN')} VND
            </p>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="referrals">
        <TabsList>
          <TabsTrigger value="referrals">Người giới thiệu</TabsTrigger>
          <TabsTrigger value="commissions">Lịch sử hoa hồng</TabsTrigger>
          <TabsTrigger value="withdrawals">Lịch sử rút tiền</TabsTrigger>
        </TabsList>

        <TabsContent value="referrals" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ngày đăng ký</TableHead>
                    <TableHead>Người được giới thiệu</TableHead>
                    <TableHead className="text-center">Trạng thái</TableHead>
                    <TableHead>Ngày chuyển đổi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referrals?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        Chưa có người được giới thiệu
                      </TableCell>
                    </TableRow>
                  ) : (
                    referrals?.map((referral) => (
                      <TableRow key={referral.id}>
                        <TableCell>
                          {format(new Date(referral.registered_at), 'dd/MM/yyyy', { locale: vi })}
                        </TableCell>
                        <TableCell>
                          {referral.tenants?.name || referral.referred_email || 'N/A'}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={referral.status === 'converted' ? 'default' : 'secondary'}>
                            {referral.status === 'converted' ? 'Đã mua gói' : 'Đã đăng ký'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {referral.converted_at
                            ? format(new Date(referral.converted_at), 'dd/MM/yyyy', { locale: vi })
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commissions" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ngày</TableHead>
                    <TableHead>Người mua</TableHead>
                    <TableHead>Gói</TableHead>
                    <TableHead className="text-right">Hoa hồng</TableHead>
                    <TableHead className="text-center">Trạng thái</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commissions?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Chưa có hoa hồng
                      </TableCell>
                    </TableRow>
                  ) : (
                    commissions?.map((commission) => (
                      <TableRow key={commission.id}>
                        <TableCell>
                          {format(new Date(commission.created_at), 'dd/MM/yyyy', { locale: vi })}
                        </TableCell>
                        <TableCell>
                          {commission.affiliate_referrals?.tenants?.name ||
                            commission.affiliate_referrals?.referred_email ||
                            'N/A'}
                        </TableCell>
                        <TableCell>{commission.subscription_plans?.name || 'N/A'}</TableCell>
                        <TableCell className="text-right font-medium text-primary">
                          {commission.commission_amount.toLocaleString('vi-VN')} VND
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={commissionStatusConfig[commission.status].variant}>
                            {commissionStatusConfig[commission.status].label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="withdrawals" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ngày yêu cầu</TableHead>
                    <TableHead className="text-right">Số tiền</TableHead>
                    <TableHead>Ngân hàng</TableHead>
                    <TableHead className="text-center">Trạng thái</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {withdrawals?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        Chưa có yêu cầu rút tiền
                      </TableCell>
                    </TableRow>
                  ) : (
                    withdrawals?.map((withdrawal) => (
                      <TableRow key={withdrawal.id}>
                        <TableCell>
                          {format(new Date(withdrawal.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {withdrawal.amount.toLocaleString('vi-VN')} VND
                        </TableCell>
                        <TableCell>
                          <p>{withdrawal.bank_name}</p>
                          <p className="text-sm text-muted-foreground font-mono">
                            {withdrawal.bank_account_number}
                          </p>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={withdrawalStatusConfig[withdrawal.status].variant}>
                            {withdrawalStatusConfig[withdrawal.status].label}
                          </Badge>
                          {withdrawal.rejected_reason && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {withdrawal.rejected_reason}
                            </p>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Withdrawal Dialog */}
      <Dialog open={withdrawalDialogOpen} onOpenChange={setWithdrawalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yêu cầu rút tiền</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Số tiền muốn rút (VND)</Label>
              <Input
                type="number"
                value={withdrawalForm.amount}
                onChange={(e) => setWithdrawalForm({ ...withdrawalForm, amount: e.target.value })}
                max={affiliate.available_balance}
              />
              <p className="text-xs text-muted-foreground">
                Số dư khả dụng: {affiliate.available_balance.toLocaleString('vi-VN')} VND
              </p>
            </div>
            <div className="space-y-2">
              <Label>Ngân hàng</Label>
              <Select
                value={withdrawalForm.bank_name}
                onValueChange={(v) => setWithdrawalForm({ ...withdrawalForm, bank_name: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn ngân hàng" />
                </SelectTrigger>
                <SelectContent>
                  {VIETNAMESE_BANKS.map((bank) => (
                    <SelectItem key={bank.code} value={bank.name}>
                      {bank.name} ({bank.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Số tài khoản</Label>
              <Input
                value={withdrawalForm.bank_account_number}
                onChange={(e) =>
                  setWithdrawalForm({ ...withdrawalForm, bank_account_number: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Tên chủ tài khoản</Label>
              <Input
                value={withdrawalForm.bank_account_holder}
                onChange={(e) =>
                  setWithdrawalForm({ ...withdrawalForm, bank_account_holder: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Ghi chú (tuỳ chọn)</Label>
              <Textarea
                value={withdrawalForm.note}
                onChange={(e) => setWithdrawalForm({ ...withdrawalForm, note: e.target.value })}
                placeholder="Ghi chú thêm..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawalDialogOpen(false)}>
              Hủy
            </Button>
            <Button
              onClick={handleWithdraw}
              disabled={
                createWithdrawal.isPending ||
                !withdrawalForm.amount ||
                !withdrawalForm.bank_name ||
                !withdrawalForm.bank_account_number ||
                !withdrawalForm.bank_account_holder
              }
            >
              {createWithdrawal.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Gửi yêu cầu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bank Info Dialog */}
      <Dialog open={bankDialogOpen} onOpenChange={setBankDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cập nhật thông tin ngân hàng</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Ngân hàng</Label>
              <Select
                value={bankForm.bank_name}
                onValueChange={(v) => setBankForm({ ...bankForm, bank_name: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn ngân hàng" />
                </SelectTrigger>
                <SelectContent>
                  {VIETNAMESE_BANKS.map((bank) => (
                    <SelectItem key={bank.code} value={bank.name}>
                      {bank.name} ({bank.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Số tài khoản</Label>
              <Input
                value={bankForm.bank_account_number}
                onChange={(e) => setBankForm({ ...bankForm, bank_account_number: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Tên chủ tài khoản</Label>
              <Input
                value={bankForm.bank_account_holder}
                onChange={(e) => setBankForm({ ...bankForm, bank_account_holder: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBankDialogOpen(false)}>
              Hủy
            </Button>
            <Button
              onClick={handleUpdateBank}
              disabled={
                updateBank.isPending ||
                !bankForm.bank_name ||
                !bankForm.bank_account_number ||
                !bankForm.bank_account_holder
              }
            >
              {updateBank.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
