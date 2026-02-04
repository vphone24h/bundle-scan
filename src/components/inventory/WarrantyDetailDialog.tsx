import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Wrench, Undo2, Package } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InventoryItem, ProductDetail } from '@/hooks/useInventory';
import { useRestoreFromWarranty } from '@/hooks/useWarrantyInventory';
import { formatCurrencyWithSpaces } from '@/lib/formatNumber';

interface WarrantyDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InventoryItem;
}

export function WarrantyDetailDialog({
  open,
  onOpenChange,
  item,
}: WarrantyDetailDialogProps) {
  const restoreFromWarranty = useRestoreFromWarranty();

  const handleRestore = async (productId: string) => {
    await restoreFromWarranty.mutateAsync(productId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-warning" />
            Chi tiết hàng bảo hành - {item.productName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Product info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
            <div>
              <p className="text-xs text-muted-foreground">SKU</p>
              <p className="font-medium">{item.sku}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Chi nhánh</p>
              <p className="font-medium">{item.branchName || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Số lượng BH</p>
              <p className="font-medium text-warning">{item.stock}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Giá nhập TB</p>
              <p className="font-medium">{formatCurrencyWithSpaces(item.avgImportPrice)}</p>
            </div>
          </div>

          {/* Products list */}
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  {item.hasImei && <TableHead>IMEI</TableHead>}
                  <TableHead className="text-right">Giá nhập</TableHead>
                  <TableHead>Ngày nhập</TableHead>
                  <TableHead>Nhà cung cấp</TableHead>
                  <TableHead>Ghi chú</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {item.products.map((product, index) => (
                  <TableRow key={product.id}>
                    <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                    {item.hasImei && (
                      <TableCell className="font-mono text-sm">{product.imei}</TableCell>
                    )}
                    <TableCell className="text-right font-medium">
                      {formatCurrencyWithSpaces(product.importPrice)}
                    </TableCell>
                    <TableCell>
                      {format(new Date(product.importDate), 'dd/MM/yyyy', { locale: vi })}
                    </TableCell>
                    <TableCell>{product.supplierName || '-'}</TableCell>
                    <TableCell className="max-w-[150px] truncate" title={product.note || ''}>
                      {product.note || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRestore(product.id)}
                        disabled={restoreFromWarranty.isPending}
                        className="gap-1"
                      >
                        <Undo2 className="h-3 w-3" />
                        Nhập lại kho
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {item.products.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Package className="h-12 w-12 text-muted-foreground/50 mb-2" />
              <p className="text-muted-foreground">Không có sản phẩm chi tiết</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
