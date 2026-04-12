import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Users, Clock, AlertTriangle, XCircle, Timer, TrendingUp, Filter, CalendarIcon, LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePlatformUser, useCurrentTenant } from '@/hooks/useTenant';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subMonths } from 'date-fns';
import { vi } from 'date-fns/locale';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { getLocalDateString } from '@/lib/vietnamTime';

const statusConfig: Record<string, { label: string; class: string }> = {
  on_time: { label: 'Đúng giờ', class: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  late: { label: 'Đi trễ', class: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  early_leave: { label: 'Về sớm', class: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
  absent: { label: 'Vắng', class: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  pending: { label: 'Đang làm', class: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
};

const PIE_COLORS = ['hsl(142, 71%, 45%)', 'hsl(45, 93%, 47%)', 'hsl(24, 94%, 50%)', 'hsl(0, 84%, 60%)', 'hsl(217, 91%, 60%)'];

type DatePreset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'custom';

function getDateRange(preset: DatePreset, customFrom?: Date, customTo?: Date): { from: string; to: string } {
  const now = new Date();
  switch (preset) {
    case 'today':
      return { from: getLocalDateString(now), to: getLocalDateString(now) };
    case 'yesterday': {
      const y = subDays(now, 1);
      return { from: getLocalDateString(y), to: getLocalDateString(y) };
    }
    case 'this_week': {
      const ws = startOfWeek(now, { weekStartsOn: 1 });
      const we = endOfWeek(now, { weekStartsOn: 1 });
      return { from: getLocalDateString(ws), to: getLocalDateString(we) };
    }
    case 'this_month': {
      const ms = startOfMonth(now);
      const me = endOfMonth(now);
      return { from: getLocalDateString(ms), to: getLocalDateString(me) };
    }
    case 'last_month': {
      const lm = subMonths(now, 1);
      return { from: getLocalDateString(startOfMonth(lm)), to: getLocalDateString(endOfMonth(lm)) };
    }
    case 'custom':
      return {
        from: customFrom ? getLocalDateString(customFrom) : getLocalDateString(now),
        to: customTo ? getLocalDateString(customTo) : getLocalDateString(now),
      };
  }
}

const PRESET_LABELS: Record<DatePreset, string> = {
  today: 'Hôm nay',
  yesterday: 'Hôm qua',
  this_week: 'Tuần này',
  this_month: 'Tháng này',
  last_month: 'Tháng trước',
  custom: 'Tùy chọn',
};

export function AttendanceDashboardTab() {
  const { data: pu } = usePlatformUser();
  const { data: tenant } = useCurrentTenant();
  const tenantId = tenant?.id || pu?.tenant_id;

  const [preset, setPreset] = useState<DatePreset>('today');
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [branchFilter, setBranchFilter] = useState<string>('all');

  const dateRange = useMemo(() => getDateRange(preset, customFrom, customTo), [preset, customFrom, customTo]);

  // Fetch attendance records for date range
  const { data: records, isLoading, refetch } = useQuery({
    queryKey: ['attendance-dashboard-records', tenantId, dateRange.from, dateRange.to],
    queryFn: async () => {
      let q = supabase
        .from('attendance_records')
        .select('*, work_shifts(name, start_time, end_time), attendance_locations(name)')
        .eq('tenant_id', tenantId!)
        .gte('date', dateRange.from)
        .lte('date', dateRange.to)
        .order('date', { ascending: false })
        .order('check_in_time', { ascending: false })
        .limit(500);

      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });

  // Branches for filter
  const { data: branches } = useQuery({
    queryKey: ['branches-filter', pu?.tenant_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name')
        .eq('tenant_id', pu!.tenant_id!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!pu?.tenant_id,
  });

  // Filter records by branch
  const filteredRecords = useMemo(() => {
    if (!records) return [];
    if (branchFilter === 'all') return records;
    return records.filter(r => r.branch_id === branchFilter);
  }, [records, branchFilter]);

  // Fetch profiles for user names
  const userIds = [...new Set(filteredRecords?.map(r => r.user_id) || [])];
  const { data: profiles } = useQuery({
    queryKey: ['profiles-batch', userIds],
    queryFn: async () => {
      if (!userIds.length) return {};
      const { data } = await supabase.from('profiles').select('user_id, display_name').in('user_id', userIds);
      return Object.fromEntries((data || []).map(p => [p.user_id, p.display_name]));
    },
    enabled: userIds.length > 0,
  });

  // Realtime subscription - only for "today" preset
  useEffect(() => {
    if (!tenantId || preset !== 'today') return;
    const channel = supabase
      .channel('attendance-dashboard')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'attendance_records',
        filter: `tenant_id=eq.${tenantId}`,
      }, () => { refetch(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId, preset, refetch]);

  // Stats from filtered records
  const filteredStats = useMemo(() => {
    const recs = filteredRecords || [];
    return {
      total: recs.length,
      onTime: recs.filter(r => r.status === 'on_time').length,
      late: recs.filter(r => r.status === 'late').length,
      earlyLeave: recs.filter(r => r.status === 'early_leave' || (r.early_leave_minutes && r.early_leave_minutes > 0)).length,
      absent: recs.filter(r => r.status === 'absent').length,
      pending: recs.filter(r => r.status === 'pending').length,
    };
  }, [filteredRecords]);

  const cards = [
    { label: 'Đã chấm công', value: filteredStats.total, icon: Users, color: 'text-primary' },
    { label: 'Đúng giờ', value: filteredStats.onTime, icon: Clock, color: 'text-green-600 dark:text-green-400' },
    { label: 'Đi trễ', value: filteredStats.late, icon: AlertTriangle, color: 'text-yellow-600 dark:text-yellow-400' },
    { label: 'Về sớm', value: filteredStats.earlyLeave, icon: LogOut, color: 'text-orange-600 dark:text-orange-400' },
    { label: 'Vắng', value: filteredStats.absent, icon: XCircle, color: 'text-destructive' },
    { label: 'Đang làm', value: filteredStats.pending, icon: Timer, color: 'text-blue-600 dark:text-blue-400' },
  ];

  const totalMinutes = filteredRecords?.reduce((sum, r) => sum + (r.total_work_minutes || 0), 0) || 0;
  const totalLateMinutes = filteredRecords?.reduce((sum, r) => sum + (r.late_minutes || 0), 0) || 0;
  const totalEarlyLeaveMinutes = filteredRecords?.reduce((sum, r) => sum + (r.early_leave_minutes || 0), 0) || 0;

  // Pie chart data
  const pieData = [
    { name: 'Đúng giờ', value: filteredStats.onTime },
    { name: 'Đi trễ', value: filteredStats.late },
    { name: 'Về sớm', value: filteredStats.earlyLeave },
    { name: 'Vắng', value: filteredStats.absent },
    { name: 'Đang làm', value: filteredStats.pending },
  ].filter(d => d.value > 0);

  const handlePresetChange = useCallback((val: string) => {
    setPreset(val as DatePreset);
    if (val !== 'custom') {
      setCustomFrom(undefined);
      setCustomTo(undefined);
    }
  }, []);

  const displayDateLabel = useMemo(() => {
    if (preset === 'today') return `Hôm nay - ${format(new Date(), 'dd/MM/yyyy')}`;
    if (preset === 'yesterday') return `Hôm qua - ${format(subDays(new Date(), 1), 'dd/MM/yyyy')}`;
    if (dateRange.from === dateRange.to) return format(new Date(dateRange.from + 'T00:00:00'), 'dd/MM/yyyy');
    return `${format(new Date(dateRange.from + 'T00:00:00'), 'dd/MM')} → ${format(new Date(dateRange.to + 'T00:00:00'), 'dd/MM/yyyy')}`;
  }, [preset, dateRange]);

  return (
    <div className="space-y-4">
      {/* Filters row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold">{displayDateLabel}</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Date preset filter */}
          <Select value={preset} onValueChange={handlePresetChange}>
            <SelectTrigger className="w-32 h-7 text-xs">
              <CalendarIcon className="h-3 w-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PRESET_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Custom date range pickers */}
          {preset === 'custom' && (
            <div className="flex items-center gap-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs px-2">
                    {customFrom ? format(customFrom, 'dd/MM/yy') : 'Từ'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} locale={vi} />
                </PopoverContent>
              </Popover>
              <span className="text-xs text-muted-foreground">→</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs px-2">
                    {customTo ? format(customTo, 'dd/MM/yy') : 'Đến'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customTo} onSelect={setCustomTo} locale={vi} />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Branch filter */}
          {branches && branches.length > 1 && (
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="w-36 h-7 text-xs">
                <Filter className="h-3 w-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả chi nhánh</SelectItem>
                {branches.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {preset === 'today' && (
            <Badge variant="outline" className="text-xs animate-pulse">● Live</Badge>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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

      {/* Chart + Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {pieData.length > 0 && (
          <Card className="sm:col-span-1">
            <CardHeader className="pb-0 p-3"><CardTitle className="text-sm">Tỉ lệ</CardTitle></CardHeader>
            <CardContent className="p-2">
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={55} innerRadius={30}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 justify-center">
                {pieData.map((d, i) => (
                  <span key={d.name} className="flex items-center gap-1 text-[10px]">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    {d.name}: {d.value}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        <Card className={pieData.length > 0 ? 'sm:col-span-2' : 'sm:col-span-3'}>
          <CardContent className="p-4 grid grid-cols-3 gap-3">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-lg font-bold">{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}p</p>
                <p className="text-xs text-muted-foreground">Tổng giờ làm</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-lg font-bold">{totalLateMinutes} phút</p>
                <p className="text-xs text-muted-foreground">Tổng phút trễ</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <LogOut className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-lg font-bold">{totalEarlyLeaveMinutes} phút</p>
                <p className="text-xs text-muted-foreground">Tổng về sớm</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Records Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Chi tiết chấm công</CardTitle>
        </CardHeader>
        <CardContent>
          {!filteredRecords?.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">Chưa có dữ liệu chấm công trong khoảng thời gian này</p>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nhân viên</TableHead>
                      {dateRange.from !== dateRange.to && <TableHead>Ngày</TableHead>}
                      <TableHead>Trạng thái</TableHead>
                      <TableHead>Check-in</TableHead>
                      <TableHead>Check-out</TableHead>
                      <TableHead>Giờ làm</TableHead>
                      <TableHead>Trễ</TableHead>
                      <TableHead>Về sớm</TableHead>
                      <TableHead>Địa điểm</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.map((r: any) => {
                      const st = statusConfig[r.status] || statusConfig.pending;
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{profiles?.[r.user_id] || r.user_id.slice(0, 8)}</TableCell>
                          {dateRange.from !== dateRange.to && (
                            <TableCell className="text-xs">{format(new Date(r.date + 'T00:00:00'), 'dd/MM')}</TableCell>
                          )}
                          <TableCell><Badge className={`text-[10px] ${st.class}`}>{st.label}</Badge></TableCell>
                          <TableCell>{r.check_in_time ? format(new Date(r.check_in_time), 'HH:mm') : '--:--'}</TableCell>
                          <TableCell>{r.check_out_time ? format(new Date(r.check_out_time), 'HH:mm') : '--:--'}</TableCell>
                          <TableCell>
                            {r.total_work_minutes > 0 ? `${Math.floor(r.total_work_minutes / 60)}h${r.total_work_minutes % 60}p` : '-'}
                          </TableCell>
                          <TableCell>
                            {r.late_minutes > 0 ? <span className="text-yellow-600">{r.late_minutes}p</span> : '-'}
                          </TableCell>
                          <TableCell>
                            {r.early_leave_minutes > 0 ? <span className="text-orange-600">{r.early_leave_minutes}p</span> : '-'}
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
                {filteredRecords.map((r: any) => {
                  const st = statusConfig[r.status] || statusConfig.pending;
                  return (
                    <div key={r.id} className="border rounded-lg p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{profiles?.[r.user_id] || r.user_id.slice(0, 8)}</span>
                        <Badge className={`text-[10px] ${st.class}`}>{st.label}</Badge>
                      </div>
                      {dateRange.from !== dateRange.to && (
                        <p className="text-[10px] text-muted-foreground">{format(new Date(r.date + 'T00:00:00'), 'dd/MM/yyyy')}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span><Clock className="h-3 w-3 inline mr-0.5" />{r.check_in_time ? format(new Date(r.check_in_time), 'HH:mm') : '--:--'} → {r.check_out_time ? format(new Date(r.check_out_time), 'HH:mm') : '--:--'}</span>
                        {r.total_work_minutes > 0 && <span className="font-medium text-foreground">{Math.floor(r.total_work_minutes / 60)}h{r.total_work_minutes % 60}p</span>}
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        {r.late_minutes > 0 && <span className="text-yellow-600">Trễ {r.late_minutes}p</span>}
                        {r.early_leave_minutes > 0 && <span className="text-orange-600">Về sớm {r.early_leave_minutes}p</span>}
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
