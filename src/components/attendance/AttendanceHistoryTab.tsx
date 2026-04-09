import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Clock, MapPin, Smartphone } from 'lucide-react';
import { useAttendanceRecords } from '@/hooks/useAttendance';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

const statusConfig: Record<string, { label: string; class: string }> = {
  on_time: { label: 'Đúng giờ', class: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  late: { label: 'Đi trễ', class: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  early_leave: { label: 'Về sớm', class: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
  absent: { label: 'Vắng', class: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  pending: { label: 'Đang làm', class: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  day_off: { label: 'Nghỉ', class: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400' },
};

export function AttendanceHistoryTab() {
  const [dateFilter, setDateFilter] = useState(format(new Date(), 'yyyy-MM-dd'));
  const { data: records, isLoading } = useAttendanceRecords({ date: dateFilter || undefined });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <h2 className="text-lg font-semibold">Lịch sử chấm công</h2>
        <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="w-auto" />
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : !records?.length ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Chưa có bản ghi chấm công cho ngày này</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {records.map((r: any) => {
            const st = statusConfig[r.status] || statusConfig.pending;
            return (
              <Card key={r.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{r.user_id?.slice(0, 8)}...</span>
                        <Badge className={`text-[10px] ${st.class}`}>{st.label}</Badge>
                        {r.is_auto_checkout && <Badge variant="outline" className="text-[10px]">Auto</Badge>}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {r.check_in_time ? format(new Date(r.check_in_time), 'HH:mm') : '--:--'}
                          {' → '}
                          {r.check_out_time ? format(new Date(r.check_out_time), 'HH:mm') : '--:--'}
                        </span>
                        {(r.attendance_locations as any)?.name && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {(r.attendance_locations as any).name}
                          </span>
                        )}
                        {r.check_in_method && (
                          <span className="flex items-center gap-1 uppercase">
                            <Smartphone className="h-3 w-3" /> {r.check_in_method}
                          </span>
                        )}
                      </div>
                      {r.late_minutes > 0 && <span className="text-xs text-yellow-600">Trễ {r.late_minutes} phút</span>}
                      {r.overtime_minutes > 0 && <span className="text-xs text-blue-600 ml-2">Tăng ca {r.overtime_minutes} phút</span>}
                    </div>
                    <div className="text-right text-xs text-muted-foreground shrink-0">
                      {(r.work_shifts as any)?.name && <p>{(r.work_shifts as any).name}</p>}
                      {r.total_work_minutes > 0 && <p className="font-medium text-foreground">{Math.floor(r.total_work_minutes / 60)}h{r.total_work_minutes % 60}p</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
