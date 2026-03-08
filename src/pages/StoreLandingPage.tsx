import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { useParams, useLocation, useSearchParams } from 'react-router-dom';
import { usePublicLandingSettings, BranchInfo } from '@/hooks/useTenantLanding';
import { usePublicLandingProducts } from '@/hooks/useLandingProducts';
import { usePublicLandingArticles } from '@/hooks/useLandingArticles';
import { useQueryClient } from '@tanstack/react-query';
import { useTenantResolver } from '@/hooks/useTenantResolver';
import { LandingCartProvider } from '@/hooks/useLandingCart';
import { Store } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

// Lazy load heavy templates - they import DOMPurify and many components
const UniversalStoreTemplate = lazy(() => import('@/components/website-templates/UniversalStoreTemplate'));
const AppleStyleLandingTemplate = lazy(() => import('@/components/website-templates/AppleStyleLandingTemplate'));
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

export default function StoreLandingPage({ storeIdFromSubdomain }: StoreLandingPageProps) {
  const { storeId: storeIdFromParams } = useParams<{ storeId: string }>();
  const resolvedTenant = useTenantResolver();
  const storeId = storeIdFromSubdomain || storeIdFromParams || resolvedTenant.subdomain;
  const hasIdentifier = !!storeId || !!resolvedTenant.tenantId;
  const { data: landingData, isLoading } = usePublicLandingSettings(storeId, resolvedTenant.tenantId);
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const settings = landingData?.settings;
  const tenant = landingData?.tenant;
  const tenantId = tenant?.id || null;
  const storeName = settings?.store_name || tenant?.name || storeId || '';
  const template = settings?.website_template || 'phone_store';

  const { data: productsData } = usePublicLandingProducts(tenantId);
  const { data: articlesData } = usePublicLandingArticles(tenantId);

  // PWA manifest
  useDynamicManifest(storeName, storeId, settings?.store_logo_url);

  // OG meta
  const ogTitle = storeName ? `${storeName}` : undefined;
  const ogDesc = settings?.store_description || undefined;
  const ogImage = settings?.store_logo_url || undefined;
  useDynamicOGMeta(ogTitle, ogDesc, ogImage);

  // Loading / error states
  if (isLoading || (!hasIdentifier && resolvedTenant.status === 'loading')) {
    return (
      <div className="min-h-screen bg-white">
        {/* Skeleton header */}
        <div className="h-14 bg-muted/30 animate-pulse" />
        {/* Skeleton hero */}
        <div className="h-48 bg-muted/20 animate-pulse" />
        {/* Skeleton content */}
        <div className="p-4 space-y-3">
          <div className="h-6 w-40 bg-muted/30 rounded animate-pulse" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-32 bg-muted/20 rounded-lg animate-pulse" />
            <div className="h-32 bg-muted/20 rounded-lg animate-pulse" />
          </div>
        </div>
      </div>
    );
  }
  if (!hasIdentifier || !tenant) {
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
      <div className="h-14 bg-muted/30 animate-pulse" />
      <div className="h-48 bg-muted/20 animate-pulse" />
      <div className="p-4 space-y-3">
        <div className="h-6 w-40 bg-muted/30 rounded animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-32 bg-muted/20 rounded-lg animate-pulse" />
          <div className="h-32 bg-muted/20 rounded-lg animate-pulse" />
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
        />
      </Suspense>
    </LandingCartProvider>
  );
}
