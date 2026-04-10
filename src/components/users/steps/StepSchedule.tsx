import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { ScheduleData } from '../CreateEmployeeStepper';

interface Shift { id: string; name: string; start_time: string; end_time: string; }

interface Props {
  scheduleData: ScheduleData;
  onChange: (d: ScheduleData) => void;
  shifts: Shift[];
  selectedShiftId: string;
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS: Record<string, string> = {
  monday: 'Thứ 2', tuesday: 'Thứ 3', wednesday: 'Thứ 4',
  thursday: 'Thứ 5', friday: 'Thứ 6', saturday: 'Thứ 7', sunday: 'CN',
};

export function StepSchedule({ scheduleData, onChange, shifts, selectedShiftId }: Props) {
  const selectedShift = shifts.find(s => s.id === selectedShiftId);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-xs">Kiểu lịch trình</Label>
        <Select value={scheduleData.type} onValueChange={(v: 'fixed' | 'custom') => onChange({ ...scheduleData, type: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="fixed">Cố định (cùng ca mỗi ngày)</SelectItem>
            <SelectItem value="custom">Tùy chỉnh (khác ca mỗi ngày)</SelectItem>
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
      ) : (
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
      )}
    </div>
  );
}
