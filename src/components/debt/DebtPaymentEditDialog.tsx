import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { formatNumber, parseFormattedNumber, formatInputNumber } from '@/lib/formatNumber';
import { Loader2, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import { useSecurityPasswordStatus, useSecurityUnlock } from '@/hooks/useSecurityPassword';
import { SecurityPasswordDialog } from '@/components/security/SecurityPasswordDialog';
import { createSafeDialogOpenChange, forceReleaseStuckInteraction, preventDialogAutoFocus } from '@/lib/dialogInteraction';

interface DebtPaymentEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: {
    id: string;
    amount: number;
    description: string;
    payment_type: 'addition' | 'payment';
    entity_type: 'customer' | 'supplier';
    entity_id: string;
    created_at?: string;
  } | null;
  entityName: string;
  branchId?: string | null;
}

export function DebtPaymentEditDialog({
  open,
  onOpenChange,
  payment,
  entityName,
  branchId,
}: DebtPaymentEditDialogProps) {
  const queryClient = useQueryClient();
  const { data: hasSecurityPassword } = useSecurityPasswordStatus();
  const { unlocked, unlock } = useSecurityUnlock('debt-payment-edit');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [newAmount, setNewAmount] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [newDate, setNewDate] = useState('');
  const handleDialogOpenChange = createSafeDialogOpenChange(onOpenChange);

  useEffect(() => {
    if (open && payment) {
      setNewAmount(formatInputNumber(String(payment.amount)));
      setReason('');
      if (payment.created_at) {
        const d = new Date(payment.created_at);
        setNewDate(format(d, "yyyy-MM-dd'T'HH:mm"));
      } else {
        setNewDate('');
      }
    }
  }, [open, payment]);

  useEffect(() => {
    if (!open) {
      forceReleaseStuckInteraction();
    }
  }, [open]);

  const applyAdditionalPaymentToDebt = async (
    target: NonNullable<DebtPaymentEditDialogProps['payment']>,
    amount: number
  ) => {
    let remainingPayment = amount;
    if (remainingPayment <= 0) return;

    if (target.entity_type === 'customer') {
      const { data: receipts, error } = await supabase
        .from('export_receipts')
        .select('id, debt_amount, paid_amount')
        .eq('customer_id', target.entity_id)
        .in('status', ['completed', 'partial_return', 'full_return'])
        .gt('debt_amount', 0)
        .order('export_date', { ascending: true });

      if (error) throw error;

      for (const receipt of receipts || []) {
        if (remainingPayment <= 0) break;
        const payAmount = Math.min(remainingPayment, Number(receipt.debt_amount) || 0);
        if (payAmount <= 0) continue;

        const { error: updateError } = await supabase
          .from('export_receipts')
          .update({
            paid_amount: (Number(receipt.paid_amount) || 0) + payAmount,
            debt_amount: Math.max(0, (Number(receipt.debt_amount) || 0) - payAmount),
          })
          .eq('id', receipt.id);

        if (updateError) throw updateError;
        remainingPayment -= payAmount;
      }
    } else {
      const { data: receipts, error } = await supabase
        .from('import_receipts')
        .select('id, debt_amount, paid_amount')
        .eq('supplier_id', target.entity_id)
        .eq('status', 'completed')
        .gt('debt_amount', 0)
        .order('import_date', { ascending: true });

      if (error) throw error;

      for (const receipt of receipts || []) {
        if (remainingPayment <= 0) break;
        const payAmount = Math.min(remainingPayment, Number(receipt.debt_amount) || 0);
        if (payAmount <= 0) continue;

        const { error: updateError } = await supabase
          .from('import_receipts')
          .update({
            paid_amount: (Number(receipt.paid_amount) || 0) + payAmount,
            debt_amount: Math.max(0, (Number(receipt.debt_amount) || 0) - payAmount),
          })
          .eq('id', receipt.id);

        if (updateError) throw updateError;
        remainingPayment -= payAmount;
      }
    }

    if (remainingPayment > 0) {
      const { data: additions, error } = await supabase
        .from('debt_payments')
        .select('id, amount, allocated_amount, created_at')
        .eq('entity_type', target.entity_type)
        .eq('entity_id', target.entity_id)
        .eq('payment_type', 'addition')
        .order('created_at', { ascending: true });

      if (error) throw error;

      for (const addition of additions || []) {
        if (remainingPayment <= 0) break;
        const total = Number(addition.amount) || 0;
        const allocated = Number(addition.allocated_amount) || 0;
        const unpaid = total - allocated;
        const payAmount = Math.min(remainingPayment, unpaid);
        if (payAmount <= 0) continue;

        const { error: updateError } = await supabase
          .from('debt_payments')
          .update({ allocated_amount: allocated + payAmount })
          .eq('id', addition.id);

        if (updateError) throw updateError;
        remainingPayment -= payAmount;
      }
    }
  };

  const reversePaymentAllocationFromDebt = async (
    target: NonNullable<DebtPaymentEditDialogProps['payment']>,
    amount: number
  ) => {
    let remainingToReverse = amount;
    if (remainingToReverse <= 0) return;

    if (target.entity_type === 'customer') {
      const { data: receipts, error } = await supabase
        .from('export_receipts')
        .select('id, debt_amount, paid_amount')
        .eq('customer_id', target.entity_id)
        .in('status', ['completed', 'partial_return', 'full_return'])
        .gt('paid_amount', 0)
        .order('export_date', { ascending: false });

      if (error) throw error;

      for (const receipt of receipts || []) {
        if (remainingToReverse <= 0) break;
        const canReverse = Math.min(remainingToReverse, Number(receipt.paid_amount) || 0);
        if (canReverse <= 0) continue;

        const { error: updateError } = await supabase
          .from('export_receipts')
          .update({
            paid_amount: Math.max(0, (Number(receipt.paid_amount) || 0) - canReverse),
            debt_amount: (Number(receipt.debt_amount) || 0) + canReverse,
          })
          .eq('id', receipt.id);

        if (updateError) throw updateError;
        remainingToReverse -= canReverse;
      }
    } else {
      const { data: receipts, error } = await supabase
        .from('import_receipts')
        .select('id, debt_amount, paid_amount')
        .eq('supplier_id', target.entity_id)
        .eq('status', 'completed')
        .gt('paid_amount', 0)
        .order('import_date', { ascending: false });

      if (error) throw error;

      for (const receipt of receipts || []) {
        if (remainingToReverse <= 0) break;
        const canReverse = Math.min(remainingToReverse, Number(receipt.paid_amount) || 0);
        if (canReverse <= 0) continue;

        const { error: updateError } = await supabase
          .from('import_receipts')
          .update({
            paid_amount: Math.max(0, (Number(receipt.paid_amount) || 0) - canReverse),
            debt_amount: (Number(receipt.debt_amount) || 0) + canReverse,
          })
          .eq('id', receipt.id);

        if (updateError) throw updateError;
        remainingToReverse -= canReverse;
      }
    }

    if (remainingToReverse > 0) {
      const { data: additions, error } = await supabase
        .from('debt_payments')
        .select('id, allocated_amount, created_at')
        .eq('entity_type', target.entity_type)
        .eq('entity_id', target.entity_id)
        .eq('payment_type', 'addition')
        .gt('allocated_amount', 0)
        .order('created_at', { ascending: false });

      if (error) throw error;

      for (const addition of additions || []) {
        if (remainingToReverse <= 0) break;
        const allocated = Number(addition.allocated_amount) || 0;
        const canReverse = Math.min(remainingToReverse, allocated);
        if (canReverse <= 0) continue;

        const { error: updateError } = await supabase
          .from('debt_payments')
          .update({ allocated_amount: allocated - canReverse })
          .eq('id', addition.id);

        if (updateError) throw updateError;
        remainingToReverse -= canReverse;
      }
    }
  };

  const handleSave = async () => {
    if (!payment) return;

    if (hasSecurityPassword && !unlocked) {
      setShowPasswordDialog(true);
      return;
    }

    const numAmount = parseFormattedNumber(newAmount);
    if (!numAmount || numAmount <= 0) {
      toast.error('Số tiền không hợp lệ');
      return;
    }
    if (!reason.trim()) {
      toast.error('Vui lòng nhập lý do chỉnh sửa');
      return;
    }
    const dateChanged = newDate && payment.created_at && format(new Date(payment.created_at), "yyyy-MM-dd'T'HH:mm") !== newDate;
    if (numAmount === payment.amount && !dateChanged) {
      toast.info('Không có thay đổi');
      return;
    }

    setSaving(true);
    try {
      const oldAmount = payment.amount;
      const diff = numAmount - oldAmount;

      const { data: { user } } = await supabase.auth.getUser();

      const updateData: Record<string, any> = { amount: numAmount };
      if (dateChanged && newDate) {
        updateData.created_at = new Date(newDate).toISOString();
      }
      const { error } = await supabase
        .from('debt_payments')
        .update(updateData)
        .eq('id', payment.id);

      if (error) throw error;

      if (payment.payment_type === 'payment' && diff !== 0) {
        if (diff > 0) {
          await applyAdditionalPaymentToDebt(payment, diff);
        } else {
          await reversePaymentAllocationFromDebt(payment, Math.abs(diff));
        }
      }

      const { data: allPayments } = await supabase
        .from('debt_payments')
        .select('id, payment_type, amount, created_at, balance_after')
        .eq('entity_type', payment.entity_type)
        .eq('entity_id', payment.entity_id)
        .order('created_at', { ascending: true });

      if (numAmount !== payment.amount && allPayments && allPayments.length > 0) {
        let foundEdited = false;
        const diff2 = numAmount - payment.amount;
        const balanceAdjustment = payment.payment_type === 'addition' ? diff2 : -diff2;

        for (const p of allPayments) {
          if (p.id === payment.id) {
            foundEdited = true;
          }
          if (foundEdited && p.balance_after != null) {
            const newBalance = (Number(p.balance_after) || 0) + balanceAdjustment;
            await supabase.from('debt_payments').update({
              balance_after: Math.max(0, newBalance),
            }).eq('id', p.id);
          }
        }
      }

      await supabase.from('audit_logs').insert([{
        user_id: user?.id,
        action_type: 'update',
        table_name: 'debt_payments',
        record_id: payment.id,
        branch_id: branchId,
        description: `Sửa ${payment.payment_type === 'addition' ? 'phiếu thêm nợ' : 'phiếu thu nợ'}: ${entityName} | ${formatNumber(oldAmount)}đ → ${formatNumber(numAmount)}đ${dateChanged ? ' | Đổi ngày' : ''} | Lý do: ${reason.trim()}`,
        old_data: { amount: oldAmount, created_at: payment.created_at },
        new_data: { amount: numAmount, reason: reason.trim(), ...(dateChanged ? { created_at: new Date(newDate).toISOString() } : {}) },
      }]);

      if (payment.payment_type === 'payment') {
        const cashBookUpdate: Record<string, any> = {};
        if (numAmount !== payment.amount) {
          cashBookUpdate.amount = numAmount;
        }
        if (dateChanged && newDate) {
          cashBookUpdate.transaction_date = new Date(newDate).toISOString();
        }

        if (Object.keys(cashBookUpdate).length > 0) {
          await supabase.from('cash_book')
            .update(cashBookUpdate)
            .eq('reference_id', payment.id)
            .eq('reference_type', 'debt_payment');
        }
      }

      queryClient.invalidateQueries({ queryKey: ['debt'] });
      queryClient.invalidateQueries({ queryKey: ['debt-detail'] });
      queryClient.invalidateQueries({ queryKey: ['debt-payment-history'] });
      queryClient.invalidateQueries({ queryKey: ['customer-debts'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-debts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['export-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['import-receipts'] });
      queryClient.removeQueries({ queryKey: ['cash-book'] });
      queryClient.removeQueries({ queryKey: ['cash-book-balances'] });

      toast.success(dateChanged ? 'Đã sửa phiếu' : `Đã sửa: ${formatNumber(oldAmount)}đ → ${formatNumber(numAmount)}đ`);
      onOpenChange(false);
    } catch (err) {
      console.error('Edit payment error:', err);
      toast.error('Lỗi khi sửa số tiền');
    } finally {
      setSaving(false);
    }
  };

  if (!payment) return null;

  const typeLabel = payment.payment_type === 'addition' ? 'Phiếu thêm nợ' : 'Phiếu thu nợ';

  return (
    <>
      <Dialog modal open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-sm z-[60]" onCloseAutoFocus={preventDialogAutoFocus}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="h-5 w-5 text-orange-500" />
              Sửa {typeLabel}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Đối tượng</Label>
              <p className="font-medium text-sm">{entityName}</p>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Số tiền hiện tại</Label>
              <p className="font-semibold text-destructive">{formatNumber(payment.amount)}đ</p>
            </div>

            {/* Date/time */}
            {payment.created_at && (
              <div>
                <Label htmlFor="editPaymentDate">Ngày / Giờ giao dịch</Label>
                <Input
                  id="editPaymentDate"
                  type="datetime-local"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="block mt-1"
                />
              </div>
            )}

            <div>
              <Label htmlFor="editPaymentAmount">Số tiền mới <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Input
                  id="editPaymentAmount"
                  type="text"
                  inputMode="numeric"
                  value={newAmount}
                  onChange={(e) => {
                    const formatted = formatInputNumber(e.target.value);
                    setNewAmount(formatted);
                  }}
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">đ</span>
              </div>
            </div>

            <div>
              <Label htmlFor="editPaymentReason">Lý do chỉnh sửa <span className="text-destructive">*</span></Label>
              <Textarea
                id="editPaymentReason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Nhập lý do sửa số tiền..."
                rows={2}
              />
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {hasSecurityPassword && !unlocked ? 'Nhập mật khẩu bảo mật' : 'Xác nhận sửa'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <SecurityPasswordDialog
        open={showPasswordDialog}
        onOpenChange={setShowPasswordDialog}
        onSuccess={() => {
          unlock();
          setShowPasswordDialog(false);
          handleSave();
        }}
      />
    </>
  );
}
