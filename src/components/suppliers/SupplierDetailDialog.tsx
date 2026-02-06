import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatCurrency, formatDate } from '@/lib/mockData';
import { 
  Package, 
  DollarSign, 
  Archive, 
  ShoppingCart, 
  CreditCard,
  CheckCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
  Phone,
  MapPin,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import type { Supplier } from '@/hooks/useSuppliers';

interface SupplierDetailDialogProps {
  supplier: Supplier | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SupplierDetailDialog({ supplier, open, onOpenChange }: SupplierDetailDialogProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Fetch products from this supplier
  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['supplier-products', supplier?.id],
    queryFn: async () => {
      if (!supplier?.id) return [];
      const { data, error } = await supabase
        .from('products')
        .select('*, categories(name), branches(name)')
        .eq('supplier_id', supplier.id)
        .order('import_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!supplier?.id && open,
  });

  // Fetch import receipts for debt info
  const { data: receipts, isLoading: receiptsLoading } = useQuery({
    queryKey: ['supplier-receipts', supplier?.id],
    queryFn: async () => {
      if (!supplier?.id) return [];
      const { data, error } = await supabase
        .from('import_receipts')
        .select('id, code, total_amount, paid_amount, debt_amount, status')
        .eq('supplier_id', supplier.id)
        .eq('status', 'completed');
      if (error) throw error;
      return data;
    },
    enabled: !!supplier?.id && open,
  });

  // Calculate product stats
  const productStats = useMemo(() => {
    if (!products) return { total: 0, inStock: 0, sold: 0, returned: 0, totalValue: 0, inStockValue: 0, soldValue: 0, returnedValue: 0 };
    
    const inStockProducts = products.filter(p => p.status === 'in_stock');
    const soldProducts = products.filter(p => p.status === 'sold');
    const returnedProducts = products.filter(p => p.status === 'returned');

    return {
      total: products.reduce((sum, p) => sum + (p.quantity || 1), 0),
      inStock: inStockProducts.reduce((sum, p) => sum + (p.quantity || 1), 0),
      sold: soldProducts.reduce((sum, p) => sum + (p.quantity || 1), 0),
      returned: returnedProducts.reduce((sum, p) => sum + (p.quantity || 1), 0),
      totalValue: products.reduce((sum, p) => sum + (Number(p.import_price) * (p.quantity || 1)), 0),
      inStockValue: inStockProducts.reduce((sum, p) => sum + (Number(p.import_price) * (p.quantity || 1)), 0),
      soldValue: soldProducts.reduce((sum, p) => sum + (Number(p.import_price) * (p.quantity || 1)), 0),
      returnedValue: returnedProducts.reduce((sum, p) => sum + (Number(p.import_price) * (p.quantity || 1)), 0),
    };
  }, [products]);

  // Calculate debt stats
  const debtStats = useMemo(() => {
    if (!receipts) return { totalDebt: 0, totalPaid: 0, remaining: 0 };
    
    const totalDebt = receipts.reduce((sum, r) => sum + Number(r.total_amount), 0);
    const totalPaid = receipts.reduce((sum, r) => sum + Number(r.paid_amount), 0);
    const remaining = receipts.reduce((sum, r) => sum + Number(r.debt_amount), 0);

    return { totalDebt, totalPaid, remaining };
  }, [receipts]);

  const handleGoToDebt = () => {
    if (supplier) {
      navigate(`/debt?tab=supplier&supplierId=${supplier.id}`);
      onOpenChange(false);
    }
  };

  const isLoading = productsLoading || receiptsLoading;

  if (!supplier) return null;

  const content = (
    <>
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-4 md:space-y-6 pb-4">
          {/* Supplier Info */}
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            {supplier.phone && (
              <div className="flex items-center gap-1">
                <Phone className="h-4 w-4" />
                {supplier.phone}
              </div>
            )}
            {supplier.address && (
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {supplier.address}
              </div>
            )}
          </div>

          {/* Product Stats */}
          <div>
            <h3 className="font-semibold mb-2 md:mb-3 text-xs md:text-sm uppercase tracking-wide text-muted-foreground">
              Thống kê hàng hóa
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3">
              <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="p-1.5 md:p-2 rounded-lg bg-primary/20">
                      <DollarSign className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] md:text-xs text-muted-foreground">Tổng giá trị nhập</p>
                      <p className="text-sm md:text-lg font-bold text-primary truncate">
                        {formatCurrency(productStats.totalValue)}
                      </p>
                      <p className="text-[10px] md:text-xs text-muted-foreground">{productStats.total} SP</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="p-1.5 md:p-2 rounded-lg bg-emerald-500/20">
                      <Archive className="h-4 w-4 md:h-5 md:w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] md:text-xs text-muted-foreground">Giá trị tồn kho</p>
                      <p className="text-sm md:text-lg font-bold text-emerald-600 dark:text-emerald-400 truncate">
                        {formatCurrency(productStats.inStockValue)}
                      </p>
                      <p className="text-[10px] md:text-xs text-muted-foreground">{productStats.inStock} SP</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-sky-500/10 to-sky-500/5 border-sky-500/20">
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="p-1.5 md:p-2 rounded-lg bg-sky-500/20">
                      <ShoppingCart className="h-4 w-4 md:h-5 md:w-5 text-sky-600 dark:text-sky-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] md:text-xs text-muted-foreground">Đã bán (giá nhập)</p>
                      <p className="text-sm md:text-lg font-bold text-sky-600 dark:text-sky-400 truncate">
                        {formatCurrency(productStats.soldValue)}
                      </p>
                      <p className="text-[10px] md:text-xs text-muted-foreground">{productStats.sold} SP</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="p-1.5 md:p-2 rounded-lg bg-amber-500/20">
                      <RotateCcw className="h-4 w-4 md:h-5 md:w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] md:text-xs text-muted-foreground">Đã trả hàng (giá nhập)</p>
                      <p className="text-sm md:text-lg font-bold text-amber-600 dark:text-amber-400 truncate">
                        {formatCurrency(productStats.returnedValue)}
                      </p>
                      <p className="text-[10px] md:text-xs text-muted-foreground">{productStats.returned} SP</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Debt Stats */}
          <div>
            <h3 className="font-semibold mb-2 md:mb-3 text-xs md:text-sm uppercase tracking-wide text-muted-foreground">
              Công nợ
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
              <Card>
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="p-1.5 md:p-2 rounded-lg bg-muted">
                      <CreditCard className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] md:text-xs text-muted-foreground">Tổng phải trả</p>
                      <p className="text-sm md:text-lg font-bold truncate">
                        {formatCurrency(debtStats.totalDebt)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="p-1.5 md:p-2 rounded-lg bg-emerald-500/20">
                      <CheckCircle className="h-4 w-4 md:h-5 md:w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] md:text-xs text-muted-foreground">Đã thanh toán</p>
                      <p className="text-sm md:text-lg font-bold text-emerald-600 dark:text-emerald-400 truncate">
                        {formatCurrency(debtStats.totalPaid)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={cn(
                debtStats.remaining > 0 
                  ? "bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20"
                  : ""
              )}>
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className={cn(
                      "p-1.5 md:p-2 rounded-lg",
                      debtStats.remaining > 0 ? "bg-destructive/20" : "bg-muted"
                    )}>
                      <AlertCircle className={cn(
                        "h-4 w-4 md:h-5 md:w-5",
                        debtStats.remaining > 0 ? "text-destructive" : "text-muted-foreground"
                      )} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] md:text-xs text-muted-foreground">Còn nợ</p>
                      <p className={cn(
                        "text-sm md:text-lg font-bold truncate",
                        debtStats.remaining > 0 ? "text-destructive" : ""
                      )}>
                        {formatCurrency(debtStats.remaining)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="flex items-center justify-center">
                <CardContent className="p-3 md:p-4 w-full">
                  <Button 
                    onClick={handleGoToDebt}
                    variant={debtStats.remaining > 0 ? "default" : "outline"}
                    className="w-full text-xs md:text-sm"
                    size="sm"
                  >
                    <ExternalLink className="h-3 w-3 md:h-4 md:w-4 mr-1.5 md:mr-2" />
                    {debtStats.remaining > 0 ? 'Thanh toán' : 'Xem nợ'}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Products List - Mobile: Card layout, Desktop: Table */}
          <div>
            <h3 className="font-semibold mb-2 md:mb-3 text-xs md:text-sm uppercase tracking-wide text-muted-foreground">
              Sản phẩm đã nhập ({products?.length || 0})
            </h3>
            
            {/* Mobile Card Layout */}
            <div className="md:hidden space-y-2">
              {products?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Chưa có sản phẩm nào từ nhà cung cấp này
                </div>
              ) : (
                products?.map((product) => (
                  <Card key={product.id} className="p-3">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate" title={product.name}>
                            {product.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            SKU: {product.sku || '-'}
                          </p>
                        </div>
                        <Badge
                          className={cn(
                            "shrink-0 text-[10px]",
                            product.status === 'in_stock'
                              ? 'status-in-stock'
                              : product.status === 'sold'
                              ? 'status-sold'
                              : product.status === 'returned'
                              ? 'status-pending'
                              : 'bg-destructive/10 text-destructive border-destructive/20'
                          )}
                        >
                          {product.status === 'in_stock' 
                            ? 'Tồn kho' 
                            : product.status === 'sold' 
                            ? 'Đã bán'
                            : product.status === 'returned'
                            ? 'Đã trả hàng'
                            : 'Đã xóa'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {product.imei ? `IMEI: ${product.imei}` : `SL: ${product.quantity || 1}`}
                        </span>
                        <span className="font-semibold text-primary">
                          {formatCurrency(Number(product.import_price))}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Nhập: {formatDate(new Date(product.import_date))}
                      </p>
                    </div>
                  </Card>
                ))
              )}
            </div>

            {/* Desktop Table Layout */}
            <div className="hidden md:block overflow-x-auto rounded-lg border bg-card">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tên sản phẩm</th>
                    <th>SKU</th>
                    <th>IMEI</th>
                    <th className="text-right">Giá nhập</th>
                    <th className="text-center">SL</th>
                    <th>Ngày nhập</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {products?.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-muted-foreground">
                        Chưa có sản phẩm nào từ nhà cung cấp này
                      </td>
                    </tr>
                  ) : (
                    products?.map((product) => (
                      <tr key={product.id}>
                        <td className="font-medium max-w-[200px] truncate" title={product.name}>
                          {product.name}
                        </td>
                        <td className="text-muted-foreground">{product.sku}</td>
                        <td className="font-mono text-sm">{product.imei || '-'}</td>
                        <td className="text-right font-medium">
                          {formatCurrency(Number(product.import_price))}
                        </td>
                        <td className="text-center">{product.quantity || 1}</td>
                        <td>{formatDate(new Date(product.import_date))}</td>
                        <td>
                          <Badge
                            className={cn(
                              product.status === 'in_stock'
                                ? 'status-in-stock'
                                : product.status === 'sold'
                                ? 'status-sold'
                                : product.status === 'returned'
                                ? 'status-pending'
                                : 'bg-destructive/10 text-destructive border-destructive/20'
                            )}
                          >
                            {product.status === 'in_stock' 
                              ? 'Tồn kho' 
                              : product.status === 'sold' 
                              ? 'Đã bán'
                              : product.status === 'returned'
                              ? 'Đã trả hàng'
                              : 'Đã xóa'}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );

  // Mobile: Use Drawer
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85vh] flex flex-col">
          <DrawerHeader className="pb-2 shrink-0">
            <DrawerTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4 text-primary" />
              {supplier.name}
            </DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            {content}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop: Use Dialog
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Chi tiết nhà cung cấp: {supplier.name}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 -mx-6 px-6">
          {content}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
