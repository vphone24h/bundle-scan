import { ReactNode, memo, useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
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
  const [showAdGate, setShowAdGate] = useState(false);
  const location = useLocation();

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

  // Không đếm click khi đang ở trang Gói dịch vụ
  const isSubscriptionPage = location.pathname === '/subscription';

  // Count every click in the app — any interaction = 1 action
  useEffect(() => {
    if (!adGateActive || !adGateSettings || isSubscriptionPage) return;

    const clicksPerAd = adGateSettings.clicks_per_ad ?? 7;

    const handleClick = (e: MouseEvent) => {
      // Don't count clicks inside the ad modal itself
      if ((e.target as Element)?.closest('[data-ad-modal]')) return;

      const current = parseInt(sessionStorage.getItem(AD_CLICK_COUNT_KEY) || '0', 10);
      const next = current + 1;

      if (next >= clicksPerAd) {
        sessionStorage.setItem(AD_CLICK_COUNT_KEY, '0');
        setShowAdGate(true);
      } else {
        sessionStorage.setItem(AD_CLICK_COUNT_KEY, String(next));
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [adGateActive, adGateSettings, isSubscriptionPage]);

  const closeAdGate = useCallback(() => setShowAdGate(false), []);

  return { showAdGate, closeAdGate, adGateSettings, adGateActive };
}

export const MainLayout = memo(function MainLayout({ children }: MainLayoutProps) {
  const { showAdGate, closeAdGate, adGateSettings } = useAdGate();

  return (
    <div className="min-h-screen bg-background safe-x">
      <AppSidebar />
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
        <div data-ad-modal>
          <AdGateModal
            open={showAdGate}
            onClose={closeAdGate}
            settings={adGateSettings}
          />
        </div>
      )}
    </div>
  );
});
