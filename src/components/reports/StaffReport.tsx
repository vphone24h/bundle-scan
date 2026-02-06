import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Users, DollarSign, Target, Award, Loader2, Download } from 'lucide-react';
import { format, startOfMonth, subDays, startOfWeek, subMonths } from 'date-fns';
import { useStaffWithKPI } from '@/hooks/useStaffKPI';
import { formatCurrency } from '@/lib/mockData';
import { exportToExcel, formatCurrencyForExcel } from '@/lib/exportExcel';

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

export function StaffReport() {
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const start = new Date(startDate);
  const end = new Date(endDate);

  const { data: staffWithKPI = [], isLoading } = useStaffWithKPI(start, end);

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

  const totalRevenue = staffWithKPI.reduce((sum, s) => sum + (s.stats?.total_revenue || 0), 0);
  const totalOrders = staffWithKPI.reduce((sum, s) => sum + (s.stats?.total_orders || 0), 0);
  const avgAchievement = staffWithKPI.length > 0 ? staffWithKPI.reduce((sum, s) => sum + s.achievement_percentage, 0) / staffWithKPI.length : 0;
  const topPerformer = staffWithKPI[0];

  // Chart data
  const chartData = staffWithKPI
    .filter(s => s.stats && (s.stats.total_revenue > 0 || s.stats.total_orders > 0))
    .map(s => ({
      name: s.display_name.length > 12 ? s.display_name.slice(0, 12) + '...' : s.display_name,
      revenue: s.stats?.total_revenue || 0,
      orders: s.stats?.total_orders || 0,
    }));

  const handleExportExcel = () => {
    if (!staffWithKPI.length) return;
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
      data: staffWithKPI.map((s, idx) => ({
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
            <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={!staffWithKPI.length}>
              <Download className="h-4 w-4 mr-1" />
              Xuất Excel
            </Button>
            <div className="flex gap-2 items-end">
              <div><Label>Từ ngày</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" /></div>
              <div><Label>Đến ngày</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" /></div>
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
              <div><p className="text-sm text-muted-foreground">Nhân viên</p><p className="text-2xl font-bold">{staffWithKPI.length}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center"><DollarSign className="h-5 w-5 text-green-600" /></div>
              <div><p className="text-sm text-muted-foreground">Tổng doanh thu</p><p className="text-xl font-bold">{formatCurrency(totalRevenue)}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center"><Target className="h-5 w-5 text-blue-600" /></div>
              <div><p className="text-sm text-muted-foreground">Tổng đơn hàng</p><p className="text-2xl font-bold">{totalOrders}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center"><Award className="h-5 w-5 text-amber-600" /></div>
              <div><p className="text-sm text-muted-foreground">Top 1</p><p className="text-lg font-bold truncate max-w-[120px]">{topPerformer?.display_name || '-'}</p></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">So sánh hiệu suất nhân viên</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tickFormatter={(v) => `${(v / 1000000).toFixed(0)}tr`} />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip formatter={(value: number, name: string) => [name === 'Đơn hàng' ? value : formatCurrency(value), name]} />
                <Legend />
                <Bar yAxisId="left" dataKey="revenue" name="Doanh thu" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="orders" name="Đơn hàng" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Chi tiết nhân viên</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {staffWithKPI.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Chưa có dữ liệu</div>
          ) : (
            <div className="overflow-auto">
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
                  {staffWithKPI.map((staff, idx) => (
                    <TableRow key={staff.user_id}>
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
                            <Progress
                              value={Math.min(staff.achievement_percentage, 100)}
                              className="h-2"
                            />
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
