import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/mockData';
import { Users, TrendingUp, CreditCard, Package } from 'lucide-react';
import type { Supplier } from '@/hooks/useSuppliers';
import type { SupplierStat } from '@/hooks/useSupplierStats';

interface SupplierStatsProps {
  suppliers: Supplier[];
  supplierStats: SupplierStat[] | undefined;
}

export function SupplierStats({ suppliers, supplierStats }: SupplierStatsProps) {
  const stats = useMemo(() => {
    const totalSuppliers = suppliers.length;
    const withPhone = suppliers.filter(s => s.phone).length;
    const totalImportValue = supplierStats?.reduce((sum, s) => sum + s.totalImportValue, 0) || 0;
    const totalDebt = supplierStats?.reduce((sum, s) => sum + s.totalDebt, 0) || 0;
    const totalReceipts = supplierStats?.reduce((sum, s) => sum + s.receiptCount, 0) || 0;

    return { totalSuppliers, withPhone, totalImportValue, totalDebt, totalReceipts };
  }, [suppliers, supplierStats]);

  const cards = [
    {
      label: 'Tổng NCC',
      value: stats.totalSuppliers.toString(),
      sub: `${stats.withPhone} có SĐT`,
      icon: Users,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: 'Tổng nhập hàng',
      value: formatCurrency(stats.totalImportValue),
      sub: `${stats.totalReceipts} phiếu nhập`,
      icon: TrendingUp,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'Tổng công nợ',
      value: formatCurrency(stats.totalDebt),
      sub: stats.totalDebt > 0 ? 'Còn nợ' : 'Không nợ',
      icon: CreditCard,
      color: stats.totalDebt > 0 ? 'text-destructive' : 'text-muted-foreground',
      bg: stats.totalDebt > 0 ? 'bg-destructive/10' : 'bg-muted',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${card.bg}`}>
                <card.icon className={`h-4 w-4 md:h-5 md:w-5 ${card.color}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] md:text-xs text-muted-foreground">{card.label}</p>
                <p className={`text-sm md:text-lg font-bold truncate ${card.color}`}>
                  {card.value}
                </p>
                <p className="text-[10px] md:text-xs text-muted-foreground">{card.sub}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
