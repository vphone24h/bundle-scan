import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Banknote, CreditCard, Wallet, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CustomerSearchCombobox } from '@/components/export/CustomerSearchCombobox';
import { useCustomPaymentSources } from '@/hooks/useCustomPaymentSources';
import { useCreateProductDeposit } from '@/hooks/useProductDeposits';
import { formatNumber } from '@/lib/formatNumber';
import { toast } from 'sonner';

interface ProductDepositDialogProps {
  open: boolean;
  onClose: () => void;
  product: {
    id: string;
    name: string;
    sku: string;
    imei?: string | null;
    branch_id?: string | null;
  } | null;
  suggestedPrice?: number;
}

interface CustomerLite {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  email: string | null;
}

export function ProductDepositDialog({ open, onClose, product, suggestedPrice }: ProductDepositDialogProps) {
  const { data: customSources = [] } = useCustomPaymentSources();
  const createDeposit = useCreateProductDeposit();

  const paymentOptions = useMemo(() => {
    const builtIn = [
      { type: 'cash', label: 'Tiền mặt', icon: <Banknote className="h-4 w-4" /> },
      { type: 'bank_card', label: 'Chuyển khoản', icon: <CreditCard className="h-4 w-4" /> },
      { type: 'e_wallet', label: 'Ví điện tử', icon: <Wallet className="h-4 w-4" /> },
    ];
    const custom = customSources.map((s: any) => ({
      type: s.id, label: s.name, icon: <Wallet className="h-4 w-4" />,
    }));
    return [...builtIn, ...custom];
  }, [customSources]);

  // Customer state
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');

  // Deposit state
  const [depositAmountStr, setDepositAmountStr] = useState('');
  const [paymentSource, setPaymentSource] = useState<string>('cash');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open) {
      setSelectedCustomer(null);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setCustomerEmail('');
      setDepositAmountStr('');
      setPaymentSource('cash');
      setNote('');
    }
  }, [open]);

  const depositAmount = Number((depositAmountStr || '0').replace(/[^\d]/g, ''));

  const handleAmountChange = (v: string) => {
    const digits = v.replace(/[^\d]/g, '');
    setDepositAmountStr(digits ? formatNumber(Number(digits)) : '');
  };

  const handleSubmit = async () => {
    if (!product) return;
    if (!customerName.trim()) {
      toast.error('Vui lòng nhập hoặc chọn khách hàng');
      return;
    }
    if (depositAmount <= 0) {
      toast.error('Vui lòng nhập số tiền cọc');
      return;
    }

    // Nếu khách mới (không có id) -> tạo trước trong DB customers
    let customerId: string | null = selectedCustomer?.id || null;
    if (!customerId && customerName.trim()) {
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data: tenantData } = await supabase.rpc('get_user_tenant_id_secure');
        const tenantId = tenantData as unknown as string;
        if (tenantId && customerPhone.trim()) {
          // Try find by phone first
          const { data: existing } = await supabase
            .from('customers')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('phone', customerPhone.trim())
            .maybeSingle();
          if (existing?.id) {
            customerId = existing.id;
          } else {
            const { data: created } = await supabase
              .from('customers')
              .insert([{
                tenant_id: tenantId,
                name: customerName.trim(),
                phone: customerPhone.trim(),
                address: customerAddress.trim() || null,
                email: customerEmail.trim() || null,
              }])
              .select('id')
              .single();
            customerId = created?.id || null;
          }
        }
      } catch (err) {
        // Không chặn flow nếu tạo KH lỗi - vẫn lưu deposit theo tên
        console.warn('Tạo khách mới lỗi:', err);
      }
    }

    try {
      await createDeposit.mutateAsync({
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        branchId: product.branch_id || null,
        customerId,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || null,
        depositAmount,
        paymentSource,
        note: note.trim() || null,
      });
      toast.success('Đã tạo cọc thành công và ghi vào sổ quỹ');
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Không thể tạo cọc');
    }
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Khách cọc sản phẩm</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{product.name}</span>
            {product.sku && <span className="text-muted-foreground"> · {product.sku}</span>}
            {product.imei && <span className="text-muted-foreground font-mono"> · IMEI: {product.imei}</span>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Customer search */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Khách hàng *</Label>
            <CustomerSearchCombobox
              selectedCustomer={selectedCustomer}
              onSelect={(c: any) => setSelectedCustomer(c)}
              onCustomerInfoChange={() => {}}
              customerName={customerName}
              customerPhone={customerPhone}
              customerAddress={customerAddress}
              customerEmail={customerEmail}
              setCustomerName={setCustomerName}
              setCustomerPhone={setCustomerPhone}
              setCustomerAddress={setCustomerAddress}
              setCustomerEmail={setCustomerEmail}
            />
          </div>

          {/* Deposit amount */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Số tiền cọc *</Label>
            <div className="relative">
              <Input
                value={depositAmountStr}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="0"
                inputMode="numeric"
                className="pr-12 text-right text-base font-medium"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">đ</span>
            </div>
            {suggestedPrice && suggestedPrice > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Gợi ý giá bán: {formatNumber(suggestedPrice)}đ
              </p>
            )}
          </div>

          {/* Payment source */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Nguồn tiền nhận cọc *</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {paymentOptions.map((opt) => (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => setPaymentSource(opt.type)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-colors',
                    paymentSource === opt.type
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-input hover:bg-muted'
                  )}
                >
                  {opt.icon}
                  <span className="truncate">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Ghi chú</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Hẹn lấy ngày 25/12, cọc giữ máy..."
              rows={2}
            />
          </div>

          <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
            ℹ️ Tiền cọc sẽ được tự động ghi vào <span className="font-medium text-foreground">Sổ quỹ</span> ở mục "Tiền cọc khách hàng".
            Khi khách đến lấy hàng, hệ thống sẽ tự đề xuất trừ tiền cọc khỏi tổng đơn.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={createDeposit.isPending}>
            Hủy
          </Button>
          <Button onClick={handleSubmit} disabled={createDeposit.isPending}>
            {createDeposit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Xác nhận cọc
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
