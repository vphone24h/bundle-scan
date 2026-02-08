import { useState, useEffect } from 'react';
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
import { RotateCcw, Package, DollarSign, TrendingDown, Loader2, Search, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { format, startOfMonth, subDays, startOfWeek, subMonths } from 'date-fns';
import { useSupplierReturnReport } from '@/hooks/useSupplierReturnReport';
import { useBranches } from '@/hooks/useBranches';
import { formatCurrency } from '@/lib/mockData';
import { exportToExcel, formatDateForExcel } from '@/lib/exportExcel';
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

export function SupplierReturnReport() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(today);
  const [branchId, setBranchId] = useState('_all_');
  const [sort, setSort] = useState<'top_count' | 'top_value' | 'recent'>('top_count');
  const [search, setSearch] = useState('');
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);

  const { data: branches } = useBranches();
  const { data: permissions } = usePermissions();
  const isSuperAdmin = permissions?.canViewAllBranches === true;

  useEffect(() => {
    if (!isSuperAdmin && permissions?.branchId) {
      setBranchId(permissions.branchId);
    }
  }, [isSuperAdmin, permissions?.branchId]);

  const { data, isLoading } = useSupplierReturnReport({
    startDate,
    endDate,
    branchId: branchId !== '_all_' ? branchId : undefined,
    sort,
  });

  const filteredItems = (data?.items || []).filter(item =>
    !search || item.supplierName.toLowerCase().includes(search.toLowerCase()) || (item.phone || '').includes(search)
  );

  const pagination = usePagination(filteredItems, { storageKey: 'supplier-return-report' });

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

  // Chart data - top 10 suppliers by return count
  const chartData = (data?.items || []).slice(0, 10).map(i => ({
    name: i.supplierName.length > 15 ? i.supplierName.slice(0, 15) + '...' : i.supplierName,
    count: i.returnCount,
    value: i.totalReturnValue,
  }));

  const handleExportExcel = () => {
    if (!filteredItems.length) return;

    // Flatten products for export
    const flatData: any[] = [];
    filteredItems.forEach((item, idx) => {
      if (item.products.length === 0) {
        flatData.push({
          stt: idx + 1,
          supplierName: item.supplierName,
          phone: item.phone || '',
          returnCount: item.returnCount,
          totalReturnValue: item.totalReturnValue,
          productName: '',
          sku: '',
          imei: '',
          importPrice: '',
          refundAmount: '',
          returnDate: '',
          note: '',
        });
      } else {
        item.products.forEach((p, pIdx) => {
          flatData.push({
            stt: pIdx === 0 ? idx + 1 : '',
            supplierName: pIdx === 0 ? item.supplierName : '',
            phone: pIdx === 0 ? (item.phone || '') : '',
            returnCount: pIdx === 0 ? item.returnCount : '',
            totalReturnValue: pIdx === 0 ? item.totalReturnValue : '',
            productName: p.productName,
            sku: p.sku,
            imei: p.imei || '',
            importPrice: p.importPrice,
            refundAmount: p.refundAmount,
            returnDate: p.returnDate ? formatDateForExcel(p.returnDate) : '',
            note: p.note || '',
          });
        });
      }
    });

    exportToExcel({
      filename: `BC_Tra_hang_NCC_${startDate}_${endDate}`,
      sheetName: 'Trả hàng NCC',
      columns: [
        { header: 'STT', key: 'stt', width: 6 },
        { header: 'Nhà cung cấp', key: 'supplierName', width: 25 },
        { header: 'SĐT', key: 'phone', width: 15 },
        { header: 'SL trả', key: 'returnCount', width: 10, isNumeric: true },
        { header: 'Tổng giá trị trả', key: 'totalReturnValue', width: 18, isNumeric: true },
        { header: 'Sản phẩm', key: 'productName', width: 30 },
        { header: 'SKU', key: 'sku', width: 15 },
        { header: 'IMEI', key: 'imei', width: 20 },
        { header: 'Giá nhập', key: 'importPrice', width: 15, isNumeric: true },
        { header: 'Hoàn tiền', key: 'refundAmount', width: 15, isNumeric: true },
        { header: 'Ngày trả', key: 'returnDate', width: 14 },
        { header: 'Lý do', key: 'note', width: 30 },
      ],
      data: flatData,
    });
  };

  // Get top reasons across all suppliers
  const allReasons: Record<string, number> = {};
  (data?.items || []).forEach(item => {
    Object.entries(item.returnReasons).forEach(([reason, count]) => {
      allReasons[reason] = (allReasons[reason] || 0) + count;
    });
  });
  const topReasons = Object.entries(allReasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

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
                  <SelectItem value="top_count">Trả nhiều nhất</SelectItem>
                  <SelectItem value="top_value">Giá trị cao nhất</SelectItem>
                  <SelectItem value="recent">Gần đây nhất</SelectItem>
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
              <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <RotateCcw className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">NCC có trả hàng</p>
                <p className="text-2xl font-bold">{data?.summary.totalSuppliers || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <Package className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tổng SP trả</p>
                <p className="text-2xl font-bold">{data?.summary.totalReturns || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tổng giá trị trả</p>
                <p className="text-xl font-bold">{formatCurrency(data?.summary.totalReturnValue || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">TB/lần trả</p>
                <p className="text-xl font-bold">{formatCurrency(data?.summary.avgReturnValue || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart + Reasons */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {chartData.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-lg">So sánh trả hàng theo NCC</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: number, name: string) =>
                      name === 'count' ? [`${value} SP`, 'Số lượng'] : [formatCurrency(value), 'Giá trị']
                    }
                  />
                  <Bar dataKey="count" name="count" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {topReasons.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-lg">Lý do trả hàng phổ biến</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topReasons.map(([reason, count], idx) => {
                  const maxCount = topReasons[0][1];
                  const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate flex-1 mr-2">{reason}</span>
                        <Badge variant="secondary" className="shrink-0">{count}</Badge>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-destructive/70 h-2 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {chartData.length === 0 && topReasons.length === 0 && (
          <Card className="lg:col-span-3">
            <CardContent className="pt-6">
              <div className="text-center py-8 text-muted-foreground">Chưa có dữ liệu trả hàng trong kỳ</div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Chi tiết trả hàng theo NCC</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Tìm tên NCC, SĐT..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Chưa có dữ liệu trả hàng</div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-8"></TableHead>
                    <TableHead className="font-semibold min-w-[180px]">Nhà cung cấp</TableHead>
                    <TableHead className="font-semibold text-center">SL trả</TableHead>
                    <TableHead className="font-semibold text-right">Giá trị trả</TableHead>
                    <TableHead className="font-semibold text-right">TB/lần</TableHead>
                    <TableHead className="font-semibold">Lý do chính</TableHead>
                    <TableHead className="font-semibold text-right">Trả gần nhất</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.paginatedData.map((item) => {
                    const isExpanded = expandedSupplier === item.supplierId;
                    const topReason = Object.entries(item.returnReasons).sort((a, b) => b[1] - a[1])[0];
                    return (
                      <>
                        <TableRow
                          key={item.supplierId}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setExpandedSupplier(isExpanded ? null : item.supplierId)}
                        >
                          <TableCell className="w-8">
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{item.supplierName}</p>
                              {item.phone && <p className="text-xs text-muted-foreground">{item.phone}</p>}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="destructive">{item.returnCount}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium text-destructive">
                            {formatCurrency(item.totalReturnValue)}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {formatCurrency(item.avgReturnValue)}
                          </TableCell>
                          <TableCell>
                            {topReason && (
                              <span className="text-sm truncate block max-w-[200px]">{topReason[0]}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {item.lastReturnDate ? format(new Date(item.lastReturnDate), 'dd/MM/yyyy') : '-'}
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow key={`${item.supplierId}-detail`}>
                            <TableCell colSpan={7} className="p-0">
                              <div className="bg-muted/20 p-4">
                                <p className="text-sm font-medium mb-2">Chi tiết sản phẩm đã trả ({item.products.length})</p>
                                <div className="overflow-auto">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="text-xs">Sản phẩm</TableHead>
                                        <TableHead className="text-xs">SKU</TableHead>
                                        <TableHead className="text-xs">IMEI</TableHead>
                                        <TableHead className="text-xs text-right">Giá nhập</TableHead>
                                        <TableHead className="text-xs text-right">Hoàn tiền</TableHead>
                                        <TableHead className="text-xs text-right">Ngày trả</TableHead>
                                        <TableHead className="text-xs">Lý do</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {item.products.map((p, idx) => (
                                        <TableRow key={idx}>
                                          <TableCell className="text-sm">{p.productName}</TableCell>
                                          <TableCell className="text-sm text-muted-foreground">{p.sku}</TableCell>
                                          <TableCell className="text-sm text-muted-foreground">{p.imei || '-'}</TableCell>
                                          <TableCell className="text-sm text-right">{formatCurrency(p.importPrice)}</TableCell>
                                          <TableCell className="text-sm text-right text-destructive">{formatCurrency(p.refundAmount)}</TableCell>
                                          <TableCell className="text-sm text-right">{format(new Date(p.returnDate), 'dd/MM/yyyy')}</TableCell>
                                          <TableCell className="text-sm max-w-[200px] truncate">{p.note || '-'}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
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
