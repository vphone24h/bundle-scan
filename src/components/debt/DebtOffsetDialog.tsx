import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { formatNumber } from '@/lib/formatNumber';
import { useExecuteDebtOffset, DebtOffsetMatch } from '@/hooks/useDebtOffset';
import { toast } from 'sonner';
import { ArrowLeftRight, CheckCircle } from 'lucide-react';

interface DebtOffsetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: DebtOffsetMatch;
}

export function DebtOffsetDialog({ open, onOpenChange, match }: DebtOffsetDialogProps) {
  const [note, setNote] = useState('');
  const executeOffset = useExecuteDebtOffset();

  const customerDebt = match.customerDebt.remaining_amount;
  const supplierDebt = match.supplierDebt.remaining_amount;
  const offsetAmount = Math.min(customerDebt, supplierDebt);
  const customerDebtAfter = customerDebt - offsetAmount;
  const supplierDebtAfter = supplierDebt - offsetAmount;

  const handleConfirm = async () => {
    try {
      await executeOffset.mutateAsync({
        customerEntityId: match.customerDebt.entity_id,
        supplierEntityId: match.supplierDebt.entity_id,
        customerName: match.customerDebt.entity_name,
        supplierName: match.supplierDebt.entity_name,
        customerDebtBefore: customerDebt,
        supplierDebtBefore: supplierDebt,
        offsetAmount,
        customerBranchId: match.customerDebt.branch_id,
        supplierBranchId: match.supplierDebt.branch_id,
        supplierMergedEntityIds: match.supplierDebt.merged_entity_ids,
        note: note || undefined,
      });
      toast.success(`Bù trừ thành công ${formatNumber(offsetAmount)}đ`);
      onOpenChange(false);
    } catch (err: any) {
      toast.error('Lỗi bù trừ: ' + (err.message || 'Không xác định'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-primary" />
            Bù trừ công nợ
          </DialogTitle>
          <DialogDescription>
            Bù trừ công nợ 2 chiều giữa khách hàng và nhà cung cấp cùng SĐT
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Entity info */}
          <div className="rounded-lg border p-3 bg-muted/30 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Đối tượng:</span>
              <span className="font-medium">{match.customerDebt.entity_name}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">SĐT:</span>
              <span className="font-medium">{match.matchedPhone}</span>
            </div>
          </div>

          {/* Before offset */}
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-md border p-3 bg-green-50/50">
              <span className="text-sm">Khách nợ bạn:</span>
              <span className="font-bold text-green-600">{formatNumber(customerDebt)}đ</span>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3 bg-red-50/50">
              <span className="text-sm">Bạn nợ NCC:</span>
              <span className="font-bold text-destructive">{formatNumber(supplierDebt)}đ</span>
            </div>
          </div>

          {/* Offset amount */}
          <div className="flex items-center justify-between rounded-md border-2 border-primary/50 p-3 bg-primary/5">
            <span className="text-sm font-medium">Số tiền bù trừ:</span>
            <span className="font-bold text-lg text-primary">{formatNumber(offsetAmount)}đ</span>
          </div>

          {/* After offset */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sau bù trừ</p>
            <div className="flex items-center justify-between rounded-md border p-3">
              <span className="text-sm">Khách còn nợ:</span>
              <span className={`font-bold ${customerDebtAfter > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                {customerDebtAfter > 0 ? `${formatNumber(customerDebtAfter)}đ` : '0đ ✓'}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <span className="text-sm">Bạn còn nợ NCC:</span>
              <span className={`font-bold ${supplierDebtAfter > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                {supplierDebtAfter > 0 ? `${formatNumber(supplierDebtAfter)}đ` : '0đ ✓'}
              </span>
            </div>
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <Label className="text-sm">Ghi chú (tùy chọn)</Label>
            <Textarea
              placeholder="Thêm ghi chú cho giao dịch bù trừ..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button onClick={handleConfirm} disabled={executeOffset.isPending}>
            <CheckCircle className="mr-2 h-4 w-4" />
            {executeOffset.isPending ? 'Đang xử lý...' : 'Xác nhận bù trừ'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
