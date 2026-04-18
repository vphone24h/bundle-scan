import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ArrowLeft, CheckCircle } from 'lucide-react';
import vkhoLogo from '@/assets/vkho-logo.png';
import { cn } from '@/lib/utils';
import { getCurrentCompanyDomain } from '@/hooks/useCompanyResolver';
import { useCompany } from '@/hooks/useCompanyResolver';
import { useCompanySettings } from '@/hooks/useCompanySettings';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [tenantInfo, setTenantInfo] = useState<{ subdomain: string } | null>(null);
  const [fieldError, setFieldError] = useState<{ field: 'password' | 'email' | 'confirmPassword' | 'subdomain' | null; message: string }>({ field: null, message: '' });
  const company = useCompany();
  const { data: companySettings } = useCompanySettings();
  const companyLogo = companySettings?.logo_url;
  const companyDomain = company.domain || 'vkho.vn';

  const [formData, setFormData] = useState({
    businessName: '',
    subdomain: '',
    adminName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    businessType: '',
    businessMode: 'public' as 'public' | 'secret',
    businessNeed: '' as '' | 'warehouse' | 'website' | 'both',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'subdomain' ? value.toLowerCase().replace(/[^a-z0-9-]/g, '') : value,
    }));
    // Clear error on the field being edited
    if (fieldError.field === name) {
      setFieldError({ field: null, message: '' });
    }
  };

  const focusField = (name: string) => {
    setTimeout(() => {
      const el = document.getElementById(name) as HTMLInputElement | null;
      el?.focus();
    }, 50);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError({ field: null, message: '' });
    
    if (formData.password !== formData.confirmPassword) {
      setFieldError({ field: 'confirmPassword', message: 'Mật khẩu xác nhận không khớp' });
      toast({ title: 'Lỗi', description: 'Mật khẩu xác nhận không khớp', variant: 'destructive' });
      focusField('confirmPassword');
      return;
    }

    if (formData.password.length < 6) {
      setFieldError({ field: 'password', message: 'Mật khẩu phải có ít nhất 6 ký tự' });
      toast({ title: 'Lỗi', description: 'Mật khẩu phải có ít nhất 6 ký tự', variant: 'destructive' });
      focusField('password');
      return;
    }

    if (formData.subdomain.length < 3) {
      setFieldError({ field: 'subdomain', message: 'Tên miền phụ phải có ít nhất 3 ký tự' });
      toast({ title: 'Lỗi', description: 'Tên miền phụ phải có ít nhất 3 ký tự', variant: 'destructive' });
      focusField('subdomain');
      return;
    }

    setLoading(true);

    try {
      if (!formData.businessNeed) {
        toast({
          title: 'Lỗi',
          description: 'Vui lòng chọn nhu cầu sử dụng',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('register-tenant', {
        body: {
          businessName: formData.businessName,
          subdomain: formData.subdomain,
          adminName: formData.adminName,
          email: formData.email,
          password: formData.password,
          phone: formData.phone,
          businessType: formData.businessType || null,
          businessMode: formData.businessMode,
          businessNeed: formData.businessNeed,
          companyDomain: getCurrentCompanyDomain() || 'vkho.vn',
        },
      });

      // Try to extract error + field from edge function response body even when status != 2xx
      let bodyError: string | null = null;
      let bodyField: 'password' | 'email' | null = null;
      try {
        const ctx = (error as any)?.context;
        if (ctx) {
          const body = typeof ctx.json === 'function' ? await ctx.json() : null;
          if (body?.error) bodyError = body.error;
          if (body?.field) bodyField = body.field;
        }
      } catch {}

      if (error || data?.error) {
        const errorMsg = bodyError || data?.error || 'Có lỗi xảy ra, vui lòng thử lại';
        const errorField = bodyField || (data?.field ?? null);
        if (errorField === 'password' || errorField === 'email') {
          setFieldError({ field: errorField, message: errorMsg });
          focusField(errorField);
        }
        toast({ title: 'Đăng ký thất bại', description: errorMsg, variant: 'destructive' });
        setLoading(false);
        return;
      }

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
            <img 
              src={companyLogo || vkhoLogo} 
              alt="Logo" 
              className="h-14 w-14 object-contain"
            />
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
              <Label htmlFor="businessType">Ngành nghề</Label>
              <Input
                id="businessType"
                name="businessType"
                placeholder="VD: Điện thoại, Linh kiện, Thời trang..."
                value={formData.businessType}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subdomain">ID Cửa hàng *</Label>
              <div className="flex items-center gap-0">
                <Input
                  id="subdomain"
                  name="subdomain"
                  placeholder="vkho"
                  value={formData.subdomain}
                  onChange={handleChange}
                  className={cn(
                    "flex-1 rounded-r-none border-r-0",
                    fieldError.field === 'subdomain' && "border-destructive ring-1 ring-destructive focus-visible:ring-destructive"
                  )}
                  aria-invalid={fieldError.field === 'subdomain'}
                  required
                />
                <span className="inline-flex items-center px-3 h-10 border border-l-0 rounded-r-md bg-muted text-muted-foreground text-sm whitespace-nowrap">
                  .{companyDomain}
                </span>
              </div>
              {fieldError.field === 'subdomain' ? (
                <p className="text-xs text-destructive font-medium">{fieldError.message}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Chỉ sử dụng chữ thường, số và dấu gạch ngang. Đây là ID để đăng nhập.
                </p>
              )}
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
                className={cn(
                  fieldError.field === 'email' && "border-destructive ring-1 ring-destructive focus-visible:ring-destructive"
                )}
                aria-invalid={fieldError.field === 'email'}
                required
              />
              {fieldError.field === 'email' && (
                <p className="text-xs text-destructive font-medium">{fieldError.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Hình thức quản lý *</Label>
              <div className="grid grid-cols-2 gap-3">
                <label
                  className={cn(
                    'flex flex-col items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-all text-center',
                    formData.businessMode === 'public'
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-primary/40'
                  )}
                >
                  <input
                    type="radio"
                    name="businessMode"
                    value="public"
                    checked={formData.businessMode === 'public'}
                    onChange={() => setFormData(prev => ({ ...prev, businessMode: 'public' }))}
                    className="sr-only"
                  />
                  <span className="text-lg">🏪</span>
                  <span className="font-medium text-sm">Công khai</span>
                  <span className="text-[11px] text-muted-foreground leading-tight">Đầy đủ tính năng: thuế, HĐĐT, báo cáo thuế</span>
                </label>
                <label
                  className={cn(
                    'flex flex-col items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-all text-center',
                    formData.businessMode === 'secret'
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-primary/40'
                  )}
                >
                  <input
                    type="radio"
                    name="businessMode"
                    value="secret"
                    checked={formData.businessMode === 'secret'}
                    onChange={() => setFormData(prev => ({ ...prev, businessMode: 'secret' }))}
                    className="sr-only"
                  />
                  <span className="text-lg">🔒</span>
                  <span className="font-medium text-sm">Bí mật</span>
                  <span className="text-[11px] text-muted-foreground leading-tight">Ẩn thuế, HĐĐT và báo cáo thuế</span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nhu cầu của bạn là gì? *</Label>
              <div className="space-y-2">
                {[
                  { value: 'warehouse', label: 'Quản lý kho hàng, doanh thu, lợi nhuận', icon: '📦' },
                  { value: 'website', label: 'Website bán hàng + email marketing', icon: '🌐' },
                  { value: 'both', label: 'Cả 2', icon: '🚀' },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={cn(
                      'flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all',
                      formData.businessNeed === option.value
                        ? 'border-primary bg-primary/5'
                        : 'border-muted hover:border-primary/40'
                    )}
                  >
                    <input
                      type="radio"
                      name="businessNeed"
                      value={option.value}
                      checked={formData.businessNeed === option.value}
                      onChange={() => setFormData(prev => ({ ...prev, businessNeed: option.value as any }))}
                      className="sr-only"
                    />
                    <span className="text-lg">{option.icon}</span>
                    <span className="text-sm font-medium">{option.label}</span>
                  </label>
                ))}
              </div>
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
                  className={cn(
                    fieldError.field === 'password' && "border-destructive ring-1 ring-destructive focus-visible:ring-destructive"
                  )}
                  aria-invalid={fieldError.field === 'password'}
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
                  className={cn(
                    fieldError.field === 'confirmPassword' && "border-destructive ring-1 ring-destructive focus-visible:ring-destructive"
                  )}
                  aria-invalid={fieldError.field === 'confirmPassword'}
                  required
                  minLength={6}
                />
              </div>
            </div>
            {(fieldError.field === 'password' || fieldError.field === 'confirmPassword') && (
              <p className="text-xs text-destructive font-medium -mt-2">{fieldError.message}</p>
            )}


            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Đăng ký ngay
            </Button>

            <div className="text-center">
              <Button 
                type="button"
                variant="link" 
                className="text-muted-foreground"
                onClick={() => navigate('/auth')}
              >
                Đã có tài khoản? Đăng nhập
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}