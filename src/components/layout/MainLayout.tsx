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

const AD_CLICK_COUNT_KEY = 'ad_gate_click_count';

function useAdGate() {
  const { data: tenant } = useCurrentTenant();
  const { data: adGateSettings } = useAdGateSettings();
  const { data: activeAds } = useActiveAdvertisements();
  const location = useLocation();
  const prevPath = useRef(location.pathname);
  const [showAdGate, setShowAdGate] = useState(false);
  const initializedRef = useRef(false);

  const isExpired = tenant
    ? (() => {
        if (tenant.status === 'locked') return false;
        const remaining = calculateRemainingDays(tenant);
        return remaining <= 0;
      })()
    : false;

  const adGateActive =
    isExpired &&
    adGateSettings?.is_enabled === true &&
    (activeAds?.length ?? 0) > 0;

  // Count clicks (page navigations) and show ad every N clicks
  useEffect(() => {
    if (!adGateActive || !adGateSettings) return;

    const clicksPerAd = adGateSettings.clicks_per_ad ?? 7;
    const currentPath = location.pathname;

    // Track first load
    if (!initializedRef.current) {
      initializedRef.current = true;
      prevPath.current = currentPath;
      // Count this as click 1
      const count = 1;
      sessionStorage.setItem(AD_CLICK_COUNT_KEY, String(count));
      if (clicksPerAd <= 1) {
        setShowAdGate(true);
      }
      return;
    }

    // Only count when path changes
    if (currentPath === prevPath.current) return;
    prevPath.current = currentPath;

    const current = parseInt(sessionStorage.getItem(AD_CLICK_COUNT_KEY) || '0', 10);
    const next = current + 1;

    if (next >= clicksPerAd) {
      sessionStorage.setItem(AD_CLICK_COUNT_KEY, '0');
      setShowAdGate(true);
    } else {
      sessionStorage.setItem(AD_CLICK_COUNT_KEY, String(next));
    }
  }, [location.pathname, adGateActive, adGateSettings]);

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
