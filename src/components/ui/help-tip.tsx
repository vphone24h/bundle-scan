import { HelpCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface HelpTipProps {
  content: string;
  className?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  iconSize?: string;
}

export function HelpTip({ content, className, side = 'bottom', iconSize = 'h-4 w-4' }: HelpTipProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-primary transition-colors focus:outline-none',
              className
            )}
            aria-label="Hướng dẫn"
          >
            <HelpCircle className={iconSize} />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs text-sm leading-relaxed">
          <p>{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
