import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Shift {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  break_minutes?: number | null;
}

interface Props {
  shifts: Shift[];
  selectedShiftId: string;
  onSelect: (id: string) => void;
}

export function StepAssignShift({ shifts, selectedShiftId, onSelect }: Props) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Chọn ca làm việc cho nhân viên hoặc bỏ qua để gán sau.
      </p>

      {shifts.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Chưa có ca làm việc nào. Bạn có thể tạo ở module Chấm công & Ca làm.
        </div>
      ) : (
        <div className="grid gap-2">
          {shifts.map(shift => {
            const isSelected = selectedShiftId === shift.id;
            return (
              <Card
                key={shift.id}
                className={cn(
                  'cursor-pointer transition-all hover:shadow-sm',
                  isSelected && 'ring-2 ring-primary border-primary',
                )}
                onClick={() => onSelect(isSelected ? '' : shift.id)}
              >
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{shift.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {shift.start_time} - {shift.end_time}
                        {shift.break_minutes ? ` • Nghỉ ${shift.break_minutes} phút` : ''}
                      </p>
                    </div>
                  </div>
                  {isSelected && (
                    <Badge variant="default" className="gap-1">
                      <Check className="h-3 w-3" />Đã chọn
                    </Badge>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
