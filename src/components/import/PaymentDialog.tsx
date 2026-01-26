import { useState, useEffect } from 'react';
import { PaymentSource } from '@/types/warehouse';
import { formatCurrency } from '@/lib/mockData';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Banknote, CreditCard, Wallet, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaymentDialogProps {
  open: boolean;
  onClose: () => void;
  totalAmount: number;
  onConfirm: (payments: PaymentSource[]) => void;
  isSubmitting?: boolean;
}

type PaymentType = 'cash' | 'bank_card' | 'e_wallet' | 'debt';

const paymentOptions: { type: PaymentType; label: string; icon: React.ReactNode }[] = [
  { type: 'cash', label: 'Tiền mặt', icon: <Banknote className="h-5 w-5" /> },
  { type: 'bank_card', label: 'Thẻ ngân hàng', icon: <CreditCard className="h-5 w-5" /> },
  { type: 'e_wallet', label: 'Ví điện tử', icon: <Wallet className="h-5 w-5" /> },
  { type: 'debt', label: 'Công nợ', icon: <Clock className="h-5 w-5" /> },
];

export function PaymentDialog({ open, onClose, totalAmount, onConfirm, isSubmitting = false }: PaymentDialogProps) {
  const [selectedTypes, setSelectedTypes] = useState<PaymentType[]>(['cash']);
  const [amounts, setAmounts] = useState<Record<PaymentType, number>>({
    cash: totalAmount,
    bank_card: 0,
    e_wallet: 0,
    debt: 0,
  });

  useEffect(() => {
    if (open) {
      setSelectedTypes(['cash']);
      setAmounts({
        cash: totalAmount,
        bank_card: 0,
        e_wallet: 0,
        debt: 0,
      });
    }
  }, [open, totalAmount]);

  const togglePaymentType = (type: PaymentType) => {
    if (selectedTypes.includes(type)) {
      if (selectedTypes.length === 1) return; // Keep at least one
      setSelectedTypes(selectedTypes.filter((t) => t !== type));
      setAmounts({ ...amounts, [type]: 0 });
    } else {
      setSelectedTypes([...selectedTypes, type]);
    }
  };

  const totalPaid = selectedTypes.reduce((sum, type) => sum + (amounts[type] || 0), 0);
  const isValid = totalPaid === totalAmount;
  const difference = totalPaid - totalAmount;

  const handleConfirm = () => {
    const payments: PaymentSource[] = selectedTypes
      .filter((type) => amounts[type] > 0)
      .map((type) => ({ type, amount: amounts[type] }));
    onConfirm(payments);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Thanh toán phiếu nhập</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="rounded-lg bg-primary/5 p-4">
            <p className="text-sm text-muted-foreground">Tổng tiền phiếu nhập</p>
            <p className="text-2xl font-bold text-primary">{formatCurrency(totalAmount)}</p>
          </div>

          <div className="space-y-3">
            <Label>Chọn nguồn thanh toán (có thể chọn nhiều)</Label>
            <div className="grid grid-cols-2 gap-3">
              {paymentOptions.map((option) => (
                <button
                  key={option.type}
                  onClick={() => togglePaymentType(option.type)}
                  className={cn(
                    'flex items-center gap-2 p-3 rounded-lg border transition-all',
                    selectedTypes.includes(option.type)
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border hover:border-muted-foreground'
                  )}
                >
                  {option.icon}
                  <span className="text-sm font-medium">{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label>Nhập số tiền cho từng nguồn</Label>
            {selectedTypes.map((type) => {
              const option = paymentOptions.find((o) => o.type === type)!;
              return (
                <div key={type} className="flex items-center gap-3">
                  <div className="flex items-center gap-2 w-32">
                    {option.icon}
                    <span className="text-sm">{option.label}</span>
                  </div>
                  <Input
                    type="number"
                    value={amounts[type] || ''}
                    onChange={(e) =>
                      setAmounts({ ...amounts, [type]: Number(e.target.value) || 0 })
                    }
                    className="flex-1"
                    placeholder="0"
                  />
                </div>
              );
            })}
          </div>

          <div className="rounded-lg border p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tổng đã nhập:</span>
              <span className="font-medium">{formatCurrency(totalPaid)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Cần thanh toán:</span>
              <span className="font-medium">{formatCurrency(totalAmount)}</span>
            </div>
            {!isValid && (
              <div
                className={cn(
                  'flex items-center gap-2 text-sm pt-2 border-t',
                  difference > 0 ? 'text-warning' : 'text-destructive'
                )}
              >
                <AlertCircle className="h-4 w-4" />
                <span>
                  {difference > 0
                    ? `Thừa ${formatCurrency(difference)}`
                    : `Thiếu ${formatCurrency(Math.abs(difference))}`}
                </span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Huỷ
          </Button>
          <Button onClick={handleConfirm} disabled={!isValid || isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang xử lý...
              </>
            ) : (
              'Xác nhận thanh toán'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
