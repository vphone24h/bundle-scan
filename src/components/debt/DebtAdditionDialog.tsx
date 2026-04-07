import { useEffect, useState } from 'react';
import { useCreateDebtPayment } from '@/hooks/useDebt';
import { formatNumber, parseFormattedNumber, formatInputNumber } from '@/lib/formatNumber';
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
import { Plus } from 'lucide-react';
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
  const [transactionDate, setTransactionDate] = useState(() => {
    const now = new Date();
    now.setSeconds(0, 0);
    return now;
  });
  const createPayment = useCreateDebtPayment();

  const resetForm = () => {
    setAmount('');
    setReason('');
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
      await createPayment.mutateAsync({
        entity_type: entityType,
        entity_id: entityId,
        entity_name: entityName,
        payment_type: 'addition',
        amount: numAmount,
        remaining_amount: remainingAmount,
        description: reason,
        branch_id: branchId,
        transaction_date: transactionDate.toISOString(),
      });

      toast.success('Đã cộng thêm nợ');
      handleDialogOpenChange(false);
    } catch (error) {
      toast.error('Có lỗi xảy ra');
    }
  };

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
            Thêm công nợ ngoài đơn hàng cho {entityType === 'customer' ? 'khách hàng' : 'nhà cung cấp'}: <span className="font-semibold">{entityName}</span>
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
          {parseFormattedNumber(amount) > 0 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                Số tiền <span className="font-semibold text-destructive">+{formatNumber(parseFormattedNumber(amount))}</span> sẽ được cộng thêm vào công nợ của {entityName}
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
            disabled={createPayment.isPending || parseFormattedNumber(amount) <= 0 || !reason.trim()}
          >
            {createPayment.isPending ? 'Đang xử lý...' : 'Xác nhận cộng nợ'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
