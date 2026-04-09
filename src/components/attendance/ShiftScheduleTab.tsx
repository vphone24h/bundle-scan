import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Plus, Calendar } from 'lucide-react';
import { useShiftAssignments, useWorkShifts, useCreateShiftAssignment, useDeleteShiftAssignment } from '@/hooks/useAttendance';
import { usePlatformUser } from '@/hooks/useTenant';
import { format, addDays, startOfWeek, eachDayOfInterval } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';

const DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

export function ShiftScheduleTab() {
  const { data: pu } = usePlatformUser();
  const tenantId = pu?.tenant_id;
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

  // Fetch staff list
  const { data: staffList } = useQuery({
    queryKey: ['staff-list', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id, user_role, profiles(full_name)')
        .eq('tenant_id', tenantId!);
      if (error) throw error;
      return data;
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Xếp ca</h2>
        <div className="flex items-center gap-2">
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
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="min-w-[700px]">
            <div className="grid grid-cols-7 gap-1">
              {weekDays.map((day, i) => {
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
                      {dayAssignments.map((a: any) => (
                        <div
                          key={a.id}
                          className="text-[10px] p-1 rounded cursor-pointer hover:opacity-80"
                          style={{ backgroundColor: (a.work_shifts?.color || '#3B82F6') + '20', borderLeft: `2px solid ${a.work_shifts?.color || '#3B82F6'}` }}
                          onClick={() => deleteAssignment.mutate(a.id)}
                          title="Click để xóa"
                        >
                          <div className="font-medium truncate">{a.work_shifts?.name}</div>
                          <div className="text-muted-foreground">{a.work_shifts?.start_time?.slice(0,5)}-{a.work_shifts?.end_time?.slice(0,5)}</div>
                        </div>
                      ))}
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
                      {(s.profiles as any)?.full_name || s.user_id.slice(0, 8)}
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
    </div>
  );
}
