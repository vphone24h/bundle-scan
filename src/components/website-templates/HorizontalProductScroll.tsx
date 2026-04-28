import { useRef, useState, useEffect, useCallback, ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface HorizontalProductScrollProps {
  children: ReactNode;
  className?: string;
}

/**
 * Wrapper cho slider sản phẩm cuộn ngang.
 * - Mobile: vẫn vuốt như cũ, không hiện nút.
 * - Desktop (sm+): hiện nút mũi tên trái/phải khi có thể cuộn.
 */
export function HorizontalProductScroll({ children, className = '' }: HorizontalProductScrollProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanLeft(scrollLeft > 4);
    setCanRight(scrollLeft + clientWidth < scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateButtons();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateButtons, { passive: true });
    window.addEventListener('resize', updateButtons);
    // Re-check after children render
    const t = setTimeout(updateButtons, 200);
    return () => {
      el.removeEventListener('scroll', updateButtons);
      window.removeEventListener('resize', updateButtons);
      clearTimeout(t);
    };
  }, [updateButtons, children]);

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = Math.max(el.clientWidth * 0.8, 220);
    el.scrollBy({ left: dir * amount, behavior: 'smooth' });
  };

  return (
    <div className="relative group">
      <div
        ref={scrollRef}
        className={`flex gap-4 overflow-x-auto pb-4 scrollbar-hide scroll-smooth ${className}`}
      >
        {children}
      </div>

      {/* Nút trái - chỉ hiện desktop */}
      <button
        type="button"
        aria-label="Cuộn trái"
        onClick={() => scrollBy(-1)}
        className={`hidden sm:flex absolute left-1 top-1/2 -translate-y-1/2 z-10 h-10 w-10 items-center justify-center rounded-full bg-white/95 shadow-lg border border-gray-200 hover:bg-white transition-opacity ${canLeft ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <ChevronLeft className="h-5 w-5 text-gray-700" />
      </button>

      {/* Nút phải - chỉ hiện desktop */}
      <button
        type="button"
        aria-label="Cuộn phải"
        onClick={() => scrollBy(1)}
        className={`hidden sm:flex absolute right-1 top-1/2 -translate-y-1/2 z-10 h-10 w-10 items-center justify-center rounded-full bg-white/95 shadow-lg border border-gray-200 hover:bg-white transition-opacity ${canRight ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <ChevronRight className="h-5 w-5 text-gray-700" />
      </button>
    </div>
  );
}
