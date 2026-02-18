import { ReactNode, memo, useRef, useEffect, useState, useCallback } from 'react';
import { AppSidebar } from './AppSidebar';
import { useLocation } from 'react-router-dom';
import { useCurrentTenant, calculateRemainingDays } from '@/hooks/useTenant';
import { useAdGateSettings } from '@/hooks/useAdGate';
import { useActiveAdvertisements } from '@/hooks/useAdvertisements';
import { AdGateModal } from '@/components/tenant/AdGateModal';

interface MainLayoutProps {
  children: ReactNode;
}

function useAdGate() {
  const { data: tenant } = useCurrentTenant();
  const { data: adGateSettings } = useAdGateSettings();
  const { data: activeAds } = useActiveAdvertisements();
  const location = useLocation();
  const prevPath = useRef(location.pathname);
  const [showAdGate, setShowAdGate] = useState(false);
  // Track if we already showed the ad for this session init
  const shownOnce = useRef(false);

  const isExpired = tenant
    ? (() => {
        if (tenant.status === 'locked') return false; // locked is handled separately
        const remaining = calculateRemainingDays(tenant);
        return remaining <= 0;
      })()
    : false;

  const adGateActive =
    isExpired &&
    adGateSettings?.is_enabled === true &&
    (activeAds?.length ?? 0) > 0;

  // Show ad on every route change (page navigation)
  useEffect(() => {
    if (!adGateActive) return;
    const currentPath = location.pathname;
    if (currentPath !== prevPath.current || !shownOnce.current) {
      prevPath.current = currentPath;
      shownOnce.current = true;
      setShowAdGate(true);
    }
  }, [location.pathname, adGateActive]);

  const closeAdGate = useCallback(() => setShowAdGate(false), []);

  return { showAdGate, closeAdGate, adGateSettings, adGateActive };
}

export const MainLayout = memo(function MainLayout({ children }: MainLayoutProps) {
  const { showAdGate, closeAdGate, adGateSettings } = useAdGate();

  return (
    <div className="min-h-screen bg-background safe-x">
      <AppSidebar />
      {/* Main content - add extra top padding for PWA standalone mode to avoid menu button overlap */}
      <main 
        className="lg:pl-64 lg:pt-0 safe-bottom"
        style={{
          paddingTop: 'max(3.5rem, calc(env(safe-area-inset-top) + 4rem))',
        }}
      >
        <div className="min-h-screen">
          {children}
        </div>
      </main>

      {/* Ad Gate Modal */}
      {showAdGate && adGateSettings && (
        <AdGateModal
          open={showAdGate}
          onClose={closeAdGate}
          settings={adGateSettings}
        />
      )}
    </div>
  );
});
