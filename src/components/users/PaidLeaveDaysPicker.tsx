import { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CalendarDays, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { addMonths, format, getDaysInMonth } from 'date-fns';
import { vi } from 'date-fns/locale';
import { getPaidLeaveDaysForMonth, getPaidLeaveMonthKey, type PaidLeaveOverrideMap } from '@/lib/paidLeaveSchedule';

interface Props {
  /** Số ngày nghỉ có lương / tháng cho phép (từ mẫu lương). Đây là HẠN MỨC, không bắt buộc chọn đủ. */
  requiredDays: number;
  /** Mảng ngày mặc định 1-31 đã chọn */
  selectedDays: number[];
  referenceMonth: string;
  overrides?: PaidLeaveOverrideMap;
  onChange: (payload: {
    defaultDays: number[];
    referenceMonth: string;
    overrides: PaidLeaveOverrideMap;
  }) => void;
  className?: string;
}

/**
 * Grid chọn ngày nghỉ có lương cố định trong tháng (1-31).
 * Áp dụng lặp lại mỗi tháng. Admin có thể override theo từng tháng riêng nếu cần.
 */
export function PaidLeaveDaysPicker({ requiredDays, selectedDays, referenceMonth, overrides = {}, onChange, className }: Props) {
  const monthDate = useMemo(() => {
    const [year, month] = referenceMonth.split('-').map(Number);
    return new Date(year || new Date().getFullYear(), (month || 1) - 1, 1);
  }, [referenceMonth]);
  const monthKey = getPaidLeaveMonthKey(monthDate);
  const daysInMonth = getDaysInMonth(monthDate);
  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);
  const activeDays = useMemo(
    () => getPaidLeaveDaysForMonth({ monthDate, overrides, defaultDays: selectedDays }),
    [monthDate, overrides, selectedDays]
  );
  const selectedSet = useMemo(() => new Set(activeDays), [activeDays]);
  const isOver = activeDays.length > requiredDays;

  const toggle = (day: number) => {
    const currentDays = activeDays;
    const nextDays = selectedSet.has(day)
      ? currentDays.filter(d => d !== day)
      : currentDays.length >= requiredDays
        ? [...currentDays.slice(1), day].sort((a, b) => a - b)
        : [...currentDays, day].sort((a, b) => a - b);

    const nextOverrides = {
      ...overrides,
      [monthKey]: nextDays,
    };

    if (nextDays.length === 0) {
      delete nextOverrides[monthKey];
    }

    onChange({
      defaultDays: selectedDays,
      referenceMonth,
      overrides: nextOverrides,
    });
  };

  const moveMonth = (amount: number) => {
    const nextMonth = getPaidLeaveMonthKey(addMonths(monthDate, amount));
    onChange({
      defaultDays: selectedDays,
      referenceMonth: nextMonth,
      overrides,
    });
  };

  const saveAsDefault = () => {
    onChange({
      defaultDays: activeDays,
      referenceMonth,
      overrides: {
        ...overrides,
        [monthKey]: activeDays,
      },
    });
  };

  if (requiredDays <= 0) return null;

  return (
    <div className={cn('space-y-2 rounded-lg border p-3 bg-muted/20', className)}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Label className="text-xs flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" />
          Ngày nghỉ có lương theo tháng (tuỳ chọn)
        </Label>
        <Badge
          variant={isOver ? 'destructive' : 'outline'}
          className="text-[10px]"
        >
          Đã chọn {activeDays.length}/{requiredDays} (tối đa)
        </Badge>
      </div>
      <div className="flex items-center justify-between gap-2 rounded-md border bg-background/80 p-2">
        <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => moveMonth(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 text-center">
          <div className="text-sm font-medium">{format(monthDate, "'Tháng' M yyyy", { locale: vi })}</div>
          <div className="text-[11px] text-muted-foreground">Nhấn mũi tên để chuyển tháng trước / sau</div>
        </div>
        <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => moveMonth(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Mẫu lương cho phép tối đa <strong>{requiredDays}</strong> ngày nghỉ có lương/tháng. Bạn <strong>không bắt buộc</strong> chọn trước —
        khi nhân viên xin nghỉ trong "Công của tôi", hệ thống sẽ tự ghi nhận. Nếu nhân viên đi làm full không nghỉ ngày nào,
        số ngày phép dư sẽ tự cộng vào tăng ca theo hệ số đã cấu hình.
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

      <div className="flex items-center justify-between gap-2 rounded-md border border-dashed p-2 text-[11px]">
        <span className="text-muted-foreground">Muốn dùng tháng này làm mẫu cho các tháng khác chưa chỉnh?</span>
        <Button type="button" variant="outline" size="sm" className="h-7 text-[11px]" onClick={saveAsDefault}>
          Dùng làm mặc định
        </Button>
      </div>

      {isOver && (
        <div className="flex items-start gap-1.5 text-[11px] text-destructive pt-1">
          <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
          <span>Đã vượt quá {requiredDays} ngày cho phép. Hệ thống sẽ chỉ tính tối đa {requiredDays} ngày.</span>
        </div>
      )}
    </div>
  );
}
