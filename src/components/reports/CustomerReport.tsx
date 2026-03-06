import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/ui/search-input';
import { Label } from '@/components/ui/label';
import { DateRangeApplyFilter } from '@/components/ui/date-range-apply-filter';
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
import { Users, ShoppingCart, CreditCard, UserPlus, Loader2, Search, Download } from 'lucide-react';
import { format, startOfMonth, subDays, startOfWeek, subMonths } from 'date-fns';
import { useCustomerReport } from '@/hooks/useCustomerReport';
import { useBranches } from '@/hooks/useBranches';
import { formatCurrency } from '@/lib/mockData';
import { exportToExcel, formatCurrencyForExcel, formatDateForExcel } from '@/lib/exportExcel';
import { usePagination } from '@/hooks/usePagination';
import { TablePagination } from '@/components/ui/table-pagination';
import { usePermissions } from '@/hooks/usePermissions';

const TIER_LABELS: Record<string, string> = {
  standard: 'Tiêu chuẩn',
  silver: 'Bạc',
  gold: 'Vàng',
  platinum: 'Bạch Kim',
  diamond: 'Kim Cương',
};

const timePresets = [
  { label: 'Hôm nay', value: 'today' },
  { label: 'Tuần này', value: 'this_week' },
  { label: 'Tháng này', value: 'this_month' },
  { label: 'Tháng trước', value: 'last_month' },
  { label: 'Tất cả', value: 'all_time' },
];

export function CustomerReport() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(today);
  const [branchId, setBranchId] = useState('_all_');
  const [sort, setSort] = useState<'top_spent' | 'top_orders' | 'top_debt' | 'newest'>('top_spent');
  const [search, setSearch] = useState('');

  const { data: branches } = useBranches();
  const { data: permissions } = usePermissions();
  const isSuperAdmin = permissions?.canViewAllBranches === true;

  useEffect(() => {
    if (!isSuperAdmin && permissions?.branchId) {
      setBranchId(permissions.branchId);
    }
  }, [isSuperAdmin, permissions?.branchId]);

  const { data, isLoading } = useCustomerReport({
    startDate,
    endDate,
    branchId: branchId !== '_all_' ? branchId : undefined,
    sort,
  });

  const filteredItems = (data?.items || []).filter(item =>
    !search || item.customerName.toLowerCase().includes(search.toLowerCase()) || item.phone.includes(search)
  );

  const pagination = usePagination(filteredItems, { storageKey: 'customer-report' });

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
  const chartData = (data?.items || []).filter(i => i.customerId !== 'walk-in').slice(0, 10).map(i => ({
    name: i.customerName.length > 12 ? i.customerName.slice(0, 12) + '...' : i.customerName,
    spent: i.totalSpent,
    orders: i.orderCount,
  }));

  const handleExportExcel = () => {
    if (!filteredItems.length) return;
    exportToExcel({
      filename: `BC_Khach_hang_${startDate}_${endDate}`,
      sheetName: 'Khách hàng',
      columns: [
        { header: 'STT', key: 'stt', width: 6, isNumeric: true },
        { header: 'Khách hàng', key: 'customerName', width: 25 },
        { header: 'SĐT', key: 'phone', width: 15 },
        { header: 'Hạng', key: 'tierLabel', width: 14 },
        { header: 'Đơn hàng', key: 'orderCount', width: 10, isNumeric: true },
        { header: 'Tổng mua', key: 'totalSpent', width: 18, isNumeric: true },
        { header: 'Công nợ', key: 'debtAmount', width: 18, isNumeric: true },
        { header: 'Điểm', key: 'currentPoints', width: 10, isNumeric: true },
        { header: 'Mua gần nhất', key: 'lastPurchaseDate', width: 14, format: (v) => v ? formatDateForExcel(v) : '' },
      ],
      data: filteredItems.map((item, idx) => ({
        ...item,
        stt: idx + 1,
        tierLabel: TIER_LABELS[item.membershipTier] || item.membershipTier,
      })),
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
            <div className="flex flex-wrap gap-2" data-tour="customer-report-filter">
              {timePresets.map((p) => (
                <Button key={p.value} variant="outline" size="sm" onClick={() => handleTimePreset(p.value)}>{p.label}</Button>
              ))}
            </div>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={!filteredItems.length}>
              <Download className="h-4 w-4 mr-1" />
              Xuất Excel
            </Button>
            <DateRangeApplyFilter
              startDate={startDate}
              endDate={endDate}
              onApply={(s, e) => { setStartDate(s); setEndDate(e); }}
              isLoading={isLoading}
            />
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
                  <SelectItem value="top_spent">Mua nhiều nhất</SelectItem>
                  <SelectItem value="top_orders">Đơn hàng nhiều</SelectItem>
                  <SelectItem value="top_debt">Công nợ cao</SelectItem>
                  <SelectItem value="newest">Mua gần đây</SelectItem>
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
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Users className="h-5 w-5 text-primary" /></div>
              <div><p className="text-sm text-muted-foreground">Khách hàng</p><p className="text-2xl font-bold">{data?.summary.totalCustomers || 0}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center"><ShoppingCart className="h-5 w-5 text-green-600" /></div>
              <div><p className="text-sm text-muted-foreground">Tổng doanh thu</p><p className="text-xl font-bold">{formatCurrency(data?.summary.totalRevenue || 0)}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center"><CreditCard className="h-5 w-5 text-red-600" /></div>
              <div><p className="text-sm text-muted-foreground">Tổng công nợ</p><p className="text-xl font-bold">{formatCurrency(data?.summary.totalDebt || 0)}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center"><UserPlus className="h-5 w-5 text-blue-600" /></div>
              <div><p className="text-sm text-muted-foreground">Khách mới</p><p className="text-2xl font-bold">{data?.summary.newCustomers || 0}</p></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Top 10 khách hàng</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(v) => `${(v / 1000000).toFixed(0)}tr`} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Bar dataKey="spent" name="Tổng mua" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Chi tiết khách hàng</CardTitle>
            <SearchInput placeholder="Tìm tên, SĐT..." value={search} onChange={setSearch} containerClassName="w-64" />
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
                    <TableHead className="font-semibold min-w-[180px]">Khách hàng</TableHead>
                    <TableHead className="font-semibold text-center">Hạng</TableHead>
                    <TableHead className="font-semibold text-center">Đơn hàng</TableHead>
                    <TableHead className="font-semibold text-right">Tổng mua</TableHead>
                    <TableHead className="font-semibold text-right">Công nợ</TableHead>
                    <TableHead className="font-semibold text-center">Điểm</TableHead>
                    <TableHead className="font-semibold text-right">Mua gần nhất</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.paginatedData.map((item) => (
                    <TableRow key={item.customerId}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.customerName}</p>
                          {item.phone && <p className="text-xs text-muted-foreground">{item.phone}</p>}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{TIER_LABELS[item.membershipTier] || item.membershipTier}</Badge>
                      </TableCell>
                      <TableCell className="text-center font-medium">{item.orderCount}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(item.totalSpent)}</TableCell>
                      <TableCell className={`text-right ${item.debtAmount > 0 ? 'text-destructive font-medium' : ''}`}>
                        {item.debtAmount > 0 ? formatCurrency(item.debtAmount) : '-'}
                      </TableCell>
                      <TableCell className="text-center">{item.currentPoints > 0 ? item.currentPoints : '-'}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {item.lastPurchaseDate ? format(new Date(item.lastPurchaseDate), 'dd/MM/yyyy') : '-'}
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
