import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  useCurrentTenant, 
  useSubscriptionPlans, 
  useCreatePaymentRequest,
  usePaymentRequests,
  useSubscriptionHistory,
  calculateRemainingDays 
} from '@/hooks/useTenant';
import { 
  CreditCard, 
  Check, 
  Clock, 
  History, 
  Loader2,
  Copy,
  CheckCircle
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

export default function SubscriptionPage() {
  const { data: tenant } = useCurrentTenant();
  const { data: plans } = useSubscriptionPlans();
  const { data: payments } = usePaymentRequests(tenant?.id);
  const { data: history } = useSubscriptionHistory(tenant?.id);
  const createPayment = useCreatePaymentRequest();

  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [note, setNote] = useState('');
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentCode, setPaymentCode] = useState('');

  const remainingDays = calculateRemainingDays(tenant || null);
  const pendingPayment = payments?.find(p => p.status === 'pending');

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
                <div className="bg-primary/10 text-primary px-4 py-2 rounded-lg text-sm">
                  <p className="font-medium">Đang chờ duyệt thanh toán</p>
                  <p className="text-xs">Mã: {pendingPayment.payment_code}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Subscription Plans */}
        {!pendingPayment && (
          <div className="grid gap-4 md:grid-cols-3">
            {plans?.map((plan) => (
              <Card 
                key={plan.id}
                className={`cursor-pointer transition-all ${
                  selectedPlan === plan.id 
                    ? 'ring-2 ring-primary' 
                    : 'hover:border-primary/50'
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
        )}

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
      </div>

      {/* Payment Instructions Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hướng dẫn thanh toán</DialogTitle>
            <DialogDescription>
              Vui lòng chuyển khoản theo thông tin bên dưới
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Ngân hàng:</span>
                <span className="font-medium">Vietcombank</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Số tài khoản:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium">1234567890</span>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-6 w-6"
                    onClick={() => copyToClipboard('1234567890')}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Chủ tài khoản:</span>
                <span className="font-medium">CONG TY ABC</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Nội dung CK:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium text-primary">{paymentCode}</span>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-6 w-6"
                    onClick={() => copyToClipboard(paymentCode)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              <p>⚠️ Vui lòng nhập đúng nội dung chuyển khoản để được xử lý nhanh chóng.</p>
              <p>📞 Liên hệ hỗ trợ nếu cần: 0909 123 456</p>
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