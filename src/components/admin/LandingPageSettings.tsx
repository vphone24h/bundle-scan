import { useState, useEffect, useRef } from 'react';
import { useCustomDomainArticlePublic } from '@/hooks/useAppConfig';
import { useNavigate } from 'react-router-dom';
import { useTenantLandingSettings, useUpdateTenantLandingSettings, TenantLandingSettings, uploadLandingAsset } from '@/hooks/useTenantLanding';
import { useVoucherTemplates } from '@/hooks/useVouchers';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCustomDomains } from '@/hooks/useCustomDomains';
import { useCurrentTenant } from '@/hooks/useTenant';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { Loader2, Save, ExternalLink, Globe, Image, Info, Shield, Palette, Upload, X, Phone, Users, Share2, Building2, Plus, Copy, QrCode, Layout, Bot, ImageIcon } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { TemplateSelector } from '@/components/website-templates/TemplateSelector';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

function CustomDomainCTA() {
  const [open, setOpen] = useState(false);
  const { data: article } = useCustomDomainArticlePublic();

  return (
    <>
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <Globe className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">
              Bạn muốn sở hữu website với tên miền riêng của doanh nghiệp?
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Liên hệ để được hỗ trợ gắn tên miền riêng (VD: cuahang.vn) cho website bán hàng
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0 gap-1.5 text-primary border-primary/30 hover:bg-primary/10"
            onClick={() => setOpen(true)}
          >
            Xem chi tiết
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Dịch vụ tên miền riêng
            </DialogTitle>
          </DialogHeader>
          {article ? (
            <div
              className="prose prose-sm max-w-none [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_a]:text-primary [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: article }}
            />
          ) : (
            <p className="text-sm text-muted-foreground py-4">
              Chưa có nội dung bài viết. Vui lòng liên hệ quản trị viên nền tảng.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function LandingPageSettings() {
  const { data: tenant } = useCurrentTenant();
  const { data: settings, isLoading } = useTenantLandingSettings();
  const { data: customDomains } = useCustomDomains();
  const updateSettings = useUpdateTenantLandingSettings();
  const navigate = useNavigate();

  const { data: voucherTemplates } = useVoucherTemplates();
  const activeTemplates = (voucherTemplates || []).filter(t => t.is_active);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const [formData, setFormData] = useState<Partial<TenantLandingSettings>>({
    is_enabled: true,
    show_warranty_lookup: true,
    show_store_info: true,
    show_banner: false,
    show_branches: true,
    store_name: '',
    store_logo_url: '',
    store_address: '',
    additional_addresses: [],
    store_phone: '',
    store_email: '',
    store_description: '',
    banner_image_url: '',
    banner_link_url: '',
    primary_color: '#0f766e',
    meta_title: '',
    meta_description: '',
    warranty_hotline: '',
    support_group_url: '',
    facebook_url: '',
    zalo_url: '',
    tiktok_url: '',
    voucher_enabled: false,
    voucher_template_id: null,
    website_template: 'phone_store',
    ai_description_enabled: true,
    auto_image_enabled: true,
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        is_enabled: settings.is_enabled,
        show_warranty_lookup: settings.show_warranty_lookup,
        show_store_info: settings.show_store_info,
        show_banner: settings.show_banner,
        show_branches: settings.show_branches ?? true,
        store_name: settings.store_name || '',
        store_logo_url: settings.store_logo_url || '',
        store_address: settings.store_address || '',
        additional_addresses: settings.additional_addresses || [],
        store_phone: settings.store_phone || '',
        store_email: settings.store_email || '',
        store_description: settings.store_description || '',
        banner_image_url: settings.banner_image_url || '',
        banner_link_url: settings.banner_link_url || '',
        primary_color: settings.primary_color || '#0f766e',
        meta_title: settings.meta_title || '',
        meta_description: settings.meta_description || '',
        warranty_hotline: settings.warranty_hotline || '',
        support_group_url: settings.support_group_url || '',
        facebook_url: settings.facebook_url || '',
        zalo_url: settings.zalo_url || '',
        tiktok_url: settings.tiktok_url || '',
        voucher_enabled: settings.voucher_enabled ?? false,
        voucher_template_id: settings.voucher_template_id || null,
        website_template: settings.website_template || 'phone_store',
        ai_description_enabled: settings.ai_description_enabled ?? true,
        auto_image_enabled: settings.auto_image_enabled ?? true,
      });
    } else if (tenant) {
      setFormData(prev => ({
        ...prev,
        store_name: tenant.name || '',
      }));
    }
  }, [settings, tenant]);

  const handleAddAddress = () => {
    const current = formData.additional_addresses || [];
    setFormData(prev => ({ ...prev, additional_addresses: [...current, ''] }));
  };

  const handleRemoveAddress = (index: number) => {
    const current = formData.additional_addresses || [];
    setFormData(prev => ({ 
      ...prev, 
      additional_addresses: current.filter((_, i) => i !== index) 
    }));
  };

  const handleAddressChange = (index: number, value: string) => {
    const current = formData.additional_addresses || [];
    const updated = [...current];
    updated[index] = value;
    setFormData(prev => ({ ...prev, additional_addresses: updated }));
  };

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
        description: 'Cài đặt website bán hàng đã được cập nhật',
      });
    } catch (error) {
      toast({
        title: 'Lỗi',
        description: 'Không thể lưu cài đặt. Vui lòng thử lại.',
        variant: 'destructive',
      });
    }
  };

  const landingUrl = tenant?.subdomain ? `/store/${tenant.subdomain}` : null;
  
  // Check for verified custom domain belonging to THIS tenant only
  const verifiedDomain = customDomains?.find(d => d.is_verified && d.tenant_id === tenant?.id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // Use custom domain URL if available, otherwise default
  const customDomainUrl = verifiedDomain ? `https://${verifiedDomain.domain}` : null;
  const defaultLandingUrl = landingUrl 
    ? `${window.location.origin}${landingUrl}` 
    : null;
  const fullLandingUrl = customDomainUrl || defaultLandingUrl;

  const handleCopyLink = () => {
    if (fullLandingUrl) {
      navigator.clipboard.writeText(fullLandingUrl);
      toast({ title: 'Đã sao chép link!' });
    }
  };

  const handleCopyDefaultLink = () => {
    if (defaultLandingUrl) {
      navigator.clipboard.writeText(defaultLandingUrl);
      toast({ title: 'Đã sao chép link mặc định!' });
    }
  };

  const qrCodeUrl = fullLandingUrl 
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(fullLandingUrl)}` 
    : null;

  return (
    <div className="space-y-6">
      {/* Header với link landing page */}
      <Card data-tour="landing-link-card">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Cấu hình Website bán hàng
              </CardTitle>
              <CardDescription>
                Thiết lập website bán hàng và tra cứu bảo hành cho khách hàng
              </CardDescription>
              <div className="mt-2 rounded-md bg-muted/50 border border-border px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  💡 Chức năng này <span className="font-medium text-foreground">miễn phí trọn đời</span>, không cần mua gói theo VKho — hoạt động độc lập hoàn toàn.
                </p>
              </div>
            </div>
            {landingUrl && (
              <a
                href={landingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                Xem website
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Link và QR Code */}
          {fullLandingUrl && (
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Link section */}
                <div className="flex-1 space-y-2">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <Share2 className="h-4 w-4" />
                    {customDomainUrl ? 'Website riêng' : 'Link Website bán hàng'}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={fullLandingUrl}
                      readOnly
                      className="flex-1 bg-background text-sm"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleCopyLink}
                      className="shrink-0"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  {customDomainUrl ? (
                    <p className="text-xs text-emerald-600 font-medium">
                      ✓ Tên miền riêng đã kích hoạt
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Chia sẻ link này cho khách hàng để tra cứu bảo hành
                    </p>
                  )}

                  {/* Show default link below if custom domain active */}
                  {customDomainUrl && defaultLandingUrl && (
                    <div className="mt-2 pt-2 border-t">
                      <Label className="text-xs text-muted-foreground">Link mặc định</Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          value={defaultLandingUrl}
                          readOnly
                          className="flex-1 bg-background text-xs h-8"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={handleCopyDefaultLink}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* QR Code section */}
                <div className="flex flex-col items-center gap-2">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <QrCode className="h-4 w-4" />
                    Mã QR
                  </Label>
                  {qrCodeUrl && (
                    <div className="rounded-lg border bg-white p-2">
                      <img 
                        src={qrCodeUrl} 
                        alt="QR Code" 
                        className="h-24 w-24 sm:h-28 sm:w-28"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* CTA tên miền riêng - chỉ hiện khi chưa có domain riêng */}
          {fullLandingUrl && !customDomainUrl && <CustomDomainCTA />}
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Bật Website bán hàng</Label>
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

      {/* Chọn mẫu website */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Layout className="h-4 w-4" />
            Chọn mẫu Website
          </CardTitle>
          <CardDescription>
            Chọn giao diện phù hợp với ngành nghề kinh doanh của bạn
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TemplateSelector
            selectedTemplate={(formData as any).website_template || 'phone_store'}
            onSelect={(id) => handleChange('website_template' as any, id)}
          />
        </CardContent>
      </Card>

      {/* Thông tin cửa hàng */}
      <Card data-tour="landing-store-info-card">
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
            <div className="space-y-2 sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label>Địa chỉ</Label>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs gap-1"
                  onClick={handleAddAddress}
                >
                  <Plus className="h-3 w-3" />
                  Thêm địa chỉ
                </Button>
              </div>
              <Input
                value={formData.store_address}
                onChange={(e) => handleChange('store_address', e.target.value)}
                placeholder="Địa chỉ chính"
              />
              
              {/* Các địa chỉ bổ sung */}
              {(formData.additional_addresses || []).map((addr, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={addr}
                    onChange={(e) => handleAddressChange(index, e.target.value)}
                    placeholder={`Địa chỉ ${index + 2}`}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 text-destructive hover:text-destructive"
                    onClick={() => handleRemoveAddress(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              
              {(formData.additional_addresses || []).length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Nếu bạn có nhiều chi nhánh, hãy nhấn "Thêm địa chỉ"
                </p>
              )}
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
          
          <Separator className="my-4" />
          
          {/* Hiển thị chi nhánh */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Hiển thị chi nhánh
              </Label>
              <p className="text-sm text-muted-foreground">
                Hiển thị danh sách chi nhánh với địa chỉ trên website (lấy từ quản lý chi nhánh)
              </p>
            </div>
            <Switch
              checked={formData.show_branches}
              onCheckedChange={(checked) => handleChange('show_branches', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tra cứu bảo hành */}
      <Card data-tour="landing-warranty-card">
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

          {/* Voucher */}
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Tặng Voucher cho khách</p>
              <p className="text-xs text-muted-foreground">Khách điền thông tin trên website để nhận voucher</p>
            </div>
            <Switch
              checked={(formData as any).voucher_enabled}
              onCheckedChange={(checked) => handleChange('voucher_enabled' as any, checked)}
            />
          </div>
          {(formData as any).voucher_enabled && (
            <div className="space-y-2 pl-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Chọn mẫu Voucher tặng khách</Label>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="text-xs h-auto p-0 gap-1"
                  onClick={() => navigate('/customers?tab=list&openSettings=voucher')}
                >
                  <Plus className="h-3 w-3" />
                  Thêm mẫu voucher
                </Button>
              </div>
              {activeTemplates.length === 0 ? (
                <div className="rounded-lg border border-dashed p-3 text-center space-y-1">
                  <p className="text-xs text-muted-foreground">Chưa có mẫu voucher nào.</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1"
                    onClick={() => navigate('/customers?tab=list&openSettings=voucher')}
                  >
                    <Plus className="h-3 w-3" />
                    Tạo mẫu voucher
                  </Button>
                  <p className="text-[10px] text-muted-foreground">
                    Menu → Khách hàng & CRM → ⚙️ Cài đặt → Voucher
                  </p>
                </div>
              ) : (
                <Select
                  value={(formData as any).voucher_template_id || ''}
                  onValueChange={(val) => handleChange('voucher_template_id' as any, val)}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Chọn mẫu voucher" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeTemplates.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} — {t.discount_type === 'percentage' ? `${t.discount_value}%` : `${t.discount_value.toLocaleString()}đ`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-[10px] text-muted-foreground">
                💡 Quản lý mẫu voucher tại: Menu → Khách hàng & CRM → ⚙️ Cài đặt → Voucher
              </p>
            </div>
          )}
          
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
              
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Link nhóm hỗ trợ
                </Label>
                <Input
                  value={(formData as any).support_group_url || ''}
                  onChange={(e) => handleChange('support_group_url' as any, e.target.value)}
                  placeholder="VD: https://zalo.me/g/xxx hoặc link Facebook group"
                />
                <p className="text-xs text-muted-foreground">
                  Link nhóm Zalo/Facebook/Telegram để khách hàng tham gia nhận hỗ trợ
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Banner/Quảng cáo */}
      <Card data-tour="landing-banner-card">
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
      <Card data-tour="landing-color-card">
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

      {/* Cài đặt AI & Ảnh tự động */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4" />
            Cài đặt AI tự động
          </CardTitle>
          <CardDescription>
            Bật/tắt tính năng AI khi thêm sản phẩm từ kho lên website (có thể tốn credit Lovable AI)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Bot className="h-3.5 w-3.5" />
                AI tự viết mô tả sản phẩm
              </Label>
              <p className="text-xs text-muted-foreground">Tự động tạo mô tả chuyên nghiệp, SEO title, SEO description bằng AI</p>
            </div>
            <Switch
              checked={formData.ai_description_enabled ?? true}
              onCheckedChange={(checked) => handleChange('ai_description_enabled' as any, checked)}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <ImageIcon className="h-3.5 w-3.5" />
                Tự động lấy ảnh sản phẩm
              </Label>
              <p className="text-xs text-muted-foreground">Lấy ảnh có sẵn từ kho khi nhập sản phẩm lên website</p>
            </div>
            <Switch
              checked={formData.auto_image_enabled ?? true}
              onCheckedChange={(checked) => handleChange('auto_image_enabled' as any, checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Kênh thông tin / Social Media */}
      <Card data-tour="landing-social-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Share2 className="h-4 w-4" />
            Kênh thông tin
          </CardTitle>
          <CardDescription>
            Link mạng xã hội hiển thị trên website bán hàng
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <svg className="h-4 w-4 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Facebook
              </Label>
              <Input
                value={formData.facebook_url || ''}
                onChange={(e) => handleChange('facebook_url', e.target.value)}
                placeholder="https://facebook.com/..."
              />
            </div>
            
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <svg className="h-4 w-4 text-blue-500" viewBox="0 0 48 48" fill="currentColor">
                  <path d="M24 4C12.954 4 4 12.954 4 24s8.954 20 20 20 20-8.954 20-20S35.046 4 24 4zm9.375 28.125c-.833.833-2.5 1.667-4.167 1.667h-5.416c-1.667 0-3.334-.834-4.167-1.667l-5-5c-.833-.833-.833-2.5 0-3.333l7.5-7.5c.833-.834 2.5-.834 3.333 0l.834.833.833-.833c.834-.834 2.5-.834 3.334 0l7.5 7.5c.833.833.833 2.5 0 3.333l-4.584 5z"/>
                </svg>
                Zalo (SĐT)
              </Label>
              <Input
                value={formData.zalo_url || ''}
                onChange={(e) => handleChange('zalo_url', e.target.value)}
                placeholder="VD: 0971838929"
                inputMode="tel"
              />
              <p className="text-xs text-muted-foreground">
                Chỉ cần nhập SĐT Zalo, khách nhấn vào sẽ tự mở Zalo chat
              </p>
            </div>
            
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                </svg>
                TikTok
              </Label>
              <Input
                value={formData.tiktok_url || ''}
                onChange={(e) => handleChange('tiktok_url', e.target.value)}
                placeholder="https://tiktok.com/@..."
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
