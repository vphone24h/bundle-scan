import { useState, useEffect, useCallback, useMemo } from 'react';
import { PullToRefresh } from '@/components/layout/PullToRefresh';
import DOMPurify from 'dompurify';
import { SetURLSearchParams, useLocation } from 'react-router-dom';
import { buildProductPath, buildProductDetailPath, buildArticlePath, buildPagePath, extractProductIdFromPath, detectPageFromPath } from '@/lib/slugify';
import { QueryClient } from '@tanstack/react-query';
import { TenantLandingSettings, useWarrantyLookup, useCustomerPointsPublic, WarrantyResult, BranchInfo, HomeSectionItem } from '@/hooks/useTenantLanding';
import { LandingProduct, LandingProductCategory } from '@/hooks/useLandingProducts';
import { LandingArticle, LandingArticleCategory } from '@/hooks/useLandingArticles';
import { usePublicCustomerVouchers } from '@/hooks/useVouchers';
import { ProductDetailPage } from '@/components/landing/ProductDetailPage';
import { InstallmentCalculatorDialog } from '@/components/dashboard/InstallmentCalculatorDialog';
import { StaffRatingForm } from '@/components/landing/StaffRatingForm';
import { VoucherClaimForm } from '@/components/landing/VoucherClaimForm';
import StoreReviewsSection from '@/components/landing/StoreReviewsSection';
import { ScrollReveal, useParallax } from '@/hooks/useScrollReveal';
import { ResolvedIndustryConfig, getIndustryConfig, GOOGLE_FONTS, NavItemConfig, getDefaultNavItems, getSystemPageById, SYSTEM_PAGES, HomeSection, LayoutStyle } from '@/lib/industryConfig';
import {
  RepairPage, TradeInPage, InstallmentPage, PriceListPage,
  BookingPage, BranchesPage, ContactPage, AccessoriesPage,
  ComparePage, GenericSystemPage,
} from './SystemPageTemplates';
import LayoutBannerCollapsible from './LayoutBannerCollapsible';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatNumber } from '@/lib/formatNumber';
import { format, addMonths, isAfter, differenceInDays } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  Search, MapPin, Phone, Mail, Shield, CheckCircle, XCircle, Smartphone,
  Loader2, Building2, Headphones, Calendar, Package,
  Clock, Users, Star, Gift, ChevronDown,
  ShoppingBag, Newspaper, ArrowLeft,
  Link2, Menu, X,
} from 'lucide-react';
import { LayoutHero } from './layouts/HeroVariants';
import { LayoutProductCard, getProductGridClass } from './layouts/ProductCardVariants';
import { LayoutTrustBadges } from './layouts/TrustBadgeVariants';
import { LayoutHeader } from './layouts/HeaderVariants';
import { LayoutFooter } from './layouts/FooterVariants';
import { LayoutStickyBar } from './layouts/StickyBarVariants';
import { CTVAuthDialog } from '@/components/landing/CTVAuthDialog';
import { CTVDashboard } from '@/components/landing/CTVDashboard';
import { useShopCTVSettings } from '@/hooks/useShopCTV';
import { supabase } from '@/integrations/supabase/client';
import { OrderLookupPage } from '@/components/landing/OrderLookupPage';


export interface UniversalTemplateProps {
  settings: TenantLandingSettings | null;
  tenant: { id: string; name: string; subdomain: string; status: string };
  tenantId: string | null;
  storeId: string | null;
  branches: BranchInfo[];
  productsData: { categories: LandingProductCategory[]; products: LandingProduct[] } | undefined;
  articlesData: { categories: LandingArticleCategory[]; articles: LandingArticle[] } | undefined;
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
  queryClient: QueryClient;
  templateId?: string;
}

// Warranty calculation
interface WarrantyStatus { valid: boolean; message: string; endDate: Date | null; startDate: Date; months: number; daysLeft?: number; }
function calculateWarrantyStatus(item: WarrantyResult): WarrantyStatus | null {
  const saleDate = new Date(item.export_date);
  const warrantyMonths = parseInt(item.warranty || '0', 10);
  if (!warrantyMonths || warrantyMonths <= 0) return { valid: false, message: 'Không BH', endDate: null, startDate: saleDate, months: 0 };
  const endDate = addMonths(saleDate, warrantyMonths);
  const isValid = isAfter(endDate, new Date());
  const daysLeft = isValid ? differenceInDays(endDate, new Date()) : 0;
  return { valid: isValid, message: isValid ? `Còn ${daysLeft} ngày` : 'Hết BH', endDate, startDate: saleDate, months: warrantyMonths, daysLeft };
}

type PageView = 'home' | 'products' | 'news' | 'warranty' | 'article-detail' | 'repair' | 'tradein' | 'installment' | 'accessories' | 'compare' | 'pricelist' | 'booking' | 'branches' | 'contact' | 'services' | 'rooms' | 'courses' | 'doctors' | 'collection' | 'promotion' | 'reviews' | 'system-page' | 'ctv-dashboard' | 'order-lookup';

