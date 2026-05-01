import { useState, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Copy } from 'lucide-react';
import { format, addDays, startOfWeek, eachDayOfInterval, subWeeks, startOfMonth, endOfMonth, addMonths, startOfYear, endOfYear, addYears } from 'date-fns';
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

  // Weekly mode: range type (week | month | year)
  const [rangeType, setRangeType] = useState<'week' | 'month' | 'year'>('week');
  const [anchorDate, setAnchorDate] = useState<Date>(() => new Date());

  const { rangeStart, rangeEnd, rangeLabel } = useMemo(() => {
    if (rangeType === 'week') {
      const s = startOfWeek(anchorDate, { weekStartsOn: 1 });
      const e = addDays(s, 6);
      return { rangeStart: s, rangeEnd: e, rangeLabel: `${format(s, 'dd/MM')} - ${format(e, 'dd/MM/yyyy')}` };
    }
    if (rangeType === 'month') {
      const s = startOfMonth(anchorDate);
      const e = endOfMonth(anchorDate);
      return { rangeStart: s, rangeEnd: e, rangeLabel: format(s, 'MM/yyyy') };
    }
    const s = startOfYear(anchorDate);
    const e = endOfYear(anchorDate);
    return { rangeStart: s, rangeEnd: e, rangeLabel: format(s, 'yyyy') };
  }, [rangeType, anchorDate]);

  const rangeDays = useMemo(
    () => eachDayOfInterval({ start: rangeStart, end: rangeEnd }),
    [rangeStart, rangeEnd]
  );

  const moveRange = (dir: -1 | 1) => {
    if (rangeType === 'week') setAnchorDate(prev => addDays(prev, dir * 7));
    else if (rangeType === 'month') setAnchorDate(prev => addMonths(prev, dir));
    else setAnchorDate(prev => addYears(prev, dir));
  };

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

  /** Áp dụng nhanh ca đã chọn (selectedShiftId) cho toàn bộ ngày trong khoảng đang xem */
  const handleFillRange = () => {
    if (!selectedShiftId) return;
    const weeklyDays = { ...(scheduleData.weeklyDays || {}) };
    rangeDays.forEach(d => { weeklyDays[format(d, 'yyyy-MM-dd')] = selectedShiftId; });
    onChange({ ...scheduleData, weeklyDays });
  };

  /** Xóa toàn bộ ca trong khoảng đang xem (đặt về Nghỉ) */
  const handleClearRange = () => {
    const weeklyDays = { ...(scheduleData.weeklyDays || {}) };
    rangeDays.forEach(d => { delete weeklyDays[format(d, 'yyyy-MM-dd')]; });
    onChange({ ...scheduleData, weeklyDays });
  };

  /** Copy lịch từ kỳ trước (tuần/tháng/năm trước) sang kỳ hiện tại theo offset */
  const handleCopyPrev = () => {
    const offsetDays = rangeType === 'week' ? -7 : 0;
    const prevStart = rangeType === 'week'
      ? subWeeks(rangeStart, 1)
      : rangeType === 'month'
        ? startOfMonth(addMonths(rangeStart, -1))
        : startOfYear(addYears(rangeStart, -1));
    const prevEnd = rangeType === 'week'
      ? addDays(prevStart, 6)
      : rangeType === 'month'
        ? endOfMonth(prevStart)
        : endOfYear(prevStart);
    const prevDays = eachDayOfInterval({ start: prevStart, end: prevEnd });
    const weeklyDays = { ...(scheduleData.weeklyDays || {}) };
    // Map theo index ngày (giữ thứ tự dd)
    rangeDays.forEach((d, idx) => {
      const src = prevDays[idx];
      if (!src) return;
      const srcStr = format(src, 'yyyy-MM-dd');
      const dstStr = format(d, 'yyyy-MM-dd');
      const shiftFromPrev = weeklyDays[srcStr] || existingMap.get(srcStr);
      if (shiftFromPrev) weeklyDays[dstStr] = shiftFromPrev;
      else delete weeklyDays[dstStr];
    });
    void offsetDays;
    onChange({ ...scheduleData, weeklyDays });
  };

  const getWeeklyShiftForDate = (dateStr: string): string => {
    return scheduleData.weeklyDays?.[dateStr] || existingMap.get(dateStr) || '_off';
  };

  // Đếm số ngày đã xếp trong khoảng đang xem
  const assignedCount = useMemo(() => {
    return rangeDays.filter(d => {
      const v = getWeeklyShiftForDate(format(d, 'yyyy-MM-dd'));
      return v !== '_off';
    }).length;
  }, [rangeDays, scheduleData.weeklyDays, existingMap]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-xs">Kiểu lịch trình</Label>
        <Select
          value={scheduleData.type}
          onValueChange={(v: 'fixed' | 'custom' | 'weekly' | 'flexible') => onChange({ ...scheduleData, type: v })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="fixed">Cố định (cùng ca mỗi ngày)</SelectItem>
            <SelectItem value="custom">Tùy chỉnh (khác ca mỗi ngày)</SelectItem>
            <SelectItem value="weekly">Theo lịch cụ thể (Tuần/Tháng/Năm)</SelectItem>
            <SelectItem value="flexible">Tự do — Theo giờ (không cần xếp lịch)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {scheduleData.type === 'flexible' ? (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
          <p className="text-sm font-semibold text-primary">⏱️ Chế độ làm việc theo giờ tự do</p>
          <p className="text-xs text-muted-foreground">
            Phù hợp cho nhân viên <strong>part-time / lương theo giờ</strong>. Nhân viên không cần được xếp lịch trước:
          </p>
          <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
            <li>Đến cửa hàng <strong>check-in</strong> → bắt đầu tính giờ.</li>
            <li>Khi về <strong>check-out</strong> → kết thúc tính giờ.</li>
            <li>Hệ thống tự cộng tổng số giờ làm trong kỳ và <strong>tính lương = số giờ × đơn giá/giờ</strong> trong mẫu lương.</li>
            <li>Không có khái niệm đi muộn / vắng mặt — chỉ tính theo giờ thực tế.</li>
          </ul>
          <p className="text-[11px] text-muted-foreground italic">
            💡 Hãy đảm bảo mẫu lương ở bước sau có loại <strong>"Lương theo giờ"</strong> và <strong>tắt tăng ca</strong>.
          </p>
        </div>
      ) : scheduleData.type === 'fixed' ? (
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
          {/* Range type toggle */}
          <div className="flex items-center gap-1 rounded-md border p-0.5 bg-muted/30 w-fit">
            {(['week', 'month', 'year'] as const).map(t => (
              <Button
                key={t}
                variant={rangeType === t ? 'default' : 'ghost'}
                size="sm"
                className="h-7 text-xs px-3"
                onClick={() => setRangeType(t)}
              >
                {t === 'week' ? 'Tuần' : t === 'month' ? 'Tháng' : 'Năm'}
              </Button>
            ))}
          </div>

          {/* Range navigator */}
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => moveRange(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center">
              <div className="text-sm font-medium">{rangeLabel}</div>
              <div className="text-[11px] text-muted-foreground">
                Đã xếp {assignedCount}/{rangeDays.length} ngày
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => moveRange(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Bulk actions */}
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" size="sm" className="text-xs" onClick={handleFillRange} disabled={!selectedShiftId}>
              Áp ca cho cả kỳ
            </Button>
            <Button variant="outline" size="sm" className="text-xs" onClick={handleCopyPrev}>
              <Copy className="h-3 w-3 mr-1" /> Copy kỳ trước
            </Button>
            <Button variant="outline" size="sm" className="text-xs text-destructive" onClick={handleClearRange}>
              Xóa hết (nghỉ)
            </Button>
          </div>

          {/* Days list (scrollable for long ranges) */}
          <div className={`space-y-1.5 ${rangeType === 'week' ? '' : 'max-h-[420px] overflow-y-auto pr-1 border rounded-md p-2'}`}>
            {rangeDays.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const dayLabel = format(day, 'EEE', { locale: vi });
              const dateLabel = format(day, 'dd/MM/yyyy');
              const currentValue = getWeeklyShiftForDate(dateStr);
              const isOff = currentValue === '_off';

              return (
                <div key={dateStr} className={`flex items-center gap-2 rounded-md px-2 py-1 ${isOff ? 'bg-muted/30' : 'bg-primary/5'}`}>
                  <div className="min-w-[110px]">
                    <p className="text-xs font-medium capitalize">{dayLabel} {dateLabel}</p>
                  </div>
                  <Select
                    value={currentValue}
                    onValueChange={v => handleWeeklyDayChange(dateStr, v)}
                  >
                    <SelectTrigger className="flex-1 h-8 text-xs"><SelectValue /></SelectTrigger>
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
            💡 Chọn phạm vi Tuần/Tháng/Năm rồi xếp ca cho từng ngày. Ngày không xếp sẽ tính là <strong>nghỉ</strong>.
            Trên trang <strong>Xếp ca tổng quan</strong> sẽ hiện đếm số người đi làm/nghỉ tương ứng.
          </p>
        </div>
      )}
    </div>
  );
}
