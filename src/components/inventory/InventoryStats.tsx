import { Package, AlertTriangle, XCircle, TrendingUp, Wallet } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { usePermissions } from '@/hooks/usePermissions';

interface InventoryStatsProps {
  totalProducts: number;
  totalStock: number;
  lowStockItems: number;
  outOfStockItems: number;
  totalValue?: number;
}

export function InventoryStats({
  totalProducts,
  totalStock,
  lowStockItems,
  outOfStockItems,
  totalValue,
}: InventoryStatsProps) {
  const { data: permissions } = usePermissions();
  const canViewImportPrice = permissions?.canViewImportPrice ?? false;

  const stats = [
    {
      title: 'Tổng sản phẩm',
      value: totalProducts.toLocaleString('vi-VN'),
      icon: Package,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Tổng tồn kho',
      value: totalStock.toLocaleString('vi-VN'),
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: 'Giá trị kho',
      value: totalValue !== undefined ? `${totalValue.toLocaleString('vi-VN')} đ` : '0 đ',
      icon: Wallet,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      isLarge: true,
    },
    {
      title: 'Sắp hết hàng',
      value: lowStockItems.toLocaleString('vi-VN'),
      icon: AlertTriangle,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
    {
      title: 'Hết hàng',
      value: outOfStockItems.toLocaleString('vi-VN'),
      icon: XCircle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
    },
  ];

  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
      {stats.filter(stat => !(stat.title === 'Giá trị kho' && !canViewImportPrice)).map((stat) => (
        <Card key={stat.title}>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className={`rounded-lg p-2 sm:p-3 ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.color}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">{stat.title}</p>
                <p className={`font-bold truncate ${stat.isLarge ? 'text-base sm:text-lg' : 'text-xl sm:text-2xl'}`}>
                  {stat.value}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
