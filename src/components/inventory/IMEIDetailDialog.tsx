import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Package, Smartphone, Loader2 } from 'lucide-react';
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
import { usePermissions } from '@/hooks/usePermissions';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface IMEIDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  sku: string;
  branchId?: string | null;
}

export function IMEIDetailDialog({
  open,
  onOpenChange,
  productName,
  sku,
  branchId,
}: IMEIDetailDialogProps) {
  const { data: permissions } = usePermissions();
  const canViewImportPrice = permissions?.canViewImportPrice ?? false;

  // Fetch IMEI products on-demand when dialog opens
  const { data: inStockProducts = [], isLoading } = useQuery({
    queryKey: ['imei-detail', productName, sku, branchId],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select('id, name, sku, imei, import_price, import_date, supplier_id, note, suppliers(name), branches(name)')
        .eq('name', productName)
        .eq('sku', sku)
        .eq('status', 'in_stock' as any)
        .not('imei', 'is', null)
        .order('import_date', { ascending: false });

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: open,
    staleTime: 30 * 1000,
  });

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
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : inStockProducts.length === 0 ? (
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
                  {canViewImportPrice && <TableHead className="text-right">Giá nhập</TableHead>}
                  <TableHead>Ngày nhập</TableHead>
                  <TableHead>Nhà cung cấp</TableHead>
                  <TableHead>Ghi chú</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inStockProducts.map((product: any, index: number) => (
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
                    {canViewImportPrice && (
                      <TableCell className="text-right font-medium">
                        {formatCurrencyWithSpaces(product.import_price)}
                      </TableCell>
                    )}
                    <TableCell>
                      {format(new Date(product.import_date), 'dd/MM/yyyy', {
                        locale: vi,
                      })}
                    </TableCell>
                    <TableCell>{product.suppliers?.name || '-'}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={product.note || ''}>
                      {product.note || '-'}
                    </TableCell>
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
