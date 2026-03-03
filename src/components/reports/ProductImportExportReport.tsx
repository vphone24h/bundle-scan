import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchInput } from '@/components/ui/search-input';
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
  Legend,
} from 'recharts';
import { ArrowDownToLine, ArrowUpFromLine, RotateCcw, GitCompareArrows, Loader2, Search, Download } from 'lucide-react';
import { format, startOfMonth, subDays, startOfWeek, subMonths } from 'date-fns';
import { useProductImportExportReport } from '@/hooks/useProductImportExportReport';
import { useBranches } from '@/hooks/useBranches';
import { formatCurrency } from '@/lib/mockData';
import { exportToExcel, formatCurrencyForExcel } from '@/lib/exportExcel';
import { usePagination } from '@/hooks/usePagination';
import { TablePagination } from '@/components/ui/table-pagination';
import { usePermissions } from '@/hooks/usePermissions';

const timePresets = [
  { label: 'Hôm nay', value: 'today' },
  { label: 'Tuần này', value: 'this_week' },
  { label: 'Tháng này', value: 'this_month' },
  { label: 'Tháng trước', value: 'last_month' },
  { label: 'Tất cả', value: 'all_time' },
];

export function ProductImportExportReport() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(today);
  const [branchId, setBranchId] = useState('_all_');
  const [sort, setSort] = useState<'import_high' | 'export_high' | 'return_high' | 'net_high' | 'net_low'>('import_high');
  const [search, setSearch] = useState('');

  const { data: branches } = useBranches();
  const { data: permissions } = usePermissions();
  const isSuperAdmin = permissions?.canViewAllBranches === true;

  useEffect(() => {
    if (!isSuperAdmin && permissions?.branchId) {
      setBranchId(permissions.branchId);
    }
  }, [isSuperAdmin, permissions?.branchId]);

  const { data, isLoading } = useProductImportExportReport({
    startDate,
    endDate,
    branchId: branchId !== '_all_' ? branchId : undefined,
    sort,
  });

  const filteredItems = (data?.items || []).filter(item =>
    !search || item.productName.toLowerCase().includes(search.toLowerCase()) || item.sku.toLowerCase().includes(search.toLowerCase())
  );

  const pagination = usePagination(filteredItems, { storageKey: 'product-import-export-report' });

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
    imported: i.quantityImported,
    exported: i.quantityExported,
    returned: i.quantityReturned,
  }));

  const handleExportExcel = () => {
    if (!filteredItems.length) return;
    exportToExcel({
      filename: `BC_Nhap_Xuat_${startDate}_${endDate}`,
      sheetName: 'Nhập – Xuất',
      columns: [
        { header: 'STT', key: 'stt', width: 6, isNumeric: true },
        { header: 'Sản phẩm', key: 'productName', width: 35 },
        { header: 'SKU', key: 'sku', width: 15 },
        { header: 'Danh mục', key: 'categoryName', width: 20 },
        { header: 'Chi nhánh', key: 'branchName', width: 18 },
        { header: 'SL nhập', key: 'quantityImported', width: 10, isNumeric: true },
        { header: 'Giá trị nhập', key: 'totalImportValue', width: 18, isNumeric: true },
        { header: 'SL xuất', key: 'quantityExported', width: 10, isNumeric: true },
        { header: 'Giá trị xuất', key: 'totalExportValue', width: 18, isNumeric: true },
        { header: 'SL trả', key: 'quantityReturned', width: 10, isNumeric: true },
        { header: 'Chênh lệch', key: 'netQuantity', width: 12, isNumeric: true },
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
            {isSuperAdmin && (
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
            )}
            <div>
              <Label>Sắp xếp</Label>
              <Select value={sort} onValueChange={(v) => setSort(v as any)}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="import_high">Nhập nhiều nhất</SelectItem>
                  <SelectItem value="export_high">Xuất nhiều nhất</SelectItem>
                  <SelectItem value="return_high">Trả nhiều nhất</SelectItem>
                  <SelectItem value="net_high">Chênh lệch cao</SelectItem>
                  <SelectItem value="net_low">Chênh lệch thấp</SelectItem>
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
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center"><ArrowDownToLine className="h-5 w-5 text-blue-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Tổng nhập</p>
                <p className="text-2xl font-bold">{data?.summary.totalImported || 0}</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(data?.summary.totalImportValue || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center"><ArrowUpFromLine className="h-5 w-5 text-green-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Tổng xuất</p>
                <p className="text-2xl font-bold">{data?.summary.totalExported || 0}</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(data?.summary.totalExportValue || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center"><RotateCcw className="h-5 w-5 text-amber-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Trả hàng</p>
                <p className="text-2xl font-bold">{data?.summary.totalReturned || 0}</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(data?.summary.totalReturnValue || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center"><GitCompareArrows className="h-5 w-5 text-purple-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Chênh lệch</p>
                <p className="text-2xl font-bold">{(data?.summary.totalImported || 0) - (data?.summary.totalExported || 0)}</p>
                <p className="text-xs text-muted-foreground">Nhập - Xuất</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">So sánh Nhập – Xuất – Trả (Top 10)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="imported" name="Nhập" fill="hsl(217, 91%, 60%)" radius={[0, 4, 4, 0]} />
                <Bar dataKey="exported" name="Xuất" fill="hsl(142, 71%, 45%)" radius={[0, 4, 4, 0]} />
                <Bar dataKey="returned" name="Trả" fill="hsl(38, 92%, 50%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Chi tiết nhập – xuất theo sản phẩm</CardTitle>
            <SearchInput placeholder="Tìm tên SP, SKU..." value={search} onChange={setSearch} containerClassName="w-64" />
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
                    <TableHead className="font-semibold text-center">SL nhập</TableHead>
                    <TableHead className="font-semibold text-right">Giá trị nhập</TableHead>
                    <TableHead className="font-semibold text-center">SL xuất</TableHead>
                    <TableHead className="font-semibold text-right">Giá trị xuất</TableHead>
                    <TableHead className="font-semibold text-center">SL trả</TableHead>
                    <TableHead className="font-semibold text-center">Chênh lệch</TableHead>
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
                      <TableCell className="text-center font-medium text-blue-600">{item.quantityImported}</TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(item.totalImportValue)}</TableCell>
                      <TableCell className="text-center font-medium text-green-600">{item.quantityExported}</TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(item.totalExportValue)}</TableCell>
                      <TableCell className="text-center font-medium text-amber-600">{item.quantityReturned}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={item.netQuantity > 0 ? 'default' : item.netQuantity < 0 ? 'destructive' : 'secondary'}>
                          {item.netQuantity > 0 ? '+' : ''}{item.netQuantity}
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
