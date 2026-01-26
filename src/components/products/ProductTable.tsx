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
import { MoreHorizontal, Pencil, Barcode, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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
        return <Badge className="status-in-stock">Tồn kho</Badge>;
      case 'sold':
        return <Badge className="status-sold">Đã bán</Badge>;
      case 'returned':
        return <Badge className="status-pending">Đã trả</Badge>;
    }
  };

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
            <th>IMEI</th>
            <th>Danh mục</th>
            <th className="text-right">Giá nhập</th>
            <th>Ngày nhập</th>
            <th>Nhà cung cấp</th>
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
              <td className="font-medium">{product.name}</td>
              <td className="text-muted-foreground">{product.sku}</td>
              <td className="font-mono text-sm">{product.imei || '-'}</td>
              <td>{product.categoryName}</td>
              <td className="text-right font-medium">{formatCurrency(product.importPrice)}</td>
              <td>{formatDate(product.importDate)}</td>
              <td>{product.supplierName}</td>
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
