import { useState, useEffect, useCallback } from 'react';
import DOMPurify from 'dompurify';
import { useParams, useLocation } from 'react-router-dom';
import { usePublicLandingSettings, useWarrantyLookup, useCustomerPointsPublic, WarrantyResult, BranchInfo } from '@/hooks/useTenantLanding';
import { usePublicLandingProducts, LandingProduct } from '@/hooks/useLandingProducts';
import { usePublicLandingArticles, LandingArticle } from '@/hooks/useLandingArticles';
import { useQueryClient } from '@tanstack/react-query';
import { useTenantResolver } from '@/hooks/useTenantResolver';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Search, MapPin, Phone, Mail, Shield, CheckCircle, XCircle,
  Store, Loader2, Building2, Headphones, Calendar, Package,
  Clock, Users, ExternalLink, Star, Gift, User, Globe,
  ChevronDown, ChevronUp, ShoppingBag, Newspaper, ArrowLeft,
  Download, Smartphone, Share, Plus, Apple, MoreVertical
} from 'lucide-react';
import { format, addMonths, isAfter, differenceInDays } from 'date-fns';
import { vi } from 'date-fns/locale';
import { formatNumber } from '@/lib/formatNumber';
import { StaffRatingForm } from '@/components/landing/StaffRatingForm';
import { ProductDetailDialog } from '@/components/landing/ProductDetailDialog';
import StoreReviewsSection from '@/components/landing/StoreReviewsSection';

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

// === Warranty Status ===
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

type PageView = 'home' | 'products' | 'news' | 'warranty' | 'article-detail';

interface StoreLandingPageProps { storeIdFromSubdomain?: string | null; }

