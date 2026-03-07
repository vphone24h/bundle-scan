import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import vkhoLogo from '@/assets/vkho-logo.png';
import { Shield, Search, Package, Calendar, Store, Phone, ArrowLeft, Loader2, AlertCircle, CheckCircle2, MessageSquareText } from 'lucide-react';
import { format, differenceInDays, addMonths } from 'date-fns';
import { vi } from 'date-fns/locale';

function getClientIp() {
  return fetch('https://api.ipify.org?format=json')
    .then(r => r.json())
    .then(d => {
      const ip = typeof d?.ip === 'string' ? d.ip.trim() : '';
      return ip && ip.toLowerCase() !== 'unknown' ? ip : null;
    })
    .catch(() => null);
}

interface WarrantyItem {
  id: string;
  imei: string;
  product_name: string;
  sku: string | null;
  warranty: string | null;
  sale_price: number;
  created_at: string;
  branch_name: string | null;
  export_date: string;
  store_name: string;
  tenant_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  note: string | null;
}

function getWarrantyStatus(exportDate: string, warrantyMonths: string | null) {
  if (!warrantyMonths) return { status: 'none', label: 'Không BH', color: 'secondary' as const };
  const months = parseInt(warrantyMonths);
  if (isNaN(months) || months <= 0) return { status: 'none', label: 'Không BH', color: 'secondary' as const };
  
  const expiry = addMonths(new Date(exportDate), months);
  const daysLeft = differenceInDays(expiry, new Date());
  
  if (daysLeft < 0) return { status: 'expired', label: 'Hết hạn', color: 'destructive' as const };
  if (daysLeft <= 30) return { status: 'expiring', label: `Còn ${daysLeft} ngày`, color: 'outline' as const };
  return { status: 'active', label: `Còn ${daysLeft} ngày`, color: 'default' as const };
}

export default function WarrantyCheckPage() {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [searchValue, setSearchValue] = useState('');

  const { data: results, isLoading, error } = useQuery({
    queryKey: ['global-warranty', searchValue],
    queryFn: async (): Promise<WarrantyItem[]> => {
      if (!searchValue) return [];
      const compact = searchValue.replace(/\s+/g, '');
      const clientIp = await getClientIp();
      const isPhone = /^0\d{9,10}$/.test(compact);

      const { data, error } = await supabase.rpc(
        isPhone ? 'global_warranty_lookup_by_phone' : 'global_warranty_lookup_by_imei',
        isPhone
          ? { _phone: compact, _ip_address: clientIp }
          : { _imei: compact, _ip_address: clientIp }
      );
      if (error) throw error;
      return (data || []) as WarrantyItem[];
    },
    enabled: !!searchValue,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  const handleSearch = () => {
    const v = input.trim();
    if (v) setSearchValue(v);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img src={vkhoLogo} alt="vkho.vn" className="h-8 w-8 rounded-lg" />
            <span className="font-bold text-primary">vkho.vn</span>
          </button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Trang chủ
          </Button>
        </div>
      </header>

      {/* Hero search */}
      <section className="py-12 sm:py-20">
        <div className="container mx-auto px-4 max-w-xl text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 mb-6">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
            Tra cứu bảo hành
          </h1>
          <p className="text-muted-foreground mb-8">
            Nhập số IMEI hoặc số điện thoại mua hàng để kiểm tra thông tin bảo hành
          </p>

          <div className="flex gap-2">
            <Input
              placeholder="Nhập IMEI hoặc SĐT (VD: 0912345678)"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="h-12 text-base"
            />
            <Button onClick={handleSearch} disabled={!input.trim() || isLoading} className="h-12 px-6">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          <div className="flex gap-4 justify-center mt-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Package className="h-3 w-3" /> IMEI / Số seri</span>
            <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> Số điện thoại</span>
          </div>
        </div>
      </section>

      {/* Results */}
      <section className="pb-20">
        <div className="container mx-auto px-4 max-w-2xl">
          {error && (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="p-4 flex items-center gap-3 text-destructive">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p className="text-sm">
                  {String(error).includes('Rate limit') ? 'Bạn đã tra cứu quá nhiều lần. Vui lòng thử lại sau.' : 'Có lỗi xảy ra, vui lòng thử lại.'}
                </p>
              </CardContent>
            </Card>
          )}

          {searchValue && !isLoading && !error && results?.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Search className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Không tìm thấy kết quả</p>
                <p className="text-sm mt-1">Kiểm tra lại IMEI hoặc số điện thoại và thử lại</p>
              </CardContent>
            </Card>
          )}

          {results && results.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground mb-4">
                Tìm thấy <strong>{results.length}</strong> sản phẩm
              </p>
              {results.map(item => {
                const ws = getWarrantyStatus(item.export_date, item.warranty);
                const warrantyMonths = item.warranty ? parseInt(item.warranty) : 0;
                const expiryDate = warrantyMonths > 0 ? addMonths(new Date(item.export_date), warrantyMonths) : null;

                return (
                  <Card key={item.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-sm truncate">{item.product_name}</h3>
                          {item.imei && (
                            <p className="text-xs text-muted-foreground font-mono mt-0.5">IMEI: {item.imei}</p>
                          )}
                        </div>
                        <Badge variant={ws.color} className="shrink-0">
                          {ws.status === 'active' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                          {ws.label}
                        </Badge>
                      </div>

                      {item.note && (
                        <div className="mt-3 p-2.5 rounded-md bg-amber-50 border border-amber-200">
                          <div className="flex gap-2 text-xs">
                            <MessageSquareText className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                            <span className="text-amber-800">{item.note}</span>
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3 w-3" />
                          <span>Mua: {format(new Date(item.export_date), 'dd/MM/yyyy', { locale: vi })}</span>
                        </div>
                        {expiryDate && (
                          <div className="flex items-center gap-1.5">
                            <Shield className="h-3 w-3" />
                            <span>HH BH: {format(expiryDate, 'dd/MM/yyyy', { locale: vi })}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <Store className="h-3 w-3" />
                          <span className="truncate">{item.store_name || 'Cửa hàng'}</span>
                        </div>
                        {item.branch_name && (
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="truncate">CN: {item.branch_name}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
