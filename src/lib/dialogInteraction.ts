export function forceReleaseStuckInteraction() {
  if (typeof document === 'undefined') return;

  const releaseInteractionLock = () => {
    if (document.body.style.pointerEvents === 'none') {
      document.body.style.pointerEvents = '';
    }

    if (document.documentElement.style.pointerEvents === 'none') {
      document.documentElement.style.pointerEvents = '';
    }
  };

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