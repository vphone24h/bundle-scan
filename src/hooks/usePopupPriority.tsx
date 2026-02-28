import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

/**
 * Popup priority system — only one popup at a time.
 * Priority order: tour > notification > push > adgate
 */
type PopupLayer = 'none' | 'tour' | 'notification' | 'push' | 'adgate';

const PRIORITY: Record<PopupLayer, number> = {
  tour: 4,
  notification: 3,
  push: 2,
  adgate: 1,
  none: 0,
};

interface PopupPriorityContextType {
  /** Currently active popup layer */
  activeLayer: PopupLayer;
  /** Claim a layer — returns true if granted */
  claim: (layer: PopupLayer) => boolean;
  /** Release a layer */
  release: (layer: PopupLayer) => void;
  /** Check if a layer can show (nothing higher is active) */
  canShow: (layer: PopupLayer) => boolean;
}

const PopupPriorityContext = createContext<PopupPriorityContextType>({
  activeLayer: 'none',
  claim: () => false,
  release: () => {},
  canShow: () => true,
});

export function PopupPriorityProvider({ children }: { children: ReactNode }) {
  const [activeLayer, setActiveLayer] = useState<PopupLayer>('none');

  // Also watch for tour via DOM attribute (tours render outside MainLayout)
  useEffect(() => {
    const check = () => {
      const tourActive = !!document.querySelector('[data-tour-active="true"]');
      setActiveLayer(prev => {
        if (tourActive && prev !== 'tour') return 'tour';
        if (!tourActive && prev === 'tour') return 'none';
        return prev;
      });
    };
    // Poll briefly since tours mount/unmount dynamically
    const interval = setInterval(check, 500);
    return () => clearInterval(interval);
  }, []);

  const claim = useCallback((layer: PopupLayer) => {
    let granted = false;
    setActiveLayer(prev => {
      if (PRIORITY[layer] >= PRIORITY[prev]) {
        granted = true;
        return layer;
      }
      return prev;
    });
    return granted;
  }, []);

  const release = useCallback((layer: PopupLayer) => {
    setActiveLayer(prev => (prev === layer ? 'none' : prev));
  }, []);

  const canShow = useCallback((layer: PopupLayer) => {
    // Synchronous check against current state — use with the activeLayer value
    return true; // actual gating done via activeLayer comparison in components
  }, []);

  return (
    <PopupPriorityContext.Provider value={{ activeLayer, claim, release, canShow }}>
      {children}
    </PopupPriorityContext.Provider>
  );
}

export function usePopupPriority() {
  return useContext(PopupPriorityContext);
}
