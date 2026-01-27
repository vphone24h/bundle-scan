import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Warehouse, Loader2, ArrowLeft, CheckCircle } from 'lucide-react';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [tenantInfo, setTenantInfo] = useState<{ subdomain: string } | null>(null);

  const [formData, setFormData] = useState({
    businessName: '',
    subdomain: '',
    adminName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'subdomain' ? value.toLowerCase().replace(/[^a-z0-9-]/g, '') : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: 'Lỗi',
        description: 'Mật khẩu xác nhận không khớp',
        variant: 'destructive',
      });
      return;
    }

    if (formData.password.length < 6) {
      toast({
        title: 'Lỗi',
        description: 'Mật khẩu phải có ít nhất 6 ký tự',
        variant: 'destructive',
      });
      return;
    }

    if (formData.subdomain.length < 3) {
      toast({
        title: 'Lỗi',
        description: 'Tên miền phụ phải có ít nhất 3 ký tự',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('register-tenant', {
        body: {
          businessName: formData.businessName,
          subdomain: formData.subdomain,
          adminName: formData.adminName,
          email: formData.email,
          password: formData.password,
          phone: formData.phone,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setTenantInfo({ subdomain: data.tenant.subdomain });
      setSuccess(true);
      
      toast({
        title: 'Đăng ký thành công!',
        description: 'Tài khoản doanh nghiệp của bạn đã được tạo.',
      });

    } catch (error: any) {
      console.error('Registration error:', error);
      toast({
        title: 'Đăng ký thất bại',
        description: error.message || 'Có lỗi xảy ra, vui lòng thử lại',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (success && tenantInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-green-500">
                <CheckCircle className="h-8 w-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl text-green-600">Đăng ký thành công!</CardTitle>
            <CardDescription>
              Tài khoản doanh nghiệp của bạn đã được tạo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg text-center">
              <p className="text-sm text-muted-foreground">ID cửa hàng của bạn:</p>
              <p className="font-mono font-bold text-primary text-lg mt-1">
                {tenantInfo.subdomain}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Sử dụng ID này khi đăng nhập
              </p>
            </div>
            

            <Button 
              className="w-full" 
              onClick={() => navigate('/auth')}
            >
              Đăng nhập ngay
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <Button 
            variant="ghost" 
            size="sm" 
            className="absolute left-4 top-4"
            onClick={() => navigate('/auth')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Quay lại
          </Button>
          <div className="flex justify-center mb-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
              <Warehouse className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl">Đăng ký doanh nghiệp</CardTitle>
          <CardDescription>
            Tạo tài khoản quản lý kho cho doanh nghiệp của bạn
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="businessName">Tên doanh nghiệp *</Label>
              <Input
                id="businessName"
                name="businessName"
                placeholder="Công ty TNHH ABC"
                value={formData.businessName}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subdomain">ID Cửa hàng *</Label>
              <div className="flex items-center gap-0">
                <Input
                  id="subdomain"
                  name="subdomain"
                  placeholder="vphone"
                  value={formData.subdomain}
                  onChange={handleChange}
                  className="flex-1 rounded-r-none border-r-0"
                  required
                />
                <span className="inline-flex items-center px-3 h-10 border border-l-0 rounded-r-md bg-muted text-muted-foreground text-sm whitespace-nowrap">
                  .vkho.vn
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Chỉ sử dụng chữ thường, số và dấu gạch ngang. Đây là ID để đăng nhập.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="adminName">Tên admin *</Label>
                <Input
                  id="adminName"
                  name="adminName"
                  placeholder="Nguyễn Văn A"
                  value={formData.adminName}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Số điện thoại</Label>
                <Input
                  id="phone"
                  name="phone"
                  placeholder="0909123456"
                  value={formData.phone}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="admin@congty.com"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password">Mật khẩu *</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  minLength={6}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Xác nhận mật khẩu *</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  minLength={6}
                />
              </div>
            </div>


            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Đăng ký ngay
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}