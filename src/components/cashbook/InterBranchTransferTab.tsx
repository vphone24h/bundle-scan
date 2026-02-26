import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useTransferFundsBetweenBranches } from '@/hooks/useCashBook';
import { formatCurrency } from '@/lib/mockData';

interface InterBranchTransferTabProps {
  paymentSources: { id: string; name: string }[];
  branches?: { id: string; name: string; is_default?: boolean | null }[];
  onClose: () => void;
}

export function InterBranchTransferTab({
  paymentSources,
  branches,
  onClose,
}: InterBranchTransferTabProps) {
  const transferFunds = useTransferFundsBetweenBranches();

  const [formData, setFormData] = useState({
    fromBranchId: '',
    toBranchId: '',
    paymentSource: 'cash',
    amount: '',
    note: '',
  });

  const getBranchName = (id: string) => branches?.find(b => b.id === id)?.name || id;
  const getSourceName = (id: string) => paymentSources.find(s => s.id === id)?.name || id;

  const handleTransfer = async () => {
    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: 'Số tiền không hợp lệ', description: 'Vui lòng nhập số tiền lớn hơn 0', variant: 'destructive' });
      return;
    }
    if (!formData.fromBranchId || !formData.toBranchId) {
      toast({ title: 'Thiếu chi nhánh', description: 'Vui lòng chọn chi nhánh nguồn và chi nhánh đích', variant: 'destructive' });
      return;
    }
    if (formData.fromBranchId === formData.toBranchId) {
      toast({ title: 'Lỗi', description: 'Chi nhánh nguồn và chi nhánh đích không được trùng nhau', variant: 'destructive' });
      return;
    }

    try {
      await transferFunds.mutateAsync({
        fromBranchId: formData.fromBranchId,
        toBranchId: formData.toBranchId,
        fromBranchName: getBranchName(formData.fromBranchId),
        toBranchName: getBranchName(formData.toBranchId),
        paymentSource: formData.paymentSource,
        paymentSourceName: getSourceName(formData.paymentSource),
        amount,
        note: formData.note || undefined,
      });
      toast({
        title: 'Chuyển tiền liên chi nhánh thành công',
        description: `${formatCurrency(amount)}: ${getBranchName(formData.fromBranchId)} → ${getBranchName(formData.toBranchId)} (${getSourceName(formData.paymentSource)})`,
      });
      onClose();
      setFormData({ fromBranchId: '', toBranchId: '', paymentSource: 'cash', amount: '', note: '' });
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
          <Select value={formData.fromBranchId} onValueChange={(v) => setFormData({ ...formData, fromBranchId: v })}>
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
          <Select value={formData.toBranchId} onValueChange={(v) => setFormData({ ...formData, toBranchId: v })}>
            <SelectTrigger><SelectValue placeholder="Chọn chi nhánh đích" /></SelectTrigger>
            <SelectContent>
              {branches.filter(b => b.id !== formData.fromBranchId).map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Nguồn tiền</Label>
          <Select value={formData.paymentSource} onValueChange={(v) => setFormData({ ...formData, paymentSource: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {paymentSources.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Số tiền chuyển</Label>
          <Input type="number" placeholder="0" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} />
        </div>

        <div className="space-y-2">
          <Label>Ghi chú (tùy chọn)</Label>
          <Textarea placeholder="VD: Chuyển tiền bán hàng CN Dĩ An về CN chính..." value={formData.note} onChange={(e) => setFormData({ ...formData, note: e.target.value })} rows={2} />
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
