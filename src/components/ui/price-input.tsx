import * as React from 'react';
import { cn } from '@/lib/utils';
import { formatInputNumber, parseFormattedNumber } from '@/lib/formatNumber';

export interface PriceInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number | string;
  onChange: (value: number) => void;
  suffix?: string;
}

const PriceInput = React.forwardRef<HTMLInputElement, PriceInputProps>(
  ({ className, value, onChange, suffix = 'đ', ...props }, ref) => {
    // Convert numeric value to formatted display string
    const displayValue = React.useMemo(() => {
      if (value === '' || value === 0) return '';
      const numValue = typeof value === 'string' ? parseFormattedNumber(value) : value;
      return formatInputNumber(numValue.toString());
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      // Remove all non-digit characters and parse
      const numericValue = parseFormattedNumber(inputValue);
      onChange(numericValue);
    };

    return (
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          className={cn(
            'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
            suffix && 'pr-7',
            className
          )}
          ref={ref}
          value={displayValue}
          onChange={handleChange}
          {...props}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    );
  }
);
PriceInput.displayName = 'PriceInput';

export { PriceInput };
