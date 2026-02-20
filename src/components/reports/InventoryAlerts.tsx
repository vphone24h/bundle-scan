import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertTriangle,
  PackageMinus,
  Clock,
  ShieldAlert,
  Wrench,
  ChevronDown,
  ChevronUp,
  ShoppingCart,
  Settings2,
} from 'lucide-react';
import { formatCurrency } from '@/lib/mockData';
import { differenceInDays } from 'date-fns';

interface StockProduct {
  name: string;
  sku: string;
  quantity: number;
  importDate: string | null;
  branchName: string;
  categoryName: string;
  importPrice: number;
  status: string;
  monthlySoldCount: number;
}

interface InventoryAlertsProps {
  products: StockProduct[];
}

interface AlertThresholds {
  lowStock: number;
  slowSelling: number;
  longStock: number;
  dangerousStock: number;
  minMonthlySold: number;
}

const DEFAULT_THRESHOLDS: AlertThresholds = {
  lowStock: 1,
  slowSelling: 20,
  longStock: 45,
  dangerousStock: 90,
  minMonthlySold: 2,
};

function AlertSection({
  title,
  icon: Icon,
  iconColor,
  bgColor,
  badgeVariant,
  items,
  columns,
  emptyText,
}: {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  bgColor: string;
  badgeVariant: 'destructive' | 'secondary' | 'default' | 'outline';
  items: any[];
  columns: { header: string; render: (item: any) => React.ReactNode }[];
  emptyText: string;
}) {
  const [open, setOpen] = useState(items.length > 0);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className={`w-full flex items-center justify-between p-3 rounded-lg ${bgColor} hover:opacity-90 transition-opacity`}>
          <div className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${iconColor}`} />
            <span className="font-medium text-sm">{title}</span>
            <Badge variant={badgeVariant} className="ml-1">
              {items.length}
            </Badge>
          </div>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3 px-2">{emptyText}</p>
        ) : (
          <div className="overflow-auto max-h-[300px] mt-2">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  {columns.map((col, i) => (
                    <TableHead key={i} className="text-xs font-semibold">{col.header}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.slice(0, 20).map((item, idx) => (
                  <TableRow key={idx}>
                    {columns.map((col, ci) => (
                      <TableCell key={ci} className="text-sm py-2">{col.render(item)}</TableCell>
                    ))}
                  </TableRow>
                ))}
                {items.length > 20 && (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="text-center text-xs text-muted-foreground py-2">
                      ... và {items.length - 20} sản phẩm khác
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function InventoryAlerts({ products }: InventoryAlertsProps) {
  const [thresholds, setThresholds] = useState<AlertThresholds>(DEFAULT_THRESHOLDS);
  const [showSettings, setShowSettings] = useState(false);

  const now = new Date();

  const alerts = useMemo(() => {
    const inStockProducts = products.filter(p => p.status === 'in_stock');
    const warrantyProducts = products.filter(p => p.status === 'warranty');
    const soldDeletedProducts = products.filter(p => p.status === 'sold' || p.status === 'deleted');

    const lowStock = inStockProducts.filter(p => p.quantity <= thresholds.lowStock && p.quantity > 0);
    
    // Out of stock: find product names that exist (sold/deleted) but have NO in_stock items
    const inStockKeys = new Set(
      inStockProducts.filter(p => p.quantity > 0).map(p => `${p.name}||${p.sku}||${p.branchName}`)
    );
    const outOfStockMap = new Map<string, StockProduct>();
    soldDeletedProducts.forEach(p => {
      const key = `${p.name}||${p.sku}||${p.branchName}`;
      if (!inStockKeys.has(key) && !outOfStockMap.has(key)) {
        outOfStockMap.set(key, { ...p, quantity: 0 });
      }
    });
    // Also include in_stock items with quantity 0
    inStockProducts.filter(p => p.quantity === 0).forEach(p => {
      const key = `${p.name}||${p.sku}||${p.branchName}`;
      if (!outOfStockMap.has(key)) {
        outOfStockMap.set(key, p);
      }
    });
    const outOfStock = Array.from(outOfStockMap.values());

    const withAge = inStockProducts
      .filter(p => p.importDate && p.quantity > 0)
      .map(p => ({
        ...p,
        daysInStock: differenceInDays(now, new Date(p.importDate!)),
      }));

    const slowSelling = withAge.filter(p => p.daysInStock >= thresholds.slowSelling && p.daysInStock < thresholds.longStock);
    const longStock = withAge.filter(p => p.daysInStock >= thresholds.longStock && p.daysInStock < thresholds.dangerousStock);
    const dangerousStock = withAge.filter(p => p.daysInStock >= thresholds.dangerousStock);

    // Suggest reorder: products that are low stock or out of stock AND sold >= minMonthlySold this month
    const reorderCandidates = [...outOfStock, ...lowStock];
    const reorderSuggestions = reorderCandidates
      .filter(p => p.monthlySoldCount >= thresholds.minMonthlySold)
      .map(p => ({
        ...p,
        suggestedQty: Math.max(5, 10 - p.quantity),
      }));

    return { lowStock, outOfStock, slowSelling, longStock, dangerousStock, warrantyProducts, reorderSuggestions };
  }, [products, thresholds]);

  const totalAlerts = alerts.lowStock.length + alerts.outOfStock.length +
    alerts.slowSelling.length + alerts.longStock.length +
    alerts.dangerousStock.length + alerts.warrantyProducts.length;

  const productColumns = [
    { header: 'Sản phẩm', render: (item: any) => (
      <div>
        <p className="font-medium">{item.name}</p>
        <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
      </div>
    )},
    { header: 'Chi nhánh', render: (item: any) => <Badge variant="secondary">{item.branchName}</Badge> },
    { header: 'Tồn kho', render: (item: any) => (
      <Badge variant={item.quantity === 0 ? 'destructive' : 'secondary'}>{item.quantity}</Badge>
    )},
    { header: 'Giá nhập', render: (item: any) => formatCurrency(item.importPrice) },
  ];

  const ageColumns = [
    { header: 'Sản phẩm', render: (item: any) => (
      <div>
        <p className="font-medium">{item.name}</p>
        <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
      </div>
    )},
    { header: 'Chi nhánh', render: (item: any) => <Badge variant="secondary">{item.branchName}</Badge> },
    { header: 'Số ngày tồn', render: (item: any) => (
      <Badge variant={item.daysInStock >= thresholds.dangerousStock ? 'destructive' : item.daysInStock >= thresholds.longStock ? 'secondary' : 'outline'}>
        {item.daysInStock} ngày
      </Badge>
    )},
    { header: 'Tồn kho', render: (item: any) => item.quantity },
    { header: 'Giá trị', render: (item: any) => formatCurrency(item.importPrice * item.quantity) },
  ];

  const warrantyColumns = [
    { header: 'Sản phẩm', render: (item: any) => (
      <div>
        <p className="font-medium">{item.name}</p>
        <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
      </div>
    )},
    { header: 'Chi nhánh', render: (item: any) => <Badge variant="secondary">{item.branchName}</Badge> },
    { header: 'Giá nhập', render: (item: any) => formatCurrency(item.importPrice) },
  ];

  const reorderColumns = [
    { header: 'Sản phẩm', render: (item: any) => (
      <div>
        <p className="font-medium">{item.name}</p>
        <p className="text-xs text-muted-foreground">SKU: {item.sku} · {item.categoryName}</p>
      </div>
    )},
    { header: 'Chi nhánh', render: (item: any) => <Badge variant="secondary">{item.branchName}</Badge> },
    { header: 'Tồn hiện tại', render: (item: any) => (
      <Badge variant="destructive">{item.quantity}</Badge>
    )},
    { header: 'Đã bán (tháng)', render: (item: any) => (
      <span className="font-medium text-primary">{item.monthlySoldCount} SP</span>
    )},
    { header: 'Đề xuất nhập', render: (item: any) => (
      <span className="font-medium text-primary">{item.suggestedQty} SP</span>
    )},
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-base">Cảnh báo tồn kho</CardTitle>
            {totalAlerts > 0 && (
              <Badge variant="destructive">{totalAlerts} cảnh báo</Badge>
            )}
          </div>
          <Button
            variant={showSettings ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings2 className="h-4 w-4 mr-1" />
            Tùy chỉnh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Settings Panel */}
        {showSettings && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3 rounded-lg border bg-muted/30">
            <div>
              <Label className="text-xs">Sắp hết hàng (≤)</Label>
              <Input
                type="number"
                min={0}
                value={thresholds.lowStock}
                onChange={(e) => setThresholds(t => ({ ...t, lowStock: parseInt(e.target.value) || 0 }))}
                className="h-8 text-sm mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Bán chậm (ngày)</Label>
              <Input
                type="number"
                min={1}
                value={thresholds.slowSelling}
                onChange={(e) => setThresholds(t => ({ ...t, slowSelling: parseInt(e.target.value) || 20 }))}
                className="h-8 text-sm mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Tồn lâu (ngày)</Label>
              <Input
                type="number"
                min={1}
                value={thresholds.longStock}
                onChange={(e) => setThresholds(t => ({ ...t, longStock: parseInt(e.target.value) || 45 }))}
                className="h-8 text-sm mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Nguy hiểm (ngày)</Label>
              <Input
                type="number"
                min={1}
                value={thresholds.dangerousStock}
                onChange={(e) => setThresholds(t => ({ ...t, dangerousStock: parseInt(e.target.value) || 90 }))}
                className="h-8 text-sm mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Đề xuất nhập (≥ bán/tháng)</Label>
              <Input
                type="number"
                min={1}
                value={thresholds.minMonthlySold}
                onChange={(e) => setThresholds(t => ({ ...t, minMonthlySold: parseInt(e.target.value) || 2 }))}
                className="h-8 text-sm mt-1"
              />
            </div>
          </div>
        )}

        {totalAlerts === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Không có cảnh báo nào. Tồn kho đang ổn!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Low Stock */}
            <AlertSection
              title={`Sắp hết hàng (≤${thresholds.lowStock})`}
              icon={PackageMinus}
              iconColor="text-amber-600"
              bgColor="bg-amber-50 dark:bg-amber-950/30"
              badgeVariant="secondary"
              items={alerts.lowStock}
              columns={productColumns}
              emptyText="Không có sản phẩm sắp hết hàng"
            />

            {/* Out of Stock */}
            <AlertSection
              title="Hết hàng (0)"
              icon={PackageMinus}
              iconColor="text-destructive"
              bgColor="bg-destructive/5"
              badgeVariant="destructive"
              items={alerts.outOfStock}
              columns={productColumns}
              emptyText="Không có sản phẩm hết hàng"
            />

            {/* Slow Selling */}
            <AlertSection
              title={`Bán chậm (${thresholds.slowSelling}-${thresholds.longStock - 1} ngày)`}
              icon={Clock}
              iconColor="text-yellow-600"
              bgColor="bg-yellow-50 dark:bg-yellow-950/30"
              badgeVariant="outline"
              items={alerts.slowSelling}
              columns={ageColumns}
              emptyText="Không có hàng bán chậm"
            />

            {/* Long Stock */}
            <AlertSection
              title={`Tồn kho lâu (${thresholds.longStock}-${thresholds.dangerousStock - 1} ngày)`}
              icon={Clock}
              iconColor="text-orange-600"
              bgColor="bg-orange-50 dark:bg-orange-950/30"
              badgeVariant="secondary"
              items={alerts.longStock}
              columns={ageColumns}
              emptyText="Không có hàng tồn lâu"
            />

            {/* Dangerous Stock */}
            <AlertSection
              title={`Tồn kho nguy hiểm (≥${thresholds.dangerousStock} ngày)`}
              icon={ShieldAlert}
              iconColor="text-destructive"
              bgColor="bg-destructive/10"
              badgeVariant="destructive"
              items={alerts.dangerousStock}
              columns={ageColumns}
              emptyText="Không có hàng tồn nguy hiểm"
            />

            {/* Warranty / Defective */}
            <AlertSection
              title="Hàng lỗi / Bảo hành"
              icon={Wrench}
              iconColor="text-red-600"
              bgColor="bg-red-50 dark:bg-red-950/30"
              badgeVariant="destructive"
              items={alerts.warrantyProducts}
              columns={warrantyColumns}
              emptyText="Không có hàng lỗi"
            />

            {/* Reorder Suggestions */}
            {alerts.reorderSuggestions.length > 0 && (
              <AlertSection
                title="Đề xuất nhập hàng"
                icon={ShoppingCart}
                iconColor="text-primary"
                bgColor="bg-primary/5"
                badgeVariant="default"
                items={alerts.reorderSuggestions}
                columns={reorderColumns}
                emptyText=""
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
