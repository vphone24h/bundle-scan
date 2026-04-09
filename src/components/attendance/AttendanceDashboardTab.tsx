import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Clock, AlertTriangle, XCircle } from 'lucide-react';
import { useTodayAttendanceSummary } from '@/hooks/useAttendance';
import { Skeleton } from '@/components/ui/skeleton';

export function AttendanceDashboardTab() {
  const { data: summary, isLoading } = useTodayAttendanceSummary();

  const cards = [
    { label: 'Đã chấm công', value: summary?.total || 0, icon: Users, color: 'text-primary' },
    { label: 'Đúng giờ', value: summary?.onTime || 0, icon: Clock, color: 'text-green-600' },
    { label: 'Đi trễ', value: summary?.late || 0, icon: AlertTriangle, color: 'text-yellow-600' },
    { label: 'Vắng', value: summary?.absent || 0, icon: XCircle, color: 'text-destructive' },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Hôm nay</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map(c => (
          <Card key={c.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-muted ${c.color}`}>
                <c.icon className="h-5 w-5" />
              </div>
              <div>
                {isLoading ? (
                  <Skeleton className="h-7 w-10" />
                ) : (
                  <p className="text-2xl font-bold">{c.value}</p>
                )}
                <p className="text-xs text-muted-foreground">{c.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hoạt động gần đây</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Chưa có dữ liệu chấm công. Nhân viên có thể chấm công tại trang Check-in.</p>
        </CardContent>
      </Card>
    </div>
  );
}
