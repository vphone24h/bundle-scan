import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronLeft, ChevronRight, Plus, Copy, Users, X } from 'lucide-react';
import { useShiftAssignments, useWorkShifts, useCreateShiftAssignment, useDeleteShiftAssignment } from '@/hooks/useAttendance';
import { usePlatformUser, useCurrentTenant } from '@/hooks/useTenant';
import { useTenantStaffList } from '@/hooks/useTenantStaffList';
import { format, addDays, startOfWeek, eachDayOfInterval, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { getPaidLeaveMonthKey } from '@/lib/paidLeaveSchedule';

const DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

export function ShiftScheduleTab() {
  const { data: pu } = usePlatformUser();
  const { data: currentTenant } = useCurrentTenant();
  const tenantId = currentTenant?.id || pu?.tenant_id;
  const qc = useQueryClient();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const weekDays = useMemo(() => eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) }), [weekStart]);
  const { data: shifts } = useWorkShifts();
  const { data: assignments, isLoading } = useShiftAssignments();
  const createAssignment = useCreateShiftAssignment();
  const deleteAssignment = useDeleteShiftAssignment();
  
  const [addOpen, setAddOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedShiftId, setSelectedShiftId] = useState('');
  
  // Bulk assign state
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkUsers, setBulkUsers] = useState<string[]>([]);
  const [bulkShiftId, setBulkShiftId] = useState('');
  const [bulkDays, setBulkDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri
  const [bulkLoading, setBulkLoading] = useState(false);
  const [copyLoading, setCopyLoading] = useState(false);

  const { data: staffList } = useTenantStaffList();

  // Fetch approved/unexcused leave requests for visible week
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr = format(addDays(weekStart, 6), 'yyyy-MM-dd');
  const { data: leaveRequests } = useQuery({
    queryKey: ['leave-requests-schedule', tenantId, weekStartStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('user_id, leave_date_from, leave_date_to, status, reason')
        .eq('tenant_id', tenantId!)
        .in('status', ['approved', 'unexcused'])
        .lte('leave_date_from', weekEndStr)
        .gte('leave_date_to', weekStartStr);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const monthKeysInView = useMemo(
    () => Array.from(new Set(weekDays.map((day) => getPaidLeaveMonthKey(day)))),
    [weekDays]
  );

  const { data: paidLeaveSchedules } = useQuery({
    queryKey: ['paid-leave-schedule-week', tenantId, weekStartStr],
    queryFn: async () => {
      const monthFilters = monthKeysInView.map((monthKey) => {
        const [year, month] = monthKey.split('-').map(Number);
        return { year, month };
      });

      const [defaultRes, overrideRes] = await Promise.all([
        supabase
          .from('paid_leave_default_dates')
          .select('user_id, days_of_month')
          .eq('tenant_id', tenantId!),
        monthFilters.length
          ? supabase
              .from('paid_leave_overrides')
              .select('user_id, year, month, leave_dates')
              .eq('tenant_id', tenantId!)
              .or(monthFilters.map((item) => `and(year.eq.${item.year},month.eq.${item.month})`).join(','))
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (defaultRes.error) throw defaultRes.error;
      if (overrideRes.error) throw overrideRes.error;

      return {
        defaults: defaultRes.data || [],
        overrides: overrideRes.data || [],
      };
    },
    enabled: !!tenantId && monthKeysInView.length > 0,
  });

  // Build a map: dateStr -> [{ user_id, status }]
  const leaveMap = useMemo(() => {
    const map = new Map<string, { user_id: string; status: string; reason: string }[]>();
    (leaveRequests || []).forEach(lr => {
      const days = eachDayOfInterval({ start: parseISO(lr.leave_date_from), end: parseISO(lr.leave_date_to) });
      days.forEach(d => {
        const ds = format(d, 'yyyy-MM-dd');
        if (!map.has(ds)) map.set(ds, []);
        map.get(ds)!.push({ user_id: lr.user_id, status: lr.status, reason: lr.reason || '' });
      });
    });

    const scheduledMap = new Map<string, string[]>();

    (paidLeaveSchedules?.defaults || []).forEach((row: any) => {
      weekDays.forEach((day) => {
        if ((row.days_of_month || []).includes(day.getDate())) {
          const ds = format(day, 'yyyy-MM-dd');
          if (!scheduledMap.has(ds)) scheduledMap.set(ds, []);
          scheduledMap.get(ds)!.push(row.user_id);
        }
      });
    });

    (paidLeaveSchedules?.overrides || []).forEach((row: any) => {
      (row.leave_dates || []).forEach((dateStr: string) => {
        if (!scheduledMap.has(dateStr)) scheduledMap.set(dateStr, []);
        scheduledMap.get(dateStr)!.push(row.user_id);
      });
    });

    scheduledMap.forEach((userIds, ds) => {
      const existingIds = new Set((map.get(ds) || []).map((item) => item.user_id));
      userIds.forEach((userId) => {
        if (!existingIds.has(userId)) {
          if (!map.has(ds)) map.set(ds, []);
          map.get(ds)!.push({ user_id: userId, status: 'paid_leave', reason: 'Lịch nghỉ có lương' });
        }
      });
    });

    return map;
  }, [leaveRequests, paidLeaveSchedules, weekDays]);

  const getAssignmentsForDay = (date: string) => {
    return assignments?.filter((a: any) => {
      if (a.assignment_type === 'daily' && a.specific_date === date) return true;
      if (a.assignment_type === 'fixed') {
        const dayOfWeek = new Date(date).getDay();
        return a.day_of_week === dayOfWeek;
      }
      return false;
    }) || [];
  };

  /** Đếm: đi làm (unique users có ca), nghỉ phép, nghỉ KL, trống (không xếp & không nghỉ) */
  const getDayStats = (date: string) => {
    const dayAssignments = getAssignmentsForDay(date);
    const workingUsers = new Set(dayAssignments.map((a: any) => a.user_id));
    const dayLeaves = leaveMap.get(date) || [];
    const excused = dayLeaves.filter(l => l.status === 'approved' || l.status === 'paid_leave').length;
    const unexcused = dayLeaves.filter(l => l.status === 'unexcused').length;
    const totalStaff = staffList?.length || 0;
    const onLeaveUserIds = new Set(dayLeaves.map(l => l.user_id));
    // "Trống" = NV không có ca và không có đơn nghỉ
    let empty = 0;
    (staffList || []).forEach((s: any) => {
      if (!workingUsers.has(s.user_id) && !onLeaveUserIds.has(s.user_id)) empty++;
    });
    return { working: workingUsers.size, excused, unexcused, empty, totalStaff };
  };

  /** Tổng kết toàn tuần: cộng dồn theo từng ngày */
  const weekStats = useMemo(() => {
    let working = 0, excused = 0, unexcused = 0, empty = 0;
    weekDays.forEach(d => {
      const s = getDayStats(format(d, 'yyyy-MM-dd'));
      working += s.working; excused += s.excused; unexcused += s.unexcused; empty += s.empty;
    });
    return { working, excused, unexcused, empty };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekDays, assignments, leaveMap, staffList]);

  const handleAddAssignment = async () => {
    if (!selectedUserId || !selectedShiftId || !selectedDate) return;
    await createAssignment.mutateAsync({
      tenant_id: tenantId,
      user_id: selectedUserId,
      shift_id: selectedShiftId,
      assignment_type: 'daily',
      specific_date: selectedDate,
    });
    setAddOpen(false);
    setSelectedUserId('');
    setSelectedShiftId('');
  };

  // Bulk assign
  const handleBulkAssign = async () => {
    if (!bulkUsers.length || !bulkShiftId || !bulkDays.length) return;
    setBulkLoading(true);
    try {
      const inserts: any[] = [];
      for (const userId of bulkUsers) {
        for (const day of weekDays) {
          if (bulkDays.includes(day.getDay())) {
            inserts.push({
              tenant_id: tenantId,
              user_id: userId,
              shift_id: bulkShiftId,
              assignment_type: 'daily' as const,
              specific_date: format(day, 'yyyy-MM-dd'),
            });
          }
        }
      }
      if (inserts.length > 0) {
        const { error } = await supabase.from('shift_assignments').insert(inserts);
        if (error) throw error;
        qc.invalidateQueries({ queryKey: ['shift-assignments'] });
        toast.success(`Đã xếp ${inserts.length} ca cho ${bulkUsers.length} nhân viên`);
      }
      setBulkOpen(false);
      setBulkUsers([]);
      setBulkShiftId('');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBulkLoading(false);
    }
  };

  // Copy previous week
  const handleCopyPrevWeek = async () => {
    const prevWeekStart = addDays(weekStart, -7);
    const prevWeekDates = eachDayOfInterval({ start: prevWeekStart, end: addDays(prevWeekStart, 6) }).map(d => format(d, 'yyyy-MM-dd'));
    
    setCopyLoading(true);
    try {
      // Get previous week assignments
      const prevAssignments = assignments?.filter((a: any) => {
        if (a.assignment_type === 'daily' && prevWeekDates.includes(a.specific_date)) return true;
        return false;
      }) || [];

      if (!prevAssignments.length) {
        toast.error('Tuần trước không có lịch ca nào');
        setCopyLoading(false);
        return;
      }

      const inserts = prevAssignments.map((a: any) => {
        const prevDate = new Date(a.specific_date);
        const newDate = addDays(prevDate, 7);
        return {
          tenant_id: tenantId,
          user_id: a.user_id,
          shift_id: a.shift_id,
          assignment_type: 'daily' as const,
          specific_date: format(newDate, 'yyyy-MM-dd'),
        };
      });

      const { error } = await supabase.from('shift_assignments').insert(inserts);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['shift-assignments'] });
      toast.success(`Đã sao chép ${inserts.length} ca từ tuần trước`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCopyLoading(false);
    }
  };

  const toggleBulkUser = (userId: string) => {
    setBulkUsers(prev => prev.includes(userId) ? prev.filter(u => u !== userId) : [...prev, userId]);
  };

  const toggleBulkDay = (day: number) => {
    setBulkDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <h2 className="text-lg font-semibold">Xếp ca</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1 text-xs h-7" onClick={() => setBulkOpen(true)}>
            <Users className="h-3 w-3" /> Xếp hàng loạt
          </Button>
          <Button variant="outline" size="sm" className="gap-1 text-xs h-7" onClick={handleCopyPrevWeek} disabled={copyLoading}>
            <Copy className="h-3 w-3" /> {copyLoading ? 'Đang sao chép...' : 'Copy tuần trước'}
          </Button>
        </div>
      </div>

      {/* Week navigator */}
      <div className="flex items-center justify-center gap-2">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekStart(addDays(weekStart, -7))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium min-w-[160px] text-center">
          {format(weekStart, 'dd/MM')} - {format(addDays(weekStart, 6), 'dd/MM/yyyy')}
        </span>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekStart(addDays(weekStart, 7))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Tổng kết tuần */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-md border p-2 bg-blue-50 dark:bg-blue-950/30">
          <div className="text-[10px] text-muted-foreground uppercase">Lượt đi làm</div>
          <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{weekStats.working}</div>
        </div>
        <div className="rounded-md border p-2 bg-green-50 dark:bg-green-950/30">
          <div className="text-[10px] text-muted-foreground uppercase">Nghỉ phép</div>
          <div className="text-lg font-bold text-green-600 dark:text-green-400">{weekStats.excused}</div>
        </div>
        <div className="rounded-md border p-2 bg-red-50 dark:bg-red-950/30">
          <div className="text-[10px] text-muted-foreground uppercase">Nghỉ KL</div>
          <div className="text-lg font-bold text-red-600 dark:text-red-400">{weekStats.unexcused}</div>
        </div>
        <div className="rounded-md border p-2 bg-muted/40">
          <div className="text-[10px] text-muted-foreground uppercase">Chưa xếp / trống</div>
          <div className="text-lg font-bold text-muted-foreground">{weekStats.empty}</div>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="min-w-[700px]">
            <div className="grid grid-cols-7 gap-1">
              {weekDays.map((day) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const dayAssignments = getAssignmentsForDay(dateStr);
                const dayLeaves = leaveMap.get(dateStr) || [];
                const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');

                return (
                  <Card key={dateStr} className={isToday ? 'ring-2 ring-primary' : ''}>
                    <CardHeader className="p-2 pb-1">
                      <CardTitle className="text-xs text-center">
                        <span className={isToday ? 'text-primary font-bold' : 'text-muted-foreground'}>
                          {DAYS[day.getDay()]}
                        </span>
                        <br />
                        <span className="text-sm">{format(day, 'dd')}</span>
                      </CardTitle>
                      {(() => {
                        const s = getDayStats(dateStr);
                        return (
                          <div className="flex flex-wrap items-center justify-center gap-0.5 mt-1 text-[9px] leading-tight">
                            <span className="px-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" title="Đi làm">✓{s.working}</span>
                            {s.excused > 0 && <span className="px-1 rounded bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" title="Nghỉ phép">P{s.excused}</span>}
                            {s.unexcused > 0 && <span className="px-1 rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" title="Nghỉ KL">✗{s.unexcused}</span>}
                            {s.empty > 0 && <span className="px-1 rounded bg-muted text-muted-foreground" title="Chưa xếp">−{s.empty}</span>}
                          </div>
                        );
                      })()}
                    </CardHeader>
                    <CardContent className="p-1.5 pt-0 space-y-1 min-h-[80px]">
                      {dayAssignments.map((a: any) => {
                        const staffName = staffList?.find((s: any) => s.user_id === a.user_id);
                        return (
                          <div
                            key={a.id}
                            className="text-[10px] p-1 rounded group relative"
                            style={{ backgroundColor: (a.work_shifts?.color || '#3B82F6') + '20', borderLeft: `2px solid ${a.work_shifts?.color || '#3B82F6'}` }}
                          >
                            <button
                              className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-3.5 h-3.5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => deleteAssignment.mutate(a.id)}
                            >
                              <X className="h-2 w-2" />
                            </button>
                            <div className="font-medium truncate">{staffName?.display_name || a.user_id.slice(0, 6)}</div>
                            <div className="text-muted-foreground">{a.work_shifts?.name} {a.work_shifts?.start_time?.slice(0,5)}-{a.work_shifts?.end_time?.slice(0,5)}</div>
                          </div>
                        );
                      })}
                      {dayLeaves.map((leave, idx) => {
                        const staffName = staffList?.find((s: any) => s.user_id === leave.user_id);
                        const isExcused = leave.status === 'approved';
                        return (
                          <div
                            key={`leave-${idx}`}
                            className={`text-[10px] p-1 rounded ${isExcused ? 'bg-green-100 dark:bg-green-900/30 border-l-2 border-green-500' : 'bg-red-100 dark:bg-red-900/30 border-l-2 border-red-500'}`}
                          >
                            <div className={`font-medium truncate ${isExcused ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                              {staffName?.display_name || leave.user_id.slice(0, 6)}
                            </div>
                            <div className={`${isExcused ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              {isExcused ? '✅ Nghỉ có phép' : '❌ Nghỉ không phép'}
                            </div>
                          </div>
                        );
                      })}
                      <button
                        className="w-full text-[10px] text-muted-foreground hover:text-primary py-0.5 flex items-center justify-center gap-0.5"
                        onClick={() => { setSelectedDate(dateStr); setAddOpen(true); }}
                      >
                        <Plus className="h-2.5 w-2.5" /> Thêm
                      </button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Single assignment dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Xếp ca ngày {selectedDate && format(new Date(selectedDate), 'dd/MM/yyyy')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nhân viên</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger><SelectValue placeholder="Chọn nhân viên" /></SelectTrigger>
                <SelectContent>
                  {staffList?.map((s: any) => (
                    <SelectItem key={s.user_id} value={s.user_id}>
                      {s.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ca làm</Label>
              <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
                <SelectTrigger><SelectValue placeholder="Chọn ca" /></SelectTrigger>
                <SelectContent>
                  {shifts?.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.start_time?.slice(0,5)} - {s.end_time?.slice(0,5)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Hủy</Button>
            <Button onClick={handleAddAssignment} disabled={createAssignment.isPending}>Xếp ca</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk assignment dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Xếp ca hàng loạt - Tuần {format(weekStart, 'dd/MM')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm mb-2 block">Chọn nhân viên</Label>
              <div className="max-h-40 overflow-y-auto space-y-1 border rounded-md p-2">
                {staffList?.map((s: any) => (
                  <label key={s.user_id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 p-1 rounded">
                    <Checkbox
                      checked={bulkUsers.includes(s.user_id)}
                      onCheckedChange={() => toggleBulkUser(s.user_id)}
                    />
                    {s.display_name}
                  </label>
                ))}
              </div>
              {bulkUsers.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">Đã chọn {bulkUsers.length} nhân viên</p>
              )}
            </div>

            <div>
              <Label className="text-sm mb-2 block">Ca làm</Label>
              <Select value={bulkShiftId} onValueChange={setBulkShiftId}>
                <SelectTrigger><SelectValue placeholder="Chọn ca" /></SelectTrigger>
                <SelectContent>
                  {shifts?.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.start_time?.slice(0,5)} - {s.end_time?.slice(0,5)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm mb-2 block">Ngày trong tuần</Label>
              <div className="flex gap-1">
                {DAYS.map((d, i) => (
                  <Button
                    key={d}
                    variant={bulkDays.includes(i) ? 'default' : 'outline'}
                    size="sm"
                    className="h-8 w-9 text-xs p-0"
                    onClick={() => toggleBulkDay(i)}
                  >
                    {d}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Hủy</Button>
            <Button onClick={handleBulkAssign} disabled={bulkLoading || !bulkUsers.length || !bulkShiftId}>
              {bulkLoading ? 'Đang xếp...' : `Xếp ca (${bulkUsers.length} NV × ${bulkDays.length} ngày)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
