import { useState, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Copy } from 'lucide-react';
import { format, addDays, startOfWeek, eachDayOfInterval, subWeeks } from 'date-fns';
import { vi } from 'date-fns/locale';
import type { ScheduleData } from '../CreateEmployeeStepper';

interface Shift { id: string; name: string; start_time: string; end_time: string; }

interface Props {
  scheduleData: ScheduleData;
  onChange: (d: ScheduleData) => void;
  shifts: Shift[];
  selectedShiftId: string;
  /** For weekly mode: existing daily assignments for this user */
  existingDailyAssignments?: Array<{ specific_date: string; shift_id: string }>;
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS: Record<string, string> = {
  monday: 'Thứ 2', tuesday: 'Thứ 3', wednesday: 'Thứ 4',
  thursday: 'Thứ 5', friday: 'Thứ 6', saturday: 'Thứ 7', sunday: 'CN',
};

export function StepSchedule({ scheduleData, onChange, shifts, selectedShiftId, existingDailyAssignments }: Props) {
  const selectedShift = shifts.find(s => s.id === selectedShiftId);

  // Weekly mode state
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));

  const weekDays = useMemo(
    () => eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) }),
    [weekStart]
  );

  // Build map of existing assignments for quick lookup
  const existingMap = useMemo(() => {
    const map = new Map<string, string>();
    existingDailyAssignments?.forEach(a => map.set(a.specific_date, a.shift_id));
    return map;
  }, [existingDailyAssignments]);

  const handleWeeklyDayChange = (dateStr: string, shiftId: string) => {
    const weeklyDays = { ...(scheduleData.weeklyDays || {}) };
    if (shiftId === '_off') {
      delete weeklyDays[dateStr];
    } else {
      weeklyDays[dateStr] = shiftId;
    }
    onChange({ ...scheduleData, weeklyDays });
  };

  const handleCopyLastWeek = () => {
    const lastWeekStart = subWeeks(weekStart, 1);
    const lastWeekDays = eachDayOfInterval({ start: lastWeekStart, end: addDays(lastWeekStart, 6) });
    const weeklyDays = { ...(scheduleData.weeklyDays || {}) };

    lastWeekDays.forEach((lastDay, idx) => {
      const lastDateStr = format(lastDay, 'yyyy-MM-dd');
      const currentDateStr = format(weekDays[idx], 'yyyy-MM-dd');
      const shiftFromLast = weeklyDays[lastDateStr] || existingMap.get(lastDateStr);
      if (shiftFromLast) {
        weeklyDays[currentDateStr] = shiftFromLast;
      } else {
        delete weeklyDays[currentDateStr];
      }
    });

    onChange({ ...scheduleData, weeklyDays });
  };

  const getWeeklyShiftForDate = (dateStr: string): string => {
    return scheduleData.weeklyDays?.[dateStr] || existingMap.get(dateStr) || '_off';
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-xs">Kiểu lịch trình</Label>
        <Select
          value={scheduleData.type}
          onValueChange={(v: 'fixed' | 'custom' | 'weekly') => onChange({ ...scheduleData, type: v })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="fixed">Cố định (cùng ca mỗi ngày)</SelectItem>
            <SelectItem value="custom">Tùy chỉnh (khác ca mỗi ngày)</SelectItem>
            <SelectItem value="weekly">Theo tuần (xếp lịch cụ thể)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {scheduleData.type === 'fixed' ? (
        <div className="rounded-lg border p-4 bg-muted/30">
          <p className="text-sm font-medium mb-2">Ca cố định</p>
          {selectedShift ? (
            <Badge variant="secondary" className="text-sm">
              {selectedShift.name} ({selectedShift.start_time} - {selectedShift.end_time})
            </Badge>
          ) : (
            <p className="text-sm text-muted-foreground">Chưa chọn ca. Quay lại bước 2 để chọn.</p>
          )}
          <p className="text-xs text-muted-foreground mt-2">Nhân viên sẽ làm ca này tất cả các ngày trong tuần.</p>
        </div>
      ) : scheduleData.type === 'custom' ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Chọn ca cho từng ngày trong tuần:</p>
          {DAYS.map(day => (
            <div key={day} className="flex items-center gap-3">
              <span className="text-sm font-medium w-16">{DAY_LABELS[day]}</span>
              <Select
                value={scheduleData.customDays?.[day] || '_off'}
                onValueChange={v => {
                  const customDays = { ...(scheduleData.customDays || {}) };
                  if (v === '_off') delete customDays[day];
                  else customDays[day] = v;
                  onChange({ ...scheduleData, customDays });
                }}
              >
                <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_off">Nghỉ</SelectItem>
                  {shifts.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      ) : (
        /* Weekly mode */
        <div className="space-y-3">
          {/* Week navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWeekStart(prev => addDays(prev, -7))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">
              {format(weekStart, 'dd/MM', { locale: vi })} - {format(addDays(weekStart, 6), 'dd/MM/yyyy', { locale: vi })}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWeekStart(prev => addDays(prev, 7))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Copy last week */}
          <Button variant="outline" size="sm" className="w-full" onClick={handleCopyLastWeek}>
            <Copy className="h-3.5 w-3.5 mr-1.5" />
            Copy tuần trước
          </Button>

          {/* Days */}
          <div className="space-y-2">
            {weekDays.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const dayLabel = format(day, 'EEEE', { locale: vi });
              const dateLabel = format(day, 'dd/MM');
              const currentValue = getWeeklyShiftForDate(dateStr);

              return (
                <div key={dateStr} className="flex items-center gap-3">
                  <div className="min-w-[80px]">
                    <p className="text-sm font-medium capitalize">{dayLabel}</p>
                    <p className="text-xs text-muted-foreground">{dateLabel}</p>
                  </div>
                  <Select
                    value={currentValue}
                    onValueChange={v => handleWeeklyDayChange(dateStr, v)}
                  >
                    <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_off">Nghỉ</SelectItem>
                      {shifts.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-muted-foreground">
            💡 Chọn ca cho từng ngày cụ thể. Dùng nút mũi tên để chuyển tuần, hoặc "Copy tuần trước" để sao chép lịch.
          </p>
        </div>
      )}
    </div>
  );
}
