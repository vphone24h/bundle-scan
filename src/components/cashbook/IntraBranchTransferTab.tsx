import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useTransferFunds } from '@/hooks/useCashBook';
import { formatCurrency } from '@/lib/mockData';
import { formatInputNumber, parseFormattedNumber } from '@/lib/formatNumber';

interface IntraBranchTransferTabProps {
  paymentSources: { id: string; name: string }[];
  balanceBySource: Record<string, number>;
  branches?: { id: string; name: string; is_default?: boolean | null }[];
  viewMode: 'branch' | 'total';
  selectedBranchId?: string;
  onClose: () => void;
}

export function IntraBranchTransferTab({
  paymentSources,
  balanceBySource,
  branches,
  viewMode,
  selectedBranchId,
  onClose,
}: IntraBranchTransferTabProps) {
  const transferFunds = useTransferFunds();
  const defaultBranch = branches?.find(b => b.is_default) || branches?.[0];

  const [formData, setFormData] = useState({
    fromSource: 'cash',
    toSource: 'bank_card',
    amount: '',
    note: '',
    branchId: selectedBranchId || defaultBranch?.id || '',
  });

  const getSourceName = (sourceId: string) =>
    paymentSources.find(s => s.id === sourceId)?.name || sourceId;

  const handleTransfer = async () => {
    const amount = parseFormattedNumber(formData.amount);
    if (amount <= 0) {
      toast({ title: 'Số tiền không hợp lệ', description: 'Vui lòng nhập số tiền lớn hơn 0', variant: 'destructive' });
      return;
    }
    if (formData.fromSource === formData.toSource) {
      toast({ title: 'Lỗi', description: 'Nguồn chuyển và nguồn nhận không được trùng nhau', variant: 'destructive' });
      return;
    }
    const fromBalance = balanceBySource[formData.fromSource] || 0;
    if (amount > fromBalance) {
      toast({ title: 'Số dư không đủ', description: `Số dư ${getSourceName(formData.fromSource)}: ${formatCurrency(fromBalance)}`, variant: 'destructive' });
      return;
    }
    if (viewMode === 'total' && !formData.branchId) {
      toast({ title: 'Thiếu chi nhánh', description: 'Vui lòng chọn chi nhánh để ghi nhận giao dịch', variant: 'destructive' });
      return;
    }

    const branchId = viewMode === 'branch' ? selectedBranchId : formData.branchId;
    try {
      await transferFunds.mutateAsync({
        fromSource: formData.fromSource,
        toSource: formData.toSource,
        amount,
        note: formData.note || undefined,
        branchId: branchId || null,
        fromSourceName: getSourceName(formData.fromSource),
        toSourceName: getSourceName(formData.toSource),
      });
      toast({ title: 'Chuyển tiền thành công', description: `${formatCurrency(amount)}: ${getSourceName(formData.fromSource)} → ${getSourceName(formData.toSource)}` });
      onClose();
      setFormData({ fromSource: 'cash', toSource: 'bank_card', amount: '', note: '', branchId: selectedBranchId || defaultBranch?.id || '' });
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message || 'Không thể thực hiện chuyển tiền', variant: 'destructive' });
    }
  };

  const fromBalance = balanceBySource[formData.fromSource] || 0;
  const toBalance = balanceBySource[formData.toSource] || 0;
  const transferAmount = parseFormattedNumber(formData.amount);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="space-y-4 overflow-y-auto flex-1 pr-1">
        <div className="space-y-2">
          <Label>Từ nguồn tiền</Label>
          <Select value={formData.fromSource} onValueChange={(v) => setFormData({ ...formData, fromSource: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {paymentSources.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Số dư: <span className="font-medium text-foreground">{formatCurrency(fromBalance)}</span></p>
        </div>

        <div className="flex justify-center">
          <div className="p-2 rounded-full bg-primary/10"><ArrowRight className="h-5 w-5 text-primary" /></div>
        </div>

        <div className="space-y-2">
          <Label>Đến nguồn tiền</Label>
          <Select value={formData.toSource} onValueChange={(v) => setFormData({ ...formData, toSource: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {paymentSources.filter(s => s.id !== formData.fromSource).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Số dư: <span className="font-medium text-foreground">{formatCurrency(toBalance)}</span></p>
        </div>

        <div className="space-y-2">
          <Label>Số tiền chuyển</Label>
          <Input
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={formatInputNumber(formData.amount)}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value.replace(/\D/g, '') })}
          />
          {transferAmount > 0 && (
            <div className="text-xs space-y-1 p-2 rounded bg-muted">
              <p><span className="text-muted-foreground">{getSourceName(formData.fromSource)}:</span>{' '}<span className="text-destructive">{formatCurrency(fromBalance)} → {formatCurrency(fromBalance - transferAmount)}</span></p>
              <p><span className="text-muted-foreground">{getSourceName(formData.toSource)}:</span>{' '}<span className="text-green-600 dark:text-green-400">{formatCurrency(toBalance)} → {formatCurrency(toBalance + transferAmount)}</span></p>
            </div>
          )}
        </div>

        {viewMode === 'total' && branches && branches.length > 0 && (
          <div className="space-y-2">
            <Label>Chi nhánh ghi nhận</Label>
            <Select value={formData.branchId} onValueChange={(v) => setFormData({ ...formData, branchId: v })}>
              <SelectTrigger><SelectValue placeholder="Chọn chi nhánh" /></SelectTrigger>
              <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label>Ghi chú (tùy chọn)</Label>
          <Textarea placeholder="Lý do chuyển tiền..." value={formData.note} onChange={(e) => setFormData({ ...formData, note: e.target.value })} rows={2} />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={onClose}>Hủy</Button>
        <Button onClick={handleTransfer} disabled={transferFunds.isPending}>
          {transferFunds.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Xác nhận chuyển
        </Button>
      </div>
    </div>
  );
}
