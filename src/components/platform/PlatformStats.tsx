import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAllTenants, usePaymentRequests, useSubscriptionPlans } from '@/hooks/useTenant';
import { Building2, CreditCard, Users, TrendingUp, Clock, CheckCircle } from 'lucide-react';
import { formatNumber } from '@/lib/formatNumber';

export function PlatformStats() {
  const { data: tenants } = useAllTenants();
  const { data: payments } = usePaymentRequests();
  const { data: plans } = useSubscriptionPlans();

  const stats = {
    totalTenants: tenants?.length || 0,
    trialTenants: tenants?.filter(t => t.status === 'trial').length || 0,
    activeTenants: tenants?.filter(t => t.status === 'active').length || 0,
    expiredTenants: tenants?.filter(t => t.status === 'expired').length || 0,
    lockedTenants: tenants?.filter(t => t.status === 'locked').length || 0,
    pendingPayments: payments?.filter(p => p.status === 'pending').length || 0,
    approvedPayments: payments?.filter(p => p.status === 'approved').length || 0,
    totalRevenue: payments
      ?.filter(p => p.status === 'approved')
      .reduce((sum, p) => sum + Number(p.amount), 0) || 0,
  };

  return (
    <div className="space-y-6">
      {/* Main Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng doanh nghiệp</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTenants}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeTenants} đang hoạt động
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Đang dùng thử</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.trialTenants}</div>
            <p className="text-xs text-muted-foreground">
              Trong 30 ngày trial
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chờ duyệt thanh toán</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.pendingPayments}</div>
            <p className="text-xs text-muted-foreground">
              Cần xử lý
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng doanh thu</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatNumber(stats.totalRevenue)}đ
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.approvedPayments} đơn đã duyệt
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Trạng thái doanh nghiệp</CardTitle>
          </CardHeader>
          <CardContent>
      <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary/60" />
                  <span>Đang dùng thử</span>
                </div>
                <span className="font-medium">{stats.trialTenants}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary" />
                  <span>Đang hoạt động</span>
                </div>
                <span className="font-medium">{stats.activeTenants}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-muted-foreground" />
                  <span>Hết hạn</span>
                </div>
                <span className="font-medium">{stats.expiredTenants}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-destructive" />
                  <span>Bị khóa</span>
                </div>
                <span className="font-medium">{stats.lockedTenants}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Gói dịch vụ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {plans?.map(plan => {
                const count = tenants?.filter(t => t.subscription_plan === plan.plan_type).length || 0;
                return (
                  <div key={plan.id} className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{plan.name}</span>
                      <p className="text-sm text-muted-foreground">
                        {formatNumber(plan.price)}đ
                      </p>
                    </div>
                    <span className="font-medium">{count} DN</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}