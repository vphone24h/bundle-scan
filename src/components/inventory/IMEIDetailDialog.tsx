import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { X, Package, Smartphone } from 'lucide-react';
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
import { ProductDetail } from '@/hooks/useInventory';

interface IMEIDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  sku: string;
  products: ProductDetail[];
}

export function IMEIDetailDialog({
  open,
  onOpenChange,
  productName,
  sku,
  products,
}: IMEIDetailDialogProps) {
  // Only show in_stock products with IMEI
  const inStockProducts = products.filter(
    (p) => p.status === 'in_stock' && p.imei
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            Chi tiết IMEI - {productName}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">SKU: {sku}</p>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {inStockProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Không có IMEI nào trong kho</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">#</TableHead>
                  <TableHead>IMEI</TableHead>
                  <TableHead>Tên sản phẩm</TableHead>
                  <TableHead>Chi nhánh</TableHead>
                  <TableHead className="text-right">Giá nhập</TableHead>
                  <TableHead>Ngày nhập</TableHead>
                  <TableHead>Nhà cung cấp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inStockProducts.map((product, index) => (
                  <TableRow key={product.id}>
                    <TableCell className="text-muted-foreground">
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {product.imei}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>{product.branchName || '-'}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrencyWithSpaces(product.importPrice)}
                    </TableCell>
                    <TableCell>
                      {format(new Date(product.importDate), 'dd/MM/yyyy', {
                        locale: vi,
                      })}
                    </TableCell>
                    <TableCell>{product.supplierName || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="border-t pt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Tổng cộng: <strong>{inStockProducts.length}</strong> IMEI trong kho
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
