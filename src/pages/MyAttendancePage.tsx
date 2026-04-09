import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { usePlatformUser } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, isSameDay } from 'date-fns';
import { vi } from 'date-fns/locale';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, TrendingUp, ChevronLeft, ChevronRight, CheckCircle2, XCircle, AlertTriangle, DollarSign, Bell, FileText, Briefcase, Banknote } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Separator } from '@/components/ui/separator';
import { SalaryAdvancesTab } from '@/components/payroll/SalaryAdvancesTab';

function formatMoney(n: number) {
  return n.toLocaleString('vi-VN') + 'đ';
}

export default function MyAttendancePage() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: pu } = usePlatformUser();
  const tenantId = pu?.tenant_id;
  const navigate = useNavigate();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const startStr = format(monthStart, 'yyyy-MM-dd');
  const endStr = format(monthEnd, 'yyyy-MM-dd');

  // Attendance records for the month
  const { data: records, isLoading } = useQuery({
    queryKey: ['my-attendance-month', user?.id, startStr, endStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('user_id', user!.id)
        .gte('date', startStr)
        .lte('date', endStr)
        .order('date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Salary config
  const { data: salaryConfig } = useQuery({
    queryKey: ['my-salary-config', user?.id, tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_salary_configs')
        .select('*, salary_templates(name, salary_type, base_amount)')
        .eq('user_id', user!.id)
        .eq('tenant_id', tenantId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && !!tenantId,
  });

  // Today's shift assignment
  const today = format(new Date(), 'yyyy-MM-dd');
  const dayOfWeek = new Date().getDay();
  const { data: todayShift } = useQuery({
    queryKey: ['my-shift-today', user?.id, tenantId, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shift_assignments')
        .select('*, work_shifts(name, start_time, end_time, break_minutes)')
        .eq('user_id', user!.id)
        .eq('tenant_id', tenantId!)
        .eq('is_active', true)
        .or(`specific_date.eq.${today},and(assignment_type.eq.fixed,day_of_week.eq.${dayOfWeek})`)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && !!tenantId,
  });

  // Attendance notifications (from crm_notifications)
  const { data: notifications } = useQuery({
    queryKey: ['my-attendance-notifications', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_notifications')
        .select('*')
        .eq('user_id', user!.id)
        .in('notification_type', ['attendance_late', 'attendance_absent', 'shift_reminder', 'payslip_ready'])
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Payslips (payroll_records for this user)
  const { data: payslips } = useQuery({
    queryKey: ['my-payslips', user?.id, tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_records')
        .select('*, payroll_periods(name, start_date, end_date, status)')
        .eq('user_id', user!.id)
        .eq('tenant_id', tenantId!)
        .order('created_at', { ascending: false })
        .limit(12);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && !!tenantId,
  });

  // Stats
  const stats = useMemo(() => {
    if (!records) return { total: 0, onTime: 0, late: 0, absent: 0, totalMinutes: 0, totalOT: 0, totalLate: 0 };
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd > new Date() ? new Date() : monthEnd });
    const workDays = daysInMonth.filter(d => !isWeekend(d));
    const workedDays = new Set(records.map(r => r.date));
    const absentDays = workDays.filter(d => !workedDays.has(format(d, 'yyyy-MM-dd')) && d <= new Date()).length;

    return {
      total: records.length,
      onTime: records.filter(r => r.status === 'on_time').length,
      late: records.filter(r => r.status === 'late').length,
      absent: absentDays,
      totalMinutes: records.reduce((s, r) => s + (r.total_work_minutes || 0), 0),
      totalOT: records.reduce((s, r) => s + (r.overtime_minutes || 0), 0),
      totalLate: records.reduce((s, r) => s + (r.late_minutes || 0), 0),
    };
  }, [records, monthStart, monthEnd]);

  // Estimated salary
  const estimatedSalary = useMemo(() => {
    if (!salaryConfig) return null;
    const template = salaryConfig.salary_templates as any;
    const baseAmount = salaryConfig.custom_base_amount || template?.base_amount || 0;
    const salaryType = template?.salary_type || 'monthly';

    if (salaryType === 'monthly') {
      const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
      const totalWorkDays = daysInMonth.filter(d => !isWeekend(d)).length;
      const ratio = totalWorkDays > 0 ? stats.total / totalWorkDays : 0;
      return Math.round(baseAmount * ratio);
    }
    if (salaryType === 'daily') return baseAmount * stats.total;
    if (salaryType === 'hourly') return Math.round(baseAmount * (stats.totalMinutes / 60));
    return baseAmount;
  }, [salaryConfig, stats, monthStart, monthEnd]);

  const prevMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));

  const statusBadge = (status: string) => {
    if (status === 'on_time') return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-[10px]">Đúng giờ</Badge>;
    if (status === 'late') return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 text-[10px]">Trễ</Badge>;
    if (status === 'absent') return <Badge variant="destructive" className="text-[10px]">Vắng</Badge>;
    return <Badge variant="secondary" className="text-[10px]">{status}</Badge>;
  };

  const unreadNotifs = notifications?.filter(n => !n.is_read).length || 0;
  const shiftInfo = todayShift?.work_shifts as any;

  return (
    <MainLayout>
      <div className="p-3 sm:p-6 max-w-3xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Công của tôi</h1>
            <p className="text-sm text-muted-foreground">{profile?.display_name || user?.email}</p>
          </div>
          <Button size="sm" onClick={() => navigate('/checkin')} className="gap-1">
            <Clock className="h-4 w-4" /> Chấm công
          </Button>
        </div>

        {/* Today's Shift Info */}
        {shiftInfo && (
          <Card className="border-primary/20">
            <CardContent className="p-3 flex items-center gap-3">
              <Briefcase className="h-5 w-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Ca hôm nay: {shiftInfo.name}</p>
                <p className="text-xs text-muted-foreground">
                  {shiftInfo.start_time?.slice(0, 5)} - {shiftInfo.end_time?.slice(0, 5)}
                  {shiftInfo.break_minutes > 0 && ` (nghỉ ${shiftInfo.break_minutes}p)`}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Month navigator */}
        <div className="flex items-center justify-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[120px] text-center">
            {format(currentMonth, 'MMMM yyyy', { locale: vi })}
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Card>
            <CardContent className="p-3 text-center">
              <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto mb-1" />
              <p className="text-lg font-bold">{stats.total}</p>
              <p className="text-[10px] text-muted-foreground">Ngày công</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <Clock className="h-5 w-5 text-primary mx-auto mb-1" />
              <p className="text-lg font-bold">{stats.onTime}</p>
              <p className="text-[10px] text-muted-foreground">Đúng giờ</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mx-auto mb-1" />
              <p className="text-lg font-bold">{stats.late}</p>
              <p className="text-[10px] text-muted-foreground">Đi trễ</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <XCircle className="h-5 w-5 text-destructive mx-auto mb-1" />
              <p className="text-lg font-bold">{stats.absent}</p>
              <p className="text-[10px] text-muted-foreground">Vắng</p>
            </CardContent>
          </Card>
        </div>

        {/* Estimated Salary Card */}
        {estimatedSalary !== null && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Lương tạm tính</p>
                  <p className="text-xl font-bold text-primary">{formatMoney(estimatedSalary)}</p>
                </div>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <p>{Math.floor(stats.totalMinutes / 60)}h{stats.totalMinutes % 60}p tổng giờ</p>
                {stats.totalOT > 0 && <p className="text-green-600">+{Math.floor(stats.totalOT / 60)}h OT</p>}
                {stats.totalLate > 0 && <p className="text-yellow-600">Trễ {stats.totalLate}p</p>}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="history" className="space-y-3">
          <TabsList className="w-full grid grid-cols-5">
            <TabsTrigger value="history" className="text-xs">
              <Calendar className="h-3.5 w-3.5 mr-1" /> Công
            </TabsTrigger>
            <TabsTrigger value="calendar" className="text-xs">
              <TrendingUp className="h-3.5 w-3.5 mr-1" /> TK
            </TabsTrigger>
            <TabsTrigger value="payslips" className="text-xs">
              <FileText className="h-3.5 w-3.5 mr-1" /> Lương
            </TabsTrigger>
            <TabsTrigger value="advances" className="text-xs">
              <Banknote className="h-3.5 w-3.5 mr-1" /> TƯ
            </TabsTrigger>
            <TabsTrigger value="notifications" className="text-xs relative">
              <Bell className="h-3.5 w-3.5 mr-1" /> TB
              {unreadNotifs > 0 && (
                <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-4 h-4 text-[9px] flex items-center justify-center">
                  {unreadNotifs}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-2">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Đang tải...</div>
            ) : !records?.length ? (
              <div className="text-center py-8 text-muted-foreground">Chưa có dữ liệu chấm công tháng này</div>
            ) : (
              records.map(r => (
                <Card key={r.id}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">
                        {format(new Date(r.date), 'EEEE, dd/MM', { locale: vi })}
                      </span>
                      {statusBadge(r.status)}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Vào: {r.check_in_time ? format(new Date(r.check_in_time), 'HH:mm') : '--'}</span>
                      <span>Ra: {r.check_out_time ? format(new Date(r.check_out_time), 'HH:mm') : '--'}</span>
                      {r.total_work_minutes != null && (
                        <span className="text-foreground font-medium">
                          {Math.floor(r.total_work_minutes / 60)}h{r.total_work_minutes % 60}p
                        </span>
                      )}
                      {(r.late_minutes ?? 0) > 0 && (
                        <span className="text-yellow-600">Trễ {r.late_minutes}p</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Stats Tab */}
          <TabsContent value="calendar" className="space-y-3">
            <Card>
              <CardHeader className="p-3 pb-1">
                <CardTitle className="text-sm">Bảng chấm công tháng</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <MiniCalendar month={currentMonth} records={records || []} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-3 pb-1">
                <CardTitle className="text-sm">Chi tiết giờ làm</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-2 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tổng giờ làm</span>
                  <span className="font-medium">{Math.floor(stats.totalMinutes / 60)}h {stats.totalMinutes % 60}p</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tăng ca</span>
                  <span className="font-medium text-green-600">{Math.floor(stats.totalOT / 60)}h {stats.totalOT % 60}p</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tổng trễ</span>
                  <span className="font-medium text-yellow-600">{stats.totalLate}p</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Trung bình/ngày</span>
                  <span className="font-medium">
                    {stats.total > 0 ? `${Math.floor(stats.totalMinutes / stats.total / 60)}h ${Math.round(stats.totalMinutes / stats.total % 60)}p` : '--'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payslips Tab */}
          <TabsContent value="payslips" className="space-y-2">
            {!payslips?.length ? (
              <div className="text-center py-8 text-muted-foreground">Chưa có phiếu lương</div>
            ) : (
              payslips.map(ps => {
                const period = ps.payroll_periods as any;
                return (
                  <Card key={ps.id}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{period?.name || 'Kỳ lương'}</span>
                        <Badge variant={ps.status === 'paid' ? 'default' : 'secondary'} className="text-[10px]">
                          {ps.status === 'paid' ? 'Đã trả' : ps.status === 'approved' ? 'Đã duyệt' : ps.status === 'draft' ? 'Nháp' : ps.status}
                        </Badge>
                      </div>
                      {period && (
                        <p className="text-[10px] text-muted-foreground mb-2">
                          {format(new Date(period.start_date), 'dd/MM/yyyy')} - {format(new Date(period.end_date), 'dd/MM/yyyy')}
                        </p>
                      )}
                      <Separator className="my-2" />
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-muted-foreground">Lương cơ bản</p>
                          <p className="font-medium">{formatMoney(Number(ps.base_salary || 0))}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Ngày công</p>
                          <p className="font-medium">{ps.total_work_days || 0} ngày</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Phụ cấp</p>
                          <p className="font-medium text-green-600">+{formatMoney(Number(ps.total_allowance || 0))}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Hoa hồng</p>
                          <p className="font-medium text-green-600">+{formatMoney(Number(ps.total_commission || 0))}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Thưởng</p>
                          <p className="font-medium text-green-600">+{formatMoney(Number(ps.total_bonus || 0))}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Khấu trừ</p>
                          <p className="font-medium text-destructive">-{formatMoney(Number(ps.total_deduction || 0))}</p>
                        </div>
                      </div>
                      <Separator className="my-2" />
                      <div className="flex justify-between text-sm">
                        <span className="font-semibold">Thực nhận</span>
                        <span className="font-bold text-primary">{formatMoney(Number(ps.net_salary || 0))}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* Advances Tab */}
          <TabsContent value="advances">
            <SalaryAdvancesTab mode="employee" />
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-2">
            {!notifications?.length ? (
              <div className="text-center py-8 text-muted-foreground">Không có thông báo</div>
            ) : (
              notifications.map(n => (
                <Card key={n.id} className={!n.is_read ? 'border-primary/30 bg-primary/5' : ''}>
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <NotifIcon type={n.notification_type} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{n.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {format(new Date(n.created_at), 'HH:mm dd/MM/yyyy')}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

function NotifIcon({ type }: { type: string }) {
  if (type === 'attendance_late') return <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />;
  if (type === 'attendance_absent') return <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />;
  if (type === 'shift_reminder') return <Clock className="h-4 w-4 text-primary mt-0.5 shrink-0" />;
  if (type === 'payslip_ready') return <DollarSign className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />;
  return <Bell className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />;
}

// Mini calendar component
function MiniCalendar({ month, records }: { month: Date; records: any[] }) {
  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const startDay = startOfMonth(month).getDay();
  const recordMap = new Map(records.map(r => [r.date, r]));
  const today = new Date();

  const dayLabels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

  return (
    <div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] text-muted-foreground mb-1">
        {dayLabels.map(d => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: startDay }).map((_, i) => <div key={`e-${i}`} />)}
        {days.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const rec = recordMap.get(dateStr);
          const isToday = isSameDay(day, today);
          const isFuture = day > today;

          let bg = 'bg-muted/30';
          if (rec?.status === 'on_time') bg = 'bg-green-100 dark:bg-green-900/40';
          else if (rec?.status === 'late') bg = 'bg-yellow-100 dark:bg-yellow-900/40';
          else if (!isFuture && !isWeekend(day) && day <= today) bg = 'bg-red-50 dark:bg-red-900/20';

          return (
            <div
              key={dateStr}
              className={`aspect-square flex items-center justify-center text-[11px] rounded ${bg} ${isToday ? 'ring-1 ring-primary font-bold' : ''} ${isWeekend(day) ? 'text-muted-foreground/50' : ''}`}
            >
              {day.getDate()}
            </div>
          );
        })}
      </div>
      <div className="flex gap-3 mt-2 text-[10px] text-muted-foreground justify-center">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-green-200" /> Đúng giờ</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-yellow-200" /> Trễ</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-100" /> Vắng</span>
      </div>
    </div>
  );
}
