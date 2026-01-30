import { useState, useMemo } from 'react';
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
  Headphones
} from 'lucide-react';
import { format, addMonths, isAfter } from 'date-fns';
import { vi } from 'date-fns/locale';

interface WarrantyStatus {
  valid: boolean;
  message: string;
  endDate: Date | null;
  startDate: Date;
  months: number;
}

function calculateWarrantyStatus(item: WarrantyResult): WarrantyStatus | null {
  const saleDate = new Date(item.export_date);
  const warrantyMonths = parseInt(item.warranty || '0', 10);
  
  if (!warrantyMonths || warrantyMonths <= 0) {
    return { valid: false, message: 'Không có BH', endDate: null, startDate: saleDate, months: 0 };
  }
  
  const endDate = addMonths(saleDate, warrantyMonths);
  const isValid = isAfter(endDate, new Date());
  
  return {
    valid: isValid,
    message: isValid ? 'Còn BH' : 'Hết BH',
    endDate,
    startDate: saleDate,
    months: warrantyMonths,
  };
}

export default function StoreLandingPage() {
  const resolvedTenant = useTenantResolver();
  const { data: landingData, isLoading } = usePublicLandingSettings(resolvedTenant.subdomain);
  
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
  if (resolvedTenant.status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Không tìm thấy tenant hoặc landing page chưa được bật
  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Store className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Không tìm thấy cửa hàng</h2>
            <p className="text-muted-foreground">
              Cửa hàng này không tồn tại hoặc chưa được kích hoạt.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const storeName = settings?.store_name || tenant.name;
  const primaryColor = settings?.primary_color || '#0f766e';
  const warrantyHotline = (settings as any)?.warranty_hotline;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      {/* Header */}
      <header 
        className="py-6 px-4 text-white"
        style={{ backgroundColor: primaryColor }}
      >
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          {settings?.store_logo_url && (
            <img 
              src={settings.store_logo_url} 
              alt={storeName} 
              className="h-12 w-12 rounded-lg object-cover bg-white/10"
            />
          )}
          <div>
            <h1 className="text-2xl font-bold">{storeName}</h1>
            {settings?.store_description && (
              <p className="text-white/80 text-sm mt-1">{settings.store_description}</p>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Banner */}
        {settings?.show_banner && settings?.banner_image_url && (
          <Card className="overflow-hidden">
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

        {/* Tra cứu bảo hành */}
        {(settings?.show_warranty_lookup !== false) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" style={{ color: primaryColor }} />
                Tra cứu bảo hành
              </CardTitle>
              <CardDescription>
                Nhập số IMEI/Serial hoặc SĐT để kiểm tra thông tin bảo hành
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Nhập IMEI hoặc Số điện thoại..."
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="flex-1"
                />
                <Button 
                  onClick={handleSearch}
                  disabled={!searchValue.trim() || isSearching}
                  style={{ backgroundColor: primaryColor }}
                >
                  {isSearching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Hotline bảo hành */}
              {warrantyHotline && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                  <Headphones className="h-5 w-5 text-muted-foreground" />
                  <div className="text-sm">
                    <span className="text-muted-foreground">Hotline bảo hành: </span>
                    <a 
                      href={`tel:${warrantyHotline}`}
                      className="font-semibold hover:underline"
                      style={{ color: primaryColor }}
                    >
                      {warrantyHotline}
                    </a>
                  </div>
                </div>
              )}

              {/* Kết quả tra cứu */}
              {submittedValue && isFetched && (
                <div className="mt-4 space-y-3">
                  {warrantyResults && warrantyResults.length > 0 ? (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Tìm thấy {warrantyResults.length} sản phẩm
                      </p>
                      {warrantyResults.map((item) => {
                        const warrantyStatus = calculateWarrantyStatus(item);
                        
                        return (
                          <div key={item.id} className="border rounded-lg p-4 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="font-semibold">{item.product_name}</h3>
                              {warrantyStatus && (
                                <Badge 
                                  variant={warrantyStatus.valid ? "default" : "destructive"}
                                  className="flex items-center gap-1 shrink-0"
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
                            
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              {item.imei && (
                                <div>
                                  <span className="text-muted-foreground">IMEI/Serial:</span>
                                  <p className="font-medium font-mono">{item.imei}</p>
                                </div>
                              )}
                              <div>
                                <span className="text-muted-foreground">Mã SP:</span>
                                <p className="font-medium">{item.sku}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Ngày mua:</span>
                                <p className="font-medium">
                                  {format(new Date(item.export_date), 'dd/MM/yyyy', { locale: vi })}
                                </p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Thời hạn BH:</span>
                                <p className="font-medium">
                                  {item.warranty ? `${item.warranty} tháng` : 'Không có'}
                                </p>
                              </div>
                              {warrantyStatus?.endDate && (
                                <div>
                                  <span className="text-muted-foreground">BH đến:</span>
                                  <p className="font-medium">
                                    {format(warrantyStatus.endDate, 'dd/MM/yyyy', { locale: vi })}
                                  </p>
                                </div>
                              )}
                              {item.branch_name && (
                                <div>
                                  <span className="text-muted-foreground flex items-center gap-1">
                                    <Building2 className="h-3 w-3" />
                                    Chi nhánh:
                                  </span>
                                  <p className="font-medium">{item.branch_name}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    <div className="text-center py-6 border rounded-lg">
                      <XCircle className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">
                        Không tìm thấy sản phẩm với: <strong>{submittedValue}</strong>
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Vui lòng kiểm tra lại số IMEI/SĐT hoặc liên hệ cửa hàng
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Thông tin cửa hàng */}
        {(settings?.show_store_info !== false) && (settings?.store_address || settings?.store_phone || settings?.store_email) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5" style={{ color: primaryColor }} />
                Thông tin liên hệ
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {settings?.store_address && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Địa chỉ</p>
                    <p className="text-muted-foreground">{settings.store_address}</p>
                  </div>
                </div>
              )}
              {settings?.store_phone && (
                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Điện thoại</p>
                    <a 
                      href={`tel:${settings.store_phone}`}
                      className="hover:underline"
                      style={{ color: primaryColor }}
                    >
                      {settings.store_phone}
                    </a>
                  </div>
                </div>
              )}
              {settings?.store_email && (
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Email</p>
                    <a 
                      href={`mailto:${settings.store_email}`}
                      className="hover:underline"
                      style={{ color: primaryColor }}
                    >
                      {settings.store_email}
                    </a>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>

      {/* Footer */}
      <footer className="py-6 px-4 mt-8 border-t bg-muted/50">
        <div className="max-w-4xl mx-auto text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} {storeName}. Powered by VKHO.</p>
        </div>
      </footer>
    </div>
  );
}
