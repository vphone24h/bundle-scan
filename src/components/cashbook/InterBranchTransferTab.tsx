import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useTransferFundsBetweenBranches } from '@/hooks/useCashBook';
import { formatCurrency } from '@/lib/mockData';
import { formatInputNumber, parseFormattedNumber } from '@/lib/formatNumber';

interface InterBranchTransferTabProps {
  paymentSources: { id: string; name: string }[];
  branches?: { id: string; name: string; is_default?: boolean | null }[];
  onClose: () => void;
}

interface TransferLine {
  paymentSource: string;
  amount: string;
}

export function InterBranchTransferTab({
  paymentSources,
  branches,
  onClose,
}: InterBranchTransferTabProps) {
  const transferFunds = useTransferFundsBetweenBranches();

  const [fromBranchId, setFromBranchId] = useState('');
  const [toBranchId, setToBranchId] = useState('');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<TransferLine[]>([
    { paymentSource: 'cash', amount: '' },
  ]);

  const getBranchName = (id: string) => branches?.find(b => b.id === id)?.name || id;
  const getSourceName = (id: string) => paymentSources.find(s => s.id === id)?.name || id;

  const addLine = () => {
    // Find first source not already used
    const usedSources = lines.map(l => l.paymentSource);
    const available = paymentSources.find(s => !usedSources.includes(s.id));
    if (!available) {
      toast({ title: 'Đã thêm hết nguồn tiền', variant: 'destructive' });
      return;
    }
    setLines([...lines, { paymentSource: available.id, amount: '' }]);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: keyof TransferLine, value: string) => {
    const updated = [...lines];
    updated[index] = { ...updated[index], [field]: value };
    setLines(updated);
  };

  const totalAmount = lines.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);

  const handleTransfer = async () => {
    if (!fromBranchId || !toBranchId) {
      toast({ title: 'Thiếu chi nhánh', description: 'Vui lòng chọn chi nhánh nguồn và đích', variant: 'destructive' });
      return;
    }
    if (fromBranchId === toBranchId) {
      toast({ title: 'Lỗi', description: 'Chi nhánh nguồn và đích không được trùng nhau', variant: 'destructive' });
      return;
    }

    const validLines = lines.filter(l => {
      const amt = parseFloat(l.amount);
      return !isNaN(amt) && amt > 0;
    });

    if (validLines.length === 0) {
      toast({ title: 'Số tiền không hợp lệ', description: 'Vui lòng nhập ít nhất 1 dòng tiền > 0', variant: 'destructive' });
      return;
    }

    try {
      // Execute all transfer lines
      for (const line of validLines) {
        await transferFunds.mutateAsync({
          fromBranchId,
          toBranchId,
          fromBranchName: getBranchName(fromBranchId),
          toBranchName: getBranchName(toBranchId),
          paymentSource: line.paymentSource,
          paymentSourceName: getSourceName(line.paymentSource),
          amount: parseFloat(line.amount),
          note: note || undefined,
        });
      }

      const summary = validLines.map(l => `${getSourceName(l.paymentSource)}: ${formatCurrency(parseFloat(l.amount))}`).join(', ');
      toast({
        title: 'Chuyển tiền liên chi nhánh thành công',
        description: `${getBranchName(fromBranchId)} → ${getBranchName(toBranchId)} | ${summary}`,
      });
      onClose();
      setFromBranchId('');
      setToBranchId('');
      setNote('');
      setLines([{ paymentSource: 'cash', amount: '' }]);
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message || 'Không thể thực hiện chuyển tiền', variant: 'destructive' });
    }
  };

  if (!branches || branches.length < 2) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Cần ít nhất 2 chi nhánh để sử dụng tính năng này.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="space-y-4 overflow-y-auto flex-1 pr-1">
        <div className="space-y-2">
          <Label>Từ chi nhánh</Label>
          <Select value={fromBranchId} onValueChange={setFromBranchId}>
            <SelectTrigger><SelectValue placeholder="Chọn chi nhánh nguồn" /></SelectTrigger>
            <SelectContent>
              {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex justify-center">
          <div className="p-2 rounded-full bg-primary/10"><ArrowRight className="h-5 w-5 text-primary" /></div>
        </div>

        <div className="space-y-2">
          <Label>Đến chi nhánh</Label>
          <Select value={toBranchId} onValueChange={setToBranchId}>
            <SelectTrigger><SelectValue placeholder="Chọn chi nhánh đích" /></SelectTrigger>
            <SelectContent>
              {branches.filter(b => b.id !== fromBranchId).map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Multiple transfer lines */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Dòng tiền chuyển</Label>
            {lines.length < paymentSources.length && (
              <Button type="button" variant="ghost" size="sm" onClick={addLine} className="h-7 text-xs gap-1">
                <Plus className="h-3.5 w-3.5" /> Thêm nguồn
              </Button>
            )}
          </div>

          {lines.map((line, index) => (
            <div key={index} className="flex gap-2 items-start">
              <div className="flex-1 space-y-1">
                <Select value={line.paymentSource} onValueChange={(v) => updateLine(index, 'paymentSource', v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {paymentSources.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Input
                  type="number"
                  placeholder="Số tiền"
                  className="h-9"
                  value={line.amount}
                  onChange={(e) => updateLine(index, 'amount', e.target.value)}
                />
              </div>
              {lines.length > 1 && (
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => removeLine(index)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}

          {totalAmount > 0 && (
            <div className="text-xs p-2 rounded bg-muted font-medium">
              Tổng chuyển: <span className="text-primary">{formatCurrency(totalAmount)}</span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>Ghi chú (tùy chọn)</Label>
          <Textarea placeholder="VD: Chuyển tiền bán hàng CN Dĩ An về CN chính..." value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
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
