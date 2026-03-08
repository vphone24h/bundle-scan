import { Card, CardContent } from '@/components/ui/card';
import { Users, DollarSign, Coins, ShoppingCart } from 'lucide-react';
import { useAffiliates, useAffiliateCommissions, useAffiliateWithdrawals } from '@/hooks/useAffiliate';

export function CTVStatsOverview() {
  const { data: affiliates } = useAffiliates();
  const { data: commissions } = useAffiliateCommissions();
  const { data: withdrawals } = useAffiliateWithdrawals();

  const totalCTV = affiliates?.length || 0;
  const activeCTV = affiliates?.filter(a => a.status === 'active').length || 0;
  const totalRevenue = affiliates?.reduce((sum, a) => sum + (a.total_commission_earned || 0), 0) || 0;
  const totalPaid = withdrawals
    ?.filter(w => w.status === 'paid')
    .reduce((sum, w) => sum + w.amount, 0) || 0;
  const totalOrders = affiliates?.reduce((sum, a) => sum + (a.total_conversions || 0), 0) || 0;

  const stats = [
    {
      label: 'Tổng CTV',
      value: totalCTV,
      sub: `${activeCTV} đang hoạt động`,
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Tổng doanh thu từ CTV',
      value: totalRevenue.toLocaleString('vi-VN') + ' ₫',
      sub: 'Tổng hoa hồng phát sinh',
      icon: DollarSign,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: 'Hoa hồng đã trả',
      value: totalPaid.toLocaleString('vi-VN') + ' ₫',
      sub: 'Đã thanh toán',
      icon: Coins,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
    {
      label: 'Tổng đơn từ CTV',
      value: totalOrders,
      sub: 'Đơn hàng chuyển đổi',
      icon: ShoppingCart,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.bg}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
                <p className="text-lg font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.sub}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
