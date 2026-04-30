import { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CalendarDays, AlertCircle } from 'lucide-react';

interface Props {
  /** Số ngày nghỉ có lương / tháng yêu cầu (từ mẫu lương) */
  requiredDays: number;
  /** Mảng ngày 1-31 đã chọn */
  selectedDays: number[];
  onChange: (days: number[]) => void;
  className?: string;
}

/**
 * Grid chọn ngày nghỉ có lương cố định trong tháng (1-31).
 * Áp dụng lặp lại mỗi tháng. Admin có thể override theo từng tháng riêng nếu cần.
 */
export function PaidLeaveDaysPicker({ requiredDays, selectedDays, onChange, className }: Props) {
  const days = useMemo(() => Array.from({ length: 31 }, (_, i) => i + 1), []);
  const selectedSet = useMemo(() => new Set(selectedDays), [selectedDays]);
  const isComplete = selectedDays.length === requiredDays;
  const isOver = selectedDays.length > requiredDays;

  const toggle = (day: number) => {
    if (selectedSet.has(day)) {
      onChange(selectedDays.filter(d => d !== day));
    } else {
      if (selectedDays.length >= requiredDays) {
        // Đã đủ - thay ngày cũ nhất
        onChange([...selectedDays.slice(1), day].sort((a, b) => a - b));
      } else {
        onChange([...selectedDays, day].sort((a, b) => a - b));
      }
    }
  };

  if (requiredDays <= 0) return null;

  return (
    <div className={cn('space-y-2 rounded-lg border p-3 bg-muted/20', className)}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Label className="text-xs flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" />
          Ngày nghỉ có lương (lặp hàng tháng)
        </Label>
        <Badge
          variant={isComplete ? 'default' : isOver ? 'destructive' : 'outline'}
          className="text-[10px]"
        >
          Đã chọn {selectedDays.length}/{requiredDays}
        </Badge>
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Mẫu lương cho phép nghỉ <strong>{requiredDays}</strong> ngày có lương/tháng. Chọn đúng <strong>{requiredDays}</strong> ngày trong tháng (vd ngày 5, 15) — sẽ được áp dụng tự động mọi tháng.
        Nếu NV vẫn đến chấm công vào ngày này → tự động đề xuất tăng ca cả ngày, cần admin duyệt mới được tính.
      </p>

      <div className="grid grid-cols-7 gap-1.5 pt-1">
        {days.map(day => {
          const sel = selectedSet.has(day);
          return (
            <button
              key={day}
              type="button"
              onClick={() => toggle(day)}
              className={cn(
                'h-8 rounded text-xs font-medium border transition-colors',
                sel
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background hover:bg-accent border-input',
              )}
            >
              {day}
            </button>
          );
        })}
      </div>

      {!isComplete && (
        <div className="flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 pt-1">
          <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
          <span>Vui lòng chọn đúng {requiredDays} ngày trước khi lưu.</span>
        </div>
      )}
    </div>
  );
}
