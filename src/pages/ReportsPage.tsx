import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { DetailedProfitTable } from '@/components/reports/DetailedProfitTable';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
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
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  RotateCcw,
  Wallet,
  Calculator,
  Calendar,
  Building2,
  Filter,
  Loader2,
  BookOpen,
} from 'lucide-react';
import { format, subDays, startOfWeek, startOfMonth, subMonths, subWeeks } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useReportStats, useReportChartData } from '@/hooks/useReportStats';
import { useBranches } from '@/hooks/useBranches';
import { useCategories } from '@/hooks/useCategories';
import { useReportsGuideUrl } from '@/hooks/useAppConfig';
import { formatCurrency } from '@/lib/mockData';

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const timePresets = [
  { label: 'Hôm nay', value: 'today' },
  { label: 'Hôm qua', value: 'yesterday' },
  { label: 'Tuần này', value: 'this_week' },
  { label: 'Tuần trước', value: 'last_week' },
  { label: 'Tháng này', value: 'this_month' },
  { label: 'Tháng trước', value: 'last_month' },
];

function StatCard({
  title,
  value,
  icon,
  trend,
  description,
  className = '',
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  description?: string;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="mt-2 text-2xl font-bold">{value}</p>
            {description && (
              <p className="mt-1 text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
            trend === 'up' ? 'bg-green-100 text-green-600' :
            trend === 'down' ? 'bg-red-100 text-red-600' :
            'bg-primary/10 text-primary'
          }`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ReportsPage() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const firstDayOfMonth = format(startOfMonth(new Date()), 'yyyy-MM-dd');

  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(today);
  const [branchId, setBranchId] = useState('_all_');
  const [categoryId, setCategoryId] = useState('_all_');
  const [chartGroupBy, setChartGroupBy] = useState<'day' | 'week' | 'month'>('day');

  const { data: branches } = useBranches();
  const { data: categories } = useCategories();
  const reportsGuideUrl = useReportsGuideUrl();

  const filters = {
    startDate,
    endDate,
    branchId: branchId !== '_all_' ? branchId : undefined,
    categoryId: categoryId !== '_all_' ? categoryId : undefined,
  };

  const { data: stats, isLoading: statsLoading } = useReportStats(filters);
  const { data: chartData, isLoading: chartLoading } = useReportChartData({
    ...filters,
    groupBy: chartGroupBy,
  });

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

  // Prepare pie chart data for payment sources
  const paymentPieData = stats ? [
    { name: 'Tiền mặt', value: stats.paymentsBySource.cash },
    { name: 'Thẻ NH', value: stats.paymentsBySource.bank_card },
    { name: 'Ví điện tử', value: stats.paymentsBySource.e_wallet },
    { name: 'Công nợ', value: stats.paymentsBySource.debt },
  ].filter(d => d.value > 0) : [];

  // Prepare expense pie data
  const expensePieData = stats ? Object.entries(stats.expensesByCategory).map(([name, value]) => ({
    name,
    value,
  })).sort((a, b) => b.value - a.value) : [];

  if (statsLoading) {
    return (
      <MainLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageHeader
        title="Báo cáo doanh thu & Lợi nhuận"
        description="Phân tích chi tiết hoạt động kinh doanh"
        actions={
          reportsGuideUrl && (
            <Button variant="secondary" size="sm" asChild>
              <a href={reportsGuideUrl} target="_blank" rel="noopener noreferrer">
                <BookOpen className="mr-2 h-4 w-4" />
                Hướng dẫn
              </a>
            </Button>
          )
        }
      />

      <div className="p-6 space-y-6">
        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4 items-end">
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

              <div className="flex-1" />

              {/* Date range */}
              <div className="flex gap-2 items-end">
                <div>
                  <Label>Từ ngày</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-40"
                  />
                </div>
                <div>
                  <Label>Đến ngày</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-40"
                  />
                </div>
              </div>

              {/* Branch filter */}
              <div>
                <Label>Chi nhánh</Label>
                <Select value={branchId} onValueChange={setBranchId}>
                  <SelectTrigger className="w-40">
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
                  <SelectTrigger className="w-40">
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
            </div>
          </CardContent>
        </Card>

        {/* Main Stats - 6 key numbers */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* 1. Tổng doanh thu bán hàng */}
          <StatCard
            title="1. Tổng doanh thu bán hàng"
            value={formatCurrency(stats?.totalSalesRevenue || 0)}
            icon={<ShoppingCart className="h-5 w-5" />}
            description={`${stats?.productsSold || 0} sản phẩm đã bán`}
          />

          {/* 2. Tổng doanh thu trả hàng */}
          <StatCard
            title="2. Doanh thu trả hàng"
            value={formatCurrency(stats?.totalReturnRevenue || 0)}
            icon={<RotateCcw className="h-5 w-5" />}
            trend="down"
            description={`${stats?.productsReturned || 0} sản phẩm trả`}
            className="border-destructive/20"
          />

          {/* 3. Doanh thu thuần */}
          <StatCard
            title="3. Doanh thu thuần"
            value={formatCurrency(stats?.netRevenue || 0)}
            icon={<DollarSign className="h-5 w-5" />}
            description="= DT bán hàng - DT trả hàng"
          />

          {/* 3.1 Lợi nhuận kinh doanh */}
          <StatCard
            title="3.1 Lợi nhuận kinh doanh"
            value={formatCurrency(stats?.businessProfit || 0)}
            icon={<Calculator className="h-5 w-5" />}
            trend={stats?.businessProfit && stats.businessProfit > 0 ? 'up' : 'down'}
            description="Σ(Giá bán - Giá nhập) từng SP"
            className={(stats?.businessProfit || 0) > 0 ? 'border-green-500/30' : 'border-destructive/30'}
          />

          {/* 4. Chi phí */}
          <StatCard
            title="4. Chi phí"
            value={formatCurrency(stats?.totalExpenses || 0)}
            icon={<Wallet className="h-5 w-5" />}
            trend="down"
            description="Từ sổ quỹ (hạch toán KD)"
          />

          {/* 5. Thu nhập khác */}
          <StatCard
            title="5. Thu nhập khác"
            value={formatCurrency(stats?.otherIncome || 0)}
            icon={<TrendingUp className="h-5 w-5" />}
            description="Bo, hỗ trợ, thu nhập ngoài"
          />
        </div>

        {/* Net Profit - Most important */}
        <Card className={`border-2 ${(stats?.netProfit || 0) >= 0 ? 'border-green-500 bg-green-50/50 dark:bg-green-950/20' : 'border-destructive bg-red-50/50 dark:bg-red-950/20'}`}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-medium">6. LỢI NHUẬN THUẦN (Lợi nhuận thật)</p>
                <p className="text-sm text-muted-foreground mt-1">
                  = (Lợi nhuận KD + Thu nhập khác) - Chi phí
                </p>
              </div>
              <div className="text-right">
                <p className={`text-4xl font-bold ${(stats?.netProfit || 0) >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                  {formatCurrency(stats?.netProfit || 0)}
                </p>
                <Badge variant={(stats?.netProfit || 0) >= 0 ? 'default' : 'destructive'} className="mt-2">
                  {(stats?.netProfit || 0) >= 0 ? 'Có lãi' : 'Lỗ'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue & Profit Chart */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Biểu đồ Doanh thu & Lợi nhuận</CardTitle>
              <Select value={chartGroupBy} onValueChange={(v) => setChartGroupBy(v as any)}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="day">Theo ngày</SelectItem>
                  <SelectItem value="week">Theo tuần</SelectItem>
                  <SelectItem value="month">Theo tháng</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {chartLoading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => {
                        if (chartGroupBy === 'month') {
                          return format(new Date(value + '-01'), 'MM/yyyy');
                        }
                        return format(new Date(value), 'dd/MM', { locale: vi });
                      }}
                    />
                    <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(0)}tr`} />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      labelFormatter={(label) => `Ngày: ${label}`}
                    />
                    <Legend />
                    <Bar dataKey="revenue" name="Doanh thu" fill="#3b82f6" />
                    <Bar dataKey="profit" name="Lợi nhuận" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Payment Sources Pie */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Thống kê nguồn tiền</CardTitle>
            </CardHeader>
            <CardContent>
              {paymentPieData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Chưa có dữ liệu
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={paymentPieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      dataKey="value"
                    >
                      {paymentPieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Details Tables */}
        <Tabs defaultValue="detailed" className="space-y-4">
          <TabsList>
            <TabsTrigger value="detailed">Chi tiết lợi nhuận</TabsTrigger>
            <TabsTrigger value="category">Theo danh mục</TabsTrigger>
            <TabsTrigger value="expenses">Chi tiết chi phí</TabsTrigger>
          </TabsList>

          {/* Detailed Profit Report */}
          <TabsContent value="detailed">
            <DetailedProfitTable />
          </TabsContent>

          {/* Profit by Category */}
          <TabsContent value="category">
            <Card>
              <CardContent className="pt-6">
                {stats?.profitByCategory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Chưa có dữ liệu
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Danh mục</TableHead>
                        <TableHead className="text-center">SL bán</TableHead>
                        <TableHead className="text-right">Doanh thu</TableHead>
                        <TableHead className="text-right">Lợi nhuận</TableHead>
                        <TableHead className="text-right">Tỷ lệ lãi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats?.profitByCategory.map((cat) => (
                        <TableRow key={cat.categoryId}>
                          <TableCell className="font-medium">{cat.categoryName}</TableCell>
                          <TableCell className="text-center">{cat.count}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(cat.revenue)}
                          </TableCell>
                          <TableCell className={`text-right font-medium ${cat.profit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                            {formatCurrency(cat.profit)}
                          </TableCell>
                          <TableCell className="text-right">
                            {cat.revenue > 0 ? ((cat.profit / cat.revenue) * 100).toFixed(1) : 0}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Expenses Detail */}
          <TabsContent value="expenses">
            <Card>
              <CardContent className="pt-6">
                {expensePieData.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Chưa có dữ liệu chi phí
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Loại chi phí</TableHead>
                          <TableHead className="text-right">Số tiền</TableHead>
                          <TableHead className="text-right">Tỷ lệ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {expensePieData.map((expense, idx) => (
                          <TableRow key={expense.name}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-3 h-3 rounded-full" 
                                  style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                                />
                                {expense.name}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(expense.value)}
                            </TableCell>
                            <TableCell className="text-right">
                              {((expense.value / (stats?.totalExpenses || 1)) * 100).toFixed(1)}%
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={expensePieData}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          dataKey="value"
                          label={({ name }) => name}
                        >
                          {expensePieData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
