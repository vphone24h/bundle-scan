import { useState } from 'react';
import { Product } from '@/types/warehouse';
import { formatCurrency, formatDate } from '@/lib/mockData';
import { formatCurrencyWithSpaces } from '@/lib/formatNumber';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Pencil, Barcode, Trash2, Package, Settings2, Printer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePermissions } from '@/hooks/usePermissions';
import { AdjustQuantityDialog } from './AdjustQuantityDialog';
import { DeleteProductDialog } from './DeleteProductDialog';

interface ProductTableProps {
  products: Product[];
  selectedProducts: string[];
  onSelectionChange: (ids: string[]) => void;
  onEdit: (product: Product) => void;
  onPrintBarcode: (products: Product[]) => void;
}

export function ProductTable({
  products,
  selectedProducts,
  onSelectionChange,
  onEdit,
  onPrintBarcode,
}: ProductTableProps) {
  const isMobile = useIsMobile();
  const { data: permissions } = usePermissions();
  const allSelected = products.length > 0 && selectedProducts.length === products.length;

  // Dialog states
  const [adjustDialog, setAdjustDialog] = useState<{
    open: boolean;
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
  }>({ open: false, productId: '', productName: '', sku: '', quantity: 0 });

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    productId: string;
    productName: string;
    sku: string;
    imei: string;
  }>({ open: false, productId: '', productName: '', sku: '', imei: '' });

  const toggleAll = () => {
    if (allSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(products.map((p) => p.id));
    }
  };

  const toggleOne = (id: string) => {
    if (selectedProducts.includes(id)) {
      onSelectionChange(selectedProducts.filter((i) => i !== id));
    } else {
      onSelectionChange([...selectedProducts, id]);
    }
  };

  const getStatusBadge = (status: Product['status']) => {
    switch (status) {
      case 'in_stock':
        return <Badge className="status-in-stock text-[10px] sm:text-xs">Tồn kho</Badge>;
      case 'sold':
        return <Badge className="status-sold text-[10px] sm:text-xs">Đã bán</Badge>;
      case 'returned':
        return <Badge className="status-pending text-[10px] sm:text-xs">Đã trả</Badge>;
    }
  };

  const handleAdjustQuantity = (product: Product) => {
    setAdjustDialog({
      open: true,
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      quantity: product.quantity || 1,
    });
  };

  const handleDeleteProduct = (product: Product) => {
    setDeleteDialog({
      open: true,
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      imei: product.imei || '',
    });
  };

  // Check if product is IMEI product
  const isIMEIProduct = (product: Product) => !!product.imei;

  // Mobile Card View
  if (isMobile) {
    return (
      <>
        <div className="space-y-2">
          {/* Select All Header */}
          <div className="flex items-center gap-3 p-3 bg-card border rounded-lg">
            <Checkbox
              checked={allSelected}
              onCheckedChange={toggleAll}
              aria-label="Chọn tất cả"
            />
            <span className="text-sm font-medium text-muted-foreground">
              {selectedProducts.length > 0 ? `Đã chọn ${selectedProducts.length}` : 'Chọn tất cả'}
            </span>
          </div>

          {products.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground bg-card border rounded-lg">
              Không có sản phẩm nào
            </div>
          ) : (
            products.map((product) => (
              <div
                key={product.id}
                className={cn(
                  'bg-card border rounded-lg p-3 space-y-2',
                  selectedProducts.includes(product.id) && 'ring-2 ring-primary/50'
                )}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={selectedProducts.includes(product.id)}
                    onCheckedChange={() => toggleOne(product.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{product.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{product.sku}</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover">
                          <DropdownMenuItem onClick={() => onEdit(product)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Chỉnh sửa
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onPrintBarcode([product])}>
                            <Barcode className="mr-2 h-4 w-4" />
                            In mã vạch
                          </DropdownMenuItem>
                          
                          {/* Super Admin only actions */}
                          {permissions?.canAdjustProductQuantity && !isIMEIProduct(product) && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleAdjustQuantity(product)}>
                                <Settings2 className="mr-2 h-4 w-4" />
                                Điều chỉnh số lượng
                              </DropdownMenuItem>
                            </>
                          )}
                          
                          {permissions?.canDeleteIMEIProducts && isIMEIProduct(product) && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => handleDeleteProduct(product)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Xóa sản phẩm
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground pl-7">
                  {product.imei && (
                    <span className="font-mono">IMEI: {product.imei}</span>
                  )}
                  <span>{product.categoryName || 'Chưa phân loại'}</span>
                </div>
                
                <div className="flex items-center justify-between pl-7">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-3">
                      {permissions?.canViewImportPrice && (
                        <span className="font-semibold text-sm">{formatCurrency(product.importPrice)}</span>
                      )}
                      {product.salePrice && product.salePrice > 0 && (
                        <span className={cn("text-xs text-success", !permissions?.canViewImportPrice && "font-semibold text-sm text-foreground")}>
                          {permissions?.canViewImportPrice ? 'Giá bán: ' : ''}{formatCurrencyWithSpaces(product.salePrice)}đ
                        </span>
                      )}
                      {getStatusBadge(product.status)}
                      {(product as any).isPrinted && (
                        <Badge variant="outline" className="text-[10px] gap-0.5 h-5 border-primary/30 text-primary">
                          <Printer className="h-2.5 w-2.5" />
                          Đã in
                        </Badge>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(product.importDate)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Dialogs */}
        <AdjustQuantityDialog
          open={adjustDialog.open}
          onOpenChange={(open) => setAdjustDialog(prev => ({ ...prev, open }))}
          productId={adjustDialog.productId}
          productName={adjustDialog.productName}
          sku={adjustDialog.sku}
          currentQuantity={adjustDialog.quantity}
        />

        <DeleteProductDialog
          open={deleteDialog.open}
          onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}
          productId={deleteDialog.productId}
          productName={deleteDialog.productName}
          sku={deleteDialog.sku}
          imei={deleteDialog.imei}
        />
      </>
    );
  }

  // Desktop Table View
  return (
    <>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-12">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Chọn tất cả"
                />
              </th>
              <th>Tên sản phẩm</th>
              <th>SKU</th>
              <th className="hidden lg:table-cell">IMEI</th>
              <th className="hidden sm:table-cell">Danh mục</th>
              {permissions?.canViewImportPrice && <th className="text-right">Giá nhập</th>}
              <th className="text-right hidden sm:table-cell">Giá bán</th>
              <th className="hidden md:table-cell">Ngày nhập</th>
              <th className="hidden lg:table-cell">Nhà cung cấp</th>
              <th>Trạng thái</th>
              <th className="w-16"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td>
                  <Checkbox
                    checked={selectedProducts.includes(product.id)}
                    onCheckedChange={() => toggleOne(product.id)}
                    aria-label={`Chọn ${product.name}`}
                  />
                </td>
                <td className="font-medium max-w-[200px] truncate">{product.name}</td>
                <td className="text-muted-foreground text-xs sm:text-sm">{product.sku}</td>
                <td className="font-mono text-xs sm:text-sm hidden lg:table-cell">{product.imei || '-'}</td>
                <td className="hidden sm:table-cell">{product.categoryName}</td>
                {permissions?.canViewImportPrice && <td className="text-right font-medium text-sm">{formatCurrency(product.importPrice)}</td>}
                <td className="text-right font-medium text-sm hidden sm:table-cell">
                  {product.salePrice ? formatCurrencyWithSpaces(product.salePrice) + 'đ' : '-'}
                </td>
                <td className="hidden md:table-cell">{formatDate(product.importDate)}</td>
                <td className="hidden lg:table-cell">{product.supplierName}</td>
                <td>
                  {getStatusBadge(product.status)}
                  {(product as any).isPrinted && (
                    <Badge variant="outline" className="ml-1 text-[10px] gap-0.5 h-5 border-primary/30 text-primary">
                      <Printer className="h-2.5 w-2.5" />
                      Đã in
                    </Badge>
                  )}
                </td>
                <td>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-popover">
                      <DropdownMenuItem onClick={() => onEdit(product)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Chỉnh sửa
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onPrintBarcode([product])}>
                        <Barcode className="mr-2 h-4 w-4" />
                        In mã vạch
                      </DropdownMenuItem>
                      
                      {/* Super Admin only actions */}
                      {permissions?.canAdjustProductQuantity && !isIMEIProduct(product) && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleAdjustQuantity(product)}>
                            <Settings2 className="mr-2 h-4 w-4" />
                            Điều chỉnh số lượng
                          </DropdownMenuItem>
                        </>
                      )}
                      
                      {permissions?.canDeleteIMEIProducts && isIMEIProduct(product) && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleDeleteProduct(product)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Xóa sản phẩm
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {products.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            Không có sản phẩm nào
          </div>
        )}
      </div>

      {/* Dialogs */}
      <AdjustQuantityDialog
        open={adjustDialog.open}
        onOpenChange={(open) => setAdjustDialog(prev => ({ ...prev, open }))}
        productId={adjustDialog.productId}
        productName={adjustDialog.productName}
        sku={adjustDialog.sku}
        currentQuantity={adjustDialog.quantity}
      />

      <DeleteProductDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}
        productId={deleteDialog.productId}
        productName={deleteDialog.productName}
        sku={deleteDialog.sku}
        imei={deleteDialog.imei}
      />
    </>
  );
}
