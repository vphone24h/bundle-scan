import { useState, useEffect, useRef } from 'react';
import { useTenantLandingSettings, useUpdateTenantLandingSettings, TenantLandingSettings, uploadLandingAsset } from '@/hooks/useTenantLanding';
import { useCurrentTenant } from '@/hooks/useTenant';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { Loader2, Save, ExternalLink, Globe, Image, Info, Shield, Palette, Upload, X, Phone } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export function LandingPageSettings() {
  const { data: tenant } = useCurrentTenant();
  const { data: settings, isLoading } = useTenantLandingSettings();
  const updateSettings = useUpdateTenantLandingSettings();

  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const [formData, setFormData] = useState<Partial<TenantLandingSettings>>({
    is_enabled: true,
    show_warranty_lookup: true,
    show_store_info: true,
    show_banner: false,
    store_name: '',
    store_logo_url: '',
    store_address: '',
    store_phone: '',
    store_email: '',
    store_description: '',
    banner_image_url: '',
    banner_link_url: '',
    primary_color: '#0f766e',
    meta_title: '',
    meta_description: '',
    warranty_hotline: '',
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        is_enabled: settings.is_enabled,
        show_warranty_lookup: settings.show_warranty_lookup,
        show_store_info: settings.show_store_info,
        show_banner: settings.show_banner,
        store_name: settings.store_name || '',
        store_logo_url: settings.store_logo_url || '',
        store_address: settings.store_address || '',
        store_phone: settings.store_phone || '',
        store_email: settings.store_email || '',
        store_description: settings.store_description || '',
        banner_image_url: settings.banner_image_url || '',
        banner_link_url: settings.banner_link_url || '',
        primary_color: settings.primary_color || '#0f766e',
        meta_title: settings.meta_title || '',
        meta_description: settings.meta_description || '',
        warranty_hotline: settings.warranty_hotline || '',
      });
    } else if (tenant) {
      setFormData(prev => ({
        ...prev,
        store_name: tenant.name || '',
      }));
    }
  }, [settings, tenant]);

  const handleChange = (field: keyof TenantLandingSettings, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenant?.id) return;

    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'Lỗi', description: 'Ảnh logo không được vượt quá 2MB', variant: 'destructive' });
      return;
    }

    setUploadingLogo(true);
    try {
      const url = await uploadLandingAsset(file, tenant.id, 'logo');
      handleChange('store_logo_url', url);
      toast({ title: 'Đã upload logo' });
    } catch (error) {
      toast({ title: 'Lỗi', description: 'Không thể upload logo', variant: 'destructive' });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenant?.id) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Lỗi', description: 'Ảnh banner không được vượt quá 5MB', variant: 'destructive' });
      return;
    }

    setUploadingBanner(true);
    try {
      const url = await uploadLandingAsset(file, tenant.id, 'banner');
      handleChange('banner_image_url', url);
      toast({ title: 'Đã upload banner' });
    } catch (error) {
      toast({ title: 'Lỗi', description: 'Không thể upload banner', variant: 'destructive' });
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync(formData);
      toast({
        title: 'Đã lưu',
        description: 'Cài đặt landing page đã được cập nhật',
      });
    } catch (error) {
      toast({
        title: 'Lỗi',
        description: 'Không thể lưu cài đặt. Vui lòng thử lại.',
        variant: 'destructive',
      });
    }
  };

  const landingUrl = tenant?.subdomain ? `https://${tenant.subdomain}.vkho.vn` : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header với link landing page */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Cấu hình Landing Page
              </CardTitle>
              <CardDescription>
                Thiết lập trang giới thiệu và tra cứu bảo hành cho khách hàng
              </CardDescription>
            </div>
            {landingUrl && (
              <a
                href={landingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                Xem landing page
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Bật Landing Page</Label>
              <p className="text-sm text-muted-foreground">
                Cho phép khách hàng truy cập trang thông tin cửa hàng
              </p>
            </div>
            <Switch
              checked={formData.is_enabled}
              onCheckedChange={(checked) => handleChange('is_enabled', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Thông tin cửa hàng */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="h-4 w-4" />
            Thông tin cửa hàng
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Hiển thị thông tin liên hệ</Label>
            <Switch
              checked={formData.show_store_info}
              onCheckedChange={(checked) => handleChange('show_store_info', checked)}
            />
          </div>
          
          <Separator />
          
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tên cửa hàng</Label>
              <Input
                value={formData.store_name}
                onChange={(e) => handleChange('store_name', e.target.value)}
                placeholder="Nhập tên cửa hàng"
              />
            </div>
            
            {/* Logo upload */}
            <div className="space-y-2">
              <Label>Logo cửa hàng</Label>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <div className="flex items-center gap-2">
                {formData.store_logo_url ? (
                  <div className="relative">
                    <img 
                      src={formData.store_logo_url} 
                      alt="Logo" 
                      className="h-12 w-12 rounded-lg object-cover border"
                    />
                    <button
                      type="button"
                      onClick={() => handleChange('store_logo_url', '')}
                      className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingLogo}
                  className="gap-1.5"
                >
                  {uploadingLogo ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {formData.store_logo_url ? 'Đổi logo' : 'Upload logo'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Tối đa 2MB, định dạng JPG/PNG</p>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Mô tả ngắn</Label>
              <Textarea
                value={formData.store_description}
                onChange={(e) => handleChange('store_description', e.target.value)}
                placeholder="Mô tả ngắn về cửa hàng..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Địa chỉ</Label>
              <Input
                value={formData.store_address}
                onChange={(e) => handleChange('store_address', e.target.value)}
                placeholder="Địa chỉ cửa hàng"
              />
            </div>
            <div className="space-y-2">
              <Label>Số điện thoại</Label>
              <Input
                value={formData.store_phone}
                onChange={(e) => handleChange('store_phone', e.target.value)}
                placeholder="0xxx xxx xxx"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.store_email}
                onChange={(e) => handleChange('store_email', e.target.value)}
                placeholder="email@example.com"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tra cứu bảo hành */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" />
            Tra cứu bảo hành
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Cho phép tra cứu bảo hành</Label>
              <p className="text-sm text-muted-foreground">
                Khách hàng có thể nhập IMEI hoặc SĐT để kiểm tra bảo hành
              </p>
            </div>
            <Switch
              checked={formData.show_warranty_lookup}
              onCheckedChange={(checked) => handleChange('show_warranty_lookup', checked)}
            />
          </div>
          
          {formData.show_warranty_lookup && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Hotline bảo hành
                </Label>
                <Input
                  value={formData.warranty_hotline || ''}
                  onChange={(e) => handleChange('warranty_hotline', e.target.value)}
                  placeholder="VD: 1900 xxxx hoặc 0xxx xxx xxx"
                />
                <p className="text-xs text-muted-foreground">
                  Hiển thị trong kết quả tra cứu để khách hàng liên hệ bảo hành
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Banner/Quảng cáo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Image className="h-4 w-4" />
            Banner quảng cáo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Hiển thị banner</Label>
            <Switch
              checked={formData.show_banner}
              onCheckedChange={(checked) => handleChange('show_banner', checked)}
            />
          </div>
          
          {formData.show_banner && (
            <>
              <Separator />
              <div className="space-y-4">
                {/* Banner upload */}
                <div className="space-y-2">
                  <Label>Hình ảnh banner</Label>
                  <input
                    ref={bannerInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleBannerUpload}
                    className="hidden"
                  />
                  {formData.banner_image_url ? (
                    <div className="relative">
                      <img 
                        src={formData.banner_image_url} 
                        alt="Banner" 
                        className="w-full max-h-48 rounded-lg object-cover border"
                      />
                      <button
                        type="button"
                        onClick={() => handleChange('banner_image_url', '')}
                        className="absolute top-2 right-2 h-8 w-8 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => bannerInputRef.current?.click()}
                    disabled={uploadingBanner}
                    className="gap-1.5"
                  >
                    {uploadingBanner ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {formData.banner_image_url ? 'Đổi banner' : 'Upload banner'}
                  </Button>
                  <p className="text-xs text-muted-foreground">Tối đa 5MB, khuyến nghị 1200x400px</p>
                </div>
                
                <div className="space-y-2">
                  <Label>Link khi click banner (tuỳ chọn)</Label>
                  <Input
                    value={formData.banner_link_url}
                    onChange={(e) => handleChange('banner_link_url', e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Tuỳ chỉnh màu sắc */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="h-4 w-4" />
            Tuỳ chỉnh giao diện
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Màu chủ đạo</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={formData.primary_color}
                onChange={(e) => handleChange('primary_color', e.target.value)}
                className="h-10 w-14 rounded border cursor-pointer"
              />
              <Input
                value={formData.primary_color}
                onChange={(e) => handleChange('primary_color', e.target.value)}
                placeholder="#0f766e"
                className="max-w-32"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Nút lưu */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={updateSettings.isPending}
          className="gap-2"
        >
          {updateSettings.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Lưu cài đặt
        </Button>
      </div>
    </div>
  );
}
