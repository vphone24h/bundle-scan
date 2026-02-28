import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Hook for scroll-reveal animations using IntersectionObserver.
 * Returns a ref to attach to the element and whether it's visible.
 */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(
  options?: { threshold?: number; rootMargin?: string; once?: boolean }
) {
  const ref = useRef<T>(null);
  const [isVisible, setIsVisible] = useState(false);
  const { threshold = 0.1, rootMargin = '0px 0px -50px 0px', once = true } = options || {};

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once) observer.unobserve(el);
        } else if (!once) {
          setIsVisible(false);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin, once]);

  return { ref, isVisible };
}

/**
 * ScrollReveal wrapper component for declarative usage
 */
export function ScrollReveal({
  children,
  className = '',
  animation = 'fade-up',
  delay = 0,
  duration = 600,
  once = true,
}: {
  children: React.ReactNode;
  className?: string;
  animation?: 'fade-up' | 'fade-in' | 'fade-left' | 'fade-right' | 'scale-up' | 'slide-up';
  delay?: number;
  duration?: number;
  once?: boolean;
}) {
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>({ once });

  const baseStyles: React.CSSProperties = {
    transition: `opacity ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
  };

  const hiddenStyles: Record<string, React.CSSProperties> = {
    'fade-up': { opacity: 0, transform: 'translateY(40px)' },
    'fade-in': { opacity: 0 },
    'fade-left': { opacity: 0, transform: 'translateX(-40px)' },
    'fade-right': { opacity: 0, transform: 'translateX(40px)' },
    'scale-up': { opacity: 0, transform: 'scale(0.9)' },
    'slide-up': { opacity: 0, transform: 'translateY(60px)' },
  };

  const visibleStyles: React.CSSProperties = { opacity: 1, transform: 'translateY(0) translateX(0) scale(1)' };

  return (
    <div
      ref={ref}
      className={className}
      style={{ ...baseStyles, ...(isVisible ? visibleStyles : hiddenStyles[animation]) }}
    >
      {children}
    </div>
  );
}

/**
 * Parallax scroll hook - moves element based on scroll position
 */
export function useParallax(speed: number = 0.3) {
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      // Only calculate when element is near viewport
      if (rect.bottom > 0 && rect.top < windowHeight) {
        const scrollProgress = (windowHeight - rect.top) / (windowHeight + rect.height);
        setOffset((scrollProgress - 0.5) * speed * 100);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [speed]);

  return { ref, offset };
}
