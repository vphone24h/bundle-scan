import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { usePlatformUser } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, isSameDay } from 'date-fns';
import { vi } from 'date-fns/locale';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, TrendingUp, ChevronLeft, ChevronRight, CheckCircle2, XCircle, AlertTriangle, DollarSign, Bell, FileText, Briefcase, Banknote, FileEdit, CalendarDays, ShoppingBag, CalendarOff } from 'lucide-react';
import { Target, Trophy, Flame } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useNavigate } from 'react-router-dom';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { SalaryAdvancesTab } from '@/components/payroll/SalaryAdvancesTab';
import { EmployeeLeaveRequests } from '@/components/attendance/EmployeeLeaveRequests';
import { IncomeBoardTab } from '@/components/attendance/IncomeBoardTab';
import { useMutation, useQueryClient } from '@tanstack/react-query';

function formatMoney(n: number) {
  return n.toLocaleString('vi-VN') + 'đ';
}

export default function MyAttendancePage() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: pu } = usePlatformUser();
  const tenantId = pu?.tenant_id;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showSalesDialog, setShowSalesDialog] = useState(false);
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState<string>('income');
  const [statDetail, setStatDetail] = useState<null | 'total' | 'onTime' | 'late' | 'earlyLeave' | 'absent'>(null);

  const { data: expandedItems, isLoading: itemsLoading } = useQuery({
    queryKey: ['my-sale-items', expandedSaleId],
    queryFn: async () => {
      if (!expandedSaleId) return [];
      const { data, error } = await supabase
        .from('export_receipt_items')
        .select('id, product_name, sku, imei, sale_price, quantity, unit')
        .eq('receipt_id', expandedSaleId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!expandedSaleId,
  });

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

  // Sales data for the month
  const { data: mySales } = useQuery({
    queryKey: ['my-sales-month', user?.id, tenantId, startStr, endStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('export_receipts')
        .select('id, code, total_amount, export_date, status, customers(name, phone), branches(name)')
        .eq('tenant_id', tenantId!)
        .eq('sales_staff_id', user!.id)
        .gte('created_at', startStr)
        .lte('created_at', endStr + 'T23:59:59')
        .in('status', ['completed', 'paid'])
        .order('export_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && !!tenantId,
  });

  const totalSalesRevenue = useMemo(() => {
    return (mySales || []).reduce((s, r) => s + (r.total_amount || 0), 0);
  }, [mySales]);

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

  // All shift assignments for calendar view
  const { data: allShiftAssignments } = useQuery({
    queryKey: ['my-shift-assignments', user?.id, tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shift_assignments')
        .select('*, work_shifts(name, start_time, end_time, color)')
        .eq('user_id', user!.id)
        .eq('tenant_id', tenantId!)
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
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
    if (!records) return { total: 0, onTime: 0, late: 0, absent: 0, totalMinutes: 0, totalOT: 0, totalLate: 0, totalEarlyLeave: 0, earlyLeaveCount: 0 };
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
      totalEarlyLeave: records.reduce((s, r) => s + (r.early_leave_minutes || 0), 0),
      earlyLeaveCount: records.filter(r => (r.early_leave_minutes || 0) > 0).length,
    };
  }, [records, monthStart, monthEnd]);

  // Approved leave requests for this user in current month (late_arrival, early_leave, full-day leave)
  const { data: myExcuses } = useQuery({
    queryKey: ['my-approved-excuses', user?.id, startStr, endStr],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('leave_requests')
        .select('id, leave_date_from, leave_date_to, request_type, reason, time_minutes')
        .eq('user_id', user!.id)
        .eq('status', 'approved')
        .lte('leave_date_from', endStr)
        .gte('leave_date_to', startStr);
      return data || [];
    },
  });

  // Build a Map: `${date}_${type}` -> excuse
  const excuseMap = useMemo(() => {
    const map = new Map<string, any>();
    for (const r of myExcuses || []) {
      const from = new Date(r.leave_date_from);
      const to = new Date(r.leave_date_to);
      for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
        const ds = format(d, 'yyyy-MM-dd');
        map.set(`${ds}_${r.request_type}`, r);
      }
    }
    return map;
  }, [myExcuses]);

  const getExcuse = (date: string, kind: 'late_arrival' | 'early_leave' | 'leave' | 'sick_leave' | 'personal_leave') =>
    excuseMap.get(`${date}_${kind}`);

  // Has any approved late excuse this month? -> show banner
  const hasApprovedLateThisMonth = useMemo(() => {
    return (records || []).some((r: any) => r.late_minutes > 0 && getExcuse(r.date, 'late_arrival'));
  }, [records, excuseMap]);

  // Build details for popup
  const statDetailData = useMemo(() => {
    if (!records) return [] as any[];
    if (statDetail === 'total') {
      return [...records].sort((a: any, b: any) => a.date.localeCompare(b.date));
    }
    if (statDetail === 'onTime') return records.filter((r: any) => r.status === 'on_time').sort((a: any, b: any) => a.date.localeCompare(b.date));
    if (statDetail === 'late') return records.filter((r: any) => (r.late_minutes || 0) > 0).sort((a: any, b: any) => a.date.localeCompare(b.date));
    if (statDetail === 'earlyLeave') return records.filter((r: any) => (r.early_leave_minutes || 0) > 0).sort((a: any, b: any) => a.date.localeCompare(b.date));
    if (statDetail === 'absent') {
      const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd > new Date() ? new Date() : monthEnd });
      const workDays = daysInMonth.filter(d => !isWeekend(d));
      const workedDays = new Set((records || []).map((r: any) => r.date));
      return workDays
        .filter(d => !workedDays.has(format(d, 'yyyy-MM-dd')) && d <= new Date())
        .map(d => ({ date: format(d, 'yyyy-MM-dd'), _absent: true }));
    }
    return [];
  }, [records, statDetail, monthStart, monthEnd]);

  const statDetailTitle = ({
    total: 'Chi tiết ngày công',
    onTime: 'Chi tiết ngày đúng giờ',
    late: 'Chi tiết ngày đi trễ',
    earlyLeave: 'Chi tiết ngày về sớm',
    absent: 'Chi tiết ngày vắng',
  } as Record<string, string>)[statDetail || 'total'];

  // Estimated salary
  const estimatedSalaryFallback = useMemo(() => {
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

  // Đồng bộ "Lương tạm tính" với engine preview-payroll (giống tab "Bảng thu nhập realtime")
  const { data: previewPayroll } = useQuery({
    queryKey: ['preview-payroll', user?.id, tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('preview-payroll', {
        body: { tenant_id: tenantId, user_id: user!.id },
      });
      if (error) throw error;
      if (data?.error || !data?.success) return null;
      return data;
    },
    enabled: !!user?.id && !!tenantId,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const estimatedSalary = (() => {
    const rec = previewPayroll?.record;
    if (rec?.net_salary == null) return estimatedSalaryFallback;
    // Ẩn phạt KPI trước ngày 25 — đồng bộ với tab "Bảng thu nhập realtime"
    const isAfterDay25 = new Date().getDate() >= 25;
    const hiddenKpi = (rec.penalty_details || [])
      .filter((p: any) => {
        const isKpi = p.type === 'kpi_not_met' || /kpi/i.test(String(p.name || ''));
        return isKpi && !isAfterDay25;
      })
      .reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    return Math.round(Number(rec.net_salary) + hiddenKpi);
  })();

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

  // Mark notifications as read when user opens the notifications tab
  const markNotificationsRead = async (tabValue: string) => {
    if (tabValue !== 'notifications' || !user?.id || unreadNotifs === 0) return;
    const unreadIds = (notifications || []).filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;
    const { error } = await supabase
      .from('crm_notifications')
      .update({ is_read: true })
      .in('id', unreadIds);
    if (!error) {
      qc.invalidateQueries({ queryKey: ['my-attendance-notifications', user.id] });
    }
  };

  useEffect(() => {
    if (!user?.id || !tenantId) return;

    const channel = supabase
      .channel(`my-attendance-sync-${tenantId}-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance_records',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ['my-attendance-month'] });
          qc.invalidateQueries({ queryKey: ['my-attendance-today'] });
          qc.invalidateQueries({ queryKey: ['attendance-records'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance_correction_requests',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ['my-correction-requests'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, user?.id, qc]);

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

        {/* Excused-late banner */}
        {hasApprovedLateThisMonth && (
          <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 px-3 py-2 text-xs text-green-800 dark:text-green-300 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Đi trễ đã được phép, không trừ lương. Bấm vào ô "Đi trễ" để xem chi tiết.</span>
          </div>
        )}

        {/* Summary Cards (clickable) */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          <Card role="button" onClick={() => setStatDetail('total')} className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]">
            <CardContent className="p-3 text-center">
              <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto mb-1" />
              <p className="text-lg font-bold">{stats.total}</p>
              <p className="text-[10px] text-muted-foreground">Ngày công</p>
            </CardContent>
          </Card>
          <Card role="button" onClick={() => setStatDetail('onTime')} className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]">
            <CardContent className="p-3 text-center">
              <Clock className="h-5 w-5 text-primary mx-auto mb-1" />
              <p className="text-lg font-bold">{stats.onTime}</p>
              <p className="text-[10px] text-muted-foreground">Đúng giờ</p>
            </CardContent>
          </Card>
          <Card role="button" onClick={() => setStatDetail('late')} className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]">
            <CardContent className="p-3 text-center">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mx-auto mb-1" />
              <p className="text-lg font-bold">{stats.late}</p>
              <p className="text-[10px] text-muted-foreground">Đi trễ</p>
            </CardContent>
          </Card>
          <Card role="button" onClick={() => setStatDetail('earlyLeave')} className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]">
            <CardContent className="p-3 text-center">
              <Clock className="h-5 w-5 text-orange-500 mx-auto mb-1" />
              <p className="text-lg font-bold">{stats.earlyLeaveCount}</p>
              <p className="text-[10px] text-muted-foreground">Về sớm</p>
            </CardContent>
          </Card>
          <Card role="button" onClick={() => setStatDetail('absent')} className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]">
            <CardContent className="p-3 text-center">
              <XCircle className="h-5 w-5 text-destructive mx-auto mb-1" />
              <p className="text-lg font-bold">{stats.absent}</p>
              <p className="text-[10px] text-muted-foreground">Vắng</p>
            </CardContent>
          </Card>
        </div>

        {/* Stat Detail Dialog */}
        <Dialog open={!!statDetail} onOpenChange={(v) => !v && setStatDetail(null)}>
          <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{statDetailTitle} — {format(currentMonth, 'MM/yyyy')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              {statDetailData.length === 0 ? (
                <p className="text-center py-6 text-sm text-muted-foreground">Không có dữ liệu</p>
              ) : statDetailData.map((r: any, idx: number) => {
                const dateStr = format(new Date(r.date), 'EEEE, dd/MM/yyyy', { locale: vi });
                if (r._absent) {
                  const ex = getExcuse(r.date, 'leave') || getExcuse(r.date, 'sick_leave') || getExcuse(r.date, 'personal_leave');
                  return (
                    <div key={idx} className="rounded-md border p-2.5 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium capitalize">{dateStr}</span>
                        {ex ? (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-[10px]">Có phép</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px]">Không phép</Badge>
                        )}
                      </div>
                      {ex?.reason && <p className="text-xs text-muted-foreground mt-1">Lý do: {ex.reason}</p>}
                    </div>
                  );
                }
                const lateExcuse = (r.late_minutes || 0) > 0 ? getExcuse(r.date, 'late_arrival') : null;
                const earlyExcuse = (r.early_leave_minutes || 0) > 0 ? getExcuse(r.date, 'early_leave') : null;
                const checkIn = r.check_in_time ? format(new Date(r.check_in_time), 'HH:mm') : '--:--';
                const checkOut = r.check_out_time ? format(new Date(r.check_out_time), 'HH:mm') : '--:--';
                return (
                  <div key={idx} className="rounded-md border p-2.5 text-sm space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium capitalize">{dateStr}</span>
                      {statusBadge(r.status)}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                      <span>Vào: <span className="text-foreground font-medium">{checkIn}</span></span>
                      <span>Ra: <span className="text-foreground font-medium">{checkOut}</span></span>
                      {r.total_work_minutes > 0 && (
                        <span>Tổng: <span className="text-foreground font-medium">{Math.floor(r.total_work_minutes / 60)}h{r.total_work_minutes % 60}p</span></span>
                      )}
                    </div>
                    {(r.late_minutes || 0) > 0 && (
                      <div className="flex items-center gap-2 text-xs flex-wrap">
                        <span className={lateExcuse ? 'text-muted-foreground line-through' : 'text-yellow-700 dark:text-yellow-400'}>
                          Trễ {r.late_minutes}p
                        </span>
                        {lateExcuse ? (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-[10px]">Có phép · không phạt</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px]">Không phép</Badge>
                        )}
                      </div>
                    )}
                    {lateExcuse?.reason && (
                      <p className="text-[11px] text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 rounded px-2 py-1">
                        Lý do trễ: {lateExcuse.reason}
                      </p>
                    )}
                    {(r.early_leave_minutes || 0) > 0 && (
                      <div className="flex items-center gap-2 text-xs flex-wrap">
                        <span className={earlyExcuse ? 'text-muted-foreground line-through' : 'text-orange-700 dark:text-orange-400'}>
                          Về sớm {r.early_leave_minutes}p (ra lúc {checkOut})
                        </span>
                        {earlyExcuse ? (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-[10px]">Có phép · không phạt</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px]">Không phép</Badge>
                        )}
                      </div>
                    )}
                    {earlyExcuse?.reason && (
                      <p className="text-[11px] text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 rounded px-2 py-1">
                        Lý do về sớm: {earlyExcuse.reason}
                      </p>
                    )}
                    {r.note && <p className="text-[11px] text-muted-foreground italic">Ghi chú: {r.note}</p>}
                  </div>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>

        {/* Sales Revenue Card */}
        <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setShowSalesDialog(true)}>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShoppingBag className="h-8 w-8 text-green-600 dark:text-green-400" />
              <div>
                <p className="text-xs text-muted-foreground">Doanh số tháng này</p>
                <p className="text-xl font-bold text-green-700 dark:text-green-300">{formatMoney(totalSalesRevenue)}</p>
              </div>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p>{mySales?.length || 0} đơn hàng</p>
              <p className="text-green-600 underline">Xem chi tiết →</p>
            </div>
          </CardContent>
        </Card>

        {/* Sales Detail Dialog */}
        <Dialog open={showSalesDialog} onOpenChange={setShowSalesDialog}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5" />
                Doanh số {format(currentMonth, 'MM/yyyy')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-1">
              <div className="flex justify-between text-sm font-semibold p-2 bg-muted rounded">
                <span>Tổng: {mySales?.length || 0} đơn</span>
                <span className="text-green-700 dark:text-green-300">{formatMoney(totalSalesRevenue)}</span>
              </div>
              {mySales?.length === 0 ? (
                <p className="text-center py-6 text-muted-foreground text-sm">Chưa có đơn hàng trong tháng này</p>
              ) : (
                mySales?.map(sale => (
                  <Card key={sale.id} className="shadow-none">
                    <CardContent className="p-3">
                      <button
                        type="button"
                        onClick={() => setExpandedSaleId(expandedSaleId === sale.id ? null : sale.id)}
                        className="w-full text-left"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-primary underline-offset-2 hover:underline">
                            {(sale as any).code || sale.id.slice(0, 8)}
                          </span>
                          <span className="text-sm font-bold text-green-700 dark:text-green-300">
                            {formatMoney(sale.total_amount || 0)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{format(new Date(sale.export_date), 'dd/MM HH:mm')}</span>
                          {(sale.customers as any)?.name && (
                            <span>KH: {(sale.customers as any).name}</span>
                          )}
                          {(sale.branches as any)?.name && (
                            <Badge variant="outline" className="text-[10px] h-4">{(sale.branches as any).name}</Badge>
                          )}
                        </div>
                      </button>
                      {expandedSaleId === sale.id && (
                        <div className="mt-2 pt-2 border-t space-y-1">
                          {itemsLoading ? (
                            <p className="text-xs text-muted-foreground">Đang tải sản phẩm...</p>
                          ) : expandedItems && expandedItems.length > 0 ? (
                            expandedItems.map((it: any) => (
                              <div key={it.id} className="flex items-start justify-between gap-2 text-xs">
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium truncate">{it.product_name}</p>
                                  <p className="text-muted-foreground text-[10px]">
                                    {it.imei ? `IMEI: ${it.imei}` : `SKU: ${it.sku}`} · SL: {Number(it.quantity || 1)} {it.unit || ''}
                                  </p>
                                </div>
                                <span className="text-green-700 dark:text-green-300 font-medium tabular-nums shrink-0">
                                  {formatMoney(Number(it.sale_price || 0) * Number(it.quantity || 1))}
                                </span>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-muted-foreground">Không có sản phẩm</p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* KPI Progress Card — chạm để mở "Tăng thêm lương" */}
        {(() => {
          const rec = previewPayroll?.record;
          const cs = rec?.config_snapshot || {};
          // Lấy từ kpi_bonuses_all (có cả KPI chưa đạt). Fallback bonus_details (đã đạt).
          const allKpis = (cs.kpi_bonuses_all && cs.kpi_bonuses_all.length > 0)
            ? cs.kpi_bonuses_all
            : (rec?.bonus_details || []).filter((b: any) =>
                ['kpi_personal','kpi_branch','branch_revenue','gross_profit'].includes(b.type)
              );
          const kpiList = (allKpis as any[])
            .filter((b: any) => Number(b.threshold || 0) > 0)
            .map((b: any) => {
              const t = b.type;
              const isBranch = t === 'kpi_branch' || t === 'branch_revenue';
              const isGP = t === 'gross_profit';
              const current = b.current != null
                ? Number(b.current)
                : isBranch ? Number(cs.branch_revenue || 0)
                  : isGP ? Number(cs.user_gross_profit || 0)
                  : Number(cs.user_revenue || 0);
              const target = Number(b.threshold || 0);
              const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
              return {
                name: b.name || (isBranch ? 'KPI chi nhánh' : isGP ? 'Lợi nhuận gộp' : 'KPI cá nhân'),
                kind: isBranch ? 'branch' : isGP ? 'gp' : 'personal',
                current, target, pct,
                reward: Number(b.reach_reward || b.amount || 0),
              };
            });

          if (kpiList.length === 0) return null;

          const goBoost = () => {
            setTabValue('income');
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('open-boost-salary'));
              const el = document.getElementById('income-tab-anchor');
              el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
          };

          return (
            <Card
              className="border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50/60 to-orange-50/40 dark:from-amber-950/20 dark:to-orange-950/20 cursor-pointer hover:shadow-md transition-shadow"
              onClick={goBoost}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') goBoost(); }}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-amber-600" />
                    <p className="text-sm font-bold">Tiến độ KPI</p>
                    <Badge variant="outline" className="h-5 text-[10px]">{kpiList.length} KPI</Badge>
                  </div>
                  <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300 flex items-center gap-0.5">
                    <Flame className="h-3 w-3" /> Tăng thêm lương <ChevronRight className="h-3 w-3" />
                  </span>
                </div>

                <div className="space-y-2.5">
                  {kpiList.map((k, idx) => {
                    const colorText = k.pct >= 100
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : k.pct >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-orange-600 dark:text-orange-400';
                    const colorBar = k.pct >= 100
                      ? '[&>div]:bg-emerald-500'
                      : k.pct >= 50 ? '[&>div]:bg-amber-500' : '[&>div]:bg-orange-500';
                    return (
                      <div key={idx}>
                        <div className="flex items-baseline justify-between gap-2 mb-1">
                          <span className="text-xs font-medium truncate flex items-center gap-1">
                            <Target className="h-3 w-3 text-muted-foreground shrink-0" />
                            {k.name}
                          </span>
                          <span className={`text-base font-extrabold tabular-nums ${colorText}`}>
                            {k.pct}%
                          </span>
                        </div>
                        <Progress value={k.pct} className={`h-2.5 ${colorBar}`} />
                        <div className="flex justify-between text-[10px] mt-0.5">
                          <span className="text-muted-foreground tabular-nums">
                            {formatMoney(k.current)} / <span className="font-semibold text-foreground">{formatMoney(k.target)}</span>
                          </span>
                          {k.reward > 0 && (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">+{formatMoney(k.reward)}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })()}

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
                {stats.totalEarlyLeave > 0 && <p className="text-orange-500">Sớm {stats.totalEarlyLeave}p</p>}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs
          value={tabValue}
          onValueChange={(v) => { setTabValue(v); void markNotificationsRead(v); }}
          className="space-y-3"
        >
          <TabsList className="w-full grid grid-cols-9">
            <TabsTrigger value="income" className="text-xs px-1">
              <DollarSign className="h-3.5 w-3.5 sm:mr-1" /><span className="hidden sm:inline">TN</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs px-1">
              <Calendar className="h-3.5 w-3.5 sm:mr-1" /><span className="hidden sm:inline">Công</span>
            </TabsTrigger>
            <TabsTrigger value="calendar" className="text-xs px-1">
              <TrendingUp className="h-3.5 w-3.5 sm:mr-1" /><span className="hidden sm:inline">TK</span>
            </TabsTrigger>
            <TabsTrigger value="schedule" className="text-xs px-1">
              <CalendarDays className="h-3.5 w-3.5 sm:mr-1" /><span className="hidden sm:inline">Lịch</span>
            </TabsTrigger>
            <TabsTrigger value="leave" className="text-xs px-1">
              <CalendarOff className="h-3.5 w-3.5 sm:mr-1" /><span className="hidden sm:inline">Nghỉ</span>
            </TabsTrigger>
            <TabsTrigger value="corrections" className="text-xs px-1">
              <FileEdit className="h-3.5 w-3.5 sm:mr-1" /><span className="hidden sm:inline">SC</span>
            </TabsTrigger>
            <TabsTrigger value="payslips" className="text-xs px-1">
              <FileText className="h-3.5 w-3.5 sm:mr-1" /><span className="hidden sm:inline">Lương</span>
            </TabsTrigger>
            <TabsTrigger value="advances" className="text-xs px-1">
              <Banknote className="h-3.5 w-3.5 sm:mr-1" /><span className="hidden sm:inline">TƯ</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="text-xs px-1 relative">
              <Bell className="h-3.5 w-3.5 sm:mr-1" /><span className="hidden sm:inline">TB</span>
              {unreadNotifs > 0 && (
                <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-4 h-4 text-[9px] flex items-center justify-center">
                  {unreadNotifs}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Income Board Tab */}
          <TabsContent value="income">
            <div id="income-tab-anchor" />
            <IncomeBoardTab />
          </TabsContent>

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

          {/* Correction Requests Tab */}
          {/* Schedule Tab - Employee Shift Calendar */}
          <TabsContent value="schedule" className="space-y-3">
            <Card>
              <CardHeader className="p-3 pb-1">
                <CardTitle className="text-sm">Lịch ca làm việc</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <EmployeeShiftCalendar month={currentMonth} assignments={allShiftAssignments || []} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Leave Requests Tab */}
          <TabsContent value="leave">
            <EmployeeLeaveRequests userId={user?.id} tenantId={tenantId} />
          </TabsContent>

          {/* Correction Requests Tab */}
          <TabsContent value="corrections">
            <EmployeeCorrectionRequests userId={user?.id} tenantId={tenantId} />
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
                  <span className="text-muted-foreground">Tổng về sớm</span>
                  <span className="font-medium text-orange-500">{stats.totalEarlyLeave}p</span>
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

// Employee correction requests component
function EmployeeCorrectionRequests({ userId, tenantId }: { userId?: string; tenantId?: string | null }) {
  const [showForm, setShowForm] = useState(false);
  // Mặc định ngày hôm qua — không cho sửa hôm nay vì chưa hết ca
  const yesterdayStr = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');
  const [requestDate, setRequestDate] = useState(yesterdayStr);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [reason, setReason] = useState('');
  const qc = useQueryClient();

  const { data: myRequests, isLoading } = useQuery({
    queryKey: ['my-correction-requests', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_correction_requests')
        .select('*')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
    refetchInterval: 10000,
    staleTime: 5000,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      // Chặn sửa công cho hôm nay hoặc tương lai
      if (requestDate >= format(new Date(), 'yyyy-MM-dd')) {
        throw new Error('Chỉ được sửa công từ hôm qua trở về trước');
      }
      const { error } = await supabase.from('attendance_correction_requests').insert({
        tenant_id: tenantId!,
        user_id: userId!,
        request_date: requestDate,
        requested_check_in: checkIn ? `${requestDate}T${checkIn}:00+07:00` : null,
        requested_check_out: checkOut ? `${requestDate}T${checkOut}:00+07:00` : null,
        reason,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-correction-requests'] });
      toast.success('Đã gửi yêu cầu sửa công');
      setShowForm(false);
      setCheckIn(''); setCheckOut(''); setReason('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMap: Record<string, { label: string; class: string }> = {
    pending: { label: 'Chờ duyệt', class: 'bg-yellow-100 text-yellow-800' },
    approved: { label: 'Đã duyệt', class: 'bg-green-100 text-green-800' },
    rejected: { label: 'Từ chối', class: 'bg-red-100 text-red-800' },
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Yêu cầu sửa công</h3>
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1 text-xs h-7">
              <FileEdit className="h-3 w-3" /> Tạo yêu cầu
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Yêu cầu sửa công</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Ngày cần sửa</Label>
                <Input
                  type="date"
                  value={requestDate}
                  max={yesterdayStr}
                  onChange={e => setRequestDate(e.target.value)}
                  className="h-8 text-sm"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Chỉ được sửa công từ hôm qua trở về trước. Hôm nay chưa hết ca, dùng tab "Nghỉ" để xin trễ/về sớm.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Check-in đúng</Label>
                  <Input type="time" value={checkIn} onChange={e => setCheckIn(e.target.value)} className="h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Check-out đúng</Label>
                  <Input type="time" value={checkOut} onChange={e => setCheckOut(e.target.value)} className="h-8 text-sm" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Lý do</Label>
                <Textarea placeholder="Nhập lý do sửa công..." value={reason} onChange={e => setReason(e.target.value)} className="text-sm" />
              </div>
            </div>
            <DialogFooter>
              <Button size="sm" onClick={() => createMutation.mutate()} disabled={!reason.trim() || createMutation.isPending}>
                Gửi yêu cầu
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-6 text-muted-foreground text-sm">Đang tải...</div>
      ) : !myRequests?.length ? (
        <div className="text-center py-6 text-muted-foreground text-sm">Chưa có yêu cầu sửa công</div>
      ) : (
        myRequests.map(r => {
          const st = statusMap[r.status] || statusMap.pending;
          return (
            <Card key={r.id}>
              <CardContent className="p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{format(new Date(r.request_date), 'dd/MM/yyyy')}</span>
                  <Badge className={`text-[10px] ${st.class}`}>{st.label}</Badge>
                </div>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  {r.requested_check_in && <span>Vào: {format(new Date(r.requested_check_in), 'HH:mm')}</span>}
                  {r.requested_check_out && <span>Ra: {format(new Date(r.requested_check_out), 'HH:mm')}</span>}
                </div>
                <p className="text-xs text-muted-foreground">{r.reason}</p>
                {r.review_note && <p className="text-xs italic text-muted-foreground">Phản hồi: {r.review_note}</p>}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

// Employee shift calendar showing assigned shifts
function EmployeeShiftCalendar({ month, assignments }: { month: Date; assignments: any[] }) {
  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const startDay = startOfMonth(month).getDay();
  const today = new Date();
  const dayLabels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

  // Build map: dateStr -> shift info
  const shiftMap = new Map<string, any>();
  for (const a of assignments) {
    const ws = a.work_shifts as any;
    if (!ws) continue;
    if (a.assignment_type === 'fixed' && a.day_of_week != null) {
      // Fixed assignment: apply to all matching days in month
      for (const day of days) {
        if (day.getDay() === a.day_of_week) {
          shiftMap.set(format(day, 'yyyy-MM-dd'), ws);
        }
      }
    } else if (a.specific_date) {
      shiftMap.set(a.specific_date, ws);
    }
  }

  return (
    <div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] text-muted-foreground mb-1">
        {dayLabels.map(d => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: startDay }).map((_, i) => <div key={`e-${i}`} />)}
        {days.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const shift = shiftMap.get(dateStr);
          const isToday = isSameDay(day, today);

          return (
            <div
              key={dateStr}
              className={`min-h-[44px] flex flex-col items-center justify-center rounded text-[10px] p-0.5 ${isToday ? 'ring-1 ring-primary font-bold' : ''} ${isWeekend(day) ? 'bg-muted/20 text-muted-foreground/50' : shift ? 'bg-primary/10' : 'bg-muted/30'}`}
            >
              <span>{day.getDate()}</span>
              {shift && (
                <span className="text-[8px] text-primary font-medium truncate max-w-full leading-tight mt-0.5">
                  {shift.name}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {assignments.length === 0 && (
        <p className="text-center text-xs text-muted-foreground mt-3">Chưa có lịch ca nào được gán</p>
      )}
    </div>
  );
}
