import { useState } from 'react';
import { Product } from '@/types/warehouse';
import { formatCurrency, formatDate } from '@/lib/mockData';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Pencil, Barcode, Trash2, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const allSelected = products.length > 0 && selectedProducts.length === products.length;

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

  // Mobile Card View
  if (isMobile) {
    return (
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
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-sm">{formatCurrency(product.importPrice)}</span>
                  {getStatusBadge(product.status)}
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDate(product.importDate)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    );
  }

  // Desktop Table View
  return (
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
            <th className="text-right">Giá nhập</th>
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
              <td className="text-right font-medium text-sm">{formatCurrency(product.importPrice)}</td>
              <td className="hidden md:table-cell">{formatDate(product.importDate)}</td>
              <td className="hidden lg:table-cell">{product.supplierName}</td>
              <td>{getStatusBadge(product.status)}</td>
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
  );
}
