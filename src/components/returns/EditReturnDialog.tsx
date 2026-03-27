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
import { Loader2, Pencil } from 'lucide-react';
import { formatNumberWithSpaces } from '@/lib/formatNumber';
import type { ImportReturn, ExportReturn } from '@/hooks/useReturns';
import { useEditImportReturn, useEditExportReturn } from '@/hooks/useReturns';
import { toast } from 'sonner';

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

  const [refundAmount, setRefundAmount] = useState(0);
  const [storeKeepAmount, setStoreKeepAmount] = useState(0);
  const [note, setNote] = useState('');

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
  }, [returnItem]);

  if (!returnItem) return null;

  const isImport = returnItem.returnType === 'import';
  const isPending = editImport.isPending || editExport.isPending;

  const handleSave = async () => {
    if (refundAmount < 0) {
      toast.error('Số tiền hoàn không hợp lệ');
      return;
    }

    try {
      if (isImport) {
        await editImport.mutateAsync({
          returnItem: returnItem as ImportReturn & { returnType: 'import' },
          newRefundAmount: refundAmount,
          note,
        });
      } else {
        await editExport.mutateAsync({
          returnItem: returnItem as ExportReturn & { returnType: 'export' },
          newRefundAmount: refundAmount,
          newStoreKeepAmount: storeKeepAmount,
          note,
        });
      }
      toast.success('Đã cập nhật phiếu trả hàng');
      onOpenChange(false);
    } catch (e: any) {
      toast.error('Lỗi cập nhật: ' + (e.message || ''));
    }
  };

  return (
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
  );
}
