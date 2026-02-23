import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';

interface EditCustomerDebtDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  branchName?: string | null;
  globalOverdueDays?: number;
}

export function EditCustomerDebtDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
  customerPhone,
  branchName,
  globalOverdueDays = 15,
}: EditCustomerDebtDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(customerName);
  const [phone, setPhone] = useState(customerPhone || '');
  const [note, setNote] = useState('');
  const [debtDueDays, setDebtDueDays] = useState<number | null>(null);
  const [useCustomDays, setUseCustomDays] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && customerId) {
      setName(customerName);
      setPhone(customerPhone || '');
      setLoading(true);
      supabase
        .from('customers')
        .select('note, debt_due_days')
        .eq('id', customerId)
        .single()
        .then(({ data }) => {
          setNote(data?.note || '');
          const days = data?.debt_due_days;
          setDebtDueDays(days ?? globalOverdueDays);
          setUseCustomDays(days !== null && days !== undefined);
          setLoading(false);
        });
    }
  }, [open, customerId, customerName, customerPhone, globalOverdueDays]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error('Vui lòng nhập tên khách hàng');

      const { error } = await supabase
        .from('customers')
        .update({
          name: name.trim(),
          phone: phone.trim() || customerPhone,
          note: note.trim() || null,
          debt_due_days: useCustomDays ? debtDueDays : null,
        })
        .eq('id', customerId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Đã cập nhật thông tin khách hàng');
      queryClient.invalidateQueries({ queryKey: ['customer-debts'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Có lỗi xảy ra');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa khách nợ</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {branchName && (
            <div className="space-y-2">
              <Label>Chi nhánh</Label>
              <Input value={branchName} disabled className="bg-muted" />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="edit-customer-name">
              Tên khách hàng <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-customer-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nhập tên khách hàng"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-customer-phone">Số điện thoại</Label>
            <Input
              id="edit-customer-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Nhập số điện thoại"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-customer-note">Ghi chú</Label>
            <Textarea
              id="edit-customer-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ghi chú..."
              rows={2}
              disabled={loading}
            />
          </div>

          {/* Custom overdue days */}
          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="use-custom-days" className="text-sm font-medium cursor-pointer">
                Cài đặt ngày quá hạn riêng
              </Label>
              <Switch
                id="use-custom-days"
                checked={useCustomDays}
                onCheckedChange={setUseCustomDays}
              />
            </div>
            {useCustomDays ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={debtDueDays ?? ''}
                    onChange={(e) => setDebtDueDays(parseInt(e.target.value) || null)}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">ngày</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Đang dùng cài đặt chung: <span className="font-medium">{globalOverdueDays} ngày</span>
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={updateMutation.isPending}>
            Hủy
          </Button>
          <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
            {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Lưu thay đổi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
