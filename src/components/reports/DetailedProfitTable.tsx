import { useState } from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Download, Search, Loader2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDetailedProfitReport } from '@/hooks/useDetailedProfitReport';
import { useBranches } from '@/hooks/useBranches';
import { useCategories } from '@/hooks/useCategories';
import { formatCurrency } from '@/lib/mockData';
import { startOfMonth, subDays, startOfWeek, subWeeks, subMonths } from 'date-fns';

const timePresets = [
  { label: 'Hôm nay', value: 'today' },
  { label: 'Hôm qua', value: 'yesterday' },
  { label: 'Tuần này', value: 'this_week' },
  { label: 'Tuần trước', value: 'last_week' },
  { label: 'Tháng này', value: 'this_month' },
  { label: 'Tháng trước', value: 'last_month' },
];

export function DetailedProfitTable() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const firstDayOfMonth = format(startOfMonth(new Date()), 'yyyy-MM-dd');

  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(today);
  const [branchId, setBranchId] = useState('_all_');
  const [categoryId, setCategoryId] = useState('_all_');
  const [search, setSearch] = useState('');

  const { data: branches } = useBranches();
  const { data: categories } = useCategories();

  const filters = {
    startDate,
    endDate,
    branchId: branchId !== '_all_' ? branchId : undefined,
    categoryId: categoryId !== '_all_' ? categoryId : undefined,
    search: search || undefined,
  };

  const { data, isLoading } = useDetailedProfitReport(filters);

  // Handle time preset
  const handleTimePreset = (preset: string) => {
    const now = new Date();
    let start: Date;
    let end: Date = now;

    switch (preset) {
      case 'today':
        start = now;
        break;
      case 'yesterday':
        start = subDays(now, 1);
        end = subDays(now, 1);
        break;
      case 'this_week':
        start = startOfWeek(now, { weekStartsOn: 1 });
        break;
      case 'last_week':
        start = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
        end = subDays(startOfWeek(now, { weekStartsOn: 1 }), 1);
        break;
      case 'this_month':
        start = startOfMonth(now);
        break;
      case 'last_month':
        start = startOfMonth(subMonths(now, 1));
        end = subDays(startOfMonth(now), 1);
        break;
      default:
        return;
    }

    setStartDate(format(start, 'yyyy-MM-dd'));
    setEndDate(format(end, 'yyyy-MM-dd'));
  };

  // Export to CSV
  const handleExport = () => {
    if (!data?.items.length) return;

    const headers = [
      'Sản phẩm',
      'SKU',
      'IMEI',
      'Chi nhánh',
      'Giá nhập',
      'Giá bán',
      'Số lượng',
      'Lợi nhuận',
      'Ngày bán',
      'Trạng thái',
      'Khách hàng',
      'Mã phiếu',
    ];

    const rows = data.items.map(item => [
      item.productName,
      item.sku,
      item.imei || '—',
      item.branchName,
      item.importPrice,
      item.salePrice,
      item.quantity,
      item.profit,
      format(new Date(item.saleDate), 'dd/MM/yyyy HH:mm'),
      item.status === 'sold' ? 'Đã bán' : 'Trả hàng',
      item.customerName || '—',
      item.receiptCode,
    ]);

    // Add totals row
    rows.push([
      'TỔNG CỘNG',
      '',
      '',
      '',
      '',
      data.totals.totalRevenue,
      data.totals.totalQuantity,
      data.totals.totalProfit,
      '',
      '',
      '',
      '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `bao-cao-loi-nhuan-chi-tiet_${startDate}_${endDate}.csv`;
    link.click();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="text-lg">Báo cáo lợi nhuận chi tiết</CardTitle>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!data?.items.length}>
            <Download className="h-4 w-4 mr-2" />
            Xuất Excel
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-end">
          {/* Time presets */}
          <div className="flex flex-wrap gap-2">
            {timePresets.map((preset) => (
              <Button
                key={preset.value}
                variant="outline"
                size="sm"
                onClick={() => handleTimePreset(preset.value)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          {/* Date range */}
          <div>
            <Label>Từ ngày</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-36"
            />
          </div>
          <div>
            <Label>Đến ngày</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-36"
            />
          </div>

          {/* Branch filter */}
          <div>
            <Label>Chi nhánh</Label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Tất cả" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="_all_">Tất cả</SelectItem>
                {branches?.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category filter */}
          <div>
            <Label>Danh mục</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Tất cả" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="_all_">Tất cả</SelectItem>
                {categories?.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <Label>Tìm kiếm</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tên SP, SKU, IMEI..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </div>

        {/* Summary */}
        {data && (
          <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Tổng SL</p>
              <p className="text-xl font-bold">{data.totals.totalQuantity}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Tổng doanh thu</p>
              <p className="text-xl font-bold">{formatCurrency(data.totals.totalRevenue)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Tổng lợi nhuận</p>
              <p className={`text-xl font-bold ${data.totals.totalProfit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                {formatCurrency(data.totals.totalProfit)}
              </p>
            </div>
          </div>
        )}

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : !data?.items.length ? (
          <div className="text-center py-12 text-muted-foreground">
            Không có dữ liệu trong khoảng thời gian này
          </div>
        ) : (
          <div className="border rounded-lg overflow-auto max-h-[500px]">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="min-w-[180px]">Sản phẩm</TableHead>
                  <TableHead className="min-w-[120px]">IMEI</TableHead>
                  <TableHead className="hidden md:table-cell">Chi nhánh</TableHead>
                  <TableHead className="text-right hidden lg:table-cell">Giá nhập</TableHead>
                  <TableHead className="text-right">Giá bán</TableHead>
                  <TableHead className="text-center">SL</TableHead>
                  <TableHead className="text-right">Lợi nhuận</TableHead>
                  <TableHead className="hidden sm:table-cell">Ngày bán</TableHead>
                  <TableHead className="hidden md:table-cell">Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((item) => (
                  <TableRow 
                    key={item.id}
                    className={item.status === 'returned' ? 'bg-red-50 dark:bg-red-950/20' : ''}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium line-clamp-1">{item.productName}</p>
                        <p className="text-xs text-muted-foreground">{item.sku}</p>
                        {item.customerName && (
                          <p className="text-xs text-muted-foreground">KH: {item.customerName}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">
                        {item.imei || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {item.branchName}
                    </TableCell>
                    <TableCell className="text-right hidden lg:table-cell">
                      {formatCurrency(item.importPrice)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.salePrice)}
                    </TableCell>
                    <TableCell className="text-center">
                      {item.quantity}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${item.profit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                      {item.profit >= 0 ? '+' : ''}{formatCurrency(item.profit)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {format(new Date(item.saleDate), 'dd/MM/yyyy', { locale: vi })}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {item.status === 'sold' ? (
                        <Badge variant="default">Đã bán</Badge>
                      ) : (
                        <Badge variant="destructive">Trả hàng</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
