import { useState, useEffect, useRef } from 'react';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, ArrowLeftRight } from 'lucide-react';
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
    payment_source?: string | null;
  } | null;
  entityName: string;
  branchId?: string | null;
}

/**
 * Reverse FIFO allocation for a paid amount on a given entity.
 * Adds back the amount to receipts/additions in reverse-FIFO order.
 */
async function reverseFifoAllocation(
  entityType: 'customer' | 'supplier',
  entityId: string,
  amount: number,
) {
  let remaining = amount;
  if (remaining <= 0) return;

  if (entityType === 'customer') {
    const { data: receipts } = await supabase
      .from('export_receipts')
      .select('id, debt_amount, paid_amount')
      .eq('customer_id', entityId)
      .in('status', ['completed', 'partial_return', 'full_return'])
      .gt('paid_amount', 0)
      .order('export_date', { ascending: false });

    for (const r of receipts || []) {
      if (remaining <= 0) break;
      const canReverse = Math.min(remaining, Number(r.paid_amount) || 0);
      if (canReverse <= 0) continue;
      await supabase.from('export_receipts').update({
        paid_amount: (Number(r.paid_amount) || 0) - canReverse,
        debt_amount: (Number(r.debt_amount) || 0) + canReverse,
      }).eq('id', r.id);
      remaining -= canReverse;
    }
  } else {
    const { data: receipts } = await supabase
      .from('import_receipts')
      .select('id, debt_amount, paid_amount')
      .eq('supplier_id', entityId)
      .eq('status', 'completed')
      .gt('paid_amount', 0)
      .order('import_date', { ascending: false });

    for (const r of receipts || []) {
      if (remaining <= 0) break;
      const canReverse = Math.min(remaining, Number(r.paid_amount) || 0);
      if (canReverse <= 0) continue;
      await supabase.from('import_receipts').update({
        paid_amount: (Number(r.paid_amount) || 0) - canReverse,
        debt_amount: (Number(r.debt_amount) || 0) + canReverse,
      }).eq('id', r.id);
      remaining -= canReverse;
    }
  }

  if (remaining > 0) {
    const { data: additions } = await supabase
      .from('debt_payments')
      .select('id, allocated_amount')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .eq('payment_type', 'addition')
      .gt('allocated_amount', 0)
      .order('created_at', { ascending: false });

    for (const a of additions || []) {
      if (remaining <= 0) break;
      const allocated = Number(a.allocated_amount) || 0;
      const canReverse = Math.min(remaining, allocated);
      if (canReverse <= 0) continue;
      await supabase.from('debt_payments').update({
        allocated_amount: allocated - canReverse,
      }).eq('id', a.id);
      remaining -= canReverse;
    }
  }
}

