import { useState, useEffect, useMemo, useRef } from 'react';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { formatNumber } from '@/lib/formatNumber';
import { useCustomPaymentSources } from '@/hooks/useCustomPaymentSources';
import { useCurrentTenant } from '@/hooks/useTenant';
import { useSecurityPasswordStatus, useSecurityUnlock } from '@/hooks/useSecurityPassword';
import { SecurityPasswordDialog } from '@/components/security/SecurityPasswordDialog';

interface DebtDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: 'customer' | 'supplier';
  entityId: string;
  entityName: string;
  remainingAmount: number;
  branchId: string | null;
}

export function DebtDeleteDialog({
  open, onOpenChange, entityType, entityId, entityName, remainingAmount, branchId,
}: DebtDeleteDialogProps) {
  const queryClient = useQueryClient();
  const { data: hasSecurityPassword } = useSecurityPasswordStatus();
  const { unlocked, unlock } = useSecurityUnlock('debt-delete');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [syncCashBook, setSyncCashBook] = useState(false);
  const [paymentSource, setPaymentSource] = useState('cash');
  const [deleting, setDeleting] = useState(false);
  const ignoreParentCloseRef = useRef(false);
  const { data: customPaymentSources = [] } = useCustomPaymentSources();
  const { data: tenant } = useCurrentTenant();

  const allPaymentSources = useMemo(() => {
    const defaults = [
      { value: 'cash', label: 'Tiền mặt' },
      { value: 'bank_card', label: 'Thẻ ngân hàng' },
      { value: 'e_wallet', label: 'Ví điện tử' },
    ];
    const custom = customPaymentSources.map((s: any) => ({
      value: s.id, label: s.name,
    }));
    return [...defaults, ...custom];
  }, [customPaymentSources]);

  useEffect(() => {
    if (open) {
      setSyncCashBook(false);
      setPaymentSource('cash');
    }
  }, [open]);

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

  const handleDelete = async () => {
    if (hasSecurityPassword && !unlocked) {
      requestSecurityPassword();
      return;
    }

    setDeleting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const entityLabel = entityType === 'customer' ? 'khách hàng' : 'nhà cung cấp';
      const tenantId = tenant?.id;

      // Fetch staff name for cash book
      const { data: staffProfile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', user?.id)
        .maybeSingle();
      const staffName = staffProfile?.display_name || user?.email || null;

      // If sync cash book: record remaining amount as income (customer) or expense (supplier)
      if (syncCashBook && remainingAmount > 0) {
        const cashBookType = entityType === 'customer' ? 'income' as const : 'expense' as const;
        const category = entityType === 'customer' ? 'Thu nợ (xóa công nợ)' : 'Trả nợ NCC (xóa công nợ)';
        const { error: cashErr } = await supabase.from('cash_book').insert([{
          type: cashBookType,
          amount: remainingAmount,
          category,
          description: `Xóa công nợ ${entityLabel}: ${entityName} - ${formatNumber(remainingAmount)}đ`,
          payment_source: paymentSource,
          branch_id: branchId,
          created_by: user?.id,
          created_by_name: staffName,
          recipient_name: entityName,
          tenant_id: tenantId,
          is_business_accounting: false,
          transaction_date: new Date().toISOString(),
        }]);
        if (cashErr) {
          console.error('Cash book insert error:', cashErr);
          throw cashErr;
        }
      }

      // Delete all debt_payments for this entity
      const { error: deletePaymentsError } = await supabase
        .from('debt_payments')
        .delete()
        .eq('entity_type', entityType)
        .eq('entity_id', entityId);

      if (deletePaymentsError) throw deletePaymentsError;

      // Delete tag assignments
      await supabase
        .from('debt_tag_assignments')
        .delete()
        .eq('entity_type', entityType)
        .eq('entity_id', entityId);

      // Audit log
      await supabase.from('audit_logs').insert([{
        user_id: user?.id,
        action_type: 'delete',
        table_name: 'debt_payments',
        record_id: entityId,
        branch_id: branchId,
        description: `Xóa toàn bộ công nợ ${entityLabel}: ${entityName} | Còn nợ: ${formatNumber(remainingAmount)}đ | ${syncCashBook ? `Ghi sổ quỹ (${allPaymentSources.find(s => s.value === paymentSource)?.label})` : 'Không ghi sổ quỹ (xóa nợ)'}`,
        old_data: { entity_id: entityId, entity_name: entityName, remaining_amount: remainingAmount },
        new_data: { sync_cash_book: syncCashBook, payment_source: syncCashBook ? paymentSource : null },
      }]);

      // Invalidate all related queries - removeQueries for cash-book to clear stale cache
      queryClient.invalidateQueries({ queryKey: ['debt'] });
      queryClient.invalidateQueries({ queryKey: ['customer-debts'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-debts'] });
      queryClient.invalidateQueries({ queryKey: ['debt-detail'] });
      queryClient.invalidateQueries({ queryKey: ['debt-payment-history'] });
      queryClient.removeQueries({ queryKey: ['cash-book'] });
      queryClient.removeQueries({ queryKey: ['cash-book-balances'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });

      toast.success(`Đã xóa công nợ của ${entityName}`);
      onOpenChange(false);
    } catch (err) {
      console.error('Delete debt error:', err);
      toast.error('Lỗi khi xóa công nợ');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <AlertDialog open={open} onOpenChange={handleAlertDialogOpenChange}>
        <AlertDialogContent className="max-w-sm z-[60]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Xóa công nợ
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left space-y-2">
              <p>
                Bạn có chắc muốn xóa <strong>toàn bộ công nợ</strong> của{' '}
                <span className="font-semibold">{entityName}</span>?
              </p>
              {remainingAmount > 0 && (
                <p className="text-destructive font-semibold">
                  Còn nợ: {formatNumber(remainingAmount)}đ
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Hành động này không thể hoàn tác. Toàn bộ lịch sử nợ sẽ bị xóa.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-2">
            {/* Sync cash book checkbox */}
            {remainingAmount > 0 && (
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="syncCashBook"
                    checked={syncCashBook}
                    onCheckedChange={(v) => setSyncCashBook(!!v)}
                  />
                  <Label htmlFor="syncCashBook" className="text-sm leading-tight cursor-pointer">
                    Đồng bộ vào sổ quỹ
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      {entityType === 'customer'
                        ? 'Ghi nhận thu nợ vào sổ quỹ (coi như đã thu tiền)'
                        : 'Ghi nhận trả nợ NCC vào sổ quỹ (coi như đã trả tiền)'}
                    </span>
                  </Label>
                </div>

                {syncCashBook && (
                  <div className="ml-6 space-y-2">
                    <Label className="text-xs">Nguồn tiền</Label>
                    <Select value={paymentSource} onValueChange={setPaymentSource}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[70]">
                        {allPaymentSources.map(s => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Số tiền <span className="font-semibold text-foreground">{formatNumber(remainingAmount)}đ</span> sẽ
                      được ghi {entityType === 'customer' ? 'thu' : 'chi'} vào sổ quỹ
                    </p>
                  </div>
                )}

                {!syncCashBook && (
                  <p className="ml-6 text-xs text-orange-600">
                    ⚠ Không ghi sổ quỹ = coi như {entityType === 'customer' ? 'mất nợ (quỵt nợ)' : 'NCC xóa nợ cho mình'}
                  </p>
                )}
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {hasSecurityPassword && !unlocked ? 'Nhập mật khẩu bảo mật' : 'Xóa công nợ'}
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
          handleDelete();
        }}
      />
    </>
  );
}
