import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import { useParams, useLocation, useSearchParams, useNavigate } from 'react-router-dom';
import { usePublicLandingSettings, BranchInfo, preloadClientIp } from '@/hooks/useTenantLanding';
import { usePublicLandingProducts } from '@/hooks/useLandingProducts';
import { usePublicLandingArticles } from '@/hooks/useLandingArticles';
import { detectPageFromPath } from '@/lib/slugify';
import { useQueryClient } from '@tanstack/react-query';
import { useTenantResolver } from '@/hooks/useTenantResolver';
import { detectTenantFromHostname } from '@/lib/tenantResolver';
import { LandingCartProvider } from '@/hooks/useLandingCart';
import { readPwaLastRoute, readPwaStoreIdentity, writePwaLastRoute, writePwaStoreIdentity } from '@/lib/pwaStoreSession';
import { Store } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

// Lazy load heavy templates - they import DOMPurify and many components
const universalImport = () => import('@/components/website-templates/UniversalStoreTemplate');
const appleImport = () => import('@/components/website-templates/AppleStyleLandingTemplate');
const UniversalStoreTemplate = lazy(universalImport);
const AppleStyleLandingTemplate = lazy(appleImport);

// Eagerly preload the most common template immediately for store pages
const prefetch = typeof window !== 'undefined' ? (window as any).__STORE_PREFETCH__ : null;
if (prefetch?.storeId) {
  // Store page detected — preload template immediately, don't wait for idle
  universalImport();
} else if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
  (window as any).requestIdleCallback(() => universalImport(), { timeout: 2000 });
} else if (typeof window !== 'undefined') {
  setTimeout(() => universalImport(), 100);
}
// === PWA Manifest Hook ===
function useDynamicManifest(storeName: string, storeId: string | null, logoUrl?: string | null) {
  const location = useLocation();
  useEffect(() => {
    if (!storeId) return;
    const cacheBust = logoUrl ? `?v=${Date.now()}` : '';
    const iconSrc = logoUrl ? `${logoUrl}${cacheBust}` : '/icons/icon-192x192.png';
    const iconSrc512 = logoUrl ? `${logoUrl}${cacheBust}` : '/icons/icon-512x512.png';
    // iOS home screen short_name limit ~12 chars, if too long use last word
    const fullName = storeName || storeId || 'vkho';
    const shortName = fullName.length > 12
      ? (fullName.split(/\s+/).pop() || fullName).slice(0, 12)
      : fullName;
    const manifest = {
      name: storeName || `${storeId} - vkho.vn`,
      short_name: shortName,
      description: `${storeName || storeId}`,
      start_url: window.location.href,
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#f8fafc',
      theme_color: '#1e3a5f',
      icons: [
        { src: iconSrc, sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: iconSrc, sizes: '180x180', type: 'image/png', purpose: 'any' },
        { src: iconSrc512, sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: iconSrc, sizes: '192x192', type: 'image/png', purpose: 'maskable' },
        { src: iconSrc512, sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ]
    };
    const manifestBlob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
    const manifestUrl = URL.createObjectURL(manifestBlob);
    const existingManifest = document.querySelector('link[rel="manifest"]');
    if (existingManifest) existingManifest.remove();
    const manifestLink = document.createElement('link');
    manifestLink.rel = 'manifest';
    manifestLink.href = manifestUrl;
    document.head.appendChild(manifestLink);

    // Apple touch icon (iOS uses this for home screen)
    // Remove ALL existing apple-touch-icon links and create fresh ones
    const appleIcon = logoUrl || '/icons/apple-touch-icon.png';
    
    document.querySelectorAll('link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]').forEach(el => el.remove());
    
    // iOS prefers apple-touch-icon WITHOUT sizes attribute first, then with sizes
    const noSizeLink = document.createElement('link');
    noSizeLink.rel = 'apple-touch-icon';
    noSizeLink.href = appleIcon;
    document.head.appendChild(noSizeLink);

    const sizes = ['180x180', '152x152', '144x144', '120x120'];
    sizes.forEach(size => {
      const link = document.createElement('link');
      link.rel = 'apple-touch-icon';
      link.setAttribute('sizes', size);
      link.href = appleIcon;
      document.head.appendChild(link);
    });

    // apple-touch-icon-precomposed (older iOS)
    const preLink = document.createElement('link');
    preLink.rel = 'apple-touch-icon-precomposed';
    preLink.href = appleIcon;
    document.head.appendChild(preLink);
    
    // Preload the icon so iOS can access it immediately
    if (logoUrl) {
      const preload = document.createElement('link');
      preload.rel = 'preload';
      preload.as = 'image';
      preload.href = appleIcon;
      document.head.appendChild(preload);
    }

    // Also update favicon
    const allFavicons = document.querySelectorAll('link[rel="icon"]');
    allFavicons.forEach(f => f.setAttribute('href', appleIcon));

    // Apple mobile web app title
    let appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (!appleTitle) { appleTitle = document.createElement('meta'); appleTitle.setAttribute('name', 'apple-mobile-web-app-title'); document.head.appendChild(appleTitle); }
    appleTitle.setAttribute('content', storeName || storeId);

    // Apple mobile web app capable
    let appleCap = document.querySelector('meta[name="apple-mobile-web-app-capable"]');
    if (!appleCap) { appleCap = document.createElement('meta'); appleCap.setAttribute('name', 'apple-mobile-web-app-capable'); document.head.appendChild(appleCap); }
    appleCap.setAttribute('content', 'yes');

    return () => { URL.revokeObjectURL(manifestUrl); };
  }, [storeId, storeName, logoUrl, location.pathname]);
}

// === Dynamic OG Meta Tags ===
function useDynamicOGMeta(title?: string, description?: string, imageUrl?: string) {
  useEffect(() => {
    if (!title) return;
    const prev = {
      title: document.title,
      ogTitle: document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '',
      ogDesc: document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '',
      ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '',
      desc: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
    };
    document.title = title;
    const setMeta = (selector: string, attr: string, value: string) => {
      let el = document.querySelector(selector);
      if (!el) { el = document.createElement('meta'); const [a, v] = attr === 'property' ? ['property', selector.match(/"([^"]+)"/)?.[1] || ''] : ['name', selector.match(/"([^"]+)"/)?.[1] || '']; el.setAttribute(a, v); document.head.appendChild(el); }
      el.setAttribute('content', value);
    };
    setMeta('meta[property="og:title"]', 'property', title);
    if (description) {
      setMeta('meta[property="og:description"]', 'property', description);
      setMeta('meta[name="description"]', 'name', description);
    }
    if (imageUrl) setMeta('meta[property="og:image"]', 'property', imageUrl);
    return () => {
      document.title = prev.title;
      setMeta('meta[property="og:title"]', 'property', prev.ogTitle);
      setMeta('meta[property="og:description"]', 'property', prev.ogDesc);
      setMeta('meta[name="description"]', 'name', prev.desc);
      if (prev.ogImage) setMeta('meta[property="og:image"]', 'property', prev.ogImage);
    };
  }, [title, description, imageUrl]);
}

interface StoreLandingPageProps { storeIdFromSubdomain?: string | null; }

const LAST_STORE_HINT_KEY = 'pwa_last_store_hint_v1';

export default function StoreLandingPage({ storeIdFromSubdomain }: StoreLandingPageProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { storeId: storeIdFromParams } = useParams<{ storeId: string }>();
  const resolvedTenant = useTenantResolver();
  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : null;

  const tenantHostInfo = useMemo(() => {
    if (typeof window === 'undefined') {
      return { subdomain: null, isMainDomain: true, hostname: '' };
    }
    return detectTenantFromHostname();
  }, []);
  const isCustomDomainHost = !tenantHostInfo.isMainDomain && !tenantHostInfo.subdomain;

  const persistedIdentity = useMemo(
    () => readPwaStoreIdentity(currentHostname),
    [currentHostname]
  );

  const [searchParams, setSearchParams] = useSearchParams();
  const storeIdFromQueryRaw = searchParams.get('store')?.trim().toLowerCase() || null;
  const storeIdFromQuery = isCustomDomainHost ? null : storeIdFromQueryRaw;

  // Read PWA store hint immediately on startup (before effects run)
  const storeIdFromHint = useMemo(() => {
    if (isCustomDomainHost) return null;
    if (typeof window === 'undefined') return null;

    try {
      const raw = window.localStorage.getItem(LAST_STORE_HINT_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { storeId?: string; savedAt?: number };
      const hintedStoreId = typeof parsed?.storeId === 'string' ? parsed.storeId.trim().toLowerCase() : '';
      if (!hintedStoreId) return null;
      if (typeof parsed.savedAt === 'number' && Date.now() - parsed.savedAt > 1000 * 60 * 60 * 24 * 7) {
        window.localStorage.removeItem(LAST_STORE_HINT_KEY);
        return null;
      }
      return hintedStoreId;
    } catch {
      return null;
    }
  }, [isCustomDomainHost]);

  // IMPORTANT: on custom domains, never let store hint/query override tenant-id resolution.
  const storeId = storeIdFromSubdomain
    || storeIdFromParams
    || resolvedTenant.subdomain
    || storeIdFromQuery
    || storeIdFromHint
    || persistedIdentity?.shopId
    || null;
  const resolvedTenantId = resolvedTenant.tenantId || persistedIdentity?.tenantId || null;
  const hasIdentifier = !!storeId || !!resolvedTenantId;
  const hasRecoverySignal = hasIdentifier || !!storeIdFromHint || !!persistedIdentity?.shopId || !!persistedIdentity?.tenantId;

  const {
    data: landingData,
    isLoading,
    isError,
    refetch: refetchLandingData,
  } = usePublicLandingSettings(storeId, resolvedTenantId);
  const queryClient = useQueryClient();
  const attemptedRouteRestoreRef = useRef(false);

  const settings = landingData?.settings;
  const tenant = landingData?.tenant;
  const tenantId = tenant?.id || resolvedTenantId || null;
  const storeName = settings?.store_name || tenant?.name || storeId || '';
  const template = settings?.website_template || 'phone_store';

  const isStandalone = typeof window !== 'undefined' && (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );

  const restoreStoreHintForStandalone = useCallback(() => {
    if (isCustomDomainHost) return false;
    if (typeof window === 'undefined') return false;

    try {
      const raw = window.localStorage.getItem(LAST_STORE_HINT_KEY);
      if (!raw) return false;

      const parsed = JSON.parse(raw) as { storeId?: string; savedAt?: number };
      const hintedStoreId = typeof parsed?.storeId === 'string' ? parsed.storeId.trim().toLowerCase() : '';

      if (!hintedStoreId) return false;

      if (typeof parsed.savedAt === 'number' && Date.now() - parsed.savedAt > 1000 * 60 * 60 * 24 * 7) {
        window.localStorage.removeItem(LAST_STORE_HINT_KEY);
        return false;
      }

      if (searchParams.get('store') === hintedStoreId) {
        return false;
      }

      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('store', hintedStoreId);
      setSearchParams(nextParams, { replace: true });
      return true;
    } catch {
      return false;
    }
  }, [isCustomDomainHost, searchParams, setSearchParams]);

  useEffect(() => {
    if (!isStandalone) return;
    if (isCustomDomainHost) return;
    if (hasIdentifier) return;
    if (resolvedTenant.status === 'loading') return;

    restoreStoreHintForStandalone();
  }, [isStandalone, hasIdentifier, resolvedTenant.status, restoreStoreHintForStandalone]);

  useEffect(() => {
    if (!isStandalone || typeof window === 'undefined') return;
    if (attemptedRouteRestoreRef.current) return;

    attemptedRouteRestoreRef.current = true;

    const route = readPwaLastRoute(window.location.hostname);
    if (!route) return;

    const isRootLike = location.pathname === '/' || location.pathname === '/index';
    const targetUrl = `${route.pathname}${route.search || ''}`;
    const currentUrl = `${location.pathname}${location.search}`;

    if (!isRootLike || targetUrl === currentUrl) return;

    navigate(targetUrl, { replace: true });
  }, [isStandalone, location.pathname, location.search, navigate]);

  useEffect(() => {
    // Keep retrying while we have recovery signal but tenant is still missing.
    if (!hasRecoverySignal || tenant) return;

    const retry = () => {
      refetchLandingData();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        retry();
      }
    };

    const intervalId = window.setInterval(retry, 4000);

    window.addEventListener('online', retry);
    window.addEventListener('focus', retry);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('online', retry);
      window.removeEventListener('focus', retry);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [hasRecoverySignal, tenant, refetchLandingData]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hintStoreId = (storeId || tenant?.subdomain || persistedIdentity?.shopId || '').trim().toLowerCase();
    if (!hintStoreId && !tenantId) return;

    if (hintStoreId) {
      try {
        window.localStorage.setItem(
          LAST_STORE_HINT_KEY,
          JSON.stringify({
            storeId: hintStoreId,
            savedAt: Date.now(),
          })
        );
      } catch {
        // Ignore storage errors
      }
    }

    writePwaStoreIdentity({
      shopId: hintStoreId || null,
      shopDomain: window.location.hostname,
      tenantId: tenantId || null,
    });
  }, [storeId, tenant?.subdomain, tenantId, persistedIdentity?.shopId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!tenantId) return;

    const params = new URLSearchParams(location.search);
    params.delete('__lovable_token');
    const normalizedSearch = params.toString();

    writePwaLastRoute({
      shopDomain: window.location.hostname,
      pathname: location.pathname,
      search: normalizedSearch ? `?${normalizedSearch}` : '',
    });
  }, [tenantId, location.pathname, location.search]);

  const pathInfo = useMemo(() => detectPageFromPath(location.pathname), [location.pathname]);
  const hasDeepLinkContent = Boolean(
    searchParams.get('product') ||
    searchParams.get('article') ||
    pathInfo?.contentId
  );

  const shouldDeferCatalogLoading = isStandalone &&
    (!pathInfo || pathInfo.pageView === 'warranty') &&
    !hasDeepLinkContent;

  const [catalogEnabled, setCatalogEnabled] = useState(() => !shouldDeferCatalogLoading);

  useEffect(() => {
    if (!catalogEnabled && !shouldDeferCatalogLoading) {
      setCatalogEnabled(true);
    }
  }, [catalogEnabled, shouldDeferCatalogLoading]);

  const ensureCatalogDataLoaded = useCallback(() => {
    setCatalogEnabled(true);
  }, []);

  // Preload apple template if needed + preload IP for warranty lookup
  useEffect(() => {
    if (template === 'apple_landing') appleImport();
    preloadClientIp();
  }, [template]);

  const { data: productsData } = usePublicLandingProducts(tenantId, { enabled: catalogEnabled });
  const { data: articlesData } = usePublicLandingArticles(tenantId, { enabled: catalogEnabled });

  // PWA manifest
  useDynamicManifest(storeName, storeId, settings?.store_logo_url);

  // OG meta
  const ogTitle = storeName ? `${storeName}` : undefined;
  const ogDesc = settings?.store_description || undefined;
  const ogImage = settings?.store_logo_url || undefined;
  useDynamicOGMeta(ogTitle, ogDesc, ogImage);

  // Only keep recovering when BOTH identifier and tenant data are missing.
  // This allows rendering cached tenant data instantly even if identifier is temporarily unavailable.
  const shouldKeepRecovering = isStandalone && !hasIdentifier && !tenant;

  // CRITICAL FIX: Loading timeout to prevent infinite skeleton
  // After 5 seconds, stop showing skeleton regardless of API state
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  useEffect(() => {
    // Only start timeout if we're actually in a loading/recovering state
    const shouldShowSkeleton =
      (isLoading && !tenant)
      || (isError && hasIdentifier && !tenant)
      || (!hasIdentifier && !tenant && resolvedTenant.status === 'loading')
      || shouldKeepRecovering;

    if (!shouldShowSkeleton) {
      setLoadingTimedOut(false);
      return;
    }

    const timer = setTimeout(() => setLoadingTimedOut(true), 5000);
    return () => clearTimeout(timer);
  }, [isLoading, isError, hasIdentifier, tenant, resolvedTenant.status, shouldKeepRecovering]);

  // If timed out, stop skeleton and allow cached UI/error UI to render
  const showSkeleton = !loadingTimedOut && (
    (isLoading && !tenant)
    || (isError && hasIdentifier && !tenant)
    || (!hasIdentifier && !tenant && resolvedTenant.status === 'loading')
    || shouldKeepRecovering
  );

  // Loading / error states — keep preloader visible during skeleton
  if (showSkeleton) {
    return isStandalone ? (
      <div className="min-h-screen bg-white">
        <div className="h-14 bg-gray-100 animate-pulse" />
        <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-gray-200 animate-pulse" />
            <div className="h-7 w-32 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="bg-[#f5f5f7] rounded-2xl p-5 space-y-4">
            <div className="flex gap-2">
              <div className="flex-1 h-12 bg-white rounded-xl animate-pulse" />
              <div className="h-12 w-16 bg-gray-300 rounded-xl animate-pulse" />
            </div>
            <div className="h-14 bg-white rounded-xl animate-pulse" />
            <div className="h-14 bg-white rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    ) : (
      <div className="min-h-screen bg-white">
        <div className="h-14 bg-gray-100 animate-pulse" />
        <div className="h-48 bg-gray-100 animate-pulse" />
        <div className="p-4 space-y-3">
          <div className="h-6 w-40 bg-gray-200 rounded animate-pulse" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />
            <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />
            <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />
            <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />
          </div>
        </div>
      </div>
    );
  }
  if (!tenant) {
    // Hide preloader on terminal states
    (window as any).__hideAppPreloader?.();
    // and keep app in recover mode instead.
    if (isStandalone && hasRecoverySignal) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <Card className="max-w-sm w-full"><CardContent className="pt-6 text-center space-y-2">
            <Store className="h-14 w-14 mx-auto text-muted-foreground mb-2" />
            <h2 className="text-lg font-semibold">Đang khôi phục cửa hàng…</h2>
            <p className="text-sm text-muted-foreground">Mạng đang yếu, ứng dụng sẽ tự tải lại dữ liệu khi có kết nối.</p>
          </CardContent></Card>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-sm w-full"><CardContent className="pt-6 text-center">
          <Store className="h-14 w-14 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">Không tìm thấy cửa hàng</h2>
          <p className="text-sm text-muted-foreground">Cửa hàng không tồn tại hoặc chưa được kích hoạt.</p>
        </CardContent></Card>
      </div>
    );
  }

  const branches: BranchInfo[] = landingData?.branches || [];

  // Skeleton for lazy template loading
  const templateFallback = (
    <div className="min-h-screen bg-white">
      <div className="h-14 bg-gray-100 animate-pulse" />
      <div className="h-48 bg-gray-100 animate-pulse" />
      <div className="p-4 space-y-3">
        <div className="h-6 w-40 bg-gray-200 rounded animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />
          <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />
          <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />
          <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />
        </div>
      </div>
    </div>
  );

  // Apple Landing uses its own standalone template
  if (template === 'apple_landing') {
    return (
      <LandingCartProvider>
        <Suspense fallback={templateFallback}>
          <AppleStyleLandingTemplate
            settings={settings}
            tenant={tenant}
            tenantId={tenantId}
            storeId={storeId}
            branches={branches}
            productsData={productsData}
            articlesData={articlesData}
            searchParams={searchParams}
            setSearchParams={setSearchParams}
            queryClient={queryClient}
            onRequireCatalogData={ensureCatalogDataLoaded}
          />
        </Suspense>
      </LandingCartProvider>
    );
  }

  // All other templates use UniversalStoreTemplate
  return (
    <LandingCartProvider>
      <Suspense fallback={templateFallback}>
        <UniversalStoreTemplate
          settings={settings}
          tenant={tenant}
          tenantId={tenantId}
          storeId={storeId}
          branches={branches}
          productsData={productsData}
          articlesData={articlesData}
          searchParams={searchParams}
          setSearchParams={setSearchParams}
          queryClient={queryClient}
          templateId={template}
          onRequireCatalogData={ensureCatalogDataLoaded}
        />
      </Suspense>
    </LandingCartProvider>
  );
}
