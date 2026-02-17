import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TourStep {
  title: string;
  description: string;
  /** CSS selector of the target element to highlight */
  targetSelector?: string;
  /** Position of the popup relative to target */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** If true, clicking "Tiếp" completes this step (no target needed) */
  isInfo?: boolean;
}

interface OnboardingTourOverlayProps {
  steps: TourStep[];
  isActive: boolean;
  onComplete: () => void;
  tourKey: string;
}

export function OnboardingTourOverlay({ steps, isActive, onComplete, tourKey }: OnboardingTourOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

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
      // Scroll element into view
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    } else {
      setTargetRect(null);
    }
  }, [step?.targetSelector, step?.isInfo]);

  useEffect(() => {
    if (!isActive) return;
    // Small delay to let DOM render
    const timer = setTimeout(updateTargetRect, 500);
    window.addEventListener('resize', updateTargetRect);
    window.addEventListener('scroll', updateTargetRect, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateTargetRect);
      window.removeEventListener('scroll', updateTargetRect, true);
    };
  }, [isActive, currentStep, updateTargetRect]);

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

  // Calculate popup position
  const getPopupStyle = (): React.CSSProperties => {
    if (!targetRect || step.isInfo) {
      // Center popup
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10002,
      };
    }

    const padding = 12;
    const pos = step.position || 'bottom';

    switch (pos) {
      case 'bottom':
        return {
          position: 'fixed',
          top: targetRect.bottom + padding,
          left: Math.max(16, Math.min(targetRect.left, window.innerWidth - 320)),
          zIndex: 10002,
        };
      case 'top':
        return {
          position: 'fixed',
          bottom: window.innerHeight - targetRect.top + padding,
          left: Math.max(16, Math.min(targetRect.left, window.innerWidth - 320)),
          zIndex: 10002,
        };
      case 'right':
        return {
          position: 'fixed',
          top: targetRect.top,
          left: targetRect.right + padding,
          zIndex: 10002,
        };
      case 'left':
        return {
          position: 'fixed',
          top: targetRect.top,
          right: window.innerWidth - targetRect.left + padding,
          zIndex: 10002,
        };
      default:
        return {
          position: 'fixed',
          top: targetRect.bottom + padding,
          left: Math.max(16, targetRect.left),
          zIndex: 10002,
        };
    }
  };

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 z-[10000] bg-black/60 transition-opacity duration-300"
        onClick={(e) => e.stopPropagation()}
      />

      {/* Highlight cutout */}
      {targetRect && !step.isInfo && (
        <div
          className="fixed z-[10001] rounded-lg ring-4 ring-primary/80 ring-offset-2 pointer-events-none"
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)',
          }}
        />
      )}

      {/* Popup card */}
      <div
        style={getPopupStyle()}
        className="w-[300px] sm:w-[360px] bg-card border border-border rounded-xl shadow-2xl p-4 sm:p-5"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1">
              Bước {currentStep + 1}/{steps.length}
            </p>
            <h3 className="font-semibold text-sm sm:text-base text-foreground">
              {step.title}
            </h3>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 -mt-1 -mr-1 text-muted-foreground hover:text-foreground"
            onClick={handleSkip}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
          {step.description}
        </p>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={handleSkip}
          >
            Bỏ qua
          </Button>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button variant="outline" size="sm" onClick={handlePrev} className="h-8 text-xs">
                <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                Quay lại
              </Button>
            )}
            <Button size="sm" onClick={handleNext} className="h-8 text-xs">
              {isLast ? 'Hoàn thành' : 'Tiếp theo'}
              {!isLast && <ChevronRight className="h-3.5 w-3.5 ml-1" />}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
