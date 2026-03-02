import * as React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScrollableTableWrapperProps {
  children: React.ReactNode;
  className?: string;
}

export function ScrollableTableWrapper({ children, className }: ScrollableTableWrapperProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [canScrollRight, setCanScrollRight] = React.useState(false);

  const checkScroll = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
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

  const scrollRight = () => {
    scrollRef.current?.scrollBy({ left: 300, behavior: 'smooth' });
  };

  return (
    <div className={cn('relative', className)}>
      <div ref={scrollRef} className="overflow-x-auto">
        {children}
      </div>
      {canScrollRight && (
        <button
          onClick={scrollRight}
          className="absolute right-0 top-0 bottom-0 w-10 flex items-center justify-center bg-gradient-to-l from-card via-card/80 to-transparent cursor-pointer z-10 transition-opacity hover:opacity-100 opacity-80"
          aria-label="Cuộn sang phải"
        >
          <div className="bg-primary/10 border border-primary/20 rounded-full p-1.5 animate-pulse">
            <ChevronRight className="h-4 w-4 text-primary" />
          </div>
        </button>
      )}
    </div>
  );
}
