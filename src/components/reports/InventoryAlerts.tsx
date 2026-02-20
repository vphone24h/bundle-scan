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
  Download,
} from 'lucide-react';
import { formatCurrency } from '@/lib/mockData';
import { differenceInDays, format } from 'date-fns';
import { exportToExcel } from '@/lib/exportExcel';

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
  const [open, setOpen] = useState(false);

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

type AlertType = 'lowStock' | 'outOfStock' | 'slowSelling' | 'longStock' | 'dangerousStock' | 'warranty';

const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  lowStock: 'Sắp hết hàng',
  outOfStock: 'Hết hàng',
  slowSelling: 'Bán chậm',
  longStock: 'Tồn lâu',
  dangerousStock: 'Tồn nguy hiểm',
  warranty: 'Hàng lỗi',
};

export function InventoryAlerts({ products }: InventoryAlertsProps) {
  const [thresholds, setThresholds] = useState<AlertThresholds>(DEFAULT_THRESHOLDS);
  const [showSettings, setShowSettings] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [badgeAlertTypes, setBadgeAlertTypes] = useState<Set<AlertType>>(
    new Set(['lowStock', 'outOfStock', 'dangerousStock', 'warranty'])
  );

  const now = new Date();

  const alerts = useMemo(() => {
    const inStockProducts = products.filter(p => p.status === 'in_stock');
    const warrantyProducts = products.filter(p => p.status === 'warranty');
    const soldDeletedProducts = products.filter(p => p.status === 'sold' || p.status === 'deleted');

    const lowStock = inStockProducts.filter(p => p.quantity <= thresholds.lowStock && p.quantity > 0);
    
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

    const reorderCandidates = [...outOfStock, ...lowStock];
    const reorderSuggestions = reorderCandidates
      .filter(p => p.monthlySoldCount >= thresholds.minMonthlySold)
      .map(p => ({
        ...p,
        suggestedQty: Math.max(5, 10 - p.quantity),
      }));

    return { lowStock, outOfStock, slowSelling, longStock, dangerousStock, warrantyProducts, reorderSuggestions };
  }, [products, thresholds]);

  const alertCounts: Record<AlertType, number> = {
    lowStock: alerts.lowStock.length,
    outOfStock: alerts.outOfStock.length,
    slowSelling: alerts.slowSelling.length,
    longStock: alerts.longStock.length,
    dangerousStock: alerts.dangerousStock.length,
    warranty: alerts.warrantyProducts.length,
  };

  const badgeCount = Array.from(badgeAlertTypes).reduce((sum, type) => sum + alertCounts[type], 0);

  const toggleBadgeType = (type: AlertType) => {
    setBadgeAlertTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

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

  const handleExportReorder = () => {
    exportToExcel({
      filename: `De_xuat_nhap_hang_${format(new Date(), 'dd-MM-yyyy')}`,
      sheetName: 'Đề xuất nhập hàng',
      columns: [
        { header: 'Sản phẩm', key: 'name', width: 30 },
        { header: 'SKU', key: 'sku', width: 25 },
        { header: 'Danh mục', key: 'categoryName', width: 20 },
        { header: 'Chi nhánh', key: 'branchName', width: 15 },
        { header: 'Tồn hiện tại', key: 'quantity', width: 12, isNumeric: true },
        { header: 'Đã bán (tháng)', key: 'monthlySoldCount', width: 15, isNumeric: true },
        { header: 'Đề xuất nhập', key: 'suggestedQty', width: 12, isNumeric: true },
        { header: 'Giá nhập', key: 'importPrice', width: 15, isNumeric: true },
      ],
      data: alerts.reorderSuggestions,
    });
  };

  if (!expanded) {
    return (
      <div className="space-y-3">
        <Button
          variant="outline"
          className="relative w-full justify-start gap-2 h-12 text-base font-medium border-dashed"
          onClick={() => setExpanded(true)}
        >
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Cảnh báo tồn kho
          {badgeCount > 0 && (
            <Badge variant="destructive" className="ml-auto text-xs px-2 py-0.5">
              {badgeCount}
            </Badge>
          )}
          <ChevronDown className="h-4 w-4 ml-1" />
        </Button>

        {/* Reorder suggestions always visible */}
        {alerts.reorderSuggestions.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">Đề xuất nhập hàng</CardTitle>
                  <Badge variant="default">{alerts.reorderSuggestions.length}</Badge>
                </div>
                <Button variant="outline" size="sm" onClick={handleExportReorder}>
                  <Download className="h-4 w-4 mr-1" />
                  Xuất Excel
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto max-h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-xs font-semibold">Sản phẩm</TableHead>
                      <TableHead className="text-xs font-semibold">Chi nhánh</TableHead>
                      <TableHead className="text-xs font-semibold">Tồn hiện tại</TableHead>
                      <TableHead className="text-xs font-semibold">Đã bán (tháng)</TableHead>
                      <TableHead className="text-xs font-semibold">Đề xuất nhập</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alerts.reorderSuggestions.slice(0, 20).map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-sm py-2">
                          <div>
                            <p className="font-medium">{item.name}</p>
                            <p className="text-xs text-muted-foreground">SKU: {item.sku} · {item.categoryName}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm py-2"><Badge variant="secondary">{item.branchName}</Badge></TableCell>
                        <TableCell className="text-sm py-2"><Badge variant="destructive">{item.quantity}</Badge></TableCell>
                        <TableCell className="text-sm py-2"><span className="font-medium text-primary">{item.monthlySoldCount} SP</span></TableCell>
                        <TableCell className="text-sm py-2"><span className="font-medium text-primary">{item.suggestedQty} SP</span></TableCell>
                      </TableRow>
                    ))}
                    {alerts.reorderSuggestions.length > 20 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-2">
                          ... và {alerts.reorderSuggestions.length - 20} sản phẩm khác
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-base">Cảnh báo tồn kho</CardTitle>
            {badgeCount > 0 && (
              <Badge variant="destructive">{badgeCount} cảnh báo</Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant={showSettings ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings2 className="h-4 w-4 mr-1" />
              Tùy chỉnh
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(false)}
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {showSettings && (
          <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div>
                <Label className="text-xs">Sắp hết hàng (≤)</Label>
                <Input type="number" min={0} value={thresholds.lowStock}
                  onChange={(e) => setThresholds(t => ({ ...t, lowStock: parseInt(e.target.value) || 0 }))}
                  className="h-8 text-sm mt-1" />
              </div>
              <div>
                <Label className="text-xs">Bán chậm (ngày)</Label>
                <Input type="number" min={1} value={thresholds.slowSelling}
                  onChange={(e) => setThresholds(t => ({ ...t, slowSelling: parseInt(e.target.value) || 20 }))}
                  className="h-8 text-sm mt-1" />
              </div>
              <div>
                <Label className="text-xs">Tồn lâu (ngày)</Label>
                <Input type="number" min={1} value={thresholds.longStock}
                  onChange={(e) => setThresholds(t => ({ ...t, longStock: parseInt(e.target.value) || 45 }))}
                  className="h-8 text-sm mt-1" />
              </div>
              <div>
                <Label className="text-xs">Nguy hiểm (ngày)</Label>
                <Input type="number" min={1} value={thresholds.dangerousStock}
                  onChange={(e) => setThresholds(t => ({ ...t, dangerousStock: parseInt(e.target.value) || 90 }))}
                  className="h-8 text-sm mt-1" />
              </div>
              <div>
                <Label className="text-xs">Đề xuất nhập (≥ bán/tháng)</Label>
                <Input type="number" min={1} value={thresholds.minMonthlySold}
                  onChange={(e) => setThresholds(t => ({ ...t, minMonthlySold: parseInt(e.target.value) || 2 }))}
                  className="h-8 text-sm mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Loại cảnh báo hiện số đỏ:</Label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(ALERT_TYPE_LABELS) as AlertType[]).map(type => (
                  <button
                    key={type}
                    onClick={() => toggleBadgeType(type)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      badgeAlertTypes.has(type)
                        ? 'bg-destructive/10 border-destructive/30 text-destructive font-medium'
                        : 'bg-muted border-border text-muted-foreground'
                    }`}
                  >
                    {ALERT_TYPE_LABELS[type]} ({alertCounts[type]})
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <AlertSection title={`Sắp hết hàng (≤${thresholds.lowStock})`} icon={PackageMinus}
            iconColor="text-amber-600" bgColor="bg-amber-50 dark:bg-amber-950/30" badgeVariant="secondary"
            items={alerts.lowStock} columns={productColumns} emptyText="Không có sản phẩm sắp hết hàng" />

          <AlertSection title="Hết hàng (0)" icon={PackageMinus}
            iconColor="text-destructive" bgColor="bg-destructive/5" badgeVariant="destructive"
            items={alerts.outOfStock} columns={productColumns} emptyText="Không có sản phẩm hết hàng" />

          <AlertSection title={`Bán chậm (${thresholds.slowSelling}-${thresholds.longStock - 1} ngày)`} icon={Clock}
            iconColor="text-yellow-600" bgColor="bg-yellow-50 dark:bg-yellow-950/30" badgeVariant="outline"
            items={alerts.slowSelling} columns={ageColumns} emptyText="Không có hàng bán chậm" />

          <AlertSection title={`Tồn kho lâu (${thresholds.longStock}-${thresholds.dangerousStock - 1} ngày)`} icon={Clock}
            iconColor="text-orange-600" bgColor="bg-orange-50 dark:bg-orange-950/30" badgeVariant="secondary"
            items={alerts.longStock} columns={ageColumns} emptyText="Không có hàng tồn lâu" />

          <AlertSection title={`Tồn kho nguy hiểm (≥${thresholds.dangerousStock} ngày)`} icon={ShieldAlert}
            iconColor="text-destructive" bgColor="bg-destructive/10" badgeVariant="destructive"
            items={alerts.dangerousStock} columns={ageColumns} emptyText="Không có hàng tồn nguy hiểm" />

          <AlertSection title="Hàng lỗi / Bảo hành" icon={Wrench}
            iconColor="text-red-600" bgColor="bg-red-50 dark:bg-red-950/30" badgeVariant="destructive"
            items={alerts.warrantyProducts} columns={warrantyColumns} emptyText="Không có hàng lỗi" />

          {alerts.reorderSuggestions.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-end">
                <Button variant="outline" size="sm" onClick={handleExportReorder}>
                  <Download className="h-4 w-4 mr-1" />
                  Xuất Excel
                </Button>
              </div>
              <AlertSection title="Đề xuất nhập hàng" icon={ShoppingCart}
                iconColor="text-primary" bgColor="bg-primary/5" badgeVariant="default"
                items={alerts.reorderSuggestions} columns={reorderColumns} emptyText="" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
