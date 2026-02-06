import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Trash2,
  XCircle,
  MessageCircle,
  ExternalLink
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
  const { data: payments, refetch: refetchPayments } = usePaymentRequests(tenant?.id);
  const { data: history } = useSubscriptionHistory(tenant?.id);
  const { data: permissions } = usePermissions();
  const createPayment = useCreatePaymentRequest();
  const cancelPayment = useCancelPaymentRequest();

  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [note, setNote] = useState('');
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentCode, setPaymentCode] = useState('');
  const [selectedAmount, setSelectedAmount] = useState(0);

  // Fetch payment config
  const { data: configs } = useQuery({
    queryKey: ['payment-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_config')
        .select('*');
      if (error) throw error;
      return data as PaymentConfig[];
    },
  });

  // Fetch bank accounts
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

  // Generate VietQR URL using shared utility
  const generateVietQRUrl = (bank: BankAccount, amount: number, content: string) => {
    const bankCode = getBankCode(bank.bank_name);
    if (!bankCode) return null;
    
    return generateQRUrl(bankCode, bank.account_number, amount, content, bank.account_holder);
  };

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
      setShowPaymentDialog(true);
      setSelectedPlan('');
      setNote('');

      toast({
        title: 'Đã tạo yêu cầu thanh toán',
        description: 'Vui lòng chuyển khoản theo hướng dẫn',
      });
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Đã sao chép' });
  };

  // Generate transfer content: {TENANT_SUBDOMAIN} - {PAYMENT_CODE}
  const getTransferContent = () => {
    return `${tenant?.subdomain?.toUpperCase() || ''} ${paymentCode}`;
  };

  return (
    <MainLayout>
      <div className="p-4 sm:p-6 space-y-6">
        <PageHeader 
          title="Gói dịch vụ" 
          description="Quản lý gói đăng ký và thanh toán"
        />

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
                <div className="flex items-center gap-2">
                  <Badge variant={
                    tenant?.status === 'active' ? 'default' :
                    tenant?.status === 'trial' ? 'secondary' :
                    'destructive'
                  }>
                    {tenant?.status === 'active' && 'Đang hoạt động'}
                    {tenant?.status === 'trial' && 'Dùng thử'}
                    {tenant?.status === 'expired' && 'Hết hạn'}
                    {tenant?.status === 'locked' && 'Bị khóa'}
                  </Badge>
                  {tenant?.subscription_plan && (
                    <Badge variant="outline">
                      Gói {tenant.subscription_plan === 'monthly' && 'Tháng'}
                      {tenant.subscription_plan === 'yearly' && 'Năm'}
                      {tenant.subscription_plan === 'lifetime' && 'Vĩnh viễn'}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {remainingDays > 36500 
                    ? 'Sử dụng vĩnh viễn'
                    : `Còn ${remainingDays} ngày sử dụng`}
                </p>
              </div>

              {pendingPayment && (
                <div className="bg-primary/10 text-primary px-4 py-3 rounded-lg">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium">Đang chờ duyệt thanh toán</p>
                      <p className="text-xs">Mã: {pendingPayment.payment_code}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={async () => {
                        if (confirm('Bạn có chắc muốn hủy yêu cầu thanh toán này?')) {
                          try {
                            await cancelPayment.mutateAsync(pendingPayment.id);
                            toast({
                              title: 'Đã hủy yêu cầu',
                              description: 'Bạn có thể tạo yêu cầu thanh toán mới',
                            });
                          } catch (error: any) {
                            toast({
                              title: 'Lỗi',
                              description: error.message,
                              variant: 'destructive',
                            });
                          }
                        }
                      }}
                      disabled={cancelPayment.isPending}
                    >
                      {cancelPayment.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 mr-1" />
                          Hủy
                        </>
                      )}
                    </Button>
                  </div>
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
                <a 
                  href={`tel:${hotline.replace(/\s/g, '')}`}
                  className="font-semibold text-primary hover:underline"
                >
                  {hotline}
                </a>
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

          <div
            className={`grid gap-4 md:grid-cols-2 lg:grid-cols-3 ${
              pendingPayment ? 'opacity-60 pointer-events-none' : ''
            }`}
          >
            {plans?.map((plan) => (
              <Card
                key={plan.id}
                className={`cursor-pointer transition-all ${
                  selectedPlan === plan.id ? 'ring-2 ring-primary' : 'hover:border-primary/50'
                }`}
                onClick={() => setSelectedPlan(plan.id)}
              >
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {plan.name}
                    {selectedPlan === plan.id && (
                      <CheckCircle className="h-5 w-5 text-primary" />
                    )}
                  </CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-primary mb-4">
                    {formatNumber(plan.price)}đ
                  </div>
                  <ul className="space-y-2 text-sm">
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
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Payment Form */}
        {selectedPlan && !pendingPayment && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Thông tin thanh toán
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Phương thức thanh toán</Label>
                <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="bank_transfer" id="bank" />
                    <Label htmlFor="bank">Chuyển khoản ngân hàng</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="momo" id="momo" />
                    <Label htmlFor="momo">Ví MoMo</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label>Ghi chú (tùy chọn)</Label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ghi chú thêm..."
                />
              </div>

              <Button 
                onClick={handleSubmitPayment}
                disabled={createPayment.isPending}
                className="w-full sm:w-auto"
              >
                {createPayment.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Tạo yêu cầu thanh toán
              </Button>
            </CardContent>
          </Card>
        )}

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
              <p className="text-muted-foreground text-center py-4">
                Chưa có lịch sử
              </p>
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

        {/* Feedback Tab - Only for super_admin */}
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
                  <a
                    href={feedbackZaloUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 flex-shrink-0">
                      <MessageCircle className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm">Zalo</p>
                      <p className="text-xs text-muted-foreground truncate">Nhắn tin trực tiếp</p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                )}
                {feedbackFbUrl && (
                  <a
                    href={feedbackFbUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors group"
                  >
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
                  <a
                    href={`tel:${feedbackHotline.replace(/\s/g, '')}`}
                    className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors group"
                  >
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
      </div>

      {/* Payment Instructions Dialog with QR */}
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
                <div className="bg-white p-4 rounded-lg border">
                  <img 
                    src={generateVietQRUrl(primaryBank, selectedAmount, getTransferContent()) || ''} 
                    alt="QR thanh toán"
                    className="w-48 h-48 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
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
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(primaryBank.account_number)}
                      >
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
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-6 w-6"
                    onClick={() => copyToClipboard(selectedAmount.toString())}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Nội dung CK:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium text-primary">{getTransferContent()}</span>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-6 w-6"
                    onClick={() => copyToClipboard(getTransferContent())}
                  >
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
            <Button onClick={() => setShowPaymentDialog(false)}>
              Đã hiểu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
