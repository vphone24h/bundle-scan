import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
import { Loader2, Pencil, CalendarIcon } from 'lucide-react';
import { formatNumberWithSpaces } from '@/lib/formatNumber';
import type { ImportReturn, ExportReturn } from '@/hooks/useReturns';
import { useEditImportReturn, useEditExportReturn } from '@/hooks/useReturns';
import { useSecurityPasswordStatus, useSecurityUnlock } from '@/hooks/useSecurityPassword';
import { SecurityPasswordDialog } from '@/components/security/SecurityPasswordDialog';
import { toast } from 'sonner';
import { format, parseISO, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';

type CombinedReturn =
  | (ImportReturn & { returnType: 'import' })
  | (ExportReturn & { returnType: 'export' });

interface EditReturnDialogProps {
  returnItem: CombinedReturn | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditReturnDialog({ returnItem, open, onOpenChange }: EditReturnDialogProps) {
  const { t } = useTranslation();
  const editImport = useEditImportReturn();
  const editExport = useEditExportReturn();

  const { data: hasSecurityPassword } = useSecurityPasswordStatus();
  const { unlocked: securityUnlocked, unlock: securityUnlock } = useSecurityUnlock('edit-return-date');
  const [showSecurityDialog, setShowSecurityDialog] = useState(false);

  const [refundAmount, setRefundAmount] = useState(0);
  const [storeKeepAmount, setStoreKeepAmount] = useState(0);
  const [note, setNote] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [originalReturnDate, setOriginalReturnDate] = useState('');

  useEffect(() => {
    if (!returnItem) return;
    if (returnItem.returnType === 'import') {
      setRefundAmount(returnItem.total_refund_amount);
      setStoreKeepAmount(0);
    } else {
      setRefundAmount(returnItem.refund_amount);
      setStoreKeepAmount(returnItem.store_keep_amount);
    }
    setNote(returnItem.note || '');
    const dateStr = returnItem.return_date
      ? format(parseISO(returnItem.return_date), "yyyy-MM-dd'T'HH:mm")
      : '';
    setReturnDate(dateStr);
    setOriginalReturnDate(dateStr);
  }, [returnItem]);

  if (!returnItem) return null;

  const isImport = returnItem.returnType === 'import';
  const isPending = editImport.isPending || editExport.isPending;
  const dateChanged = returnDate && returnDate !== originalReturnDate;

  // Check if return is older than 1 month
  const returnAge = differenceInDays(new Date(), new Date(returnItem.return_date));
  const canEditDate = returnAge <= 30;

  const handleSecuritySuccess = () => {
    securityUnlock();
    setShowSecurityDialog(false);
  };

  const handleSave = async () => {
    if (refundAmount < 0) {
      toast.error('Số tiền hoàn không hợp lệ');
      return;
    }

    // Date change validation
    if (dateChanged) {
      if (!canEditDate) {
        toast.error('Không thể sửa ngày trả hàng quá 1 tháng');
        return;
      }
      if (hasSecurityPassword && !securityUnlocked) {
        setShowSecurityDialog(true);
        return;
      }
    }

    const newReturnDate = dateChanged ? new Date(returnDate).toISOString() : undefined;

    try {
      if (isImport) {
        await editImport.mutateAsync({
          returnItem: returnItem as ImportReturn & { returnType: 'import' },
          newRefundAmount: refundAmount,
          note,
          newReturnDate,
        });
      } else {
        await editExport.mutateAsync({
          returnItem: returnItem as ExportReturn & { returnType: 'export' },
          newRefundAmount: refundAmount,
          newStoreKeepAmount: storeKeepAmount,
          note,
          newReturnDate,
        });
      }
      toast.success('Đã cập nhật phiếu trả hàng');
      onOpenChange(false);
    } catch (e: any) {
      toast.error('Lỗi cập nhật: ' + (e.message || ''));
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Chỉnh sửa phiếu trả hàng
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Info */}
            <div className="bg-muted/50 p-3 rounded-lg space-y-1 text-sm">
              <div><span className="text-muted-foreground">Mã phiếu:</span> <span className="font-mono font-medium">{returnItem.code}</span></div>
              <div><span className="text-muted-foreground">Sản phẩm:</span> {returnItem.product_name}</div>
              {returnItem.imei && <div><span className="text-muted-foreground">IMEI:</span> {returnItem.imei}</div>}
              <div><span className="text-muted-foreground">SKU:</span> {returnItem.sku}</div>
            </div>

            {/* Return Date */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5" />
                Ngày giờ trả hàng
              </Label>
              <Input
                type="datetime-local"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                disabled={!canEditDate}
                className={cn(dateChanged && 'border-green-500 ring-1 ring-green-500/30')}
              />
              {!canEditDate && (
                <p className="text-xs text-destructive">
                  Phiếu trả hàng quá 1 tháng, không cho phép sửa ngày
                </p>
              )}
              {dateChanged && canEditDate && (
                <p className="text-xs text-green-600 font-medium">
                  ⚠ Ngày trả đã thay đổi — sổ quỹ và báo cáo sẽ đồng bộ theo
                </p>
              )}
            </div>

            {/* Refund amount */}
            <div className="space-y-2">
              <Label>{isImport ? 'Số tiền NCC hoàn lại' : 'Số tiền hoàn khách'}</Label>
              <Input
                type="number"
                min={0}
                value={refundAmount}
                onChange={(e) => setRefundAmount(Number(e.target.value))}
              />
              {isImport && (
                <p className="text-xs text-muted-foreground">
                  Giá nhập gốc: {formatNumberWithSpaces((returnItem as ImportReturn).import_price)}đ
                </p>
              )}
              {!isImport && (
                <p className="text-xs text-muted-foreground">
                  Giá bán gốc: {formatNumberWithSpaces((returnItem as ExportReturn).sale_price)}đ
                </p>
              )}
            </div>

            {/* Store keep amount (export only) */}
            {!isImport && (
              <div className="space-y-2">
                <Label>Phí giữ lại (cửa hàng thu)</Label>
                <Input
                  type="number"
                  min={0}
                  value={storeKeepAmount}
                  onChange={(e) => setStoreKeepAmount(Number(e.target.value))}
                />
              </div>
            )}

            {/* Note */}
            <div className="space-y-2">
              <Label>Ghi chú</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Lý do chỉnh sửa..."
                rows={2}
              />
            </div>

            {/* Summary */}
            <div className="bg-primary/5 border border-primary/20 p-3 rounded-lg text-sm space-y-1">
              <div className="font-medium text-primary">Tổng kết sau chỉnh sửa:</div>
              <div>Hoàn tiền: <span className="font-semibold">{formatNumberWithSpaces(refundAmount)}đ</span></div>
              {!isImport && storeKeepAmount > 0 && (
                <div>Phí giữ lại: <span className="font-semibold text-green-600">{formatNumberWithSpaces(storeKeepAmount)}đ</span></div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Hủy
            </Button>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Lưu thay đổi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SecurityPasswordDialog
        open={showSecurityDialog}
        onOpenChange={setShowSecurityDialog}
        onSuccess={handleSecuritySuccess}
        title="Xác nhận sửa ngày trả hàng"
        description="Thay đổi ngày trả hàng là thao tác nhạy cảm. Vui lòng nhập mật khẩu bảo mật."
      />
    </>
  );
}
