import { useState, useMemo } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2, Wallet } from 'lucide-react';
import { useCustomPaymentSources } from '@/hooks/useCustomPaymentSources';

interface PaymentSource {
  id: string;
  source: string;
  amount: string;
}

interface DebtPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: 'customer' | 'supplier';
  entityId: string;
  entityName: string;
  remainingAmount: number;
  branchId: string | null;
  mergedEntityIds?: string[];
}

const BUILT_IN_PAYMENT_SOURCES = [
  { value: 'cash', label: 'Tiền mặt' },
  { value: 'bank_card', label: 'Thẻ ngân hàng' },
  { value: 'e_wallet', label: 'Ví điện tử' },
];

export function DebtPaymentDialog({
  open,
  onOpenChange,
  entityType,
  entityId,
  entityName,
  remainingAmount,
  branchId,
}: DebtPaymentDialogProps) {
  const { data: customPaymentSources = [] } = useCustomPaymentSources();

  const allPaymentSources = useMemo(() => {
    const custom = customPaymentSources.map(s => ({
      value: s.id,
      label: s.name,
    }));
    return [...BUILT_IN_PAYMENT_SOURCES, ...custom];
  }, [customPaymentSources]);

  const [paymentSources, setPaymentSources] = useState<PaymentSource[]>([
    { id: '1', source: 'cash', amount: '' },
  ]);
  const [description, setDescription] = useState('');
  const createPayment = useCreateDebtPayment();

  const totalPayment = paymentSources.reduce(
    (sum, ps) => sum + parseFormattedNumber(ps.amount),
    0
  );

  const handleAddSource = () => {
    setPaymentSources([
      ...paymentSources,
      { id: Date.now().toString(), source: 'cash', amount: '' },
    ]);
  };

  const handleRemoveSource = (id: string) => {
    if (paymentSources.length > 1) {
      setPaymentSources(paymentSources.filter((ps) => ps.id !== id));
    }
  };

  const handleSourceChange = (id: string, field: 'source' | 'amount', value: string) => {
    setPaymentSources(
      paymentSources.map((ps) =>
        ps.id === id
          ? { ...ps, [field]: field === 'amount' ? formatInputNumber(value) : value }
          : ps
      )
    );
  };

  const handlePayFullAmount = () => {
    setPaymentSources([
      { id: '1', source: 'cash', amount: formatNumber(remainingAmount) },
    ]);
  };

  const handleSubmit = async () => {
    if (totalPayment <= 0) {
      toast.error('Vui lòng nhập số tiền thanh toán');
      return;
    }

    if (totalPayment > remainingAmount) {
      toast.error('Số tiền thanh toán không được vượt quá số nợ còn lại');
      return;
    }

    const defaultDescription = entityType === 'customer'
      ? `Thu nợ từ khách hàng ${entityName}`
      : `Trả nợ cho nhà cung cấp ${entityName}`;

    try {
      // Create payment for each source
      let currentRemaining = remainingAmount;
      for (const ps of paymentSources) {
        const amount = parseFormattedNumber(ps.amount);
        if (amount > 0) {
          await createPayment.mutateAsync({
            entity_type: entityType,
            entity_id: entityId,
            entity_name: entityName,
            payment_type: 'payment',
            amount,
            remaining_amount: currentRemaining,
            payment_source: ps.source,
            description: description || defaultDescription,
            branch_id: branchId,
          });
          currentRemaining -= amount;
        }
      }

      toast.success(
        entityType === 'customer'
          ? 'Thu nợ thành công'
          : 'Trả nợ thành công'
      );
      onOpenChange(false);
      resetForm();
    } catch (error) {
      toast.error('Có lỗi xảy ra');
    }
  };

  const resetForm = () => {
    setPaymentSources([{ id: '1', source: 'cash', amount: '' }]);
    setDescription('');
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) resetForm();
      onOpenChange(open);
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            {entityType === 'customer' ? 'Thu nợ khách hàng' : 'Trả nợ nhà cung cấp'}
          </DialogTitle>
          <DialogDescription>
            {entityName} - Còn nợ: <span className="font-semibold text-destructive">{formatNumber(remainingAmount)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Quick pay full */}
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handlePayFullAmount}
          >
            {entityType === 'customer' ? 'Thu hết' : 'Trả hết'} {formatNumber(remainingAmount)}
          </Button>

          {/* Payment sources */}
          <div className="space-y-3">
            <Label>Nguồn tiền</Label>
            {paymentSources.map((ps, index) => (
              <Card key={ps.id}>
                <CardContent className="p-3">
                  <div className="flex gap-2 items-start">
                    <Select
                      value={ps.source}
                      onValueChange={(value) => handleSourceChange(ps.id, 'source', value)}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        {allPaymentSources.map((source) => (
                          <SelectItem key={source.value} value={source.value}>
                            {source.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Số tiền"
                      value={ps.amount}
                      onChange={(e) => handleSourceChange(ps.id, 'amount', e.target.value)}
                      className="flex-1"
                    />
                    {paymentSources.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveSource(ps.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddSource}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Thêm nguồn tiền
            </Button>
          </div>

          {/* Total */}
          <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
            <span className="font-medium">Tổng thanh toán:</span>
            <span className="text-lg font-bold text-primary">{formatNumber(totalPayment)}</span>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Nội dung giao dịch</Label>
            <Textarea
              id="description"
              placeholder={entityType === 'customer' ? 'Thu nợ...' : 'Trả nợ...'}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createPayment.isPending || totalPayment <= 0}
          >
            {createPayment.isPending ? 'Đang xử lý...' : 'Xác nhận'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
