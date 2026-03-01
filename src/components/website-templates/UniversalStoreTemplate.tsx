import { useState, useEffect, useCallback, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { SetURLSearchParams } from 'react-router-dom';
import { QueryClient } from '@tanstack/react-query';
import { TenantLandingSettings, useWarrantyLookup, useCustomerPointsPublic, WarrantyResult, BranchInfo } from '@/hooks/useTenantLanding';
import { LandingProduct, LandingProductCategory } from '@/hooks/useLandingProducts';
import { LandingArticle, LandingArticleCategory } from '@/hooks/useLandingArticles';
import { usePublicCustomerVouchers } from '@/hooks/useVouchers';
import { ProductDetailDialog } from '@/components/landing/ProductDetailDialog';
import { StaffRatingForm } from '@/components/landing/StaffRatingForm';
import { VoucherClaimForm } from '@/components/landing/VoucherClaimForm';
import StoreReviewsSection from '@/components/landing/StoreReviewsSection';
import { ScrollReveal, useParallax } from '@/hooks/useScrollReveal';
import { ResolvedIndustryConfig, getIndustryConfig, GOOGLE_FONTS, NavItemConfig, getDefaultNavItems, getSystemPageById } from '@/lib/industryConfig';
import {
  RepairPage, TradeInPage, InstallmentPage, PriceListPage,
  BookingPage, BranchesPage, ContactPage, AccessoriesPage,
  ComparePage, GenericSystemPage,
} from './SystemPageTemplates';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatNumber } from '@/lib/formatNumber';
import { format, addMonths, isAfter, differenceInDays } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  Search, MapPin, Phone, Mail, Shield, CheckCircle, XCircle,
  Store, Loader2, Building2, Headphones, Calendar, Package,
  Clock, Users, ExternalLink, Star, Gift, ChevronDown, ChevronUp,
  ShoppingBag, Newspaper, ArrowLeft, Download, Smartphone, Share,
  Plus, MoreVertical, Link2, Truck, CreditCard, Award, Menu, X,
} from 'lucide-react';

// Icon map for industry config
const ICON_MAP: Record<string, React.ReactNode> = {
  Shield: <Shield className="h-5 w-5" />,
  Award: <Award className="h-5 w-5" />,
  Truck: <Truck className="h-5 w-5" />,
  CreditCard: <CreditCard className="h-5 w-5" />,
  Clock: <Clock className="h-5 w-5" />,
  Star: <Star className="h-5 w-5" />,
};

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

type PageView = 'home' | 'products' | 'news' | 'warranty' | 'article-detail' | 'repair' | 'tradein' | 'installment' | 'accessories' | 'compare' | 'pricelist' | 'booking' | 'branches' | 'contact' | 'services' | 'rooms' | 'courses' | 'doctors' | 'collection' | 'promotion' | 'reviews' | 'system-page';

