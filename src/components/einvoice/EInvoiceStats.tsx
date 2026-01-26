import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, CheckCircle, XCircle, AlertTriangle, TrendingUp } from 'lucide-react';
import { useEInvoices } from '@/hooks/useEInvoice';
import { formatNumber } from '@/lib/formatNumber';

export function EInvoiceStats() {
  const { data: invoices } = useEInvoices();

  const stats = {
    total: invoices?.length || 0,
    issued: invoices?.filter(i => i.status === 'issued').length || 0,
    cancelled: invoices?.filter(i => i.status === 'cancelled').length || 0,
    error: invoices?.filter(i => i.status === 'error').length || 0,
    totalAmount: invoices?.filter(i => i.status === 'issued').reduce((sum, i) => sum + i.total_amount, 0) || 0,
    totalVat: invoices?.filter(i => i.status === 'issued').reduce((sum, i) => sum + i.vat_amount, 0) || 0,
  };

  const statCards = [
    {
      title: 'Tổng hoá đơn',
      value: stats.total,
      icon: FileText,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Đã phát hành',
      value: stats.issued,
      icon: CheckCircle,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Đã huỷ',
      value: stats.cancelled,
      icon: XCircle,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
    },
    {
      title: 'Lỗi',
      value: stats.error,
      icon: AlertTriangle,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <div className={`p-2 rounded-full ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng doanh thu (đã phát hành)</CardTitle>
            <div className="p-2 rounded-full bg-primary/10">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.totalAmount)}đ</div>
            <p className="text-xs text-muted-foreground mt-1">
              Tổng giá trị các hoá đơn đã phát hành thành công
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng thuế GTGT</CardTitle>
            <div className="p-2 rounded-full bg-orange-500/10">
              <FileText className="h-4 w-4 text-orange-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.totalVat)}đ</div>
            <p className="text-xs text-muted-foreground mt-1">
              Tổng thuế GTGT từ các hoá đơn đã phát hành
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
