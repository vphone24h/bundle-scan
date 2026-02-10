import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { History, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { format, startOfWeek, startOfMonth, startOfYear, subDays, eachDayOfInterval, startOfDay, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { formatCurrency } from '@/lib/mockData';
import { exportToExcel } from '@/lib/exportExcel';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { CashBookEntry } from '@/hooks/useCashBook';

interface BalanceHistoryProps {
  allEntries: CashBookEntry[] | undefined;
  latestOpeningBalances: Record<string, { amount: number; [key: string]: any }> | undefined | null;
}

const presets = [
  { key: 'today', label: 'Hôm nay' },
  { key: 'yesterday', label: 'Hôm qua' },
  { key: 'this_week', label: 'Tuần này' },
  { key: 'this_month', label: 'Tháng này' },
  { key: 'this_year', label: 'Năm nay' },
  { key: 'custom', label: 'Tùy chọn' },
];

export function BalanceHistorySection({ allEntries, latestOpeningBalances }: BalanceHistoryProps) {
  const [expanded, setExpanded] = useState(false);
  const [timePreset, setTimePreset] = useState('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const openingTotal = useMemo(() => {
    if (!latestOpeningBalances) return 0;
    return Object.values(latestOpeningBalances).reduce((sum, ob) => sum + Number(ob.amount), 0);
  }, [latestOpeningBalances]);

  const dateRange = useMemo(() => {
    if (timePreset === 'custom' && customFrom && customTo) {
      return { from: parseISO(customFrom), to: parseISO(customTo) };
    }
    const today = new Date();
    switch (timePreset) {
      case 'today': return { from: today, to: today };
      case 'yesterday': { const y = subDays(today, 1); return { from: y, to: y }; }
      case 'this_week': return { from: startOfWeek(today, { weekStartsOn: 1 }), to: today };
      case 'this_month': return { from: startOfMonth(today), to: today };
      case 'this_year': return { from: startOfYear(today), to: today };
      default: return { from: startOfMonth(today), to: today };
    }
  }, [timePreset, customFrom, customTo]);

  const dailyBalances = useMemo(() => {
    if (!allEntries?.length) return [];

    try {
      const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });

      // Group entries by date for O(1) lookup
      const byDate = new Map<string, { income: number; expense: number }>();
      allEntries.forEach(e => {
        const key = format(new Date(e.transaction_date), 'yyyy-MM-dd');
        const existing = byDate.get(key) || { income: 0, expense: 0 };
        if (e.type === 'income') existing.income += Number(e.amount);
        else existing.expense += Number(e.amount);
        byDate.set(key, existing);
      });

      // Cumulative totals before range start
      const rangeStart = startOfDay(dateRange.from);
      let cumIncome = 0;
      let cumExpense = 0;
      allEntries.forEach(e => {
        if (new Date(e.transaction_date) < rangeStart) {
          if (e.type === 'income') cumIncome += Number(e.amount);
          else cumExpense += Number(e.amount);
        }
      });

      return days.map(day => {
        const key = format(day, 'yyyy-MM-dd');
        const dayData = byDate.get(key) || { income: 0, expense: 0 };
        cumIncome += dayData.income;
        cumExpense += dayData.expense;

        return {
          dateStr: format(day, 'dd/MM/yyyy'),
          dayLabel: format(day, 'EEE', { locale: vi }),
          dayIncome: dayData.income,
          dayExpense: dayData.expense,
          closingBalance: openingTotal + cumIncome - cumExpense,
        };
      }).reverse(); // newest first
    } catch {
      return [];
    }
  }, [allEntries, dateRange, openingTotal]);

  const handleExport = () => {
    if (!dailyBalances.length) {
      toast({ title: 'Không có dữ liệu', variant: 'destructive' });
      return;
    }
    exportToExcel({
      filename: `So_du_so_quy_${format(new Date(), 'ddMMyyyy')}`,
      sheetName: 'Số dư sổ quỹ',
      columns: [
        { header: 'Ngày', key: 'dateStr', width: 15 },
        { header: 'Thu trong ngày', key: 'dayIncome', width: 18, isNumeric: true },
        { header: 'Chi trong ngày', key: 'dayExpense', width: 18, isNumeric: true },
        { header: 'Số dư cuối ngày', key: 'closingBalance', width: 20, isNumeric: true },
      ],
      data: [...dailyBalances].reverse(), // oldest first for Excel
    });
    toast({ title: 'Xuất Excel thành công' });
  };

  const latestBalance = dailyBalances[0]?.closingBalance;

  return (
    <Card>
      <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            Lịch sử số dư
          </CardTitle>
          <div className="flex items-center gap-2">
            {!expanded && latestBalance !== undefined && (
              <span className={cn("text-sm font-bold", latestBalance >= 0 ? 'text-green-600' : 'text-destructive')}>
                {formatCurrency(latestBalance)}
              </span>
            )}
            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-3 pt-0">
          {/* Time presets */}
          <div className="flex flex-wrap gap-1.5">
            {presets.map(p => (
              <Button
                key={p.key}
                variant={timePreset === p.key ? 'default' : 'outline'}
                size="sm"
                className="text-xs h-7 px-2.5"
                onClick={() => {
                  setTimePreset(p.key);
                  if (p.key !== 'custom') { setCustomFrom(''); setCustomTo(''); }
                }}
              >
                {p.label}
              </Button>
            ))}
          </div>

          {timePreset === 'custom' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Từ ngày</Label>
                <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Đến ngày</Label>
                <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="h-8 text-sm" />
              </div>
            </div>
          )}

          {/* Export */}
          <Button variant="outline" size="sm" onClick={handleExport} className="w-full text-xs h-8">
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Xuất Excel số dư
          </Button>

          {/* Daily balance list */}
          <div className="max-h-[50vh] overflow-y-auto space-y-1.5">
            {dailyBalances.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Không có dữ liệu</p>
            ) : (
              dailyBalances.map((day, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-lg border bg-card">
                  <div>
                    <p className="font-medium text-xs">{day.dateStr} <span className="text-muted-foreground capitalize">({day.dayLabel})</span></p>
                    <div className="flex gap-3 mt-0.5">
                      {day.dayIncome > 0 && <span className="text-[11px] text-green-600">+{formatCurrency(day.dayIncome)}</span>}
                      {day.dayExpense > 0 && <span className="text-[11px] text-destructive">-{formatCurrency(day.dayExpense)}</span>}
                      {day.dayIncome === 0 && day.dayExpense === 0 && <span className="text-[11px] text-muted-foreground">Không có GD</span>}
                    </div>
                  </div>
                  <p className={cn("font-bold text-sm", day.closingBalance >= 0 ? 'text-green-600' : 'text-destructive')}>
                    {formatCurrency(day.closingBalance)}
                  </p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
