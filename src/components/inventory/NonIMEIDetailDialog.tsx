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

interface NonIMEIDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  sku: string;
  totalStock: number;
  avgImportPrice: number;
}

export function NonIMEIDetailDialog({
  open,
  onOpenChange,
  productId,
  productName,
  sku,
  totalStock,
  avgImportPrice,
}: NonIMEIDetailDialogProps) {
  const { data: importHistory, isLoading } = useProductImportHistory(open ? productId : null);

  // Tính tổng số lượng đã nhập
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
          ) : !importHistory || importHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Chưa có lịch sử nhập hàng</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">#</TableHead>
                  <TableHead>Ngày nhập</TableHead>
                  <TableHead>Mã phiếu</TableHead>
                  <TableHead className="text-right">Giá nhập</TableHead>
                  <TableHead className="text-center">Số lượng</TableHead>
                  <TableHead className="text-right">Thành tiền</TableHead>
                  <TableHead>Nhà cung cấp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importHistory.map((item, index) => (
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
                    <TableCell className="text-right font-medium">
                      {formatCurrencyWithSpaces(item.import_price)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{item.quantity}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrencyWithSpaces(item.import_price * item.quantity)}
                    </TableCell>
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
          <div>
            <span className="text-muted-foreground">
              Giá nhập TB: <strong className="text-primary">{formatCurrencyWithSpaces(avgImportPrice)}</strong>
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
