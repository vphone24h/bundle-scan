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

  const rafRef = React.useRef<number>(0);
  const checkScroll = React.useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) {
        setCanScrollLeft(el.scrollLeft > 10);
        setCanScrollRight(el.scrollWidth - el.scrollLeft - el.clientWidth > 10);
      }
      rafRef.current = 0;
    });
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

  const buttonBase =
    'absolute z-10 flex items-center justify-center w-9 h-9 rounded-full bg-primary text-primary-foreground shadow-lg cursor-pointer transition-transform hover:scale-110 active:scale-95';

  const positions = ['top-[20%]', 'top-1/2', 'top-[80%]'];

  return (
    <div className={cn('relative', className)}>
      {canScrollLeft && positions.map((pos) => (
        <button
          key={`left-${pos}`}
          onClick={() => scroll('left')}
          className={cn(buttonBase, '-translate-y-1/2 left-1', pos)}
          aria-label="Cuộn sang trái"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      ))}
      <div ref={scrollRef} className="overflow-x-auto">
        {children}
      </div>
      {canScrollRight && positions.map((pos) => (
        <button
          key={`right-${pos}`}
          onClick={() => scroll('right')}
          className={cn(buttonBase, '-translate-y-1/2 right-1', pos)}
          aria-label="Cuộn sang phải"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      ))}
    </div>
  );
}