export function DebtPaymentDeleteDialog({
  open, onOpenChange, payment, entityName, branchId,
}: DebtPaymentDeleteDialogProps) {
  const queryClient = useQueryClient();
  const { data: hasSecurityPassword } = useSecurityPasswordStatus();
  const { unlocked, unlock } = useSecurityUnlock('debt-payment-delete');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const ignoreParentCloseRef = useRef(false);

  useEffect(() => {
    if (!open) {
      ignoreParentCloseRef.current = false;
      setShowPasswordDialog(false);
    }
  }, [open]);

  const handleAlertDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && (showPasswordDialog || ignoreParentCloseRef.current)) {
      return;
    }
    onOpenChange(nextOpen);
  };

  const requestSecurityPassword = () => {
    ignoreParentCloseRef.current = true;
    setShowPasswordDialog(true);
  };

  const handlePasswordDialogOpenChange = (nextOpen: boolean) => {
    setShowPasswordDialog(nextOpen);
    if (!nextOpen) ignoreParentCloseRef.current = false;
  };

  const isOffset = payment?.payment_source === 'debt_offset';

  const doDelete = async () => {
    if (!payment) return;

    setDeleting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const isPayment = payment.payment_type === 'payment';
      const typeLabel = isPayment ? 'phiếu thu nợ' : 'phiếu thêm nợ';

      // ============================================================
      // SPECIAL CASE: debt_offset → reverse BOTH sides (customer + supplier)
      // ============================================================
      if (isOffset && isPayment) {
        // Find the debt_offsets record matching this payment
        const isCustomerSide = payment.entity_type === 'customer';
        const offsetQuery = supabase
          .from('debt_offsets')
          .select('*')
          .eq('offset_amount', payment.amount)
          .order('created_at', { ascending: false })
          .limit(20);

        if (isCustomerSide) {
          offsetQuery.eq('customer_entity_id', payment.entity_id);
        } else {
          offsetQuery.eq('supplier_entity_id', payment.entity_id);
        }

        const { data: candidateOffsets } = await offsetQuery;

        // Pick offset closest in time to the payment (within ±5 minutes)
        const paymentTime = payment.created_at ? new Date(payment.created_at).getTime() : Date.now();
        const matchedOffset = (candidateOffsets || []).find(o => {
          const diff = Math.abs(new Date(o.created_at).getTime() - paymentTime);
          return diff < 5 * 60 * 1000;
        }) || (candidateOffsets || [])[0];

        if (!matchedOffset) {
          toast.error('Không tìm thấy bản ghi bù trừ tương ứng');
          setDeleting(false);
          return;
        }

        const customerId = matchedOffset.customer_entity_id;
        const supplierId = matchedOffset.supplier_entity_id;
        const offsetAmount = Number(matchedOffset.offset_amount) || 0;

        // 1) Find the two paired debt_payments (customer + supplier) by offset created_at window
        const offsetCreatedAt = new Date(matchedOffset.created_at).getTime();
        const windowStart = new Date(offsetCreatedAt - 60 * 1000).toISOString();
        const windowEnd = new Date(offsetCreatedAt + 60 * 1000).toISOString();

        const { data: pairedPayments } = await supabase
          .from('debt_payments')
          .select('id, entity_type, entity_id, amount')
          .eq('payment_source', 'debt_offset')
          .eq('amount', offsetAmount)
          .gte('created_at', windowStart)
          .lte('created_at', windowEnd);

        const customerPayment = (pairedPayments || []).find(
          p => p.entity_type === 'customer' && p.entity_id === customerId
        );
        const supplierPayment = (pairedPayments || []).find(
          p => p.entity_type === 'supplier' && p.entity_id === supplierId
        );

        // 2) Reverse FIFO on both sides
        await reverseFifoAllocation('customer', customerId, offsetAmount);
        await reverseFifoAllocation('supplier', supplierId, offsetAmount);

        // 3) Delete both debt_payments
        const idsToDelete = [customerPayment?.id, supplierPayment?.id, payment.id]
          .filter((v, i, a) => v && a.indexOf(v) === i) as string[];
        await supabase.from('debt_payments').delete().in('id', idsToDelete);

        // 4) Delete the debt_offsets record
        await supabase.from('debt_offsets').delete().eq('id', matchedOffset.id);

        // 5) Audit log
        await supabase.from('audit_logs').insert([{
          user_id: user?.id,
          action_type: 'delete',
          table_name: 'debt_offsets',
          record_id: matchedOffset.id,
          branch_id: branchId,
          description: `Hoàn tác bù trừ công nợ: KH ${matchedOffset.customer_name} ↔ NCC ${matchedOffset.supplier_name} | Số tiền: ${formatNumber(offsetAmount)}đ`,
          old_data: { ...matchedOffset } as any,
          new_data: null,
        }]);

        // 6) Invalidate
        queryClient.invalidateQueries({ queryKey: ['debt'] });
        queryClient.invalidateQueries({ queryKey: ['debt-detail'] });
        queryClient.invalidateQueries({ queryKey: ['debt-payment-history'] });
        queryClient.invalidateQueries({ queryKey: ['customer-debts'] });
        queryClient.invalidateQueries({ queryKey: ['supplier-debts'] });
        queryClient.invalidateQueries({ queryKey: ['debt-offsets'] });
        queryClient.invalidateQueries({ queryKey: ['export-receipts'] });
        queryClient.invalidateQueries({ queryKey: ['import-receipts'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });

        toast.success('Đã hoàn tác bù trừ ở cả 2 bên KH & NCC');
        onOpenChange(false);
        return;
      }

      // ============================================================
      // NORMAL CASE
      // ============================================================
      // 1. If it was a payment, delete corresponding cash_book entry
      if (isPayment) {
        await supabase
          .from('cash_book')
          .delete()
          .eq('reference_id', payment.id)
          .eq('reference_type', 'debt_payment');
      }

      // For 'addition' type, also remove linked cash_book row (if user chose a cash source on creation)
      if (!isPayment) {
        await supabase
          .from('cash_book')
          .delete()
          .eq('reference_id', payment.id)
          .eq('reference_type', 'debt_addition');
      }

      // 2. Reverse FIFO allocation
      if (isPayment) {
        await reverseFifoAllocation(payment.entity_type, payment.entity_id, payment.amount);
      }

      // 3. Recalculate balance_after for subsequent payments
      const { data: allPayments } = await supabase
        .from('debt_payments')
        .select('id, payment_type, amount, created_at, balance_after')
        .eq('entity_type', payment.entity_type)
        .eq('entity_id', payment.entity_id)
        .order('created_at', { ascending: true });

      if (allPayments && allPayments.length > 0) {
        const balanceAdjustment = isPayment ? payment.amount : -payment.amount;
        let foundDeleted = false;

        for (const p of allPayments) {
          if (p.id === payment.id) {
            foundDeleted = true;
            continue;
          }
          if (foundDeleted && p.balance_after != null) {
            const newBalance = (Number(p.balance_after) || 0) + balanceAdjustment;
            await supabase.from('debt_payments').update({
              balance_after: Math.max(0, newBalance),
            }).eq('id', p.id);
          }
        }
      }

      // 4. Delete the payment record
      const { error } = await supabase
        .from('debt_payments')
        .delete()
        .eq('id', payment.id);

      if (error) throw error;

      // 5. Audit log
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

      // 6. Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['debt'] });
      queryClient.invalidateQueries({ queryKey: ['debt-detail'] });
      queryClient.invalidateQueries({ queryKey: ['debt-payment-history'] });
      queryClient.invalidateQueries({ queryKey: ['customer-debts'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-debts'] });
      queryClient.removeQueries({ queryKey: ['cash-book'] });
      queryClient.removeQueries({ queryKey: ['cash-book-balances'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['export-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['import-receipts'] });

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
      <AlertDialog open={open} onOpenChange={handleAlertDialogOpenChange}>
        <AlertDialogContent className="max-w-sm z-[70]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              {isOffset ? <ArrowLeftRight className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
              {isOffset ? 'Hoàn tác bù trừ công nợ' : `Xóa ${typeLabel}`}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left space-y-2">
              <p>Đối tượng: <span className="font-semibold">{entityName}</span></p>
              <p>Số tiền: <span className="font-semibold text-destructive">{formatNumber(payment.amount)}đ</span></p>
              {payment.description && (
                <p className="text-xs">Mô tả: {payment.description}</p>
              )}
              {isOffset && (
                <p className="text-xs text-orange-600 font-medium">
                  ⚠ Phiếu này thuộc giao dịch <strong>bù trừ công nợ</strong>. Hệ thống sẽ hoàn tác đồng bộ <strong>cả 2 bên Khách hàng & NCC</strong>, khôi phục công nợ và phân bổ FIFO về trạng thái trước bù trừ.
                </p>
              )}
              {!isOffset && isPayment && (
                <p className="text-xs text-orange-600">
                  ⚠ Dòng tiền tương ứng trong sổ quỹ sẽ bị xóa theo
                </p>
              )}
              {!isOffset && !isPayment && (
                <p className="text-xs text-orange-600">
                  ⚠ Số nợ sẽ được giảm tương ứng {formatNumber(payment.amount)}đ. Nếu phiếu này có ghi sổ quỹ, dòng tiền tương ứng cũng sẽ bị xóa.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Hành động không thể hoàn tác.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <Button variant="destructive" onClick={() => {
              if (hasSecurityPassword && !unlocked) {
                requestSecurityPassword();
                return;
              }
              doDelete();
            }} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {hasSecurityPassword && !unlocked ? 'Nhập mật khẩu' : (isOffset ? 'Hoàn tác bù trừ' : 'Xóa phiếu')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SecurityPasswordDialog
        open={showPasswordDialog}
        onOpenChange={handlePasswordDialogOpenChange}
        onSuccess={() => {
          ignoreParentCloseRef.current = false;
          unlock();
          setShowPasswordDialog(false);
          doDelete();
        }}
      />
    </>
  );
}
