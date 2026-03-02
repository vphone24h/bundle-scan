import { ReactNode, memo, useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { useCurrentTenant, calculateRemainingDays } from '@/hooks/useTenant';
import { useAdGateSettings } from '@/hooks/useAdGate';
import { useActiveAdvertisements } from '@/hooks/useAdvertisements';
import { AdGateModal } from '@/components/tenant/AdGateModal';
import { usePlatformUser } from '@/hooks/useTenant';
import { StartupNotificationPopup } from '@/components/notifications/StartupNotificationPopup';
import { PushPermissionPopup } from '@/components/notifications/PushPermissionPopup';
import { PopupPriorityProvider, usePopupPriority } from '@/hooks/usePopupPriority';
import { PullToRefresh } from './PullToRefresh';

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
  const { activeLayer, claim, release } = usePopupPriority();

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

  const isSubscriptionPage = location.pathname === '/subscription';

  useEffect(() => {
    if (!adGateActive || !adGateSettings || isSubscriptionPage) return;

    const clicksPerAd = adGateSettings.clicks_per_ad ?? 7;

    const handleClick = (e: MouseEvent) => {
      if ((e.target as Element)?.closest('[data-ad-modal]')) return;
      if (document.querySelector('[data-tour-active="true"]')) return;

      const current = parseInt(sessionStorage.getItem(AD_CLICK_COUNT_KEY) || '0', 10);
      const next = current + 1;

      if (next >= clicksPerAd) {
        sessionStorage.setItem(AD_CLICK_COUNT_KEY, '0');
        // Only show if no higher-priority popup is active
        if (activeLayer === 'none' || activeLayer === 'adgate') {
          const granted = claim('adgate');
          if (granted) setShowAdGate(true);
        }
      } else {
        sessionStorage.setItem(AD_CLICK_COUNT_KEY, String(next));
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [adGateActive, adGateSettings, isSubscriptionPage, activeLayer, claim]);

  const closeAdGate = useCallback(() => {
    setShowAdGate(false);
    release('adgate');
  }, [release]);

  return { showAdGate, closeAdGate, adGateSettings, adGateActive };
}

function MainLayoutInner({ children }: MainLayoutProps) {
  const { showAdGate, closeAdGate, adGateSettings } = useAdGate();
  const { data: tenant } = useCurrentTenant();
  const { data: platformUser } = usePlatformUser();
  const needsBusinessType = !!tenant && !tenant.business_type && (platformUser?.platform_role as string) !== 'platform_admin';

  return (
    <div className="min-h-screen bg-background safe-x">
      <AppSidebar />
      <main
        className="lg:pl-64 lg:pt-0 safe-bottom"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 2.75rem)',
        }}
      >
        <PullToRefresh>
          <div className="min-h-screen">
            {children}
          </div>
        </PullToRefresh>
      </main>

      {/* Popup priority: tour → notification → push → adgate */}
      <StartupNotificationPopup />
      <PushPermissionPopup />

      {showAdGate && adGateSettings && !needsBusinessType && (
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
}

export const MainLayout = memo(function MainLayout({ children }: MainLayoutProps) {
  return (
    <PopupPriorityProvider>
      <MainLayoutInner>{children}</MainLayoutInner>
    </PopupPriorityProvider>
  );
});
