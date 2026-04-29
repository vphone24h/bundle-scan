import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { History, Download, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { AlertTriangle } from 'lucide-react';
import { format, eachDayOfInterval, startOfDay, endOfDay, subDays, startOfWeek, startOfMonth, startOfYear } from 'date-fns';
import { vi } from 'date-fns/locale';
import { formatNumber } from '@/lib/formatNumber';
import { exportToExcel } from '@/lib/exportExcel';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenant } from '@/hooks/useTenant';
import type { WarehouseValueData } from '@/hooks/useWarehouseValue';
import { DailyChangeBreakdown } from './DailyChangeBreakdown';
import { useWarehouseValueSnapshots } from '@/hooks/useWarehouseValueSnapshots';

interface Props {
  currentData: WarehouseValueData | undefined;
}

const DATE_FILTERS = [
  { value: 'this_week', label: 'Tuần này' },
  { value: 'this_month', label: 'Tháng này' },
  { value: 'this_year', label: 'Năm nay' },
  { value: 'custom', label: 'Tùy chọn' },
];

function getDateRange(filter: string, customFrom?: string, customTo?: string) {
  const now = new Date();
  switch (filter) {
    case 'this_week':
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfDay(now) };
    case 'this_month':
      return { from: startOfMonth(now), to: endOfDay(now) };
    case 'this_year':
      return { from: startOfYear(now), to: endOfDay(now) };
    case 'custom':
      if (customFrom && customTo) {
        return { from: startOfDay(new Date(customFrom)), to: endOfDay(new Date(customTo)) };
      }
      return { from: startOfMonth(now), to: endOfDay(now) };
    default:
      return { from: startOfMonth(now), to: endOfDay(now) };
  }
}

const ALERT_THRESHOLD = 0.20; // 20%

