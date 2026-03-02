import { useState, useRef, useCallback, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface PullToRefreshProps {
  children: ReactNode;
}

export function PullToRefresh({ children }: PullToRefreshProps) {
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const THRESHOLD = 80;

  const isAtTop = useCallback(() => {
    // Check if the page is scrolled to top
    return window.scrollY <= 0;
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (refreshing) return;
    if (isAtTop()) {
      startY.current = e.touches[0].clientY;
      setPulling(true);
    }
  }, [refreshing, isAtTop]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling || refreshing) return;
    if (!isAtTop()) {
      setPulling(false);
      setPullDistance(0);
      return;
    }
    const currentY = e.touches[0].clientY;
    const diff = Math.max(0, currentY - startY.current);
    // Diminishing pull effect
    const distance = Math.min(diff * 0.4, 120);
    setPullDistance(distance);
  }, [pulling, refreshing, isAtTop]);

  const handleTouchEnd = useCallback(() => {
    if (!pulling) return;
    setPulling(false);

    if (pullDistance >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPullDistance(THRESHOLD);
      // Reload the page data by using router refresh
      window.location.reload();
    } else {
      setPullDistance(0);
    }
  }, [pulling, pullDistance, refreshing]);

  const progress = Math.min(pullDistance / THRESHOLD, 1);

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative"
    >
      {/* Pull indicator */}
      <div
        className="absolute left-0 right-0 flex items-center justify-center z-50 pointer-events-none overflow-hidden transition-opacity"
        style={{
          top: -40 + pullDistance,
          height: 40,
          opacity: progress,
        }}
      >
        <div className="bg-background border rounded-full p-2 shadow-md">
          <Loader2
            className={`h-5 w-5 text-primary ${refreshing ? 'animate-spin' : ''}`}
            style={{
              transform: refreshing ? undefined : `rotate(${progress * 360}deg)`,
              transition: pulling ? 'none' : 'transform 0.2s',
            }}
          />
        </div>
      </div>

      {/* Content with pull offset */}
      <div
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined,
          transition: pulling ? 'none' : 'transform 0.3s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
}