export default function UniversalStoreTemplate({
  settings, tenant, tenantId, storeId, branches,
  productsData, articlesData, searchParams, setSearchParams, queryClient,
  templateId,
}: UniversalTemplateProps) {
  const config = getIndustryConfig(templateId || settings?.website_template || 'phone_store');
  const accentColor = settings?.primary_color || config.accentColor;

  const [pageView, setPageView] = useState<PageView>('home');
  const [selectedArticle, setSelectedArticle] = useState<LandingArticle | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<LandingProduct | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');

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

  // Deep-link
  useEffect(() => {
    const productId = searchParams.get('product');
    const articleId = searchParams.get('article');
    if (productId && productsData?.products) {
      const p = productsData.products.find(x => x.id === productId);
      if (p) { setSelectedProduct(p); setPageView('products'); }
    }
    if (articleId && articlesData?.articles) {
      const a = articlesData.articles.find(x => x.id === articleId);
      if (a) { setSelectedArticle(a); setPageView('article-detail'); }
    }
  }, [searchParams, productsData, articlesData]);

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
    if (productSearchQuery.trim()) {
      const q = productSearchQuery.toLowerCase().trim();
      products = products.filter(p => p.name.toLowerCase().includes(q));
    }
    return products;
  }, [allProducts, selectedCategoryId, productSearchQuery]);
  const featuredArticles = articlesData?.articles?.filter(a => a.is_featured) || [];

  const handlePointsAwarded = useCallback(() => { queryClient.invalidateQueries({ queryKey: ['customer-points-public'] }); }, [queryClient]);
  const handleWarrantyLogout = () => { if (warrantyStorageKey) localStorage.removeItem(warrantyStorageKey); setSearchValue(''); setSubmittedValue(''); setPageView('home'); };
  const handleSearch = () => { if (searchValue.trim()) { setSubmittedValue(searchValue.trim()); if (pageView === 'home') setPageView('warranty'); } };
  const handleKeyPress = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleSearch(); };

  const navigateTo = (view: PageView) => {
    setPageView(view); setSelectedArticle(null); setSelectedCategoryId(null);
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('product'); newParams.delete('article');
    setSearchParams(newParams, { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openArticle = (article: LandingArticle) => {
    setSelectedArticle(article); setPageView('article-detail');
    const newParams = new URLSearchParams(searchParams);
    newParams.set('article', article.id); newParams.delete('product');
    setSearchParams(newParams, { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openProduct = (p: LandingProduct) => {
    setSelectedProduct(p);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('product', p.id); newParams.delete('article');
    setSearchParams(newParams, { replace: true });
  };

  const copyShareLink = (type: 'product' | 'article', id: string) => {
    const spaUrl = new URL(window.location.href);
    spaUrl.search = '';
    spaUrl.searchParams.set(type, id);
    const directUrl = spaUrl.toString();
    const ogProxyBase = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/og-meta`;
    const ogUrl = `${ogProxyBase}?type=${type}&id=${id}&tenant_id=${tenantId || ''}&url=${encodeURIComponent(directUrl)}`;
    navigator.clipboard.writeText(ogUrl).then(() => {
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

  return (
    <div className="min-h-screen bg-white text-[#1d1d1f]" style={{ fontFamily: config.fontFamily }}>
      {/* === HEADER === */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-black/5">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-12">
            {/* Left: Hamburger + Store name */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-black/5 transition-colors sm:hidden"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              <button onClick={() => navigateTo('home')} className="flex items-center gap-2.5">
                {settings?.store_logo_url ? (
                  <img src={settings.store_logo_url} alt={displayStoreName} className="h-7 w-7 rounded-lg object-cover" />
                ) : null}
                <span className="font-semibold text-sm tracking-tight">{displayStoreName}</span>
              </button>
            </div>

            {/* Desktop nav */}
            <nav className="hidden sm:flex items-center gap-1">
              {navItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item)}
                  className="px-3 py-1.5 text-xs font-medium rounded-full transition-all"
                  style={
                    isNavActive(item)
                      ? { backgroundColor: '#1d1d1f', color: 'white' }
                      : {}
                  }
                >
                  {item.label}
                </button>
              ))}
            </nav>

            {/* Search icon */}
            <button
              onClick={() => { navigateTo('products'); setTimeout(() => document.getElementById('product-search-input')?.focus(), 100); }}
              className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-black/5 transition-colors"
            >
              <Search className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-black/5 bg-white/95 backdrop-blur-xl">
            <div className="px-4 py-3 space-y-1">
              {navItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => { handleNavClick(item); setMobileMenuOpen(false); }}
                  className="w-full text-left px-3 py-2.5 text-sm font-medium rounded-xl transition-all flex items-center gap-2"
                  style={
                    isNavActive(item)
                      ? { backgroundColor: '#1d1d1f', color: 'white' }
                      : {}
                  }
                >
                  {item.icon && <span className="text-base">{item.icon}</span>}
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      <main>
        {/* === HOME PAGE === */}
        {pageView === 'home' && (
          <div>
            {/* HERO BANNER */}
            {settings?.show_banner && settings?.banner_image_url ? (
              <section className="relative overflow-hidden bg-[#f5f5f7]">
                {settings.banner_link_url ? (
                  <a href={settings.banner_link_url} target="_blank" rel="noopener noreferrer">
                    <img src={settings.banner_image_url} alt="Banner" className="w-full h-auto max-h-[500px] object-cover" />
                  </a>
                ) : (
                  <img src={settings.banner_image_url} alt="Banner" className="w-full h-auto max-h-[500px] object-cover" />
                )}
              </section>
            ) : (
              <section ref={heroRef} className="relative overflow-hidden text-white" style={{ background: config.heroGradient }}>
                <div
                  className="max-w-[1200px] mx-auto px-6 py-12 sm:py-20"
                  style={{ transform: `translateY(${heroOffset}px)` }}
                >
                  <ScrollReveal animation="fade-up" delay={100}>
                    <h1 className="text-3xl sm:text-5xl font-bold tracking-tight mb-3">
                      {config.heroTitle}
                    </h1>
                  </ScrollReveal>
                  <ScrollReveal animation="fade-up" delay={200}>
                    <p className="text-sm sm:text-base text-white/70 mb-6 max-w-md">
                      {config.heroSubtitle}
                    </p>
                  </ScrollReveal>
                  <ScrollReveal animation="scale-up" delay={300}>
                    <Button
                      onClick={() => navigateTo('products')}
                      className="text-white rounded-full px-8 h-11 text-sm font-medium"
                      style={{ backgroundColor: accentColor }}
                    >
                      {config.heroCta}
                    </Button>
                  </ScrollReveal>
                </div>
              </section>
            )}

            {/* TRUST BADGES - horizontal layout */}
            <ScrollReveal animation="fade-up" delay={100}>
              <section className="bg-white border-b border-black/5">
                <div className="max-w-[1200px] mx-auto px-4 py-5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {((settings as any)?.custom_trust_badges || config.trustBadges).map((badge: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-xl">
                        <div className="shrink-0" style={{ color: accentColor }}>
                          {ICON_MAP[badge.icon] || <Shield className="h-5 w-5" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold leading-tight">{badge.title}</p>
                          <p className="text-[10px] text-[#86868b] leading-tight">{badge.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </ScrollReveal>

            {/* PRODUCT CATEGORIES - only if feature enabled */}
            {config.features.categories && productsData && productsData.categories.length > 0 && (
              <ScrollReveal animation="fade-up" delay={150}>
                <section className="bg-[#f5f5f7] py-8">
                  <div className="max-w-[1200px] mx-auto px-4">
                    <div className="flex items-center overflow-x-auto gap-4 py-2 scrollbar-hide">
                      {productsData.categories.map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => { setSelectedCategoryId(cat.id); navigateTo('products'); }}
                          className="flex flex-col items-center gap-2 min-w-[90px] group"
                        >
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
            )}

            {/* FEATURED PRODUCTS */}
            {featuredProducts.length > 0 && (
              <section className="py-10 bg-white">
                <div className="max-w-[1200px] mx-auto px-4">
                  <ScrollReveal animation="fade-up">
                    <div className="flex items-end justify-between mb-6">
                      <div>
                        <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{config.productSectionTitle}</h2>
                        <p className="text-xs text-[#86868b] mt-0.5">{config.productSectionSubtitle}</p>
                      </div>
                      <button
                        onClick={() => navigateTo('products')}
                        className="text-xs font-medium shrink-0 flex items-center gap-1"
                        style={{ color: accentColor }}
                      >
                        Xem tất cả <ChevronDown className="h-3 w-3 -rotate-90" />
                      </button>
                    </div>
                  </ScrollReveal>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                    {featuredProducts.slice(0, 8).map((p, i) => (
                      <ScrollReveal key={p.id} animation="fade-up" delay={i * 80}>
                        <ProductCard product={p} onClick={() => openProduct(p)} accentColor={accentColor} />
                      </ScrollReveal>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* ALL PRODUCTS if no featured */}
            {featuredProducts.length === 0 && allProducts.length > 0 && (
              <section className="py-10 bg-white">
                <div className="max-w-[1200px] mx-auto px-4">
                  <ScrollReveal animation="fade-up">
                    <div className="flex items-end justify-between mb-6">
                      <div>
                        <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{config.productSectionTitle}</h2>
                      </div>
                      <button
                        onClick={() => navigateTo('products')}
                        className="text-xs font-medium shrink-0 flex items-center gap-1"
                        style={{ color: accentColor }}
                      >
                        Xem tất cả <ChevronDown className="h-3 w-3 -rotate-90" />
                      </button>
                    </div>
                  </ScrollReveal>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                    {allProducts.slice(0, 8).map((p, i) => (
                      <ScrollReveal key={p.id} animation="fade-up" delay={i * 80}>
                        <ProductCard product={p} onClick={() => openProduct(p)} accentColor={accentColor} />
                      </ScrollReveal>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* NEWS - only if feature enabled */}
            {config.features.articles && featuredArticles.length > 0 && (
              <section className="py-12 bg-[#f5f5f7]">
                <div className="max-w-[1200px] mx-auto px-4">
                  <ScrollReveal animation="fade-up">
                    <div className="text-center mb-8">
                      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">{config.navLabels.news}</h2>
                    </div>
                  </ScrollReveal>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {featuredArticles.slice(0, 3).map((a, i) => (
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
            )}

            {/* WARRANTY LOOKUP - only if feature enabled */}
            {config.features.warranty && (settings?.show_warranty_lookup !== false) && (
              <ScrollReveal animation="fade-up">
                <section className="py-12 bg-white">
                  <div className="max-w-lg mx-auto px-4 text-center">
                    <Shield className="h-8 w-8 mx-auto mb-3" style={{ color: accentColor }} />
                    <h2 className="text-2xl font-bold tracking-tight mb-2">Tra cứu bảo hành</h2>
                    <p className="text-sm text-[#86868b] mb-6">Nhập IMEI hoặc số điện thoại để kiểm tra</p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Nhập IMEI hoặc SĐT..."
                        value={searchValue}
                        onChange={e => setSearchValue(e.target.value)}
                        onKeyPress={handleKeyPress}
                        className="flex-1 h-12 text-base rounded-xl border-black/10"
                        style={{ '--tw-ring-color': accentColor } as any}
                        inputMode="tel"
                      />
                      <Button onClick={handleSearch} disabled={!searchValue.trim() || isSearching} className="h-12 px-6 rounded-xl" style={{ backgroundColor: accentColor }}>
                        {isSearching ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                      </Button>
                    </div>
                  </div>
                </section>
              </ScrollReveal>
            )}

            {/* VOUCHER - only if feature enabled */}
            {config.features.voucher && (settings as any)?.voucher_enabled && tenantId && (
              <section className="py-8 bg-[#f5f5f7]">
                <div className="max-w-lg mx-auto px-4">
                  <VoucherClaimForm tenantId={tenantId} branches={branches.map(b => ({ id: b.id, name: b.name }))} primaryColor={accentColor} />
                </div>
              </section>
            )}

            {/* REVIEWS - only if feature enabled */}
            {config.features.reviews && tenantId && (
              <ScrollReveal animation="fade-up">
                <section className="py-12 bg-white">
                  <div className="max-w-[1200px] mx-auto px-4">
                    <StoreReviewsSection tenantId={tenantId} primaryColor={accentColor} />
                  </div>
                </section>
              </ScrollReveal>
            )}

            {/* STORE INFO - only if feature enabled */}
            {config.features.storeInfo && (settings?.show_store_info !== false) && (settings?.store_address || settings?.store_phone || branches.length > 0) && (
              <ScrollReveal animation="fade-up">
                <section className="py-12 bg-[#f5f5f7]">
                  <div className="max-w-[1200px] mx-auto px-4">
                    <div className="text-center mb-8">
                      <h2 className="text-2xl font-bold tracking-tight">Liên hệ</h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {branches.map(branch => (
                        <div key={branch.id} className="bg-white rounded-2xl p-5 space-y-3">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4" style={{ color: accentColor }} />
                            <p className="font-semibold text-sm">{branch.name}</p>
                          </div>
                          {branch.address && (
                            <div className="flex items-start gap-2">
                              <MapPin className="h-3.5 w-3.5 text-[#86868b] mt-0.5" />
                              <p className="text-xs text-[#86868b]">{branch.address}</p>
                            </div>
                          )}
                          {branch.phone && (
                            <a href={`tel:${branch.phone}`} className="flex items-center gap-2" style={{ color: accentColor }}>
                              <Phone className="h-3.5 w-3.5" />
                              <p className="text-xs font-medium">{branch.phone}</p>
                            </a>
                          )}
                        </div>
                      ))}
                      {branches.length === 0 && (
                        <div className="bg-white rounded-2xl p-5 space-y-3">
                          {settings?.store_address && (
                            <div className="flex items-start gap-2">
                              <MapPin className="h-4 w-4 text-[#86868b] mt-0.5" />
                              <p className="text-sm">{settings.store_address}</p>
                            </div>
                          )}
                          {settings?.store_phone && (
                            <a href={`tel:${settings.store_phone}`} className="flex items-center gap-2" style={{ color: accentColor }}>
                              <Phone className="h-4 w-4" />
                              <p className="text-sm font-medium">{settings.store_phone}</p>
                            </a>
                          )}
                          {settings?.store_email && (
                            <a href={`mailto:${settings.store_email}`} className="flex items-center gap-2" style={{ color: accentColor }}>
                              <Mail className="h-4 w-4" />
                              <p className="text-sm font-medium">{settings.store_email}</p>
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              </ScrollReveal>
            )}
          </div>
        )}

        {/* === PRODUCTS PAGE === */}
        {pageView === 'products' && (
          <div className="max-w-[1200px] mx-auto px-4 py-8">
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => navigateTo('home')} className="h-8 w-8 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-black/10 transition-colors">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <h2 className="text-2xl font-bold tracking-tight flex-1">{config.navLabels.products}</h2>
            </div>

            {/* Product search */}
            <div className="relative mb-4">
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

            {productsData && productsData.categories.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
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
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {filteredProducts.map((p, i) => (
                <ScrollReveal key={p.id} animation="fade-up" delay={i * 50} once>
                  <ProductCard product={p} onClick={() => openProduct(p)} accentColor={accentColor} />
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
        )}

        {/* === NEWS PAGE === */}
        {pageView === 'news' && (
          <div className="max-w-[1200px] mx-auto px-4 py-8">
            <div className="flex items-center gap-3 mb-6">
              <button onClick={() => navigateTo('home')} className="h-8 w-8 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-black/10 transition-colors">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <h2 className="text-2xl font-bold tracking-tight">{config.navLabels.news}</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {articlesData?.articles?.map((a, i) => (
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
              )) || null}
              {(!articlesData?.articles || articlesData.articles.length === 0) && (
                <div className="col-span-full text-center py-16">
                  <Newspaper className="h-12 w-12 mx-auto text-[#86868b] mb-3" />
                  <p className="text-sm text-[#86868b]">Chưa có bài viết nào</p>
                </div>
              )}
            </div>
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
            default: return null;
          }
        })()}
      </main>

      {/* === FOOTER === */}
      <footer className="py-8 border-t border-black/5 bg-[#f5f5f7]">
        <div className="max-w-[1200px] mx-auto px-4 text-center space-y-3">
          <div className="flex items-center justify-center gap-4">
            {facebookUrl && (
              <a href={facebookUrl} target="_blank" rel="noopener noreferrer" className="text-[#86868b] hover:text-[#1d1d1f] transition-colors">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </a>
            )}
            {zaloUrl && (
              <a href={zaloUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-[#86868b] hover:text-[#1d1d1f] transition-colors">Zalo</a>
            )}
            {tiktokUrl && (
              <a href={tiktokUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-[#86868b] hover:text-[#1d1d1f] transition-colors">TikTok</a>
            )}
          </div>
          <p className="text-xs text-[#86868b]">© {new Date().getFullYear()} {displayStoreName}</p>
        </div>
      </footer>

      {/* === STICKY BUY BAR (Mobile) === */}
      {(zaloUrl || warrantyHotline) && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-t border-black/5 py-2 px-4 sm:hidden" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
          <div className="flex items-center gap-2">
            {zaloUrl && (
              <a href={zaloUrl} target="_blank" rel="noopener noreferrer" className="flex-1 text-white rounded-xl py-2.5 text-center text-sm font-medium" style={{ backgroundColor: accentColor }}>
                {config.stickyBarLabels.chat}
              </a>
            )}
            {warrantyHotline && (
              <a href={`tel:${warrantyHotline}`} className="flex-1 bg-[#1d1d1f] text-white rounded-xl py-2.5 text-center text-sm font-medium">
                {config.stickyBarLabels.call}
              </a>
            )}
          </div>
        </div>
      )}

      {/* PRODUCT DETAIL DIALOG */}
      <ProductDetailDialog
        product={selectedProduct}
        open={!!selectedProduct}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedProduct(null);
            const newParams = new URLSearchParams(searchParams);
            newParams.delete('product');
            setSearchParams(newParams, { replace: true });
          }
        }}
        tenantId={tenantId}
        branches={branches.map(b => ({ id: b.id, name: b.name }))}
        primaryColor={accentColor}
        warrantyHotline={warrantyHotline}
        onShare={() => selectedProduct && copyShareLink('product', selectedProduct.id)}
      />
    </div>
  );
}

// === Product Card with hover effects ===
function ProductCard({ product, onClick, accentColor }: { product: LandingProduct; onClick: () => void; accentColor: string }) {
  return (
    <button
      onClick={onClick}
      className="bg-[#f5f5f7] rounded-2xl overflow-hidden text-left group transition-all hover:shadow-lg w-full"
    >
      <div className="relative overflow-hidden">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full aspect-square bg-[#e8e8ed] flex items-center justify-center">
            <Package className="h-10 w-10 text-[#86868b]" />
          </div>
        )}
        {product.sale_price && (
          <div className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            -{Math.round(((product.price - product.sale_price) / product.price) * 100)}%
          </div>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 flex items-end justify-center pb-4 opacity-0 group-hover:opacity-100">
          <span className="text-white text-xs font-medium bg-black/60 backdrop-blur-sm rounded-full px-4 py-1.5">Xem chi tiết</span>
        </div>
      </div>
      <div className="p-3 sm:p-4">
        <p className="font-medium text-xs sm:text-sm line-clamp-2 min-h-[2rem] leading-tight">{product.name}</p>
        <div className="mt-2">
          {product.sale_price ? (
            <div className="space-y-0.5">
              <p className="text-xs text-[#86868b] line-through">{formatNumber(product.price)}đ</p>
              <p className="font-bold text-sm text-red-600">{formatNumber(product.sale_price)}đ</p>
            </div>
          ) : (
            <p className="font-bold text-sm text-[#1d1d1f]">{formatNumber(product.price)}đ</p>
          )}
        </div>
      </div>
    </button>
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
