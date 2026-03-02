import { useRef, useCallback, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface PullToRefreshProps {
  children: ReactNode;
}

export function PullToRefresh({ children }: PullToRefreshProps) {
  const pullRef = useRef(0);
  const startYRef = useRef(0);
  const pullingRef = useRef(false);
  const refreshingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);

  const THRESHOLD = 80;

  const updateVisuals = useCallback((distance: number, isPulling: boolean) => {
    const progress = Math.min(distance / THRESHOLD, 1);

    if (indicatorRef.current) {
      indicatorRef.current.style.transform = `translateY(${distance - 44}px)`;
      indicatorRef.current.style.opacity = String(progress);
      indicatorRef.current.style.transition = isPulling ? 'none' : 'transform 0.35s cubic-bezier(0.2,0.9,0.3,1), opacity 0.25s ease';
    }
    if (contentRef.current) {
      contentRef.current.style.transform = distance > 0 ? `translateY(${distance}px)` : '';
      contentRef.current.style.transition = isPulling ? 'none' : 'transform 0.35s cubic-bezier(0.2,0.9,0.3,1)';
    }
    if (iconRef.current && !refreshingRef.current) {
      iconRef.current.style.transform = `rotate(${progress * 540}deg) scale(${0.6 + progress * 0.4})`;
      iconRef.current.style.transition = isPulling ? 'none' : 'transform 0.3s ease';
    }
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (refreshingRef.current) return;
    if (window.scrollY <= 0) {
      startYRef.current = e.touches[0].clientY;
      pullingRef.current = true;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pullingRef.current || refreshingRef.current) return;
    if (window.scrollY > 0) {
      pullingRef.current = false;
      pullRef.current = 0;
      updateVisuals(0, false);
      return;
    }
    const diff = Math.max(0, e.touches[0].clientY - startYRef.current);
    // Rubber-band diminishing effect
    const distance = Math.min(diff * 0.45, 130);
    pullRef.current = distance;
    updateVisuals(distance, true);
  }, [updateVisuals]);

  const handleTouchEnd = useCallback(() => {
    if (!pullingRef.current) return;
    pullingRef.current = false;

    if (pullRef.current >= THRESHOLD && !refreshingRef.current) {
      refreshingRef.current = true;
      pullRef.current = 56;
      updateVisuals(56, false);
      // Add spin class
      if (iconRef.current) {
        iconRef.current.style.transform = 'rotate(0deg) scale(1)';
        iconRef.current.style.transition = 'none';
        iconRef.current.classList.add('animate-spin');
      }
      // Small delay for visual feedback then reload
      setTimeout(() => window.location.reload(), 600);
    } else {
      pullRef.current = 0;
      updateVisuals(0, false);
    }
  }, [updateVisuals]);

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative"
    >
      {/* Pull indicator - positioned absolutely, starts hidden above */}
      <div
        ref={indicatorRef}
        className="absolute left-0 right-0 flex items-center justify-center z-50 pointer-events-none"
        style={{
          top: 0,
          height: 44,
          transform: 'translateY(-44px)',
          opacity: 0,
        }}
      >
        <div className="bg-background border border-border rounded-full p-2.5 shadow-lg">
          <div ref={iconRef}>
            <Loader2 className="h-5 w-5 text-primary" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div ref={contentRef}>
        {children}
      </div>
    </div>
  );
}
