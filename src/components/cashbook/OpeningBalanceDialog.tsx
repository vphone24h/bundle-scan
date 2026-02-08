import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/mockData';
import { formatNumberWithSpaces, parseFormattedNumber } from '@/lib/formatNumber';
import { format, startOfMonth, startOfQuarter, startOfYear } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Loader2, Plus, Pencil, Trash2, Landmark, AlertCircle } from 'lucide-react';
import {
  useOpeningBalances,
  useCreateOpeningBalance,
  useUpdateOpeningBalance,
  useDeleteOpeningBalance,
  type OpeningBalance,
} from '@/hooks/useOpeningBalance';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface OpeningBalanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentSources: { id: string; name: string }[];
  hasTransactions: (source: string) => boolean;
}

const periodTypeLabels: Record<string, string> = {
  month: 'Tháng',
  quarter: 'Quý',
  year: 'Năm',
  custom: 'Tùy chỉnh',
};

export function OpeningBalanceDialog({
  open,
  onOpenChange,
  paymentSources,
  hasTransactions,
}: OpeningBalanceDialogProps) {
  const { data: balances, isLoading } = useOpeningBalances();
  const createBalance = useCreateOpeningBalance();
  const updateBalance = useUpdateOpeningBalance();
  const deleteBalance = useDeleteOpeningBalance();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    payment_source: 'cash',
    amount: '',
    period_type: 'custom',
    period_start: format(new Date(), 'yyyy-MM-dd'),
    note: '',
  });

  const resetForm = () => {
    setFormData({
      payment_source: 'cash',
      amount: '',
      period_type: 'custom',
      period_start: format(new Date(), 'yyyy-MM-dd'),
      note: '',
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handlePeriodTypeChange = (type: string) => {
    const now = new Date();
    let periodStart = formData.period_start;
    
    if (type === 'month') {
      periodStart = format(startOfMonth(now), 'yyyy-MM-dd');
    } else if (type === 'quarter') {
      periodStart = format(startOfQuarter(now), 'yyyy-MM-dd');
    } else if (type === 'year') {
      periodStart = format(startOfYear(now), 'yyyy-MM-dd');
    }

    setFormData({ ...formData, period_type: type, period_start: periodStart });
  };

  const handleEdit = (ob: OpeningBalance) => {
    setEditingId(ob.id);
    setFormData({
      payment_source: ob.payment_source,
      amount: formatNumberWithSpaces(ob.amount),
      period_type: ob.period_type,
      period_start: ob.period_start,
      note: ob.note || '',
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    const amount = parseFormattedNumber(formData.amount);
    if (amount < 0) {
      toast({ title: 'Số tiền không hợp lệ', variant: 'destructive' });
      return;
    }
    if (!formData.period_start) {
      toast({ title: 'Vui lòng chọn ngày bắt đầu kỳ', variant: 'destructive' });
      return;
    }

    try {
      if (editingId) {
        await updateBalance.mutateAsync({ id: editingId, amount, note: formData.note });
        toast({ title: 'Đã cập nhật số dư đầu kỳ' });
      } else {
        await createBalance.mutateAsync({
          payment_source: formData.payment_source,
          amount,
          period_type: formData.period_type,
          period_start: formData.period_start,
          note: formData.note,
        });
        toast({ title: 'Đã tạo số dư đầu kỳ' });
      }
      resetForm();
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể lưu số dư đầu kỳ',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteBalance.mutateAsync(deleteConfirmId);
      toast({ title: 'Đã xóa số dư đầu kỳ' });
      setDeleteConfirmId(null);
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể xóa',
        variant: 'destructive',
        
      });
    }
  };

  const sourceNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    paymentSources.forEach((s) => { map[s.id] = s.name; });
    return map;
  }, [paymentSources]);

  const isSubmitting = createBalance.isPending || updateBalance.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5" />
              Quỹ kỳ đầu (Số dư đầu kỳ)
            </DialogTitle>
            <DialogDescription>
              Nhập số tiền thực tế đang có trong từng nguồn tiền tại thời điểm bắt đầu sử dụng phần mềm hoặc bắt đầu kỳ kế toán mới.
            </DialogDescription>
          </DialogHeader>

          {/* Info box */}
          <div className="flex gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <strong>Lưu ý:</strong> Số dư đầu kỳ là điểm xuất phát của sổ quỹ. Nếu nhập sai, toàn bộ số dư sau này sẽ sai. Chỉ Admin mới có quyền tạo/sửa/xóa.
            </div>
          </div>

          {/* Existing balances list */}
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : balances && balances.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nguồn tiền</TableHead>
                    <TableHead>Loại kỳ</TableHead>
                    <TableHead>Ngày bắt đầu</TableHead>
                    <TableHead className="text-right">Số dư đầu kỳ</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {balances.map((ob) => (
                    <TableRow key={ob.id}>
                      <TableCell className="font-medium">
                        {sourceNameMap[ob.payment_source] || ob.payment_source}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{periodTypeLabels[ob.period_type] || ob.period_type}</Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(ob.period_start), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-600">
                        {formatCurrency(ob.amount)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleEdit(ob)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setDeleteConfirmId(ob.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : !showForm ? (
            <div className="text-center py-6 text-muted-foreground">
              Chưa có số dư đầu kỳ nào. Nhấn nút bên dưới để thêm.
            </div>
          ) : null}

          {/* Add/Edit Form */}
          {showForm ? (
            <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
              <h4 className="font-medium">
                {editingId ? 'Sửa số dư đầu kỳ' : 'Thêm số dư đầu kỳ'}
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nguồn tiền</Label>
                  <Select
                    value={formData.payment_source}
                    onValueChange={(v) => setFormData({ ...formData, payment_source: v })}
                    disabled={!!editingId}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {paymentSources.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Loại kỳ</Label>
                  <Select
                    value={formData.period_type}
                    onValueChange={handlePeriodTypeChange}
                    disabled={!!editingId}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="custom">Tùy chỉnh</SelectItem>
                      <SelectItem value="month">Tháng</SelectItem>
                      <SelectItem value="quarter">Quý</SelectItem>
                      <SelectItem value="year">Năm</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Ngày bắt đầu kỳ</Label>
                  <Input
                    type="date"
                    value={formData.period_start}
                    onChange={(e) => setFormData({ ...formData, period_start: e.target.value })}
                    disabled={!!editingId}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Số dư đầu kỳ</Label>
                  <div className="relative">
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={formData.amount}
                      onChange={(e) => {
                        const num = parseFormattedNumber(e.target.value);
                        setFormData({
                          ...formData,
                          amount: num > 0 ? formatNumberWithSpaces(num) : '',
                        });
                      }}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">đ</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Ghi chú</Label>
                <Textarea
                  placeholder="Ghi chú thêm (không bắt buộc)..."
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={resetForm}>Hủy</Button>
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingId ? 'Cập nhật' : 'Lưu'}
                </Button>
              </div>
            </div>
          ) : (
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Đóng</Button>
              <Button onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Thêm số dư đầu kỳ
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(v) => { if (!v) setDeleteConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn xóa số dư đầu kỳ này? Hành động này sẽ ảnh hưởng đến toàn bộ số dư trong sổ quỹ.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteBalance.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
