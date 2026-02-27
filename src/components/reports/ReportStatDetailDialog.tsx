import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/mockData';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useIsMobile } from '@/hooks/use-mobile';

export interface SaleDetailItem {
  date: string;
  productName: string;
  sku: string;
  salePrice: number;
  importPrice: number;
  profit: number;
  branchName: string;
  categoryName: string;
}

export interface ReturnDetailItem {
  date: string;
  salePrice: number;
  importPrice: number;
  profit: number;
  branchName: string;
}

export interface CashBookDetailItem {
  date: string;
  description: string;
  category: string;
  amount: number;
  paymentSource: string;
  branchName: string;
}

export type DetailType = 'sales' | 'returns' | 'netRevenue' | 'businessProfit' | 'expenses' | 'otherIncome' | 'netProfit';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: DetailType;
  salesDetails: SaleDetailItem[];
  returnDetails: ReturnDetailItem[];
  expenseDetails: CashBookDetailItem[];
  incomeDetails: CashBookDetailItem[];
  stats: {
    totalSalesRevenue: number;
    totalReturnRevenue: number;
    netRevenue: number;
    businessProfit: number;
    totalExpenses: number;
    otherIncome: number;
    netProfit: number;
  } | null;
}

const TITLES: Record<DetailType, string> = {
  sales: '1. Chi tiết Doanh thu bán hàng',
  returns: '2. Chi tiết Doanh thu trả hàng',
  netRevenue: '3. Chi tiết Doanh thu thuần',
  businessProfit: '3.1 Chi tiết Lợi nhuận kinh doanh',
  expenses: '4. Chi tiết Chi phí',
  otherIncome: '5. Chi tiết Thu nhập khác',
  netProfit: '6. Chi tiết Lợi nhuận thuần',
};

function formatDate(d: string) {
  try {
    return format(new Date(d), 'dd/MM/yyyy HH:mm', { locale: vi });
  } catch {
    return d;
  }
}

