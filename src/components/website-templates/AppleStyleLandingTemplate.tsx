/**
 * Apple Style Landing Template
 * Completely standalone – does NOT reuse any existing layout components.
 * Full-screen vertical banners, frosted glass header, Apple.com aesthetic.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import DOMPurify from 'dompurify';
import { SetURLSearchParams, useLocation } from 'react-router-dom';
import { QueryClient } from '@tanstack/react-query';
import { buildProductPath, buildProductDetailPath, buildArticlePath, buildPagePath, extractProductIdFromPath, detectPageFromPath } from '@/lib/slugify';
import { TenantLandingSettings, useWarrantyLookup, useCustomerPointsPublic, WarrantyResult, BranchInfo, HomeSectionItem } from '@/hooks/useTenantLanding';
import { LandingProduct, LandingProductCategory } from '@/hooks/useLandingProducts';
import { LandingArticle, LandingArticleCategory } from '@/hooks/useLandingArticles';
import { usePublicCustomerVouchers } from '@/hooks/useVouchers';
import { ProductDetailPage } from '@/components/landing/ProductDetailPage';
import { InstallmentCalculatorDialog } from '@/components/dashboard/InstallmentCalculatorDialog';
import { StaffRatingForm } from '@/components/landing/StaffRatingForm';
import { VoucherClaimForm } from '@/components/landing/VoucherClaimForm';
import StoreReviewsSection from '@/components/landing/StoreReviewsSection';
import { getIndustryConfig, NavItemConfig, getDefaultNavItems, HomeSection, GOOGLE_FONTS } from '@/lib/industryConfig';
import {
  RepairPage, TradeInPage, InstallmentPage, PriceListPage,
  BookingPage, BranchesPage as SystemBranchesPage, ContactPage, AccessoriesPage,
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
  Loader2, Building2, Headphones, Calendar, Package,
  Clock, Users, Star, Gift, ChevronDown, ChevronRight,
  ShoppingBag, Newspaper, ArrowLeft,
  Link2, Menu, X, Smartphone, Tablet, Laptop, Zap,
} from 'lucide-react';

// ============================
// Types
// ============================
export interface AppleStyleLandingProps {
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
}

type PageView = 'home' | 'products' | 'news' | 'warranty' | 'article-detail' | 'repair' | 'tradein' | 'installment' | 'accessories' | 'compare' | 'pricelist' | 'booking' | 'branches' | 'contact' | 'services' | 'rooms' | 'courses' | 'doctors' | 'collection' | 'promotion' | 'reviews' | 'system-page';

// ============================
// Scroll Fade-In Hook (standalone)
// ============================
function useAppleFadeIn() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: 0.15 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, className: `transition-all duration-700 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}` };
}

function FadeSection({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const fade = useAppleFadeIn();
  return <div ref={fade.ref} className={`${fade.className} ${className}`}>{children}</div>;
}

// ============================
// Warranty helpers (same logic)
// ============================
interface WarrantyStatus { valid: boolean; message: string; endDate: Date | null; startDate: Date; months: number; daysLeft?: number; }
function calcWarranty(item: WarrantyResult): WarrantyStatus | null {
  const saleDate = new Date(item.export_date);
  const wm = parseInt(item.warranty || '0', 10);
  if (!wm || wm <= 0) return { valid: false, message: 'Không BH', endDate: null, startDate: saleDate, months: 0 };
  const end = addMonths(saleDate, wm);
  const ok = isAfter(end, new Date());
  const dl = ok ? differenceInDays(end, new Date()) : 0;
  return { valid: ok, message: ok ? `Còn ${dl} ngày` : 'Hết BH', endDate: end, startDate: saleDate, months: wm, daysLeft: dl };
}

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

// ============================
// Apple Frosted Header (standalone)
// ============================
function AppleHeader({
  storeName, logoUrl, accentColor, mobileMenuOpen, onToggleMenu, onNavigateHome, onOpenSearch,
  navItems, onNavClick, isNavActive, onCloseMenu,
}: {
  storeName: string; logoUrl?: string | null; accentColor: string;
  mobileMenuOpen: boolean; onToggleMenu: () => void; onNavigateHome: () => void; onOpenSearch: () => void;
  navItems: NavItemConfig[]; onNavClick: (n: NavItemConfig) => void; isNavActive: (n: NavItemConfig) => boolean; onCloseMenu: () => void;
}) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-[100] transition-all duration-300"
        style={{
          backgroundColor: scrolled ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.92)',
          backdropFilter: 'saturate(180%) blur(20px)',
          WebkitBackdropFilter: 'saturate(180%) blur(20px)',
          borderBottom: scrolled ? '1px solid rgba(0,0,0,0.08)' : '1px solid transparent',
        }}
      >
        <nav className="max-w-[1024px] mx-auto h-11 flex items-center justify-between px-4 sm:px-6">
          {/* Logo */}
          <button onClick={onNavigateHome} className="shrink-0">
            {logoUrl ? (
              <img src={logoUrl} alt={storeName} className="h-5 w-auto object-contain" />
            ) : (
              <span className="text-sm font-semibold text-[#1d1d1f] tracking-tight">{storeName}</span>
            )}
          </button>

          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-5">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => onNavClick(item)}
                className={`text-xs transition-colors ${isNavActive(item) ? 'text-[#1d1d1f] font-medium' : 'text-[#424245] hover:text-[#1d1d1f]'}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Right icons */}
          <div className="flex items-center gap-3">
            <button onClick={onOpenSearch} className="text-[#424245] hover:text-[#1d1d1f] transition-colors">
              <Search className="h-4 w-4" />
            </button>
            <button onClick={onToggleMenu} className="sm:hidden text-[#424245] hover:text-[#1d1d1f] transition-colors">
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile menu portal */}
      {mobileMenuOpen && createPortal(
        <>
          <div className="fixed inset-0 z-[9998] bg-black/30 sm:hidden" onClick={onCloseMenu} />
          <div className="fixed top-0 left-0 right-0 bottom-0 z-[9999] sm:hidden bg-white/95 backdrop-blur-xl pt-12 px-6 overflow-y-auto animate-fade-in">
            <button onClick={onCloseMenu} className="absolute top-3 right-4 p-1"><X className="h-5 w-5 text-[#1d1d1f]" /></button>
            <div className="space-y-1 pt-4">
              {navItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => { onNavClick(item); onCloseMenu(); }}
                  className={`w-full text-left py-3 border-b border-[#d2d2d7] text-base font-medium ${isNavActive(item) ? 'text-[#0071e3]' : 'text-[#1d1d1f]'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Spacer */}
      <div className="h-11" />
    </>
  );
}

