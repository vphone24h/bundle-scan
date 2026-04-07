export function forceReleaseStuckInteraction() {
  if (typeof document === 'undefined') return;

  const releaseInteractionLock = () => {
    if (document.body.style.pointerEvents === 'none') {
      document.body.style.pointerEvents = '';
    }

    if (document.documentElement.style.pointerEvents === 'none') {
      document.documentElement.style.pointerEvents = '';
    }

    // Also remove any Radix overlay artifacts that may block interaction
    document.querySelectorAll('[data-radix-portal]').forEach((portal) => {
      const overlay = portal.querySelector('[data-state="closed"]');
      if (overlay && overlay instanceof HTMLElement) {
        overlay.style.pointerEvents = 'none';
      }
    });
  };

  releaseInteractionLock();
  requestAnimationFrame(() => {
    releaseInteractionLock();
    requestAnimationFrame(releaseInteractionLock);
  });
}

export function createSafeDialogOpenChange(
  onOpenChange: (open: boolean) => void,
  onClose?: () => void,
) {
  return (nextOpen: boolean) => {
    if (!nextOpen) {
      onClose?.();
      forceReleaseStuckInteraction();
    }

    onOpenChange(nextOpen);
  };
}

export function preventDialogAutoFocus(event: { preventDefault: () => void }) {
  event.preventDefault();
  forceReleaseStuckInteraction();
}

// Global safety net: periodically check and release stuck pointer-events
let _globalWatcherStarted = false;
export function startGlobalInteractionWatcher() {
  if (_globalWatcherStarted || typeof document === 'undefined') return;
  _globalWatcherStarted = true;

  // Watch for pointer-events being stuck for too long (>3 seconds)
  let stuckSince: number | null = null;

  const check = () => {
    const isStuck =
      document.body.style.pointerEvents === 'none' ||
      document.documentElement.style.pointerEvents === 'none';

    if (isStuck) {
      if (!stuckSince) {
        stuckSince = Date.now();
      } else if (Date.now() - stuckSince > 3000) {
        console.warn('[DialogInteraction] Force releasing stuck pointer-events after 3s');
        forceReleaseStuckInteraction();
        stuckSince = null;
      }
    } else {
      stuckSince = null;
    }

    requestAnimationFrame(check);
  };

  requestAnimationFrame(check);
}