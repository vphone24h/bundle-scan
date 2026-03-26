import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { History, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { format, eachDayOfInterval, startOfDay, subDays } from 'date-fns';
import { vi } from 'date-fns/locale';
import { formatNumber } from '@/lib/formatNumber';
import { exportToExcel } from '@/lib/exportExcel';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenant } from '@/hooks/useTenant';
import type { WarehouseValueData } from '@/hooks/useWarehouseValue';

interface Props {
  currentData: WarehouseValueData | undefined;
  dateRange: { from: Date; to: Date };
}

export function WarehouseValueHistory({ currentData, dateRange }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { data: tenant } = useCurrentTenant();

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

    // Add current data for today if not in snapshots
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    if (currentData && !snapshotMap.has(todayStr)) {
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
                {formatNumber(latestValue)} đ
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

          <div className="max-h-[50vh] overflow-y-auto space-y-1.5">
            {dailyData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Không có dữ liệu</p>
            ) : (
              dailyData.map((day, i) => {
                const prevDay = dailyData[i + 1]; // reversed, so next index = previous day
                const change = prevDay?.hasData && day.hasData ? day.total - prevDay.total : null;

                return (
                  <div key={day.date} className="p-2.5 rounded-lg border bg-card">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-xs">
                          {day.dateStr}{' '}
                          <span className="text-muted-foreground capitalize">({day.dayLabel})</span>
                        </p>
                        {day.hasData ? (
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                            <span className="text-[10px] text-muted-foreground">TK: {formatNumber(day.inventory)}</span>
                            <span className="text-[10px] text-muted-foreground">SQ: {formatNumber(day.cash)}</span>
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
                          {day.hasData ? `${formatNumber(day.total)} đ` : '—'}
                        </p>
                        {change !== null && (
                          <span className={cn(
                            "text-[10px] font-medium",
                            change > 0 ? 'text-emerald-600' : change < 0 ? 'text-destructive' : 'text-muted-foreground'
                          )}>
                            {change > 0 ? '+' : ''}{formatNumber(change)} đ
                          </span>
                        )}
                      </div>
                    </div>
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
