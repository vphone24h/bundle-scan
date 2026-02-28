import { useState, useEffect, useCallback, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { useParams, useLocation, useSearchParams } from 'react-router-dom';
import { usePublicLandingSettings, useWarrantyLookup, useCustomerPointsPublic, WarrantyResult, BranchInfo } from '@/hooks/useTenantLanding';
import { usePublicLandingProducts, LandingProduct } from '@/hooks/useLandingProducts';
import { usePublicLandingArticles, LandingArticle } from '@/hooks/useLandingArticles';
import { useQueryClient } from '@tanstack/react-query';
import { useTenantResolver } from '@/hooks/useTenantResolver';
import { usePublicCustomerVouchers } from '@/hooks/useVouchers';
import PhoneStoreTemplate from '@/components/website-templates/PhoneStoreTemplate';
import { Loader2, Store } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

// === PWA Manifest Hook ===
function useDynamicManifest(storeName: string, storeId: string | null, logoUrl?: string | null) {
  const location = useLocation();
  useEffect(() => {
    if (!storeId) return;
    const manifest = {
      name: storeName || `${storeId} - vkho.vn`,
      short_name: storeId,
      description: `${storeName || storeId}`,
      start_url: window.location.href,
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#f8fafc',
      theme_color: '#1e3a5f',
      icons: [
        { src: logoUrl || '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable any' },
        { src: logoUrl || '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable any' }
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
    let appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (!appleTitle) { appleTitle = document.createElement('meta'); appleTitle.setAttribute('name', 'apple-mobile-web-app-title'); document.head.appendChild(appleTitle); }
    appleTitle.setAttribute('content', storeName || storeId);
    if (logoUrl) {
      let appleTouchIcon = document.querySelector('link[rel="apple-touch-icon"]');
      if (!appleTouchIcon) { appleTouchIcon = document.createElement('link'); appleTouchIcon.setAttribute('rel', 'apple-touch-icon'); document.head.appendChild(appleTouchIcon); }
      appleTouchIcon.setAttribute('href', logoUrl);
    }
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
  const primaryColor = settings?.primary_color || '#0f766e';
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground">Đang tải...</p>
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

  // All templates use the PhoneStoreTemplate for now (others coming soon)
  return (
    <PhoneStoreTemplate
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
  );
}
