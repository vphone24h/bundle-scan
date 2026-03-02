import { useState, useEffect, useRef } from 'react';
import { TenantLandingSettings, uploadLandingAsset } from '@/hooks/useTenantLanding';
import { getIndustryConfig, IndustryTrustBadge, NavItemConfig, getFullNavItems, getDefaultNavItems, INDUSTRY_SUGGESTED_NAV, SYSTEM_PAGES, DEFAULT_PAGE_ITEMS, LayoutStyle, GOOGLE_FONTS } from '@/lib/industryConfig';
import { HomeSectionManager, HomeSectionItem } from '@/components/admin/HomeSectionManager';
import { ProductsPageSectionManager } from '@/components/admin/ProductsPageSectionManager';
import { ProductDetailSectionManager } from '@/components/admin/ProductDetailSectionManager';
import { NavMenuEditor } from '@/components/website-editor/NavMenuEditor';
import { TemplateSelector } from '@/components/website-templates/TemplateSelector';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import {
  ChevronDown, ChevronRight, Upload, X, Loader2, Plus,
  Image, Palette, Type, Menu, Layout, Phone, MessageCircle,
  Shield, Star, MapPin, Globe, Eye, EyeOff, Sparkles, Layers, PanelTop, Save
} from 'lucide-react';

interface EditorSettingsTabProps {
  formData: Partial<TenantLandingSettings>;
  onChange: (field: string, value: unknown) => void;
  focusSection: string | null;
  onClearFocus: () => void;
  tenantId: string | null;
  onSave?: () => void;
  isSaving?: boolean;
  hasChanges?: boolean;
}

// Collapsible block component
function SettingsBlock({
  id,
  icon,
  title,
  description,
  isExpanded,
  onToggle,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  description?: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b last:border-b-0" id={`editor-block-${id}`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors text-left"
      >
        <span className="text-lg shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{title}</p>
          {description && <p className="text-[10px] text-muted-foreground mt-0.5">{description}</p>}
        </div>
        {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 animate-in slide-in-from-top-1 duration-200">
          {children}
        </div>
      )}
    </div>
  );
}

// Map section IDs from preview to block IDs
const SECTION_TO_BLOCK: Record<string, string> = {
  'store-info': 'store-info',
  'banner': 'banner',
  'trust-badges': 'trust-badges',
  'products': 'layout',
  'articles': 'layout',
  'warranty': 'store-info',
  'voucher': 'store-info',
  'reviews': 'layout',
  'layout': 'layout',
  'footer': 'social',
  'sticky-bar': 'social',
  'menu': 'menu',
};

