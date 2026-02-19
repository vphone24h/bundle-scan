import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  useCurrentTenant, 
  useSubscriptionPlans, 
  useCreatePaymentRequest,
  useCancelPaymentRequest,
  usePaymentRequests,
  useSubscriptionHistory,
  calculateRemainingDays 
} from '@/hooks/useTenant';
import { usePermissions } from '@/hooks/usePermissions';
import { useAdGateSettings } from '@/hooks/useAdGate';
import { 
  CreditCard, 
  Check, 
  Clock, 
  History, 
  Loader2,
  Copy,
  CheckCircle,
  Phone,
  QrCode,
  XCircle,
  MessageCircle,
  ExternalLink,
  Megaphone,
  ChevronRight,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { formatNumber } from '@/lib/formatNumber';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getBankCode, generateVietQRUrl as generateQRUrl } from '@/lib/vietnameseBanks';

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
  is_active: boolean;
}

interface PaymentConfig {
  config_key: string;
  config_value: string | null;
}

export default function SubscriptionPage() {
  const { data: tenant } = useCurrentTenant();
  const { data: plans } = useSubscriptionPlans();
  const { data: payments } = usePaymentRequests(tenant?.id);
  const { data: history } = useSubscriptionHistory(tenant?.id);
  const { data: permissions } = usePermissions();
  const { data: adGateSettings } = useAdGateSettings();
  const createPayment = useCreatePaymentRequest();
  const cancelPayment = useCancelPaymentRequest();

  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [note, setNote] = useState('');
  // Plan selection dialog (step 1)
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  // Payment QR dialog (step 2)
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentCode, setPaymentCode] = useState('');
  const [selectedAmount, setSelectedAmount] = useState(0);

  const { data: configs } = useQuery({
    queryKey: ['payment-config'],
    queryFn: async () => {
      const { data, error } = await supabase.from('payment_config').select('*');
      if (error) throw error;
      return data as PaymentConfig[];
    },
  });

  const { data: bankAccounts } = useQuery({
    queryKey: ['bank-accounts-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
      if (error) throw error;
      return data as BankAccount[];
    },
  });

  const hotline = configs?.find(c => c.config_key === 'hotline')?.config_value || '0909 123 456';
  const companyName = configs?.find(c => c.config_key === 'company_name')?.config_value || 'Kho Hàng Pro';
  const feedbackZaloUrl = configs?.find(c => c.config_key === 'feedback_zalo_url')?.config_value || '';
  const feedbackFbUrl = configs?.find(c => c.config_key === 'feedback_fb_url')?.config_value || '';
  const feedbackHotline = configs?.find(c => c.config_key === 'feedback_hotline')?.config_value || '';
  const primaryBank = bankAccounts?.[0];

  const isSuperAdmin = permissions?.role === 'super_admin';
  const remainingDays = calculateRemainingDays(tenant || null);
  const pendingPayment = payments?.find(p => p.status === 'pending');
  const activePlan = plans?.find(p => p.id === selectedPlan);

  const generateVietQRUrl = (bank: BankAccount, amount: number, content: string) => {
    const bankCode = getBankCode(bank.bank_name);
    if (!bankCode) return null;
    return generateQRUrl(bankCode, bank.account_number, amount, content, bank.account_holder);
  };

  // Step 1: Click on plan → open plan dialog
  const handleSelectPlan = (planId: string) => {
    if (pendingPayment) return;
    setSelectedPlan(planId);
    setNote('');
    setPaymentMethod('bank_transfer');
    setShowPlanDialog(true);
  };

  // Step 2: Submit payment → open QR dialog
  const handleSubmitPayment = async () => {
    if (!selectedPlan || !tenant) return;
    const plan = plans?.find(p => p.id === selectedPlan);
    if (!plan) return;

    try {
      const result = await createPayment.mutateAsync({
        tenant_id: tenant.id,
        plan_id: selectedPlan,
        amount: plan.price,
        payment_method: paymentMethod,
      });

      setPaymentCode(result.payment_code);
      setSelectedAmount(plan.price);
      setShowPlanDialog(false);
      setShowPaymentDialog(true);

      toast({ title: 'Đã tạo yêu cầu thanh toán', description: 'Vui lòng chuyển khoản theo hướng dẫn' });
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Đã sao chép' });
  };

  const getTransferContent = () => `${tenant?.subdomain?.toUpperCase() || ''} ${paymentCode}`;

  return (
    <MainLayout>
      <div className="p-4 sm:p-6 space-y-6">
        <PageHeader 
          title="Gói dịch vụ" 
          description="Quản lý gói đăng ký và thanh toán"
          helpText="Xem gói dịch vụ hiện tại, gia hạn hoặc nâng cấp gói. Thanh toán qua chuyển khoản ngân hàng. Gói hết hạn sẽ bị giới hạn tính năng."
        />

        {/* Feedback - Only for super_admin */}
        {isSuperAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Góp ý & Yêu cầu tính năng
              </CardTitle>
              <CardDescription>
                Mọi góp ý hoặc yêu cầu thêm tính năng, vui lòng liên hệ qua các kênh bên dưới
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                {feedbackZaloUrl && (
                  <a href={`https://zalo.me/${feedbackZaloUrl.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors group">
                    <div className="flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 flex-shrink-0">
                      <MessageCircle className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm">Zalo</p>
                      <p className="text-xs text-muted-foreground truncate">{feedbackZaloUrl}</p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                )}
                {feedbackFbUrl && (
                  <a href={feedbackFbUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors group">
                    <div className="flex items-center justify-center h-12 w-12 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                      <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm">Facebook</p>
                      <p className="text-xs text-muted-foreground truncate">Fanpage hỗ trợ</p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                )}
                {feedbackHotline && (
                  <a href={`tel:${feedbackHotline.replace(/\s/g, '')}`}
                    className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors group">
                    <div className="flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 flex-shrink-0">
                      <Phone className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm">Hotline</p>
                      <p className="text-xs text-primary font-mono">{feedbackHotline}</p>
                    </div>
                  </a>
                )}
              </div>
              {!feedbackZaloUrl && !feedbackFbUrl && !feedbackHotline && (
                <p className="text-center py-4 text-muted-foreground text-sm">
                  Chưa có thông tin liên hệ. Vui lòng liên hệ quản trị viên nền tảng.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Current Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Trạng thái hiện tại
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={
                    tenant?.status === 'active' ? 'default' :
                    tenant?.status === 'trial' ? 'secondary' :
                    (tenant?.status === 'expired' && adGateSettings?.is_enabled) ? 'secondary' :
                    'destructive'
                  }>
                    {tenant?.status === 'active' && 'Đang hoạt động'}
                    {tenant?.status === 'trial' && 'Dùng thử'}
                    {tenant?.status === 'expired' && !adGateSettings?.is_enabled && 'Hết hạn'}
                    {tenant?.status === 'expired' && adGateSettings?.is_enabled && 'Miễn phí (kèm QC)'}
                    {tenant?.status === 'locked' && 'Bị khóa'}
                  </Badge>
                  {tenant?.subscription_plan && (
                    <Badge variant="outline">
                      Gói {tenant.subscription_plan === 'monthly' && 'Tháng'}
                      {tenant.subscription_plan === 'yearly' && 'Năm'}
                      {tenant.subscription_plan === 'lifetime' && 'Vĩnh viễn'}
                    </Badge>
                  )}
                  {tenant?.status === 'expired' && adGateSettings?.is_enabled && (
                    <Badge variant="outline" className="text-orange-600 border-orange-300">
                      <Megaphone className="h-3 w-3 mr-1" />
                      Gói miễn phí trọn đời
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {tenant?.status === 'expired' && adGateSettings?.is_enabled
                    ? 'Bạn đang dùng gói miễn phí trọn đời, không cần mua (kèm theo quảng cáo)'
                    : remainingDays > 36500
                      ? 'Sử dụng vĩnh viễn'
                      : `Còn ${remainingDays} ngày sử dụng`}
                </p>
              </div>

              {pendingPayment && (
              <div className="bg-primary/10 text-primary px-4 py-3 rounded-lg space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium">Đang chờ duyệt thanh toán</p>
                      <p className="text-xs">Mã: {pendingPayment.payment_code}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-primary/40 text-primary hover:bg-primary/10"
                        onClick={() => {
                          setPaymentCode(pendingPayment.payment_code);
                          setSelectedAmount(pendingPayment.amount);
                          setShowPaymentDialog(true);
                        }}
                      >
                        <QrCode className="h-4 w-4 mr-1" />
                        Xem QR
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={async () => {
                          if (confirm('Bạn có chắc muốn hủy yêu cầu thanh toán này?')) {
                            try {
                              await cancelPayment.mutateAsync(pendingPayment.id);
                              toast({ title: 'Đã hủy yêu cầu', description: 'Bạn có thể tạo yêu cầu thanh toán mới' });
                            } catch (error: any) {
                              toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
                            }
                          }
                        }}
                        disabled={cancelPayment.isPending}
                      >
                        {cancelPayment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><XCircle className="h-4 w-4 mr-1" />Hủy</>}
                      </Button>
                    </div>
                  </div>
                  {/* Bank info preview */}
                  {primaryBank && (
                    <div className="text-xs border-t border-primary/20 pt-2 space-y-1 text-primary/80">
                      <p>🏦 {primaryBank.bank_name} · STK: <span className="font-mono font-semibold">{primaryBank.account_number}</span>
                        <button className="ml-1 opacity-70 hover:opacity-100" onClick={() => copyToClipboard(primaryBank.account_number)}>
                          <Copy className="h-3 w-3 inline" />
                        </button>
                      </p>
                      <p>Chủ TK: {primaryBank.account_holder}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Hotline Support */}
            <div className="mt-4 pt-4 border-t flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary">
                <Phone className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Hotline hỗ trợ</p>
                <a href={`tel:${hotline.replace(/\s/g, '')}`} className="font-semibold text-primary hover:underline">{hotline}</a>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Subscription Plans */}
        <div className="space-y-3">
          {pendingPayment && (
            <div className="rounded-lg border bg-muted p-3 text-sm text-muted-foreground">
              Bạn đang có 1 yêu cầu thanh toán <span className="font-medium">đang chờ duyệt</span>.
              Hãy <span className="font-medium">Hủy</span> yêu cầu đó để chọn gói khác.
            </div>
          )}

          <div className={`grid gap-4 md:grid-cols-2 lg:grid-cols-3 ${pendingPayment ? 'opacity-60 pointer-events-none' : ''}`}>
            {/* Free-with-ads plan */}
            {adGateSettings?.is_enabled && (
              <Card className={`border-dashed border-2 relative overflow-hidden ${
                tenant?.status === 'expired'
                  ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20'
                  : 'border-muted-foreground/30 bg-muted/20'
              }`}>
                <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
                  <Badge variant="secondary" className="text-xs">Miễn phí</Badge>
                  {tenant?.status === 'expired' && (
                    <Badge variant="default" className="text-xs bg-primary/90">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Bạn đang dùng gói này
                    </Badge>
                  )}
                </div>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Megaphone className="h-4 w-4 text-muted-foreground" />
                    Gói miễn phí trọn đời
                  </CardTitle>
                  <CardDescription>Dùng không giới hạn thời gian</CardDescription>
                  <p className="text-xs text-muted-foreground/70 italic mt-1">
                    📌 Gói mặc định — hết gói dùng thử sẽ chuyển qua gói này
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-muted-foreground mb-4">0đ</div>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" />
                      Sử dụng vĩnh viễn, không cần mua
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" />
                      Đầy đủ tính năng
                    </li>
                  </ul>
                </CardContent>
              </Card>
            )}

            {plans?.map((plan) => (
              <Card
                key={plan.id}
                className={`cursor-pointer transition-all hover:shadow-md hover:border-primary/60 active:scale-[0.99] ${
                  pendingPayment ? '' : 'hover:ring-1 hover:ring-primary/30'
                }`}
                onClick={() => handleSelectPlan(plan.id)}
              >
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {plan.name}
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-primary mb-4">
                    {formatNumber(plan.price)}đ
                  </div>
                  <ul className="space-y-2 text-sm mb-4">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      {plan.duration_days ? `${plan.duration_days} ngày sử dụng` : 'Sử dụng vĩnh viễn'}
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      Tối đa {plan.max_branches} chi nhánh
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      Tối đa {plan.max_users} nhân viên
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      Đầy đủ tính năng
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      Không quảng cáo
                    </li>
                  </ul>
                  <Button className="w-full" size="sm" onClick={(e) => { e.stopPropagation(); handleSelectPlan(plan.id); }}>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Chọn gói này
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Payment History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Lịch sử gói dịch vụ
            </CardTitle>
          </CardHeader>
          <CardContent>
            {history?.length === 0 && (
              <p className="text-muted-foreground text-center py-4">Chưa có lịch sử</p>
            )}
            <div className="space-y-3">
              {history?.map((item) => (
                <div key={item.id} className="flex items-start justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium">{item.action}</p>
                    <p className="text-sm text-muted-foreground">{item.note}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(item.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Step 1: Plan Selection Dialog */}
      <Dialog open={showPlanDialog} onOpenChange={setShowPlanDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              {activePlan?.name}
            </DialogTitle>
            <DialogDescription>{activePlan?.description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Plan summary */}
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Số tiền:</span>
                <span className="text-2xl font-bold text-primary">{formatNumber(activePlan?.price || 0)}đ</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Thời hạn:</span>
                <span className="font-medium">
                  {activePlan?.duration_days ? `${activePlan.duration_days} ngày` : 'Vĩnh viễn'}
                </span>
              </div>
            </div>

            {/* Features */}
            <ul className="space-y-1.5 text-sm">
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary flex-shrink-0" /> Tối đa {activePlan?.max_branches} chi nhánh</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary flex-shrink-0" /> Tối đa {activePlan?.max_users} nhân viên</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary flex-shrink-0" /> Đầy đủ tính năng</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary flex-shrink-0" /> Không quảng cáo</li>
            </ul>

            {/* Payment method */}
            <div className="space-y-2">
              <Label className="font-medium">Phương thức thanh toán</Label>
              <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-1">
                <div className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-muted/50" onClick={() => setPaymentMethod('bank_transfer')}>
                  <RadioGroupItem value="bank_transfer" id="bank2" />
                  <Label htmlFor="bank2" className="cursor-pointer">🏦 Chuyển khoản ngân hàng</Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-muted/50" onClick={() => setPaymentMethod('momo')}>
                  <RadioGroupItem value="momo" id="momo2" />
                  <Label htmlFor="momo2" className="cursor-pointer">💜 Ví MoMo</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Note */}
            <div className="space-y-2">
              <Label>Ghi chú (tùy chọn)</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú thêm..." rows={2} />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowPlanDialog(false)}>Hủy</Button>
            <Button onClick={handleSubmitPayment} disabled={createPayment.isPending} className="flex-1 sm:flex-none">
              {createPayment.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <QrCode className="h-4 w-4 mr-2" />
              Xem QR thanh toán
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Step 2: Payment QR Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Thanh toán qua QR
            </DialogTitle>
            <DialogDescription>
              Quét mã QR hoặc chuyển khoản thủ công
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* QR Code */}
            {primaryBank && (
              <div className="flex justify-center">
                <div className="bg-white p-4 rounded-lg border shadow-sm">
                  <img 
                    src={generateVietQRUrl(primaryBank, selectedAmount, getTransferContent()) || ''} 
                    alt="QR thanh toán"
                    className="w-48 h-48 object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              </div>
            )}

            {/* Bank Info */}
            <div className="bg-muted p-4 rounded-lg space-y-3">
              {primaryBank ? (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Ngân hàng:</span>
                    <span className="font-medium">{primaryBank.bank_name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Số tài khoản:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium">{primaryBank.account_number}</span>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyToClipboard(primaryBank.account_number)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Chủ tài khoản:</span>
                    <span className="font-medium">{primaryBank.account_holder}</span>
                  </div>
                </>
              ) : (
                <p className="text-center text-muted-foreground">Chưa có thông tin ngân hàng</p>
              )}
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Số tiền:</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-primary">{formatNumber(selectedAmount)}đ</span>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyToClipboard(selectedAmount.toString())}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Nội dung CK:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium text-primary">{getTransferContent()}</span>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyToClipboard(getTransferContent())}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="text-sm text-muted-foreground space-y-1">
              <p>⚠️ Vui lòng nhập đúng nội dung chuyển khoản để được xử lý tự động.</p>
              <p className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                Hotline hỗ trợ: <a href={`tel:${hotline}`} className="text-primary font-medium">{hotline}</a>
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowPaymentDialog(false)}>Đã hiểu</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
