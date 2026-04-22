import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenant } from '@/hooks/useTenant';
import { formatNumber } from '@/lib/formatNumber';
import { cn } from '@/lib/utils';
import { Package, ShoppingCart, RotateCcw, Truck, ArrowUpCircle, ArrowDownCircle, Loader2 } from 'lucide-react';

interface Props {
  date: string; // yyyy-MM-dd
}

interface BreakdownData {
  date: string;
  imports: { count: number; cost: number };
  exports: { count: number; cost: number };
  customer_returns: { count: number; cost: number };
  supplier_returns: { count: number; cost: number };
  cash_in: number;
  cash_out: number;
  prev_total: number;
  curr_total: number;
  total_change: number;
}

export function DailyChangeBreakdown({ date }: Props) {
  const { data: tenant } = useCurrentTenant();

  const { data, isLoading } = useQuery({
    queryKey: ['daily-change', tenant?.id, date],
    queryFn: async () => {
      if (!tenant?.id) return null;
      const { data, error } = await supabase.rpc('get_daily_change_breakdown', {
        _tid: tenant.id,
        _date: date,
      });
      if (error) throw error;
      return data as unknown as BreakdownData;
    },
    enabled: !!tenant?.id,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-3">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return null;

  const items = [
    {
      icon: Package,
      label: 'Nhập hàng',
      count: data.imports.count,
      value: data.imports.cost,
      color: 'text-blue-600',
      sign: '+',
    },
    {
      icon: ShoppingCart,
      label: 'Bán hàng (giá vốn)',
      count: data.exports.count,
      value: -data.exports.cost,
      color: 'text-red-500',
      sign: '-',
    },
    {
      icon: RotateCcw,
      label: 'KH trả hàng',
      count: data.customer_returns.count,
      value: data.customer_returns.cost,
      color: 'text-emerald-600',
      sign: '+',
    },
    {
      icon: Truck,
      label: 'Trả NCC',
      count: data.supplier_returns.count,
      value: -data.supplier_returns.cost,
      color: 'text-orange-500',
      sign: '-',
    },
  ].filter(i => i.count > 0);

  const cashNet = data.cash_in - data.cash_out;

  return (
    <div className="mt-2 space-y-1.5 pl-1 border-l-2 border-muted ml-1">
      {items.length === 0 && cashNet === 0 ? (
        <p className="text-[10px] text-muted-foreground pl-2">Không có giao dịch</p>
      ) : (
        <>
          {items.map((item) => (
            <div key={item.label} className="flex items-center justify-between pl-2 pr-1">
              <div className="flex items-center gap-1.5">
                <item.icon className={cn('h-3 w-3', item.color)} />
                <span className="text-[10px] text-muted-foreground">
                  {item.label} ({item.count})
                </span>
              </div>
              <span className={cn('text-[10px] font-medium', item.value >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                {item.value > 0 ? '+' : ''}{formatNumber(item.value)}
              </span>
            </div>
          ))}

          {(data.cash_in > 0 || data.cash_out > 0) && (
            <div className="flex items-center justify-between pl-2 pr-1">
              <div className="flex items-center gap-1.5">
                {cashNet >= 0 ? (
                  <ArrowUpCircle className="h-3 w-3 text-emerald-600" />
                ) : (
                  <ArrowDownCircle className="h-3 w-3 text-red-500" />
                )}
                <span className="text-[10px] text-muted-foreground">
                  Quỹ tiền (thu {formatNumber(data.cash_in)} / chi {formatNumber(data.cash_out)})
                </span>
              </div>
              <span className={cn('text-[10px] font-medium', cashNet >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                {cashNet > 0 ? '+' : ''}{formatNumber(cashNet)}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}