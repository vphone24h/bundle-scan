import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { formatNumber } from '@/lib/formatNumber';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useSecurityPasswordStatus, useSecurityUnlock } from '@/hooks/useSecurityPassword';
import { SecurityPasswordDialog } from '@/components/security/SecurityPasswordDialog';

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
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const { isUnlocked } = useSecurityPasswordStatus();
  const { unlock } = useSecurityUnlock();
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);

  const [newAmount, setNewAmount] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const formatWithSpaces = (val: string) => {
    const num = val.replace(/\s/g, '');
    if (!num) return '';
    return Number(num).toLocaleString('en-US').replace(/,/g, ' ');
  };

  const handleOpen = () => {
    if (payment) {
      setNewAmount(String(payment.amount));
      setReason('');
    }
  };

  const handleSave = async () => {
    if (!payment || !user) return;

    if (!isUnlocked) {
      setShowPasswordDialog(true);
      return;
    }

    const raw = newAmount.replace(/\s/g, '');
    const numAmount = Number(raw);
    if (!numAmount || numAmount <= 0) {
      toast.error('Số tiền không hợp lệ');
      return;
    }
    if (!reason.trim()) {
      toast.error('Vui lòng nhập lý do chỉnh sửa');
      return;
    }
    if (numAmount === payment.amount) {
      toast.info('Số tiền không thay đổi');
      return;
    }

    setSaving(true);
    try {
      const oldAmount = payment.amount;
      const diff = numAmount - oldAmount;

      // Update the payment record
      const { error } = await supabase
        .from('debt_payments')
        .update({ amount: numAmount })
        .eq('id', payment.id);

      if (error) throw error;

      // Recalculate balance_after for all subsequent payments
      // Fetch all payments for this entity ordered by date
      const { data: allPayments } = await supabase
        .from('debt_payments')
        .select('id, payment_type, amount, created_at, balance_after')
        .eq('entity_type', payment.entity_type)
        .eq('entity_id', payment.entity_id)
        .order('created_at', { ascending: true });

      if (allPayments && allPayments.length > 0) {
        let foundEdited = false;
        let balanceAdjustment = 0;

        for (const p of allPayments) {
          if (p.id === payment.id) {
            foundEdited = true;
            // This is the edited payment - adjust based on type
            if (payment.payment_type === 'addition') {
              balanceAdjustment = diff; // more addition = higher balance
            } else {
              balanceAdjustment = -diff; // more payment = lower balance
            }
            // Update this record's balance
            const newBalance = (Number(p.balance_after) || 0) + balanceAdjustment;
            await supabase.from('debt_payments').update({
              balance_after: Math.max(0, newBalance),
            }).eq('id', p.id);
          } else if (foundEdited && p.balance_after != null) {
            const newBalance = (Number(p.balance_after) || 0) + balanceAdjustment;
            await supabase.from('debt_payments').update({
              balance_after: Math.max(0, newBalance),
            }).eq('id', p.id);
          }
        }
      }

      // Audit log
      await supabase.from('audit_logs').insert([{
        user_id: user.id,
        action_type: 'update',
        table_name: 'debt_payments',
        record_id: payment.id,
        branch_id: branchId,
        description: `Sửa số tiền ${payment.payment_type === 'addition' ? 'phiếu thêm nợ' : 'phiếu thu nợ'}: ${entityName} | ${formatNumber(oldAmount)}đ → ${formatNumber(numAmount)}đ | Lý do: ${reason.trim()}`,
        old_data: { amount: oldAmount },
        new_data: { amount: numAmount, reason: reason.trim(), edited_by: profile?.display_name },
      }]);

      queryClient.invalidateQueries({ queryKey: ['debt'] });
      queryClient.invalidateQueries({ queryKey: ['debt-detail'] });
      queryClient.invalidateQueries({ queryKey: ['debt-payment-history'] });
      queryClient.invalidateQueries({ queryKey: ['customer-debts'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-debts'] });

      toast.success(`Đã sửa số tiền: ${formatNumber(oldAmount)}đ → ${formatNumber(numAmount)}đ`);
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
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm" onOpenAutoFocus={handleOpen}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-orange-500" />
              Sửa {typeLabel}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Khách hàng</Label>
              <p className="font-medium text-sm">{entityName}</p>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Số tiền hiện tại</Label>
              <p className="font-semibold text-destructive">{formatNumber(payment.amount)}đ</p>
            </div>

            <div>
              <Label htmlFor="newAmount">Số tiền mới <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Input
                  id="newAmount"
                  type="text"
                  inputMode="numeric"
                  value={formatWithSpaces(newAmount)}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\s/g, '');
                    if (raw === '' || /^\d+$/.test(raw)) {
                      setNewAmount(raw);
                    }
                  }}
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">đ</span>
              </div>
            </div>

            <div>
              <Label htmlFor="reason">Lý do chỉnh sửa <span className="text-destructive">*</span></Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Nhập lý do sửa số tiền..."
                rows={2}
              />
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {isUnlocked ? 'Xác nhận sửa' : 'Nhập mật khẩu bảo mật'}
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
