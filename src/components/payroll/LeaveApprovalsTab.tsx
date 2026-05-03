import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePlatformUser, useCurrentTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Search, CheckCircle, XCircle, Clock, CalendarOff, AlertTriangle, LogIn, LogOut, UserX, Bot, User } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { format, parseISO, eachDayOfInterval, differenceInCalendarDays, startOfMonth, endOfMonth } from 'date-fns';
import { useSecurityPasswordStatus, useSecurityUnlock } from '@/hooks/useSecurityPassword';
import { SecurityPasswordDialog } from '@/components/security/SecurityPasswordDialog';

// Format ISO time → "HH:mm" theo giờ VN (UTC+7).
function fmtTimeVN(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  const vn = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  const hh = String(vn.getUTCHours()).padStart(2, '0');
  const mm = String(vn.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}
function fmtMins(mins: number) {
  const sign = mins < 0 ? '-' : '';
  const m = Math.abs(mins);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h && r) return `${sign}${h}h${r}p`;
  if (h) return `${sign}${h}h`;
  return `${sign}${r}p`;
}

function useTenantId() {
  const { data: pu } = usePlatformUser();
  const { data: ct } = useCurrentTenant();
  return ct?.id || pu?.tenant_id;
}

export function LeaveApprovalsTab() {
  const tenantId = useTenantId();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [reviewDialog, setReviewDialog] = useState<any>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [deductSalary, setDeductSalary] = useState(false);
  const { data: hasSecurityPassword } = useSecurityPasswordStatus();
  const { unlocked, unlock } = useSecurityUnlock('leave-approval-review');
  const [showPwd, setShowPwd] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ ids: string[]; action: 'approved' | 'unexcused' | 'rejected'; note: string; deduct?: boolean } | null>(null);

  const { data: requests, isLoading } = useQuery({
    queryKey: ['leave-requests-admin', tenantId, filterStatus],
    queryFn: async () => {
      let q = supabase
        .from('leave_requests')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('created_at', { ascending: false })
        .limit(100);
      if (filterStatus !== 'all') q = q.eq('status', filterStatus);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: platformUsers } = useQuery({
    queryKey: ['platform-users-names', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_users')
        .select('user_id, display_name, email')
        .eq('tenant_id', tenantId!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const userMap = useMemo(() => {
    return new Map((platformUsers || []).map(u => [u.user_id, u.display_name || u.email || u.user_id.slice(0, 8)]));
  }, [platformUsers]);

  // Lấy bản ghi chấm công ngày của đơn đang mở để admin đối chiếu giờ ca vs thực tế.
  const reviewDate = reviewDialog?.leave_date_from || null;
  const reviewUserId = reviewDialog?.user_id || null;
  const reviewItems = reviewDialog?.grouped_requests || (reviewDialog ? [reviewDialog] : []);
  const isTimeRequest = reviewItems.some((item: any) => item?.request_type === 'late_arrival' || item?.request_type === 'early_leave');
  const { data: reviewAttendance } = useQuery({
    queryKey: ['leave-review-attendance', tenantId, reviewUserId, reviewDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('check_in_time, check_out_time, late_minutes, early_leave_minutes, total_work_minutes, work_shifts(name, start_time, end_time)')
        .eq('tenant_id', tenantId!)
        .eq('user_id', reviewUserId!)
        .eq('date', reviewDate!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && !!reviewUserId && !!reviewDate && !!isTimeRequest,
  });

  // 3 actions: approved (có phép), unexcused (không phép but still off), rejected (không được nghỉ)
  const reviewMutation = useMutation({
    mutationFn: async ({ ids, action, note, deduct }: { ids: string[]; action: 'approved' | 'unexcused' | 'rejected'; note: string; deduct?: boolean }) => {
      const { error } = await supabase
        .from('leave_requests')
        .update({
          status: action,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          review_note: note || null,
          deduct_salary: deduct === true,
        })
        .in('id', ids);
      if (error) throw error;

      const matchedRequests = (requests || []).filter(r => ids.includes(r.id));
      for (const req of matchedRequests) {
        const reqType = (req as any).request_type || 'full_day';

        if ((action === 'approved' || action === 'unexcused') && reqType === 'full_day') {
          const days = eachDayOfInterval({ start: parseISO(req.leave_date_from), end: parseISO(req.leave_date_to) });
          for (const day of days) {
            const dateStr = format(day, 'yyyy-MM-dd');
            await supabase.from('absence_reviews').upsert({
              tenant_id: tenantId!,
              user_id: req.user_id,
              absence_date: dateStr,
              is_excused: action === 'approved',
              review_note: `${action === 'approved' ? 'Nghỉ có phép' : 'Nghỉ không phép'}: ${note || req.reason}`,
              reviewed_by: user?.id,
              reviewed_at: new Date().toISOString(),
            }, { onConflict: 'tenant_id,user_id,absence_date' });
          }
        }
      }
    },
    onSuccess: async (_, vars) => {
      await Promise.all([
        qc.refetchQueries({ queryKey: ['leave-requests-admin'] }),
        qc.refetchQueries({ queryKey: ['merged-absence-reviews'] }),
        qc.refetchQueries({ queryKey: ['pending-approvals-count'] }),
      ]);
      qc.invalidateQueries({ queryKey: ['my-leave-requests'] });
      qc.invalidateQueries({ queryKey: ['my-approved-excuses'] });
      qc.invalidateQueries({ queryKey: ['my-absence-reviews'] });
      qc.invalidateQueries({ queryKey: ['approved-late-early-excuses'] });
      qc.invalidateQueries({ queryKey: ['absence-reviews'] });
      qc.invalidateQueries({ queryKey: ['attendance-records'] });
      qc.invalidateQueries({ queryKey: ['my-attendance-month'] });
      const msg = vars.action === 'approved' ? 'Đã duyệt có phép' : vars.action === 'unexcused' ? 'Đã duyệt không phép' : 'Đã từ chối đơn nghỉ';
      toast.success(msg);
      setReviewDialog(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const guardedReview = (payload: { ids: string[]; action: 'approved' | 'unexcused' | 'rejected'; note: string; deduct?: boolean }) => {
    if (hasSecurityPassword && !unlocked) {
      setPendingAction(payload);
      setShowPwd(true);
      return;
    }
    reviewMutation.mutate(payload);
  };

  const filtered = useMemo(() => {
    if (!searchQuery) return requests || [];
    const q = searchQuery.toLowerCase();
    return (requests || []).filter(r => {
      const name = userMap.get(r.user_id) || '';
      return name.toLowerCase().includes(q) || r.reason.toLowerCase().includes(q);
    });
  }, [requests, searchQuery, userMap]);

  // Phân chia: phiếu tự động (do hệ thống tạo khi auto-detect đi trễ/về sớm)
  // vs phiếu thủ công (NV tự gửi đơn xin phép)
  const autoRequests = useMemo(() => {
    const groups = new Map<string, any>();
    for (const req of filtered.filter((r: any) => r.is_auto_detected === true)) {
      const key = `${req.user_id}_${req.leave_date_from}_${req.leave_date_to}`;
      const current = groups.get(key) || {
        id: key,
        user_id: req.user_id,
        tenant_id: req.tenant_id,
        leave_date_from: req.leave_date_from,
        leave_date_to: req.leave_date_to,
        is_auto_detected: true,
        created_at: req.created_at,
        grouped_requests: [],
        review_ids: [],
      };
      current.grouped_requests.push(req);
      current.review_ids.push(req.id);
      current.created_at = current.created_at > req.created_at ? current.created_at : req.created_at;
      groups.set(key, current);
    }

    return Array.from(groups.values()).map((group: any) => {
      const groupedRequests = [...group.grouped_requests].sort((a: any, b: any) => {
        const order = (type: string) => (type === 'late_arrival' ? 0 : type === 'early_leave' ? 1 : 2);
        return order(a.request_type) - order(b.request_type);
      });
      const first = groupedRequests[0];
      const mixed = groupedRequests.length > 1;
      return {
        ...group,
        grouped_requests: groupedRequests,
        request_type: mixed ? 'combined_time' : (first?.request_type || 'full_day'),
        time_minutes: mixed ? null : (first?.time_minutes || 0),
        reason: groupedRequests.map((r: any) => r.reason).filter(Boolean).join(' • '),
        review_note: groupedRequests.map((r: any) => r.review_note).filter(Boolean).join(' • ') || null,
        status: groupedRequests.every((r: any) => r.status === groupedRequests[0].status) ? groupedRequests[0].status : 'pending',
        deduct_salary: groupedRequests.some((r: any) => r.deduct_salary === true),
        late_minutes: groupedRequests.find((r: any) => r.request_type === 'late_arrival')?.time_minutes || 0,
        early_leave_minutes: groupedRequests.find((r: any) => r.request_type === 'early_leave')?.time_minutes || 0,
      };
    }).sort((a: any, b: any) => b.created_at.localeCompare(a.created_at));
  }, [filtered]);
  const manualRequests = useMemo(
    () => filtered.filter((r: any) => r.is_auto_detected !== true),
    [filtered]
  );
  const [subTab, setSubTab] = useState<'auto' | 'manual'>('auto');

  const stats = useMemo(() => {
    const all = requests || [];
    return {
      pending: all.filter(r => r.status === 'pending').length,
      approved: all.filter(r => r.status === 'approved').length,
      unexcused: all.filter(r => r.status === 'unexcused').length,
      rejected: all.filter(r => r.status === 'rejected').length,
      total: all.length,
    };
  }, [requests]);

  const openReview = (req: any) => {
    setReviewDialog(req);
    setReviewNote('');
    setDeductSalary(req?.deduct_salary === true);
  };

  const reviewTargetIds = reviewDialog?.review_ids || (reviewDialog?.id ? [reviewDialog.id] : []);
  const isCombinedTimeReview = reviewDialog?.request_type === 'combined_time';
  const isTimeReviewDialog = reviewDialog?.request_type === 'late_arrival' || reviewDialog?.request_type === 'early_leave' || isCombinedTimeReview;
  const timeReviewLabel = reviewDialog?.request_type === 'late_arrival'
    ? 'đi trễ'
    : reviewDialog?.request_type === 'early_leave'
      ? 'về sớm'
      : 'đi trễ / về sớm';
  const timeReviewMinutes = isCombinedTimeReview
    ? `${reviewDialog?.late_minutes || 0}p trễ • ${reviewDialog?.early_leave_minutes || 0}p sớm`
    : fmtMins(reviewDialog?.time_minutes || 0);

  // ==================== AUTO-DETECT VẮNG MẶT (gộp từ AbsenceReviewsTab) ====================
  const monthStr = format(new Date(), 'yyyy-MM');
  const monthStart = format(startOfMonth(parseISO(monthStr + '-01')), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(parseISO(monthStr + '-01')), 'yyyy-MM-dd');

  const { data: absentRecords } = useQuery({
    queryKey: ['merged-absent-records', tenantId, monthStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('user_id, date, status')
        .eq('tenant_id', tenantId!)
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .eq('status', 'absent');
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: shiftAssignments } = useQuery({
    queryKey: ['merged-shift-assignments', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shift_assignments')
        .select('user_id, assignment_type, day_of_week, specific_date')
        .eq('tenant_id', tenantId!)
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: allAttendance } = useQuery({
    queryKey: ['merged-all-attendance', tenantId, monthStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('user_id, date')
        .eq('tenant_id', tenantId!)
        .gte('date', monthStart)
        .lte('date', monthEnd);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: absenceReviews } = useQuery({
    queryKey: ['merged-absence-reviews', tenantId, monthStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('absence_reviews')
        .select('*')
        .eq('tenant_id', tenantId!)
        .gte('absence_date', monthStart)
        .lte('absence_date', monthEnd);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Build danh sách ngày vắng tự động (chưa duyệt + không có đơn xin nghỉ)
  const autoAbsences = useMemo(() => {
    if (!platformUsers || !shiftAssignments || !allAttendance) return [];
    const userMap = new Map(platformUsers.map(u => [u.user_id, u.display_name || u.email || u.user_id.slice(0, 8)]));
    const reviewMap = new Map((absenceReviews || []).map((r: any) => [`${r.user_id}_${r.absence_date}`, r]));
    const attendanceSet = new Set((allAttendance || []).map(a => `${a.user_id}_${a.date}`));

    // Loại trừ ngày đã có đơn xin nghỉ (full_day, status != rejected)
    const leaveCovered = new Set<string>();
    for (const r of (requests || [])) {
      if (r.status === 'rejected') continue;
      if ((r as any).request_type && (r as any).request_type !== 'full_day') continue;
      try {
        const days = eachDayOfInterval({ start: parseISO(r.leave_date_from), end: parseISO(r.leave_date_to) });
        for (const d of days) leaveCovered.add(`${r.user_id}_${format(d, 'yyyy-MM-dd')}`);
      } catch {}
    }

    const result: { user_id: string; user_name: string; date: string; review?: any }[] = [];
    const today = new Date(); today.setHours(23, 59, 59, 999);

    for (const rec of (absentRecords || [])) {
      const key = `${rec.user_id}_${rec.date}`;
      if (leaveCovered.has(key)) continue;
      result.push({ user_id: rec.user_id, user_name: userMap.get(rec.user_id) || rec.user_id.slice(0, 8), date: rec.date, review: reviewMap.get(key) });
    }

    const start = new Date(monthStart);
    const end = new Date(monthEnd);
    for (const u of platformUsers) {
      const ua = shiftAssignments.filter(sa => sa.user_id === u.user_id);
      if (!ua.length) continue;
      for (let d = new Date(start); d <= end && d <= today; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const dow = d.getDay();
        const scheduled = ua.some(sa => (sa.assignment_type === 'fixed' && sa.day_of_week === dow) || sa.specific_date === dateStr);
        if (!scheduled) continue;
        const k = `${u.user_id}_${dateStr}`;
        if (attendanceSet.has(k)) continue;
        if (leaveCovered.has(k)) continue;
        if (result.some(r => r.user_id === u.user_id && r.date === dateStr)) continue;
        result.push({ user_id: u.user_id, user_name: userMap.get(u.user_id) || u.user_id.slice(0, 8), date: dateStr, review: reviewMap.get(k) });
      }
    }
    return result.sort((a, b) => b.date.localeCompare(a.date) || a.user_name.localeCompare(b.user_name));
  }, [absentRecords, shiftAssignments, allAttendance, platformUsers, absenceReviews, requests, monthStart, monthEnd]);

  const pendingAutoAbsences = useMemo(() => autoAbsences.filter(a => !a.review), [autoAbsences]);

  const [absenceDialog, setAbsenceDialog] = useState<{ user_id: string; user_name: string; date: string; review?: any } | null>(null);
  const [absenceExcused, setAbsenceExcused] = useState(true);
  const [absenceNote, setAbsenceNote] = useState('');

  const saveAbsenceReview = useMutation({
    mutationFn: async ({ userId, date, excused, note }: { userId: string; date: string; excused: boolean; note: string }) => {
      const { error } = await supabase.from('absence_reviews').upsert({
        tenant_id: tenantId!,
        user_id: userId,
        absence_date: date,
        is_excused: excused,
        review_note: note || null,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id,user_id,absence_date' });
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        qc.refetchQueries({ queryKey: ['merged-absence-reviews'] }),
        qc.refetchQueries({ queryKey: ['pending-approvals-count'] }),
      ]);
      qc.invalidateQueries({ queryKey: ['my-absence-reviews'] });
      qc.invalidateQueries({ queryKey: ['attendance-records'] });
      qc.invalidateQueries({ queryKey: ['my-attendance-month'] });
      toast.success('Đã cập nhật trạng thái nghỉ');
      setAbsenceDialog(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openAbsence = (a: any) => {
    setAbsenceDialog(a);
    setAbsenceExcused(a.review?.is_excused ?? true);
    setAbsenceNote(a.review?.review_note || '');
  };

  const formatDateRange = (from: string, to: string) => {
    const f = format(parseISO(from), 'dd/MM/yyyy');
    const t = format(parseISO(to), 'dd/MM/yyyy');
    if (f === t) return f;
    const days = differenceInCalendarDays(parseISO(to), parseISO(from)) + 1;
    return `${f} → ${t} (${days} ngày)`;
  };

  const requestTypeBadge = (req: any) => {
    const t = req.request_type || 'full_day';
    if (t === 'combined_time') return (
      <div className="flex flex-wrap gap-1">
        <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-700">
          <LogIn className="h-3 w-3 mr-1" />Đi muộn {req.late_minutes || 0}'
        </Badge>
        <Badge variant="outline" className="text-[10px] border-purple-300 text-purple-700">
          <LogOut className="h-3 w-3 mr-1" />Về sớm {req.early_leave_minutes || 0}'
        </Badge>
      </div>
    );
    if (t === 'late_arrival') return (
      <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-700">
        <LogIn className="h-3 w-3 mr-1" />Đi muộn {req.time_minutes || 0}'
      </Badge>
    );
    if (t === 'early_leave') return (
      <Badge variant="outline" className="text-[10px] border-purple-300 text-purple-700">
        <LogOut className="h-3 w-3 mr-1" />Về sớm {req.time_minutes || 0}'
      </Badge>
    );
    return (
      <Badge variant="outline" className="text-[10px] border-slate-300 text-slate-700">
        <CalendarOff className="h-3 w-3 mr-1" />Nghỉ cả ngày
      </Badge>
    );
  };

  const statusBadge = (status: string) => {
    if (status === 'approved') return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-[10px]"><CheckCircle className="h-3 w-3 mr-1" />Có phép</Badge>;
    if (status === 'unexcused') return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 text-[10px]"><AlertTriangle className="h-3 w-3 mr-1" />Không phép</Badge>;
    if (status === 'rejected') return <Badge variant="destructive" className="text-[10px]"><XCircle className="h-3 w-3 mr-1" />Từ chối</Badge>;
    return <Badge variant="outline" className="text-orange-600 border-orange-300 text-[10px]"><Clock className="h-3 w-3 mr-1" />Chờ duyệt</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus('pending')}>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.pending}</div>
            <div className="text-xs text-muted-foreground">Chờ duyệt</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus('approved')}>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
            <div className="text-xs text-muted-foreground">Có phép</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus('unexcused')}>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-orange-500">{stats.unexcused}</div>
            <div className="text-xs text-muted-foreground">Không phép</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus('rejected')}>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-destructive">{stats.rejected}</div>
            <div className="text-xs text-muted-foreground">Từ chối</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus('all')}>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-foreground">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Tổng cộng</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[150px]">
          <Label className="text-xs">Tìm kiếm</Label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Tên NV, lý do..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-8" />
          </div>
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Chờ duyệt</SelectItem>
            <SelectItem value="approved">Có phép</SelectItem>
            <SelectItem value="unexcused">Không phép</SelectItem>
            <SelectItem value="rejected">Từ chối</SelectItem>
            <SelectItem value="all">Tất cả</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {/* Sub-tabs: Phiếu tự động (do hệ thống tạo) vs Phiếu thủ công (NV gửi) */}
      {(() => {
        const renderTable = (rows: any[], emptyText: string) => {
          if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;
          if (rows.length === 0) return <Card><CardContent className="py-10 text-center text-muted-foreground">{emptyText}</CardContent></Card>;
          return (
            <Card>
              {/* Mobile card list */}
              <div className="sm:hidden divide-y">
                {rows.map((req: any) => (
                  <div key={req.id} className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium text-sm">{userMap.get(req.user_id) || req.user_id.slice(0, 8)}</div>
                      {statusBadge(req.status)}
                    </div>
                    <div>{requestTypeBadge(req)}</div>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{formatDateRange(req.leave_date_from, req.leave_date_to)}</span>
                      {' · '}gửi {format(parseISO(req.created_at), 'dd/MM HH:mm')}
                    </div>
                    {req.reason && <div className="text-xs text-muted-foreground line-clamp-2">{req.reason}</div>}
                    <div className="flex justify-end">
                      {req.status === 'pending' ? (
                        <Button size="sm" variant="outline" onClick={() => openReview(req)}>Duyệt</Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => openReview(req)}>Chi tiết</Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nhân viên</TableHead>
                      <TableHead>Loại</TableHead>
                      <TableHead>Ngày nghỉ</TableHead>
                      <TableHead>Lý do</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead>Ngày gửi</TableHead>
                      <TableHead className="text-right">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((req: any) => (
                      <TableRow key={req.id}>
                        <TableCell className="font-medium text-sm">{userMap.get(req.user_id) || req.user_id.slice(0, 8)}</TableCell>
                        <TableCell>{requestTypeBadge(req)}</TableCell>
                        <TableCell className="text-sm">{formatDateRange(req.leave_date_from, req.leave_date_to)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{req.reason}</TableCell>
                        <TableCell>{statusBadge(req.status)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{format(parseISO(req.created_at), 'dd/MM HH:mm')}</TableCell>
                        <TableCell className="text-right">
                          {req.status === 'pending' ? (
                            <Button size="sm" variant="outline" onClick={() => openReview(req)}>Duyệt</Button>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={() => openReview(req)}>Chi tiết</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          );
        };
        const autoPending = autoRequests.filter((r: any) => r.status === 'pending').length + pendingAutoAbsences.length;
        const manualPending = manualRequests.filter((r: any) => r.status === 'pending').length;
        return (
          <Tabs value={subTab} onValueChange={(v) => setSubTab(v as 'auto' | 'manual')}>
            <TabsList>
              <TabsTrigger value="auto" className="gap-1.5">
                <Bot className="h-3.5 w-3.5" />
                Phiếu tự động
                {autoPending > 0 && <Badge variant="destructive" className="h-4 px-1.5 text-[10px] ml-1">{autoPending}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="manual" className="gap-1.5">
                <User className="h-3.5 w-3.5" />
                Phiếu thủ công
                {manualPending > 0 && <Badge variant="destructive" className="h-4 px-1.5 text-[10px] ml-1">{manualPending}</Badge>}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="auto" className="mt-3 space-y-4">
              <div className="text-xs text-muted-foreground italic">
                Phiếu do hệ thống tự tạo khi NV check-in trễ / check-out sớm. Nếu NV gửi đơn thủ công cùng ngày + cùng loại, phiếu auto sẽ tự động bị gộp.
              </div>
              {renderTable(autoRequests, 'Không có phiếu tự động nào')}
            </TabsContent>
            <TabsContent value="manual" className="mt-3">
              <div className="text-xs text-muted-foreground italic mb-3">
                Phiếu do NV chủ động gửi từ trang chấm công cá nhân.
              </div>
              {renderTable(manualRequests, 'Không có phiếu thủ công nào')}
            </TabsContent>
          </Tabs>
        );
      })()}

      {/* Ngày vắng tự động phát hiện (gộp từ Duyệt nghỉ phép) */}
      {subTab === 'auto' && (
      <Card className="border-orange-200 dark:border-orange-900">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <UserX className="h-5 w-5 text-orange-600" />
              <div>
                <div className="font-semibold text-sm">Ngày vắng tự phát hiện ({format(new Date(), 'MM/yyyy')})</div>
                <div className="text-xs text-muted-foreground">NV không đi làm vào ngày đã xếp ca, chưa có đơn xin nghỉ</div>
              </div>
            </div>
            <Badge variant={pendingAutoAbsences.length > 0 ? 'destructive' : 'secondary'} className="text-xs">
              Chưa duyệt: {pendingAutoAbsences.length} / {autoAbsences.length}
            </Badge>
          </div>

          {autoAbsences.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-4">Không có ngày vắng nào trong tháng</div>
          ) : (
            <>
              {/* Mobile card list */}
              <div className="sm:hidden divide-y rounded border">
                {autoAbsences.map((a, i) => (
                  <div key={`m-${a.user_id}_${a.date}_${i}`} className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium text-sm">{a.user_name}</div>
                        <div className="text-xs text-muted-foreground">{format(parseISO(a.date), 'dd/MM/yyyy')}</div>
                      </div>
                      {!a.review ? (
                        <Badge variant="outline" className="text-orange-600 border-orange-300 text-[10px]"><AlertTriangle className="h-3 w-3 mr-1" />Chưa duyệt</Badge>
                      ) : a.review.is_excused ? (
                        <Badge className="bg-green-100 text-green-800 text-[10px]"><CheckCircle className="h-3 w-3 mr-1" />Có phép</Badge>
                      ) : (
                        <Badge variant="destructive" className="text-[10px]"><XCircle className="h-3 w-3 mr-1" />Không phép</Badge>
                      )}
                    </div>
                    {a.review?.review_note && <div className="text-xs text-muted-foreground line-clamp-2">{a.review.review_note}</div>}
                    <div className="flex justify-end">
                      <Button size="sm" variant={a.review ? 'ghost' : 'outline'} onClick={() => openAbsence(a)}>
                        {a.review ? 'Sửa' : 'Duyệt'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nhân viên</TableHead>
                    <TableHead>Ngày vắng</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Ghi chú</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {autoAbsences.map((a, i) => (
                    <TableRow key={`${a.user_id}_${a.date}_${i}`}>
                      <TableCell className="font-medium text-sm">{a.user_name}</TableCell>
                      <TableCell className="text-sm">{format(parseISO(a.date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell>
                        {!a.review ? (
                          <Badge variant="outline" className="text-orange-600 border-orange-300 text-[10px]">
                            <AlertTriangle className="h-3 w-3 mr-1" />Chưa duyệt
                          </Badge>
                        ) : a.review.is_excused ? (
                          <Badge className="bg-green-100 text-green-800 text-[10px]">
                            <CheckCircle className="h-3 w-3 mr-1" />Có phép
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px]">
                            <XCircle className="h-3 w-3 mr-1" />Không phép
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                        {a.review?.review_note || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant={a.review ? 'ghost' : 'outline'} onClick={() => openAbsence(a)}>
                          {a.review ? 'Sửa' : 'Duyệt'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      )}

      {/* Review Dialog */}
      <Dialog open={!!reviewDialog} onOpenChange={() => setReviewDialog(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarOff className="h-5 w-5" /> Duyệt đơn xin phép
            </DialogTitle>
          </DialogHeader>
          {reviewDialog && (
            <div className="space-y-4">
              <div>{requestTypeBadge(reviewDialog)}</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Nhân viên</Label>
                  <div className="font-medium">{userMap.get(reviewDialog.user_id) || reviewDialog.user_id.slice(0, 8)}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Ngày</Label>
                  <div className="font-medium">{formatDateRange(reviewDialog.leave_date_from, reviewDialog.leave_date_to)}</div>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Lý do</Label>
                <div className="text-sm bg-muted p-2 rounded">{reviewDialog.reason}</div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Trạng thái hiện tại</Label>
                <div className="mt-1">{statusBadge(reviewDialog.status)}</div>
              </div>
              {reviewDialog.status === 'pending' && (
                <>
                  <div>
                    <Label>Ghi chú duyệt</Label>
                    <Textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)} placeholder="Ghi chú..." rows={2} />
                  </div>
                  {isTimeReviewDialog ? (
                    <>
                      {/* Đối chiếu chấm công thực tế ngày xin phép */}
                      {(() => {
                        const ws = (reviewAttendance as any)?.work_shifts;
                        const reqMin = reviewDialog.time_minutes || 0;
                        return (
                          <div className="rounded border bg-muted/40 p-3 space-y-1.5 text-xs">
                            <div className="font-semibold text-foreground">📋 Đối chiếu chấm công ngày này</div>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                              <div className="text-muted-foreground">Ca làm:</div>
                              <div className="font-mono">
                                {ws ? `${ws.start_time?.slice(0,5)} – ${ws.end_time?.slice(0,5)}${ws.name ? ` (${ws.name})` : ''}` : 'Không xếp ca'}
                              </div>
                              <div className="text-muted-foreground">Check-in thực tế:</div>
                              <div className="font-mono font-medium">{fmtTimeVN(reviewAttendance?.check_in_time)}</div>
                              <div className="text-muted-foreground">Check-out thực tế:</div>
                              <div className="font-mono font-medium">{fmtTimeVN(reviewAttendance?.check_out_time)}</div>
                              {((reviewDialog.request_type === 'late_arrival') || isCombinedTimeReview) && (reviewAttendance as any)?.late_minutes != null && (
                                <>
                                  <div className="text-muted-foreground">Đi trễ thực tế:</div>
                                  <div className="font-medium text-destructive">{fmtMins((reviewAttendance as any).late_minutes || 0)}</div>
                                </>
                              )}
                              {((reviewDialog.request_type === 'early_leave') || isCombinedTimeReview) && (reviewAttendance as any)?.early_leave_minutes != null && (
                                <>
                                  <div className="text-muted-foreground">Về sớm thực tế:</div>
                                  <div className="font-medium text-destructive">{fmtMins((reviewAttendance as any).early_leave_minutes || 0)}</div>
                                </>
                              )}
                            </div>
                            <div className="border-t pt-1.5 mt-1.5 flex justify-between items-center">
                              <span className="text-muted-foreground">NV xin phép:</span>
                              <span className="font-bold text-amber-700 dark:text-amber-400 text-sm">
                                {timeReviewLabel} {timeReviewMinutes}
                              </span>
                            </div>
                            {!reviewAttendance && (
                              <p className="text-[11px] text-muted-foreground italic">
                                Chưa có bản ghi chấm công ngày này — đối chiếu lại sau khi NV check-in/out xong.
                              </p>
                            )}
                          </div>
                        );
                      })()}
                      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 p-3 rounded text-xs space-y-2">
                        <div className="font-semibold text-blue-900 dark:text-blue-200 mb-1">
                          📋 3 trường hợp xử lý {timeReviewLabel} ({timeReviewMinutes}):
                        </div>
                        <div className="pl-2 border-l-2 border-green-500">
                          <p className="font-medium text-green-700 dark:text-green-400">✅ Duyệt + KHÔNG tick "Trừ lương"</p>
                          <p className="text-muted-foreground">→ <strong>Miễn phạt hoàn toàn</strong>. NV không bị trừ đồng nào.</p>
                        </div>
                        <div className="pl-2 border-l-2 border-amber-500">
                          <p className="font-medium text-amber-700 dark:text-amber-400">⚠️ Duyệt + CÓ tick "Trừ lương"</p>
                          <p className="text-muted-foreground">→ Trừ theo <strong>đơn giá tăng ca/giờ</strong> (nhẹ hơn phạt thông thường).</p>
                        </div>
                        <div className="pl-2 border-l-2 border-red-500">
                          <p className="font-medium text-red-700 dark:text-red-400">❌ Từ chối</p>
                          <p className="text-muted-foreground">→ Trừ theo <strong>đơn giá phạt {timeReviewLabel}</strong> trong cấu hình bảng lương (nặng nhất).</p>
                        </div>
                      </div>
                      <label className="flex items-start gap-2 p-3 rounded border-2 border-amber-300 bg-amber-50 dark:bg-amber-950/20 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-950/40 transition-colors">
                        <Checkbox
                          checked={deductSalary}
                          onCheckedChange={(v) => setDeductSalary(v === true)}
                          className="mt-0.5"
                        />
                        <div className="text-xs">
                          <div className="font-semibold text-amber-800 dark:text-amber-200">
                            Trừ lương phần thời gian này (theo đơn giá tăng ca)
                          </div>
                          <div className="text-muted-foreground mt-1">
                            • <strong>Bỏ trống</strong> = Miễn phạt 100% (NV được nghỉ có lương).<br/>
                            • <strong>Tick</strong> = Trừ lương phần phút này theo đơn giá tăng ca/giờ trong bảng lương NV (nhẹ hơn phạt {timeReviewLabel} thông thường).
                          </div>
                        </div>
                      </label>
                    </>
                  ) : (
                    <div className="bg-muted/50 p-3 rounded text-xs space-y-1.5">
                      <p>✅ <strong>Có phép</strong>: Nghỉ có phép — nếu còn hạn mức nghỉ có lương thì không trừ lương, hết hạn mức chỉ trừ ngày công.</p>
                      <p>⚠️ <strong>Không phép</strong>: Cho nghỉ nhưng không phép — trừ lương ngày công + phạt theo quy định.</p>
                      <p>❌ <strong>Từ chối</strong>: Không được nghỉ — nhân viên phải đi làm.</p>
                    </div>
                  )}
                </>
              )}
              {reviewDialog.review_note && reviewDialog.status !== 'pending' && (
                <div>
                  <Label className="text-xs text-muted-foreground">Ghi chú admin</Label>
                  <div className="text-sm bg-muted p-2 rounded">{reviewDialog.review_note}</div>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            {reviewDialog?.status === 'pending' && (
              isTimeReviewDialog ? (
                <>
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700"
                    onClick={() => guardedReview({ ids: reviewTargetIds, action: 'approved', note: reviewNote, deduct: deductSalary })}
                    disabled={reviewMutation.isPending}
                  >
                    {reviewMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                    Duyệt {deductSalary ? '(trừ lương)' : '(miễn phạt)'}
                  </Button>
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => guardedReview({ ids: reviewTargetIds, action: 'rejected', note: reviewNote, deduct: false })}
                    disabled={reviewMutation.isPending}
                  >
                    <XCircle className="h-4 w-4 mr-1" /> Từ chối (vẫn tính phạt)
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700"
                    onClick={() => guardedReview({ ids: reviewTargetIds, action: 'approved', note: reviewNote, deduct: false })}
                    disabled={reviewMutation.isPending}
                  >
                    {reviewMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                    Duyệt có phép
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full border-orange-400 text-orange-600 hover:bg-orange-50"
                    onClick={() => guardedReview({ ids: reviewTargetIds, action: 'unexcused', note: reviewNote, deduct: false })}
                    disabled={reviewMutation.isPending}
                  >
                    <AlertTriangle className="h-4 w-4 mr-1" /> Duyệt không phép
                  </Button>
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => guardedReview({ ids: reviewTargetIds, action: 'rejected', note: reviewNote, deduct: false })}
                    disabled={reviewMutation.isPending}
                  >
                    <XCircle className="h-4 w-4 mr-1" /> Từ chối (không được nghỉ)
                  </Button>
                </>
              )
            )}
            <Button variant="outline" onClick={() => setReviewDialog(null)} className="w-full">Đóng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <SecurityPasswordDialog
        open={showPwd}
        onOpenChange={setShowPwd}
        onSuccess={() => {
          unlock();
          if (pendingAction) {
            reviewMutation.mutate(pendingAction);
            setPendingAction(null);
          }
        }}
        title="Xác thực duyệt nghỉ phép"
        description="Nhập mật khẩu bảo mật để duyệt yêu cầu nghỉ phép"
      />

      {/* Dialog duyệt ngày vắng (auto-detect) */}
      <Dialog open={!!absenceDialog} onOpenChange={() => setAbsenceDialog(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserX className="h-5 w-5" /> Duyệt ngày vắng
            </DialogTitle>
          </DialogHeader>
          {absenceDialog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Nhân viên</Label>
                  <div className="font-medium">{absenceDialog.user_name}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Ngày vắng</Label>
                  <div className="font-medium">{format(parseISO(absenceDialog.date), 'dd/MM/yyyy')}</div>
                </div>
              </div>
              <div>
                <Label>Phân loại</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <Button
                    variant={absenceExcused ? 'default' : 'outline'}
                    className={absenceExcused ? 'bg-green-600 hover:bg-green-700' : ''}
                    onClick={() => setAbsenceExcused(true)}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" /> Có phép
                  </Button>
                  <Button
                    variant={!absenceExcused ? 'destructive' : 'outline'}
                    onClick={() => setAbsenceExcused(false)}
                  >
                    <XCircle className="h-4 w-4 mr-1" /> Không phép
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {absenceExcused ? '💡 Có phép: Không trừ lương ngày này' : '⚠️ Không phép: Trừ 1 ngày lương'}
                </p>
              </div>
              <div>
                <Label>Ghi chú</Label>
                <Textarea value={absenceNote} onChange={e => setAbsenceNote(e.target.value)} rows={3} placeholder="Lý do, ghi chú..." />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAbsenceDialog(null)}>Hủy</Button>
            <Button
              onClick={() => absenceDialog && saveAbsenceReview.mutate({
                userId: absenceDialog.user_id,
                date: absenceDialog.date,
                excused: absenceExcused,
                note: absenceNote,
              })}
              disabled={saveAbsenceReview.isPending}
            >
              {saveAbsenceReview.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