export default function StoreLandingPage({ storeIdFromSubdomain }: StoreLandingPageProps) {
  const { storeId: storeIdFromParams } = useParams<{ storeId: string }>();
  const resolvedTenant = useTenantResolver();
  const storeId = storeIdFromSubdomain || storeIdFromParams || resolvedTenant.subdomain;
  const { data: landingData, isLoading } = usePublicLandingSettings(storeId, resolvedTenant.tenantId);
  const queryClient = useQueryClient();

  const [pageView, setPageView] = useState<PageView>('home');
  const [selectedArticle, setSelectedArticle] = useState<LandingArticle | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<LandingProduct | null>(null);

  // Warranty search state - restore from localStorage
  const warrantyStorageKey = storeId ? `warranty_session_${storeId}` : null;
  const savedSession = warrantyStorageKey ? (() => {
    try {
      const raw = localStorage.getItem(warrantyStorageKey);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })() : null;

  const [searchValue, setSearchValue] = useState(savedSession?.searchValue || '');
  const [submittedValue, setSubmittedValue] = useState(savedSession?.searchValue || '');

  const tenantId = landingData?.tenant?.id || null;
  const { data: warrantyResults, isLoading: isSearching, isFetched } = useWarrantyLookup(submittedValue, tenantId);
  const { data: productsData } = usePublicLandingProducts(tenantId);
  const { data: articlesData } = usePublicLandingArticles(tenantId);

  const isPhoneSearch = /^0\d{9,10}$/.test(submittedValue.replace(/\s/g, ''));
  const firstResult = warrantyResults?.[0];
  const customerPhoneFromResult = firstResult?.customer_phone || '';
  const phoneForPoints = isPhoneSearch ? submittedValue : customerPhoneFromResult;
  const { data: customerPoints } = useCustomerPointsPublic(phoneForPoints, tenantId);
  const customerName = firstResult?.customer_name || customerPoints?.customer_name || '';
  const customerId = firstResult?.customer_id || customerPoints?.customer_id || null;
  const reviewRewardPoints = customerPoints?.review_reward_points || 0;

  const handlePointsAwarded = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['customer-points-public'] });
  }, [queryClient]);

  // Save warranty search to localStorage when results arrive
  useEffect(() => {
    if (warrantyStorageKey && submittedValue && warrantyResults && warrantyResults.length > 0) {
      localStorage.setItem(warrantyStorageKey, JSON.stringify({ searchValue: submittedValue }));
    }
  }, [warrantyStorageKey, submittedValue, warrantyResults]);

  // Auto-navigate to warranty page if saved session exists
  useEffect(() => {
    if (savedSession?.searchValue && pageView === 'home') {
      setPageView('warranty');
    }
  }, []);

  const handleWarrantyLogout = () => {
    if (warrantyStorageKey) {
      localStorage.removeItem(warrantyStorageKey);
    }
    setSearchValue('');
    setSubmittedValue('');
    setPageView('home');
  };

  const settings = landingData?.settings;
  const tenant = landingData?.tenant;
  const storeName = settings?.store_name || tenant?.name || storeId || '';
  useDynamicManifest(storeName, storeId, settings?.store_logo_url);

  const handleSearch = () => { 
    if (searchValue.trim()) { 
      setSubmittedValue(searchValue.trim()); 
      if (pageView === 'home') setPageView('warranty');
    } 
  };
  const handleKeyPress = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleSearch(); };

  // Loading / error states
  if (isLoading || (!storeId && resolvedTenant.status === 'loading')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Đang tải...</p>
        </div>
      </div>
    );
  }
  if (!storeId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="max-w-sm w-full"><CardContent className="pt-6 text-center">
          <Store className="h-14 w-14 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">Cửa hàng không tồn tại</h2>
          <p className="text-sm text-muted-foreground">Vui lòng kiểm tra lại đường dẫn.</p>
        </CardContent></Card>
      </div>
    );
  }
  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="max-w-sm w-full"><CardContent className="pt-6 text-center">
          <Store className="h-14 w-14 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">Không tìm thấy cửa hàng</h2>
          <p className="text-sm text-muted-foreground">Cửa hàng "<strong>{storeId}</strong>" không tồn tại hoặc chưa được kích hoạt.</p>
        </CardContent></Card>
      </div>
    );
  }

  const displayStoreName = settings?.store_name || tenant.name;
  const primaryColor = settings?.primary_color || '#0f766e';
  const warrantyHotline = settings?.warranty_hotline;
  const supportGroupUrl = settings?.support_group_url;
  const facebookUrl = settings?.facebook_url;
  const zaloPhone = settings?.zalo_url;
  const zaloUrl = zaloPhone ? (zaloPhone.startsWith('http') ? zaloPhone : `https://zalo.me/${zaloPhone.replace(/\s/g, '')}`) : null;
  const tiktokUrl = settings?.tiktok_url;
  const hasSocialLinks = facebookUrl || zaloUrl || tiktokUrl;
  const branches: BranchInfo[] = landingData?.branches || [];

  const featuredProducts = productsData?.products?.filter(p => p.is_featured) || [];
  const filteredProducts = selectedCategoryId 
    ? productsData?.products?.filter(p => p.category_id === selectedCategoryId) || []
    : productsData?.products || [];
  const featuredArticles = articlesData?.articles?.filter(a => a.is_featured) || [];

  const navigateTo = (view: PageView) => {
    setPageView(view);
    setSelectedArticle(null);
    setSelectedCategoryId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openArticle = (article: LandingArticle) => {
    setSelectedArticle(article);
    setPageView('article-detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/50">
      {/* Header with navigation */}
      <header className="sticky top-0 z-50 shadow-lg" style={{ backgroundColor: primaryColor }}>
        {/* Top bar */}
        <div className="py-3 px-4 text-white">
          <div className="max-w-5xl mx-auto flex items-center gap-3">
            {settings?.store_logo_url ? (
              <img src={settings.store_logo_url} alt={displayStoreName} className="h-10 w-10 rounded-xl object-cover bg-white/20 flex-shrink-0 cursor-pointer" onClick={() => navigateTo('home')} />
            ) : (
              <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0 cursor-pointer" onClick={() => navigateTo('home')}>
                <Store className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0 flex-1 cursor-pointer" onClick={() => navigateTo('home')}>
              <h1 className="text-lg font-bold truncate">{displayStoreName}</h1>
              {settings?.store_description && <p className="text-white/80 text-xs truncate">{settings.store_description}</p>}
            </div>
          </div>
        </div>
        {/* Navigation */}
        <div className="bg-white/10 backdrop-blur-sm border-t border-white/20">
          <div className="max-w-5xl mx-auto flex items-center px-4">
            <nav className="flex items-center gap-1 overflow-x-auto py-1">
              {[
                { id: 'home' as PageView, label: 'Trang chủ' },
                { id: 'products' as PageView, label: 'Sản phẩm', icon: <ShoppingBag className="h-3.5 w-3.5" /> },
                { id: 'news' as PageView, label: 'Tin tức', icon: <Newspaper className="h-3.5 w-3.5" /> },
                { id: 'warranty' as PageView, label: 'Bảo hành', icon: <Shield className="h-3.5 w-3.5" /> },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => navigateTo(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                    pageView === item.id || (item.id === 'news' && pageView === 'article-detail')
                      ? 'bg-white/20 text-white'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-3 py-4">
        {/* HOME PAGE */}
        {pageView === 'home' && (
          <div className="space-y-4">
            {/* Banner */}
            {settings?.show_banner && settings?.banner_image_url && (
              <Card className="overflow-hidden shadow-md">
                {settings.banner_link_url ? (
                  <a href={settings.banner_link_url} target="_blank" rel="noopener noreferrer">
                    <img src={settings.banner_image_url} alt="Banner" className="w-full h-auto object-cover" />
                  </a>
                ) : (
                  <img src={settings.banner_image_url} alt="Banner" className="w-full h-auto object-cover" />
                )}
              </Card>
            )}

            {/* Social links */}
            {hasSocialLinks && (
              <Card className="shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-center justify-center gap-3 flex-wrap">
                    <span className="text-sm text-muted-foreground">Kênh thông tin:</span>
                    <div className="flex items-center gap-2">
                      {facebookUrl && (
                        <a href={facebookUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-100 hover:bg-blue-200 transition-colors">
                          <svg className="h-4 w-4 text-blue-600" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                          <span className="text-sm font-medium text-blue-700">Facebook</span>
                        </a>
                      )}
                      {zaloUrl && (
                        <a href={zaloUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 hover:bg-blue-100 transition-colors">
                          <span className="text-sm font-medium text-blue-600">Zalo</span>
                        </a>
                      )}
                      {tiktokUrl && (
                        <a href={tiktokUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors">
                          <span className="text-sm font-medium text-gray-800">TikTok</span>
                        </a>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Product categories carousel */}
            {productsData && productsData.categories.length > 0 && (
              <div>
                <div className="flex items-center overflow-x-auto gap-3 py-2 px-1">
                  {productsData.categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => { setSelectedCategoryId(cat.id); navigateTo('products'); }}
                      className="flex flex-col items-center gap-1.5 min-w-[80px] p-2 rounded-xl hover:bg-muted/80 transition-colors"
                    >
                      {cat.image_url ? (
                        <img src={cat.image_url} alt={cat.name} className="h-14 w-14 rounded-xl object-cover border" />
                      ) : (
                        <div className="h-14 w-14 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${primaryColor}15` }}>
                          <ShoppingBag className="h-6 w-6" style={{ color: primaryColor }} />
                        </div>
                      )}
                      <span className="text-xs font-medium text-center line-clamp-2">{cat.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Featured products */}
            {featuredProducts.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold" style={{ color: primaryColor }}>SẢN PHẨM TIÊU BIỂU</h2>
                  <Button variant="link" size="sm" onClick={() => navigateTo('products')} className="gap-1 text-xs" style={{ color: primaryColor }}>
                    Xem tất cả →
                  </Button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {featuredProducts.slice(0, 4).map(p => (
                    <Card key={p.id} className="overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedProduct(p)}>
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-full aspect-square object-cover" />
                      ) : (
                        <div className="w-full aspect-square bg-muted flex items-center justify-center">
                          <Package className="h-10 w-10 text-muted-foreground" />
                        </div>
                      )}
                      <CardContent className="p-3">
                        <p className="font-medium text-sm line-clamp-2 min-h-[2.5rem]">{p.name}</p>
                        <div className="mt-1">
                          {p.sale_price ? (
                            <div className="flex flex-col">
                              <span className="text-xs text-muted-foreground line-through">{formatNumber(p.price)}đ</span>
                              <span className="font-bold text-sm text-destructive">{formatNumber(p.sale_price)}đ</span>
                            </div>
                          ) : (
                            <span className="font-bold text-sm" style={{ color: primaryColor }}>{formatNumber(p.price)}đ</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Featured articles */}
            {featuredArticles.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold" style={{ color: primaryColor }}>TIN TỨC MỚI</h2>
                  <Button variant="link" size="sm" onClick={() => navigateTo('news')} className="gap-1 text-xs" style={{ color: primaryColor }}>
                    Xem tất cả →
                  </Button>
                </div>
                <div className="space-y-3">
                  {featuredArticles.slice(0, 3).map(a => (
                    <Card key={a.id} className="overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => openArticle(a)}>
                      <div className="flex gap-3 p-3">
                        {a.thumbnail_url ? (
                          <img src={a.thumbnail_url} alt={a.title} className="h-20 w-28 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="h-20 w-28 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                            <Newspaper className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm line-clamp-2">{a.title}</p>
                          {a.summary && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.summary}</p>}
                          <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(a.created_at), 'dd/MM/yyyy', { locale: vi })}</p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Quick warranty lookup */}
            {(settings?.show_warranty_lookup !== false) && (
              <Card className="shadow-md" style={{ borderTop: `3px solid ${primaryColor}` }}>
                <CardHeader className="pb-2 px-4 pt-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Shield className="h-4 w-4" style={{ color: primaryColor }} />
                    Tra cứu bảo hành
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nhập IMEI hoặc SĐT..."
                      value={searchValue}
                      onChange={e => setSearchValue(e.target.value)}
                      onKeyPress={handleKeyPress}
                      className="flex-1 h-11 text-base"
                      inputMode="tel"
                    />
                    <Button onClick={handleSearch} disabled={!searchValue.trim() || isSearching} className="h-11 px-4" style={{ backgroundColor: primaryColor }}>
                      {isSearching ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                    </Button>
                  </div>
                  <button onClick={() => navigateTo('warranty')} className="text-xs mt-2 underline" style={{ color: primaryColor }}>
                    Xem chi tiết tra cứu bảo hành →
                  </button>
                </CardContent>
              </Card>
            )}

            {/* Install App Guide */}
            <InstallAppSection primaryColor={primaryColor} storeName={displayStoreName || ''} />

            {/* Customer Reviews */}
            {tenantId && <StoreReviewsSection tenantId={tenantId} primaryColor={primaryColor} />}

            {/* Store info */}
            {(settings?.show_store_info !== false) && (settings?.store_address || settings?.store_phone || branches.length > 0) && (
              <StoreInfoSection settings={settings} branches={branches} primaryColor={primaryColor} />
            )}
          </div>
        )}

        {/* PRODUCTS PAGE */}
        {pageView === 'products' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => navigateTo('home')} className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
              <h2 className="text-lg font-bold">Sản phẩm</h2>
            </div>
            {/* Category filter */}
            {productsData && productsData.categories.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                <Button
                  variant={selectedCategoryId === null ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategoryId(null)}
                  style={selectedCategoryId === null ? { backgroundColor: primaryColor } : {}}
                >
                  Tất cả
                </Button>
                {productsData.categories.map(cat => (
                  <Button
                    key={cat.id}
                    variant={selectedCategoryId === cat.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedCategoryId(cat.id)}
                    style={selectedCategoryId === cat.id ? { backgroundColor: primaryColor } : {}}
                    className="whitespace-nowrap"
                  >
                    {cat.name}
                  </Button>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredProducts.map(p => (
                <Card key={p.id} className="overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedProduct(p)}>
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="w-full aspect-square object-cover" />
                  ) : (
                    <div className="w-full aspect-square bg-muted flex items-center justify-center">
                      <Package className="h-10 w-10 text-muted-foreground" />
                    </div>
                  )}
                  <CardContent className="p-3">
                    <p className="font-medium text-sm line-clamp-2 min-h-[2.5rem]">{p.name}</p>
                    <div className="mt-1">
                      {p.sale_price ? (
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground line-through">{formatNumber(p.price)}đ</span>
                          <span className="font-bold text-sm text-destructive">{formatNumber(p.sale_price)}đ</span>
                        </div>
                      ) : (
                        <span className="font-bold text-sm" style={{ color: primaryColor }}>{formatNumber(p.price)}đ</span>
                      )}
                    </div>
                    {p.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>}
                  </CardContent>
                </Card>
              ))}
              {filteredProducts.length === 0 && (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Chưa có sản phẩm nào</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* NEWS PAGE */}
        {pageView === 'news' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => navigateTo('home')} className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
              <h2 className="text-lg font-bold">Tin tức</h2>
            </div>
            {/* Category filter */}
            {articlesData && articlesData.categories.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                <Button
                  variant={selectedCategoryId === null ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategoryId(null)}
                  style={selectedCategoryId === null ? { backgroundColor: primaryColor } : {}}
                >
                  Tất cả
                </Button>
                {articlesData.categories.map(cat => (
                  <Button
                    key={cat.id}
                    variant={selectedCategoryId === cat.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedCategoryId(cat.id)}
                    style={selectedCategoryId === cat.id ? { backgroundColor: primaryColor } : {}}
                    className="whitespace-nowrap"
                  >
                    {cat.name}
                  </Button>
                ))}
              </div>
            )}
            <div className="space-y-3">
              {(selectedCategoryId ? articlesData?.articles?.filter(a => a.category_id === selectedCategoryId) : articlesData?.articles)?.map(a => (
                <Card key={a.id} className="overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => openArticle(a)}>
                  <div className="flex gap-3 p-3">
                    {a.thumbnail_url ? (
                      <img src={a.thumbnail_url} alt={a.title} className="h-20 w-28 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="h-20 w-28 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <Newspaper className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm line-clamp-2">{a.title}</p>
                      {a.summary && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.summary}</p>}
                      <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(a.created_at), 'dd/MM/yyyy', { locale: vi })}</p>
                    </div>
                  </div>
                </Card>
              )) || null}
              {(!articlesData?.articles || articlesData.articles.length === 0) && (
                <div className="text-center py-12 text-muted-foreground">
                  <Newspaper className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Chưa có bài viết nào</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ARTICLE DETAIL */}
        {pageView === 'article-detail' && selectedArticle && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => navigateTo('news')} className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
              <span className="text-sm text-muted-foreground">Quay lại tin tức</span>
            </div>
            <Card className="shadow-md">
              <CardContent className="p-4 sm:p-6">
                {selectedArticle.thumbnail_url && (
                  <img src={selectedArticle.thumbnail_url} alt={selectedArticle.title} className="w-full rounded-lg object-cover max-h-80 mb-4" />
                )}
                <h1 className="text-xl font-bold mb-2">{selectedArticle.title}</h1>
                <p className="text-xs text-muted-foreground mb-4">{format(new Date(selectedArticle.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })}</p>
                {selectedArticle.content && (
                  <div
                    className="prose prose-sm max-w-none [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_a]:text-primary [&_a]:underline"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedArticle.content) }}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* WARRANTY PAGE */}
        {pageView === 'warranty' && (
          <div className="space-y-4 max-w-lg mx-auto">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => navigateTo('home')} className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
              <h2 className="text-lg font-bold">Tra cứu bảo hành</h2>
            </div>
            
            <Card className="shadow-md">
              <CardHeader className="pb-3 px-4 pt-4">
                <CardDescription className="text-xs">Nhập IMEI/Serial hoặc SĐT để kiểm tra</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 px-4 pb-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Nhập IMEI hoặc SĐT..."
                    value={searchValue}
                    onChange={e => setSearchValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="flex-1 h-11 text-base"
                    inputMode="tel"
                  />
                  <Button onClick={handleSearch} disabled={!searchValue.trim() || isSearching} className="h-11 px-4" style={{ backgroundColor: primaryColor }}>
                    {isSearching ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                  </Button>
                </div>

                {/* Hotline & Support */}
                <div className="grid grid-cols-1 gap-2">
                  {warrantyHotline && (
                    <a href={`tel:${warrantyHotline}`} className="flex items-center gap-2.5 p-3 rounded-xl bg-muted/60 active:bg-muted transition-colors">
                      <div className="p-2 rounded-full" style={{ backgroundColor: `${primaryColor}15` }}>
                        <Headphones className="h-4 w-4" style={{ color: primaryColor }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground">Hotline bảo hành</p>
                        <p className="font-semibold text-sm" style={{ color: primaryColor }}>{warrantyHotline}</p>
                      </div>
                      <Phone className="h-4 w-4 text-muted-foreground" />
                    </a>
                  )}
                  {supportGroupUrl && (
                    <a href={supportGroupUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 p-3 rounded-xl bg-gradient-to-r from-red-50 to-red-100 border border-red-200 transition-colors">
                      <div className="p-2 rounded-full bg-red-100"><Users className="h-4 w-4 text-red-600" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-red-600/80">Tham gia nhóm hỗ trợ</p>
                        <p className="font-bold text-sm text-red-600">Nhấn tại đây →</p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-red-600" />
                    </a>
                    )}
                  {warrantyHotline && (
                    <a href={`tel:${warrantyHotline}`} className="flex items-center gap-2.5 p-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-100 border border-amber-200 transition-colors active:opacity-80">
                      <div className="p-2 rounded-full bg-orange-100"><Phone className="h-4 w-4 text-orange-600" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-orange-600">Thu cũ đổi mới - Lên đời</p>
                        <p className="text-xs text-orange-500">Trợ giá siêu tốt • Gọi ngay →</p>
                      </div>
                      <Phone className="h-4 w-4 text-orange-400" />
                    </a>
                  )}
                </div>

                {/* Warranty results */}
                {submittedValue && isFetched && (
                  <div className="space-y-3 pt-2">
                    {warrantyResults && warrantyResults.length > 0 ? (
                      <>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Package className="h-3.5 w-3.5" />
                          <span>Tìm thấy {warrantyResults.length} sản phẩm</span>
                        </div>
                        {warrantyResults.map(item => {
                          const warrantyStatus = calculateWarrantyStatus(item);
                          return (
                            <div key={item.id} className="border rounded-xl p-3.5 space-y-3 bg-card shadow-sm">
                              <div className="flex items-start gap-2">
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-semibold text-sm leading-tight line-clamp-2">{item.product_name}</h3>
                                  {item.imei && <p className="text-xs text-muted-foreground font-mono mt-1">IMEI: {item.imei}</p>}
                                </div>
                                {warrantyStatus && (
                                  <Badge variant={warrantyStatus.valid ? 'default' : 'destructive'} className="flex items-center gap-1 shrink-0 text-xs px-2 py-1">
                                    {warrantyStatus.valid ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                                    {warrantyStatus.message}
                                  </Badge>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-2.5">
                                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                                  <Calendar className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-[10px] text-muted-foreground uppercase">Ngày mua</p>
                                    <p className="text-xs font-medium truncate">{format(new Date(item.export_date), 'dd/MM/yyyy', { locale: vi })}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                                  <Clock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-[10px] text-muted-foreground uppercase">Thời hạn BH</p>
                                    <p className="text-xs font-medium truncate">{item.warranty ? `${item.warranty} tháng` : 'Không BH'}</p>
                                  </div>
                                </div>
                                {warrantyStatus?.endDate && (
                                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                                    <Shield className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                    <div className="min-w-0">
                                      <p className="text-[10px] text-muted-foreground uppercase">BH đến</p>
                                      <p className="text-xs font-medium truncate">{format(warrantyStatus.endDate, 'dd/MM/yyyy', { locale: vi })}</p>
                                    </div>
                                  </div>
                                )}
                                {item.branch_name && (
                                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                                    <Building2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                    <div className="min-w-0">
                                      <p className="text-[10px] text-muted-foreground uppercase">Chi nhánh</p>
                                      <p className="text-xs font-medium truncate">{item.branch_name}</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                              {item.staff_name && item.staff_user_id && tenantId && (
                                <StaffRatingForm
                                  staffName={item.staff_name}
                                  staffUserId={item.staff_user_id}
                                  tenantId={tenantId}
                                  branchId={item.branch_id}
                                  exportReceiptItemId={item.id}
                                  primaryColor={primaryColor}
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
                        {/* Points display */}
                        {customerPoints && customerPoints.is_points_enabled && customerPoints.current_points > 0 && (
                          <div className="border rounded-xl p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 space-y-3">
                            <div className="flex items-center gap-2">
                              <div className="p-2 rounded-full bg-amber-100"><Star className="h-5 w-5 text-amber-600" /></div>
                              <div>
                                <p className="font-bold text-amber-800">Điểm tích lũy của bạn</p>
                                <p className="text-xs text-amber-600">Tổng điểm hiện có</p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/80">
                              <span className="text-sm text-amber-700">Điểm hiện tại:</span>
                              <span className="text-xl font-bold text-amber-600">{formatNumber(customerPoints.current_points)} điểm</span>
                            </div>
                            {customerPoints.redeem_points > 0 && customerPoints.point_value > 0 && (() => {
                              const rawDiscount = Math.floor(customerPoints.current_points / customerPoints.redeem_points) * customerPoints.point_value;
                              const hasMaxLimit = customerPoints.max_redemption_enabled && customerPoints.max_redemption_amount > 0;
                              const finalDiscount = hasMaxLimit ? Math.min(rawDiscount, customerPoints.max_redemption_amount) : rawDiscount;
                              const isCapped = hasMaxLimit && rawDiscount > customerPoints.max_redemption_amount;
                              return (
                                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-100 border border-green-200">
                                  <Gift className="h-5 w-5 text-green-600 flex-shrink-0" />
                                  <div>
                                    <p className="text-sm font-medium text-green-800">Lần mua hàng tiếp theo bạn được giảm:</p>
                                    <p className="text-lg font-bold text-green-600">
                                      {formatNumber(finalDiscount)}đ
                                      {isCapped && <span className="text-xs font-normal text-amber-600 ml-1">(tối đa)</span>}
                                    </p>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-8 border rounded-xl bg-muted/30">
                        <XCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                        <p className="text-sm text-muted-foreground font-medium">Không tìm thấy sản phẩm</p>
                        <p className="text-xs text-muted-foreground mt-1">Kiểm tra lại IMEI/SĐT hoặc liên hệ cửa hàng</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Logout button - only show when there's saved warranty data */}
            {submittedValue && warrantyResults && warrantyResults.length > 0 && (
              <Button
                variant="outline"
                className="w-full gap-2 text-muted-foreground border-dashed"
                onClick={handleWarrantyLogout}
              >
                <XCircle className="h-4 w-4" />
                Đăng xuất tra cứu bảo hành
              </Button>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-4 px-4 mt-4 border-t bg-muted/30">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} {displayStoreName}</p>
          <p className="text-[10px] text-muted-foreground/70 mt-1">Powered by VKHO</p>
        </div>
      </footer>

      {/* Product detail & order dialog */}
      <ProductDetailDialog
        product={selectedProduct}
        open={!!selectedProduct}
        onOpenChange={v => !v && setSelectedProduct(null)}
        tenantId={tenantId || ''}
        branches={branches.map(b => ({ id: b.id, name: b.name }))}
        primaryColor={primaryColor}
        warrantyHotline={warrantyHotline}
      />
    </div>
  );
}

// Store info section component
// === Install App Section ===
function InstallAppSection({ primaryColor, storeName }: { primaryColor: string; storeName: string }) {
  const [isIOS, setIsIOS] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }
  }, []);

  if (isInstalled) return null;

  return (
    <Card className="shadow-md" style={{ borderTop: `3px solid ${primaryColor}` }}>
      <CardHeader className="pb-2 px-4 pt-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${primaryColor}15` }}>
            <Download className="h-4 w-4" style={{ color: primaryColor }} />
          </div>
          Tải ứng dụng
        </CardTitle>
        <CardDescription className="text-xs">
          Cài đặt {storeName} như ứng dụng trên điện thoại
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
        >
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4" style={{ color: primaryColor }} />
            <span className="text-sm font-medium">Hướng dẫn cài đặt {isIOS ? '(iPhone/iPad)' : '(Android)'}</span>
          </div>
          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>

        {isExpanded && (
          <div className="mt-3 space-y-3 px-1">
            {isIOS ? (
              <>
                <Step num={1} title="Mở bằng Safari" desc='Đảm bảo bạn đang dùng trình duyệt Safari' primaryColor={primaryColor} />
                <Step num={2} title="Nhấn nút Chia sẻ" desc='Nhấn biểu tượng chia sẻ (hình vuông có mũi tên lên) ở thanh dưới' icon={<Share className="h-3.5 w-3.5" style={{ color: primaryColor }} />} primaryColor={primaryColor} />
                <Step num={3} title='"Thêm vào MH chính"' desc='Cuộn xuống chọn "Thêm vào Màn hình chính"' icon={<Plus className="h-3.5 w-3.5" style={{ color: primaryColor }} />} primaryColor={primaryColor} />
                <Step num={4} title="Nhấn Thêm" desc='Nhấn "Thêm" ở góc trên bên phải để hoàn tất' primaryColor={primaryColor} />
              </>
            ) : (
              <>
                <Step num={1} title="Mở bằng Chrome" desc='Đảm bảo bạn đang dùng trình duyệt Chrome' primaryColor={primaryColor} />
                <Step num={2} title="Nhấn vào menu ⋮" desc='Nhấn biểu tượng 3 chấm dọc ở góc trên bên phải' icon={<MoreVertical className="h-3.5 w-3.5" style={{ color: primaryColor }} />} primaryColor={primaryColor} />
                <Step num={3} title='"Cài đặt ứng dụng"' desc='Chọn "Cài đặt ứng dụng" hoặc "Thêm vào màn hình chính"' icon={<Download className="h-3.5 w-3.5" style={{ color: primaryColor }} />} primaryColor={primaryColor} />
                <Step num={4} title="Xác nhận" desc='Nhấn "Cài đặt" trong hộp thoại xác nhận' primaryColor={primaryColor} />
              </>
            )}
            <div className="p-3 rounded-lg bg-muted/80 flex items-start gap-2 mt-2">
              <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: primaryColor }} />
              <p className="text-xs text-muted-foreground">
                Sau khi cài đặt, biểu tượng <strong>{storeName}</strong> sẽ xuất hiện trên màn hình chính. Nhấn vào để mở nhanh!
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Step({ num, title, desc, icon, primaryColor }: { num: number; title: string; desc: string; icon?: React.ReactNode; primaryColor: string }) {
  return (
    <div className="flex gap-3">
      <div className="h-6 w-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5" style={{ backgroundColor: primaryColor }}>
        {num}
      </div>
      <div>
        <p className="text-sm font-medium flex items-center gap-1.5">{title} {icon}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}

// === Store Info Section ===
function StoreInfoSection({ settings, branches, primaryColor }: { settings: any; branches: BranchInfo[]; primaryColor: string }) {
  return (
    <Card className="shadow-md">
      <CardHeader className="pb-3 px-4 pt-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${primaryColor}15` }}>
            <Store className="h-4 w-4" style={{ color: primaryColor }} />
          </div>
          Liên hệ
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-4 pb-4">
        {branches.length > 0 ? (
          <div className="space-y-2">
            {branches.map(branch => (
              <div key={branch.id} className="p-3 rounded-xl bg-muted/50 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 flex-shrink-0" style={{ color: primaryColor }} />
                  <p className="font-medium text-sm">{branch.name}</p>
                </div>
                {branch.address && (
                  <div className="flex items-start gap-2 pl-6">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-muted-foreground">{branch.address}</p>
                  </div>
                )}
                {branch.phone && (
                  <a href={`tel:${branch.phone}`} className="flex items-center gap-2 pl-6 hover:text-primary transition-colors">
                    <Phone className="h-3.5 w-3.5 flex-shrink-0" style={{ color: primaryColor }} />
                    <p className="text-xs font-medium" style={{ color: primaryColor }}>{branch.phone}</p>
                  </a>
                )}
              </div>
            ))}
          </div>
        ) : (
          <>
            {settings?.store_address && (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">Địa chỉ</p>
                  <p className="text-sm font-medium">{settings.store_address}</p>
                </div>
              </div>
            )}
            {settings?.additional_addresses?.filter((addr: string) => addr?.trim()).map((addr: string, index: number) => (
              <div key={index} className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">Địa chỉ {index + 2}</p>
                  <p className="text-sm font-medium">{addr}</p>
                </div>
              </div>
            ))}
          </>
        )}
        {settings?.store_phone && (
          <a href={`tel:${settings.store_phone}`} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 active:bg-muted transition-colors">
            <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Điện thoại</p>
              <p className="text-sm font-medium" style={{ color: primaryColor }}>{settings.store_phone}</p>
            </div>
          </a>
        )}
        {settings?.store_email && (
          <a href={`mailto:${settings.store_email}`} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 active:bg-muted transition-colors">
            <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm font-medium truncate" style={{ color: primaryColor }}>{settings.store_email}</p>
            </div>
          </a>
        )}
      </CardContent>
    </Card>
  );
}
