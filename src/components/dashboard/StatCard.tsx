import { forwardRef, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
  onClick?: () => void;
}

export const StatCard = forwardRef<HTMLDivElement, StatCardProps>(
  ({ title, value, icon, trend, className, onClick }, ref) => {
    // Check if value is a long currency string (for mobile optimization)
    const valueStr = String(value);
    const isLongValue = valueStr.length > 10;

    return (
      <div ref={ref} className={cn('stat-card p-3 sm:p-4 lg:p-6', className)} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] sm:text-xs lg:text-sm font-medium text-muted-foreground line-clamp-1">{title}</p>
            <p 
              className={cn(
                'mt-1 sm:mt-2 font-bold text-foreground break-all',
                isLongValue 
                  ? 'text-base sm:text-xl lg:text-2xl leading-tight' 
                  : 'text-lg sm:text-2xl lg:text-3xl'
              )}
            >
              {value}
            </p>
            {trend && (
              <p
                className={cn(
                  'mt-1 sm:mt-2 text-[10px] sm:text-xs lg:text-sm font-medium',
                  trend.isPositive ? 'text-success' : 'text-destructive'
                )}
              >
                {trend.isPositive ? '+' : ''}{trend.value}%
              </p>
            )}
          </div>
          <div className="flex h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
        </div>
      </div>
    );
  }
);

StatCard.displayName = 'StatCard';
