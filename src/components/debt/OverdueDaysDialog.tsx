import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';

interface OverdueDaysDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
  globalOverdueDays?: number;
}

export function OverdueDaysDialog({
  open, onOpenChange, customerId, customerName, globalOverdueDays = 15,
}: OverdueDaysDialogProps) {
  const queryClient = useQueryClient();
  const [debtDueDays, setDebtDueDays] = useState<number | null>(null);
  const [useCustomDays, setUseCustomDays] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && customerId) {
      setLoading(true);
      supabase
        .from('customers')
        .select('debt_due_days')
        .eq('id', customerId)
        .single()
        .then(({ data }) => {
          const days = data?.debt_due_days;
          setDebtDueDays(days ?? globalOverdueDays);
          setUseCustomDays(days !== null && days !== undefined);
          setLoading(false);
        });
    }
  }, [open, customerId, globalOverdueDays]);

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('customers')
        .update({ debt_due_days: useCustomDays ? debtDueDays : null })
        .eq('id', customerId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Đã cập nhật cài đặt quá hạn');
      queryClient.invalidateQueries({ queryKey: ['customer-debts'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      onOpenChange(false);
    },
    onError: (error: any) => toast.error(error.message || 'Có lỗi xảy ra'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Cài đặt thời gian trả nợ - {customerName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="use-custom-days" className="text-sm font-medium cursor-pointer">
              Số ngày quá hạn riêng
            </Label>
            <Switch id="use-custom-days" checked={useCustomDays} onCheckedChange={setUseCustomDays} disabled={loading} />
          </div>
          {useCustomDays ? (
            <div className="flex items-center gap-2">
              <Input type="number" min={1} max={365} value={debtDueDays ?? ''} onChange={(e) => setDebtDueDays(parseInt(e.target.value) || null)} className="w-24" disabled={loading} />
              <span className="text-sm text-muted-foreground">ngày</span>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Đang dùng cài đặt chung: <span className="font-medium">{globalOverdueDays} ngày</span>
            </p>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Hủy</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || loading}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
