import * as React from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScrollableTableWrapperProps {
  children: React.ReactNode;
  className?: string;
}

export function ScrollableTableWrapper({ children, className }: ScrollableTableWrapperProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);

  const checkScroll = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollWidth - el.scrollLeft - el.clientWidth > 10);
  }, []);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      ro.disconnect();
    };
  }, [checkScroll]);

  const scroll = (direction: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: direction === 'right' ? 300 : -300, behavior: 'smooth' });
  };

  const buttonClass =
    'absolute top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-9 h-9 rounded-full bg-primary text-primary-foreground shadow-lg cursor-pointer transition-transform hover:scale-110 active:scale-95';

  return (
    <div className={cn('relative', className)}>
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className={cn(buttonClass, 'left-1')}
          aria-label="Cuộn sang trái"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      <div ref={scrollRef} className="overflow-x-auto">
        {children}
      </div>
      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className={cn(buttonClass, 'right-1')}
          aria-label="Cuộn sang phải"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
