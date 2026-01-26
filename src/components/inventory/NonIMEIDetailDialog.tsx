import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Package, History } from 'lucide-react';
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

interface NonIMEIDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  sku: string;
  products: ProductDetail[];
  totalStock: number;
}

interface ImportGroup {
  importDate: string;
  importPrice: number;
  supplierName: string | null;
  quantity: number;
  soldQuantity: number;
}

export function NonIMEIDetailDialog({
  open,
  onOpenChange,
  productName,
  sku,
  products,
  totalStock,
}: NonIMEIDetailDialogProps) {
  // Group products by import date and supplier
  const importGroups = products.reduce<ImportGroup[]>((acc, product) => {
    const dateKey = format(new Date(product.importDate), 'yyyy-MM-dd');
    const existingGroup = acc.find(
      (g) =>
        format(new Date(g.importDate), 'yyyy-MM-dd') === dateKey &&
        g.importPrice === product.importPrice &&
        g.supplierName === product.supplierName
    );

    if (existingGroup) {
      existingGroup.quantity += 1;
      if (product.status === 'sold') {
        existingGroup.soldQuantity += 1;
      }
    } else {
      acc.push({
        importDate: product.importDate,
        importPrice: product.importPrice,
        supplierName: product.supplierName,
        quantity: 1,
        soldQuantity: product.status === 'sold' ? 1 : 0,
      });
    }

    return acc;
  }, []);

  // Sort by import date descending
  importGroups.sort(
    (a, b) => new Date(b.importDate).getTime() - new Date(a.importDate).getTime()
  );

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
          {importGroups.length === 0 ? (
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
                  <TableHead className="text-right">Giá nhập</TableHead>
                  <TableHead className="text-center">Số lượng nhập</TableHead>
                  <TableHead className="text-center">Đã bán</TableHead>
                  <TableHead className="text-center">Còn lại</TableHead>
                  <TableHead>Nhà cung cấp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importGroups.map((group, index) => {
                  const remaining = group.quantity - group.soldQuantity;
                  return (
                    <TableRow key={index}>
                      <TableCell className="text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      <TableCell>
                        {format(new Date(group.importDate), 'dd/MM/yyyy', {
                          locale: vi,
                        })}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrencyWithSpaces(group.importPrice)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{group.quantity}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{group.soldQuantity}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={remaining === 0 ? 'destructive' : 'default'}
                          className={remaining === 0 ? 'bg-muted text-muted-foreground' : ''}
                        >
                          {remaining}
                        </Badge>
                      </TableCell>
                      <TableCell>{group.supplierName || '-'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="border-t pt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Tổng nhập: <strong>{products.length}</strong> | Tồn kho hiện tại:{' '}
            <strong className={totalStock <= 2 ? 'text-destructive' : ''}>
              {totalStock}
            </strong>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
