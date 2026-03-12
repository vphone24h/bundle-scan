import { useEffect, useState, useMemo } from 'react';
import { useWarrantyLookup, useCustomerPointsPublic, WarrantyResult, CustomerPointsPublic } from '@/hooks/useTenantLanding';
import { readWarrantySession, writeWarrantySession, clearWarrantySession } from '@/lib/warrantySession';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle, Calendar, CheckCircle2, Clock, Building2,
  Loader2, LogOut, Phone, Search, Shield, Users, XCircle,
  Store, Newspaper, Heart, User, ShoppingCart, Star,
  Award, Coins,
} from 'lucide-react';
import { addMonths, differenceInDays, format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { LandingProduct, LandingProductCategory } from '@/hooks/useLandingProducts';
import { LandingArticle, LandingArticleCategory } from '@/hooks/useLandingArticles';

interface StandaloneWarrantyAppProps {
  tenantId: string | null;
  storeName: string;
  logoUrl?: string | null;
  warrantyHotline?: string | null;
  supportGroupUrl?: string | null;
  storageScopeId: string | null;
  productsData?: { categories: LandingProductCategory[]; products: LandingProduct[] } | null;
  articlesData?: { categories: LandingArticleCategory[]; articles: LandingArticle[] } | null;
  storePhone?: string | null;
}

type TabId = 'store' | 'news' | 'warranty' | 'account';

function getWarrantyStatus(exportDate: string, warrantyMonths: string | null) {
  if (!warrantyMonths) return { status: 'none', label: 'Không BH', color: 'secondary' as const, daysLeft: 0 };
  const months = parseInt(warrantyMonths, 10);
  if (Number.isNaN(months) || months <= 0) return { status: 'none', label: 'Không BH', color: 'secondary' as const, daysLeft: 0 };
  const expiry = addMonths(new Date(exportDate), months);
  const daysLeft = differenceInDays(expiry, new Date());
  if (daysLeft < 0) return { status: 'expired', label: 'Hết hạn', color: 'destructive' as const, daysLeft };
  if (daysLeft <= 30) return { status: 'expiring', label: `Còn ${daysLeft} ngày`, color: 'outline' as const, daysLeft };
  return { status: 'active', label: `Còn ${daysLeft} ngày`, color: 'default' as const, daysLeft };
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
}

// ─── Warranty Tab Content ───
function WarrantyTabContent({
  tenantId, storeName, logoUrl, warrantyHotline, supportGroupUrl, storageScopeId,
}: Omit<StandaloneWarrantyAppProps, 'productsData' | 'articlesData' | 'storePhone'>) {
  const warrantyStorageKey = storageScopeId ? `warranty_session_${storageScopeId}` : null;
  const [searchValue, setSearchValue] = useState('');
  const [submittedValue, setSubmittedValue] = useState('');
  const [persistedResults, setPersistedResults] = useState<WarrantyResult[] | null>(null);
  const [persistedPoints, setPersistedPoints] = useState<CustomerPointsPublic | null>(null);
  const [lookupEnabled, setLookupEnabled] = useState(false);
  const [restoredSessionKey, setRestoredSessionKey] = useState<string | null>(null);

  const { data: results, isLoading, isFetched, error } = useWarrantyLookup(submittedValue, tenantId, { enabled: lookupEnabled });

  // Extract phone for points lookup
  const phoneForPoints = useMemo(() => {
    const v = submittedValue.replace(/\s/g, '');
    if (/^0\d{9,10}$/.test(v)) return v;
    const firstResult = (lookupEnabled && isFetched ? results : persistedResults)?.[0];
    return firstResult?.customer_phone || '';
  }, [submittedValue, results, persistedResults, lookupEnabled, isFetched]);

  const { data: customerPoints } = useCustomerPointsPublic(phoneForPoints, tenantId);

  // Restore session
  useEffect(() => {
    if (!warrantyStorageKey || restoredSessionKey === warrantyStorageKey) return;
    const restored = readWarrantySession<WarrantyResult & { _points?: CustomerPointsPublic }>(warrantyStorageKey);
    const restoredSearch = restored?.searchValue?.trim() || '';
    if (!restoredSearch) {
      setSearchValue(''); setSubmittedValue(''); setPersistedResults(null); setPersistedPoints(null);
      setLookupEnabled(false); setRestoredSessionKey(warrantyStorageKey); return;
    }
    setSearchValue(restoredSearch);
    setSubmittedValue(restoredSearch);
    setPersistedResults(restored?.results ?? []);
    setPersistedPoints((restored as any)?._points ?? null);
    setLookupEnabled(false);
    setRestoredSessionKey(warrantyStorageKey);
  }, [restoredSessionKey, warrantyStorageKey]);

  // Save results on fetch
  useEffect(() => {
    if (!warrantyStorageKey || !lookupEnabled || !submittedValue || !isFetched || error || !results) return;
    setPersistedResults(results);
    const pointsToSave = customerPoints || persistedPoints;
    setPersistedPoints(pointsToSave);
    writeWarrantySession(warrantyStorageKey, {
      searchValue: submittedValue,
      results,
      _points: pointsToSave,
    } as any);
    setLookupEnabled(false);
  }, [warrantyStorageKey, lookupEnabled, submittedValue, isFetched, error, results, customerPoints, persistedPoints]);

  // Save points separately when they arrive
  useEffect(() => {
    if (!warrantyStorageKey || !customerPoints || !submittedValue) return;
    setPersistedPoints(customerPoints);
    const currentResults = persistedResults ?? [];
    writeWarrantySession(warrantyStorageKey, {
      searchValue: submittedValue,
      results: currentResults,
      _points: customerPoints,
    } as any);
  }, [customerPoints, warrantyStorageKey, submittedValue, persistedResults]);

  useEffect(() => {
    if (!lookupEnabled || !isFetched || !error) return;
    if (persistedResults !== null) setLookupEnabled(false);
  }, [lookupEnabled, isFetched, error, persistedResults]);

  const effectiveResults = lookupEnabled && isFetched ? (results ?? []) : (persistedResults ?? []);
  const effectivePoints = customerPoints || persistedPoints;
  const showResultBlock = !!submittedValue && ((lookupEnabled && isFetched) || persistedResults !== null);
  const showError = !!error && isFetched && (lookupEnabled || persistedResults === null);
  const hasResults = effectiveResults.length > 0;

  const handleSearch = () => {
    const normalized = searchValue.trim();
    if (!normalized) return;
    if (normalized === submittedValue && persistedResults !== null) { setLookupEnabled(false); return; }
    if (normalized !== submittedValue) { setPersistedResults(null); setPersistedPoints(null); setSubmittedValue(normalized); }
    setLookupEnabled(true);
  };

  const handleLogout = () => {
    clearWarrantySession(warrantyStorageKey);
    setSearchValue(''); setSubmittedValue(''); setPersistedResults(null); setPersistedPoints(null); setLookupEnabled(false);
  };

  return (
    <div className="space-y-4 pb-4">
      {/* Search */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex gap-2">
            <Input
              placeholder="Nhập IMEI hoặc SĐT..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="h-12 text-base"
              inputMode="tel"
            />
            <Button onClick={handleSearch} disabled={!searchValue.trim() || isLoading || !tenantId} className="h-12 px-4">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          {warrantyHotline && (
            <a href={`tel:${warrantyHotline}`} className="flex items-center gap-2 rounded-md border p-3">
              <Phone className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Hotline bảo hành</p>
                <p className="text-sm font-semibold text-foreground">{warrantyHotline}</p>
              </div>
            </a>
          )}
          {supportGroupUrl && (
            <a href={supportGroupUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-md border p-3">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Tham gia nhóm hỗ trợ →</span>
            </a>
          )}
        </CardContent>
      </Card>

      {/* Customer Points */}
      {effectivePoints && effectivePoints.is_points_enabled && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Điểm tích lũy</p>
                  <p className="text-lg font-bold text-primary">{effectivePoints.current_points.toLocaleString('vi-VN')}</p>
                </div>
              </div>
              <div className="text-right">
                <Badge variant="outline" className="text-xs">
                  {effectivePoints.membership_tier === 'silver' ? '🥈 Bạc' :
                   effectivePoints.membership_tier === 'gold' ? '🥇 Vàng' :
                   effectivePoints.membership_tier === 'platinum' ? '💎 Bạch kim' :
                   effectivePoints.membership_tier === 'diamond' ? '💠 Kim cương' : '🏷️ Thành viên'}
                </Badge>
                {effectivePoints.customer_name && (
                  <p className="mt-1 text-xs text-muted-foreground">{effectivePoints.customer_name}</p>
                )}
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Coins className="h-3 w-3" />
                <span>Đã tích: {effectivePoints.total_points_earned.toLocaleString('vi-VN')}</span>
              </div>
              <div className="flex items-center gap-1">
                <Star className="h-3 w-3" />
                <span>Đã dùng: {effectivePoints.total_points_used.toLocaleString('vi-VN')}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!tenantId && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-center gap-2 p-3 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <p className="text-xs">Đang kết nối cửa hàng, vui lòng chờ giây lát.</p>
          </CardContent>
        </Card>
      )}

      {showError && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-center gap-2 p-3 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <p className="text-xs">Không thể tải dữ liệu mới, đang giữ kết quả cũ.</p>
          </CardContent>
        </Card>
      )}

      {showResultBlock && !showError && !hasResults && (
        <Card>
          <CardContent className="py-8 text-center">
            <XCircle className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm font-medium">Không tìm thấy kết quả</p>
          </CardContent>
        </Card>
      )}

      {/* Results with FULL info */}
      {hasResults && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Tìm thấy {effectiveResults.length} sản phẩm</p>
          {effectiveResults.map((item) => {
            const status = getWarrantyStatus(item.export_date, item.warranty);
            const months = item.warranty ? parseInt(item.warranty, 10) : 0;
            const expiry = months > 0 ? addMonths(new Date(item.export_date), months) : null;

            return (
              <Card key={item.id}>
                <CardContent className="space-y-3 p-4">
                  {/* Product name + badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">{item.product_name}</p>
                      {item.imei && <p className="mt-1 text-xs text-muted-foreground">IMEI: {item.imei}</p>}
                    </div>
                    <Badge variant={status.color}>
                      {status.status === 'active' && <CheckCircle2 className="mr-1 h-3 w-3" />}
                      {status.label}
                    </Badge>
                  </div>

                  {/* Full details grid */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-2.5">
                      <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-muted-foreground uppercase tracking-wide" style={{ fontSize: '0.65rem' }}>Ngày mua</p>
                        <p className="font-medium text-foreground">{format(new Date(item.export_date), 'dd/MM/yyyy', { locale: vi })}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-2.5">
                      <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-muted-foreground uppercase tracking-wide" style={{ fontSize: '0.65rem' }}>Bảo hành</p>
                        <p className="font-medium text-foreground">{months > 0 ? `${months} tháng` : 'Không BH'}</p>
                      </div>
                    </div>
                    {expiry && (
                      <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-2.5">
                        <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-muted-foreground uppercase tracking-wide" style={{ fontSize: '0.65rem' }}>BH đến</p>
                          <p className="font-medium text-foreground">{format(expiry, 'dd/MM/yyyy', { locale: vi })}</p>
                        </div>
                      </div>
                    )}
                    {item.branch_name && (
                      <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-2.5">
                        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-muted-foreground uppercase tracking-wide" style={{ fontSize: '0.65rem' }}>Chi nhánh</p>
                          <p className="font-medium text-foreground">{item.branch_name}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Note */}
                  {item.note && (
                    <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 p-2.5 text-xs">
                      <span>📝</span>
                      <div>
                        <span className="font-medium text-foreground">Ghi chú: </span>
                        <span className="text-muted-foreground">{item.note}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {(submittedValue || persistedResults) && (
        <Button type="button" variant="outline" className="w-full" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" /> Đăng xuất tra cứu
        </Button>
      )}
    </div>
  );
}

// ─── Store Tab ───
function StoreTabContent({ products, categories }: { products: LandingProduct[]; categories: LandingProductCategory[] }) {
  if (!products || products.length === 0) {
    return (
      <div className="py-12 text-center">
        <Store className="mx-auto mb-2 h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Chưa có sản phẩm</p>
      </div>
    );
  }

  const visibleProducts = products.filter(p => p.is_active);

  return (
    <div className="space-y-4 pb-4">
      <div className="grid grid-cols-2 gap-3">
        {visibleProducts.map((product) => {
          const price = product.variants?.[0]?.price || product.price || 0;
          const isSoldOut = product.is_sold_out;
          return (
            <Card key={product.id} className="overflow-hidden">
              {product.image_url && (
                <div className="aspect-square overflow-hidden">
                  <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" loading="lazy" />
                </div>
              )}
              <CardContent className="p-3">
                <p className="line-clamp-2 text-sm font-medium text-foreground">{product.name}</p>
                <p className="mt-1 text-sm font-bold text-primary">{formatPrice(price)}</p>
                {isSoldOut ? (
                  <Badge variant="destructive" className="mt-2 w-full justify-center">HẾT HÀNG</Badge>
                ) : (
                  <Button size="sm" className="mt-2 w-full text-xs">MUA NGAY</Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─── News Tab ───
function NewsTabContent({ articles }: { articles: LandingArticle[] }) {
  if (!articles || articles.length === 0) {
    return (
      <div className="py-12 text-center">
        <Newspaper className="mx-auto mb-2 h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Chưa có tin tức</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-4">
      {articles.filter(a => a.is_published).map((article) => (
        <Card key={article.id}>
          <CardContent className="flex gap-3 p-3">
            {article.thumbnail_url && (
              <img src={article.thumbnail_url} alt={article.title} className="h-20 w-20 shrink-0 rounded-md object-cover" loading="lazy" />
            )}
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-medium text-foreground">{article.title}</p>
              {article.summary && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{article.summary}</p>}
              <p className="mt-1 text-xs text-muted-foreground">
                {format(new Date(article.created_at), 'dd/MM/yyyy', { locale: vi })}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Account Tab ───
function AccountTabContent({ points, storeName }: { points: CustomerPointsPublic | null; storeName: string }) {
  return (
    <div className="space-y-4 pb-4">
      <Card>
        <CardContent className="p-4 text-center">
          <User className="mx-auto mb-2 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-semibold">{points?.customer_name || 'Khách hàng'}</p>
          <p className="text-xs text-muted-foreground">{storeName}</p>
        </CardContent>
      </Card>
      {points && points.is_points_enabled && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              <p className="text-sm font-semibold">Điểm tích lũy</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md border p-2">
                <p className="text-lg font-bold text-primary">{points.current_points.toLocaleString('vi-VN')}</p>
                <p className="text-xs text-muted-foreground">Hiện có</p>
              </div>
              <div className="rounded-md border p-2">
                <p className="text-lg font-bold text-foreground">{points.total_points_earned.toLocaleString('vi-VN')}</p>
                <p className="text-xs text-muted-foreground">Đã tích</p>
              </div>
              <div className="rounded-md border p-2">
                <p className="text-lg font-bold text-foreground">{points.total_points_used.toLocaleString('vi-VN')}</p>
                <p className="text-xs text-muted-foreground">Đã dùng</p>
              </div>
            </div>
            <div className="text-center">
              <Badge variant="outline">
                {points.membership_tier === 'silver' ? '🥈 Hạng Bạc' :
                 points.membership_tier === 'gold' ? '🥇 Hạng Vàng' :
                 points.membership_tier === 'platinum' ? '💎 Hạng Bạch Kim' :
                 points.membership_tier === 'diamond' ? '💠 Hạng Kim Cương' : '🏷️ Thành viên'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Main App ───
const TABS: { id: TabId; label: string; icon: typeof Store }[] = [
  { id: 'store', label: 'Cửa hàng', icon: Store },
  { id: 'news', label: 'Tin tức', icon: Newspaper },
  { id: 'warranty', label: 'Bảo hành', icon: Heart },
  { id: 'account', label: 'Tài khoản', icon: User },
];

export function StandaloneWarrantyApp({
  tenantId, storeName, logoUrl, warrantyHotline, supportGroupUrl, storageScopeId,
  productsData, articlesData, storePhone,
}: StandaloneWarrantyAppProps) {
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    // If has persisted warranty session, default to warranty tab
    const key = storageScopeId ? `warranty_session_${storageScopeId}` : null;
    if (key) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.searchValue) return 'warranty';
        }
      } catch { /* ignore */ }
    }
    return 'warranty';
  });

  // Read persisted points for account tab
  const [cachedPoints, setCachedPoints] = useState<CustomerPointsPublic | null>(() => {
    const key = storageScopeId ? `warranty_session_${storageScopeId}` : null;
    if (!key) return null;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed?._points ?? null;
      }
    } catch { /* ignore */ }
    return null;
  });

  // Listen for points updates from warranty tab
  useEffect(() => {
    const key = storageScopeId ? `warranty_session_${storageScopeId}` : null;
    if (!key) return;
    const interval = setInterval(() => {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?._points) setCachedPoints(parsed._points);
        }
      } catch { /* ignore */ }
    }, 2000);
    return () => clearInterval(interval);
  }, [storageScopeId]);

  const products = productsData?.products ?? [];
  const categories = productsData?.categories ?? [];
  const articles = articlesData?.articles ?? [];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-14 max-w-xl items-center gap-3 px-4">
          {logoUrl ? (
            <img src={logoUrl} alt={storeName} className="h-8 w-8 rounded-md object-cover" loading="lazy" />
          ) : (
            <div className="h-8 w-8 rounded-md bg-primary/10" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{storeName}</p>
            <p className="text-xs text-muted-foreground">
              {activeTab === 'store' ? 'Cửa hàng' : activeTab === 'news' ? 'Tin tức' : activeTab === 'warranty' ? 'Tra cứu bảo hành' : 'Tài khoản'}
            </p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-4">
        {activeTab === 'warranty' && (
          <WarrantyTabContent
            tenantId={tenantId}
            storeName={storeName}
            logoUrl={logoUrl}
            warrantyHotline={warrantyHotline}
            supportGroupUrl={supportGroupUrl}
            storageScopeId={storageScopeId}
          />
        )}
        {activeTab === 'store' && <StoreTabContent products={products} categories={categories} />}
        {activeTab === 'news' && <NewsTabContent articles={articles} />}
        {activeTab === 'account' && <AccountTabContent points={cachedPoints} storeName={storeName} />}
      </main>

      {/* Bottom Tab Bar */}
      <nav className="sticky bottom-0 z-10 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex max-w-xl">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2 transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[0.65rem] font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