function SalesTable({ items }: { items: SaleDetailItem[] }) {
  const total = items.reduce((s, i) => s + i.salePrice, 0);
  return (
    <div>
      <p className="text-sm text-muted-foreground mb-2">{items.length} sản phẩm · Tổng: {formatCurrency(total)}</p>
      <div className="space-y-2 md:hidden">
        {items.map((item, idx) => (
          <div key={idx} className="border rounded-lg p-3 space-y-1">
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0 mr-2">
                <div className="font-medium text-sm truncate">{item.productName}</div>
                <div className="text-xs text-muted-foreground">{item.sku} · {item.categoryName}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-medium text-sm">{formatCurrency(item.salePrice)}</div>
                <div className={`text-xs font-medium ${item.profit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                  Lãi: {formatCurrency(item.profit)}
                </div>
              </div>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatDate(item.date)}</span>
              <span>Nhập: {formatCurrency(item.importPrice)}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ngày</TableHead>
              <TableHead>Sản phẩm</TableHead>
              <TableHead className="text-right">Giá bán</TableHead>
              <TableHead className="text-right">Giá nhập</TableHead>
              <TableHead className="text-right">Lãi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, idx) => (
              <TableRow key={idx}>
                <TableCell className="text-xs whitespace-nowrap">{formatDate(item.date)}</TableCell>
                <TableCell>
                  <div className="font-medium text-sm">{item.productName}</div>
                  <div className="text-xs text-muted-foreground">{item.sku} · {item.categoryName}</div>
                </TableCell>
                <TableCell className="text-right">{formatCurrency(item.salePrice)}</TableCell>
                <TableCell className="text-right text-muted-foreground">{formatCurrency(item.importPrice)}</TableCell>
                <TableCell className={`text-right font-medium ${item.profit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                  {formatCurrency(item.profit)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ReturnsTable({ items }: { items: ReturnDetailItem[] }) {
  const total = items.reduce((s, i) => s + i.salePrice, 0);
  return (
    <div>
      <p className="text-sm text-muted-foreground mb-2">{items.length} sản phẩm trả · Tổng: {formatCurrency(total)}</p>
      <div className="space-y-2 md:hidden">
        {items.map((item, idx) => (
          <div key={idx} className="border rounded-lg p-3 space-y-1">
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">{formatDate(item.date)}</span>
              <span className="text-sm font-medium">{formatCurrency(item.salePrice)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Nhập: {formatCurrency(item.importPrice)}</span>
              <span className="text-destructive font-medium">Lãi mất: -{formatCurrency(item.profit)}</span>
            </div>
            <div className="text-xs text-muted-foreground">{item.branchName}</div>
          </div>
        ))}
      </div>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ngày</TableHead>
              <TableHead className="text-right">Giá bán</TableHead>
              <TableHead className="text-right">Giá nhập</TableHead>
              <TableHead className="text-right">Lãi mất</TableHead>
              <TableHead>Chi nhánh</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, idx) => (
              <TableRow key={idx}>
                <TableCell className="text-xs whitespace-nowrap">{formatDate(item.date)}</TableCell>
                <TableCell className="text-right">{formatCurrency(item.salePrice)}</TableCell>
                <TableCell className="text-right text-muted-foreground">{formatCurrency(item.importPrice)}</TableCell>
                <TableCell className="text-right text-destructive font-medium">-{formatCurrency(item.profit)}</TableCell>
                <TableCell className="text-sm">{item.branchName}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function CashBookTable({ items, label }: { items: CashBookDetailItem[]; label: string }) {
  const total = items.reduce((s, i) => s + i.amount, 0);
  return (
    <div>
      <p className="text-sm text-muted-foreground mb-2">{items.length} {label} · Tổng: {formatCurrency(total)}</p>
      <div className="space-y-2 md:hidden">
        {items.map((item, idx) => (
          <div key={idx} className="border rounded-lg p-3 space-y-1">
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0 mr-2">
                <div className="text-sm font-medium">{item.description}</div>
                <Badge variant="outline" className="text-[10px] mt-0.5">{item.category}</Badge>
              </div>
              <div className="text-right shrink-0 font-medium text-sm">
                {formatCurrency(item.amount)}
              </div>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatDate(item.date)}</span>
              <span>{item.paymentSource}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ngày</TableHead>
              <TableHead>Mô tả</TableHead>
              <TableHead>Danh mục</TableHead>
              <TableHead className="text-right">Số tiền</TableHead>
              <TableHead>Nguồn tiền</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, idx) => (
              <TableRow key={idx}>
                <TableCell className="text-xs whitespace-nowrap">{formatDate(item.date)}</TableCell>
                <TableCell className="text-sm">{item.description}</TableCell>
                <TableCell><Badge variant="outline" className="text-xs">{item.category}</Badge></TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(item.amount)}</TableCell>
                <TableCell className="text-xs">{item.paymentSource}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function NetProfitSummary({ stats, salesDetails, returnDetails, expenseDetails, incomeDetails }: Omit<Props, 'open' | 'onOpenChange' | 'type'>) {
  if (!stats) return null;
  return (
    <div className="space-y-4">
      <div className="space-y-2 text-sm">
        <div className="flex justify-between py-1">
          <span>3.1 Lợi nhuận kinh doanh</span>
          <span className="font-medium">{formatCurrency(stats.businessProfit)}</span>
        </div>
        <div className="flex justify-between py-1">
          <span>+ 5. Thu nhập khác ({incomeDetails.length} khoản)</span>
          <span className="font-medium text-green-600">+{formatCurrency(stats.otherIncome)}</span>
        </div>
        <div className="flex justify-between py-1">
          <span>- 4. Chi phí ({expenseDetails.length} khoản)</span>
          <span className="font-medium text-destructive">-{formatCurrency(stats.totalExpenses)}</span>
        </div>
        <div className="border-t pt-2 flex justify-between font-bold text-base">
          <span>= 6. LỢI NHUẬN THUẦN</span>
          <span className={stats.netProfit >= 0 ? 'text-green-600' : 'text-destructive'}>
            {formatCurrency(stats.netProfit)}
          </span>
        </div>
      </div>
    </div>
  );
}

function DetailContent({ type, salesDetails, returnDetails, expenseDetails, incomeDetails, stats }: Omit<Props, 'open' | 'onOpenChange'>) {
  switch (type) {
    case 'sales':
      return <SalesTable items={salesDetails} />;
    case 'returns':
      return <ReturnsTable items={returnDetails} />;
    case 'netRevenue':
      return (
        <div className="space-y-4">
          <div className="text-sm space-y-1 border-b pb-3">
            <div className="flex justify-between"><span>Doanh thu bán hàng ({salesDetails.length} SP)</span><span className="font-medium">{formatCurrency(stats?.totalSalesRevenue || 0)}</span></div>
            <div className="flex justify-between"><span>- Doanh thu trả hàng ({returnDetails.length} SP)</span><span className="font-medium text-destructive">-{formatCurrency(stats?.totalReturnRevenue || 0)}</span></div>
            <div className="flex justify-between font-bold pt-1"><span>= Doanh thu thuần</span><span>{formatCurrency(stats?.netRevenue || 0)}</span></div>
          </div>
          <SalesTable items={salesDetails} />
        </div>
      );
    case 'businessProfit':
      return <SalesTable items={salesDetails} />;
    case 'expenses':
      return <CashBookTable items={expenseDetails} label="khoản chi" />;
    case 'otherIncome':
      return <CashBookTable items={incomeDetails} label="khoản thu" />;
    case 'netProfit':
      return <NetProfitSummary stats={stats} salesDetails={salesDetails} returnDetails={returnDetails} expenseDetails={expenseDetails} incomeDetails={incomeDetails} />;
    default:
      return null;
  }
}

export function ReportStatDetailDialog({ open, onOpenChange, type, salesDetails, returnDetails, expenseDetails, incomeDetails, stats }: Props) {
  const isMobile = useIsMobile();
  const content = <DetailContent type={type} salesDetails={salesDetails} returnDetails={returnDetails} expenseDetails={expenseDetails} incomeDetails={incomeDetails} stats={stats} />;

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle className="text-base">{TITLES[type]}</DrawerTitle>
          </DrawerHeader>
          <ScrollArea className="px-4 pb-6 max-h-[70vh]">
            {content}
          </ScrollArea>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>{TITLES[type]}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh]">
          {content}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
