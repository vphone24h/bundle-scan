import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { usePublicLandingSettings, useWarrantyLookup, WarrantyResult } from '@/hooks/useTenantLanding';
import { useTenantResolver } from '@/hooks/useTenantResolver';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  MapPin, 
  Phone, 
  Mail, 
  Shield, 
  CheckCircle, 
  XCircle,
  Store,
  Loader2,
  Building2,
  Headphones,
  Calendar,
  Package,
  Clock,
  Users,
  ExternalLink
} from 'lucide-react';
import { format, addMonths, isAfter, differenceInDays } from 'date-fns';
import { vi } from 'date-fns/locale';

interface WarrantyStatus {
  valid: boolean;
  message: string;
  endDate: Date | null;
  startDate: Date;
  months: number;
  daysLeft?: number;
}

function calculateWarrantyStatus(item: WarrantyResult): WarrantyStatus | null {
  const saleDate = new Date(item.export_date);
  const warrantyMonths = parseInt(item.warranty || '0', 10);
  
  if (!warrantyMonths || warrantyMonths <= 0) {
    return { valid: false, message: 'Không BH', endDate: null, startDate: saleDate, months: 0 };
  }
  
  const endDate = addMonths(saleDate, warrantyMonths);
  const isValid = isAfter(endDate, new Date());
  const daysLeft = isValid ? differenceInDays(endDate, new Date()) : 0;
  
  return {
    valid: isValid,
    message: isValid ? `Còn ${daysLeft} ngày` : 'Hết BH',
    endDate,
    startDate: saleDate,
    months: warrantyMonths,
    daysLeft,
  };
}

interface StoreLandingPageProps {
  storeIdFromSubdomain?: string | null;
}

