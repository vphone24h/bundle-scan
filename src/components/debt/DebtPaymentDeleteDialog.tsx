import { useState, useEffect } from 'react';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { formatNumber } from '@/lib/formatNumber';
import { useSecurityPasswordStatus, useSecurityUnlock } from '@/hooks/useSecurityPassword';
import { SecurityPasswordDialog } from '@/components/security/SecurityPasswordDialog';

interface DebtPaymentDeleteDialogProps {
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

export function DebtPaymentDeleteDialog({
  open, onOpenChange, payment, entityName, branchId,
}: DebtPaymentDeleteDialogProps) {
  const queryClient = useQueryClient();
  const { data: hasSecurityPassword } = useSecurityPasswordStatus();
  const { unlocked, unlock } = useSecurityUnlock('debt-payment-delete');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!payment) return;

    if (hasSecurityPassword && !unlocked) {
      setShowPasswordDialog(true);
      return;
    }

    setDeleting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const isPayment = payment.payment_type === 'payment';
      const typeLabel = isPayment ? 'phiếu thu nợ' : 'phiếu thêm nợ';

      // 1. If it was a payment, delete corresponding cash_book entry
      if (isPayment) {
        await supabase
          .from('cash_book')
          .delete()
          .eq('reference_id', payment.id)
          .eq('reference_type', 'debt_payment');
      }

      // 2. Recalculate balance_after for subsequent payments
      const { data: allPayments } = await supabase
        .from('debt_payments')
        .select('id, payment_type, amount, created_at, balance_after')
        .eq('entity_type', payment.entity_type)
        .eq('entity_id', payment.entity_id)
        .order('created_at', { ascending: true });

      if (allPayments && allPayments.length > 0) {
        // Calculate adjustment: removing a payment means balance goes up; removing an addition means balance goes down
        const balanceAdjustment = isPayment ? payment.amount : -payment.amount;
        let foundDeleted = false;

        for (const p of allPayments) {
          if (p.id === payment.id) {
            foundDeleted = true;
            continue; // skip the one being deleted
          }
          if (foundDeleted && p.balance_after != null) {
            const newBalance = (Number(p.balance_after) || 0) + balanceAdjustment;
            await supabase.from('debt_payments').update({
              balance_after: Math.max(0, newBalance),
            }).eq('id', p.id);
          }
        }
      }

      // 3. Delete the payment record
      const { error } = await supabase
        .from('debt_payments')
        .delete()
        .eq('id', payment.id);

      if (error) throw error;

      // 4. Audit log
      await supabase.from('audit_logs').insert([{
        user_id: user?.id,
        action_type: 'delete',
        table_name: 'debt_payments',
        record_id: payment.id,
        branch_id: branchId,
        description: `Xóa ${typeLabel}: ${entityName} | ${formatNumber(payment.amount)}đ | ${payment.description}`,
        old_data: { ...payment },
        new_data: null,
      }]);

      // 5. Invalidate queries - use refetchType 'all' for cash-book so inactive queries also refetch
      queryClient.invalidateQueries({ queryKey: ['debt'] });
      queryClient.invalidateQueries({ queryKey: ['debt-detail'] });
      queryClient.invalidateQueries({ queryKey: ['debt-payment-history'] });
      queryClient.invalidateQueries({ queryKey: ['customer-debts'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-debts'] });
      queryClient.removeQueries({ queryKey: ['cash-book'] });
      queryClient.removeQueries({ queryKey: ['cash-book-balances'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });

      toast.success(`Đã xóa ${typeLabel}`);
      onOpenChange(false);
    } catch (err) {
      console.error('Delete payment error:', err);
      toast.error('Lỗi khi xóa phiếu');
    } finally {
      setDeleting(false);
    }
  };

  if (!payment) return null;

  const isPayment = payment.payment_type === 'payment';
  const typeLabel = isPayment ? 'phiếu thu nợ' : 'phiếu thêm nợ';

  return (
    <>
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent className="max-w-sm z-[70]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Xóa {typeLabel}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left space-y-2">
              <p>Đối tượng: <span className="font-semibold">{entityName}</span></p>
              <p>Số tiền: <span className="font-semibold text-destructive">{formatNumber(payment.amount)}đ</span></p>
              {payment.description && (
                <p className="text-xs">Mô tả: {payment.description}</p>
              )}
              {isPayment && (
                <p className="text-xs text-orange-600">
                  ⚠ Dòng tiền tương ứng trong sổ quỹ sẽ bị xóa theo
                </p>
              )}
              {!isPayment && (
                <p className="text-xs text-orange-600">
                  ⚠ Số nợ sẽ được giảm tương ứng {formatNumber(payment.amount)}đ
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Hành động không thể hoàn tác.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {hasSecurityPassword && !unlocked ? 'Nhập mật khẩu' : 'Xóa phiếu'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SecurityPasswordDialog
        open={showPasswordDialog}
        onOpenChange={setShowPasswordDialog}
        onSuccess={() => {
          unlock();
          setShowPasswordDialog(false);
          handleDelete();
        }}
      />
    </>
  );
}
