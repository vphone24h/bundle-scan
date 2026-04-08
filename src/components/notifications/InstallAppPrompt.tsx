import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePopupPriority } from '@/hooks/usePopupPriority';

/**
 * Mobile-only prompt asking users to install the PWA.
 * - Only shows on mobile devices (not desktop)
 * - Hidden if already running as installed PWA (standalone)
 * - Hidden when higher-priority popups (tour, notification) are active
 * - Shows every page reload until user installs the app
 */
export function InstallAppPrompt() {
  const navigate = useNavigate();
  const { activeLayer } = usePopupPriority();
  const [dismissed, setDismissed] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Only show on mobile
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768;
    if (!isMobile) return;

    // Don't show if already installed as PWA (standalone mode)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) return;

    // Delay showing to let higher-priority popups claim first
    const timer = setTimeout(() => setShow(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  // Hide when higher-priority popup is active
  const hasHigherPriority = activeLayer === 'tour' || activeLayer === 'notification';

  if (!show || dismissed || hasHigherPriority) return null;

  return (
    <div className="fixed bottom-16 left-3 right-3 z-40 animate-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-lg">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Download className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Tải ứng dụng</p>
          <p className="text-xs text-muted-foreground truncate">
            Cài đặt app để trải nghiệm mượt hơn
          </p>
        </div>
        <Button
          size="sm"
          className="shrink-0 h-8 px-3 text-xs"
          onClick={() => {
            setDismissed(true);
            navigate('/install-app');
          }}
        >
          Tải ngay
        </Button>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 p-1 rounded-md hover:bg-muted text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
