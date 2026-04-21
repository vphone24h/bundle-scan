import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useWarehouseValueSnapshots, aggregateSnapshots } from '@/hooks/useWarehouseValueSnapshots';
import { useBranches } from '@/hooks/useBranches';
import { useBranchFilter } from '@/hooks/useBranchFilter';
import { formatNumber } from '@/lib/formatNumber';
import { format, parseISO, startOfWeek, startOfMonth, endOfMonth, startOfYear, subMonths } from 'date-fns';
import { vi } from 'date-fns/locale';
import { TrendingUp, TrendingDown, Minus, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const RANGE_OPTIONS = [
  { value: 'week', label: 'Tuần này' },
  { value: 'month', label: 'Tháng này' },
  { value: 'last_month', label: 'Tháng trước' },
  { value: 'year', label: 'Năm nay' },
  { value: 'custom', label: 'Tùy chỉnh' },
  { value: 'all', label: 'Toàn bộ' },
];

const GROUP_OPTIONS = [
  { value: '1', label: '1 ngày' },
  { value: '7', label: '7 ngày' },
  { value: '30', label: '30 ngày' },
];

const chartConfig = {
  totalValue: {
    label: 'Giá trị toàn kho',
    color: 'hsl(var(--primary))',
  },
};

export function WarehouseValueChart() {
  const [timeRange, setTimeRange] = useState('month');
  const [groupBy, setGroupBy] = useState('1');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const { data: branches } = useBranches();
  const { shouldFilter } = useBranchFilter();

  const { computedFrom, computedTo } = useMemo(() => {
    const now = new Date();
    switch (timeRange) {
      case 'week':
        return { computedFrom: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'), computedTo: format(now, 'yyyy-MM-dd') };
      case 'month':
        return { computedFrom: format(startOfMonth(now), 'yyyy-MM-dd'), computedTo: format(now, 'yyyy-MM-dd') };
      case 'last_month': {
        const prev = subMonths(now, 1);
        return { computedFrom: format(startOfMonth(prev), 'yyyy-MM-dd'), computedTo: format(endOfMonth(prev), 'yyyy-MM-dd') };
      }
      case 'year':
        return { computedFrom: format(startOfYear(now), 'yyyy-MM-dd'), computedTo: format(now, 'yyyy-MM-dd') };
      case 'custom':
        return { computedFrom: customFrom || undefined, computedTo: customTo || undefined };
      case 'all':
        return { computedFrom: '2020-01-01', computedTo: format(now, 'yyyy-MM-dd') };
      default:
        return { computedFrom: format(startOfMonth(now), 'yyyy-MM-dd'), computedTo: format(now, 'yyyy-MM-dd') };
    }
  }, [timeRange, customFrom, customTo]);

  const branchId = selectedBranch !== 'all' ? selectedBranch : undefined;
  const { chartData, isLoading, percentChange, backfillMutation } = useWarehouseValueSnapshots(
    0,
    branchId,
    computedFrom,
    computedTo
  );

  const displayData = useMemo(() => aggregateSnapshots(chartData, parseInt(groupBy)), [chartData, groupBy]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {displayData.length < 7 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => backfillMutation.mutate()}
            disabled={backfillMutation.isPending}
            className="gap-1.5"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${backfillMutation.isPending ? 'animate-spin' : ''}`} />
            <span className="text-xs">Khôi phục dữ liệu</span>
          </Button>
        )}
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={groupBy} onValueChange={setGroupBy}>
          <SelectTrigger className="w-[110px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GROUP_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {!shouldFilter && (
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Chi nhánh" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toàn bộ</SelectItem>
              {branches?.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {timeRange === 'custom' && (
        <div className="flex gap-2">
          <Input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="w-[150px]"
            placeholder="Từ ngày"
          />
          <Input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="w-[150px]"
            placeholder="Đến ngày"
          />
        </div>
      )}

      {/* Change indicator */}
      {percentChange !== null && (
        <div className="flex items-center gap-2">
          {percentChange > 0 ? (
            <div className="flex items-center gap-1 text-emerald-600 text-sm font-semibold">
              <TrendingUp className="h-4 w-4" />
              <span>+{percentChange.toFixed(1)}% ↑</span>
            </div>
          ) : percentChange < 0 ? (
            <div className="flex items-center gap-1 text-destructive text-sm font-semibold">
              <TrendingDown className="h-4 w-4" />
              <span>{percentChange.toFixed(1)}% ↓</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-muted-foreground text-sm">
              <Minus className="h-4 w-4" />
              <span>0% —</span>
            </div>
          )}
          <span className="text-xs text-muted-foreground">so với kỳ trước</span>
        </div>
      )}


      {/* Chart */}
      {isLoading ? (
        <Skeleton className="h-[300px] w-full" />
      ) : displayData.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Chưa có dữ liệu biểu đồ cho khoảng thời gian này.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="p-3 sm:p-4 pb-0">
            <CardTitle className="text-sm">Biểu đồ giá trị toàn kho</CardTitle>
          </CardHeader>
          <CardContent className="p-2 sm:p-4">
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <ComposedChart data={displayData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(val) => {
                    try {
                      if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
                        return format(parseISO(val), 'dd/MM', { locale: vi });
                      }
                      return val;
                    } catch {
                      return val;
                    }
                  }}
                  className="text-[10px]"
                  tick={{ fontSize: 10 }}
                />
                <YAxis
                  tickFormatter={(val) => {
                    if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)}tỷ`;
                    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(0)}tr`;
                    if (val >= 1_000) return `${(val / 1_000).toFixed(0)}k`;
                    return val.toString();
                  }}
                  tick={{ fontSize: 10 }}
                  width={50}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(_, payload) => {
                        if (payload?.[0]?.payload?.date) {
                          try {
                            const d = payload[0].payload.date;
                            if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
                              return format(parseISO(d), 'dd/MM/yyyy', { locale: vi });
                            }
                            return d;
                          } catch {
                            return payload[0].payload.date;
                          }
                        }
                        return '';
                      }}
                      formatter={(value) => [`${formatNumber(Number(value))} đ`, 'Giá trị']}
                    />
                  }
                />
                <Bar
                  dataKey="totalValue"
                  fill="hsl(var(--primary) / 0.3)"
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  type="monotone"
                  dataKey="totalValue"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </ComposedChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
