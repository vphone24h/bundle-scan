import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Warehouse, Loader2, ArrowLeft, Store, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface TenantInfo {
  subdomain: string;
  name: string;
  status: string;
}

export default function ForgotStoreIdPage() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [tenants, setTenants] = useState<TenantInfo[]>([]);
  const [searched, setSearched] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSearched(false);
    setTenants([]);

    try {
      // Look up tenants by email - search in platform_users and tenants
      const { data: platformUsers, error: platformError } = await supabase
        .from('platform_users')
        .select('tenant_id')
        .eq('email', email.toLowerCase().trim());

      if (platformError) throw platformError;

      const tenantIds = platformUsers
        ?.map(pu => pu.tenant_id)
        .filter(Boolean) as string[];

      if (tenantIds && tenantIds.length > 0) {
        const { data: tenantData, error: tenantError } = await supabase
          .from('tenants')
          .select('subdomain, name, status')
          .in('id', tenantIds);

        if (tenantError) throw tenantError;

        setTenants(tenantData || []);
      }

      // Also check tenant owner email
      const { data: ownedTenants, error: ownedError } = await supabase
        .from('tenants')
        .select('subdomain, name, status')
        .eq('email', email.toLowerCase().trim());

      if (!ownedError && ownedTenants) {
        setTenants(prev => {
          const existing = new Set(prev.map(t => t.subdomain));
          const newTenants = ownedTenants.filter(t => !existing.has(t.subdomain));
          return [...prev, ...newTenants];
        });
      }

      setSearched(true);
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể tìm kiếm',
        variant: 'destructive',
      });
    }

    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500">Đang hoạt động</Badge>;
      case 'trial':
        return <Badge variant="secondary">Dùng thử</Badge>;
      case 'expired':
        return <Badge variant="outline" className="text-yellow-600">Hết hạn</Badge>;
      case 'locked':
        return <Badge variant="destructive">Đã khóa</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
              <Store className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl">Quên ID cửa hàng</CardTitle>
          <CardDescription>
            Nhập email để tìm ID cửa hàng của bạn
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email đăng ký</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              Tìm cửa hàng
            </Button>
          </form>

          {searched && (
            <div className="space-y-3">
              {tenants.length > 0 ? (
                <>
                  <p className="text-sm font-medium text-muted-foreground">
                    Tìm thấy {tenants.length} cửa hàng:
                  </p>
                  <div className="space-y-2">
                    {tenants.map((tenant) => (
                      <div
                        key={tenant.subdomain}
                        className="flex items-center justify-between p-3 bg-muted rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{tenant.name}</p>
                          <p className="text-sm text-muted-foreground">
                            ID: <code className="bg-background px-1.5 py-0.5 rounded font-mono">{tenant.subdomain}</code>
                          </p>
                        </div>
                        {getStatusBadge(tenant.status)}
                      </div>
                    ))}
                  </div>
                  <Button className="w-full" asChild>
                    <Link to="/auth">Đăng nhập ngay</Link>
                  </Button>
                </>
              ) : (
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-muted-foreground">
                    Không tìm thấy cửa hàng nào với email này.
                  </p>
                  <Button variant="link" className="mt-2" asChild>
                    <Link to="/register">Đăng ký cửa hàng mới</Link>
                  </Button>
                </div>
              )}
            </div>
          )}

          <Button variant="ghost" className="w-full" asChild>
            <Link to="/auth">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Quay lại đăng nhập
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
