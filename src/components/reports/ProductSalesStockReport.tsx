import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Package, TrendingUp, Archive, DollarSign, Loader2, Search, Download } from 'lucide-react';
import { format, startOfMonth, subDays, startOfWeek, subMonths } from 'date-fns';
import { useProductReport } from '@/hooks/useProductReport';
import { useBranches } from '@/hooks/useBranches';
import { formatCurrency } from '@/lib/mockData';
import { exportToExcel, formatCurrencyForExcel } from '@/lib/exportExcel';
import { usePagination } from '@/hooks/usePagination';
import { TablePagination } from '@/components/ui/table-pagination';

const timePresets = [
  { label: 'Hôm nay', value: 'today' },
  { label: 'Tuần này', value: 'this_week' },
  { label: 'Tháng này', value: 'this_month' },
  { label: 'Tháng trước', value: 'last_month' },
  { label: 'Tất cả', value: 'all_time' },
];

export function ProductSalesStockReport() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(today);
  const [branchId, setBranchId] = useState('_all_');
  const [sort, setSort] = useState<'best' | 'worst' | 'stock_high' | 'stock_low' | 'profit' | 'category'>('best');
  const [search, setSearch] = useState('');

  const { data: branches } = useBranches();

  const { data, isLoading } = useProductReport({
    startDate,
    endDate,
    branchId: branchId !== '_all_' ? branchId : undefined,
    sort,
  });

  const filteredItems = (data?.items || []).filter(item =>
    !search || item.productName.toLowerCase().includes(search.toLowerCase()) || item.sku.toLowerCase().includes(search.toLowerCase())
  );

  const pagination = usePagination(filteredItems, { storageKey: 'product-report' });

  const handleTimePreset = (preset: string) => {
    const now = new Date();
    let start: Date;
    let end: Date = now;
    switch (preset) {
      case 'today': start = now; break;
      case 'this_week': start = startOfWeek(now, { weekStartsOn: 1 }); break;
      case 'this_month': start = startOfMonth(now); break;
      case 'last_month': start = startOfMonth(subMonths(now, 1)); end = subDays(startOfMonth(now), 1); break;
      case 'all_time': start = new Date('2020-01-01'); break;
      default: return;
    }
    setStartDate(format(start, 'yyyy-MM-dd'));
    setEndDate(format(end, 'yyyy-MM-dd'));
  };

  // Top 10 for chart
  const chartData = (data?.items || []).slice(0, 10).map(i => ({
    name: i.productName.length > 15 ? i.productName.slice(0, 15) + '...' : i.productName,
    sold: i.quantitySold,
    profit: i.totalProfit,
  }));

  const handleExportExcel = () => {
    if (!filteredItems.length) return;
    exportToExcel({
      filename: `BC_Hang_hoa_Ban_hang_${startDate}_${endDate}`,
      sheetName: 'Bán hàng & Tồn kho',
      columns: [
        { header: 'STT', key: 'stt', width: 6, isNumeric: true },
        { header: 'Sản phẩm', key: 'productName', width: 35 },
        { header: 'SKU', key: 'sku', width: 15 },
        { header: 'Danh mục', key: 'categoryName', width: 20 },
        { header: 'Chi nhánh', key: 'branchName', width: 18 },
        { header: 'SL bán', key: 'quantitySold', width: 10, isNumeric: true },
        { header: 'Doanh thu', key: 'totalRevenue', width: 18, isNumeric: true },
        { header: 'Lợi nhuận', key: 'totalProfit', width: 18, isNumeric: true },
        { header: 'Tồn kho', key: 'currentStock', width: 10, isNumeric: true },
      ],
      data: filteredItems.map((item, idx) => ({ ...item, stt: idx + 1 })),
    });
  };

  if (isLoading) {
    return <div className="min-h-[400px] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
           <div className="flex flex-wrap gap-4 items-end">
            <div className="flex flex-wrap gap-2">
              {timePresets.map((p) => (
                <Button key={p.value} variant="outline" size="sm" onClick={() => handleTimePreset(p.value)}>{p.label}</Button>
              ))}
            </div>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={!filteredItems.length}>
              <Download className="h-4 w-4 mr-1" />
              Xuất Excel
            </Button>
            <div className="flex gap-2 items-end">
              <div><Label>Từ ngày</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" /></div>
              <div><Label>Đến ngày</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" /></div>
            </div>
            <div>
              <Label>Chi nhánh</Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="_all_">Tất cả</SelectItem>
                  {branches?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sắp xếp</Label>
              <Select value={sort} onValueChange={(v) => setSort(v as any)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="best">Bán chạy nhất</SelectItem>
                  <SelectItem value="worst">Bán chậm nhất</SelectItem>
                  <SelectItem value="profit">Lợi nhuận cao</SelectItem>
                  <SelectItem value="stock_high">Tồn kho nhiều</SelectItem>
                  <SelectItem value="stock_low">Tồn kho ít</SelectItem>
                  <SelectItem value="category">Theo danh mục</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Package className="h-5 w-5 text-primary" /></div>
              <div><p className="text-sm text-muted-foreground">Tổng SP</p><p className="text-2xl font-bold">{data?.summary.totalProducts || 0}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center"><TrendingUp className="h-5 w-5 text-green-600" /></div>
              <div><p className="text-sm text-muted-foreground">Đã bán</p><p className="text-2xl font-bold">{data?.summary.totalSold || 0}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center"><DollarSign className="h-5 w-5 text-blue-600" /></div>
              <div><p className="text-sm text-muted-foreground">Doanh thu</p><p className="text-xl font-bold">{formatCurrency(data?.summary.totalRevenue || 0)}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center"><Archive className="h-5 w-5 text-amber-600" /></div>
              <div><p className="text-sm text-muted-foreground">Giá trị tồn</p><p className="text-xl font-bold">{formatCurrency(data?.summary.totalStockValue || 0)}</p></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Top 10 sản phẩm</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number, name: string) => [name === 'sold' ? `${value} SP` : formatCurrency(value), name === 'sold' ? 'Đã bán' : 'Lợi nhuận']} />
                <Bar dataKey="sold" name="Đã bán" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Chi tiết sản phẩm</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Tìm tên SP, SKU..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Chưa có dữ liệu</div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="font-semibold min-w-[200px]">Sản phẩm</TableHead>
                    <TableHead className="font-semibold text-center">Chi nhánh</TableHead>
                    <TableHead className="font-semibold text-center">SL bán</TableHead>
                    <TableHead className="font-semibold text-right">Doanh thu</TableHead>
                    <TableHead className="font-semibold text-right">Lợi nhuận</TableHead>
                    <TableHead className="font-semibold text-center">Tồn kho</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.paginatedData.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.productName}</p>
                          <p className="text-xs text-muted-foreground">SKU: {item.sku} · {item.categoryName}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{item.branchName}</Badge>
                      </TableCell>
                      <TableCell className="text-center font-medium">{item.quantitySold}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.totalRevenue)}</TableCell>
                      <TableCell className={`text-right font-medium ${item.totalProfit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                        {formatCurrency(item.totalProfit)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={item.currentStock === 0 ? 'destructive' : item.currentStock <= 3 ? 'secondary' : 'default'}>
                          {item.currentStock}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                pageSize={pagination.pageSize}
                totalItems={filteredItems.length}
                startIndex={pagination.startIndex}
                endIndex={pagination.endIndex}
                onPageChange={pagination.setPage}
                onPageSizeChange={pagination.setPageSize}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
