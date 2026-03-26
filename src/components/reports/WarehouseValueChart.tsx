import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useWarehouseValueSnapshots } from '@/hooks/useWarehouseValueSnapshots';
import { useBranches } from '@/hooks/useBranches';
import { useBranchFilter } from '@/hooks/useBranchFilter';
import { formatNumber } from '@/lib/formatNumber';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const TIME_OPTIONS = [
  { value: '7', label: '7 ngày' },
  { value: '30', label: '30 ngày' },
  { value: 'month', label: 'Tháng này' },
  { value: '90', label: '3 tháng' },
  { value: 'custom', label: 'Tùy chọn' },
];

const chartConfig = {
  totalValue: {
    label: 'Giá trị toàn kho',
    color: 'hsl(var(--primary))',
  },
};

export function WarehouseValueChart() {
  const [timeRange, setTimeRange] = useState('30');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const { data: branches } = useBranches();
  const { shouldFilter } = useBranchFilter();

  const getDays = () => {
    if (timeRange === 'month') {
      const now = new Date();
      return now.getDate();
    }
    if (timeRange === 'custom') return 0;
    return parseInt(timeRange);
  };

  const branchId = selectedBranch !== 'all' ? selectedBranch : undefined;
  const { chartData, isLoading, percentChange, backfillMutation } = useWarehouseValueSnapshots(
    getDays(),
    branchId,
    timeRange === 'custom' ? customFrom : undefined,
    timeRange === 'custom' ? customTo : undefined
  );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIME_OPTIONS.map((opt) => (
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
      ) : chartData.length === 0 ? (
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
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(val) => {
                    try {
                      return format(parseISO(val), 'dd/MM', { locale: vi });
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
                            return format(parseISO(payload[0].payload.date), 'dd/MM/yyyy', { locale: vi });
                          } catch {
                            return '';
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