export function WarehouseValueHistory({ currentData }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const { data: tenant } = useCurrentTenant();
  const { backfillMutation } = useWarehouseValueSnapshots(7);

  const dateRange = useMemo(() => getDateRange(dateFilter, customFrom, customTo), [dateFilter, customFrom, customTo]);
  const fromStr = format(dateRange.from, 'yyyy-MM-dd');
  const toStr = format(dateRange.to, 'yyyy-MM-dd');

  const { data: snapshots } = useQuery({
    queryKey: ['wv-history', tenant?.id, fromStr, toStr],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('warehouse_value_snapshots')
        .select('*')
        .eq('tenant_id', tenant.id)
        .is('branch_id', null)
        .gte('snapshot_date', fromStr)
        .lte('snapshot_date', toStr)
        .order('snapshot_date', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenant?.id,
  });

  const dailyData = useMemo(() => {
    if (!snapshots) return [];

    const snapshotMap = new Map<string, {
      inventory: number; cash: number; custDebt: number; suppDebt: number; total: number;
    }>();

    snapshots.forEach(s => {
      snapshotMap.set(s.snapshot_date, {
        inventory: Number(s.inventory_value),
        cash: Number(s.cash_balance),
        custDebt: Number(s.customer_debt),
        suppDebt: Number(s.supplier_debt),
        total: Number(s.total_value),
      });
    });

    // Always override today with live data so the history matches
    // the "Giá trị toàn kho" card (snapshot may be stale from earlier today)
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    if (currentData) {
      snapshotMap.set(todayStr, {
        inventory: currentData.inventoryValue,
        cash: currentData.cashBalance,
        custDebt: currentData.customerDebt,
        suppDebt: currentData.supplierDebt,
        total: currentData.totalValue,
      });
    }

    try {
      const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
      return days.map(day => {
        const key = format(day, 'yyyy-MM-dd');
        const data = snapshotMap.get(key);
        return {
          dateStr: format(day, 'dd/MM/yyyy'),
          dayLabel: format(day, 'EEEE', { locale: vi }),
          date: key,
          hasData: !!data,
          inventory: data?.inventory || 0,
          cash: data?.cash || 0,
          custDebt: data?.custDebt || 0,
          suppDebt: data?.suppDebt || 0,
          total: data?.total || 0,
        };
      }).reverse();
    } catch {
      return [];
    }
  }, [snapshots, currentData, dateRange]);

  const handleExport = () => {
    if (!dailyData.length) {
      toast({ title: 'Không có dữ liệu', variant: 'destructive' });
      return;
    }
    exportToExcel({
      filename: `Gia_tri_toan_kho_${format(new Date(), 'ddMMyyyy')}`,
      sheetName: 'Giá trị toàn kho',
      columns: [
        { header: 'Ngày', key: 'dateStr', width: 15 },
        { header: 'Tồn kho', key: 'inventory', width: 20, isNumeric: true },
        { header: 'Số dư quỹ', key: 'cash', width: 20, isNumeric: true },
        { header: 'CN Khách hàng', key: 'custDebt', width: 20, isNumeric: true },
        { header: 'CN NCC', key: 'suppDebt', width: 20, isNumeric: true },
        { header: 'Giá trị toàn kho', key: 'total', width: 22, isNumeric: true },
      ],
      data: [...dailyData].reverse(),
    });
    toast({ title: 'Xuất Excel thành công' });
  };

  const latestValue = dailyData.find(d => d.hasData)?.total;

  return (
    <Card>
      <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            Lịch sử giá trị kho
          </CardTitle>
          <div className="flex items-center gap-2">
            {!expanded && latestValue !== undefined && (
              <span className={cn("text-sm font-bold", latestValue >= 0 ? 'text-primary' : 'text-destructive')}>
                {formatNumber(Math.round(latestValue))} đ
              </span>
            )}
            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-3 pt-0">
          <Button variant="outline" size="sm" onClick={handleExport} className="w-full text-xs h-8">
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Xuất Excel giá trị kho
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => backfillMutation.mutate()}
            disabled={backfillMutation.isPending}
            className="w-full text-xs h-8 gap-1.5"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${backfillMutation.isPending ? 'animate-spin' : ''}`} />
            Khôi phục dữ liệu
          </Button>

          <div className="flex flex-wrap gap-2">
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_FILTERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-[10px] text-muted-foreground self-center">
              {format(dateRange.from, 'dd/MM')} - {format(dateRange.to, 'dd/MM/yyyy')}
            </span>
          </div>

          {dateFilter === 'custom' && (
            <div className="flex gap-2">
              <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="flex-1 h-8 text-xs" />
              <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="flex-1 h-8 text-xs" />
            </div>
          )}

          <div className="max-h-[50vh] overflow-y-auto space-y-1.5">
            {dailyData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Không có dữ liệu</p>
            ) : (
              dailyData.map((day, i) => {
                const prevDay = dailyData[i + 1]; // reversed, so next index = previous day
                const change = prevDay?.hasData && day.hasData ? day.total - prevDay.total : null;
                const changePct = (change !== null && prevDay.total !== 0) ? change / prevDay.total : null;
                const isAlert = changePct !== null && Math.abs(changePct) >= ALERT_THRESHOLD;

                // Breakdown delta per component
                const componentDeltas = (prevDay?.hasData && day.hasData) ? [
                  { label: 'Tồn kho', delta: day.inventory - prevDay.inventory },
                  { label: 'Số dư quỹ', delta: day.cash - prevDay.cash },
                  { label: 'CN khách hàng', delta: day.custDebt - prevDay.custDebt },
                  { label: 'CN nhà cung cấp', delta: -(day.suppDebt - prevDay.suppDebt) }, // supplier debt giảm = tăng giá trị
                ].filter(c => Math.abs(c.delta) >= 1) : [];

                return (
                  <div
                    key={day.date}
                    className={cn(
                      "p-2.5 rounded-lg border bg-card cursor-pointer transition-colors",
                      selectedDate === day.date && "border-primary/40 bg-primary/5",
                      isAlert && "border-orange-400/60 bg-orange-50/50 dark:bg-orange-950/20"
                    )}
                    onClick={() => day.hasData && setSelectedDate(prev => prev === day.date ? null : day.date)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1">
                          {isAlert && <AlertTriangle className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" />}
                          <p className="font-medium text-xs">
                            {day.dateStr}{' '}
                            <span className="text-muted-foreground capitalize">({day.dayLabel})</span>
                          </p>
                        </div>
                        {day.hasData ? (
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                            <span className="text-[10px] text-muted-foreground">TK: {formatNumber(Math.round(day.inventory))}</span>
                            <span className="text-[10px] text-muted-foreground">SQ: {formatNumber(Math.round(day.cash))}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">Chưa ghi nhận</span>
                        )}
                      </div>
                      <div className="text-right">
                        <p className={cn(
                          "font-bold text-sm",
                          !day.hasData ? 'text-muted-foreground' : day.total >= 0 ? 'text-primary' : 'text-destructive'
                        )}>
                          {day.hasData ? `${formatNumber(Math.round(day.total))} đ` : '—'}
                        </p>
                        {change !== null && (
                          <span className={cn(
                            "text-[10px] font-medium",
                            change > 0 ? 'text-emerald-600' : change < 0 ? 'text-destructive' : 'text-muted-foreground'
                          )}>
                            {change > 0 ? '+' : ''}{formatNumber(Math.round(change))} đ
                          </span>
                        )}
                        {changePct !== null && Math.abs(changePct) >= 0.01 && (
                          <span className={cn(
                            "text-[9px]",
                            isAlert ? 'font-semibold text-orange-600 dark:text-orange-400' : 'text-muted-foreground'
                          )}>
                            ({changePct > 0 ? '+' : ''}{(changePct * 100).toFixed(1)}%)
                          </span>
                        )}
                      </div>
                    </div>

                    {selectedDate === day.date && day.hasData && (
                      <DailyChangeBreakdown date={day.date} />
                    )}

                    {componentDeltas.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-dashed space-y-0.5">
                        {componentDeltas.map((c) => (
                          <div key={c.label} className="flex items-center justify-between text-[10px]">
                            <span className="text-muted-foreground">{c.label}</span>
                            <span className={cn(
                              "font-medium tabular-nums",
                              c.delta > 0 ? 'text-emerald-600' : 'text-destructive'
                            )}>
                              {c.delta > 0 ? '+' : ''}{formatNumber(Math.round(c.delta))} đ
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
