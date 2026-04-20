import { useEffect, useState } from 'react';
import { useCreateDebtPayment } from '@/hooks/useDebt';
import { useCustomPaymentSources } from '@/hooks/useCustomPaymentSources';
import { formatNumber, parseFormattedNumber, formatInputNumber } from '@/lib/formatNumber';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Wallet } from 'lucide-react';
import { createSafeDialogOpenChange, forceReleaseStuckInteraction, preventDialogAutoFocus } from '@/lib/dialogInteraction';
import { format } from 'date-fns';

interface DebtAdditionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: 'customer' | 'supplier';
  entityId: string;
  entityName: string;
  remainingAmount: number;
  branchId: string | null;
  mergedEntityIds?: string[];
  nested?: boolean;
}

export function DebtAdditionDialog({
  open,
  onOpenChange,
  entityType,
  entityId,
  entityName,
  remainingAmount,
  branchId,
  mergedEntityIds,
  nested = false,
}: DebtAdditionDialogProps) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [paymentSource, setPaymentSource] = useState<string>('outside');
  const [transactionDate, setTransactionDate] = useState(() => {
    const now = new Date();
    now.setSeconds(0, 0);
    return now;
  });
  const createPayment = useCreateDebtPayment();
  const queryClient = useQueryClient();
  const { data: customPaymentSources = [] } = useCustomPaymentSources();
  const isCustomer = entityType === 'customer';

  const allPaymentSources = [
    { value: 'outside', label: 'Tiền ngoài (không ghi sổ quỹ)' },
    { value: 'cash', label: 'Tiền mặt' },
    { value: 'bank', label: 'Chuyển khoản' },
    ...customPaymentSources.map((s: any) => ({ value: s.source_key, label: s.name })),
  ];

  const resetForm = () => {
    setAmount('');
    setReason('');
    setPaymentSource('outside');
    const now = new Date();
    now.setSeconds(0, 0);
    setTransactionDate(now);
  };

  const handleDialogOpenChange = createSafeDialogOpenChange(onOpenChange, resetForm);

  useEffect(() => {
    if (!open) {
      forceReleaseStuckInteraction();
    }
  }, [open]);

  const handleSubmit = async () => {
    const numAmount = parseFormattedNumber(amount);

    if (numAmount <= 0) {
      toast.error('Vui lòng nhập số tiền');
      return;
    }

    if (!reason.trim()) {
      toast.error('Vui lòng nhập lý do cộng nợ');
      return;
    }

    try {
      const created: any = await createPayment.mutateAsync({
        entity_type: entityType,
        entity_id: entityId,
        entity_name: entityName,
        payment_type: 'addition',
        amount: numAmount,
        remaining_amount: remainingAmount,
        description: reason,
        branch_id: branchId,
        payment_source: paymentSource === 'outside' ? undefined : paymentSource,
        transaction_date: transactionDate.toISOString(),
      });

      // Sync cash_book if user picked a real payment source
      // Logic đảo chiều:
      //  - Thêm nợ NCC (mình mượn NCC)  → THU VÀO sổ quỹ (income)
      //  - Thêm nợ Khách (cho khách mượn) → CHI RA sổ quỹ (expense)
      if (paymentSource && paymentSource !== 'outside' && created?.id) {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: tenantId } = await supabase.rpc('get_user_tenant_id_secure');
        const { data: staffProfile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('user_id', user?.id)
          .maybeSingle();
        const staffName = staffProfile?.display_name || user?.email || null;

        const cashType = isCustomer ? 'expense' as const : 'income' as const;
        const category = isCustomer
          ? 'Cho khách mượn (thêm công nợ)'
          : 'Mượn tiền NCC (thêm công nợ)';
        const desc = isCustomer
          ? `Cho ${entityName} mượn - ghi công nợ ${numAmount.toLocaleString('vi-VN')}đ`
          : `Mượn tiền NCC ${entityName} - ghi công nợ ${numAmount.toLocaleString('vi-VN')}đ`;

        const { error: cashErr } = await supabase.from('cash_book').insert([{
          type: cashType,
          amount: numAmount,
          category,
          description: desc,
          payment_source: paymentSource,
          branch_id: branchId,
          created_by: user?.id,
          created_by_name: staffName,
          recipient_name: entityName,
          tenant_id: tenantId,
          is_business_accounting: false,
          reference_id: created.id,
          reference_type: 'debt_addition',
          transaction_date: transactionDate.toISOString(),
        }]);
        if (cashErr) {
          console.error('Cash book insert error:', cashErr);
          toast.error('Đã ghi nợ nhưng lỗi đồng bộ sổ quỹ');
        }

        queryClient.removeQueries({ queryKey: ['cash-book'] });
        queryClient.removeQueries({ queryKey: ['cash-book-balances'] });
      }

      toast.success('Đã cộng thêm nợ');
      handleDialogOpenChange(false);
    } catch (error) {
      toast.error('Có lỗi xảy ra');
    }
  };

  const numAmount = parseFormattedNumber(amount);
  const isOutside = paymentSource === 'outside';

  return (
    <Dialog modal open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        className="max-w-md z-[60]"
        onCloseAutoFocus={preventDialogAutoFocus}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Cộng thêm nợ
          </DialogTitle>
          <DialogDescription>
            Thêm công nợ ngoài đơn hàng cho {isCustomer ? 'khách hàng' : 'nhà cung cấp'}: <span className="font-semibold">{entityName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Transaction date/time */}
          <div className="space-y-2">
            <Label>Ngày / Giờ giao dịch</Label>
            <Input
              type="datetime-local"
              value={format(transactionDate, "yyyy-MM-dd'T'HH:mm")}
              onChange={(e) => {
                const val = e.target.value;
                if (val) setTransactionDate(new Date(val));
              }}
              className="block"
            />
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Số tiền <span className="text-destructive">*</span></Label>
            <Input
              id="amount"
              placeholder="Nhập số tiền"
              value={amount}
              onChange={(e) => setAmount(formatInputNumber(e.target.value))}
            />
          </div>

          {/* Payment source */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Wallet className="h-3.5 w-3.5" />
              Nguồn tiền
            </Label>
            <Select value={paymentSource} onValueChange={setPaymentSource}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allPaymentSources.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isOutside && (
              <p className="text-xs text-muted-foreground">
                {isCustomer
                  ? 'Sẽ ghi CHI vào sổ quỹ (cho khách mượn).'
                  : 'Sẽ ghi THU vào sổ quỹ (mình mượn NCC).'}
              </p>
            )}
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Lý do cộng nợ <span className="text-destructive">*</span></Label>
            <Textarea
              id="reason"
              placeholder="Nhập lý do..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>

          {/* Preview */}
          {numAmount > 0 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                Số tiền <span className="font-semibold text-destructive">+{formatNumber(numAmount)}</span> sẽ được cộng thêm vào công nợ của {entityName}
                {!isOutside && (
                  <>
                    {' '}và {isCustomer ? 'CHI ra' : 'THU vào'} sổ quỹ ({allPaymentSources.find(s => s.value === paymentSource)?.label}).
                  </>
                )}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleDialogOpenChange(false)}>
            Hủy
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createPayment.isPending || numAmount <= 0 || !reason.trim()}
          >
            {createPayment.isPending ? 'Đang xử lý...' : 'Xác nhận cộng nợ'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
