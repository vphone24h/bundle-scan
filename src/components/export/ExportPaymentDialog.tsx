import { useState, useEffect } from 'react';
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
import { Banknote, CreditCard, Wallet, FileText } from 'lucide-react';
import type { ExportPayment } from '@/hooks/useExportReceipts';

interface ExportPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalAmount: number;
  onConfirm: (payments: ExportPayment[]) => void;
  isLoading?: boolean;
}

const paymentTypes = [
  { type: 'cash' as const, label: 'Tiền mặt', icon: Banknote },
  { type: 'bank_card' as const, label: 'Thẻ ngân hàng', icon: CreditCard },
  { type: 'e_wallet' as const, label: 'Ví điện tử', icon: Wallet },
  { type: 'debt' as const, label: 'Công nợ', icon: FileText },
];

export function ExportPaymentDialog({
  open,
  onOpenChange,
  totalAmount,
  onConfirm,
  isLoading,
}: ExportPaymentDialogProps) {
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['cash']);
  const [amounts, setAmounts] = useState<Record<string, string>>({
    cash: totalAmount.toString(),
    bank_card: '',
    e_wallet: '',
    debt: '',
  });

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedTypes(['cash']);
      setAmounts({
        cash: totalAmount.toString(),
        bank_card: '',
        e_wallet: '',
        debt: '',
      });
    }
  }, [open, totalAmount]);

  const togglePaymentType = (type: string) => {
    if (selectedTypes.includes(type)) {
      setSelectedTypes(selectedTypes.filter((t) => t !== type));
      setAmounts({ ...amounts, [type]: '' });
    } else {
      setSelectedTypes([...selectedTypes, type]);
    }
  };

  const handleAmountChange = (type: string, value: string) => {
    setAmounts({ ...amounts, [type]: value });
  };

  // Calculate totals
  const paidTotal = selectedTypes
    .filter((t) => t !== 'debt')
    .reduce((sum, type) => sum + (parseFloat(amounts[type]) || 0), 0);
  
  const debtAmount = parseFloat(amounts.debt) || 0;
  const totalEntered = paidTotal + debtAmount;
  const remaining = totalAmount - totalEntered;

  // Auto-fill remaining to last selected payment
  const handleAutoFill = () => {
    if (remaining > 0 && selectedTypes.length > 0) {
      const lastType = selectedTypes[selectedTypes.length - 1];
      const currentAmount = parseFloat(amounts[lastType]) || 0;
      setAmounts({ ...amounts, [lastType]: (currentAmount + remaining).toString() });
    }
  };

  const handleConfirm = () => {
    const payments: ExportPayment[] = selectedTypes
      .map((type) => ({
        payment_type: type as ExportPayment['payment_type'],
        amount: parseFloat(amounts[type]) || 0,
      }))
      .filter((p) => p.amount > 0);

    onConfirm(payments);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Thanh toán</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Total amount */}
          <div className="p-4 bg-muted rounded-lg text-center">
            <div className="text-sm text-muted-foreground">Tổng tiền cần thanh toán</div>
            <div className="text-2xl font-bold text-primary">
              {totalAmount.toLocaleString('vi-VN')}đ
            </div>
          </div>

          {/* Payment types */}
          <div className="space-y-3">
            {paymentTypes.map(({ type, label, icon: Icon }) => (
              <div key={type} className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={type}
                    checked={selectedTypes.includes(type)}
                    onCheckedChange={() => togglePaymentType(type)}
                  />
                  <Label
                    htmlFor={type}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Label>
                </div>
                {selectedTypes.includes(type) && (
                  <Input
                    type="number"
                    placeholder="Nhập số tiền"
                    value={amounts[type]}
                    onChange={(e) => handleAmountChange(type, e.target.value)}
                    className="ml-6"
                  />
                )}
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="pt-4 border-t space-y-2">
            <div className="flex justify-between text-sm">
              <span>Đã nhập:</span>
              <span className="font-medium">{totalEntered.toLocaleString('vi-VN')}đ</span>
            </div>
            {remaining !== 0 && (
              <div className="flex justify-between text-sm">
                <span>{remaining > 0 ? 'Còn thiếu:' : 'Thừa:'}</span>
                <span className={remaining > 0 ? 'text-destructive font-medium' : 'text-green-600 font-medium'}>
                  {Math.abs(remaining).toLocaleString('vi-VN')}đ
                </span>
              </div>
            )}
            {remaining > 0 && (
              <Button variant="outline" size="sm" onClick={handleAutoFill} className="w-full">
                Điền tự động số còn thiếu
              </Button>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading || remaining > 0 || totalEntered === 0}
          >
            {isLoading ? 'Đang xử lý...' : 'Hoàn tất xuất hàng'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