export default function StoreLandingPage({ storeIdFromSubdomain }: StoreLandingPageProps) {
  const { storeId: storeIdFromParams } = useParams<{ storeId: string }>();
  const resolvedTenant = useTenantResolver();
  
  const storeId = storeIdFromSubdomain || storeIdFromParams || resolvedTenant.subdomain;
  
  const { data: landingData, isLoading } = usePublicLandingSettings(storeId);
  
  const [searchValue, setSearchValue] = useState('');
  const [submittedValue, setSubmittedValue] = useState('');
  
  const tenantId = landingData?.tenant?.id || null;
  const { data: warrantyResults, isLoading: isSearching, isFetched } = useWarrantyLookup(submittedValue, tenantId);
  
  const settings = landingData?.settings;
  const tenant = landingData?.tenant;

  const handleSearch = () => {
    if (searchValue.trim()) {
      setSubmittedValue(searchValue.trim());
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Loading state
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

  // Không có store ID
  if (!storeId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="max-w-sm w-full">
          <CardContent className="pt-6 text-center">
            <Store className="h-14 w-14 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">Cửa hàng không tồn tại</h2>
            <p className="text-sm text-muted-foreground">
              Vui lòng kiểm tra lại đường dẫn.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Không tìm thấy tenant
  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="max-w-sm w-full">
          <CardContent className="pt-6 text-center">
            <Store className="h-14 w-14 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">Không tìm thấy cửa hàng</h2>
            <p className="text-sm text-muted-foreground">
              Cửa hàng "<strong>{storeId}</strong>" không tồn tại hoặc chưa được kích hoạt.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const storeName = settings?.store_name || tenant.name;
  const primaryColor = settings?.primary_color || '#0f766e';
  const warrantyHotline = settings?.warranty_hotline;
  const supportGroupUrl = settings?.support_group_url;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/50">
      {/* Header - Mobile optimized */}
      <header 
        className="sticky top-0 z-50 py-3 px-4 text-white shadow-lg"
        style={{ backgroundColor: primaryColor }}
      >
        <div className="max-w-lg mx-auto flex items-center gap-3">
          {settings?.store_logo_url ? (
            <img 
              src={settings.store_logo_url} 
              alt={storeName} 
              className="h-10 w-10 rounded-xl object-cover bg-white/20 flex-shrink-0"
            />
          ) : (
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <Store className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold truncate">{storeName}</h1>
            {settings?.store_description && (
              <p className="text-white/80 text-xs truncate">{settings.store_description}</p>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-3 py-4 space-y-4">
        {/* Banner - Mobile optimized */}
        {settings?.show_banner && settings?.banner_image_url && (
          <Card className="overflow-hidden shadow-md">
            {settings.banner_link_url ? (
              <a href={settings.banner_link_url} target="_blank" rel="noopener noreferrer">
                <img 
                  src={settings.banner_image_url} 
                  alt="Banner" 
                  className="w-full h-auto object-cover"
                />
              </a>
            ) : (
              <img 
                src={settings.banner_image_url} 
                alt="Banner" 
                className="w-full h-auto object-cover"
              />
            )}
          </Card>
        )}

        {/* Tra cứu bảo hành - Mobile optimized */}
        {(settings?.show_warranty_lookup !== false) && (
          <Card className="shadow-md">
            <CardHeader className="pb-3 px-4 pt-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <div 
                  className="p-1.5 rounded-lg"
                  style={{ backgroundColor: `${primaryColor}15` }}
                >
                  <Shield className="h-4 w-4" style={{ color: primaryColor }} />
                </div>
                Tra cứu bảo hành
              </CardTitle>
              <CardDescription className="text-xs">
                Nhập IMEI/Serial hoặc SĐT để kiểm tra
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4">
              {/* Search box - Full width on mobile */}
              <div className="flex gap-2">
                <Input
                  placeholder="Nhập IMEI hoặc SĐT..."
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="flex-1 h-11 text-base"
                  inputMode="tel"
                />
                <Button 
                  onClick={handleSearch}
                  disabled={!searchValue.trim() || isSearching}
                  className="h-11 px-4"
                  style={{ backgroundColor: primaryColor }}
                >
                  {isSearching ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Search className="h-5 w-5" />
                  )}
                </Button>
              </div>

              {/* Hotline & Support Group - Mobile friendly */}
              <div className="grid grid-cols-1 gap-2">
                {warrantyHotline && (
                  <a 
                    href={`tel:${warrantyHotline}`}
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-muted/60 active:bg-muted transition-colors"
                  >
                    <div 
                      className="p-2 rounded-full"
                      style={{ backgroundColor: `${primaryColor}15` }}
                    >
                      <Headphones className="h-4 w-4" style={{ color: primaryColor }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Hotline bảo hành</p>
                      <p 
                        className="font-semibold text-sm"
                        style={{ color: primaryColor }}
                      >
                        {warrantyHotline}
                      </p>
                    </div>
                    <Phone className="h-4 w-4 text-muted-foreground" />
                  </a>
                )}
                
                {supportGroupUrl && (
                  <a 
                    href={supportGroupUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-gradient-to-r from-red-50 to-red-100 border border-red-200 active:bg-red-100 transition-colors"
                  >
                    <div className="p-2 rounded-full bg-red-100">
                      <Users className="h-4 w-4 text-red-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-red-600/80">Tham gia nhóm hỗ trợ</p>
                      <p className="font-bold text-sm text-red-600">
                        Nhấn tại đây →
                      </p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-red-600" />
                  </a>
                )}
              </div>

              {/* Kết quả tra cứu - Mobile cards */}
              {submittedValue && isFetched && (
                <div className="space-y-3 pt-2">
                  {warrantyResults && warrantyResults.length > 0 ? (
                    <>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Package className="h-3.5 w-3.5" />
                        <span>Tìm thấy {warrantyResults.length} sản phẩm</span>
                      </div>
                      
                      {warrantyResults.map((item) => {
                        const warrantyStatus = calculateWarrantyStatus(item);
                        
                        return (
                          <div 
                            key={item.id} 
                            className="border rounded-xl p-3.5 space-y-3 bg-card shadow-sm"
                          >
                            {/* Product header */}
                            <div className="flex items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-sm leading-tight line-clamp-2">
                                  {item.product_name}
                                </h3>
                                {item.imei && (
                                  <p className="text-xs text-muted-foreground font-mono mt-1">
                                    IMEI: {item.imei}
                                  </p>
                                )}
                              </div>
                              {warrantyStatus && (
                                <Badge 
                                  variant={warrantyStatus.valid ? "default" : "destructive"}
                                  className="flex items-center gap-1 shrink-0 text-xs px-2 py-1"
                                >
                                  {warrantyStatus.valid ? (
                                    <CheckCircle className="h-3 w-3" />
                                  ) : (
                                    <XCircle className="h-3 w-3" />
                                  )}
                                  {warrantyStatus.message}
                                </Badge>
                              )}
                            </div>
                            
                            {/* Info grid - 2 columns on mobile */}
                            <div className="grid grid-cols-2 gap-2.5">
                              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                                <Calendar className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-[10px] text-muted-foreground uppercase">Ngày mua</p>
                                  <p className="text-xs font-medium truncate">
                                    {format(new Date(item.export_date), 'dd/MM/yyyy', { locale: vi })}
                                  </p>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                                <Clock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-[10px] text-muted-foreground uppercase">Thời hạn BH</p>
                                  <p className="text-xs font-medium truncate">
                                    {item.warranty ? `${item.warranty} tháng` : 'Không BH'}
                                  </p>
                                </div>
                              </div>
                              
                              {warrantyStatus?.endDate && (
                                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                                  <Shield className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-[10px] text-muted-foreground uppercase">BH đến</p>
                                    <p className="text-xs font-medium truncate">
                                      {format(warrantyStatus.endDate, 'dd/MM/yyyy', { locale: vi })}
                                    </p>
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
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    <div className="text-center py-8 border rounded-xl bg-muted/30">
                      <XCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                      <p className="text-sm text-muted-foreground font-medium">
                        Không tìm thấy sản phẩm
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 px-4">
                        Kiểm tra lại IMEI/SĐT hoặc liên hệ cửa hàng
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Thông tin cửa hàng - Mobile optimized */}
        {(settings?.show_store_info !== false) && (settings?.store_address || settings?.store_phone || settings?.store_email) && (
          <Card className="shadow-md">
            <CardHeader className="pb-3 px-4 pt-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <div 
                  className="p-1.5 rounded-lg"
                  style={{ backgroundColor: `${primaryColor}15` }}
                >
                  <Store className="h-4 w-4" style={{ color: primaryColor }} />
                </div>
                Liên hệ
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-4 pb-4">
              {settings?.store_address && (
                <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">Địa chỉ</p>
                    <p className="text-sm font-medium">{settings.store_address}</p>
                  </div>
                </div>
              )}
              
              {settings?.store_phone && (
                <a 
                  href={`tel:${settings.store_phone}`}
                  className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 active:bg-muted transition-colors"
                >
                  <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">Điện thoại</p>
                    <p 
                      className="text-sm font-medium"
                      style={{ color: primaryColor }}
                    >
                      {settings.store_phone}
                    </p>
                  </div>
                  <Phone className="h-4 w-4" style={{ color: primaryColor }} />
                </a>
              )}
              
              {settings?.store_email && (
                <a 
                  href={`mailto:${settings.store_email}`}
                  className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 active:bg-muted transition-colors"
                >
                  <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p 
                      className="text-sm font-medium truncate"
                      style={{ color: primaryColor }}
                    >
                      {settings.store_email}
                    </p>
                  </div>
                </a>
              )}
            </CardContent>
          </Card>
        )}
      </main>

      {/* Footer - Compact for mobile */}
      <footer className="py-4 px-4 mt-4 border-t bg-muted/30">
        <div className="max-w-lg mx-auto text-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {storeName}
          </p>
          <p className="text-[10px] text-muted-foreground/70 mt-1">
            Powered by VKHO
          </p>
        </div>
      </footer>
    </div>
  );
}