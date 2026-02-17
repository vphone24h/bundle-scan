import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { X, ChevronRight, ChevronLeft, Hand } from 'lucide-react';

export interface TourStep {
  title: string;
  description: string;
  /** CSS selector of the target element to highlight */
  targetSelector?: string;
  /** Position of the popup relative to target */
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  /** If true, clicking "Tiếp" completes this step (no target needed) */
  isInfo?: boolean;
  /** Optional icon hint e.g. swipe gesture */
  gesture?: 'swipe-right' | 'tap';
}

interface OnboardingTourOverlayProps {
  steps: TourStep[];
  isActive: boolean;
  onComplete: () => void;
  tourKey: string;
}

export function OnboardingTourOverlay({ steps, isActive, onComplete }: OnboardingTourOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const step = steps[currentStep];

  const updateTargetRect = useCallback(() => {
    if (!step?.targetSelector || step.isInfo) {
      setTargetRect(null);
      return;
    }
    const el = document.querySelector(step.targetSelector);
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    } else {
      setTargetRect(null);
    }
  }, [step?.targetSelector, step?.isInfo]);

  useEffect(() => {
    if (!isActive) return;
    const timer = setTimeout(updateTargetRect, 400);
    window.addEventListener('resize', updateTargetRect);
    window.addEventListener('scroll', updateTargetRect, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateTargetRect);
      window.removeEventListener('scroll', updateTargetRect, true);
    };
  }, [isActive, currentStep, updateTargetRect]);

  // Also raise z-index of target element so it's clickable above backdrop
  useEffect(() => {
    if (!isActive || !step?.targetSelector || step.isInfo) return;
    const el = document.querySelector(step.targetSelector) as HTMLElement | null;
    if (!el) return;
    const prev = el.style.cssText;
    el.style.position = 'relative';
    el.style.zIndex = '10001';
    return () => {
      el.style.cssText = prev;
    };
  }, [isActive, currentStep, step?.targetSelector, step?.isInfo]);

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
    onComplete();
  };

  // Calculate popup position - prefer center on mobile for non-info steps too
  const getPopupStyle = (): React.CSSProperties => {
    if (!targetRect || step.isInfo || step.position === 'center') {
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

    // On mobile, always show popup at bottom of screen if target is in upper half, or top if lower
    if (vw < 640) {
      const targetMid = targetRect.top + targetRect.height / 2;
      if (targetMid < vh / 2) {
        // Target in upper half → popup at bottom
        return {
          position: 'fixed',
          bottom: 16,
          left: 16,
          right: 16,
          zIndex: 10002,
        };
      } else {
        // Target in lower half → popup at top
        return {
          position: 'fixed',
          top: Math.max(60, 16), // avoid safe-area
          left: 16,
          right: 16,
          zIndex: 10002,
        };
      }
    }

    // Desktop positioning
    const pos = step.position || 'bottom';
    const left = Math.max(16, Math.min(targetRect.left, vw - popupW - 16));

    switch (pos) {
      case 'bottom':
        return { position: 'fixed', top: targetRect.bottom + gap, left, zIndex: 10002 };
      case 'top':
        return { position: 'fixed', bottom: vh - targetRect.top + gap, left, zIndex: 10002 };
      case 'right':
        return { position: 'fixed', top: targetRect.top, left: targetRect.right + gap, zIndex: 10002 };
      case 'left':
        return { position: 'fixed', top: targetRect.top, right: vw - targetRect.left + gap, zIndex: 10002 };
      default:
        return { position: 'fixed', top: targetRect.bottom + gap, left, zIndex: 10002 };
    }
  };

  return (
    <>
      {/* Backdrop - allows clicks to pass through to highlighted element */}
      <div
        className="fixed inset-0 z-[10000] bg-black/50 transition-opacity duration-300"
        onClick={handleSkip}
      />

      {/* Highlight border around target (pointer-events-none so target stays clickable) */}
      {targetRect && !step.isInfo && (
        <div
          className="fixed z-[10001] rounded-lg pointer-events-none"
          style={{
            top: targetRect.top - 6,
            left: targetRect.left - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
            border: '3px solid hsl(var(--primary))',
            boxShadow: '0 0 0 4px hsl(var(--primary) / 0.3), 0 0 20px hsl(var(--primary) / 0.2)',
            background: 'transparent',
          }}
        />
      )}

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
        className="w-auto max-w-[340px] sm:w-[360px] bg-card border border-border rounded-xl shadow-2xl p-4 sm:p-5"
      >
        {/* Step indicator dots */}
        <div className="flex items-center gap-1.5 mb-3">
          {steps.map((_, i) => (
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
          ))}
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={handleSkip}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-sm sm:text-base text-foreground mb-1.5">
          {step.title}
        </h3>

        {/* Description */}
        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
          {step.description}
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
            <Button size="sm" onClick={handleNext} className="h-8 text-xs">
              {isLast ? '✓ Xong' : 'Tiếp'}
              {!isLast && <ChevronRight className="h-3.5 w-3.5 ml-1" />}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
