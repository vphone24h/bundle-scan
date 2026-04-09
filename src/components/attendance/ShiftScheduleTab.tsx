import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronLeft, ChevronRight, Plus, Calendar, Copy, Users, X } from 'lucide-react';
import { useShiftAssignments, useWorkShifts, useCreateShiftAssignment, useDeleteShiftAssignment } from '@/hooks/useAttendance';
import { usePlatformUser } from '@/hooks/useTenant';
import { format, addDays, startOfWeek, eachDayOfInterval } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

const DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

export function ShiftScheduleTab() {
  const { data: pu } = usePlatformUser();
  const tenantId = pu?.tenant_id;
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

  // Fetch staff list
  const { data: staffList } = useQuery({
    queryKey: ['staff-list', tenantId],
    queryFn: async () => {
      const { data: roles, error: rolesErr } = await supabase
        .from('user_roles')
        .select('user_id, user_role')
        .eq('tenant_id', tenantId!);
      if (rolesErr) throw rolesErr;
      if (!roles?.length) return [];

      const userIds = roles.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', userIds);

      return roles.map(r => ({
        ...r,
        display_name: profiles?.find(p => p.user_id === r.user_id)?.display_name || r.user_id.slice(0, 8),
      }));
    },
    enabled: !!tenantId,
  });

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

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="min-w-[700px]">
            <div className="grid grid-cols-7 gap-1">
              {weekDays.map((day) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const dayAssignments = getAssignmentsForDay(dateStr);
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