// ============================
// Apple Footer (standalone)
// ============================
function AppleFooter({ storeName, accentColor, facebookUrl, zaloUrl, tiktokUrl }: {
  storeName: string; accentColor: string; facebookUrl?: string | null; zaloUrl?: string | null; tiktokUrl?: string | null;
}) {
  return (
    <footer className="bg-[#f5f5f7] border-t border-[#d2d2d7]">
      <div className="max-w-[1024px] mx-auto px-4 py-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-xs text-[#6e6e73]">
          <div>
            <p className="font-semibold text-[#1d1d1f] mb-3">Cửa hàng</p>
            <p>{storeName}</p>
          </div>
          <div>
            <p className="font-semibold text-[#1d1d1f] mb-3">Dịch vụ</p>
            <p>Bảo hành</p>
            <p>Sửa chữa</p>
            <p>Trả góp 0%</p>
          </div>
          <div>
            <p className="font-semibold text-[#1d1d1f] mb-3">Hỗ trợ</p>
            <p>Thu cũ đổi mới</p>
            <p>Phụ kiện</p>
          </div>
          <div>
            <p className="font-semibold text-[#1d1d1f] mb-3">Kết nối</p>
            {facebookUrl && <a href={facebookUrl} target="_blank" rel="noopener noreferrer" className="block hover:text-[#1d1d1f]">Facebook</a>}
            {zaloUrl && <a href={zaloUrl} target="_blank" rel="noopener noreferrer" className="block hover:text-[#1d1d1f]">Zalo</a>}
            {tiktokUrl && <a href={tiktokUrl} target="_blank" rel="noopener noreferrer" className="block hover:text-[#1d1d1f]">TikTok</a>}
          </div>
        </div>
        <div className="mt-6 pt-4 border-t border-[#d2d2d7] text-[11px] text-[#86868b]">
          © {new Date().getFullYear()} {storeName}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

// ============================
// Apple Sticky Bar (standalone)
// ============================
function AppleStickyBar({ accentColor, zaloUrl, warrantyHotline }: {
  accentColor: string; zaloUrl?: string | null; warrantyHotline?: string | null;
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 sm:hidden bg-white/90 backdrop-blur-lg border-t border-[#d2d2d7] px-4 py-2 flex gap-2">
      {zaloUrl && (
        <a href={zaloUrl} target="_blank" rel="noopener noreferrer" className="flex-1 h-10 rounded-xl text-white text-xs font-semibold flex items-center justify-center gap-1.5" style={{ backgroundColor: accentColor }}>
          Chat Zalo
        </a>
      )}
      {warrantyHotline && (
        <a href={`tel:${warrantyHotline}`} className="flex-1 h-10 rounded-xl bg-[#1d1d1f] text-white text-xs font-semibold flex items-center justify-center gap-1.5">
          <Phone className="h-3.5 w-3.5" /> Gọi ngay
        </a>
      )}
    </div>
  );
}

// ============================
// Apple Product Card (standalone)
// ============================
function AppleProductCard({ product, onClick, accentColor }: { product: LandingProduct; onClick: () => void; accentColor: string }) {
  const origPrice = (product as any).original_price;
  const hasDiscount = origPrice && origPrice > product.price;
  return (
    <button onClick={onClick} className="group bg-white rounded-2xl overflow-hidden text-left transition-all hover:shadow-lg w-full">
      <div className="aspect-square bg-[#fbfbfd] flex items-center justify-center p-6 overflow-hidden">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="max-h-full max-w-full object-contain transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <ShoppingBag className="h-12 w-12 text-[#d2d2d7]" />
        )}
      </div>
      <div className="p-4">
        <p className="text-sm font-medium text-[#1d1d1f] line-clamp-2 mb-2">{product.name}</p>
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold" style={{ color: accentColor }}>{formatNumber(product.price)}đ</span>
          {hasDiscount && <span className="text-xs text-[#86868b] line-through">{formatNumber(origPrice)}đ</span>}
        </div>
      </div>
    </button>
  );
}

// ============================
// MAIN COMPONENT
// ============================
export default function AppleStyleLandingTemplate({
  settings, tenant, tenantId, storeId, branches,
  productsData, articlesData, searchParams, setSearchParams, queryClient,
}: AppleStyleLandingProps) {
  const config = getIndustryConfig('apple_landing');
  const accentColor = settings?.primary_color || config.accentColor;
  const fontFamily = config.fontFamily;

  // Load font
  useEffect(() => {
    const url = GOOGLE_FONTS[fontFamily];
    if (url && !document.querySelector(`link[href="${url}"]`)) {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = url; document.head.appendChild(l);
    }
  }, [fontFamily]);

  const isStandalone = typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true);
  const [pageView, setPageView] = useState<PageView>(isStandalone ? 'warranty' : 'home');
  const [selectedArticle, setSelectedArticle] = useState<LandingArticle | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<LandingProduct | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [showInstallmentCalc, setShowInstallmentCalc] = useState(false);
  // Warranty state
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
      const p = raw ? JSON.parse(raw) : null;
      const v = typeof p?.searchValue === 'string' ? p.searchValue.trim() : '';
      if (v) { setSearchValue(v); setSubmittedValue(v); setPageView('warranty'); }
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
    const pid = searchParams.get('product');
    const aid = searchParams.get('article');
    
    // Try path-based page detection
    const pageInfo = detectPageFromPath(location.pathname);
    if (pageInfo) {
      if (pageInfo.pageView === 'products' && pageInfo.contentId) {
        const p = productsData?.products?.find(x => x.id.startsWith(pageInfo.contentId!));
        if (p) { setSelectedProduct(p); setPageView('products'); return; }
      } else if (pageInfo.pageView === 'news' && pageInfo.contentId) {
        const a = articlesData?.articles?.find(x => x.id.startsWith(pageInfo.contentId!));
        if (a) { setSelectedArticle(a); setPageView('article-detail'); return; }
      } else if (!pageInfo.contentId) {
        setPageView(pageInfo.pageView as PageView);
        return;
      }
    }
    
    // Legacy path-based product URL
    if (!pid && !aid && productsData?.products) {
      const shortId = extractProductIdFromPath(location.pathname);
      if (shortId) {
        const p = productsData.products.find(x => x.id.startsWith(shortId));
        if (p) { setSelectedProduct(p); setPageView('products'); }
      }
    }
    
    if (pid && productsData?.products) { const p = productsData.products.find(x => x.id === pid); if (p) { setSelectedProduct(p); setPageView('products'); } }
    if (aid && articlesData?.articles) { const a = articlesData.articles.find(x => x.id === aid); if (a) { setSelectedArticle(a); setPageView('article-detail'); } }
  }, [searchParams, productsData, articlesData, location.pathname]);

  const isPhoneSearch = /^0\d{9,10}$/.test(submittedValue.replace(/\s/g, ''));
  const firstResult = warrantyResults?.[0];
  const phoneForPoints = isPhoneSearch ? submittedValue : (firstResult?.customer_phone || '');
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
    let p = selectedCategoryId ? allProducts.filter(x => x.category_id === selectedCategoryId) : allProducts;
    if (productSearchQuery.trim()) { const q = productSearchQuery.toLowerCase().trim(); p = p.filter(x => x.name.toLowerCase().includes(q)); }
    return p;
  }, [allProducts, selectedCategoryId, productSearchQuery]);
  const featuredArticles = articlesData?.articles?.filter(a => a.is_featured) || [];
  const homeArticles = articlesData?.articles?.filter((a: any) => a.is_featured_home) || [];

  const handlePointsAwarded = useCallback(() => { queryClient.invalidateQueries({ queryKey: ['customer-points-public'] }); }, [queryClient]);
  const handleWarrantyLogout = () => { if (warrantyStorageKey) localStorage.removeItem(warrantyStorageKey); setSearchValue(''); setSubmittedValue(''); setPageView('home'); };
  const handleSearch = () => { if (searchValue.trim()) { setSubmittedValue(searchValue.trim()); if (pageView === 'home') setPageView('warranty'); } };
  const handleKeyPress = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleSearch(); };

  const navigateTo = (view: PageView) => {
    setPageView(view); setSelectedArticle(null); setSelectedCategoryId(null); setSelectedProduct(null);
    const pagePath = buildPagePath(view);
    window.history.replaceState(null, '', pagePath === '/' ? '/' : pagePath);
    setSearchParams(new URLSearchParams(), { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const openArticle = (a: LandingArticle) => {
    setSelectedArticle(a); setPageView('article-detail');
    const articlePath = buildArticlePath(a.title, a.id);
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
    navigator.clipboard.writeText(cleanUrl).then(() => { import('sonner').then(({ toast }) => toast.success('Đã sao chép link')); }).catch(() => {});
  };

  // Nav items
  const customNavItems = (settings as any)?.custom_nav_items as NavItemConfig[] | null;
  const navItems = useMemo(() => {
    if (customNavItems && customNavItems.length > 0) return customNavItems.filter(i => i.enabled);
    return getDefaultNavItems(config);
  }, [customNavItems, config]);

  const handleNavClick = (item: NavItemConfig) => {
    if (item.type === 'page' && item.pageView) navigateTo(item.pageView as PageView);
    else if (item.type === 'link' && item.url) window.open(item.url, '_blank', 'noopener,noreferrer');
    else navigateTo('home');
  };
  const isNavActive = (item: NavItemConfig) => {
    if (item.type === 'page' && item.pageView) {
      if (item.pageView === 'news' && pageView === 'article-detail') return true;
      return pageView === item.pageView;
    }
    return false;
  };

  // Categories for section banners
  const categories = productsData?.categories || [];

  // Alternating background palettes for category banners (Apple-style)
  const categoryPalettes = [
    { bg: 'bg-[#fbfbfd]', text: 'text-[#1d1d1f]', sub: 'text-[#6e6e73]', btnBg: accentColor, btnText: 'text-white' },
    { bg: 'bg-[#1d1d1f]', text: 'text-white', sub: 'text-[#86868b]', btnBg: accentColor, btnText: 'text-white' },
    { bg: 'bg-[#f5f5f7]', text: 'text-[#1d1d1f]', sub: 'text-[#6e6e73]', btnBg: accentColor, btnText: 'text-white' },
    { bg: 'bg-black', text: 'text-white', sub: 'text-[#a1a1a6]', btnBg: '#fff', btnText: 'text-[#1d1d1f]' },
  ];

  // Get products for a category
  const getProductsForCategory = (catId: string) => allProducts.filter(p => p.category_id === catId);

  // If a product is selected, show full page
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
          relatedProducts={(productsData?.products || []).filter(p => p.category_id === selectedProduct.category_id && p.id !== selectedProduct.id).slice(0, 10)}
          onProductClick={(p) => { setSelectedProduct(p); window.scrollTo(0, 0); }}
          storeInfo={{ name: settings?.store_name || tenant.name, phone: settings?.store_phone || '', address: settings?.store_address || '' }}
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
        />
        <InstallmentCalculatorDialog open={showInstallmentCalc} onOpenChange={setShowInstallmentCalc} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-white text-[#1d1d1f]" style={{ fontFamily }}>
      <AppleHeader
        storeName={displayStoreName}
        logoUrl={settings?.store_logo_url}
        accentColor={accentColor}
        mobileMenuOpen={mobileMenuOpen}
        onToggleMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
        onNavigateHome={() => navigateTo('home')}
        onOpenSearch={() => { navigateTo('products'); setTimeout(() => document.getElementById('apple-product-search')?.focus(), 100); }}
        navItems={navItems}
        onNavClick={handleNavClick}
        isNavActive={isNavActive}
        onCloseMenu={() => setMobileMenuOpen(false)}
      />

      <main>
        {/* ============ HOME PAGE ============ */}
        {pageView === 'home' && (
          <div>
            {/* Hero Banner (custom banner or default hero) */}
            {settings?.show_banner && settings?.banner_image_url ? (
              <section className="relative overflow-hidden">
                {settings.banner_link_url ? (
                  <a href={settings.banner_link_url} target="_blank" rel="noopener noreferrer">
                    <img src={settings.banner_image_url} alt="Banner" className="w-full h-screen object-cover" />
                  </a>
                ) : (
                  <img src={settings.banner_image_url} alt="Banner" className="w-full h-screen object-cover" />
                )}
              </section>
            ) : featuredProducts[0] ? (
              <FadeSection>
                <section className="h-screen flex flex-col items-center justify-center text-center px-6 bg-[#fbfbfd] relative overflow-hidden">
                  <p className="text-[#6e6e73] text-xs tracking-[0.2em] uppercase mb-3">Mới ra mắt</p>
                  <h1 className="text-4xl sm:text-6xl lg:text-[80px] font-bold tracking-tight text-[#1d1d1f] mb-3 leading-none">
                    {(settings as any)?.hero_title || config.heroTitle}
                  </h1>
                  <p className="text-lg sm:text-xl text-[#6e6e73] mb-8 max-w-md">
                    {(settings as any)?.hero_subtitle || config.heroSubtitle}
                  </p>
                  <div className="flex gap-3">
                    <button onClick={() => navigateTo('products')} className="px-7 py-3 rounded-full text-sm font-medium text-white" style={{ backgroundColor: accentColor }}>
                      Xem chi tiết
                    </button>
                    <button onClick={() => navigateTo('products')} className="px-7 py-3 rounded-full text-sm font-medium border-2 hover:bg-[#f5f5f7] transition-colors" style={{ borderColor: accentColor, color: accentColor }}>
                      Mua ngay
                    </button>
                  </div>
                  {featuredProducts[0]?.image_url && (
                    <div className="mt-10 max-w-sm mx-auto">
                      <img src={featuredProducts[0].image_url} alt={featuredProducts[0].name} className="max-h-[350px] object-contain mx-auto hover:scale-105 transition-transform duration-700" />
                    </div>
                  )}
                </section>
              </FadeSection>
            ) : (
              <FadeSection>
                <section className="h-screen flex flex-col items-center justify-center text-center px-6 bg-[#fbfbfd]">
                  <h1 className="text-4xl sm:text-6xl lg:text-[80px] font-bold tracking-tight text-[#1d1d1f] mb-3 leading-none">
                    {(settings as any)?.hero_title || config.heroTitle}
                  </h1>
                  <p className="text-lg sm:text-xl text-[#6e6e73] mb-8 max-w-md">
                    {(settings as any)?.hero_subtitle || config.heroSubtitle}
                  </p>
                  <button onClick={() => navigateTo('products')} className="px-7 py-3 rounded-full text-sm font-medium text-white" style={{ backgroundColor: accentColor }}>
                    Khám phá
                  </button>
                </section>
              </FadeSection>
            )}

            {/* === CATEGORY BANNERS – each full screen, stacked vertically like Apple.com === */}
            {categories.map((cat, idx) => {
              const palette = categoryPalettes[idx % categoryPalettes.length];
              const catProducts = getProductsForCategory(cat.id);
              const isDark = palette.bg === 'bg-[#1d1d1f]' || palette.bg === 'bg-black';

              return (
                <FadeSection key={cat.id}>
                  <section className={`min-h-screen ${palette.bg} flex flex-col items-center justify-center py-20 px-6 relative overflow-hidden`}>
                    {/* Cover image as background if available */}
                    {cat.image_url && (
                      <div className="absolute inset-0 z-0">
                        <img
                          src={cat.image_url}
                          alt={cat.name}
                          className="w-full h-full object-cover"
                        />
                        <div className={`absolute inset-0 ${isDark ? 'bg-black/50' : 'bg-white/60'}`} />
                      </div>
                    )}

                    <div className="relative z-10 text-center max-w-[1024px] w-full">
                      <p className={`text-xs tracking-[0.2em] uppercase mb-3 ${cat.image_url ? (isDark ? 'text-white/60' : 'text-[#6e6e73]') : palette.sub}`}>
                        {catProducts.length > 0 ? `${catProducts.length} sản phẩm` : 'Bộ sưu tập'}
                      </p>
                      <h2 className={`text-4xl sm:text-6xl lg:text-[72px] font-bold tracking-tight mb-4 leading-none ${cat.image_url ? (isDark ? 'text-white' : 'text-[#1d1d1f]') : palette.text}`}>
                        {cat.name}
                      </h2>
                      <div className="flex justify-center gap-3 mb-12">
                        <button
                          onClick={() => { setSelectedCategoryId(cat.id); navigateTo('products'); }}
                          className="px-7 py-3 rounded-full text-sm font-medium transition-all hover:opacity-90"
                          style={{ backgroundColor: palette.btnBg, color: isDark && palette.btnBg === '#fff' ? '#1d1d1f' : '#fff' }}
                        >
                          Tìm hiểu thêm
                        </button>
                        <button
                          onClick={() => { setSelectedCategoryId(cat.id); navigateTo('products'); }}
                          className={`px-7 py-3 rounded-full text-sm font-medium border transition-colors ${
                            isDark || cat.image_url
                              ? 'border-white/30 text-white hover:border-white/60'
                              : 'border-[#1d1d1f]/20 text-[#1d1d1f] hover:border-[#1d1d1f]/50'
                          }`}
                        >
                          Mua ngay
                        </button>
                      </div>

                      {/* Show top 3 products of this category as a grid */}
                      {catProducts.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-3xl mx-auto">
                          {catProducts.slice(0, 3).map(p => (
                            <button
                              key={p.id}
                              onClick={() => openProduct(p)}
                              className={`group rounded-2xl overflow-hidden text-left transition-all hover:shadow-xl ${
                                isDark || cat.image_url ? 'bg-white/10 backdrop-blur-md hover:bg-white/20' : 'bg-white hover:shadow-lg'
                              }`}
                            >
                              <div className="aspect-square flex items-center justify-center p-6 overflow-hidden">
                                {p.image_url ? (
                                  <img src={p.image_url} alt={p.name} className="max-h-full max-w-full object-contain group-hover:scale-110 transition-transform duration-500" />
                                ) : (
                                  <ShoppingBag className={`h-12 w-12 ${isDark ? 'text-white/20' : 'text-[#d2d2d7]'}`} />
                                )}
                              </div>
                              <div className="p-4 text-center">
                                <p className={`text-sm font-medium line-clamp-1 mb-1 ${isDark || cat.image_url ? 'text-white' : 'text-[#1d1d1f]'}`}>
                                  {p.name}
                                </p>
                                <p className="text-sm font-semibold" style={{ color: accentColor }}>
                                  {formatNumber(p.price)}đ
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* No cover image → show category image inline instead */}
                      {!cat.image_url && catProducts.length === 0 && (
                        <div className="mt-8">
                          <ShoppingBag className={`h-20 w-20 mx-auto ${isDark ? 'text-white/10' : 'text-[#d2d2d7]'}`} />
                        </div>
                      )}
                    </div>
                  </section>
                </FadeSection>
              );
            })}

            {/* If no categories exist, show featured products in dark section */}
            {categories.length === 0 && featuredProducts.length > 0 && (
              <FadeSection>
                <section className="min-h-screen bg-[#1d1d1f] text-white flex flex-col items-center justify-center py-20 px-6">
                  <p className="text-[#86868b] text-xs tracking-[0.2em] uppercase mb-3">Bán chạy nhất</p>
                  <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mb-12">Sản phẩm nổi bật</h2>
                  <div className="max-w-[1024px] w-full grid grid-cols-1 sm:grid-cols-3 gap-6">
                    {featuredProducts.slice(0, 3).map(p => (
                      <button key={p.id} onClick={() => openProduct(p)} className="group bg-white/10 backdrop-blur-md rounded-2xl overflow-hidden text-left hover:bg-white/20 transition-colors">
                        <div className="aspect-square flex items-center justify-center p-6">
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name} className="max-h-full object-contain group-hover:scale-105 transition-transform duration-500" />
                          ) : (
                            <Smartphone className="h-16 w-16 text-white/20" />
                          )}
                        </div>
                        <div className="p-5 text-center">
                          <p className="text-sm font-medium text-white line-clamp-1 mb-1">{p.name}</p>
                          <p className="text-sm font-semibold" style={{ color: accentColor }}>{formatNumber(p.price)}đ</p>
                        </div>
                      </button>
                    ))}
                  </div>
                  <button onClick={() => navigateTo('products')} className="mt-8 text-sm font-medium flex items-center gap-1" style={{ color: accentColor }}>
                    Xem tất cả <ChevronRight className="h-4 w-4" />
                  </button>
                </section>
              </FadeSection>
            )}

            {/* Super Sale Banner */}
            <FadeSection>
              <section className="min-h-[70vh] flex flex-col items-center justify-center py-20 px-6" style={{ background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 50%, #f0932b 100%)' }}>
                <p className="text-white/80 text-xs tracking-[0.2em] uppercase mb-3">Ưu đãi đặc biệt</p>
                <h2 className="text-4xl sm:text-6xl lg:text-[72px] font-bold tracking-tight text-white mb-3 leading-none">Super Sale</h2>
                <p className="text-white/80 text-lg mb-8">Giảm giá đến 50% – Số lượng có hạn</p>
                <button onClick={() => navigateTo('products')} className="px-8 py-3.5 rounded-full text-sm font-semibold bg-white text-[#1d1d1f] hover:bg-white/90 transition-colors">
                  Mua ngay <Zap className="inline h-4 w-4 ml-1" />
                </button>
              </section>
            </FadeSection>

            {/* Trust Badges */}
            <FadeSection>
              <section className="py-16 bg-white">
                <div className="max-w-[1024px] mx-auto px-6">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
                    {((settings as any)?.custom_trust_badges || config.trustBadges).map((b: any, i: number) => (
                      <div key={i} className="space-y-2">
                        <div className="h-10 w-10 mx-auto rounded-full bg-[#f5f5f7] flex items-center justify-center">
                          <Shield className="h-5 w-5" style={{ color: accentColor }} />
                        </div>
                        <p className="text-xs font-semibold text-[#1d1d1f]">{b.title}</p>
                        <p className="text-[11px] text-[#86868b]">{b.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </FadeSection>

            {/* Articles */}
            {(() => {
              const arts = homeArticles.length > 0 ? homeArticles : (featuredArticles.length > 0 ? featuredArticles : (articlesData?.articles || []));
              if (arts.length === 0) return null;
              return (
                <FadeSection>
                  <section className="py-16 bg-[#f5f5f7] px-6">
                    <div className="max-w-[1024px] mx-auto">
                      <div className="text-center mb-10">
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Tin tức & Bài viết</h2>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        {arts.slice(0, 3).map(a => (
                          <button key={a.id} onClick={() => openArticle(a)} className="bg-white rounded-2xl overflow-hidden text-left group hover:shadow-lg transition-all w-full">
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
                        ))}
                      </div>
                    </div>
                  </section>
                </FadeSection>
              );
            })()}

            {/* Warranty Section */}
            {settings?.show_warranty_lookup !== false && (
              <FadeSection>
                <section className="py-16 bg-white px-6">
                  <div className="max-w-lg mx-auto text-center">
                    <Shield className="h-8 w-8 mx-auto mb-3" style={{ color: accentColor }} />
                    <h2 className="text-2xl font-bold tracking-tight mb-2">Tra cứu bảo hành</h2>
                    <p className="text-sm text-[#86868b] mb-6">Nhập IMEI hoặc số điện thoại để kiểm tra</p>
                    <div className="flex gap-2">
                      <Input placeholder="Nhập IMEI hoặc SĐT..." value={searchValue} onChange={e => setSearchValue(e.target.value)} onKeyPress={handleKeyPress} className="flex-1 h-12 text-base rounded-xl border-[#d2d2d7]" inputMode="tel" />
                      <Button onClick={handleSearch} disabled={!searchValue.trim() || isSearching} className="h-12 px-6 rounded-xl" style={{ backgroundColor: accentColor }}>
                        {isSearching ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                      </Button>
                    </div>
                  </div>
                </section>
              </FadeSection>
            )}

            {/* Voucher */}
            {(settings as any)?.voucher_enabled && tenantId && (
              <FadeSection>
                <section className="py-8 bg-[#f5f5f7] px-6">
                  <div className="max-w-lg mx-auto">
                    <VoucherClaimForm tenantId={tenantId} branches={branches.map(b => ({ id: b.id, name: b.name }))} primaryColor={accentColor} />
                  </div>
                </section>
              </FadeSection>
            )}

            {/* Reviews */}
            {tenantId && (
              <FadeSection>
                <section className="py-12 bg-white px-6">
                  <div className="max-w-[1024px] mx-auto">
                    <StoreReviewsSection tenantId={tenantId} primaryColor={accentColor} />
                  </div>
                </section>
              </FadeSection>
            )}

            {/* Store Info */}
            {(settings?.store_address || settings?.store_phone || branches.length > 0) && (
              <FadeSection>
                <section className="py-12 bg-[#f5f5f7] px-6">
                  <div className="max-w-[1024px] mx-auto">
                    <div className="text-center mb-8"><h2 className="text-2xl font-bold tracking-tight">Liên hệ</h2></div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {branches.length > 0 ? branches.map(b => (
                        <div key={b.id} className="bg-white rounded-2xl p-5 space-y-3">
                          <div className="flex items-center gap-2"><Building2 className="h-4 w-4" style={{ color: accentColor }} /><p className="font-semibold text-sm">{b.name}</p></div>
                          {b.address && <div className="flex items-start gap-2"><MapPin className="h-3.5 w-3.5 text-[#86868b] mt-0.5" /><p className="text-xs text-[#86868b]">{b.address}</p></div>}
                          {b.phone && <a href={`tel:${b.phone}`} className="flex items-center gap-2" style={{ color: accentColor }}><Phone className="h-3.5 w-3.5" /><p className="text-xs font-medium">{b.phone}</p></a>}
                        </div>
                      )) : (
                        <div className="bg-white rounded-2xl p-5 space-y-3">
                          {settings?.store_address && <div className="flex items-start gap-2"><MapPin className="h-4 w-4 text-[#86868b] mt-0.5" /><p className="text-sm">{settings.store_address}</p></div>}
                          {settings?.store_phone && <a href={`tel:${settings.store_phone}`} className="flex items-center gap-2" style={{ color: accentColor }}><Phone className="h-4 w-4" /><p className="text-sm font-medium">{settings.store_phone}</p></a>}
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              </FadeSection>
            )}
          </div>
        )}

        {/* ============ PRODUCTS PAGE ============ */}
        {pageView === 'products' && (
          <div className="max-w-[1024px] mx-auto px-4 py-8">
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => navigateTo('home')} className="h-8 w-8 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed] transition-colors">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <h2 className="text-2xl font-bold tracking-tight flex-1">Sản phẩm</h2>
              <button onClick={() => copyShareLink('page', 'products')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[#f5f5f7] hover:bg-[#e8e8ed] transition-colors text-[#1d1d1f]">
                <Link2 className="h-3.5 w-3.5" /> Copy link
              </button>
            </div>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#86868b]" />
              <input id="apple-product-search" type="text" placeholder="Tìm kiếm sản phẩm..." value={productSearchQuery} onChange={e => setProductSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-4 text-sm rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] focus:outline-none focus:ring-2 focus:border-transparent" style={{ '--tw-ring-color': accentColor } as any} />
              {productSearchQuery && <button onClick={() => setProductSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-[#d2d2d7] flex items-center justify-center hover:bg-[#86868b]"><X className="h-3 w-3 text-white" /></button>}
            </div>
            {categories.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
                <button onClick={() => setSelectedCategoryId(null)} className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap ${!selectedCategoryId ? 'bg-[#1d1d1f] text-white' : 'bg-[#f5f5f7] text-[#1d1d1f]'}`}>Tất cả</button>
                {categories.map(c => (
                  <button key={c.id} onClick={() => setSelectedCategoryId(c.id)} className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap ${selectedCategoryId === c.id ? 'bg-[#1d1d1f] text-white' : 'bg-[#f5f5f7] text-[#1d1d1f]'}`}>{c.name}</button>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredProducts.map(p => <AppleProductCard key={p.id} product={p} onClick={() => openProduct(p)} accentColor={accentColor} />)}
              {filteredProducts.length === 0 && (
                <div className="col-span-full text-center py-16"><Package className="h-12 w-12 mx-auto text-[#86868b] mb-3" /><p className="text-sm text-[#86868b]">Chưa có sản phẩm nào</p></div>
              )}
            </div>
          </div>
        )}

        {/* ============ NEWS PAGE ============ */}
        {pageView === 'news' && (
          <div className="max-w-[1024px] mx-auto px-4 py-8">
            {(() => {
              const defaultNewsSections = [
                { id: 'search', enabled: true },
                { id: 'categoryFilter', enabled: true },
                { id: 'featuredArticles', enabled: true },
                { id: 'allArticles', enabled: true },
              ];
              const newsSections = ((settings as any)?.custom_news_page_sections || defaultNewsSections).filter((s: any) => s.enabled);
              const allArticlesList = articlesData?.articles || [];
              const featuredOnes = allArticlesList.filter(a => a.is_featured);
              const regularOnes = allArticlesList.filter(a => !a.is_featured);

              return (
                <>
                  <div className="flex items-center gap-3 mb-6">
                    <button onClick={() => navigateTo('home')} className="h-8 w-8 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed] transition-colors"><ArrowLeft className="h-4 w-4" /></button>
                    <h2 className="text-2xl font-bold tracking-tight">{navItems.find(n => n.pageView === 'news')?.label || 'Tin tức'}</h2>
                  </div>

                  {newsSections.map((section: any) => {
                    switch (section.id) {
                      case 'search':
                        return (
                          <div key="search" className="mb-6">
                            <Input placeholder="Tìm kiếm bài viết..." className="h-11 rounded-xl border-[#d2d2d7] bg-[#f5f5f7]" />
                          </div>
                        );
                      case 'categoryFilter':
                        return (
                          <div key="categoryFilter" className="mb-6 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                            <button className="px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap" style={{ backgroundColor: accentColor, color: 'white' }}>Tất cả</button>
                            {(articlesData?.categories || []).filter((c: any) => c.is_visible !== false).map((cat: any) => (
                              <button key={cat.id} className="px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap bg-[#f5f5f7] hover:bg-[#e8e8ed] transition-colors">{cat.name}</button>
                            ))}
                          </div>
                        );
                      case 'featuredArticles':
                        if (featuredOnes.length === 0) return null;
                        return (
                          <div key="featuredArticles" className="mb-8">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                              {featuredOnes.map(a => (
                                <button key={a.id} onClick={() => openArticle(a)} className="bg-white rounded-2xl overflow-hidden border border-[#d2d2d7] hover:shadow-lg transition-all text-left group w-full">
                                  {a.thumbnail_url ? <img src={a.thumbnail_url} alt={a.title} className="w-full h-56 object-cover group-hover:scale-[1.02] transition-transform" /> : <div className="w-full h-56 bg-[#f5f5f7] flex items-center justify-center"><Newspaper className="h-12 w-12 text-[#86868b]" /></div>}
                                  <div className="p-5">
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary mb-2 inline-block">Nổi bật</span>
                                    <p className="font-bold text-base line-clamp-2 mb-2">{a.title}</p>
                                    {a.summary && <p className="text-sm text-[#86868b] line-clamp-2">{a.summary}</p>}
                                    <p className="text-[10px] text-[#86868b] mt-2">{format(new Date(a.created_at), 'dd/MM/yyyy', { locale: vi })}</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      case 'allArticles':
                        return (
                          <div key="allArticles">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                              {regularOnes.map(a => (
                                <button key={a.id} onClick={() => openArticle(a)} className="bg-white rounded-2xl overflow-hidden border border-[#d2d2d7] hover:shadow-lg transition-all text-left group w-full">
                                  {a.thumbnail_url ? <img src={a.thumbnail_url} alt={a.title} className="w-full h-48 object-cover group-hover:scale-[1.02] transition-transform" /> : <div className="w-full h-48 bg-[#f5f5f7] flex items-center justify-center"><Newspaper className="h-10 w-10 text-[#86868b]" /></div>}
                                  <div className="p-5">
                                    <p className="font-semibold text-sm line-clamp-2 mb-2">{a.title}</p>
                                    {a.summary && <p className="text-xs text-[#86868b] line-clamp-2">{a.summary}</p>}
                                    <p className="text-[10px] text-[#86868b] mt-2">{format(new Date(a.created_at), 'dd/MM/yyyy', { locale: vi })}</p>
                                  </div>
                                </button>
                              ))}
                              {allArticlesList.length === 0 && (
                                <div className="col-span-full text-center py-16"><Newspaper className="h-12 w-12 mx-auto text-[#86868b] mb-3" /><p className="text-sm text-[#86868b]">Chưa có bài viết nào</p></div>
                              )}
                            </div>
                          </div>
                        );
                      case 'latestArticles':
                        return (
                          <div key="latestArticles" className="mb-8">
                            <h3 className="text-lg font-bold mb-4">🆕 Mới nhất</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                              {[...allArticlesList].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 6).map(a => (
                                <button key={a.id} onClick={() => openArticle(a)} className="bg-white rounded-2xl overflow-hidden border border-[#d2d2d7] hover:shadow-lg transition-all text-left group w-full">
                                  {a.thumbnail_url ? <img src={a.thumbnail_url} alt={a.title} className="w-full h-48 object-cover group-hover:scale-[1.02] transition-transform" /> : <div className="w-full h-48 bg-[#f5f5f7] flex items-center justify-center"><Newspaper className="h-10 w-10 text-[#86868b]" /></div>}
                                  <div className="p-5">
                                    <p className="font-semibold text-sm line-clamp-2 mb-2">{a.title}</p>
                                    <p className="text-[10px] text-[#86868b] mt-2">{format(new Date(a.created_at), 'dd/MM/yyyy', { locale: vi })}</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      case 'popularArticles':
                        return (
                          <div key="popularArticles" className="mb-8">
                            <h3 className="text-lg font-bold mb-4">🔥 Phổ biến</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                              {allArticlesList.slice(0, 6).map(a => (
                                <button key={a.id} onClick={() => openArticle(a)} className="bg-white rounded-2xl overflow-hidden border border-[#d2d2d7] hover:shadow-lg transition-all text-left group w-full">
                                  {a.thumbnail_url ? <img src={a.thumbnail_url} alt={a.title} className="w-full h-48 object-cover group-hover:scale-[1.02] transition-transform" /> : <div className="w-full h-48 bg-[#f5f5f7] flex items-center justify-center"><Newspaper className="h-10 w-10 text-[#86868b]" /></div>}
                                  <div className="p-5">
                                    <p className="font-semibold text-sm line-clamp-2 mb-2">{a.title}</p>
                                    <p className="text-[10px] text-[#86868b] mt-2">{format(new Date(a.created_at), 'dd/MM/yyyy', { locale: vi })}</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      default:
                        return null;
                    }
                  })}
                </>
              );
            })()}
          </div>
        )}

        {/* ============ ARTICLE DETAIL ============ */}
        {pageView === 'article-detail' && selectedArticle && (
          <div className="max-w-3xl mx-auto px-4 py-8">
            <div className="flex items-center justify-between mb-6">
              <button onClick={() => navigateTo('news')} className="flex items-center gap-2 text-sm hover:underline" style={{ color: accentColor }}><ArrowLeft className="h-4 w-4" /> Quay lại</button>
              <button onClick={() => copyShareLink('article', selectedArticle.id)} className="flex items-center gap-1.5 text-xs text-[#86868b] hover:text-[#1d1d1f]"><Link2 className="h-3.5 w-3.5" /> Chia sẻ</button>
            </div>
            <article>
              {selectedArticle.thumbnail_url && <img src={selectedArticle.thumbnail_url} alt={selectedArticle.title} className="w-full rounded-2xl object-cover max-h-96 mb-6" />}
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">{selectedArticle.title}</h1>
              <p className="text-xs text-[#86868b] mb-8">{format(new Date(selectedArticle.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })}</p>
              {selectedArticle.content && (
                <div className="prose prose-sm max-w-none [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-2xl [&_a]:underline" style={{ '--tw-prose-links': accentColor } as any}
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedArticle.content) }} />
              )}
            </article>
          </div>
        )}

        {/* ============ WARRANTY PAGE ============ */}
        {pageView === 'warranty' && (
          <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
            <div className="flex items-center gap-3">
              <button onClick={() => navigateTo('home')} className="h-8 w-8 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed]"><ArrowLeft className="h-4 w-4" /></button>
              <h2 className="text-2xl font-bold tracking-tight">Bảo hành</h2>
            </div>
            <div className="bg-[#f5f5f7] rounded-2xl p-5 space-y-4">
              <div className="flex gap-2">
                <Input placeholder="Nhập IMEI hoặc SĐT..." value={searchValue} onChange={e => setSearchValue(e.target.value)} onKeyPress={handleKeyPress} className="flex-1 h-12 text-base rounded-xl border-[#d2d2d7] bg-white" inputMode="tel" />
                <Button onClick={handleSearch} disabled={!searchValue.trim() || isSearching} className="h-12 px-6 rounded-xl" style={{ backgroundColor: accentColor }}>
                  {isSearching ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                </Button>
              </div>
              {warrantyHotline && (
                <a href={`tel:${warrantyHotline}`} className="flex items-center gap-3 p-3 rounded-xl bg-white">
                  <div className="p-2 rounded-full" style={{ backgroundColor: `${accentColor}15` }}><Headphones className="h-4 w-4" style={{ color: accentColor }} /></div>
                  <div><p className="text-[10px] text-[#86868b]">Hotline</p><p className="text-sm font-semibold" style={{ color: accentColor }}>{warrantyHotline}</p></div>
                </a>
              )}
              {supportGroupUrl && (
                <a href={supportGroupUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-xl bg-white">
                  <div className="p-2 rounded-full bg-red-50"><Users className="h-4 w-4 text-red-600" /></div>
                  <p className="text-sm font-semibold text-red-600">Tham gia nhóm hỗ trợ →</p>
                </a>
              )}
            </div>

            {submittedValue && isFetched && (
              <div className="space-y-4">
                {warrantyError ? (
                  <div className="text-center py-12 rounded-2xl bg-red-50">
                    <XCircle className="h-12 w-12 mx-auto text-red-400 mb-3" />
                    <p className="text-sm font-medium text-red-600">Tra cứu thất bại</p>
                  </div>
                ) : warrantyResults && warrantyResults.length > 0 ? (
                  <>
                    <p className="text-xs text-[#86868b] flex items-center gap-1.5"><Package className="h-3.5 w-3.5" /> Tìm thấy {warrantyResults.length} sản phẩm</p>
                    {warrantyResults.map(item => {
                      const ws = calcWarranty(item);
                      return (
                        <div key={item.id} className="bg-white rounded-2xl p-5 space-y-4 border border-[#d2d2d7]">
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
                            <StaffRatingForm staffName={item.staff_name} staffUserId={item.staff_user_id} tenantId={tenantId} branchId={item.branch_id} exportReceiptItemId={item.id} primaryColor={accentColor}
                              defaultCustomerName={item.customer_name || customerName} defaultCustomerPhone={isPhoneSearch ? submittedValue : (item.customer_phone || '')} customerId={item.customer_id || customerId}
                              reviewRewardPoints={reviewRewardPoints} onPointsAwarded={handlePointsAwarded} />
                          )}
                        </div>
                      );
                    })}
                    {customerPoints && customerPoints.is_points_enabled && customerPoints.current_points > 0 && (
                      <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-5 space-y-3">
                        <div className="flex items-center gap-2"><Star className="h-5 w-5 text-amber-500" /><p className="font-bold text-amber-800">Điểm tích lũy</p></div>
                        <div className="flex items-center justify-between bg-white/80 rounded-xl px-4 py-3">
                          <span className="text-sm text-amber-700">Điểm hiện tại:</span>
                          <span className="text-xl font-bold text-amber-600">{formatNumber(customerPoints.current_points)}</span>
                        </div>
                      </div>
                    )}
                    {customerVouchers && customerVouchers.length > 0 && (
                      <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-5 space-y-3">
                        <div className="flex items-center gap-2"><Gift className="h-5 w-5 text-purple-600" /><p className="font-bold text-purple-800">Voucher của bạn</p></div>
                        {customerVouchers.map((v: any) => (
                          <div key={v.id} className="flex items-center justify-between bg-white/80 rounded-xl px-4 py-3">
                            <div><p className="text-sm font-medium text-purple-700">{v.voucher_name}</p><code className="text-xs font-mono text-[#86868b]">{v.code}</code></div>
                            <Badge className="bg-purple-100 text-purple-700 border-0">{v.discount_type === 'percentage' ? `${v.discount_value}%` : `${formatNumber(v.discount_value)}đ`}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-12 rounded-2xl bg-[#f5f5f7]">
                    <XCircle className="h-12 w-12 mx-auto text-[#86868b]/50 mb-3" />
                    <p className="text-sm font-medium text-[#86868b]">Không tìm thấy sản phẩm</p>
                  </div>
                )}
              </div>
            )}
            {submittedValue && warrantyResults && warrantyResults.length > 0 && (
              <button onClick={handleWarrantyLogout} className="w-full py-3 text-xs text-[#86868b] hover:text-[#1d1d1f] border border-dashed border-[#d2d2d7] rounded-xl">Đăng xuất tra cứu</button>
            )}
          </div>
        )}

        {/* ============ SYSTEM PAGES ============ */}
        {(() => {
          const activeNav = navItems.find(n => n.pageView === pageView);
          const sp = {
            accentColor, storeName: displayStoreName, storePhone: warrantyHotline || settings?.store_phone, zaloUrl,
            branches: branches.map(b => ({ id: b.id, name: b.name, address: b.address, phone: b.phone })),
            onNavigateProducts: () => navigateTo('products'), pageItems: activeNav?.pageItems, installmentRates: activeNav?.installmentRates,
          };
          switch (pageView) {
            case 'repair': return <RepairPage {...sp} />;
            case 'tradein': return <TradeInPage {...sp} />;
            case 'installment': return <InstallmentPage {...sp} />;
            case 'pricelist': return <PriceListPage {...sp} />;
            case 'booking': return <BookingPage {...sp} />;
            case 'branches': return <SystemBranchesPage {...sp} />;
            case 'contact': return <ContactPage {...sp} />;
            case 'accessories': return <AccessoriesPage {...sp} />;
            case 'compare': return <ComparePage {...sp} />;
            case 'services': case 'rooms': case 'courses': case 'doctors': case 'collection': case 'promotion': case 'reviews':
              return <GenericSystemPage {...sp} pageId={pageView} pageLabel={activeNav?.label || pageView} />;
            default: return null;
          }
        })()}
      </main>

      <AppleFooter storeName={displayStoreName} accentColor={accentColor} facebookUrl={facebookUrl} zaloUrl={zaloUrl} tiktokUrl={tiktokUrl} />
      <AppleStickyBar accentColor={accentColor} zaloUrl={zaloUrl} warrantyHotline={warrantyHotline} />

      <InstallmentCalculatorDialog open={showInstallmentCalc} onOpenChange={setShowInstallmentCalc} />
    </div>
  );
}
