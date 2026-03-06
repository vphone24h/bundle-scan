import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Check } from 'lucide-react';

interface DateRangeApplyFilterProps {
  startDate: string;
  endDate: string;
  onApply: (startDate: string, endDate: string) => void;
  isLoading?: boolean;
  className?: string;
  /** Label size variant */
  labelClassName?: string;
  inputClassName?: string;
  /** Layout: 'inline' for side-by-side, 'stacked' for grid */
  layout?: 'inline' | 'stacked';
}

export function DateRangeApplyFilter({
  startDate,
  endDate,
  onApply,
  isLoading = false,
  className = '',
  labelClassName = '',
  inputClassName = '',
  layout = 'inline',
}: DateRangeApplyFilterProps) {
  const [draftStart, setDraftStart] = useState(startDate);
  const [draftEnd, setDraftEnd] = useState(endDate);
  const [hasChanges, setHasChanges] = useState(false);

  // Sync draft with external changes (e.g. time presets)
  useEffect(() => {
    setDraftStart(startDate);
    setDraftEnd(endDate);
    setHasChanges(false);
  }, [startDate, endDate]);

  const handleStartChange = (val: string) => {
    setDraftStart(val);
    setHasChanges(val !== startDate || draftEnd !== endDate);
  };

  const handleEndChange = (val: string) => {
    setDraftEnd(val);
    setHasChanges(draftStart !== startDate || val !== endDate);
  };

  const handleApply = () => {
    onApply(draftStart, draftEnd);
    setHasChanges(false);
  };

  if (layout === 'stacked') {
    return (
      <div className={`grid grid-cols-[1fr_1fr_auto] gap-3 items-end ${className}`}>
        <div className="space-y-1">
          <Label className={labelClassName || 'text-xs'}>Từ ngày</Label>
          <Input
            type="date"
            value={draftStart}
            onChange={(e) => handleStartChange(e.target.value)}
            className={inputClassName}
          />
        </div>
        <div className="space-y-1">
          <Label className={labelClassName || 'text-xs'}>Đến ngày</Label>
          <Input
            type="date"
            value={draftEnd}
            onChange={(e) => handleEndChange(e.target.value)}
            className={inputClassName}
          />
        </div>
        <Button
          size="sm"
          onClick={handleApply}
          disabled={isLoading || (!hasChanges && !isLoading)}
          className="h-9 px-3 gap-1.5"
          variant={hasChanges ? 'default' : 'outline'}
        >
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          <span className="text-xs">Áp dụng</span>
        </Button>
      </div>
    );
  }

  return (
    <div className={`flex gap-2 items-end ${className}`}>
      <div>
        <Label className={labelClassName}>Từ ngày</Label>
        <Input
          type="date"
          value={draftStart}
          onChange={(e) => handleStartChange(e.target.value)}
          className={inputClassName || 'w-40'}
        />
      </div>
      <div>
        <Label className={labelClassName}>Đến ngày</Label>
        <Input
          type="date"
          value={draftEnd}
          onChange={(e) => handleEndChange(e.target.value)}
          className={inputClassName || 'w-40'}
        />
      </div>
      <Button
        size="sm"
        onClick={handleApply}
        disabled={isLoading || (!hasChanges && !isLoading)}
        className="h-9 px-3 gap-1.5 mb-[1px]"
        variant={hasChanges ? 'default' : 'outline'}
      >
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Check className="h-3.5 w-3.5" />
        )}
        <span className="text-xs">Áp dụng</span>
      </Button>
    </div>
  );
}
