import { useEffect, useState } from 'react';
import { useWarrantyLookup, WarrantyResult } from '@/hooks/useTenantLanding';
import { readWarrantySession, writeWarrantySession, clearWarrantySession } from '@/lib/warrantySession';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Calendar, CheckCircle2, Loader2, LogOut, Phone, Search, Shield, Users, XCircle } from 'lucide-react';
import { addMonths, differenceInDays, format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface StandaloneWarrantyAppProps {
  tenantId: string | null;
  storeName: string;
  logoUrl?: string | null;
  warrantyHotline?: string | null;
  supportGroupUrl?: string | null;
  storageScopeId: string | null;
}

function getWarrantyStatus(exportDate: string, warrantyMonths: string | null) {
  if (!warrantyMonths) return { status: 'none', label: 'Không BH', color: 'secondary' as const };

  const months = parseInt(warrantyMonths, 10);
  if (Number.isNaN(months) || months <= 0) return { status: 'none', label: 'Không BH', color: 'secondary' as const };

  const expiry = addMonths(new Date(exportDate), months);
  const daysLeft = differenceInDays(expiry, new Date());

  if (daysLeft < 0) return { status: 'expired', label: 'Hết hạn', color: 'destructive' as const };
  if (daysLeft <= 30) return { status: 'expiring', label: `Còn ${daysLeft} ngày`, color: 'outline' as const };
  return { status: 'active', label: `Còn ${daysLeft} ngày`, color: 'default' as const };
}

export function StandaloneWarrantyApp({
  tenantId,
  storeName,
  logoUrl,
  warrantyHotline,
  supportGroupUrl,
  storageScopeId,
}: StandaloneWarrantyAppProps) {
  const warrantyStorageKey = storageScopeId ? `warranty_session_${storageScopeId}` : null;

  const [searchValue, setSearchValue] = useState('');
  const [submittedValue, setSubmittedValue] = useState('');
  const [persistedResults, setPersistedResults] = useState<WarrantyResult[] | null>(null);
  const [lookupEnabled, setLookupEnabled] = useState(false);
  const [restoredSessionKey, setRestoredSessionKey] = useState<string | null>(null);

  const {
    data: results,
    isLoading,
    isFetched,
    error,
  } = useWarrantyLookup(submittedValue, tenantId, { enabled: lookupEnabled });

  useEffect(() => {
    if (!warrantyStorageKey || restoredSessionKey === warrantyStorageKey) return;

    const restored = readWarrantySession<WarrantyResult>(warrantyStorageKey);
    const restoredSearch = restored?.searchValue?.trim() || '';

    if (!restoredSearch) {
      setSearchValue('');
      setSubmittedValue('');
      setPersistedResults(null);
      setLookupEnabled(false);
      setRestoredSessionKey(warrantyStorageKey);
      return;
    }

    setSearchValue(restoredSearch);
    setSubmittedValue(restoredSearch);
    setPersistedResults(restored?.results ?? []);
    setLookupEnabled(false);
    setRestoredSessionKey(warrantyStorageKey);
  }, [restoredSessionKey, warrantyStorageKey]);

  useEffect(() => {
    if (!warrantyStorageKey || !lookupEnabled || !submittedValue || !isFetched || error || !results) return;

    setPersistedResults(results);
    writeWarrantySession(warrantyStorageKey, {
      searchValue: submittedValue,
      results,
    });
    setLookupEnabled(false);
  }, [warrantyStorageKey, lookupEnabled, submittedValue, isFetched, error, results]);

  useEffect(() => {
    if (!lookupEnabled || !isFetched || !error) return;
    if (persistedResults !== null) setLookupEnabled(false);
  }, [lookupEnabled, isFetched, error, persistedResults]);

  const effectiveResults = lookupEnabled && isFetched ? (results ?? []) : (persistedResults ?? []);
  const showResultBlock = !!submittedValue && ((lookupEnabled && isFetched) || persistedResults !== null);
  const showError = !!error && isFetched && (lookupEnabled || persistedResults === null);
  const hasResults = effectiveResults.length > 0;

  const handleSearch = () => {
    const normalized = searchValue.trim();
    if (!normalized) return;

    if (normalized === submittedValue && persistedResults !== null) {
      setLookupEnabled(false);
      return;
    }

    if (normalized !== submittedValue) {
      setPersistedResults(null);
      setSubmittedValue(normalized);
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
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-14 max-w-xl items-center gap-3 px-4">
          {logoUrl ? (
            <img src={logoUrl} alt={storeName} className="h-8 w-8 rounded-md object-cover" loading="lazy" />
          ) : (
            <div className="h-8 w-8 rounded-md bg-primary/10" />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{storeName}</p>
            <p className="text-xs text-muted-foreground">Tra cứu bảo hành</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-4 px-4 py-4">
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex gap-2">
              <Input
                placeholder="Nhập IMEI hoặc SĐT..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="h-12"
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
                <span className="text-sm font-medium text-foreground">Tham gia nhóm hỗ trợ</span>
              </a>
            )}
          </CardContent>
        </Card>

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
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{item.product_name}</p>
                        {item.imei && <p className="mt-1 text-xs text-muted-foreground">IMEI: {item.imei}</p>}
                      </div>
                      <Badge variant={status.color}>
                        {status.status === 'active' && <CheckCircle2 className="mr-1 h-3 w-3" />}
                        {status.label}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>Mua: {format(new Date(item.export_date), 'dd/MM/yyyy', { locale: vi })}</span>
                      </div>
                      {expiry && (
                        <div className="flex items-center gap-1">
                          <Shield className="h-3 w-3" />
                          <span>Hết hạn: {format(expiry, 'dd/MM/yyyy', { locale: vi })}</span>
                        </div>
                      )}
                    </div>

                    {item.note && (
                      <div className="rounded-md border bg-muted/40 p-2 text-xs text-foreground">{item.note}</div>
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
      </main>
    </div>
  );
}
