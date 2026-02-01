import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useCreateCashBookEntry } from '@/hooks/useCashBook';
import { formatCurrency } from '@/lib/mockData';

interface TransferFundsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentSources: { id: string; name: string }[];
  balanceBySource: Record<string, number>;
  branches?: { id: string; name: string; is_default?: boolean | null }[];
  viewMode: 'branch' | 'total';
  selectedBranchId?: string;
}

export function TransferFundsDialog({
  open,
  onOpenChange,
  paymentSources,
  balanceBySource,
  branches,
  viewMode,
  selectedBranchId,
}: TransferFundsDialogProps) {
  const createEntry = useCreateCashBookEntry();
  
  const defaultBranch = branches?.find(b => b.is_default) || branches?.[0];
  
  const [formData, setFormData] = useState({
    fromSource: 'cash',
    toSource: 'bank_card',
    amount: '',
    note: '',
    branchId: selectedBranchId || defaultBranch?.id || '',
  });

  const handleTransfer = async () => {
    const amount = parseFloat(formData.amount);
    
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: 'Số tiền không hợp lệ',
        description: 'Vui lòng nhập số tiền lớn hơn 0',
        variant: 'destructive',
      });
      return;
    }

    if (formData.fromSource === formData.toSource) {
      toast({
        title: 'Lỗi',
        description: 'Nguồn chuyển và nguồn nhận không được trùng nhau',
        variant: 'destructive',
      });
      return;
    }

    const fromBalance = balanceBySource[formData.fromSource] || 0;
    if (amount > fromBalance) {
      toast({
        title: 'Số dư không đủ',
        description: `Số dư ${getSourceName(formData.fromSource)}: ${formatCurrency(fromBalance)}`,
        variant: 'destructive',
      });
      return;
    }

    if (viewMode === 'total' && !formData.branchId) {
      toast({
        title: 'Thiếu chi nhánh',
        description: 'Vui lòng chọn chi nhánh để ghi nhận giao dịch',
        variant: 'destructive',
      });
      return;
    }

    const branchId = viewMode === 'branch' ? selectedBranchId : formData.branchId;
    const fromName = getSourceName(formData.fromSource);
    const toName = getSourceName(formData.toSource);
    const noteText = formData.note ? ` - ${formData.note}` : '';

    try {
      // Tạo 2 giao dịch: CHI từ nguồn A và THU vào nguồn B
      // Cả 2 đều là is_business_accounting = false vì không ảnh hưởng lợi nhuận
      await Promise.all([
        // Chi từ nguồn gốc
        createEntry.mutateAsync({
          type: 'expense',
          category: 'Chuyển tiền nội bộ',
          description: `Chuyển tiền: ${fromName} → ${toName}${noteText}`,
          amount,
          payment_source: formData.fromSource,
          is_business_accounting: false,
          branch_id: branchId || null,
          note: `Chuyển ${formatCurrency(amount)} sang ${toName}`,
        }),
        // Thu vào nguồn đích
        createEntry.mutateAsync({
          type: 'income',
          category: 'Chuyển tiền nội bộ',
          description: `Nhận tiền: ${fromName} → ${toName}${noteText}`,
          amount,
          payment_source: formData.toSource,
          is_business_accounting: false,
          branch_id: branchId || null,
          note: `Nhận ${formatCurrency(amount)} từ ${fromName}`,
        }),
      ]);

      toast({
        title: 'Chuyển tiền thành công',
        description: `${formatCurrency(amount)}: ${fromName} → ${toName}`,
      });

      onOpenChange(false);
      // Reset form
      setFormData({
        fromSource: 'cash',
        toSource: 'bank_card',
        amount: '',
        note: '',
        branchId: selectedBranchId || defaultBranch?.id || '',
      });
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể thực hiện chuyển tiền',
        variant: 'destructive',
      });
    }
  };

  const getSourceName = (sourceId: string) => {
    return paymentSources.find(s => s.id === sourceId)?.name || sourceId;
  };

  const fromBalance = balanceBySource[formData.fromSource] || 0;
  const toBalance = balanceBySource[formData.toSource] || 0;
  const transferAmount = parseFloat(formData.amount) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Chuyển tiền giữa các nguồn
          </DialogTitle>
          <DialogDescription>
            Chuyển dòng tiền qua lại giữa Tiền mặt, Ngân hàng, Ví điện tử...
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* From Source */}
          <div className="space-y-2">
            <Label>Từ nguồn tiền</Label>
            <Select 
              value={formData.fromSource} 
              onValueChange={(v) => setFormData({ ...formData, fromSource: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {paymentSources.map(source => (
                  <SelectItem key={source.id} value={source.id}>
                    {source.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Số dư hiện tại: <span className="font-medium text-foreground">{formatCurrency(fromBalance)}</span>
            </p>
          </div>

          {/* Arrow indicator */}
          <div className="flex justify-center">
            <div className="p-2 rounded-full bg-primary/10">
              <ArrowRight className="h-5 w-5 text-primary" />
            </div>
          </div>

          {/* To Source */}
          <div className="space-y-2">
            <Label>Đến nguồn tiền</Label>
            <Select 
              value={formData.toSource} 
              onValueChange={(v) => setFormData({ ...formData, toSource: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {paymentSources.filter(s => s.id !== formData.fromSource).map(source => (
                  <SelectItem key={source.id} value={source.id}>
                    {source.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Số dư hiện tại: <span className="font-medium text-foreground">{formatCurrency(toBalance)}</span>
            </p>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label>Số tiền chuyển</Label>
            <Input
              type="number"
              placeholder="0"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            />
            {transferAmount > 0 && (
              <div className="text-xs space-y-1 p-2 rounded bg-muted">
                <p>
                  <span className="text-muted-foreground">{getSourceName(formData.fromSource)}:</span>{' '}
                  <span className="text-destructive">{formatCurrency(fromBalance)} → {formatCurrency(fromBalance - transferAmount)}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">{getSourceName(formData.toSource)}:</span>{' '}
                  <span className="text-green-600">{formatCurrency(toBalance)} → {formatCurrency(toBalance + transferAmount)}</span>
                </p>
              </div>
            )}
          </div>

          {/* Branch selection (only in total view) */}
          {viewMode === 'total' && branches && branches.length > 0 && (
            <div className="space-y-2">
              <Label>Chi nhánh ghi nhận</Label>
              <Select 
                value={formData.branchId} 
                onValueChange={(v) => setFormData({ ...formData, branchId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn chi nhánh" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map(branch => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Note */}
          <div className="space-y-2">
            <Label>Ghi chú (tùy chọn)</Label>
            <Textarea
              placeholder="Lý do chuyển tiền..."
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button 
            onClick={handleTransfer} 
            disabled={createEntry.isPending}
          >
            {createEntry.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Xác nhận chuyển
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
