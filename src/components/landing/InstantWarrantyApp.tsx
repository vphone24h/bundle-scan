import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { clearWarrantySession, readWarrantySession, writeWarrantySession } from '@/lib/warrantySession';
import { TenantLandingSettings, WarrantyResult, useCustomerPointsPublic, useWarrantyLookup } from '@/hooks/useTenantLanding';
import { usePublicCustomerVouchers } from '@/hooks/useVouchers';
import { formatNumber } from '@/lib/formatNumber';
import { addMonths, differenceInDays, format } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Gift,
  Headphones,
  Loader2,
  MessageCircle,
  Package,
  Phone,
  Search,
  Shield,
  Users,
} from 'lucide-react';

interface InstantWarrantyAppProps {
  accentColor: string;
  settings: TenantLandingSettings | null;
  showBackButton?: boolean;
  storeId: string | null;
  storeName: string;
  tenantId: string | null;
  onBack?: () => void;
}

function getWarrantyStatus(item: WarrantyResult) {
  const warrantyMonths = parseInt(item.warranty || '0', 10);
  if (!warrantyMonths || warrantyMonths <= 0) {
    return { endDate: null, isActive: false, label: 'Không BH' };
  }

  const endDate = addMonths(new Date(item.export_date), warrantyMonths);
  const daysLeft = differenceInDays(endDate, new Date());

  if (daysLeft < 0) {
    return { endDate, isActive: false, label: 'Hết BH' };
  }

  return { endDate, isActive: true, label: `Còn ${daysLeft} ngày` };
}

