import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/mockData';
import { Package, DollarSign, Archive, ShoppingCart } from 'lucide-react';
import type { Product } from '@/hooks/useProducts';

interface ImportInventorySummaryProps {
  products: Product[];
  isFiltered?: boolean;
}

export function ImportInventorySummary({ products, isFiltered = false }: ImportInventorySummaryProps) {
  const stats = useMemo(() => {
    // Tổng tất cả sản phẩm đã nhập (bao gồm đã bán, còn hàng, đã trả)
    const allProducts = products || [];
    
    // Tổng giá trị kho hàng nhập (tất cả sản phẩm)
    const totalImportValue = allProducts.reduce((sum, p) => {
      return sum + (Number(p.import_price) * (p.quantity || 1));
    }, 0);
    
    // Tổng số lượng sản phẩm
    const totalQuantity = allProducts.reduce((sum, p) => sum + (p.quantity || 1), 0);
    
    // Sản phẩm còn tồn kho (in_stock)
    const inStockProducts = allProducts.filter(p => p.status === 'in_stock');
    const inStockValue = inStockProducts.reduce((sum, p) => {
      return sum + (Number(p.import_price) * (p.quantity || 1));
    }, 0);
    const inStockQuantity = inStockProducts.reduce((sum, p) => sum + (p.quantity || 1), 0);
    
    // Sản phẩm đã bán (sold)
    const soldProducts = allProducts.filter(p => p.status === 'sold');
    const soldValue = soldProducts.reduce((sum, p) => {
      return sum + (Number(p.import_price) * (p.quantity || 1));
    }, 0);
    const soldQuantity = soldProducts.reduce((sum, p) => sum + (p.quantity || 1), 0);
    
    // Sản phẩm đã trả NCC (returned)
    const returnedProducts = allProducts.filter(p => p.status === 'returned');
    const returnedValue = returnedProducts.reduce((sum, p) => {
      return sum + (Number(p.import_price) * (p.quantity || 1));
    }, 0);
    const returnedQuantity = returnedProducts.reduce((sum, p) => sum + (p.quantity || 1), 0);

    return {
      totalImportValue,
      totalQuantity,
      inStockValue,
      inStockQuantity,
      soldValue,
      soldQuantity,
      returnedValue,
      returnedQuantity,
    };
  }, [products]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      {/* Tổng giá trị nhập */}
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground truncate">
                {isFiltered ? 'Tổng giá trị (đã lọc)' : 'Tổng giá trị nhập'}
              </p>
              <p className="text-lg font-bold text-primary truncate">
                {formatCurrency(stats.totalImportValue)}
              </p>
              <p className="text-xs text-muted-foreground">
                {stats.totalQuantity} sản phẩm
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Giá trị tồn kho */}
      <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/20">
              <Archive className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground truncate">
                Giá trị tồn kho
              </p>
              <p className="text-lg font-bold text-green-600 dark:text-green-400 truncate">
                {formatCurrency(stats.inStockValue)}
              </p>
              <p className="text-xs text-muted-foreground">
                {stats.inStockQuantity} sản phẩm
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Giá trị đã bán */}
      <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <ShoppingCart className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground truncate">
                Giá trị đã bán (giá nhập)
              </p>
              <p className="text-lg font-bold text-blue-600 dark:text-blue-400 truncate">
                {formatCurrency(stats.soldValue)}
              </p>
              <p className="text-xs text-muted-foreground">
                {stats.soldQuantity} sản phẩm
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Giá trị đã trả NCC */}
      <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/20">
              <Package className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground truncate">
                Đã trả NCC
              </p>
              <p className="text-lg font-bold text-orange-600 dark:text-orange-400 truncate">
                {formatCurrency(stats.returnedValue)}
              </p>
              <p className="text-xs text-muted-foreground">
                {stats.returnedQuantity} sản phẩm
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
