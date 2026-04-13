import { cn } from '@/lib/utils';

interface Props {
  count: number;
  className?: string;
}

/** Small red notification dot/badge for tabs */
export function PendingBadge({ count, className }: Props) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold leading-none rounded-full bg-destructive text-destructive-foreground',
        className,
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
