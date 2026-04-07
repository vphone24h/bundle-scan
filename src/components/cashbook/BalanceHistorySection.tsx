import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { History, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { format, eachDayOfInterval, endOfDay } from 'date-fns';
import { vi } from 'date-fns/locale';
import { formatCurrency } from '@/lib/mockData';
import { exportToExcel } from '@/lib/exportExcel';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { CashBookEntry } from '@/hooks/useCashBook';

interface BalanceHistoryProps {
  allEntries: CashBookEntry[] | undefined;
  totalBalance: number;
  dateRange: { from: Date; to: Date };
}

export function BalanceHistorySection({ allEntries, totalBalance, dateRange }: BalanceHistoryProps) {
  const [expanded, setExpanded] = useState(false);

  const dailyBalances = useMemo(() => {
    try {
      const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
      const entries = allEntries || [];

      // Group transactions by day
      const byDate = new Map<string, { income: number; expense: number }>();
      entries.forEach(e => {
        const key = format(new Date(e.transaction_date), 'yyyy-MM-dd');
        const existing = byDate.get(key) || { income: 0, expense: 0 };
        if (e.type === 'income') existing.income += Number(e.amount);
        else existing.expense += Number(e.amount);
        byDate.set(key, existing);
      });

      // Calculate net of all filtered entries
      let totalFilteredNet = 0;
      entries.forEach(e => {
        totalFilteredNet += e.type === 'income' ? Number(e.amount) : -Number(e.amount);
      });

      // Balance before the filtered period = totalBalance - net of filtered entries
      const balanceBeforePeriod = totalBalance - totalFilteredNet;

      // Walk forward day by day to build closing balance
      let cumNet = 0;
      return days.map(day => {
        const key = format(day, 'yyyy-MM-dd');
        const dayData = byDate.get(key) || { income: 0, expense: 0 };
        cumNet += dayData.income - dayData.expense;

        return {
          dateStr: format(day, 'dd/MM/yyyy'),
          dayLabel: format(day, 'EEE', { locale: vi }),
          dayIncome: dayData.income,
          dayExpense: dayData.expense,
          closingBalance: balanceBeforePeriod + cumNet,
        };
      }).reverse();
    } catch {
      return [];
    }
  }, [allEntries, dateRange, totalBalance]);

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
      data: [...dailyBalances].reverse(),
    });
    toast({ title: 'Xuất Excel thành công' });
  };

  const latestBalance = dailyBalances[0]?.closingBalance;

  return (
    <Card data-tour="cashbook-balance-history">
      <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            Lịch sử số dư cuối ngày
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
          <Button variant="outline" size="sm" onClick={handleExport} className="w-full text-xs h-8">
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Xuất Excel số dư
          </Button>

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
