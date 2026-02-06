import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Users, DollarSign, Target, Award, Loader2, Download, ArrowUpDown, ChevronRight } from 'lucide-react';
import { format, startOfMonth, subDays, startOfWeek, subMonths } from 'date-fns';
import { useStaffWithKPI, type StaffWithKPI } from '@/hooks/useStaffKPI';
import { formatCurrency } from '@/lib/mockData';
import { exportToExcel } from '@/lib/exportExcel';
import { StaffDetailDialog } from './StaffDetailDialog';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Quản lý',
  branch_admin: 'QL Chi nhánh',
  staff: 'Nhân viên',
  cashier: 'Thu ngân',
};

const timePresets = [
  { label: 'Tuần này', value: 'this_week' },
  { label: 'Tháng này', value: 'this_month' },
  { label: 'Tháng trước', value: 'last_month' },
  { label: 'Tất cả', value: 'all_time' },
];

type SortMode = 'revenue' | 'orders' | 'performance' | 'kpi_lowest';

const sortOptions: { label: string; value: SortMode }[] = [
  { label: 'Doanh thu cao nhất', value: 'revenue' },
  { label: 'Nhiều đơn nhất', value: 'orders' },
  { label: 'Hiệu suất cao nhất', value: 'performance' },
  { label: 'KPI thấp nhất', value: 'kpi_lowest' },
];

function sortStaff(list: StaffWithKPI[], mode: SortMode): StaffWithKPI[] {
  return [...list].sort((a, b) => {
    switch (mode) {
      case 'revenue':
        return (b.stats?.total_revenue || 0) - (a.stats?.total_revenue || 0);
      case 'orders':
        return (b.stats?.total_orders || 0) - (a.stats?.total_orders || 0);
      case 'performance':
        return (b.stats?.conversion_rate || 0) - (a.stats?.conversion_rate || 0);
      case 'kpi_lowest':
        if (!a.kpi_setting && !b.kpi_setting) return 0;
        if (!a.kpi_setting) return 1;
        if (!b.kpi_setting) return -1;
        return a.achievement_percentage - b.achievement_percentage;
      default:
        return 0;
    }
  });
}

