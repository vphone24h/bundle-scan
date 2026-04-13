import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Users, Clock, AlertTriangle, TrendingUp, LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePlatformUser } from '@/hooks/useTenant';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isWeekend } from 'date-fns';
import { vi } from 'date-fns/locale';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

export function AttendanceReportTab() {
  const { data: pu } = usePlatformUser();
  const tenantId = pu?.tenant_id;
  const [period, setPeriod] = useState('month');
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));

  const { startDate, endDate } = useMemo(() => {
    const base = new Date(selectedMonth + '-01');
    if (period === 'week') {
      return { startDate: format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'), endDate: format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd') };
    }
    return { startDate: format(startOfMonth(base), 'yyyy-MM-dd'), endDate: format(endOfMonth(base), 'yyyy-MM-dd') };
  }, [period, selectedMonth]);

  const { data: records, isLoading } = useQuery({
    queryKey: ['attendance-report', tenantId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*, work_shifts(name), attendance_locations(name)')
        .eq('tenant_id', tenantId!)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const userIds = [...new Set(records?.map(r => r.user_id) || [])];
  const { data: profiles } = useQuery({
    queryKey: ['profiles-report', userIds],
    queryFn: async () => {
      if (!userIds.length) return {};
      const { data } = await supabase.from('profiles').select('user_id, display_name').in('user_id', userIds);
      return Object.fromEntries((data || []).map(p => [p.user_id, p.display_name]));
    },
    enabled: userIds.length > 0,
  });

  // Aggregate by user
  const userSummary = useMemo(() => {
    if (!records) return [];
    const map = new Map<string, { userId: string; name: string; total: number; onTime: number; late: number; earlyLeave: number; absent: number; totalMinutes: number; lateMinutes: number; earlyLeaveMinutes: number; otMinutes: number }>();
    
    records.forEach(r => {
      if (!map.has(r.user_id)) {
        map.set(r.user_id, { userId: r.user_id, name: profiles?.[r.user_id] || r.user_id.slice(0, 8), total: 0, onTime: 0, late: 0, earlyLeave: 0, absent: 0, totalMinutes: 0, lateMinutes: 0, earlyLeaveMinutes: 0, otMinutes: 0 });
      }
      const u = map.get(r.user_id)!;
      u.total++;
      if (r.status === 'on_time') u.onTime++;
      if (r.status === 'late') u.late++;
      if (r.status === 'absent') u.absent++;
      if ((r.early_leave_minutes || 0) > 0) u.earlyLeave++;
      u.totalMinutes += r.total_work_minutes || 0;
      u.lateMinutes += r.late_minutes || 0;
      u.earlyLeaveMinutes += r.early_leave_minutes || 0;
      u.otMinutes += r.overtime_minutes || 0;
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [records, profiles]);

  // Chart data: by day
  const chartData = useMemo(() => {
    if (!records) return [];
    const map = new Map<string, { date: string; onTime: number; late: number; earlyLeave: number; absent: number }>();
    records.forEach(r => {
      if (!map.has(r.date)) map.set(r.date, { date: r.date, onTime: 0, late: 0, earlyLeave: 0, absent: 0 });
      const d = map.get(r.date)!;
      if (r.status === 'on_time') d.onTime++;
      else if (r.status === 'late') d.late++;
      else if (r.status === 'absent') d.absent++;
      if ((r.early_leave_minutes || 0) > 0) d.earlyLeave++;
    });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [records]);

  // Totals
  const totals = useMemo(() => {
    return userSummary.reduce((acc, u) => ({
      total: acc.total + u.total,
      onTime: acc.onTime + u.onTime,
      late: acc.late + u.late,
      earlyLeave: acc.earlyLeave + u.earlyLeave,
      absent: acc.absent + u.absent,
      totalMinutes: acc.totalMinutes + u.totalMinutes,
      lateMinutes: acc.lateMinutes + u.lateMinutes,
      earlyLeaveMinutes: acc.earlyLeaveMinutes + u.earlyLeaveMinutes,
    }), { total: 0, onTime: 0, late: 0, earlyLeave: 0, absent: 0, totalMinutes: 0, lateMinutes: 0, earlyLeaveMinutes: 0 });
  }, [userSummary]);

  const exportExcel = () => {
    if (!userSummary.length) { toast.error('Không có dữ liệu'); return; }
    const ws = XLSX.utils.json_to_sheet(userSummary.map(u => ({
      'Nhân viên': u.name,
      'Ngày công': u.total,
      'Đúng giờ': u.onTime,
      'Đi trễ': u.late,
      'Về sớm': u.earlyLeave,
      'Vắng': u.absent,
      'Tổng giờ': `${Math.floor(u.totalMinutes / 60)}h${u.totalMinutes % 60}p`,
      'Phút trễ': u.lateMinutes,
      'Phút về sớm': u.earlyLeaveMinutes,
      'OT (phút)': u.otMinutes,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Báo cáo chấm công');

    // Detail sheet
    const detailData = (records || []).map(r => ({
      'Ngày': r.date,
      'Nhân viên': profiles?.[r.user_id] || r.user_id.slice(0, 8),
      'Trạng thái': r.status === 'on_time' ? 'Đúng giờ' : r.status === 'late' ? 'Đi trễ' : r.status === 'absent' ? 'Vắng' : r.status,
      'Check-in': r.check_in_time ? format(new Date(r.check_in_time), 'HH:mm') : '',
      'Check-out': r.check_out_time ? format(new Date(r.check_out_time), 'HH:mm') : '',
      'Giờ làm (phút)': r.total_work_minutes || 0,
      'Trễ (phút)': r.late_minutes || 0,
      'OT (phút)': r.overtime_minutes || 0,
      'Ca': (r.work_shifts as any)?.name || '',
      'Địa điểm': (r.attendance_locations as any)?.name || '',
    }));
    const ws2 = XLSX.utils.json_to_sheet(detailData);
    XLSX.utils.book_append_sheet(wb, ws2, 'Chi tiết');

    XLSX.writeFile(wb, `BaoCaoCC_${startDate}_${endDate}.xlsx`);
    toast.success('Đã xuất báo cáo Excel');
  };

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(new Date().getFullYear(), i, 1);
    return { value: format(d, 'yyyy-MM'), label: format(d, 'MM/yyyy') };
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Theo tháng</SelectItem>
              <SelectItem value="week">Tuần này</SelectItem>
            </SelectContent>
          </Select>
          {period === 'month' && (
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={exportExcel} className="gap-1 text-xs">
          <Download className="h-3.5 w-3.5" /> Xuất Excel
        </Button>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Card><CardContent className="p-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <div><p className="text-lg font-bold">{totals.total}</p><p className="text-[10px] text-muted-foreground">Lượt chấm công</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-green-600" />
          <div><p className="text-lg font-bold">{totals.onTime}</p><p className="text-[10px] text-muted-foreground">Đúng giờ</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <div><p className="text-lg font-bold">{totals.late}</p><p className="text-[10px] text-muted-foreground">Đi trễ</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-2">
          <LogOut className="h-4 w-4 text-orange-500" />
          <div><p className="text-lg font-bold">{totals.earlyLeave}</p><p className="text-[10px] text-muted-foreground">Về sớm</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <div><p className="text-lg font-bold">{Math.floor(totals.totalMinutes / 60)}h</p><p className="text-[10px] text-muted-foreground">Tổng giờ</p></div>
        </CardContent></Card>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Biểu đồ chấm công theo ngày</CardTitle></CardHeader>
          <CardContent className="p-3">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tickFormatter={v => format(new Date(v), 'dd/MM')} className="text-[10px]" tick={{ fontSize: 10 }} />
                <YAxis className="text-[10px]" tick={{ fontSize: 10 }} />
                <Tooltip labelFormatter={v => format(new Date(v as string), 'dd/MM/yyyy')} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="onTime" name="Đúng giờ" fill="hsl(142, 71%, 45%)" stackId="a" />
                <Bar dataKey="late" name="Đi trễ" fill="hsl(45, 93%, 47%)" stackId="a" />
                <Bar dataKey="earlyLeave" name="Về sớm" fill="hsl(25, 95%, 53%)" stackId="a" />
                <Bar dataKey="absent" name="Vắng" fill="hsl(0, 84%, 60%)" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* User summary table */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Tổng hợp theo nhân viên</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <div className="text-center py-6 text-muted-foreground">Đang tải...</div> : !userSummary.length ? (
            <div className="text-center py-6 text-muted-foreground">Không có dữ liệu</div>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nhân viên</TableHead>
                      <TableHead className="text-center">Ngày công</TableHead>
                      <TableHead className="text-center">Đúng giờ</TableHead>
                      <TableHead className="text-center">Đi trễ</TableHead>
                      <TableHead className="text-center">Về sớm</TableHead>
                      <TableHead className="text-center">Vắng</TableHead>
                      <TableHead className="text-center">Tổng giờ</TableHead>
                      <TableHead className="text-center">Trễ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userSummary.map(u => (
                      <TableRow key={u.userId}>
                        <TableCell className="font-medium">{u.name}</TableCell>
                        <TableCell className="text-center">{u.total}</TableCell>
                        <TableCell className="text-center text-green-600">{u.onTime}</TableCell>
                        <TableCell className="text-center text-yellow-600">{u.late}</TableCell>
                        <TableCell className="text-center text-orange-500">{u.earlyLeave}</TableCell>
                        <TableCell className="text-center text-destructive">{u.absent}</TableCell>
                        <TableCell className="text-center">{Math.floor(u.totalMinutes / 60)}h{u.totalMinutes % 60}p</TableCell>
                        <TableCell className="text-center">{u.lateMinutes > 0 ? <span className="text-yellow-600">{u.lateMinutes}p</span> : '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="md:hidden space-y-2">
                {userSummary.map(u => (
                  <div key={u.userId} className="border rounded-lg p-3 space-y-1">
                    <p className="font-medium text-sm">{u.name}</p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span>{u.total} công</span>
                      <span className="text-green-600">{u.onTime} ĐG</span>
                      <span className="text-yellow-600">{u.late} trễ</span>
                      <span className="text-orange-500">{u.earlyLeave} về sớm</span>
                      <span className="text-destructive">{u.absent} vắng</span>
                      <span>{Math.floor(u.totalMinutes / 60)}h{u.totalMinutes % 60}p</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
