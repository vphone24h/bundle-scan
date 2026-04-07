import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatNumber, parseFormattedNumber, formatInputNumber } from '@/lib/formatNumber';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Pencil, Loader2, ShieldAlert } from 'lucide-react';
import { useSecurityPasswordStatus, useSecurityUnlock } from '@/hooks/useSecurityPassword';
import { SecurityPasswordDialog } from '@/components/security/SecurityPasswordDialog';
import { createSafeDialogOpenChange, forceReleaseStuckInteraction, preventDialogAutoFocus } from '@/lib/dialogInteraction';

interface DebtEditAmountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: 'customer' | 'supplier';
  entityId: string;
  entityName: string;
  remainingAmount: number;
  branchId: string | null;
}

export function DebtEditAmountDialog({
  open, onOpenChange, entityType, entityId, entityName, remainingAmount, branchId,
}: DebtEditAmountDialogProps) {
  const queryClient = useQueryClient();
  const [newAmount, setNewAmount] = useState('');
  const [reason, setReason] = useState('');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const { data: hasSecurityPassword } = useSecurityPasswordStatus();
  const { unlocked, unlock } = useSecurityUnlock('debt-edit');
  const handleDialogOpenChange = createSafeDialogOpenChange(onOpenChange);

  useEffect(() => {
    if (open) {
      setNewAmount(formatInputNumber(String(remainingAmount)));
      setReason('');
    }
  }, [open, remainingAmount]);

  useEffect(() => {
    if (!open) {
      forceReleaseStuckInteraction();
    }
  }, [open]);

  const editMutation = useMutation({
    mutationFn: async () => {
      const numAmount = parseFormattedNumber(newAmount);
      if (numAmount < 0) throw new Error('Số tiền không hợp lệ');
      if (!reason.trim()) throw new Error('Vui lòng nhập lý do sửa');
      if (numAmount === remainingAmount) throw new Error('Số tiền không thay đổi');

      const { data: { user } } = await supabase.auth.getUser();
      const { data: tenantData } = await supabase.rpc('get_user_tenant_id_secure');
      const tenantId = tenantData;
      if (!tenantId) throw new Error('Không tìm thấy tenant');

      const difference = numAmount - remainingAmount;
      const paymentType = difference > 0 ? 'addition' : 'payment';
      const absAmount = Math.abs(difference);

      // Create a debt_payment record for the adjustment
      const { data: payment, error } = await supabase
        .from('debt_payments')
        .insert([{
          entity_type: entityType,
          entity_id: entityId,
          payment_type: paymentType,
          amount: absAmount,
          payment_source: 'adjustment',
          description: `[Sửa công nợ] ${reason} | Trước: ${formatNumber(remainingAmount)}đ → Sau: ${formatNumber(numAmount)}đ`,
          branch_id: branchId,
          created_by: user?.id,
          tenant_id: tenantId,
          balance_after: numAmount,
        }])
        .select()
        .single();

      if (error) throw error;

      // FIFO allocation if reducing debt
      if (paymentType === 'payment') {
        let remaining = absAmount;
        const entityIds = [entityId];

        if (entityType === 'customer') {
          const { data: receipts } = await supabase
            .from('export_receipts')
            .select('id, export_date, debt_amount, paid_amount')
            .eq('customer_id', entityId)
            .in('status', ['completed', 'partial_return', 'full_return'])
            .gt('debt_amount', 0)
            .order('export_date', { ascending: true });

          for (const r of (receipts || [])) {
            if (remaining <= 0) break;
            const payAmt = Math.min(remaining, Number(r.debt_amount));
            await supabase.from('export_receipts').update({
              paid_amount: Number(r.paid_amount) + payAmt,
              debt_amount: Number(r.debt_amount) - payAmt,
            }).eq('id', r.id);
            remaining -= payAmt;
          }
        } else {
          const { data: receipts } = await supabase
            .from('import_receipts')
            .select('id, import_date, debt_amount, paid_amount')
            .in('supplier_id', entityIds)
            .eq('status', 'completed')
            .gt('debt_amount', 0)
            .order('import_date', { ascending: true });

          for (const r of (receipts || [])) {
            if (remaining <= 0) break;
            const payAmt = Math.min(remaining, Number(r.debt_amount));
            await supabase.from('import_receipts').update({
              paid_amount: Number(r.paid_amount) + payAmt,
              debt_amount: Number(r.debt_amount) - payAmt,
            }).eq('id', r.id);
            remaining -= payAmt;
          }
        }

        // Also reduce from additions
        if (remaining > 0) {
          const { data: additions } = await supabase
            .from('debt_payments')
            .select('id, amount, allocated_amount')
            .eq('entity_type', entityType)
            .in('entity_id', entityIds)
            .eq('payment_type', 'addition')
            .order('created_at', { ascending: true });

          for (const a of (additions || [])) {
            if (remaining <= 0) break;
            const unpaid = Number(a.amount) - (Number(a.allocated_amount) || 0);
            if (unpaid <= 0) continue;
            const payAmt = Math.min(remaining, unpaid);
            await supabase.from('debt_payments').update({
              allocated_amount: (Number(a.allocated_amount) || 0) + payAmt,
            }).eq('id', a.id);
            remaining -= payAmt;
          }
        }
      }

      // Audit log
      const { data: staffProfile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', user?.id)
        .maybeSingle();

      await supabase.from('audit_logs').insert([{
        user_id: user?.id,
        action_type: 'update',
        table_name: 'debt_payments',
        record_id: payment.id,
        branch_id: branchId,
        tenant_id: tenantId,
        old_data: {
          entity_type: entityType,
          entity_name: entityName,
          remaining_amount: remainingAmount,
        },
        new_data: {
          entity_type: entityType,
          entity_name: entityName,
          remaining_amount: numAmount,
          adjustment_amount: difference,
          reason: reason.trim(),
          adjusted_by: staffProfile?.display_name || user?.email,
        },
        description: `Sửa công nợ ${entityType === 'customer' ? 'khách hàng' : 'NCC'}: ${entityName} | ${formatNumber(remainingAmount)}đ → ${formatNumber(numAmount)}đ | Lý do: ${reason}`,
      }]);

      return payment;
    },
    onSuccess: () => {
      toast.success('Đã sửa số tiền công nợ');
      queryClient.invalidateQueries({ queryKey: ['customer-debts'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-debts'] });
      queryClient.invalidateQueries({ queryKey: ['debt-detail'] });
      queryClient.invalidateQueries({ queryKey: ['debt-payment-history'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      queryClient.invalidateQueries({ queryKey: ['export-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['import-receipts'] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Có lỗi xảy ra');
    },
  });

  const handleSubmit = () => {
    if (hasSecurityPassword && !unlocked) {
      setShowPasswordDialog(true);
      return;
    }
    editMutation.mutate();
  };

  const handlePasswordSuccess = () => {
    unlock();
    setShowPasswordDialog(false);
    editMutation.mutate();
  };

  const numAmount = parseFormattedNumber(newAmount);
  const difference = numAmount - remainingAmount;

  return (
    <>
      <Dialog modal open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-md z-[60]" onCloseAutoFocus={preventDialogAutoFocus}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Sửa số tiền công nợ
            </DialogTitle>
            <DialogDescription>
              {entityType === 'customer' ? 'Khách hàng' : 'Nhà cung cấp'}: <span className="font-semibold">{entityName}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Số tiền nợ hiện tại</Label>
              <div className="p-3 bg-muted rounded-lg font-semibold text-destructive">
                {formatNumber(remainingAmount)}đ
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-amount">Số tiền nợ mới <span className="text-destructive">*</span></Label>
              <Input
                id="new-amount"
                placeholder="Nhập số tiền mới"
                value={newAmount}
                onChange={(e) => setNewAmount(formatInputNumber(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-reason">Lý do sửa <span className="text-destructive">*</span></Label>
              <Textarea
                id="edit-reason"
                placeholder="Nhập lý do sửa công nợ..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>

            {numAmount !== remainingAmount && numAmount >= 0 && (
              <div className={`p-3 rounded-lg border ${difference > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                <p className="text-sm">
                  {difference > 0 ? (
                    <span className="text-red-700">Tăng nợ: <span className="font-semibold">+{formatNumber(difference)}đ</span></span>
                  ) : (
                    <span className="text-green-700">Giảm nợ: <span className="font-semibold">{formatNumber(difference)}đ</span></span>
                  )}
                </p>
                <p className="text-sm mt-1">
                  Nợ sau sửa: <span className="font-bold">{formatNumber(numAmount)}đ</span>
                </p>
              </div>
            )}

            {hasSecurityPassword && !unlocked && (
              <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                Cần xác thực mật khẩu bảo mật để sửa công nợ
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleDialogOpenChange(false)}>Hủy</Button>
            <Button
              onClick={handleSubmit}
              disabled={editMutation.isPending || numAmount === remainingAmount || numAmount < 0 || !reason.trim()}
            >
              {editMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Xác nhận sửa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SecurityPasswordDialog
        open={showPasswordDialog}
        onOpenChange={setShowPasswordDialog}
        onSuccess={handlePasswordSuccess}
        title="Xác thực sửa công nợ"
        description="Nhập mật khẩu bảo mật để sửa số tiền công nợ"
      />
    </>
  );
}
