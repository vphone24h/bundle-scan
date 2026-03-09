import { useState, useEffect } from 'react';
import { DetailedProfitTable } from '@/components/reports/DetailedProfitTable';
import { ReportStatDetailDialog, type DetailType } from '@/components/reports/ReportStatDetailDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DateRangeApplyFilter } from '@/components/ui/date-range-apply-filter';
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
  Loader2,
  Download,
} from 'lucide-react';
import { format, subDays, startOfWeek, startOfMonth, subMonths, subWeeks } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useReportStats, useReportChartData } from '@/hooks/useReportStats';
import { useBranches } from '@/hooks/useBranches';
import { useCategories } from '@/hooks/useCategories';
import { formatCurrency } from '@/lib/mockData';
import { exportToExcel, formatCurrencyForExcel } from '@/lib/exportExcel';
import { usePermissions } from '@/hooks/usePermissions';
import { useTranslation } from 'react-i18next';

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

function StatCard({
  title,
  value,
  icon,
  trend,
  description,
  className = '',
  onClick,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  description?: string;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <Card className={`${className} ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`} onClick={onClick}>
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

export function RevenueProfitReport() {
  const { t } = useTranslation();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [branchId, setBranchId] = useState('_all_');
  const [categoryId, setCategoryId] = useState('_all_');
  const [chartGroupBy, setChartGroupBy] = useState<'day' | 'week' | 'month'>('day');
  const [detailType, setDetailType] = useState<DetailType | null>(null);
  const [activePreset, setActivePreset] = useState<string | null>('today');

  const timePresets = [
    { label: t('common.today'), value: 'today' },
    { label: t('common.yesterday'), value: 'yesterday' },
    { label: t('common.thisWeek'), value: 'this_week' },
    { label: t('common.lastWeek'), value: 'last_week' },
    { label: t('common.thisMonth'), value: 'this_month' },
    { label: t('common.lastMonth'), value: 'last_month' },
    { label: t('common.allTime'), value: 'all_time' },
  ];

  const { data: branches } = useBranches();
  const { data: categories } = useCategories();
  const { data: permissions } = usePermissions();
  const isSuperAdmin = permissions?.canViewAllBranches === true;

  // Auto-lock branch for non-Super Admin
  useEffect(() => {
    if (!isSuperAdmin && permissions?.branchId) {
      setBranchId(permissions.branchId);
    }
  }, [isSuperAdmin, permissions?.branchId]);

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

  const handleTimePreset = (preset: string) => {
    const now = new Date();
    let start: Date;
    let end: Date = now;

    switch (preset) {
      case 'today': start = now; break;
      case 'yesterday': start = subDays(now, 1); end = subDays(now, 1); break;
      case 'this_week': start = startOfWeek(now, { weekStartsOn: 1 }); break;
      case 'last_week':
        start = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
        end = subDays(startOfWeek(now, { weekStartsOn: 1 }), 1);
        break;
      case 'this_month': start = startOfMonth(now); break;
      case 'last_month':
        start = startOfMonth(subMonths(now, 1));
        end = subDays(startOfMonth(now), 1);
        break;
      case 'all_time': start = new Date('2020-01-01'); break;
      default: return;
    }

    setActivePreset(preset);
    setStartDate(format(start, 'yyyy-MM-dd'));
    setEndDate(format(end, 'yyyy-MM-dd'));
  };

  const handleExportExcel = () => {
    if (!stats) return;
    const exportData = [
      { label: '1. Tổng doanh thu bán hàng', value: stats.totalSalesRevenue, note: `${stats.productsSold} SP đã bán` },
      { label: '2. Doanh thu trả hàng', value: stats.totalReturnRevenue, note: `${stats.productsReturned} SP trả` },
      { label: '3. Doanh thu thuần', value: stats.netRevenue, note: '= DT bán - DT trả' },
      { label: '3.1 Lợi nhuận kinh doanh', value: stats.businessProfit, note: 'Σ Lãi bán - Σ Lãi trả hàng' },
      { label: '4. Chi phí', value: stats.totalExpenses, note: 'Từ sổ quỹ' },
      { label: '5. Thu nhập khác', value: stats.otherIncome, note: '' },
      { label: '6. LỢI NHUẬN THUẦN', value: stats.netProfit, note: '= (LN KD + Thu nhập khác) - Chi phí' },
    ];
    // Category data
    const categoryData = stats.profitByCategory.map((cat, idx) => ({
      stt: idx + 1,
      categoryName: cat.categoryName,
      count: cat.count,
      revenue: cat.revenue,
      profit: cat.profit,
      margin: cat.revenue > 0 ? ((cat.profit / cat.revenue) * 100).toFixed(1) + '%' : '0%',
    }));

    exportToExcel({
      filename: `BC_Doanh_thu_Loi_nhuan_${startDate}_${endDate}`,
      sheetName: 'Tổng hợp',
      columns: [
        { header: 'Chỉ tiêu', key: 'label', width: 35 },
        { header: 'Giá trị', key: 'value', width: 20, isNumeric: true },
        { header: 'Ghi chú', key: 'note', width: 30 },
      ],
      data: exportData,
    });
  };

  const paymentPieData = stats ? [
    { name: t('common.cash'), value: stats.paymentsBySource.cash },
    { name: t('common.bankCard'), value: stats.paymentsBySource.bank_card },
    { name: t('common.eWallet'), value: stats.paymentsBySource.e_wallet },
    { name: t('common.debt'), value: stats.paymentsBySource.debt },
  ].filter(d => d.value > 0) : [];

  const expensePieData = stats ? Object.entries(stats.expensesByCategory).map(([name, value]) => ({
    name,
    value,
  })).sort((a, b) => b.value - a.value) : [];

  const isInitialLoad = statsLoading && !stats;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex flex-wrap gap-2" data-tour="report-time-presets">
              {timePresets.map((preset) => {
                const isActive = activePreset === preset.value;
                const isLoadingThis = isActive && statsLoading;
                return (
                  <Button
                    key={preset.value}
                    variant={isActive ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleTimePreset(preset.value)}
                    disabled={statsLoading}
                    className="relative"
                  >
                    {isLoadingThis && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                    {preset.label}
                  </Button>
                );
              })}
            </div>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={!stats}>
              <Download className="h-4 w-4 mr-1" />
              {t('common.exportExcel')}
            </Button>
            <div data-tour="report-date-filter">
              <DateRangeApplyFilter
                startDate={startDate}
                endDate={endDate}
                onApply={(s, e) => { setStartDate(s); setEndDate(e); }}
                isLoading={statsLoading}
              />
            </div>
            {isSuperAdmin && (
              <div>
                <Label>{t('common.branch')}</Label>
                <Select value={branchId} onValueChange={setBranchId}>
                  <SelectTrigger className="w-40"><SelectValue placeholder={t('common.all')} /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="_all_">{t('common.all')}</SelectItem>
                    {branches?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>{t('common.category')}</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="w-40"><SelectValue placeholder={t('common.all')} /></SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="_all_">{t('common.all')}</SelectItem>
                  {categories?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isInitialLoad ? (
        <div className="min-h-[400px] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
      <div className={`space-y-6 transition-opacity duration-200 ${statsLoading ? 'opacity-50 pointer-events-none' : ''}`}>
      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title={`1. ${t('common.salesRevenue')}`} value={formatCurrency(stats?.totalSalesRevenue || 0)} icon={<ShoppingCart className="h-5 w-5" />} description={`${stats?.productsSold || 0} ${t('common.productsSold')}`} onClick={() => setDetailType('sales')} />
        <StatCard title={`2. ${t('common.returnRevenue')}`} value={formatCurrency(stats?.totalReturnRevenue || 0)} icon={<RotateCcw className="h-5 w-5" />} trend="down" description={`${stats?.productsReturned || 0} ${t('common.productsReturned')}`} className="border-destructive/20" onClick={() => setDetailType('returns')} />
        <StatCard title={`3. ${t('common.netRevenue')}`} value={formatCurrency(stats?.netRevenue || 0)} icon={<DollarSign className="h-5 w-5" />} description={t('common.salesMinusReturns')} onClick={() => setDetailType('netRevenue')} />
        <StatCard title={`3.1 ${t('common.businessProfit')}`} value={formatCurrency(stats?.businessProfit || 0)} icon={<Calculator className="h-5 w-5" />} trend={stats?.businessProfit && stats.businessProfit > 0 ? 'up' : 'down'} description={t('common.sumSaleMinusImport')} className={(stats?.businessProfit || 0) > 0 ? 'border-green-500/30' : 'border-destructive/30'} onClick={() => setDetailType('businessProfit')} />
        <StatCard title={`4. ${t('common.expenses')}`} value={formatCurrency(stats?.totalExpenses || 0)} icon={<Wallet className="h-5 w-5" />} trend="down" description={t('common.fromCashBook')} onClick={() => setDetailType('expenses')} />
        <StatCard title={`5. ${t('common.otherIncome')}`} value={formatCurrency(stats?.otherIncome || 0)} icon={<TrendingUp className="h-5 w-5" />} description={t('common.tipsOtherIncome')} onClick={() => setDetailType('otherIncome')} />
      </div>

      {/* Net Profit */}
      <Card className={`border-2 cursor-pointer hover:shadow-md transition-shadow ${(stats?.netProfit || 0) >= 0 ? 'border-green-500 bg-green-50/50 dark:bg-green-950/20' : 'border-destructive bg-red-50/50 dark:bg-red-950/20'}`} onClick={() => setDetailType('netProfit')}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
           <div>
              <p className="text-lg font-medium">6. {t('common.netProfit')}</p>
              <p className="text-sm text-muted-foreground mt-1">{t('common.netProfitFormula')}</p>
            </div>
            <div className="text-right">
              <p className={`text-4xl font-bold ${(stats?.netProfit || 0) >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                {formatCurrency(stats?.netProfit || 0)}
              </p>
              <Badge variant={(stats?.netProfit || 0) >= 0 ? 'default' : 'destructive'} className="mt-2">
                {(stats?.netProfit || 0) >= 0 ? t('common.profitable') : t('common.loss')}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">{t('common.revenueChart')}</CardTitle>
            <Select value={chartGroupBy} onValueChange={(v) => setChartGroupBy(v as any)}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="day">{t('common.byDay')}</SelectItem>
                <SelectItem value="week">{t('common.byWeek')}</SelectItem>
                <SelectItem value="month">{t('common.byMonth')}</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {chartLoading ? (
              <div className="h-[300px] flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={(value) => chartGroupBy === 'month' ? format(new Date(value + '-01'), 'MM/yyyy') : format(new Date(value), 'dd/MM', { locale: vi })} />
                  <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(0)}tr`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} labelFormatter={(label) => `${t('common.date')}: ${label}`} />
                  <Legend />
                  <Bar dataKey="revenue" name={t('common.revenue')} fill="#3b82f6" />
                  <Bar dataKey="profit" name={t('common.profit')} fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-lg">{t('common.paymentSourceStats')}</CardTitle></CardHeader>
          <CardContent>
            {paymentPieData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">{t('common.noDataYet')}</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={paymentPieData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} outerRadius={100} dataKey="value">
                    {paymentPieData.map((_, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
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
          <TabsTrigger value="detailed">{t('common.profitDetails')}</TabsTrigger>
          <TabsTrigger value="category">{t('common.byCategory')}</TabsTrigger>
          <TabsTrigger value="expenses">{t('common.expenseDetails')}</TabsTrigger>
        </TabsList>

        <TabsContent value="detailed">
          <DetailedProfitTable externalFilters={filters} />
        </TabsContent>

        <TabsContent value="category">
          <Card>
            <CardContent className="pt-6">
              {stats?.profitByCategory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">{t('common.noDataYet')}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('common.category')}</TableHead>
                      <TableHead className="text-center">{t('common.categorySales')}</TableHead>
                      <TableHead className="text-right">{t('common.revenue')}</TableHead>
                      <TableHead className="text-right">{t('common.profit')}</TableHead>
                      <TableHead className="text-right">{t('common.profitMargin')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats?.profitByCategory.map((cat) => (
                      <TableRow key={cat.categoryId}>
                        <TableCell className="font-medium">{cat.categoryName}</TableCell>
                        <TableCell className="text-center">{cat.count}</TableCell>
                        <TableCell className="text-right">{formatCurrency(cat.revenue)}</TableCell>
                        <TableCell className={`text-right font-medium ${cat.profit >= 0 ? 'text-green-600' : 'text-destructive'}`}>{formatCurrency(cat.profit)}</TableCell>
                        <TableCell className="text-right">{cat.revenue > 0 ? ((cat.profit / cat.revenue) * 100).toFixed(1) : 0}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses">
          <Card>
            <CardContent className="pt-6">
              {expensePieData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">{t('common.noExpenseData')}</div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('common.expenseType')}</TableHead>
                        <TableHead className="text-right">{t('common.amount')}</TableHead>
                        <TableHead className="text-right">{t('common.percentage')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expensePieData.map((expense, idx) => (
                        <TableRow key={expense.name}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                              {expense.name}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(expense.value)}</TableCell>
                          <TableCell className="text-right">{((expense.value / (stats?.totalExpenses || 1)) * 100).toFixed(1)}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={expensePieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name }) => name}>
                        {expensePieData.map((_, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
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

      {/* Detail Popup */}
      <ReportStatDetailDialog
        open={!!detailType}
        onOpenChange={(open) => !open && setDetailType(null)}
        type={detailType || 'sales'}
        salesDetails={stats?.salesDetails || []}
        returnDetails={stats?.returnDetails || []}
        expenseDetails={stats?.expenseDetails || []}
        incomeDetails={stats?.incomeDetails || []}
        stats={stats || null}
      />
      </div>
      )}
    </div>
  );
}
