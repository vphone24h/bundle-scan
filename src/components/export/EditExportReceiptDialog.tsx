import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, CalendarIcon } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { useSecurityPasswordStatus, useSecurityUnlock } from '@/hooks/useSecurityPassword';
import { SecurityPasswordDialog } from '@/components/security/SecurityPasswordDialog';
import type { ExportReceipt } from '@/hooks/useExportReceipts';

interface EditExportReceiptDialogProps {
  receipt: ExportReceipt | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditExportReceiptDialog({ receipt, open, onOpenChange }: EditExportReceiptDialogProps) {
  const queryClient = useQueryClient();

  const { data: hasSecurityPassword } = useSecurityPasswordStatus();
  const { unlocked: securityUnlocked, unlock: securityUnlock } = useSecurityUnlock('edit-export-receipt');
  const [showSecurityDialog, setShowSecurityDialog] = useState(false);

  const [exportDate, setExportDate] = useState('');
  const [originalExportDate, setOriginalExportDate] = useState('');

  useEffect(() => {
    if (receipt) {
      const dateStr = receipt.export_date
        ? format(parseISO(receipt.export_date), "yyyy-MM-dd'T'HH:mm")
        : '';
      setExportDate(dateStr);
      setOriginalExportDate(dateStr);
    }
  }, [receipt]);

  const handleExportDateChange = (newDate: string) => {
    if (newDate !== originalExportDate && hasSecurityPassword && !securityUnlocked) {
      setShowSecurityDialog(true);
      return;
    }
    setExportDate(newDate);
  };

  const handleSecuritySuccess = () => {
    securityUnlock();
    setShowSecurityDialog(false);
  };

  const updateReceipt = useMutation({
    mutationFn: async ({ receiptId, newDate }: { receiptId: string; newDate: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const oldDate = receipt?.export_date || null;
      const isoDate = new Date(newDate).toISOString();

      // Update receipt date
      const { error } = await supabase
        .from('export_receipts')
        .update({ export_date: isoDate, export_date_modified: true })
        .eq('id', receiptId);
      if (error) throw error;

      // Audit log
      const tenantId = await supabase.rpc('get_user_tenant_id_secure');
      if (tenantId.data) {
        await supabase.from('audit_logs').insert({
          tenant_id: tenantId.data,
          user_id: user.id,
          action_type: 'UPDATE_EXPORT_DATE',
          table_name: 'export_receipts',
          record_id: receiptId,
          description: `Chỉnh sửa ngày bán phiếu ${receipt?.code}: ${oldDate?.substring(0, 16).replace('T', ' ')} → ${isoDate.substring(0, 16).replace('T', ' ')}`,
          old_data: { export_date: oldDate },
          new_data: { export_date: isoDate, export_date_modified: true },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['export-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['export-receipt-items'] });
    },
  });

  const dateChanged = exportDate && exportDate !== originalExportDate;

  const handleSubmit = async () => {
    if (!receipt || !dateChanged) return;

    if (hasSecurityPassword && !securityUnlocked) {
      setShowSecurityDialog(true);
      return;
    }

    try {
      await updateReceipt.mutateAsync({ receiptId: receipt.id, newDate: exportDate });
      toast({
        title: 'Cập nhật thành công',
        description: 'Ngày bán phiếu xuất đã được thay đổi',
      });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể cập nhật phiếu xuất',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa phiếu xuất {receipt?.code}</DialogTitle>
          </DialogHeader>

          {receipt && (
            <div className="space-y-4">
              {/* Info */}
              <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Khách hàng:</span>
                  <span className="font-medium">{receipt.customers?.name || 'Khách lẻ'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tổng tiền:</span>
                  <span className="font-medium">{receipt.total_amount.toLocaleString('vi-VN')}đ</span>
                </div>
              </div>

              {/* Date */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  Ngày giờ bán
                </Label>
                <Input
                  type="datetime-local"
                  value={exportDate}
                  onChange={(e) => handleExportDateChange(e.target.value)}
                  className={cn(
                    dateChanged && 'border-green-500 ring-1 ring-green-500/30'
                  )}
                />
                {dateChanged && (
                  <p className="text-xs text-green-600 font-medium">
                    ⚠ Ngày bán đã thay đổi — phiếu sẽ hiển thị ở ngày mới trong lịch sử
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button onClick={handleSubmit} disabled={updateReceipt.isPending || !dateChanged}>
              {updateReceipt.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Save className="h-4 w-4 mr-2" />
              Lưu thay đổi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SecurityPasswordDialog
        open={showSecurityDialog}
        onOpenChange={setShowSecurityDialog}
        onSuccess={handleSecuritySuccess}
        title="Xác nhận chỉnh sửa ngày bán"
        description="Thay đổi ngày bán là thao tác nhạy cảm. Vui lòng nhập mật khẩu bảo mật."
      />
    </>
  );
}
