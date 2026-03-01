import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface VerifiedBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const VerifiedBadge = ({ size = 'md', className = '' }: VerifiedBadgeProps) => {
  const [open, setOpen] = useState(false);

  const sizeMap = {
    sm: 14,
    md: 18,
    lg: 22,
  };

  const s = sizeMap[size];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
          className={`inline-flex items-center shrink-0 ${className}`}
          aria-label="Tài khoản đã xác minh"
        >
          <svg width={s} height={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12 2L14.09 4.09L17 3L17.91 5.91L21 6.91L20 10L22 12L20 14L21 17.09L17.91 18L17 21L14.09 20L12 22L9.91 20L7 21L6.09 18L3 17.09L4 14L2 12L4 10L3 6.91L6.09 5.91L7 3L9.91 4.09L12 2Z"
              fill="#1D9BF0"
            />
            <path
              d="M9.5 12.5L11 14L15 10"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        className="w-auto max-w-[220px] p-3 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-semibold">Đã xác minh</p>
        <p className="text-xs text-muted-foreground mt-1">Huy hiệu xác minh tài khoản thật.</p>
      </PopoverContent>
    </Popover>
  );
};