export default function UniversalStoreTemplate({
  settings, tenant, tenantId, storeId, branches,
  productsData, articlesData, searchParams, setSearchParams, queryClient,
  templateId,
}: UniversalTemplateProps) {
  const baseConfig = getIndustryConfig(templateId || settings?.website_template || 'phone_store');
  
  // Apply user overrides from settings (Phase 3)
  const config = useMemo(() => {
    const c = { ...baseConfig };
    if ((settings as any)?.custom_layout_style) c.layoutStyle = (settings as any).custom_layout_style as LayoutStyle;
    if ((settings as any)?.custom_font_family) c.fontFamily = (settings as any).custom_font_family;
    if ((settings as any)?.hero_title) c.heroTitle = (settings as any).hero_title;
    if ((settings as any)?.hero_subtitle) c.heroSubtitle = (settings as any).hero_subtitle;
    if ((settings as any)?.hero_cta) c.heroCta = (settings as any).hero_cta;
    if ((settings as any)?.custom_home_sections) {
      const customSections = (settings as any).custom_home_sections as HomeSectionItem[];
      c.homeSections = customSections.filter((s: HomeSectionItem) => s.enabled).map((s: HomeSectionItem) => s.id) as HomeSection[];
      // Store category display mode
      const catSection = customSections.find(s => s.id === 'categories');
      if (catSection) (c as any)._categoryDisplayMode = catSection.displayMode || 'horizontal';
      // When user explicitly enables sections via editor, force-enable corresponding features
      for (const s of customSections.filter((s: HomeSectionItem) => s.enabled)) {
        if (s.id === 'articles') c.features = { ...c.features, articles: true };
        if (s.id === 'warranty') c.features = { ...c.features, warranty: true };
        if (s.id === 'voucher') c.features = { ...c.features, voucher: true };
        if (s.id === 'reviews') c.features = { ...c.features, reviews: true };
        if (s.id === 'branches') c.features = { ...c.features, branches: true };
        if (s.id === 'storeInfo') c.features = { ...c.features, storeInfo: true };
        if (s.id === 'categories') c.features = { ...c.features, categories: true };
      }
    }
    return c;
  }, [baseConfig, settings]);

  const accentColor = settings?.primary_color || config.accentColor;

  // PWA standalone mode (bookmark/home screen) → default to warranty page
  const isStandalone = typeof window !== 'undefined' && (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
  const [pageView, setPageView] = useState<PageView>(isStandalone ? 'warranty' : 'home');
  const [selectedArticle, setSelectedArticle] = useState<LandingArticle | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedArticleCategoryId, setSelectedArticleCategoryId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<LandingProduct | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [productFilterTag, setProductFilterTag] = useState<string | null>(null);
  const [showInstallmentCalc, setShowInstallmentCalc] = useState(false);
  const [ctvAuthOpen, setCtvAuthOpen] = useState(false);
  const [ctvSession, setCtvSession] = useState<any>(null);

  // CTV settings
  const { data: ctvSettings } = useShopCTVSettings(tenantId);
  const ctvEnabled = !!ctvSettings?.is_enabled;

  // Track CTV ref cookie & auto-open registration
  const refCode = searchParams.get('ref') || null;
  useEffect(() => {
    if (refCode && tenantId) {
      localStorage.setItem(`ctv_ref_${tenantId}`, JSON.stringify({ code: refCode, ts: Date.now() }));
      if (ctvSession && ctvEnabled) {
        // Already logged in as CTV — go straight to dashboard
        setPageView('ctv-dashboard');
      } else if (!ctvSession && ctvEnabled) {
        // Not logged in — open registration dialog
        setCtvAuthOpen(true);
      }
    }
  }, [refCode, tenantId, ctvSession, ctvEnabled]);

  // Check CTV auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCtvSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCtvSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load Google Font if needed
  useEffect(() => {
    const fontUrl = GOOGLE_FONTS[config.fontFamily];
    if (fontUrl && !document.querySelector(`link[href="${fontUrl}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = fontUrl;
      document.head.appendChild(link);
    }
  }, [config.fontFamily]);

  // Parallax for hero
  const { ref: heroRef, offset: heroOffset } = useParallax(0.3);

  // Warranty
  const warrantySessionId = storeId || tenantId || null;
  const warrantyStorageKey = warrantySessionId ? `warranty_session_${warrantySessionId}` : null;
  const [restoredSessionKey, setRestoredSessionKey] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [submittedValue, setSubmittedValue] = useState('');

  const { data: warrantyResults, isLoading: isSearching, isFetched, error: warrantyError } = useWarrantyLookup(submittedValue, tenantId);

  useEffect(() => {
    if (!warrantyStorageKey || restoredSessionKey === warrantyStorageKey) return;
    try {
      const raw = localStorage.getItem(warrantyStorageKey);
      const parsed = raw ? JSON.parse(raw) : null;
      const restoredSearch = typeof parsed?.searchValue === 'string' ? parsed.searchValue.trim() : '';
      if (restoredSearch) { setSearchValue(restoredSearch); setSubmittedValue(restoredSearch); setPageView('warranty'); }
    } catch {} finally { setRestoredSessionKey(warrantyStorageKey); }
  }, [warrantyStorageKey, restoredSessionKey]);

  useEffect(() => {
    if (warrantyStorageKey && submittedValue && warrantyResults && warrantyResults.length > 0) {
      localStorage.setItem(warrantyStorageKey, JSON.stringify({ searchValue: submittedValue }));
    }
  }, [warrantyStorageKey, submittedValue, warrantyResults]);

  const location = useLocation();

  // Deep-link from path-based URLs, query params, or legacy product paths
  useEffect(() => {
    const productId = searchParams.get('product');
    const articleId = searchParams.get('article');
    
    // Try path-based page detection: /san-pham/, /tin-tuc/, /san-pham/slug-ID
    const pageInfo = detectPageFromPath(location.pathname);
    if (pageInfo) {
      if (pageInfo.pageView === 'products' && pageInfo.contentId) {
        // Product detail: /san-pham/category/product-slug-SHORTID
        const p = productsData?.products?.find(x => x.id.startsWith(pageInfo.contentId!));
        if (p) { setSelectedProduct(p); setPageView('products'); return; }
      } else if (pageInfo.pageView === 'news' && pageInfo.contentId) {
        // Article detail: /tin-tuc/article-slug-SHORTID
        const a = articlesData?.articles?.find(x => x.id.startsWith(pageInfo.contentId!));
        if (a) { setSelectedArticle(a); setPageView('article-detail'); return; }
      } else if (!pageInfo.contentId) {
        // Page-level navigation: /san-pham/, /tin-tuc/, etc.
        setPageView(pageInfo.pageView as PageView);
        return;
      }
    }
    
    // Legacy: Try path-based product URL: /category/product-slug-SHORTID
    if (!productId && !articleId && productsData?.products) {
      const shortId = extractProductIdFromPath(location.pathname);
      if (shortId) {
        const p = productsData.products.find(x => x.id.startsWith(shortId));
        if (p) { setSelectedProduct(p); setPageView('products'); }
      }
    }
    
    // Query param fallback
    if (productId && productsData?.products) {
      const p = productsData.products.find(x => x.id === productId);
      if (p) { setSelectedProduct(p); setPageView('products'); }
    }
    if (articleId && articlesData?.articles) {
      const a = articlesData.articles.find(x => x.id === articleId);
      if (a) { setSelectedArticle(a); setPageView('article-detail'); }
    }
  }, [searchParams, productsData, articlesData, location.pathname]);

  const isPhoneSearch = /^0\d{9,10}$/.test(submittedValue.replace(/\s/g, ''));
  const firstResult = warrantyResults?.[0];
  const customerPhoneFromResult = firstResult?.customer_phone || '';
  const phoneForPoints = isPhoneSearch ? submittedValue : customerPhoneFromResult;
  const { data: customerPoints } = useCustomerPointsPublic(phoneForPoints, tenantId);
  const customerName = firstResult?.customer_name || customerPoints?.customer_name || '';
  const customerId = firstResult?.customer_id || customerPoints?.customer_id || null;
  const reviewRewardPoints = customerPoints?.review_reward_points || 0;
  const { data: customerVouchers } = usePublicCustomerVouchers(phoneForPoints, tenantId);

  const displayStoreName = settings?.store_name || tenant.name;
  const warrantyHotline = settings?.warranty_hotline;
  const supportGroupUrl = settings?.support_group_url;
  const facebookUrl = settings?.facebook_url;
  const zaloPhone = settings?.zalo_url;
  const zaloUrl = zaloPhone ? (zaloPhone.startsWith('http') ? zaloPhone : `https://zalo.me/${zaloPhone.replace(/\s/g, '')}`) : null;
  const tiktokUrl = settings?.tiktok_url;

  const featuredProducts = productsData?.products?.filter(p => p.is_featured) || [];
  const allProducts = productsData?.products || [];
  const filteredProducts = useMemo(() => {
    let products = selectedCategoryId ? allProducts.filter(p => p.category_id === selectedCategoryId) : allProducts;
    // Filter by product tag (flash sale, featured, combo, custom tab)
    if (productFilterTag === 'featured') {
      products = products.filter(p => p.is_featured);
    } else if (productFilterTag === 'flashSale' || productFilterTag === 'combo') {
      products = products.filter(p => (p as any).home_tab_ids?.includes(productFilterTag));
    } else if (productFilterTag && productFilterTag.startsWith('productTab_')) {
      products = products.filter(p => (p as any).home_tab_ids?.includes(productFilterTag));
    }
    if (productSearchQuery.trim()) {
      const q = productSearchQuery.toLowerCase().trim();
      products = products.filter(p => p.name.toLowerCase().includes(q));
    }
    return products;
  }, [allProducts, selectedCategoryId, productSearchQuery, productFilterTag]);
  const featuredArticles = articlesData?.articles?.filter(a => a.is_featured) || [];
  const homeArticles = articlesData?.articles?.filter((a: any) => a.is_featured_home) || [];

  const handlePointsAwarded = useCallback(() => { queryClient.invalidateQueries({ queryKey: ['customer-points-public'] }); }, [queryClient]);
  const handleWarrantyLogout = () => { if (warrantyStorageKey) localStorage.removeItem(warrantyStorageKey); setSearchValue(''); setSubmittedValue(''); setPageView('home'); };
  const handleSearch = () => { if (searchValue.trim()) { setSubmittedValue(searchValue.trim()); if (pageView === 'home') setPageView('warranty'); } };
  const handleKeyPress = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleSearch(); };

  const navigateTo = (view: PageView, opts?: { keepCategory?: boolean; filterTag?: string | null }) => {
    setPageView(view); setSelectedArticle(null); setSelectedProduct(null); setSelectedArticleCategoryId(null);
    if (!opts?.keepCategory) setSelectedCategoryId(null);
    setProductFilterTag(opts?.filterTag ?? null);
    const newParams = new URLSearchParams();
    setSearchParams(newParams, { replace: true });
    // Update browser URL path
    const pagePath = buildPagePath(view);
    window.history.replaceState(null, '', pagePath === '/' ? '/' : pagePath);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openArticle = (article: LandingArticle) => {
    setSelectedArticle(article); setPageView('article-detail');
    const articlePath = buildArticlePath(article.title, article.id);
    window.history.replaceState(null, '', articlePath);
    setSearchParams(new URLSearchParams(), { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openProduct = (p: LandingProduct) => {
    setSelectedProduct(p);
    const categories = productsData?.categories || [];
    const category = categories.find(c => c.id === p.category_id);
    const parentCategory = category?.parent_id ? categories.find(c => c.id === category.parent_id) : null;
    const productPath = buildProductDetailPath(p.name, p.id, category?.name, parentCategory?.name);
    window.history.replaceState(null, '', productPath);
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const copyShareLink = (type: 'product' | 'article' | 'page', id: string) => {
    const baseUrl = new URL(window.location.href);
    baseUrl.search = '';
    baseUrl.hash = '';
    
    if (type === 'product') {
      const product = productsData?.products?.find(p => p.id === id);
      if (product) {
        const categories = productsData?.categories || [];
        const category = categories.find(c => c.id === product.category_id);
        const parentCategory = category?.parent_id ? categories.find(c => c.id === category.parent_id) : null;
        baseUrl.pathname = buildProductDetailPath(product.name, product.id, category?.name, parentCategory?.name);
      } else {
        baseUrl.searchParams.set('product', id);
      }
    } else if (type === 'article') {
      const article = articlesData?.articles?.find(a => a.id === id);
      if (article) {
        baseUrl.pathname = buildArticlePath(article.title, article.id);
      } else {
        baseUrl.searchParams.set('article', id);
      }
    } else if (type === 'page') {
      baseUrl.pathname = buildPagePath(id);
    }
    
    const cleanUrl = baseUrl.toString();
    navigator.clipboard.writeText(cleanUrl).then(() => {
      import('sonner').then(({ toast }) => toast.success('Đã sao chép link chia sẻ'));
    }).catch(() => {});
  };

  // Build nav items from custom_nav_items or defaults
  const customNavItems = (settings as any)?.custom_nav_items as NavItemConfig[] | null;
  const navItems = useMemo(() => {
    if (customNavItems && customNavItems.length > 0) {
      return customNavItems.filter(item => item.enabled);
    }
    // Fallback to default 4 items
    return getDefaultNavItems(config);
  }, [customNavItems, config]);

  const handleNavClick = (item: NavItemConfig) => {
    if (item.type === 'page' && item.pageView) {
      navigateTo(item.pageView as PageView);
    } else if (item.type === 'link' && item.url) {
      window.open(item.url, '_blank', 'noopener,noreferrer');
    } else if (item.type === 'link') {
      // Link type without URL - just scroll to top / show home
      navigateTo('home');
    }
  };

  const isNavActive = (item: NavItemConfig) => {
    if (item.type === 'page' && item.pageView) {
      if (item.pageView === 'news' && pageView === 'article-detail') return true;
      return pageView === item.pageView;
    }
    return false;
  };

  // CTV Dashboard view
  if (pageView === 'ctv-dashboard' && tenantId) {
    return (
      <CTVDashboard
        tenantId={tenantId}
        storeName={displayStoreName}
        storeUrl={storeId ? `${window.location.origin}/store/${storeId}` : window.location.origin}
        accentColor={accentColor}
        onBack={() => navigateTo('home')}
      />
    );
  }

  // If a product is selected, show full page instead of template
  if (selectedProduct) {
    return (
      <>
        <ProductDetailPage
          product={selectedProduct}
          onBack={() => {
            setSelectedProduct(null);
            window.history.replaceState(null, '', buildPagePath('products'));
            setSearchParams(new URLSearchParams(), { replace: true });
          }}
          tenantId={tenantId}
          branches={branches.map(b => ({ id: b.id, name: b.name }))}
          primaryColor={accentColor}
          warrantyHotline={warrantyHotline}
          onShare={() => copyShareLink('product', selectedProduct.id)}
          onInstallment={() => setShowInstallmentCalc(true)}
          showInstallmentButton={true}
          detailSections={(settings as any)?.custom_product_detail_sections || null}
          ctaButtons={(settings as any)?.custom_cta_buttons || null}
          websiteTemplate={settings?.website_template}
          relatedProducts={allProducts.filter(p => p.category_id === selectedProduct.category_id && p.id !== selectedProduct.id).slice(0, 10)}
          onProductClick={openProduct}
          storeInfo={{ name: displayStoreName, phone: settings?.store_phone || '', address: settings?.store_address || '', email: settings?.store_email || '' }}
          zaloUrl={settings?.zalo_url}
          facebookUrl={settings?.facebook_url}
          paymentConfig={{
            codEnabled: (settings as any)?.payment_cod_enabled !== false,
            transferEnabled: !!(settings as any)?.payment_transfer_enabled,
            bankName: (settings as any)?.payment_bank_name || null,
            accountNumber: (settings as any)?.payment_account_number || null,
            accountHolder: (settings as any)?.payment_account_holder || null,
            confirmZaloUrl: (settings as any)?.payment_confirm_zalo_url || null,
            confirmMessengerUrl: (settings as any)?.payment_confirm_messenger_url || null,
          }}
          onNavigateOrderLookup={() => { setSelectedProduct(null); navigateTo('order-lookup' as PageView); }}
        />
        <InstallmentCalculatorDialog open={showInstallmentCalc} onOpenChange={setShowInstallmentCalc} />
      </>
    );
  }

  return (
    <PullToRefresh>
    <div className="min-h-screen bg-white text-[#1d1d1f]" style={{ fontFamily: config.fontFamily }}>
      {/* === HEADER === */}
      <LayoutHeader
        layoutStyle={config.layoutStyle}
        storeName={displayStoreName}
        logoUrl={settings?.store_logo_url}
        accentColor={accentColor}
        mobileMenuOpen={mobileMenuOpen}
        onToggleMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
        onNavigateHome={() => navigateTo('home')}
        onOpenSearch={() => { navigateTo('products'); setTimeout(() => document.getElementById('product-search-input')?.focus(), 100); }}
        navItems={navItems}
        onNavClick={handleNavClick}
        isNavActive={isNavActive}
        onCloseMenu={() => setMobileMenuOpen(false)}
        menuPosition={(settings as any)?.menu_position || 'left'}
      />

      {/* CTV Login/Dashboard Button */}
      {ctvEnabled && (
        <div className="bg-white border-b border-black/5 px-4 py-1.5 flex justify-end">
          {ctvSession ? (
            <button
              onClick={() => navigateTo('ctv-dashboard' as PageView)}
              className="text-xs font-medium px-3 py-1.5 rounded-full border transition-colors hover:bg-black/5"
              style={{ borderColor: accentColor, color: accentColor }}
            >
              👤 Dashboard CTV
            </button>
          ) : (
            <button
              onClick={() => setCtvAuthOpen(true)}
              className="text-xs font-medium px-3 py-1.5 rounded-full border transition-colors hover:bg-black/5"
              style={{ borderColor: accentColor, color: accentColor }}
            >
              🤝 Đăng nhập
            </button>
          )}
        </div>
      )}

      {/* CTV Auth Dialog */}
      {tenantId && (
        <CTVAuthDialog
          open={ctvAuthOpen}
          onOpenChange={setCtvAuthOpen}
          tenantId={tenantId}
          storeName={displayStoreName}
          accentColor={accentColor}
          onSuccess={() => navigateTo('ctv-dashboard' as PageView)}
          referrerCode={refCode}
        />
      )}

      <main>
        {/* === HOME PAGE === */}
        {pageView === 'home' && (
          <div>
            {config.homeSections.map((sectionId) => {
              switch (sectionId) {
                case 'hero':
                  return (
                    <LayoutHero
                      key="hero"
                      layoutStyle={config.layoutStyle}
                      config={config}
                      settings={settings}
                      accentColor={accentColor}
                      onNavigateProducts={() => navigateTo('products')}
                    />
                  );
                case 'trustBadges':
                  return (
                    <LayoutTrustBadges
                      key="trustBadges"
                      layoutStyle={config.layoutStyle}
                      badges={(settings as any)?.custom_trust_badges || config.trustBadges}
                      accentColor={accentColor}
                    />
                  );
                case 'categories': {
                  if (!config.features.categories || !productsData || productsData.categories.length === 0) return null;
                  const catDisplayMode = (config as any)._categoryDisplayMode || 'horizontal';
                  
                  if (catDisplayMode === 'vertical') {
                    // Vertical: stacked cards with cover images
                    return (
                      <section key="categories" className="py-8 bg-[#f5f5f7]">
                        <div className="max-w-[1200px] mx-auto px-4">
                          <ScrollReveal animation="fade-up">
                            <h2 className="text-lg font-bold tracking-tight mb-4">Danh mục sản phẩm</h2>
                          </ScrollReveal>
                        </div>
                        <div className="flex flex-col gap-0">
                          {productsData.categories.map((cat, idx) => (
                            <ScrollReveal key={cat.id} animation="fade-up" delay={idx * 80}>
                              <button
                                onClick={() => { setSelectedCategoryId(cat.id); navigateTo('products', { keepCategory: true }); }}
                                className={`group w-full overflow-hidden relative text-left ${cat.image_url ? 'min-h-[65vh] sm:min-h-[70vh]' : 'min-h-[120px]'}`}
                              >
                                {cat.image_url ? (
                                  <>
                                    <img src={cat.image_url} alt={cat.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                                    <div className="relative z-10 h-full flex flex-col justify-end p-6 min-h-[65vh] sm:min-h-[70vh]">
                                      <h3 className="text-xl font-bold text-white">{cat.name}</h3>
                                      <p className="text-sm text-white/80 mt-1">Khám phá ngay →</p>
                                    </div>
                                  </>
                                ) : (
                                  <div className="bg-white h-full flex items-center justify-between p-6 border border-black/5 group-hover:shadow-lg transition-shadow">
                                    <div>
                                      <h3 className="text-lg font-bold text-[#1d1d1f]">{cat.name}</h3>
                                      <p className="text-sm text-[#86868b] mt-0.5">Khám phá ngay →</p>
                                    </div>
                                    <ShoppingBag className="h-8 w-8 text-[#d2d2d7]" />
                                  </div>
                                )}
                              </button>
                            </ScrollReveal>
                          ))}
                        </div>
                      </section>
                    );
                  }
                  
                  // Horizontal: scrollable row (default)
                  return (
                    <ScrollReveal key="categories" animation="fade-up" delay={150}>
                      <section className="bg-[#f5f5f7] py-8">
                        <div className="max-w-[1200px] mx-auto px-4">
                          <div className="flex items-center overflow-x-auto gap-4 py-2 scrollbar-hide">
                            {productsData.categories.map(cat => (
                              <button key={cat.id} onClick={() => { setSelectedCategoryId(cat.id); navigateTo('products', { keepCategory: true }); }} className="flex flex-col items-center gap-2 min-w-[90px] group">
                                {cat.image_url ? (
                                  <img src={cat.image_url} alt={cat.name} className="h-16 w-16 rounded-2xl object-cover border border-black/5 group-hover:scale-105 transition-transform" />
                                ) : (
                                  <div className="h-16 w-16 rounded-2xl bg-white flex items-center justify-center border border-black/5 group-hover:scale-105 transition-transform">
                                    <ShoppingBag className="h-6 w-6 text-[#86868b]" />
                                  </div>
                                )}
                                <span className="text-[11px] font-medium text-center leading-tight">{cat.name}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </section>
                    </ScrollReveal>
                  );
                }
                case 'featuredProducts': {
                  if (featuredProducts.length === 0) return null;
                  const displayProducts = featuredProducts;
                  return (
                    <section key="featuredProducts" className="py-10 bg-white">
                      <div className="max-w-[1200px] mx-auto px-4">
                        <ScrollReveal animation="fade-up">
                          <div className="flex items-end justify-between mb-6">
                            <div>
                              <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{config.productSectionTitle}</h2>
                              {featuredProducts.length > 0 && <p className="text-xs text-[#86868b] mt-0.5">{config.productSectionSubtitle}</p>}
                            </div>
                            <button onClick={() => navigateTo('products', { filterTag: 'featured' })} className="text-xs font-medium shrink-0 flex items-center gap-1" style={{ color: accentColor }}>
                              Xem tất cả <ChevronDown className="h-3 w-3 -rotate-90" />
                            </button>
                          </div>
                        </ScrollReveal>
                        <div className={getProductGridClass(config.layoutStyle)}>
                          {displayProducts.slice(0, 8).map((p, i) => (
                            <ScrollReveal key={p.id} animation="fade-up" delay={i * 80}>
                              <LayoutProductCard layoutStyle={config.layoutStyle} product={p} onClick={() => openProduct(p)} accentColor={accentColor} />
                            </ScrollReveal>
                          ))}
                        </div>
                      </div>
                    </section>
                  );
                }
                case 'articles': {
                  const displayArticles = homeArticles.length > 0 ? homeArticles : (featuredArticles.length > 0 ? featuredArticles : (articlesData?.articles || []));
                  if (!config.features.articles || displayArticles.length === 0) return null;
                  return (
                    <section key="articles" className="py-12 bg-[#f5f5f7]">
                      <div className="max-w-[1200px] mx-auto px-4">
                        <ScrollReveal animation="fade-up">
                          <div className="text-center mb-8">
                            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">{config.navLabels.news}</h2>
                          </div>
                        </ScrollReveal>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                          {displayArticles.slice(0, 3).map((a, i) => (
                            <ScrollReveal key={a.id} animation="fade-up" delay={i * 100}>
                              <button onClick={() => openArticle(a)} className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all text-left group w-full">
                                {a.thumbnail_url ? (
                                  <img src={a.thumbnail_url} alt={a.title} className="w-full h-48 object-cover group-hover:scale-[1.02] transition-transform" />
                                ) : (
                                  <div className="w-full h-48 bg-[#f5f5f7] flex items-center justify-center"><Newspaper className="h-10 w-10 text-[#86868b]" /></div>
                                )}
                                <div className="p-5">
                                  <p className="font-semibold text-sm line-clamp-2 mb-2">{a.title}</p>
                                  {a.summary && <p className="text-xs text-[#86868b] line-clamp-2">{a.summary}</p>}
                                  <p className="text-[11px] font-medium mt-3" style={{ color: accentColor }}>Đọc thêm →</p>
                                </div>
                              </button>
                            </ScrollReveal>
                          ))}
                        </div>
                      </div>
                    </section>
                  );
                }
                case 'warranty':
                  if (!config.features.warranty || settings?.show_warranty_lookup === false) return null;
                  return (
                    <ScrollReveal key="warranty" animation="fade-up">
                      <section className="py-12 bg-white">
                        <div className="max-w-lg mx-auto px-4 text-center">
                          <Shield className="h-8 w-8 mx-auto mb-3" style={{ color: accentColor }} />
                          <h2 className="text-2xl font-bold tracking-tight mb-2">Tra cứu bảo hành</h2>
                          <p className="text-sm text-[#86868b] mb-6">Nhập IMEI hoặc số điện thoại để kiểm tra</p>
                          <div className="flex gap-2">
                            <Input placeholder="Nhập IMEI hoặc SĐT..." value={searchValue} onChange={e => setSearchValue(e.target.value)} onKeyPress={handleKeyPress} className="flex-1 h-12 text-base rounded-xl border-black/10" style={{ '--tw-ring-color': accentColor } as any} inputMode="tel" />
                            <Button onClick={handleSearch} disabled={!searchValue.trim() || isSearching} className="h-12 px-6 rounded-xl" style={{ backgroundColor: accentColor }}>
                              {isSearching ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                            </Button>
                          </div>
                        </div>
                      </section>
                    </ScrollReveal>
                  );
                case 'voucher':
                  if (!config.features.voucher || !(settings as any)?.voucher_enabled || !tenantId) return null;
                  return (
                    <section key="voucher" className="py-8 bg-[#f5f5f7]">
                      <div className="max-w-lg mx-auto px-4">
                        <VoucherClaimForm tenantId={tenantId} branches={branches.map(b => ({ id: b.id, name: b.name }))} primaryColor={accentColor} />
                      </div>
                    </section>
                  );
                case 'reviews':
                  if (!config.features.reviews || !tenantId) return null;
                  return (
                    <ScrollReveal key="reviews" animation="fade-up">
                      <section className="py-12 bg-white">
                        <div className="max-w-[1200px] mx-auto px-4">
                          <StoreReviewsSection tenantId={tenantId} primaryColor={accentColor} />
                        </div>
                      </section>
                    </ScrollReveal>
                  );
                case 'branches':
                  if (!config.features.branches || !settings?.show_branches || branches.length === 0) return null;
                  return (
                    <ScrollReveal key="branches" animation="fade-up">
                      <section className="py-12 bg-[#f5f5f7]">
                        <div className="max-w-[1200px] mx-auto px-4">
                          <div className="text-center mb-8"><h2 className="text-2xl font-bold tracking-tight">Chi nhánh</h2></div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {branches.map(branch => (
                              <div key={branch.id} className="bg-white rounded-2xl p-5 space-y-3">
                                <div className="flex items-center gap-2"><Building2 className="h-4 w-4" style={{ color: accentColor }} /><p className="font-semibold text-sm">{branch.name}</p></div>
                                {branch.address && <div className="flex items-start gap-2"><MapPin className="h-3.5 w-3.5 text-[#86868b] mt-0.5" /><p className="text-xs text-[#86868b]">{branch.address}</p></div>}
                                {branch.phone && <a href={`tel:${branch.phone}`} className="flex items-center gap-2" style={{ color: accentColor }}><Phone className="h-3.5 w-3.5" /><p className="text-xs font-medium">{branch.phone}</p></a>}
                              </div>
                            ))}
                          </div>
                        </div>
                      </section>
                    </ScrollReveal>
                  );
                case 'storeInfo':
                  if (!config.features.storeInfo || settings?.show_store_info === false || (!settings?.store_address && !settings?.store_phone && branches.length === 0)) return null;
                  return (
                    <ScrollReveal key="storeInfo" animation="fade-up">
                      <section className="py-12 bg-[#f5f5f7]">
                        <div className="max-w-[1200px] mx-auto px-4">
                          <div className="text-center mb-8"><h2 className="text-2xl font-bold tracking-tight">Liên hệ</h2></div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {branches.length > 0 ? branches.map(branch => (
                              <div key={branch.id} className="bg-white rounded-2xl p-5 space-y-3">
                                <div className="flex items-center gap-2"><Building2 className="h-4 w-4" style={{ color: accentColor }} /><p className="font-semibold text-sm">{branch.name}</p></div>
                                {branch.address && <div className="flex items-start gap-2"><MapPin className="h-3.5 w-3.5 text-[#86868b] mt-0.5" /><p className="text-xs text-[#86868b]">{branch.address}</p></div>}
                                {branch.phone && <a href={`tel:${branch.phone}`} className="flex items-center gap-2" style={{ color: accentColor }}><Phone className="h-3.5 w-3.5" /><p className="text-xs font-medium">{branch.phone}</p></a>}
                              </div>
                            )) : (
                              <div className="bg-white rounded-2xl p-5 space-y-3">
                                {settings?.store_address && <div className="flex items-start gap-2"><MapPin className="h-4 w-4 text-[#86868b] mt-0.5" /><p className="text-sm">{settings.store_address}</p></div>}
                                {settings?.store_phone && <a href={`tel:${settings.store_phone}`} className="flex items-center gap-2" style={{ color: accentColor }}><Phone className="h-4 w-4" /><p className="text-sm font-medium">{settings.store_phone}</p></a>}
                                {settings?.store_email && <a href={`mailto:${settings.store_email}`} className="flex items-center gap-2" style={{ color: accentColor }}><Mail className="h-4 w-4" /><p className="text-sm font-medium">{settings.store_email}</p></a>}
                              </div>
                            )}
                          </div>
                        </div>
                      </section>
                    </ScrollReveal>
                  );
                case 'flashSale': {
                  const flashProducts = allProducts.filter(p => (p as any).home_tab_ids?.includes('flashSale'));
                  if (flashProducts.length === 0) return null;
                  return (
                    <section key="flashSale" className="py-8 bg-red-50/60">
                      <div className="max-w-[1200px] mx-auto px-4">
                        <ScrollReveal animation="fade-up">
                          <div className="flex items-end justify-between mb-6">
                            <h2 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">⚡ Flash Sale</h2>
                            <button onClick={() => navigateTo('products', { filterTag: 'flashSale' })} className="text-xs font-medium shrink-0 flex items-center gap-1" style={{ color: accentColor }}>
                              Xem tất cả <ChevronDown className="h-3 w-3 -rotate-90" />
                            </button>
                          </div>
                        </ScrollReveal>
                        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                          {flashProducts.slice(0, 12).map((p, i) => (
                            <div key={p.id} className="min-w-[180px] max-w-[200px] shrink-0">
                              <ScrollReveal animation="fade-up" delay={i * 60}>
                                <LayoutProductCard layoutStyle={config.layoutStyle} product={p} onClick={() => openProduct(p)} accentColor={accentColor} />
                              </ScrollReveal>
                            </div>
                          ))}
                        </div>
                      </div>
                    </section>
                  );
                }
                case 'combo': {
                  const comboProducts = allProducts.filter(p => (p as any).home_tab_ids?.includes('combo'));
                  if (comboProducts.length === 0) return null;
                  return (
                    <section key="combo" className="py-8 bg-amber-50/40">
                      <div className="max-w-[1200px] mx-auto px-4">
                        <ScrollReveal animation="fade-up">
                          <div className="flex items-end justify-between mb-6">
                            <h2 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">🎁 Combo ưu đãi</h2>
                            <button onClick={() => navigateTo('products', { filterTag: 'combo' })} className="text-xs font-medium shrink-0 flex items-center gap-1" style={{ color: accentColor }}>
                              Xem tất cả <ChevronDown className="h-3 w-3 -rotate-90" />
                            </button>
                          </div>
                        </ScrollReveal>
                        <div className={getProductGridClass(config.layoutStyle)}>
                          {comboProducts.slice(0, 8).map((p, i) => (
                            <ScrollReveal key={p.id} animation="fade-up" delay={i * 60}>
                              <LayoutProductCard layoutStyle={config.layoutStyle} product={p} onClick={() => openProduct(p)} accentColor={accentColor} />
                            </ScrollReveal>
                          ))}
                        </div>
                      </div>
                    </section>
                  );
                }
                default: {
                  // Handle custom product tabs (productTab_xxx)
                  if (typeof sectionId === 'string' && (sectionId as string).startsWith('productTab_')) {
                    const customTabs = (settings as any)?.custom_product_tabs as { id: string; name: string; displayStyle: string; enabled: boolean }[] || [];
                    const tab = customTabs.find(t => t.id === sectionId);
                    if (!tab) return null;
                    const tabProducts = allProducts.filter(p => (p as any).home_tab_ids?.includes(sectionId));
                    if (tabProducts.length === 0) return null;
                    return (
                      <section key={sectionId} className="py-10 bg-white">
                        <div className="max-w-[1200px] mx-auto px-4">
                          <ScrollReveal animation="fade-up">
                            <div className="flex items-end justify-between mb-6">
                              <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{tab.name}</h2>
                              <button onClick={() => navigateTo('products', { filterTag: sectionId as string })} className="text-xs font-medium shrink-0 flex items-center gap-1" style={{ color: accentColor }}>
                                Xem tất cả <ChevronDown className="h-3 w-3 -rotate-90" />
                              </button>
                            </div>
                          </ScrollReveal>
                          {tab.displayStyle === 'slide' ? (
                            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                              {tabProducts.slice(0, 12).map((p, i) => (
                                <div key={p.id} className="min-w-[180px] max-w-[200px] shrink-0">
                                  <ScrollReveal animation="fade-up" delay={i * 60}>
                                    <LayoutProductCard layoutStyle={config.layoutStyle} product={p} onClick={() => openProduct(p)} accentColor={accentColor} />
                                  </ScrollReveal>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className={tab.displayStyle === 'list' ? 'space-y-3' : getProductGridClass(config.layoutStyle)}>
                              {tabProducts.slice(0, 8).map((p, i) => (
                                <ScrollReveal key={p.id} animation="fade-up" delay={i * 60}>
                                  <LayoutProductCard layoutStyle={config.layoutStyle} product={p} onClick={() => openProduct(p)} accentColor={accentColor} />
                                </ScrollReveal>
                              ))}
                            </div>
                          )}
                        </div>
                      </section>
                    );
                  }
                  // Handle layout sections from SYSTEM_PAGES
                  if (typeof sectionId === 'string' && (sectionId as string).startsWith('layout_')) {
                    const pageId = (sectionId as string).replace(/^layout_\d+_/, '').replace(/^layout_/, '');
                    const page = SYSTEM_PAGES.find(p => p.id === pageId);
                    if (!page) return null;
                    const sysProps = { accentColor, storeName: displayStoreName, storePhone: settings?.store_phone, zaloUrl: settings?.zalo_url, branches, onNavigateProducts: () => navigateTo('products') };
                    return (
                      <section key={sectionId} className="max-w-[1200px] mx-auto px-4">
                        <ScrollReveal animation="fade-up">
                          <LayoutBannerCollapsible pageId={pageId} accentColor={accentColor}>
                            {pageId === 'pricelist' && <PriceListPage {...sysProps} />}
                            {pageId === 'booking' && <BookingPage {...sysProps} />}
                            {pageId === 'branches' && <BranchesPage {...sysProps} />}
                            {pageId === 'contact' && <ContactPage {...sysProps} />}
                            {pageId === 'repair' && <RepairPage {...sysProps} />}
                            {pageId === 'tradein' && <TradeInPage {...sysProps} />}
                            {pageId === 'installment' && <InstallmentPage {...sysProps} />}
                            {pageId === 'accessories' && <AccessoriesPage {...sysProps} />}
                            {pageId === 'compare' && <ComparePage {...sysProps} />}
                            {!['pricelist','booking','branches','contact','repair','tradein','installment','accessories','compare'].includes(pageId) && (
                              <GenericSystemPage pageId={pageId} pageLabel={page.label} {...sysProps} />
                            )}
                          </LayoutBannerCollapsible>
                        </ScrollReveal>
                      </section>
                    );
                  }
                  return null;
                }
              }
            })}
          </div>
        )}

        {/* === PRODUCTS PAGE === */}
        {pageView === 'products' && (() => {
          // Build products page sections from settings
          const ppSections = (settings as any)?.custom_products_page_sections as { id: string; enabled: boolean }[] | null;
          const ppTabs = (settings as any)?.custom_products_page_tabs as { id: string; name: string; displayStyle: string; enabled: boolean }[] || [];
          
          const defaultSections = [
            { id: 'search', enabled: true },
            { id: 'categoryFilter', enabled: true },
            { id: 'allProducts', enabled: true },
          ];
          const activeSections = (ppSections || defaultSections).filter(s => s.enabled);

          return (
            <div className="max-w-[1200px] mx-auto px-4 py-8">
              <div className="flex items-center gap-3 mb-4">
                <button onClick={() => navigateTo('home')} className="h-8 w-8 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-black/10 transition-colors">
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <h2 className="text-2xl font-bold tracking-tight flex-1">
                  {productFilterTag === 'featured' ? config.productSectionTitle
                    : productFilterTag === 'flashSale' ? '⚡ Flash Sale'
                    : productFilterTag === 'combo' ? '🎁 Combo ưu đãi'
                    : productFilterTag?.startsWith('productTab_')
                      ? ((settings as any)?.custom_product_tabs as { id: string; name: string }[] || []).find(t => t.id === productFilterTag)?.name || config.navLabels.products
                    : config.navLabels.products}
                </h2>
                <button onClick={() => copyShareLink('page', 'products')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[#f5f5f7] hover:bg-black/10 transition-colors">
                  <Link2 className="h-3.5 w-3.5" /> Copy link
                </button>
              </div>
              {productFilterTag && (
                <button
                  onClick={() => setProductFilterTag(null)}
                  className="mb-4 px-3 py-1.5 rounded-full text-xs font-medium bg-[#f5f5f7] hover:bg-black/10 transition-colors flex items-center gap-1.5"
                >
                  <X className="h-3 w-3" /> Xem tất cả sản phẩm
                </button>
              )}

              {activeSections.map(section => {
                switch (section.id) {
                  case 'search':
                    return (
                      <div key="search" className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#86868b]" />
                        <input
                          id="product-search-input"
                          type="text"
                          placeholder="Tìm kiếm sản phẩm..."
                          value={productSearchQuery}
                          onChange={(e) => setProductSearchQuery(e.target.value)}
                          className="w-full h-10 pl-10 pr-4 text-sm rounded-xl border border-black/10 bg-[#f5f5f7] focus:outline-none focus:ring-2 focus:border-transparent"
                          style={{ '--tw-ring-color': accentColor } as any}
                        />
                        {productSearchQuery && (
                          <button
                            onClick={() => setProductSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-black/10 flex items-center justify-center hover:bg-black/20"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    );
                  case 'categoryFilter':
                    if (!productsData || productsData.categories.length === 0) return null;
                    return (
                      <div key="categoryFilter" className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
                        <button
                          onClick={() => setSelectedCategoryId(null)}
                          className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all ${!selectedCategoryId ? 'bg-[#1d1d1f] text-white' : 'bg-[#f5f5f7] text-[#1d1d1f] hover:bg-black/10'}`}
                        >
                          Tất cả
                        </button>
                        {productsData.categories.map(cat => (
                          <button
                            key={cat.id}
                            onClick={() => setSelectedCategoryId(cat.id)}
                            className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all ${selectedCategoryId === cat.id ? 'bg-[#1d1d1f] text-white' : 'bg-[#f5f5f7] text-[#1d1d1f] hover:bg-black/10'}`}
                          >
                            {cat.name}
                          </button>
                        ))}
                      </div>
                    );
                  case 'allProducts':
                    return (
                      <div key="allProducts">
                        <div className={getProductGridClass(config.layoutStyle)}>
                          {filteredProducts.map((p, i) => (
                            <ScrollReveal key={p.id} animation="fade-up" delay={i * 50} once>
                              <LayoutProductCard layoutStyle={config.layoutStyle} product={p} onClick={() => openProduct(p)} accentColor={accentColor} />
                            </ScrollReveal>
                          ))}
                          {filteredProducts.length === 0 && (
                            <div className="col-span-full text-center py-16">
                              <Package className="h-12 w-12 mx-auto text-[#86868b] mb-3" />
                              <p className="text-sm text-[#86868b]">{config.emptyProductText}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  case 'featuredProducts': {
                    if (featuredProducts.length === 0) return null;
                    return (
                      <div key="featuredProducts" className="mb-8">
                        <ScrollReveal animation="fade-up">
                          <h3 className="text-lg font-bold tracking-tight mb-4 flex items-center gap-2">⭐ Sản phẩm nổi bật</h3>
                        </ScrollReveal>
                        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                          {featuredProducts.slice(0, 12).map((p, i) => (
                            <div key={p.id} className="min-w-[180px] max-w-[200px] shrink-0">
                              <ScrollReveal animation="fade-up" delay={i * 60}>
                                <LayoutProductCard layoutStyle={config.layoutStyle} product={p} onClick={() => openProduct(p)} accentColor={accentColor} />
                              </ScrollReveal>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  case 'flashSale': {
                    const flashProducts = allProducts.filter(p => (p as any).home_tab_ids?.includes('flashSale'));
                    if (flashProducts.length === 0) return null;
                    return (
                      <div key="flashSale" className="mb-8 -mx-4 px-4 py-6 bg-red-50/60 rounded-2xl">
                        <ScrollReveal animation="fade-up">
                          <h3 className="text-lg font-bold tracking-tight mb-4 flex items-center gap-2">⚡ Flash Sale</h3>
                        </ScrollReveal>
                        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                          {flashProducts.slice(0, 12).map((p, i) => (
                            <div key={p.id} className="min-w-[180px] max-w-[200px] shrink-0">
                              <ScrollReveal animation="fade-up" delay={i * 60}>
                                <LayoutProductCard layoutStyle={config.layoutStyle} product={p} onClick={() => openProduct(p)} accentColor={accentColor} />
                              </ScrollReveal>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  case 'combo': {
                    const comboProducts = allProducts.filter(p => (p as any).home_tab_ids?.includes('combo'));
                    if (comboProducts.length === 0) return null;
                    return (
                      <div key="combo" className="mb-8 -mx-4 px-4 py-6 bg-amber-50/40 rounded-2xl">
                        <ScrollReveal animation="fade-up">
                          <h3 className="text-lg font-bold tracking-tight mb-4 flex items-center gap-2">🎁 Combo ưu đãi</h3>
                        </ScrollReveal>
                        <div className={getProductGridClass(config.layoutStyle)}>
                          {comboProducts.slice(0, 8).map((p, i) => (
                            <ScrollReveal key={p.id} animation="fade-up" delay={i * 60}>
                              <LayoutProductCard layoutStyle={config.layoutStyle} product={p} onClick={() => openProduct(p)} accentColor={accentColor} />
                            </ScrollReveal>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  case 'reviews':
                    if (!tenantId) return null;
                    return (
                      <div key="reviews" className="mb-8">
                        <StoreReviewsSection tenantId={tenantId} primaryColor={accentColor} />
                      </div>
                    );
                  default: {
                    // Handle custom products page tabs (ppTab_xxx)
                    if (section.id.startsWith('ppTab_')) {
                      const tab = ppTabs.find(t => t.id === section.id);
                      if (!tab) return null;
                      const tabProducts = allProducts.filter(p => (p as any).products_page_tab_ids?.includes(section.id));
                      if (tabProducts.length === 0) return null;
                      return (
                        <div key={section.id} className="mb-8">
                          <ScrollReveal animation="fade-up">
                            <h3 className="text-lg font-bold tracking-tight mb-4">{tab.name}</h3>
                          </ScrollReveal>
                          {tab.displayStyle === 'slide' ? (
                            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                              {tabProducts.slice(0, 12).map((p, i) => (
                                <div key={p.id} className="min-w-[180px] max-w-[200px] shrink-0">
                                  <ScrollReveal animation="fade-up" delay={i * 60}>
                                    <LayoutProductCard layoutStyle={config.layoutStyle} product={p} onClick={() => openProduct(p)} accentColor={accentColor} />
                                  </ScrollReveal>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className={tab.displayStyle === 'list' ? 'space-y-3' : getProductGridClass(config.layoutStyle)}>
                              {tabProducts.slice(0, 8).map((p, i) => (
                                <ScrollReveal key={p.id} animation="fade-up" delay={i * 60}>
                                  <LayoutProductCard layoutStyle={config.layoutStyle} product={p} onClick={() => openProduct(p)} accentColor={accentColor} />
                                </ScrollReveal>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    }
                    // Handle layout sections from SYSTEM_PAGES
                    if (section.id.startsWith('layout_')) {
                      const pageId = section.id.replace(/^layout_\d+_/, '').replace(/^layout_/, '');
                      const page = SYSTEM_PAGES.find(p => p.id === pageId);
                      if (!page) return null;
                      const sysProps = { accentColor, storeName: displayStoreName, storePhone: settings?.store_phone, zaloUrl: settings?.zalo_url, branches, onNavigateProducts: () => navigateTo('products') };
                      return (
                        <div key={section.id} className="mb-4">
                          <LayoutBannerCollapsible pageId={pageId} accentColor={accentColor}>
                            {pageId === 'pricelist' && <PriceListPage {...sysProps} />}
                            {pageId === 'booking' && <BookingPage {...sysProps} />}
                            {pageId === 'branches' && <BranchesPage {...sysProps} />}
                            {pageId === 'contact' && <ContactPage {...sysProps} />}
                            {pageId === 'repair' && <RepairPage {...sysProps} />}
                            {pageId === 'tradein' && <TradeInPage {...sysProps} />}
                            {pageId === 'installment' && <InstallmentPage {...sysProps} />}
                            {pageId === 'accessories' && <AccessoriesPage {...sysProps} />}
                            {pageId === 'compare' && <ComparePage {...sysProps} />}
                            {!['pricelist','booking','branches','contact','repair','tradein','installment','accessories','compare'].includes(pageId) && (
                              <GenericSystemPage pageId={pageId} pageLabel={page.label} {...sysProps} />
                            )}
                          </LayoutBannerCollapsible>
                        </div>
                      );
                    }
                    return null;
                  }
                }
              })}
            </div>
          );
        })()}

        {/* === NEWS PAGE === */}
        {pageView === 'news' && (
          <div className="max-w-[1200px] mx-auto px-4 py-8">
            {(() => {
              const defaultNewsSections = [
                { id: 'search', enabled: true },
                { id: 'categoryFilter', enabled: true },
                { id: 'featuredArticles', enabled: true },
                { id: 'allArticles', enabled: true },
              ];
              const newsSections = ((settings as any)?.custom_news_page_sections || defaultNewsSections).filter((s: any) => s.enabled);
              const allArticles = articlesData?.articles || [];
              const articleCategories = (articlesData?.categories || []).filter((c: any) => c.is_visible !== false);
              const filteredAllArticles = selectedArticleCategoryId
                ? allArticles.filter(a => a.category_id === selectedArticleCategoryId)
                : allArticles;
              const featuredOnes = filteredAllArticles.filter(a => a.is_featured);
              const regularOnes = filteredAllArticles.filter(a => !a.is_featured);
              const catDisplayMode = (config as any)._categoryDisplayMode || 'horizontal';

              return (
                <>
                  <div className="flex items-center gap-3 mb-6">
                    <button onClick={() => navigateTo('home')} className="h-8 w-8 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-black/10 transition-colors">
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <h2 className="text-2xl font-bold tracking-tight flex-1">{config.navLabels.news}</h2>
                    <button onClick={() => copyShareLink('page', 'news')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[#f5f5f7] hover:bg-black/10 transition-colors">
                      <Link2 className="h-3.5 w-3.5" /> Copy link
                    </button>
                  </div>

                  {newsSections.map((section: any) => {
                    switch (section.id) {
                      case 'search':
                        return (
                          <div key="search" className="mb-6">
                            <Input
                              placeholder={`Tìm kiếm bài viết...`}
                              className="h-11 rounded-xl border-black/10 bg-[#f5f5f7]"
                            />
                          </div>
                        );
                      case 'categoryFilter': {
                        if (articleCategories.length === 0) return null;
                        
                        if (catDisplayMode === 'vertical') {
                          // Vertical: stacked cards with cover images (same as product categories)
                          return (
                            <div key="categoryFilter" className="mb-6">
                              <h3 className="text-lg font-bold tracking-tight mb-4">Danh mục bài viết</h3>
                              <div className="flex flex-col gap-0">
                                {/* "All" button */}
                                <button
                                  onClick={() => setSelectedArticleCategoryId(null)}
                                  className={`group w-full overflow-hidden relative text-left min-h-[80px] border-b border-black/5 ${!selectedArticleCategoryId ? 'ring-2' : ''}`}
                                  style={!selectedArticleCategoryId ? { '--tw-ring-color': accentColor } as any : undefined}
                                >
                                  <div className="bg-white h-full flex items-center justify-between p-4 group-hover:shadow-lg transition-shadow">
                                    <div>
                                      <h4 className="text-base font-bold text-[#1d1d1f]">Tất cả bài viết</h4>
                                      <p className="text-xs text-[#86868b] mt-0.5">{allArticles.length} bài viết</p>
                                    </div>
                                    <Newspaper className="h-6 w-6 text-[#d2d2d7]" />
                                  </div>
                                </button>
                                {articleCategories.map((cat: any) => (
                                  <ScrollReveal key={cat.id} animation="fade-up" delay={80}>
                                    <button
                                      onClick={() => setSelectedArticleCategoryId(selectedArticleCategoryId === cat.id ? null : cat.id)}
                                      className={`group w-full overflow-hidden relative text-left ${cat.image_url ? 'min-h-[65vh] sm:min-h-[70vh]' : 'min-h-[80px]'} ${selectedArticleCategoryId === cat.id ? 'ring-2' : ''}`}
                                      style={selectedArticleCategoryId === cat.id ? { '--tw-ring-color': accentColor } as any : undefined}
                                    >
                                      {cat.image_url ? (
                                        <>
                                          <img src={cat.image_url} alt={cat.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                                          <div className="relative z-10 h-full flex flex-col justify-end p-6 min-h-[65vh] sm:min-h-[70vh]">
                                            <h4 className="text-xl font-bold text-white">{cat.name}</h4>
                                            <p className="text-sm text-white/80 mt-1">Xem bài viết →</p>
                                          </div>
                                        </>
                                      ) : (
                                        <div className="bg-white h-full flex items-center justify-between p-4 border-b border-black/5 group-hover:shadow-lg transition-shadow">
                                          <div>
                                            <h4 className="text-base font-bold text-[#1d1d1f]">{cat.name}</h4>
                                            <p className="text-xs text-[#86868b] mt-0.5">Xem bài viết →</p>
                                          </div>
                                          <Newspaper className="h-6 w-6 text-[#d2d2d7]" />
                                        </div>
                                      )}
                                    </button>
                                  </ScrollReveal>
                                ))}
                              </div>
                            </div>
                          );
                        }
                        
                        // Horizontal: scrollable row with images (same as product categories)
                        return (
                          <div key="categoryFilter" className="mb-6">
                            <div className="bg-[#f5f5f7] rounded-2xl py-4 px-2">
                              <div className="flex items-center overflow-x-auto gap-4 py-2 scrollbar-hide">
                                <button
                                  onClick={() => setSelectedArticleCategoryId(null)}
                                  className="flex flex-col items-center gap-2 min-w-[90px] group"
                                >
                                  <div className={`h-16 w-16 rounded-2xl flex items-center justify-center border group-hover:scale-105 transition-transform ${!selectedArticleCategoryId ? 'border-2' : 'border-black/5 bg-white'}`}
                                    style={!selectedArticleCategoryId ? { borderColor: accentColor, backgroundColor: accentColor + '15' } : undefined}
                                  >
                                    <Newspaper className="h-6 w-6" style={!selectedArticleCategoryId ? { color: accentColor } : { color: '#86868b' }} />
                                  </div>
                                  <span className={`text-[11px] font-medium text-center leading-tight ${!selectedArticleCategoryId ? 'font-bold' : ''}`}>Tất cả</span>
                                </button>
                                {articleCategories.map((cat: any) => (
                                  <button
                                    key={cat.id}
                                    onClick={() => setSelectedArticleCategoryId(selectedArticleCategoryId === cat.id ? null : cat.id)}
                                    className="flex flex-col items-center gap-2 min-w-[90px] group"
                                  >
                                    {cat.image_url ? (
                                      <img src={cat.image_url} alt={cat.name} className={`h-16 w-16 rounded-2xl object-cover group-hover:scale-105 transition-transform ${selectedArticleCategoryId === cat.id ? 'border-2' : 'border border-black/5'}`}
                                        style={selectedArticleCategoryId === cat.id ? { borderColor: accentColor } : undefined}
                                      />
                                    ) : (
                                      <div className={`h-16 w-16 rounded-2xl bg-white flex items-center justify-center group-hover:scale-105 transition-transform ${selectedArticleCategoryId === cat.id ? 'border-2' : 'border border-black/5'}`}
                                        style={selectedArticleCategoryId === cat.id ? { borderColor: accentColor } : undefined}
                                      >
                                        <Newspaper className="h-6 w-6 text-[#86868b]" />
                                      </div>
                                    )}
                                    <span className={`text-[11px] font-medium text-center leading-tight ${selectedArticleCategoryId === cat.id ? 'font-bold' : ''}`}>{cat.name}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      }
                      case 'featuredArticles':
                        if (featuredOnes.length === 0) return null;
                        return (
                          <div key="featuredArticles" className="mb-8">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                              {featuredOnes.map((a, i) => (
                                <ScrollReveal key={a.id} animation="fade-up" delay={i * 80}>
                                  <button onClick={() => openArticle(a)} className="bg-white rounded-2xl overflow-hidden border border-black/5 hover:shadow-lg transition-all text-left group w-full">
                                    {a.thumbnail_url ? (
                                      <img src={a.thumbnail_url} alt={a.title} className="w-full h-56 object-cover group-hover:scale-[1.02] transition-transform" />
                                    ) : (
                                      <div className="w-full h-56 bg-[#f5f5f7] flex items-center justify-center"><Newspaper className="h-12 w-12 text-[#86868b]" /></div>
                                    )}
                                    <div className="p-5">
                                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary mb-2 inline-block">Nổi bật</span>
                                      <p className="font-bold text-base line-clamp-2 mb-2">{a.title}</p>
                                      {a.summary && <p className="text-sm text-[#86868b] line-clamp-2">{a.summary}</p>}
                                      <p className="text-[10px] text-[#86868b] mt-2">{format(new Date(a.created_at), 'dd/MM/yyyy', { locale: vi })}</p>
                                    </div>
                                  </button>
                                </ScrollReveal>
                              ))}
                            </div>
                          </div>
                        );
                      case 'allArticles':
                        return (
                          <div key="allArticles">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                              {regularOnes.map((a, i) => (
                                <ScrollReveal key={a.id} animation="fade-up" delay={i * 80}>
                                  <button onClick={() => openArticle(a)} className="bg-white rounded-2xl overflow-hidden border border-black/5 hover:shadow-lg transition-all text-left group w-full">
                                    {a.thumbnail_url ? (
                                      <img src={a.thumbnail_url} alt={a.title} className="w-full h-48 object-cover group-hover:scale-[1.02] transition-transform" />
                                    ) : (
                                      <div className="w-full h-48 bg-[#f5f5f7] flex items-center justify-center"><Newspaper className="h-10 w-10 text-[#86868b]" /></div>
                                    )}
                                    <div className="p-5">
                                      <p className="font-semibold text-sm line-clamp-2 mb-2">{a.title}</p>
                                      {a.summary && <p className="text-xs text-[#86868b] line-clamp-2">{a.summary}</p>}
                                      <p className="text-[10px] text-[#86868b] mt-2">{format(new Date(a.created_at), 'dd/MM/yyyy', { locale: vi })}</p>
                                    </div>
                                  </button>
                                </ScrollReveal>
                              ))}
                              {filteredAllArticles.length === 0 && (
                                <div className="col-span-full text-center py-16">
                                  <Newspaper className="h-12 w-12 mx-auto text-[#86868b] mb-3" />
                                  <p className="text-sm text-[#86868b]">Chưa có bài viết nào</p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      case 'latestArticles':
                        return (
                          <div key="latestArticles" className="mb-8">
                            <h3 className="text-lg font-bold mb-4">🆕 Mới nhất</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                              {[...filteredAllArticles].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 6).map((a, i) => (
                                <ScrollReveal key={a.id} animation="fade-up" delay={i * 80}>
                                  <button onClick={() => openArticle(a)} className="bg-white rounded-2xl overflow-hidden border border-black/5 hover:shadow-lg transition-all text-left group w-full">
                                    {a.thumbnail_url ? (
                                      <img src={a.thumbnail_url} alt={a.title} className="w-full h-48 object-cover group-hover:scale-[1.02] transition-transform" />
                                    ) : (
                                      <div className="w-full h-48 bg-[#f5f5f7] flex items-center justify-center"><Newspaper className="h-10 w-10 text-[#86868b]" /></div>
                                    )}
                                    <div className="p-5">
                                      <p className="font-semibold text-sm line-clamp-2 mb-2">{a.title}</p>
                                      <p className="text-[10px] text-[#86868b] mt-2">{format(new Date(a.created_at), 'dd/MM/yyyy', { locale: vi })}</p>
                                    </div>
                                  </button>
                                </ScrollReveal>
                              ))}
                            </div>
                          </div>
                        );
                      case 'popularArticles':
                        return (
                          <div key="popularArticles" className="mb-8">
                            <h3 className="text-lg font-bold mb-4">🔥 Phổ biến</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                              {filteredAllArticles.slice(0, 6).map((a, i) => (
                                <ScrollReveal key={a.id} animation="fade-up" delay={i * 80}>
                                  <button onClick={() => openArticle(a)} className="bg-white rounded-2xl overflow-hidden border border-black/5 hover:shadow-lg transition-all text-left group w-full">
                                    {a.thumbnail_url ? (
                                      <img src={a.thumbnail_url} alt={a.title} className="w-full h-48 object-cover group-hover:scale-[1.02] transition-transform" />
                                    ) : (
                                      <div className="w-full h-48 bg-[#f5f5f7] flex items-center justify-center"><Newspaper className="h-10 w-10 text-[#86868b]" /></div>
                                    )}
                                    <div className="p-5">
                                      <p className="font-semibold text-sm line-clamp-2 mb-2">{a.title}</p>
                                      <p className="text-[10px] text-[#86868b] mt-2">{format(new Date(a.created_at), 'dd/MM/yyyy', { locale: vi })}</p>
                                    </div>
                                  </button>
                                </ScrollReveal>
                              ))}
                            </div>
                          </div>
                        );
                      default:
                        // Handle layout sections from SYSTEM_PAGES
                        if (section.id.startsWith('layout_')) {
                          const pageId = section.id.replace(/^layout_\d+_/, '').replace(/^layout_/, '');
                          const page = SYSTEM_PAGES.find(p => p.id === pageId);
                          if (!page) return null;
                          const sysProps = { accentColor, storeName: displayStoreName, storePhone: settings?.store_phone, zaloUrl: settings?.zalo_url, branches, onNavigateProducts: () => navigateTo('products') };
                          return (
                            <div key={section.id} className="mb-4">
                              <LayoutBannerCollapsible pageId={pageId} accentColor={accentColor}>
                                {pageId === 'pricelist' && <PriceListPage {...sysProps} />}
                                {pageId === 'booking' && <BookingPage {...sysProps} />}
                                {pageId === 'branches' && <BranchesPage {...sysProps} />}
                                {pageId === 'contact' && <ContactPage {...sysProps} />}
                                {pageId === 'repair' && <RepairPage {...sysProps} />}
                                {pageId === 'tradein' && <TradeInPage {...sysProps} />}
                                {pageId === 'installment' && <InstallmentPage {...sysProps} />}
                                {pageId === 'accessories' && <AccessoriesPage {...sysProps} />}
                                {pageId === 'compare' && <ComparePage {...sysProps} />}
                                {!['pricelist','booking','branches','contact','repair','tradein','installment','accessories','compare'].includes(pageId) && (
                                  <GenericSystemPage pageId={pageId} pageLabel={page.label} {...sysProps} />
                                )}
                              </LayoutBannerCollapsible>
                            </div>
                          );
                        }
                        return null;
                    }
                  })}
                </>
              );
            })()}
          </div>
        )}

        {/* === ARTICLE DETAIL === */}
        {pageView === 'article-detail' && selectedArticle && (
          <div className="max-w-3xl mx-auto px-4 py-8">
            <div className="flex items-center justify-between mb-6">
              <button onClick={() => navigateTo('news')} className="flex items-center gap-2 text-sm hover:underline" style={{ color: accentColor }}>
                <ArrowLeft className="h-4 w-4" /> Quay lại
              </button>
              <button onClick={() => copyShareLink('article', selectedArticle.id)} className="flex items-center gap-1.5 text-xs text-[#86868b] hover:text-[#1d1d1f]">
                <Link2 className="h-3.5 w-3.5" /> Chia sẻ
              </button>
            </div>
            <article>
              {selectedArticle.thumbnail_url && (
                <img src={selectedArticle.thumbnail_url} alt={selectedArticle.title} className="w-full rounded-2xl object-cover max-h-96 mb-6" />
              )}
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">{selectedArticle.title}</h1>
              <p className="text-xs text-[#86868b] mb-8">{format(new Date(selectedArticle.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })}</p>
              {selectedArticle.content && (
                <div
                  className="prose prose-sm max-w-none [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-2xl [&_a]:underline"
                  style={{ '--tw-prose-links': accentColor } as any}
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedArticle.content) }}
                />
              )}
            </article>
          </div>
        )}

        {/* === WARRANTY PAGE === */}
        {pageView === 'warranty' && (
          <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
            <div className="flex items-center gap-3">
              <button onClick={() => navigateTo('home')} className="h-8 w-8 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-black/10 transition-colors">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <h2 className="text-2xl font-bold tracking-tight">{config.navLabels.warranty}</h2>
            </div>

            <div className="bg-[#f5f5f7] rounded-2xl p-5 space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Nhập IMEI hoặc SĐT..."
                  value={searchValue}
                  onChange={e => setSearchValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="flex-1 h-12 text-base rounded-xl border-black/10 bg-white"
                  inputMode="tel"
                />
                <Button onClick={handleSearch} disabled={!searchValue.trim() || isSearching} className="h-12 px-6 rounded-xl" style={{ backgroundColor: accentColor }}>
                  {isSearching ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                </Button>
              </div>

              {warrantyHotline && (
                <a href={`tel:${warrantyHotline}`} className="flex items-center gap-3 p-3 rounded-xl bg-white">
                  <div className="p-2 rounded-full" style={{ backgroundColor: `${accentColor}15` }}><Headphones className="h-4 w-4" style={{ color: accentColor }} /></div>
                  <div className="flex-1">
                    <p className="text-[10px] text-[#86868b]">Hotline bảo hành</p>
                    <p className="text-sm font-semibold" style={{ color: accentColor }}>{warrantyHotline}</p>
                  </div>
                </a>
              )}
              {supportGroupUrl && (
                <a href={supportGroupUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-xl bg-white">
                  <div className="p-2 rounded-full bg-red-50"><Users className="h-4 w-4 text-red-600" /></div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-red-600">Tham gia nhóm hỗ trợ →</p>
                  </div>
                </a>
              )}

              {/* Add to Home Screen hint - hidden in standalone/PWA mode */}
              {typeof window !== 'undefined' && !window.matchMedia('(display-mode: standalone)').matches && !(window.navigator as any).standalone && (
                <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-50/80 border border-blue-100">
                  <div className="p-2 rounded-full bg-blue-100 shrink-0 mt-0.5"><Smartphone className="h-4 w-4 text-blue-600" /></div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-blue-700">Thêm trang này vào màn hình chính</p>
                    <p className="text-[11px] text-blue-600/70 mt-0.5 leading-relaxed">Để mỗi lần mở ứng dụng đều thấy thông tin bảo hành và các ưu đãi mới nhất.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Results */}
            {submittedValue && isFetched && (
              <div className="space-y-4">
                {warrantyError ? (
                  <div className="text-center py-12 rounded-2xl bg-red-50">
                    <XCircle className="h-12 w-12 mx-auto text-red-400 mb-3" />
                    <p className="text-sm font-medium text-red-600">Tra cứu thất bại</p>
                    <p className="text-xs text-red-400 mt-1">{(warrantyError as Error)?.message || 'Vui lòng thử lại'}</p>
                  </div>
                ) : warrantyResults && warrantyResults.length > 0 ? (
                  <>
                    <p className="text-xs text-[#86868b] flex items-center gap-1.5"><Package className="h-3.5 w-3.5" /> Tìm thấy {warrantyResults.length} sản phẩm</p>
                    {warrantyResults.map(item => {
                      const ws = calculateWarrantyStatus(item);
                      return (
                        <div key={item.id} className="bg-white rounded-2xl p-5 space-y-4 border border-black/5">
                          <div className="flex items-start gap-3">
                            <div className="flex-1">
                              <h3 className="font-semibold text-sm">{item.product_name}</h3>
                              {item.imei && <p className="text-xs text-[#86868b] font-mono mt-1">IMEI: {item.imei}</p>}
                            </div>
                            {ws && (
                              <Badge className={`${ws.valid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} text-xs border-0`}>
                                {ws.valid ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                                {ws.message}
                              </Badge>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <InfoCell icon={<Calendar className="h-3.5 w-3.5" />} label="Ngày mua" value={format(new Date(item.export_date), 'dd/MM/yyyy', { locale: vi })} />
                            <InfoCell icon={<Clock className="h-3.5 w-3.5" />} label="Bảo hành" value={item.warranty ? `${item.warranty} tháng` : 'Không BH'} />
                            {ws?.endDate && <InfoCell icon={<Shield className="h-3.5 w-3.5" />} label="BH đến" value={format(ws.endDate, 'dd/MM/yyyy', { locale: vi })} />}
                            {item.branch_name && <InfoCell icon={<Building2 className="h-3.5 w-3.5" />} label="Chi nhánh" value={item.branch_name} />}
                          </div>
                          {item.note && (
                            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                              <p className="text-xs text-amber-800 flex items-start gap-2">
                                <span className="font-medium shrink-0">📝 Ghi chú:</span>
                                <span>{item.note}</span>
                              </p>
                            </div>
                          )}
                          {item.staff_name && item.staff_user_id && tenantId && (
                            <StaffRatingForm
                              staffName={item.staff_name}
                              staffUserId={item.staff_user_id}
                              tenantId={tenantId}
                              branchId={item.branch_id}
                              exportReceiptItemId={item.id}
                              primaryColor={accentColor}
                              defaultCustomerName={item.customer_name || customerName}
                              defaultCustomerPhone={isPhoneSearch ? submittedValue : (item.customer_phone || '')}
                              customerId={item.customer_id || customerId}
                              reviewRewardPoints={reviewRewardPoints}
                              onPointsAwarded={handlePointsAwarded}
                            />
                          )}
                        </div>
                      );
                    })}

                    {/* Points */}
                    {customerPoints && customerPoints.is_points_enabled && customerPoints.current_points > 0 && (
                      <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-5 space-y-3">
                        <div className="flex items-center gap-2">
                          <Star className="h-5 w-5 text-amber-500" />
                          <p className="font-bold text-amber-800">Điểm tích lũy</p>
                        </div>
                        <div className="flex items-center justify-between bg-white/80 rounded-xl px-4 py-3">
                          <span className="text-sm text-amber-700">Điểm hiện tại:</span>
                          <span className="text-xl font-bold text-amber-600">{formatNumber(customerPoints.current_points)}</span>
                        </div>
                        {customerPoints.redeem_points > 0 && customerPoints.point_value > 0 && (() => {
                          const rawDiscount = Math.floor(customerPoints.current_points / customerPoints.redeem_points) * customerPoints.point_value;
                          const hasMaxLimit = customerPoints.max_redemption_enabled && customerPoints.max_redemption_amount > 0;
                          const finalDiscount = hasMaxLimit ? Math.min(rawDiscount, customerPoints.max_redemption_amount) : rawDiscount;
                          return (
                            <div className="flex items-center gap-2 p-3 rounded-xl bg-green-100">
                              <Gift className="h-5 w-5 text-green-600" />
                              <div>
                                <p className="text-xs text-green-700">Lần mua tiếp theo được giảm:</p>
                                <p className="text-lg font-bold text-green-600">{formatNumber(finalDiscount)}đ</p>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Vouchers */}
                    {customerVouchers && customerVouchers.length > 0 && (
                      <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-5 space-y-3">
                        <div className="flex items-center gap-2">
                          <Gift className="h-5 w-5 text-purple-600" />
                          <p className="font-bold text-purple-800">Voucher của bạn</p>
                        </div>
                        {customerVouchers.map((v: any) => (
                          <div key={v.id} className="flex items-center justify-between bg-white/80 rounded-xl px-4 py-3">
                            <div>
                              <p className="text-sm font-medium text-purple-700">{v.voucher_name}</p>
                              <code className="text-xs font-mono text-[#86868b]">{v.code}</code>
                            </div>
                            <Badge className="bg-purple-100 text-purple-700 border-0">
                              {v.discount_type === 'percentage' ? `${v.discount_value}%` : `${formatNumber(v.discount_value)}đ`}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-12 rounded-2xl bg-[#f5f5f7]">
                    <XCircle className="h-12 w-12 mx-auto text-[#86868b]/50 mb-3" />
                    <p className="text-sm font-medium text-[#86868b]">Không tìm thấy sản phẩm</p>
                    <p className="text-xs text-[#86868b] mt-1">Kiểm tra lại IMEI/SĐT</p>
                  </div>
                )}
              </div>
            )}

            {submittedValue && warrantyResults && warrantyResults.length > 0 && (
              <button onClick={handleWarrantyLogout} className="w-full py-3 text-xs text-[#86868b] hover:text-[#1d1d1f] border border-dashed border-black/10 rounded-xl transition-colors">
                Đăng xuất tra cứu bảo hành
              </button>
            )}
          </div>
        )}

        {/* === SYSTEM PAGES === */}
        {(() => {
          const activeNav = navItems.find(n => n.pageView === pageView);
          const systemPageProps = {
            accentColor,
            storeName: displayStoreName,
            storePhone: warrantyHotline || settings?.store_phone,
            zaloUrl,
            branches: branches.map(b => ({ id: b.id, name: b.name, address: b.address, phone: b.phone })),
            onNavigateProducts: () => navigateTo('products'),
            pageItems: activeNav?.pageItems,
            installmentRates: activeNav?.installmentRates,
          };

          switch (pageView) {
            case 'repair': return <RepairPage {...systemPageProps} />;
            case 'tradein': return <TradeInPage {...systemPageProps} />;
            case 'installment': return <InstallmentPage {...systemPageProps} />;
            case 'pricelist': return <PriceListPage {...systemPageProps} />;
            case 'booking': return <BookingPage {...systemPageProps} />;
            case 'branches': return <BranchesPage {...systemPageProps} />;
            case 'contact': return <ContactPage {...systemPageProps} />;
            case 'accessories': return <AccessoriesPage {...systemPageProps} />;
            case 'compare': return <ComparePage {...systemPageProps} />;
            case 'services':
            case 'rooms':
            case 'courses':
            case 'doctors':
            case 'collection':
            case 'promotion':
            case 'reviews': {
              return <GenericSystemPage {...systemPageProps} pageId={pageView} pageLabel={activeNav?.label || pageView} />;
            }
            case 'order-lookup': {
              return (
                <OrderLookupPage
                  tenantId={tenantId!}
                  accentColor={accentColor}
                  storePhone={settings?.store_phone || warrantyHotline}
                  zaloUrl={settings?.zalo_url}
                  facebookUrl={facebookUrl}
                  onBack={() => navigateTo('home')}
                />
              );
            }
            default: return null;
          }
        })()}
      </main>

      {/* === FOOTER === */}
      <LayoutFooter
        layoutStyle={config.layoutStyle}
        storeName={displayStoreName}
        accentColor={accentColor}
        facebookUrl={facebookUrl}
        zaloUrl={zaloUrl}
        tiktokUrl={tiktokUrl}
      />

      {/* === STICKY BUY BAR (Mobile) === */}
      <LayoutStickyBar
        layoutStyle={config.layoutStyle}
        accentColor={accentColor}
        zaloUrl={zaloUrl}
        warrantyHotline={warrantyHotline}
        chatLabel={config.stickyBarLabels.chat}
        callLabel={config.stickyBarLabels.call}
      />

      <InstallmentCalculatorDialog open={showInstallmentCalc} onOpenChange={setShowInstallmentCalc} />
    </div>
    </PullToRefresh>
  );
}


// === Info Cell ===
function InfoCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#f5f5f7]">
      <span className="text-[#86868b]">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] text-[#86868b] uppercase">{label}</p>
        <p className="text-xs font-medium truncate">{value}</p>
      </div>
    </div>
  );
}
