import { Package, AlertTriangle, XCircle, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface InventoryStatsProps {
  totalProducts: number;
  totalStock: number;
  lowStockItems: number;
  outOfStockItems: number;
}

export function InventoryStats({
  totalProducts,
  totalStock,
  lowStockItems,
  outOfStockItems,
}: InventoryStatsProps) {
  const stats = [
    {
      title: 'Tổng sản phẩm',
      value: totalProducts,
      icon: Package,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Tổng tồn kho',
      value: totalStock,
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: 'Sắp hết hàng',
      value: lowStockItems,
      icon: AlertTriangle,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
    {
      title: 'Hết hàng',
      value: outOfStockItems,
      icon: XCircle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.title}>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className={`rounded-lg p-3 ${stat.bgColor}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{stat.title}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