export function EditorSettingsTab({ formData, onChange, focusSection, onClearFocus, tenantId, onSave, isSaving, hasChanges }: EditorSettingsTabProps) {
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set());
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const templateId = (formData as any)?.website_template || 'phone_store';
  const config = getIndustryConfig(templateId);

  // Auto-expand focused section from preview click
  useEffect(() => {
    if (focusSection) {
      const blockId = SECTION_TO_BLOCK[focusSection] || focusSection;
      setExpandedBlocks(prev => new Set(prev).add(blockId));
      onClearFocus();
      // Scroll to block
      setTimeout(() => {
        const el = document.getElementById(`editor-block-${blockId}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [focusSection, onClearFocus]);

  const toggleBlock = (id: string) => {
    setExpandedBlocks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenantId) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'Lỗi', description: 'Logo tối đa 2MB', variant: 'destructive' });
      return;
    }
    setUploadingLogo(true);
    try {
      const url = await uploadLandingAsset(file, tenantId, 'logo');
      onChange('store_logo_url', url);
    } catch { toast({ title: 'Lỗi upload', variant: 'destructive' }); }
    finally { setUploadingLogo(false); }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenantId) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Lỗi', description: 'Banner tối đa 5MB', variant: 'destructive' });
      return;
    }
    setUploadingBanner(true);
    try {
      const url = await uploadLandingAsset(file, tenantId, 'banner');
      onChange('banner_image_url', url);
    } catch { toast({ title: 'Lỗi upload', variant: 'destructive' }); }
    finally { setUploadingBanner(false); }
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
      <input ref={bannerInputRef} type="file" accept="image/*" onChange={handleBannerUpload} className="hidden" />

      {/* Chọn mẫu Website */}
      <SettingsBlock
        id="template"
        icon="🎨"
        title="Chọn mẫu website"
        description="Giao diện theo ngành nghề"
        isExpanded={expandedBlocks.has('template')}
        onToggle={() => toggleBlock('template')}
      >
        <TemplateSelector
          selectedTemplate={templateId}
          onSelect={(id) => {
            onChange('website_template', id);
            onChange('custom_nav_items', getFullNavItems(id));
          }}
          editableSettings={{
            custom_trust_badges: (formData as any).custom_trust_badges || null,
          }}
          onSettingsChange={(editSettings) => {
            if (editSettings.custom_trust_badges !== undefined) {
              onChange('custom_trust_badges', editSettings.custom_trust_badges);
            }
          }}
        />
      </SettingsBlock>

      {/* Logo & Tên cửa hàng */}
      <SettingsBlock
        id="store-info"
        icon="🏪"
        title="Thông tin cửa hàng"
        description="Logo, tên, địa chỉ, SĐT"
        isExpanded={expandedBlocks.has('store-info')}
        onToggle={() => toggleBlock('store-info')}
      >
        <div className="space-y-3">
          <div className="space-y-2">
            <Label className="text-xs">Logo</Label>
            <div className="flex items-center gap-3">
              {formData.store_logo_url ? (
                <div className="relative">
                  <img src={formData.store_logo_url} alt="Logo" className="h-14 w-14 rounded-xl object-cover border" />
                  <button
                    type="button"
                    onClick={() => onChange('store_logo_url', '')}
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : null}
              <Button type="button" variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}>
                {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                <span className="ml-1.5">{formData.store_logo_url ? 'Đổi' : 'Upload'}</span>
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Tên cửa hàng</Label>
            <Input value={formData.store_name || ''} onChange={e => onChange('store_name', e.target.value)} placeholder="Tên cửa hàng" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Mô tả ngắn</Label>
            <Textarea value={formData.store_description || ''} onChange={e => onChange('store_description', e.target.value)} placeholder="Mô tả..." rows={2} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Địa chỉ</Label>
            <Input value={formData.store_address || ''} onChange={e => onChange('store_address', e.target.value)} placeholder="Địa chỉ cửa hàng" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Điện thoại</Label>
              <Input value={formData.store_phone || ''} onChange={e => onChange('store_phone', e.target.value)} placeholder="0xxx" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input value={formData.store_email || ''} onChange={e => onChange('store_email', e.target.value)} placeholder="email@..." />
            </div>
          </div>
        </div>
      </SettingsBlock>

      {/* Màu thương hiệu */}
      <SettingsBlock
        id="brand-color"
        icon="🎨"
        title="Màu thương hiệu"
        description="Màu chủ đạo, nút, link"
        isExpanded={expandedBlocks.has('brand-color')}
        onToggle={() => toggleBlock('brand-color')}
      >
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={formData.primary_color || '#0f766e'}
              onChange={e => onChange('primary_color', e.target.value)}
              className="h-10 w-10 rounded-lg border cursor-pointer"
            />
            <div className="flex-1">
              <Label className="text-xs">Màu chủ đạo</Label>
              <Input
                value={formData.primary_color || '#0f766e'}
                onChange={e => onChange('primary_color', e.target.value)}
                className="h-8 text-xs mt-1"
              />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {['#0071e3', '#0f766e', '#e11d48', '#ea580c', '#7c3aed', '#000000'].map(color => (
              <button
                key={color}
                type="button"
                onClick={() => onChange('primary_color', color)}
                className={`h-8 w-8 rounded-full border-2 transition-all ${formData.primary_color === color ? 'border-foreground scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
      </SettingsBlock>

      {/* Font chữ & Layout */}
      <SettingsBlock
        id="appearance"
        icon="✨"
        title="Giao diện"
        description="Font chữ, phong cách bố cục"
        isExpanded={expandedBlocks.has('appearance')}
        onToggle={() => toggleBlock('appearance')}
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Phong cách</Label>
            <Select
              value={(formData as any).custom_layout_style || '_auto_'}
              onValueChange={val => onChange('custom_layout_style', val === '_auto_' ? null : val)}
            >
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_auto_">🤖 Tự động theo ngành</SelectItem>
                <SelectItem value="apple">🍎 Apple – Tối giản</SelectItem>
                <SelectItem value="tgdd">🛒 TGDĐ – Grid, badge</SelectItem>
                <SelectItem value="hasaki">💄 Hasaki – Flash sale</SelectItem>
                <SelectItem value="nike">👟 Nike – Bold</SelectItem>
                <SelectItem value="canifa">👗 Canifa – Thanh lịch</SelectItem>
                <SelectItem value="shopee">🛍️ Shopee – Marketplace</SelectItem>
                <SelectItem value="minimal">✨ Minimal – Đơn giản</SelectItem>
                <SelectItem value="luxury">💎 Luxury – Sang trọng</SelectItem>
                <SelectItem value="organic">🌿 Organic – Tự nhiên</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Phông chữ</Label>
            <Select
              value={(formData as any).custom_font_family || '_auto_'}
              onValueChange={val => onChange('custom_font_family', val === '_auto_' ? null : val)}
            >
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_auto_">🤖 Tự động</SelectItem>
                <SelectItem value='-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'>SF Pro</SelectItem>
                <SelectItem value='"Inter", system-ui, sans-serif'>Inter</SelectItem>
                <SelectItem value='"Nunito Sans", system-ui, sans-serif'>Nunito Sans</SelectItem>
                <SelectItem value='"Playfair Display", "Georgia", serif'>Playfair Display</SelectItem>
                <SelectItem value='"Cormorant Garamond", "Georgia", serif'>Cormorant Garamond</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </SettingsBlock>

      {/* Menu */}
      <SettingsBlock
        id="menu"
        icon="☰"
        title="Menu website"
        description="Thêm, xoá, sắp xếp menu"
        isExpanded={expandedBlocks.has('menu')}
        onToggle={() => toggleBlock('menu')}
      >
        <NavMenuEditor
          templateId={templateId}
          customNavItems={(formData as any)?.custom_nav_items || null}
          onChange={(items) => onChange('custom_nav_items', items)}
        />
      </SettingsBlock>

      {/* Banner */}
      <SettingsBlock
        id="banner"
        icon="🎯"
        title="Banner trang chủ"
        description="Tiêu đề, mô tả, nút CTA, hình ảnh"
        isExpanded={expandedBlocks.has('banner')}
        onToggle={() => toggleBlock('banner')}
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Tiêu đề chính</Label>
            <Input
              value={(formData as any).hero_title || ''}
              onChange={e => onChange('hero_title', e.target.value || null)}
              placeholder={config.heroTitle}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Mô tả phụ</Label>
            <Input
              value={(formData as any).hero_subtitle || ''}
              onChange={e => onChange('hero_subtitle', e.target.value || null)}
              placeholder={config.heroSubtitle}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Nút CTA</Label>
            <Input
              value={(formData as any).hero_cta || ''}
              onChange={e => onChange('hero_cta', e.target.value || null)}
              placeholder={config.heroCta}
            />
          </div>
          <Separator />
          <div className="space-y-1.5">
            <Label className="text-xs">Ảnh banner (tuỳ chọn)</Label>
            <div className="flex items-center gap-2">
              {formData.banner_image_url ? (
                <div className="relative">
                  <img src={formData.banner_image_url} alt="Banner" className="h-16 w-28 rounded-lg object-cover border" />
                  <button type="button" onClick={() => onChange('banner_image_url', '')}
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : null}
              <Button type="button" variant="outline" size="sm" onClick={() => bannerInputRef.current?.click()} disabled={uploadingBanner}>
                {uploadingBanner ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                <span className="ml-1.5">{formData.banner_image_url ? 'Đổi' : 'Upload'}</span>
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Link khi nhấn banner</Label>
            <Input
              value={formData.banner_link_url || ''}
              onChange={e => onChange('banner_link_url', e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>
      </SettingsBlock>

      {/* Trust Badges */}
      <SettingsBlock
        id="trust-badges"
        icon="🛡️"
        title="Cam kết uy tín"
        description="4 biểu tượng cam kết"
        isExpanded={expandedBlocks.has('trust-badges')}
        onToggle={() => toggleBlock('trust-badges')}
      >
        <div className="space-y-2">
          {(() => {
            const badges = (formData as any)?.custom_trust_badges || config.trustBadges;
            return badges.slice(0, 4).map((badge: IndustryTrustBadge, i: number) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border p-2.5">
                <div className="flex-1 space-y-1">
                  <Input
                    value={badge.title}
                    onChange={e => {
                      const current = [...((formData as any)?.custom_trust_badges || config.trustBadges)];
                      current[i] = { ...current[i], title: e.target.value };
                      onChange('custom_trust_badges', current);
                    }}
                    placeholder="Tiêu đề" className="h-8 text-xs"
                  />
                  <Input
                    value={badge.desc}
                    onChange={e => {
                      const current = [...((formData as any)?.custom_trust_badges || config.trustBadges)];
                      current[i] = { ...current[i], desc: e.target.value };
                      onChange('custom_trust_badges', current);
                    }}
                    placeholder="Mô tả" className="h-8 text-xs"
                  />
                </div>
              </div>
            ));
          })()}
          <Button
            type="button" variant="ghost" size="sm" className="text-xs"
            onClick={() => onChange('custom_trust_badges', null)}
          >
            Khôi phục mặc định
          </Button>
        </div>
      </SettingsBlock>

      {/* Layout trang chủ */}
      <SettingsBlock
        id="layout"
        icon="📐"
        title="Bố cục trang chủ"
        description="Bật/tắt, sắp xếp các phần"
        isExpanded={expandedBlocks.has('layout')}
        onToggle={() => toggleBlock('layout')}
      >
        <HomeSectionManager
          templateId={templateId}
          customSections={(formData as any).custom_home_sections || null}
          onChange={sections => onChange('custom_home_sections', sections)}
          customProductTabs={(formData as any).custom_product_tabs || []}
          onTabsChange={tabs => onChange('custom_product_tabs', tabs)}
          onManageTabProducts={(tabId, tabName) => {
            // Navigate to landing settings products tab - for now show a toast hint
            import('@/hooks/use-toast').then(({ toast }) => {
              toast({
                title: `📦 ${tabName}`,
                description: 'Vào "Sản phẩm" → Thêm/Sửa sản phẩm → chọn tab này trong mục "Hiển thị trên trang chủ"',
              });
            });
          }}
        />
      </SettingsBlock>

      {/* Layout trang sản phẩm */}
      <SettingsBlock
        id="products-layout"
        icon="🛒"
        title="Bố cục trang sản phẩm"
        description="Bật/tắt, sắp xếp các phần trên trang SP"
        isExpanded={expandedBlocks.has('products-layout')}
        onToggle={() => toggleBlock('products-layout')}
      >
        <ProductsPageSectionManager
          customSections={(formData as any).custom_products_page_sections || null}
          onChange={sections => onChange('custom_products_page_sections', sections)}
          customProductTabs={(formData as any).custom_products_page_tabs || []}
          onTabsChange={tabs => onChange('custom_products_page_tabs', tabs)}
          onManageTabProducts={(tabId, tabName) => {
            import('@/hooks/use-toast').then(({ toast }) => {
              toast({
                title: `📦 ${tabName}`,
                description: 'Vào "Sản phẩm" → Thêm/Sửa sản phẩm → chọn tab này trong mục "Hiển thị trên trang sản phẩm"',
              });
            });
          }}
        />
      </SettingsBlock>

      {/* Liên hệ & Mạng xã hội */}
      <SettingsBlock
        id="social"
        icon="💬"
        title="Nút liên hệ & MXH"
        description="Zalo, Facebook, TikTok, Hotline"
        isExpanded={expandedBlocks.has('social')}
        onToggle={() => toggleBlock('social')}
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Zalo (SĐT hoặc link)</Label>
            <Input value={formData.zalo_url || ''} onChange={e => onChange('zalo_url', e.target.value)} placeholder="0xxx hoặc https://zalo.me/..." />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Facebook</Label>
            <Input value={formData.facebook_url || ''} onChange={e => onChange('facebook_url', e.target.value)} placeholder="https://facebook.com/..." />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">TikTok</Label>
            <Input value={(formData as any).tiktok_url || ''} onChange={e => onChange('tiktok_url', e.target.value)} placeholder="https://tiktok.com/@..." />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Hotline bảo hành</Label>
            <Input value={formData.warranty_hotline || ''} onChange={e => onChange('warranty_hotline', e.target.value)} placeholder="1900xxxx" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Link nhóm hỗ trợ</Label>
            <Input value={formData.support_group_url || ''} onChange={e => onChange('support_group_url', e.target.value)} placeholder="https://..." />
          </div>
        </div>
      </SettingsBlock>

      {/* Popup khuyến mãi / Voucher */}
      <SettingsBlock
        id="voucher"
        icon="🎟️"
        title="Voucher khuyến mãi"
        description="Bật/tắt phát voucher"
        isExpanded={expandedBlocks.has('voucher')}
        onToggle={() => toggleBlock('voucher')}
      >
        <div className="flex items-center justify-between">
          <Label className="text-xs">Bật phát voucher trên website</Label>
          <Switch
            checked={formData.voucher_enabled}
            onCheckedChange={checked => onChange('voucher_enabled', checked)}
          />
        </div>
      </SettingsBlock>

      {/* Bố cục trang chi tiết sản phẩm */}
      <SettingsBlock
        id="product-detail-layout"
        icon="📋"
        title="Bố cục chi tiết sản phẩm"
        description="Sắp xếp các phần bên dưới giá & biến thể"
        isExpanded={expandedBlocks.has('product-detail-layout')}
        onToggle={() => toggleBlock('product-detail-layout')}
      >
        <ProductDetailSectionManager
          customSections={(formData as any).custom_product_detail_sections || null}
          onChange={sections => onChange('custom_product_detail_sections', sections)}
        />
      </SettingsBlock>

      {/* Tính năng sản phẩm */}
      <SettingsBlock
        id="product-features"
        icon="🛍️"
        title="Tính năng sản phẩm"
        description="Trả góp, so sánh, thu cũ đổi mới"
        isExpanded={expandedBlocks.has('product-features')}
        onToggle={() => toggleBlock('product-features')}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Nút trả góp</Label>
            <Switch
              checked={(formData as any).show_installment_button !== false}
              onCheckedChange={checked => onChange('show_installment_button', checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">So sánh sản phẩm</Label>
            <Switch
              checked={(formData as any).show_compare_products === true}
              onCheckedChange={checked => onChange('show_compare_products', checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Thu cũ đổi mới</Label>
            <Switch
              checked={(formData as any).show_trade_in === true}
              onCheckedChange={checked => onChange('show_trade_in', checked)}
            />
          </div>
        </div>
      </SettingsBlock>

      <SettingsBlock
        id="seo"
        icon="🔍"
        title="SEO"
        description="Meta title, description"
        isExpanded={expandedBlocks.has('seo')}
        onToggle={() => toggleBlock('seo')}
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Meta Title</Label>
            <Input value={formData.meta_title || ''} onChange={e => onChange('meta_title', e.target.value)} placeholder="Tiêu đề SEO" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Meta Description</Label>
            <Textarea value={formData.meta_description || ''} onChange={e => onChange('meta_description', e.target.value)} placeholder="Mô tả SEO" rows={2} />
          </div>
        </div>
      </SettingsBlock>

      {/* Auto-save indicator */}
      {isSaving && (
        <div className="sticky bottom-0 p-2 bg-background/80 backdrop-blur border-t flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Đang lưu...
        </div>
      )}

      {/* Spacer */}
      <div className="h-4" />
    </div>
  );
}
