import { useRef, useCallback, forwardRef } from 'react';

interface SwipeGuardScrollProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/**
 * A horizontally scrollable container that prevents child button clicks
 * when the user is swiping on mobile. Solves the common issue where
 * touch-scrolling accidentally triggers onClick on category pills.
 */
const SwipeGuardScroll = forwardRef<HTMLDivElement, SwipeGuardScrollProps>(
  ({ children, className, onClick, ...props }, ref) => {
    const touchStartX = useRef(0);
    const touchStartY = useRef(0);
    const didSwipe = useRef(false);

    const onTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      didSwipe.current = false;
    }, []);

    const onTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
      const dx = Math.abs(e.touches[0].clientX - touchStartX.current);
      const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
      if (dx > 8 || dy > 8) {
        didSwipe.current = true;
      }
    }, []);

    const onClickCapture = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      if (didSwipe.current) {
        e.stopPropagation();
        e.preventDefault();
        didSwipe.current = false;
      }
    }, []);

    return (
      <div
        ref={ref}
        className={className}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onClickCapture={onClickCapture}
        {...props}
      >
        {children}
      </div>
    );
  }
);

SwipeGuardScroll.displayName = 'SwipeGuardScroll';
export default SwipeGuardScroll;
