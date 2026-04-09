import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Clock, AlertTriangle, XCircle, Timer, TrendingUp } from 'lucide-react';
import { useAttendanceRecords, useTodayAttendanceSummary } from '@/hooks/useAttendance';
import { supabase } from '@/integrations/supabase/client';
import { usePlatformUser, useCurrentTenant } from '@/hooks/useTenant';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

const statusConfig: Record<string, { label: string; class: string }> = {
  on_time: { label: 'Đúng giờ', class: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  late: { label: 'Đi trễ', class: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  early_leave: { label: 'Về sớm', class: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
  absent: { label: 'Vắng', class: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  pending: { label: 'Đang làm', class: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
};

export function AttendanceDashboardTab() {
  const { data: summary, isLoading } = useTodayAttendanceSummary();
  const { data: pu } = usePlatformUser();
  const { data: tenant } = useCurrentTenant();
  const today = new Date().toISOString().split('T')[0];
  const { data: todayRecords, refetch } = useAttendanceRecords({ date: today });

  // Fetch profiles for user names
  const userIds = [...new Set(todayRecords?.map(r => r.user_id) || [])];
  const { data: profiles } = useQuery({
    queryKey: ['profiles-batch', userIds],
    queryFn: async () => {
      if (!userIds.length) return {};
      const { data } = await supabase.from('profiles').select('user_id, display_name').in('user_id', userIds);
      return Object.fromEntries((data || []).map(p => [p.user_id, p.display_name]));
    },
    enabled: userIds.length > 0,
  });

  // Realtime subscription
  useEffect(() => {
    if (!pu?.tenant_id) return;
    const channel = supabase
      .channel('attendance-dashboard')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'attendance_records',
        filter: `tenant_id=eq.${pu.tenant_id}`,
      }, () => { refetch(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [pu?.tenant_id, refetch]);

  const cards = [
    { label: 'Đã chấm công', value: summary?.total || 0, icon: Users, color: 'text-primary' },
    { label: 'Đúng giờ', value: summary?.onTime || 0, icon: Clock, color: 'text-green-600 dark:text-green-400' },
    { label: 'Đi trễ', value: summary?.late || 0, icon: AlertTriangle, color: 'text-yellow-600 dark:text-yellow-400' },
    { label: 'Vắng', value: summary?.absent || 0, icon: XCircle, color: 'text-destructive' },
    { label: 'Đang làm', value: summary?.pending || 0, icon: Timer, color: 'text-blue-600 dark:text-blue-400' },
  ];

  // Calculate total hours worked today
  const totalMinutes = todayRecords?.reduce((sum, r) => sum + (r.total_work_minutes || 0), 0) || 0;
  const totalLateMinutes = todayRecords?.reduce((sum, r) => sum + (r.late_minutes || 0), 0) || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Hôm nay - {format(new Date(), 'dd/MM/yyyy')}</h2>
        <Badge variant="outline" className="text-xs animate-pulse">● Live</Badge>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {cards.map(c => (
          <Card key={c.label}>
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <div className={`p-1.5 sm:p-2 rounded-lg bg-muted ${c.color}`}>
                <c.icon className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div>
                {isLoading ? <Skeleton className="h-6 w-8" /> : <p className="text-xl sm:text-2xl font-bold">{c.value}</p>}
                <p className="text-[10px] sm:text-xs text-muted-foreground">{c.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-lg font-bold">{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}p</p>
              <p className="text-xs text-muted-foreground">Tổng giờ làm hôm nay</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <div>
              <p className="text-lg font-bold">{totalLateMinutes} phút</p>
              <p className="text-xs text-muted-foreground">Tổng phút đi trễ</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Records */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Chi tiết chấm công hôm nay</CardTitle>
        </CardHeader>
        <CardContent>
          {!todayRecords?.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">Chưa có nhân viên chấm công hôm nay</p>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nhân viên</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead>Check-in</TableHead>
                      <TableHead>Check-out</TableHead>
                      <TableHead>Giờ làm</TableHead>
                      <TableHead>Trễ</TableHead>
                      <TableHead>Địa điểm</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {todayRecords.map((r: any) => {
                      const st = statusConfig[r.status] || statusConfig.pending;
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{profiles?.[r.user_id] || r.user_id.slice(0, 8)}</TableCell>
                          <TableCell><Badge className={`text-[10px] ${st.class}`}>{st.label}</Badge></TableCell>
                          <TableCell>{r.check_in_time ? format(new Date(r.check_in_time), 'HH:mm') : '--:--'}</TableCell>
                          <TableCell>{r.check_out_time ? format(new Date(r.check_out_time), 'HH:mm') : '--:--'}</TableCell>
                          <TableCell>
                            {r.total_work_minutes > 0 ? `${Math.floor(r.total_work_minutes / 60)}h${r.total_work_minutes % 60}p` : '-'}
                          </TableCell>
                          <TableCell>
                            {r.late_minutes > 0 ? <span className="text-yellow-600">{r.late_minutes}p</span> : '-'}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{r.attendance_locations?.name || '-'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-2">
                {todayRecords.map((r: any) => {
                  const st = statusConfig[r.status] || statusConfig.pending;
                  return (
                    <div key={r.id} className="border rounded-lg p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{profiles?.[r.user_id] || r.user_id.slice(0, 8)}</span>
                        <Badge className={`text-[10px] ${st.class}`}>{st.label}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span><Clock className="h-3 w-3 inline mr-0.5" />{r.check_in_time ? format(new Date(r.check_in_time), 'HH:mm') : '--:--'} → {r.check_out_time ? format(new Date(r.check_out_time), 'HH:mm') : '--:--'}</span>
                        {r.total_work_minutes > 0 && <span className="font-medium text-foreground">{Math.floor(r.total_work_minutes / 60)}h{r.total_work_minutes % 60}p</span>}
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        {r.late_minutes > 0 && <span className="text-yellow-600">Trễ {r.late_minutes}p</span>}
                        {r.attendance_locations?.name && <span className="text-muted-foreground">{r.attendance_locations.name}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
