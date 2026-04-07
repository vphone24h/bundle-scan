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

      // Update the payment amount and date
      const updateData: any = { amount: numAmount };
      if (dateChanged && newDate) {
        updateData.created_at = new Date(newDate).toISOString();
      }
      const { error } = await supabase
        .from('debt_payments')
        .update(updateData)
        .eq('id', payment.id);

      if (error) throw error;

      // Recalculate balance_after for this and subsequent payments
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

      // Audit log
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

      // Also update cash_book entry if date changed and it's a payment
      if (dateChanged && payment.payment_type === 'payment') {
        await supabase.from('cash_book')
          .update({ transaction_date: new Date(newDate).toISOString() })
          .eq('reference_id', payment.id)
          .eq('reference_type', 'debt_payment');
      }

      queryClient.invalidateQueries({ queryKey: ['debt'] });
      queryClient.invalidateQueries({ queryKey: ['debt-detail'] });
      queryClient.invalidateQueries({ queryKey: ['debt-payment-history'] });
      queryClient.invalidateQueries({ queryKey: ['customer-debts'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-debts'] });
      queryClient.invalidateQueries({ queryKey: ['cash-book'] });
      queryClient.invalidateQueries({ queryKey: ['cash-book-balances'] });

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
