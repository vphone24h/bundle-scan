import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface HelpTipProps {
  content: string;
  className?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  iconSize?: string;
}

export function HelpTip({ content, className, side = 'bottom', iconSize = 'h-4 w-4' }: HelpTipProps) {
  const isMobile = useIsMobile();

  const triggerButton = (
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
  );

  // Mobile: use Popover (tap to open/close)
  if (isMobile) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          {triggerButton}
        </PopoverTrigger>
        <PopoverContent side={side} className="max-w-xs text-sm leading-relaxed p-3">
          <p>{content}</p>
        </PopoverContent>
      </Popover>
    );
  }

  // Desktop: use Tooltip (hover)
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          {triggerButton}
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs text-sm leading-relaxed">
          <p>{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
