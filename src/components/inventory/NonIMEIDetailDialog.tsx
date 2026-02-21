import { useMemo } from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Package, History, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatCurrencyWithSpaces } from '@/lib/formatNumber';
import { useProductImportHistory } from '@/hooks/useInventory';
import { usePermissions } from '@/hooks/usePermissions';

interface NonIMEIDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  sku: string;
  totalStock: number;
  avgImportPrice: number;
  branchId?: string | null;
}

export function NonIMEIDetailDialog({
  open,
  onOpenChange,
  productId,
  productName,
  sku,
  totalStock,
  avgImportPrice,
  branchId,
}: NonIMEIDetailDialogProps) {
  const { data: permissions } = usePermissions();
  const canViewImportPrice = permissions?.canViewImportPrice ?? false;
  const { data: importHistory, isLoading } = useProductImportHistory(open ? productId : null, branchId);

  // FIFO: Tính số lượng còn lại cho từng phiếu nhập
  const fifoHistory = useMemo(() => {
    if (!importHistory || importHistory.length === 0) return [];

    // Sắp xếp theo ngày nhập tăng dần (cũ nhất trước)
    const sorted = [...importHistory].sort(
      (a, b) => new Date(a.import_date).getTime() - new Date(b.import_date).getTime()
    );

    const totalImported = sorted.reduce((sum, item) => sum + item.quantity, 0);
    let totalSold = totalImported - totalStock;
    if (totalSold < 0) totalSold = 0;

    let remaining = totalSold;
    const result: Array<typeof sorted[0] & { remainingQty: number }> = [];

    for (const item of sorted) {
      if (remaining >= item.quantity) {
        // Phiếu này đã bán hết
        remaining -= item.quantity;
      } else {
        // Phiếu này còn hàng
        result.push({ ...item, remainingQty: item.quantity - remaining });
        remaining = 0;
      }
    }

    // Sắp xếp lại theo ngày mới nhất trước
    return result.reverse();
  }, [importHistory, totalStock]);

  // Tổng số lượng đã nhập
  const totalImported = importHistory?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Lịch sử nhập hàng - {productName}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">SKU: {sku}</p>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : fifoHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Không còn phiếu nhập nào có hàng tồn</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">#</TableHead>
                  <TableHead>Ngày nhập</TableHead>
                  <TableHead>Mã phiếu</TableHead>
                  {canViewImportPrice && <TableHead className="text-right">Giá nhập</TableHead>}
                  <TableHead className="text-center">Đã nhập</TableHead>
                  <TableHead className="text-center">Còn lại</TableHead>
                  {canViewImportPrice && <TableHead className="text-right">Giá trị tồn</TableHead>}
                  <TableHead>Nhà cung cấp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fifoHistory.map((item, index) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-muted-foreground">
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      {format(new Date(item.import_date), 'dd/MM/yyyy', {
                        locale: vi,
                      })}
                    </TableCell>
                    <TableCell className="font-mono text-primary">
                      {item.import_receipts?.code || '-'}
                    </TableCell>
                    {canViewImportPrice && (
                      <TableCell className="text-right font-medium">
                        {formatCurrencyWithSpaces(item.import_price)}
                      </TableCell>
                    )}
                    <TableCell className="text-center text-muted-foreground">
                      {item.quantity}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={item.remainingQty === item.quantity ? 'default' : 'secondary'}>
                        {item.remainingQty}
                      </Badge>
                    </TableCell>
                    {canViewImportPrice && (
                      <TableCell className="text-right">
                        {formatCurrencyWithSpaces(item.import_price * item.remainingQty)}
                      </TableCell>
                    )}
                    <TableCell>{item.suppliers?.name || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="border-t pt-4 flex items-center justify-between text-sm">
          <div className="space-x-4">
            <span className="text-muted-foreground">
              Tổng nhập: <strong>{totalImported}</strong>
            </span>
            <span className="text-muted-foreground">
              Tồn kho: <strong className={totalStock <= 2 ? 'text-destructive' : ''}>{totalStock}</strong>
            </span>
          </div>
          {canViewImportPrice && (
            <div>
              <span className="text-muted-foreground">
                Giá nhập TB: <strong className="text-primary">{formatCurrencyWithSpaces(avgImportPrice)}</strong>
              </span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
