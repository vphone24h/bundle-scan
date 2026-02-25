import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { X, ChevronRight, ChevronLeft, Hand } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export interface TourStep {
  title: string;
  description: string;
  /** CSS selector of the target element to highlight */
  targetSelector?: string;
  /** Position of the popup relative to target */
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  /** If true, just shows info popup without requiring interaction */
  isInfo?: boolean;
  /** Optional icon hint e.g. swipe gesture */
  gesture?: 'swipe-right' | 'tap';
  /** Navigate to this route when this step becomes active */
  navigateTo?: string;
}

interface OnboardingTourOverlayProps {
  steps: TourStep[];
  isActive: boolean;
  onComplete: () => void;
  onSkip?: () => void;
  tourKey: string;
}

const PADDING = 10; // px padding around highlighted element

export function OnboardingTourOverlay({ steps, isActive, onComplete, onSkip }: OnboardingTourOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const step = steps[currentStep];

  const updateTargetRect = useCallback(() => {
    if (!step?.targetSelector) {
      setTargetRect(null);
      return;
    }

    const scrollAndMeasure = (selector: string) => {
      const el = document.querySelector(selector);
      if (!el) {
        setTargetRect(null);
        return;
      }
      // Smooth scroll so user can see where it's going
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      // Wait for scroll to finish then measure
      setTimeout(() => {
        const updated = document.querySelector(selector);
        if (updated) {
          setTargetRect(updated.getBoundingClientRect());
        }
      }, 320);
    };

    // Auto-open mobile sidebar if target is inside it
    const isSidebarTarget = step.targetSelector.startsWith('[data-tour="sidebar-');
    if (isSidebarTarget) {
      const menuBtn = document.querySelector('[data-tour="mobile-menu-btn"]') as HTMLElement | null;
      if (menuBtn && window.innerWidth < 1024) {
        const sidebar = document.querySelector('aside.fixed.z-40') as HTMLElement | null;
        const isOpen = sidebar && !sidebar.classList.contains('-translate-x-full');
        if (!isOpen) {
          menuBtn.click();
          setTimeout(() => scrollAndMeasure(step.targetSelector!), 150);
          return;
        }
      }
    }

    scrollAndMeasure(step.targetSelector);
  }, [step?.targetSelector]);

  useEffect(() => {
    if (!isActive || !step?.navigateTo) return;
    navigate(step.navigateTo);
  }, [isActive, currentStep, step?.navigateTo, navigate]);

  useEffect(() => {
    if (!isActive) return;
    // Short delay for DOM to render after tab switch
    const timer = setTimeout(updateTargetRect, 200);
    window.addEventListener('resize', updateTargetRect);
    window.addEventListener('scroll', updateTargetRect, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateTargetRect);
      window.removeEventListener('scroll', updateTargetRect, true);
    };
  }, [isActive, currentStep, updateTargetRect]);

  // Raise z-index of target element so it appears above backdrop
  useEffect(() => {
    if (!isActive || !step?.targetSelector) return;
    const el = document.querySelector(step.targetSelector) as HTMLElement | null;
    if (!el) return;
    const prev = el.style.cssText;
    el.style.position = 'relative';
    el.style.zIndex = '10001';
    return () => {
      el.style.cssText = prev;
    };
  }, [isActive, currentStep, step?.targetSelector]);

  if (!isActive || !step) return null;

  const isLast = currentStep === steps.length - 1;
  const isFirst = currentStep === 0;

  const handleNext = () => {
    if (isLast) {
      onComplete();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirst) setCurrentStep(currentStep - 1);
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    } else {
      onComplete();
    }
  };

  // Build SVG cutout backdrop: black overlay with transparent hole around target
  const buildBackdropSvg = () => {
    if (!targetRect) return null;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const x = targetRect.left - PADDING;
    const y = targetRect.top - PADDING;
    const w = targetRect.width + PADDING * 2;
    const h = targetRect.height + PADDING * 2;
    const r = 10; // border radius

    return (
      <svg
        className="fixed inset-0 z-[10000] pointer-events-none"
        width={vw}
        height={vh}
        viewBox={`0 0 ${vw} ${vh}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <mask id="cutout-mask">
            <rect width={vw} height={vh} fill="white" />
            <rect x={x} y={y} width={w} height={h} rx={r} ry={r} fill="black" />
          </mask>
        </defs>
        <rect
          width={vw}
          height={vh}
          fill="rgba(0,0,0,0.6)"
          mask="url(#cutout-mask)"
        />
      </svg>
    );
  };

  // Animated highlight border around target
  const buildHighlightBorder = () => {
    if (!targetRect) return null;
    return (
      <div
        className="fixed z-[10001] rounded-xl pointer-events-none animate-pulse"
        style={{
          top: targetRect.top - PADDING,
          left: targetRect.left - PADDING,
          width: targetRect.width + PADDING * 2,
          height: targetRect.height + PADDING * 2,
          border: '2.5px solid hsl(var(--primary))',
          boxShadow: '0 0 0 3px hsl(var(--primary) / 0.25), 0 0 18px hsl(var(--primary) / 0.3)',
          background: 'transparent',
        }}
      />
    );
  };

  // Calculate popup position
  const getPopupStyle = (): React.CSSProperties => {
    if (!targetRect || step.position === 'center') {
      // On mobile, anchor to bottom with safe area; on desktop, center
      if (window.innerWidth < 640) {
        return {
          position: 'fixed',
          bottom: 80,
          left: 16,
          right: 16,
          zIndex: 10002,
        };
      }
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10002,
      };
    }

    const gap = 16;
    const popupW = 340;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Reserve space for popup + safe area at bottom (for iPhone home indicator etc.)
    const safeBottom = 80;
    const popupH = 240; // approximate popup height

    // Mobile: sidebar items → popup to the right of sidebar
    if (vw < 640) {
      const isSidebarItem = step.targetSelector?.startsWith('[data-tour="sidebar-');
      if (isSidebarItem) {
        const topPos = Math.max(16, Math.min(targetRect.top - 20, vh - 280));
        return {
          position: 'fixed',
          top: topPos,
          left: Math.min(targetRect.right + 8, vw - 200),
          right: 8,
          zIndex: 10002,
        };
      }
      // Try to place below target, fallback to above, fallback to bottom of screen
      // Use larger safe top for Dynamic Island / notch devices
      const safeTop = 100;
      const topBelow = targetRect.bottom + gap;
      const topAbove = targetRect.top - gap - popupH;
      const fitsBelow = topBelow + popupH + safeBottom <= vh;
      const fitsAbove = topAbove >= safeTop;
      let topPos: number;
      if (fitsBelow) {
        topPos = topBelow;
      } else if (fitsAbove) {
        topPos = Math.max(safeTop, topAbove);
      } else {
        // Place at bottom with enough room, scroll target into view
        topPos = vh - popupH - safeBottom;
      }
      return {
        position: 'fixed',
        top: Math.max(safeTop, Math.min(topPos, vh - popupH - safeBottom)),
        left: 16,
        right: 16,
        zIndex: 10002,
      };
    }

    // Desktop positioning — ensure popup stays within viewport
    const pos = step.position || 'bottom';
    const left = Math.max(16, Math.min(targetRect.left, vw - popupW - 16));
    const clampTop = (t: number) => Math.max(16, Math.min(t, vh - popupH - 16));

    switch (pos) {
      case 'bottom':
        return { position: 'fixed', top: clampTop(targetRect.bottom + gap), left, maxWidth: popupW, zIndex: 10002 };
      case 'top':
        return { position: 'fixed', top: clampTop(targetRect.top - gap - popupH), left, maxWidth: popupW, zIndex: 10002 };
      case 'right':
        return { position: 'fixed', top: clampTop(targetRect.top - 20), left: Math.min(targetRect.right + gap, vw - popupW - 16), maxWidth: popupW, zIndex: 10002 };
      case 'left':
        return { position: 'fixed', top: clampTop(targetRect.top - 20), left: Math.max(16, targetRect.left - gap - popupW), maxWidth: popupW, zIndex: 10002 };
      default:
        return { position: 'fixed', top: clampTop(targetRect.bottom + gap), left, maxWidth: popupW, zIndex: 10002 };
    }
  };

  return (
    <div data-tour-active="true" style={{ display: 'contents' }}>
      {/* Backdrop: cutout when we have a target, solid overlay otherwise */}
      {targetRect ? (
        buildBackdropSvg()
      ) : (
        <div
          className="fixed inset-0 z-[10000] bg-black/55 transition-opacity duration-300"
          onClick={handleSkip}
        />
      )}

      {/* Click blocker on backdrop area (outside cutout) */}
      {targetRect && (
        <div
          className="fixed inset-0 z-[10000]"
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* Animated highlight border */}
      {buildHighlightBorder()}

      {/* Gesture hint animation */}
      {targetRect && step.gesture === 'swipe-right' && (
        <div
          className="fixed z-[10001] pointer-events-none animate-bounce-horizontal"
          style={{
            top: targetRect.top + targetRect.height / 2 - 20,
            left: targetRect.left + targetRect.width / 2 - 20,
          }}
        >
          <Hand className="h-10 w-10 text-primary drop-shadow-lg" />
        </div>
      )}

      {/* Popup card */}
      <div
        ref={popupRef}
        style={getPopupStyle()}
        className="w-auto max-w-[340px] sm:w-[360px] bg-card border border-border rounded-xl shadow-2xl p-4 sm:p-5 max-h-[80vh] overflow-y-auto"
      >
        {/* Step indicator - compact on mobile for many steps */}
        <div className="flex items-center gap-1 mb-3">
          {steps.length <= 10 ? (
            steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === currentStep
                    ? 'w-6 bg-primary'
                    : i < currentStep
                    ? 'w-1.5 bg-primary/50'
                    : 'w-1.5 bg-muted-foreground/30'
                }`}
              />
            ))
          ) : (
            <div className="flex items-center gap-1 min-w-0 overflow-hidden flex-1">
              {/* Show surrounding dots only for many steps */}
              {Array.from({ length: Math.min(steps.length, 7) }, (_, idx) => {
                const startOffset = Math.max(0, Math.min(currentStep - 3, steps.length - 7));
                const i = startOffset + idx;
                return (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all flex-shrink-0 ${
                      i === currentStep
                        ? 'w-5 bg-primary'
                        : i < currentStep
                        ? 'w-1.5 bg-primary/50'
                        : 'w-1.5 bg-muted-foreground/30'
                    }`}
                  />
                );
              })}
            </div>
          )}
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-foreground"
            onClick={handleSkip}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Step number */}
        <div className="text-[10px] font-medium text-muted-foreground mb-1">
          Bước {currentStep + 1} / {steps.length}
        </div>

        {/* Title */}
        <h3 className="font-semibold text-sm sm:text-base text-foreground mb-1.5">
          {step.title}
        </h3>

        {/* Description */}
        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
          {step.description.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
            part.startsWith('**') && part.endsWith('**')
              ? <strong key={i} className="text-primary font-semibold">{part.slice(2, -2)}</strong>
              : part
          )}
        </p>


        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            onClick={handleSkip}
          >
            Bỏ qua tất cả
          </button>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button variant="outline" size="sm" onClick={handlePrev} className="h-8 text-xs">
                <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                Lùi
              </Button>
            )}
            <Button 
              size="sm" 
              onClick={handleNext} 
              className="h-10 px-5 text-sm font-bold animate-pulse shadow-lg shadow-primary/30 ring-2 ring-primary/20"
            >
              {isLast ? '✓ Xong' : 'Tiếp'}
              {!isLast && <ChevronRight className="h-4 w-4 ml-1" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