// Mobile staff card component
function StaffCard({ staff, rank, onClick }: { staff: StaffWithKPI; rank: number; onClick: () => void }) {
  const medal = rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : null;
  return (
    <Card className="cursor-pointer active:scale-[0.98] transition-transform" onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0">
            {medal && <span className="text-lg flex-shrink-0">{medal}</span>}
            <div className="min-w-0">
              <p className="font-medium truncate">{staff.display_name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {ROLE_LABELS[staff.user_role] || staff.user_role}
                </Badge>
                {staff.branch_name && (
                  <span className="text-[10px] text-muted-foreground">{staff.branch_name}</span>
                )}
              </div>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-muted/40 rounded-lg p-2">
            <p className="text-[10px] text-muted-foreground">Doanh thu</p>
            <p className="font-bold text-xs">{formatCurrency(staff.stats?.total_revenue || 0)}</p>
          </div>
          <div className="bg-muted/40 rounded-lg p-2">
            <p className="text-[10px] text-muted-foreground">Đơn hàng</p>
            <p className="font-bold text-xs">{staff.stats?.total_orders || 0}</p>
          </div>
          <div className="bg-muted/40 rounded-lg p-2">
            <p className="text-[10px] text-muted-foreground">Khách hàng</p>
            <p className="font-bold text-xs">
              {staff.stats?.total_customers || 0}
              {(staff.stats?.new_customers || 0) > 0 && (
                <span className="text-green-600 ml-0.5">(+{staff.stats?.new_customers})</span>
              )}
            </p>
          </div>
        </div>

        {staff.kpi_setting && (
          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">
                KPI {staff.kpi_setting.kpi_type === 'revenue' ? 'Doanh thu' : 'Đơn hàng'}
              </span>
              <span className={staff.achievement_percentage >= 100 ? 'text-green-600 font-semibold' : 'text-amber-600 font-medium'}>
                {staff.achievement_percentage.toFixed(0)}%
              </span>
            </div>
            <Progress value={Math.min(staff.achievement_percentage, 100)} className="h-2" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function StaffReport() {
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [sortMode, setSortMode] = useState<SortMode>('revenue');
  const [selectedStaff, setSelectedStaff] = useState<StaffWithKPI | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const start = new Date(startDate);
  const end = new Date(endDate);

  const { data: staffWithKPI = [], isLoading } = useStaffWithKPI(start, end);
  const sortedStaff = useMemo(() => sortStaff(staffWithKPI, sortMode), [staffWithKPI, sortMode]);

  const handleTimePreset = (preset: string) => {
    const now = new Date();
    let s: Date;
    let e: Date = now;
    switch (preset) {
      case 'this_week': s = startOfWeek(now, { weekStartsOn: 1 }); break;
      case 'this_month': s = startOfMonth(now); break;
      case 'last_month': s = startOfMonth(subMonths(now, 1)); e = subDays(startOfMonth(now), 1); break;
      case 'all_time': s = new Date('2020-01-01'); break;
      default: return;
    }
    setStartDate(format(s, 'yyyy-MM-dd'));
    setEndDate(format(e, 'yyyy-MM-dd'));
  };

  const handleStaffClick = (staff: StaffWithKPI) => {
    setSelectedStaff(staff);
    setDetailOpen(true);
  };

  const totalRevenue = staffWithKPI.reduce((sum, s) => sum + (s.stats?.total_revenue || 0), 0);
  const totalOrders = staffWithKPI.reduce((sum, s) => sum + (s.stats?.total_orders || 0), 0);
  const topPerformer = sortedStaff[0];

  const chartData = sortedStaff
    .filter(s => s.stats && (s.stats.total_revenue > 0 || s.stats.total_orders > 0))
    .map(s => ({
      name: s.display_name.length > 12 ? s.display_name.slice(0, 12) + '...' : s.display_name,
      revenue: s.stats?.total_revenue || 0,
      orders: s.stats?.total_orders || 0,
    }));

  const handleExportExcel = () => {
    if (!sortedStaff.length) return;
    exportToExcel({
      filename: `BC_Nhan_vien_${startDate}_${endDate}`,
      sheetName: 'Nhân viên',
      columns: [
        { header: 'STT', key: 'stt', width: 6, isNumeric: true },
        { header: 'Nhân viên', key: 'display_name', width: 25 },
        { header: 'Vai trò', key: 'roleLabel', width: 16 },
        { header: 'Chi nhánh', key: 'branch_name', width: 18 },
        { header: 'Doanh thu', key: 'revenue', width: 18, isNumeric: true },
        { header: 'Đơn hàng', key: 'orders', width: 10, isNumeric: true },
        { header: 'Khách hàng', key: 'customers', width: 12, isNumeric: true },
        { header: 'KH mới', key: 'newCustomers', width: 10, isNumeric: true },
        { header: 'KPI (%)', key: 'kpiPercent', width: 10 },
      ],
      data: sortedStaff.map((s, idx) => ({
        stt: idx + 1,
        display_name: s.display_name,
        roleLabel: ROLE_LABELS[s.user_role] || s.user_role,
        branch_name: s.branch_name || 'Tất cả',
        revenue: s.stats?.total_revenue || 0,
        orders: s.stats?.total_orders || 0,
        customers: s.stats?.total_customers || 0,
        newCustomers: s.stats?.new_customers || 0,
        kpiPercent: s.kpi_setting ? s.achievement_percentage.toFixed(1) + '%' : 'Chưa đặt',
      })),
    });
  };

  if (isLoading) {
    return <div className="min-h-[400px] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Filters - mobile optimized */}
      <Card>
        <CardContent className="pt-4 md:pt-6 pb-4">
          {/* Time presets - horizontal scroll on mobile */}
          <ScrollArea className="w-full">
            <div className="flex gap-2 pb-2">
              {timePresets.map((p) => (
                <Button key={p.value} variant="outline" size="sm" className="flex-shrink-0 text-xs" onClick={() => handleTimePreset(p.value)}>
                  {p.label}
                </Button>
              ))}
              <Button variant="outline" size="sm" className="flex-shrink-0 text-xs" onClick={handleExportExcel} disabled={!sortedStaff.length}>
                <Download className="h-3.5 w-3.5 mr-1" />
                Excel
              </Button>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
          {/* Date inputs */}
          <div className="flex gap-2 mt-3">
            <div className="flex-1">
              <Label className="text-xs">Từ ngày</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-sm h-9" />
            </div>
            <div className="flex-1">
              <Label className="text-xs">Đến ngày</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-sm h-9" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sort Options - horizontal scroll on mobile */}
      <Card>
        <CardContent className="py-3 px-3">
          <ScrollArea className="w-full">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground flex-shrink-0">
                <ArrowUpDown className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sắp xếp:</span>
              </div>
              {sortOptions.map((opt) => (
                <Button
                  key={opt.value}
                  variant={sortMode === opt.value ? 'default' : 'outline'}
                  size="sm"
                  className="flex-shrink-0 text-xs h-8"
                  onClick={() => setSortMode(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Summary Cards - 2x2 grid on mobile */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <Card>
          <CardContent className="p-3 md:pt-6 md:p-6">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="h-8 w-8 md:h-10 md:w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Users className="h-4 w-4 md:h-5 md:w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] md:text-sm text-muted-foreground">Nhân viên</p>
                <p className="text-lg md:text-2xl font-bold">{staffWithKPI.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:pt-6 md:p-6">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="h-8 w-8 md:h-10 md:w-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                <DollarSign className="h-4 w-4 md:h-5 md:w-5 text-green-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] md:text-sm text-muted-foreground">Doanh thu</p>
                <p className="text-sm md:text-xl font-bold truncate">{formatCurrency(totalRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:pt-6 md:p-6">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="h-8 w-8 md:h-10 md:w-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Target className="h-4 w-4 md:h-5 md:w-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] md:text-sm text-muted-foreground">Đơn hàng</p>
                <p className="text-lg md:text-2xl font-bold">{totalOrders}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:pt-6 md:p-6">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="h-8 w-8 md:h-10 md:w-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Award className="h-4 w-4 md:h-5 md:w-5 text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] md:text-sm text-muted-foreground">Top 1</p>
                <p className="text-sm md:text-lg font-bold truncate">{topPerformer?.display_name || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2 md:pb-4">
            <CardTitle className="text-sm md:text-lg">So sánh hiệu suất</CardTitle>
          </CardHeader>
          <CardContent className="px-2 md:px-6">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="left" tickFormatter={(v) => `${(v / 1000000).toFixed(0)}tr`} tick={{ fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                <Tooltip formatter={(value: number, name: string) => [name === 'Đơn hàng' ? value : formatCurrency(value), name]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="revenue" name="Doanh thu" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="orders" name="Đơn hàng" fill="hsl(var(--chart-4, 45 93% 47%))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Staff List - card on mobile, table on desktop */}
      <Card>
        <CardHeader className="pb-2 md:pb-3">
          <CardTitle className="text-sm md:text-base">Chi tiết nhân viên</CardTitle>
          <p className="text-[10px] md:text-xs text-muted-foreground">Nhấn vào để xem chi tiết đơn hàng, lịch sử và KPI</p>
        </CardHeader>
        <CardContent className="p-3 md:p-0">
          {sortedStaff.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Chưa có dữ liệu</div>
          ) : (
            <>
              {/* Mobile: Card layout with scroll */}
              <div className="md:hidden space-y-3 max-h-[60vh] overflow-y-auto overscroll-contain pb-2">
                {sortedStaff.map((staff, idx) => (
                  <StaffCard key={staff.user_id} staff={staff} rank={idx} onClick={() => handleStaffClick(staff)} />
                ))}
              </div>

              {/* Desktop: Table layout */}
              <div className="hidden md:block overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="font-semibold min-w-[180px]">Nhân viên</TableHead>
                      <TableHead className="font-semibold text-center">Vai trò</TableHead>
                      <TableHead className="font-semibold text-center">Chi nhánh</TableHead>
                      <TableHead className="font-semibold text-right">Doanh thu</TableHead>
                      <TableHead className="font-semibold text-center">Đơn hàng</TableHead>
                      <TableHead className="font-semibold text-center">Khách hàng</TableHead>
                      <TableHead className="font-semibold min-w-[150px]">KPI</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedStaff.map((staff, idx) => (
                      <TableRow
                        key={staff.user_id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleStaffClick(staff)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {idx === 0 && <span className="text-lg">🥇</span>}
                            {idx === 1 && <span className="text-lg">🥈</span>}
                            {idx === 2 && <span className="text-lg">🥉</span>}
                            <p className="font-medium">{staff.display_name}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{ROLE_LABELS[staff.user_role] || staff.user_role}</Badge>
                        </TableCell>
                        <TableCell className="text-center text-sm">{staff.branch_name || 'Tất cả'}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(staff.stats?.total_revenue || 0)}</TableCell>
                        <TableCell className="text-center">{staff.stats?.total_orders || 0}</TableCell>
                        <TableCell className="text-center">
                          <div>
                            <span>{staff.stats?.total_customers || 0}</span>
                            {(staff.stats?.new_customers || 0) > 0 && (
                              <span className="text-xs text-green-600 ml-1">(+{staff.stats?.new_customers})</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {staff.kpi_setting ? (
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">
                                  {staff.kpi_setting.kpi_type === 'revenue' ? 'DT' : 'Đơn'}
                                </span>
                                <span className={staff.achievement_percentage >= 100 ? 'text-green-600 font-medium' : 'text-amber-600'}>
                                  {staff.achievement_percentage.toFixed(0)}%
                                </span>
                              </div>
                              <Progress value={Math.min(staff.achievement_percentage, 100)} className="h-2" />
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Chưa đặt KPI</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Staff Detail Dialog */}
      <StaffDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        staff={selectedStaff}
        startDate={startDate}
        endDate={endDate}
      />
    </div>
  );
}
