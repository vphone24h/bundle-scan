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
import { Factory, Package, CreditCard, DollarSign, Loader2, Search, Download } from 'lucide-react';
import { format, startOfMonth, subDays, startOfWeek, subMonths } from 'date-fns';
import { useSupplierReport } from '@/hooks/useSupplierReport';
import { useBranches } from '@/hooks/useBranches';
import { formatCurrency } from '@/lib/mockData';
import { exportToExcel, formatDateForExcel } from '@/lib/exportExcel';
import { usePagination } from '@/hooks/usePagination';
import { TablePagination } from '@/components/ui/table-pagination';

const timePresets = [
  { label: 'Hôm nay', value: 'today' },
  { label: 'Tuần này', value: 'this_week' },
  { label: 'Tháng này', value: 'this_month' },
  { label: 'Tháng trước', value: 'last_month' },
  { label: 'Tất cả', value: 'all_time' },
];

export function SupplierImportReport() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(today);
  const [branchId, setBranchId] = useState('_all_');
  const [sort, setSort] = useState<'top_import' | 'top_debt' | 'top_count' | 'avg_price'>('top_import');
  const [search, setSearch] = useState('');

  const { data: branches } = useBranches();

  const { data, isLoading } = useSupplierReport({
    startDate,
    endDate,
    branchId: branchId !== '_all_' ? branchId : undefined,
    sort,
  });

  const filteredItems = (data?.items || []).filter(item =>
    !search || item.supplierName.toLowerCase().includes(search.toLowerCase()) || (item.phone || '').includes(search)
  );

  const pagination = usePagination(filteredItems, { storageKey: 'supplier-report' });

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

  // Chart data
  const chartData = (data?.items || []).slice(0, 10).map(i => ({
    name: i.supplierName.length > 15 ? i.supplierName.slice(0, 15) + '...' : i.supplierName,
    amount: i.totalImportAmount,
    debt: i.debtAmount,
  }));

  const handleExportExcel = () => {
    if (!filteredItems.length) return;
    exportToExcel({
      filename: `BC_Nha_cung_cap_${startDate}_${endDate}`,
      sheetName: 'Nhà cung cấp',
      columns: [
        { header: 'STT', key: 'stt', width: 6, isNumeric: true },
        { header: 'Nhà cung cấp', key: 'supplierName', width: 25 },
        { header: 'SĐT', key: 'phone', width: 15 },
        { header: 'Phiếu nhập', key: 'importCount', width: 12, isNumeric: true },
        { header: 'Tổng nhập', key: 'totalImportAmount', width: 18, isNumeric: true },
        { header: 'Đã trả', key: 'paidAmount', width: 18, isNumeric: true },
        { header: 'Công nợ', key: 'debtAmount', width: 18, isNumeric: true },
        { header: 'SP trong kho', key: 'productCount', width: 12, isNumeric: true },
        { header: 'Nhập gần nhất', key: 'lastImportDate', width: 14, format: (v) => v ? formatDateForExcel(v) : '' },
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
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="top_import">Nhập nhiều nhất</SelectItem>
                  <SelectItem value="top_debt">Công nợ cao</SelectItem>
                  <SelectItem value="top_count">Phiếu nhập nhiều</SelectItem>
                  <SelectItem value="avg_price">TB phiếu nhập lớn</SelectItem>
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
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Factory className="h-5 w-5 text-primary" /></div>
              <div><p className="text-sm text-muted-foreground">Nhà cung cấp</p><p className="text-2xl font-bold">{data?.summary.totalSuppliers || 0}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center"><Package className="h-5 w-5 text-blue-600" /></div>
              <div><p className="text-sm text-muted-foreground">Tổng nhập</p><p className="text-xl font-bold">{formatCurrency(data?.summary.totalImportAmount || 0)}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center"><DollarSign className="h-5 w-5 text-green-600" /></div>
              <div><p className="text-sm text-muted-foreground">Đã trả</p><p className="text-xl font-bold">{formatCurrency(data?.summary.totalPaid || 0)}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center"><CreditCard className="h-5 w-5 text-red-600" /></div>
              <div><p className="text-sm text-muted-foreground">Còn nợ NCC</p><p className="text-xl font-bold">{formatCurrency(data?.summary.totalDebt || 0)}</p></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Giá trị nhập hàng theo NCC</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(v) => `${(v / 1000000).toFixed(0)}tr`} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Bar dataKey="amount" name="Tổng nhập" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                <Bar dataKey="debt" name="Công nợ" fill="#ef4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Chi tiết nhà cung cấp</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Tìm tên NCC, SĐT..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
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
                    <TableHead className="font-semibold min-w-[180px]">Nhà cung cấp</TableHead>
                    <TableHead className="font-semibold text-center">Phiếu nhập</TableHead>
                    <TableHead className="font-semibold text-right">Tổng nhập</TableHead>
                    <TableHead className="font-semibold text-right">Đã trả</TableHead>
                    <TableHead className="font-semibold text-right">Công nợ</TableHead>
                    <TableHead className="font-semibold text-center">SP trong kho</TableHead>
                    <TableHead className="font-semibold text-right">Nhập gần nhất</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.paginatedData.map((item) => (
                    <TableRow key={item.supplierId}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.supplierName}</p>
                          {item.phone && <p className="text-xs text-muted-foreground">{item.phone}</p>}
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-medium">{item.importCount}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(item.totalImportAmount)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.paidAmount)}</TableCell>
                      <TableCell className={`text-right ${item.debtAmount > 0 ? 'text-destructive font-medium' : ''}`}>
                        {item.debtAmount > 0 ? formatCurrency(item.debtAmount) : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{item.productCount}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {item.lastImportDate ? format(new Date(item.lastImportDate), 'dd/MM/yyyy') : '-'}
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
