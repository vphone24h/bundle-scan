import { useRef, useCallback } from 'react';

/**
 * Prevents accidental button clicks when the user is swiping/scrolling
 * a horizontally scrollable container on touch devices.
 * 
 * Usage:
 *   const { containerRef, handleClick } = useSwipeGuard<HTMLDivElement>();
 *   <div ref={containerRef} className="overflow-x-auto ...">
 *     <button onClick={handleClick(() => doSomething())}>Label</button>
 *   </div>
 */
export function useSwipeGuard<T extends HTMLElement = HTMLDivElement>() {
  const containerRef = useRef<T>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isSwiping = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isSwiping.current = false;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const dx = Math.abs(e.touches[0].clientX - touchStartX.current);
    const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
    // If moved more than 8px in any direction, consider it a swipe
    if (dx > 8 || dy > 8) {
      isSwiping.current = true;
    }
  }, []);

  const handleClick = useCallback((fn: () => void) => {
    return (e: React.MouseEvent) => {
      if (isSwiping.current) {
        e.preventDefault();
        e.stopPropagation();
        isSwiping.current = false;
        return;
      }
      fn();
    };
  }, []);

  const containerProps = {
    ref: containerRef,
    onTouchStart,
    onTouchMove,
  };

  return { containerRef, containerProps, handleClick };
}