export function InstantWarrantyApp({
  accentColor,
  settings,
  showBackButton = false,
  storeId,
  storeName,
  tenantId,
  onBack,
}: InstantWarrantyAppProps) {
  const warrantySessionId = storeId || tenantId || null;
  const warrantyStorageKey = warrantySessionId ? `warranty_session_${warrantySessionId}` : null;
  const [restoredSessionKey, setRestoredSessionKey] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [submittedValue, setSubmittedValue] = useState('');
  const [persistedResults, setPersistedResults] = useState<WarrantyResult[] | null>(null);
  const [lookupEnabled, setLookupEnabled] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  const {
    data: warrantyResults,
    isLoading,
    isFetched,
    error,
  } = useWarrantyLookup(submittedValue, tenantId, { enabled: lookupEnabled });

  useEffect(() => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        (window as any).__hideAppPreloader?.();
      });
    });
  }, []);

  useEffect(() => {
    if (!warrantyStorageKey || restoredSessionKey === warrantyStorageKey) return;

    const restored = readWarrantySession<WarrantyResult>(warrantyStorageKey);
    const restoredSearch = restored?.searchValue?.trim() || '';

    if (restoredSearch) {
      setSearchValue(restoredSearch);
      setSubmittedValue(restoredSearch);
      setPersistedResults(Array.isArray(restored?.results) ? restored.results : []);
    } else {
      setSearchValue('');
      setSubmittedValue('');
      setPersistedResults(null);
    }

    setLookupEnabled(false);
    setRestoredSessionKey(warrantyStorageKey);
  }, [restoredSessionKey, warrantyStorageKey]);

  useEffect(() => {
    if (!warrantyStorageKey || !lookupEnabled || !submittedValue || !isFetched || error || !warrantyResults) return;

    setPersistedResults(warrantyResults);
    writeWarrantySession(warrantyStorageKey, {
      searchValue: submittedValue,
      results: warrantyResults,
    });
    setLookupEnabled(false);

    if (warrantyResults.length > 0) {
      window.setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
    }
  }, [error, isFetched, lookupEnabled, submittedValue, warrantyResults, warrantyStorageKey]);

  useEffect(() => {
    if (!lookupEnabled || !isFetched || !error) return;
    if (persistedResults !== null) {
      setLookupEnabled(false);
    }
  }, [error, isFetched, lookupEnabled, persistedResults]);

  const effectiveResults = lookupEnabled && isFetched ? (warrantyResults ?? []) : (persistedResults ?? []);
  const hasResults = effectiveResults.length > 0;
  const showError = !!error && isFetched && (lookupEnabled || persistedResults === null);
  const showResultBlock = !!submittedValue && ((lookupEnabled && isFetched) || persistedResults !== null);

  const isPhoneSearch = /^0\d{9,10}$/.test(submittedValue.replace(/\s/g, ''));
  const firstResult = effectiveResults[0];
  // OPTIMIZATION: If user searches by phone, fire loyalty/voucher queries IN PARALLEL
  // with warranty lookup (don't wait for warranty result). For IMEI search, wait for result
  // to extract phone, then fetch.
  const phoneForBenefits = isPhoneSearch
    ? submittedValue.replace(/\s/g, '')
    : (firstResult?.customer_phone || '');
  const lookupPhone = phoneForBenefits.replace(/\D/g, '').length > 0 ? phoneForBenefits : '';
  const { data: customerPoints } = useCustomerPointsPublic(lookupPhone, tenantId);
  const { data: customerVouchers } = usePublicCustomerVouchers(lookupPhone, tenantId);

  const zaloUrl = useMemo(() => {
    const value = settings?.zalo_url?.trim();
    if (!value) return null;
    return value.startsWith('http') ? value : `https://zalo.me/${value.replace(/\s/g, '')}`;
  }, [settings?.zalo_url]);

  const handleSearch = () => {
    const trimmed = searchValue.trim();
    if (!trimmed) return;

    if (trimmed === submittedValue && persistedResults !== null) {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (trimmed !== submittedValue) {
      setPersistedResults(null);
      setSubmittedValue(trimmed);
    }

    setLookupEnabled(true);
  };

  const handleLogout = () => {
    clearWarrantySession(warrantyStorageKey);
    setSearchValue('');
    setSubmittedValue('');
    setPersistedResults(null);
    setLookupEnabled(false);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 py-6">
        <div className="mb-6 flex items-center gap-3">
          {showBackButton && onBack ? (
            <button
              onClick={onBack}
              className="flex h-10 w-10 items-center justify-center rounded-full border bg-background text-foreground transition-opacity hover:opacity-80"
              aria-label="Quay lại"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : null}
          <div>
            <p className="text-sm text-muted-foreground">{storeName}</p>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Bảo hành</h1>
          </div>
        </div>

        <Card className="border-border/60 bg-muted/20 shadow-sm">
          <CardContent className="space-y-4 p-4 sm:p-5">
            <div className="flex gap-2">
              <Input
                placeholder="Nhập IMEI hoặc SĐT..."
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && handleSearch()}
                className="h-12 bg-background text-base"
                inputMode="tel"
              />
              <Button onClick={handleSearch} disabled={!searchValue.trim() || isLoading} className="h-12 px-5" style={{ backgroundColor: accentColor }}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>

            {settings?.warranty_hotline ? (
              <a href={`tel:${settings.warranty_hotline}`} className="flex items-center gap-3 rounded-xl border bg-background px-4 py-3">
                <div className="rounded-full p-2" style={{ backgroundColor: `${accentColor}15` }}>
                  <Headphones className="h-4 w-4" style={{ color: accentColor }} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Hotline bảo hành</p>
                  <p className="text-base font-semibold" style={{ color: accentColor }}>{settings.warranty_hotline}</p>
                </div>
              </a>
            ) : null}

            {settings?.support_group_url ? (
              <a href={settings.support_group_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border bg-background px-4 py-3">
                <div className="rounded-full bg-destructive/10 p-2 text-destructive">
                  <Users className="h-4 w-4" />
                </div>
                <p className="font-semibold text-destructive">Tham gia nhóm hỗ trợ →</p>
              </a>
            ) : null}

            {settings?.warranty_description ? (
              <div className="rounded-xl border bg-background p-4">
                <div
                  className="warranty-desc-html text-sm leading-relaxed text-foreground [&_a]:font-semibold [&_a]:underline"
                  dangerouslySetInnerHTML={{ __html: settings.warranty_description }}
                />
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div ref={resultsRef} className="mt-6 space-y-4">
          {showError ? (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardContent className="flex items-center gap-3 p-4 text-destructive">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p className="text-sm">Có lỗi khi tra cứu, vui lòng thử lại.</p>
              </CardContent>
            </Card>
          ) : null}

          {showResultBlock && !showError && !hasResults ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Search className="mx-auto mb-3 h-10 w-10 opacity-30" />
                <p className="font-medium">Không tìm thấy sản phẩm</p>
              </CardContent>
            </Card>
          ) : null}

          {hasResults ? (
            <>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Package className="h-4 w-4" /> Tìm thấy {effectiveResults.length} sản phẩm
              </p>

              {effectiveResults.map((item) => {
                const status = getWarrantyStatus(item);

                return (
                  <Card key={item.id} className="overflow-hidden">
                    <CardContent className="space-y-4 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-semibold text-foreground">{item.product_name}</h3>
                          {item.imei ? <p className="mt-1 font-mono text-xs text-muted-foreground">IMEI: {item.imei}</p> : null}
                        </div>
                        <Badge variant={status.isActive ? 'default' : 'secondary'}>
                          {status.isActive ? <CheckCircle2 className="mr-1 h-3 w-3" /> : null}
                          {status.label}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>Mua: {format(new Date(item.export_date), 'dd/MM/yyyy', { locale: vi })}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Shield className="h-3.5 w-3.5" />
                          <span>{item.warranty ? `${item.warranty} tháng` : 'Không BH'}</span>
                        </div>
                        {status.endDate ? (
                          <div className="col-span-2 flex items-center gap-1.5">
                            <Shield className="h-3.5 w-3.5" />
                            <span>Hết hạn: {format(status.endDate, 'dd/MM/yyyy', { locale: vi })}</span>
                          </div>
                        ) : null}
                        {item.branch_name ? <div className="col-span-2">Chi nhánh: {item.branch_name}</div> : null}
                      </div>

                      {item.note ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                          {item.note}
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                );
              })}

              {customerPoints?.is_points_enabled ? (
                <Card className="border-amber-200 bg-amber-50/70">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-center gap-2 font-semibold text-amber-900">
                      <Gift className="h-4 w-4" /> Điểm tích lũy
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-background px-4 py-3">
                      <span className="text-sm text-muted-foreground">Điểm hiện tại</span>
                      <span className="text-lg font-bold text-foreground">{formatNumber(customerPoints.current_points)}</span>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {customerVouchers && customerVouchers.length > 0 ? (
                <Card>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-center gap-2 font-semibold text-foreground">
                      <Gift className="h-4 w-4" /> Voucher của bạn
                    </div>
                    {customerVouchers.map((voucher) => (
                      <div key={voucher.id} className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-foreground">{voucher.voucher_name}</p>
                          <p className="font-mono text-xs text-muted-foreground">{voucher.code}</p>
                        </div>
                        <Badge variant="outline">{voucher.discount_type === 'percentage' ? `${voucher.discount_value}%` : `${formatNumber(voucher.discount_value)}đ`}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : null}

              <button onClick={handleLogout} className="w-full rounded-xl border border-dashed border-border px-4 py-3 text-xs text-muted-foreground transition-opacity hover:opacity-80">
                Đăng xuất tra cứu bảo hành
              </button>
            </>
          ) : null}
        </div>
      </div>

      {(zaloUrl || settings?.warranty_hotline) ? (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 p-3 backdrop-blur sm:hidden">
          <div className="mx-auto flex max-w-xl gap-2">
            {zaloUrl ? (
              <a
                href={zaloUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white"
                style={{ backgroundColor: accentColor }}
              >
                <MessageCircle className="h-4 w-4" /> Chat Zalo
              </a>
            ) : null}
            {settings?.warranty_hotline ? (
              <a href={`tel:${settings.warranty_hotline}`} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-foreground text-sm font-semibold text-background">
                <Phone className="h-4 w-4" /> Gọi ngay
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}