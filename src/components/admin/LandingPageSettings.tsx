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
import { Loader2, Save, ExternalLink, Globe, Image, Info, Shield, Palette, Upload, X, Phone, Users, Share2, Building2, Plus, Copy, QrCode, Layout, Bot, ImageIcon, Award, Truck, CreditCard, Clock, Star, Eye, EyeOff, Menu as MenuIcon, Sparkles, Trash2, ChevronUp, ChevronDown, Type, Layers, PanelTop, Mail, HelpCircle, MessageCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { TemplateSelector } from '@/components/website-templates/TemplateSelector';
import { getIndustryConfig, IndustryTrustBadge, NavItemConfig, PageItemConfig, InstallmentRateConfig, DEFAULT_INSTALLMENT_RATES, getDefaultNavItems, INDUSTRY_SUGGESTED_NAV, getFullNavItems, SYSTEM_PAGES, SYSTEM_PAGE_IDS, getSystemPageById, DEFAULT_PAGE_ITEMS, LayoutStyle, GOOGLE_FONTS } from '@/lib/industryConfig';
import { HomeSectionManager, HomeSectionItem } from './HomeSectionManager';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

function AppPasswordHelpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Hướng dẫn lấy App Password Gmail
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <p className="font-medium">Bước 1: Bật xác minh 2 bước</p>
            <p className="text-muted-foreground text-xs">Vào <span className="font-medium">Google Account</span> → <span className="font-medium">Security</span> → <span className="font-medium">2-Step Verification</span> → Bật lên</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <p className="font-medium">Bước 2: Tạo App Password</p>
            <p className="text-muted-foreground text-xs">Vào <span className="font-medium">Google Account</span> → <span className="font-medium">Security</span> → <span className="font-medium">App Passwords</span></p>
            <p className="text-muted-foreground text-xs">Hoặc truy cập trực tiếp:</p>
            <a
              href="https://myaccount.google.com/apppasswords"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary underline break-all"
            >
              https://myaccount.google.com/apppasswords
            </a>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <p className="font-medium">Bước 3: Tạo mật khẩu mới</p>
            <p className="text-muted-foreground text-xs">Đặt tên app (VD: "VKho Email") → Nhấn <span className="font-medium">Create</span></p>
            <p className="text-muted-foreground text-xs">Copy mật khẩu 16 ký tự được tạo ra và dán vào ô <span className="font-medium">Mail App Password</span> ở trên.</p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            <p className="text-xs text-amber-800 dark:text-amber-200">⚠️ <span className="font-medium">Lưu ý:</span> Không dùng mật khẩu Gmail thường. Phải tạo App Password riêng mới gửi được email tự động.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OrderEmailConfigSection({ formData, handleChange, tenantId, onSave }: { formData: any; handleChange: (field: string, value: any) => void; tenantId: string | null; onSave?: () => void }) {
  const [showHelp, setShowHelp] = useState(false);
  const [saving, setSaving] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          <Label className="text-sm font-medium">Email tự động đơn hàng</Label>
        </div>
        <Switch
          checked={formData.order_email_enabled ?? false}
          onCheckedChange={(checked) => handleChange('order_email_enabled', checked)}
        />
      </div>
      {formData.order_email_enabled && (
        <div className="ml-0 space-y-3 pl-0 border-l-2 border-primary/20 ml-2 pl-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Email gửi (Gmail)</Label>
            <Input
              value={formData.order_email_sender || ''}
              onChange={e => handleChange('order_email_sender', e.target.value)}
              placeholder="yourstore@gmail.com"
              type="email"
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Mail App Password</Label>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-primary" onClick={() => setShowHelp(true)}>
                <HelpCircle className="h-3.5 w-3.5 mr-1" />
                Hướng dẫn
              </Button>
            </div>
            <Input
              value={formData.order_email_app_password || ''}
              onChange={e => handleChange('order_email_app_password', e.target.value)}
              placeholder="Mật khẩu ứng dụng Gmail"
              type="password"
            />
          </div>
          <Separator />
          <p className="text-xs font-medium text-muted-foreground">Loại email gửi:</p>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Email xác nhận đơn hàng</Label>
            <Switch checked={true} disabled />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Email khi đơn đã xác nhận</Label>
            <Switch
              checked={formData.order_email_on_confirmed ?? false}
              onCheckedChange={checked => handleChange('order_email_on_confirmed', checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Email khi giao hàng</Label>
            <Switch
              checked={formData.order_email_on_shipping ?? false}
              onCheckedChange={checked => handleChange('order_email_on_shipping', checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Email bảo hành</Label>
            <Switch
              checked={formData.order_email_on_warranty ?? false}
              onCheckedChange={checked => handleChange('order_email_on_warranty', checked)}
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="default"
              size="sm"
              className="flex-1 gap-1.5"
              disabled={!formData.order_email_sender || !formData.order_email_app_password || saving}
              onClick={async () => {
                setSaving(true);
                try {
                  if (onSave) onSave();
                  toast({ title: '✅ Đã lưu cài đặt email!' });
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Lưu cài đặt mail
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={!formData.order_email_sender || !formData.order_email_app_password}
              onClick={async () => {
                try {
                  const { supabase } = await import('@/integrations/supabase/client');
                  const { error } = await supabase.functions.invoke('send-order-email', {
                    body: {
                      tenant_id: tenantId,
                      order_id: 'test-' + Date.now(),
                      customer_name: 'Khách test',
                      customer_email: formData.order_email_sender,
                      customer_phone: '0123456789',
                      product_name: 'Sản phẩm test',
                      product_price: 10000000,
                      order_code: '#TEST01',
                      variant: 'Đen',
                      quantity: 1,
                      branch_id: null,
                      email_type: 'order_confirmation',
                    },
                  });
                  if (error) throw error;
                  toast({ title: '✅ Đã gửi email test thành công!' });
                } catch (err: any) {
                  toast({ title: 'Lỗi gửi email', description: err.message, variant: 'destructive' });
                }
              }}
            >
              📨 Test gửi mail
            </Button>
          </div>
        </div>
      )}
      <AppPasswordHelpDialog open={showHelp} onOpenChange={setShowHelp} />
    </div>
  );
}

function ZaloOAConfigSection({ formData, handleChange, tenantId, onSave }: { formData: any; handleChange: (field: string, value: any) => void; tenantId: string | null; onSave?: () => void }) {
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-blue-500" />
          <Label className="text-sm font-medium">Zalo OA gửi tin nhắn tự động</Label>
        </div>
        <Switch
          checked={formData.zalo_enabled ?? false}
          onCheckedChange={(checked) => handleChange('zalo_enabled', checked)}
        />
      </div>
      {formData.zalo_enabled && (
        <div className="ml-0 space-y-3 pl-0 border-l-2 border-blue-500/20 ml-2 pl-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Zalo OA ID</Label>
            <Input
              value={formData.zalo_oa_id || ''}
              onChange={e => handleChange('zalo_oa_id', e.target.value)}
              placeholder="VD: 4318038921XXXXXX"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Access Token / API Key</Label>
            <Input
              value={formData.zalo_access_token || ''}
              onChange={e => handleChange('zalo_access_token', e.target.value)}
              placeholder="Zalo OA Access Token"
              type="password"
            />
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium">📌 Hướng dẫn lấy Access Token:</p>
            <p>1. Vào <a href="https://oa.zalo.me" target="_blank" rel="noopener noreferrer" className="text-primary underline">oa.zalo.me</a> → Đăng nhập</p>
            <p>2. Vào <a href="https://developers.zalo.me" target="_blank" rel="noopener noreferrer" className="text-primary underline">developers.zalo.me</a> → Tạo ứng dụng</p>
            <p>3. Cấu hình Webhook & lấy Access Token</p>
          </div>
          <Separator />
          <p className="text-xs font-medium text-muted-foreground">Gửi tin nhắn khi:</p>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Khách đặt hàng trên website</Label>
            <Switch checked={true} disabled />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Xuất hàng (bán hàng)</Label>
            <Switch
              checked={formData.zalo_on_export ?? false}
              onCheckedChange={checked => handleChange('zalo_on_export', checked)}
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="default"
              size="sm"
              className="flex-1 gap-1.5"
              disabled={!formData.zalo_oa_id || !formData.zalo_access_token || saving}
              onClick={async () => {
                setSaving(true);
                try {
                  if (onSave) onSave();
                  toast({ title: '✅ Đã lưu cài đặt Zalo!' });
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Lưu cài đặt Zalo
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={!formData.zalo_oa_id || !formData.zalo_access_token || testing}
              onClick={async () => {
                setTesting(true);
                try {
                  const { supabase } = await import('@/integrations/supabase/client');
                  const { error } = await supabase.functions.invoke('send-zalo-message', {
                    body: {
                      tenant_id: tenantId,
                      customer_name: 'Test',
                      customer_phone: formData.store_phone || '0123456789',
                      message_type: 'test',
                    },
                  });
                  if (error) throw error;
                  toast({ title: '✅ Đã gửi tin nhắn Zalo test!' });
                } catch (err: any) {
                  toast({ title: 'Lỗi gửi Zalo', description: err.message, variant: 'destructive' });
                } finally {
                  setTesting(false);
                }
              }}
            >
              {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />}
              Test gửi Zalo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

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

const BADGE_ICON_OPTIONS = [
  { value: 'Shield', label: 'Bảo vệ', icon: <Shield className="h-4 w-4" /> },
  { value: 'Award', label: 'Chứng nhận', icon: <Award className="h-4 w-4" /> },
  { value: 'Truck', label: 'Giao hàng', icon: <Truck className="h-4 w-4" /> },
  { value: 'CreditCard', label: 'Thanh toán', icon: <CreditCard className="h-4 w-4" /> },
  { value: 'Clock', label: 'Thời gian', icon: <Clock className="h-4 w-4" /> },
  { value: 'Star', label: 'Sao', icon: <Star className="h-4 w-4" /> },
];

function TrustBadgeEditor({
  badges,
  defaultBadges,
  onChange,
}: {
  badges: IndustryTrustBadge[] | null;
  defaultBadges: IndustryTrustBadge[];
  onChange: (badges: IndustryTrustBadge[] | null) => void;
}) {
  const currentBadges = badges || defaultBadges;
  const isCustom = badges !== null;

  const handleBadgeChange = (index: number, field: keyof IndustryTrustBadge, value: string) => {
    const updated = [...currentBadges];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const handleReset = () => onChange(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Biểu tượng cam kết (Trust Badges)
        </Label>
        {isCustom && (
          <Button type="button" variant="ghost" size="sm" className="text-xs h-7" onClick={handleReset}>
            Khôi phục mặc định
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        4 biểu tượng cam kết hiển thị bên dưới banner trên website
      </p>
      <div className="grid gap-3">
        {currentBadges.slice(0, 4).map((badge, i) => (
          <div key={i} className="flex items-start gap-2 rounded-lg border p-3">
            <Select
              value={badge.icon}
              onValueChange={(val) => handleBadgeChange(i, 'icon', val)}
            >
              <SelectTrigger className="w-[120px] h-9 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BADGE_ICON_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className="flex items-center gap-2">{opt.icon} {opt.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex-1 space-y-1.5">
              <Input
                value={badge.title}
                onChange={(e) => handleBadgeChange(i, 'title', e.target.value)}
                placeholder="Tiêu đề"
                className="h-9 text-sm"
              />
              <Input
                value={badge.desc}
                onChange={(e) => handleBadgeChange(i, 'desc', e.target.value)}
                placeholder="Mô tả ngắn"
                className="h-9 text-sm"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NavMenuEditor({
  templateId,
  customNavItems,
  onChange,
}: {
  templateId: string;
  customNavItems: NavItemConfig[] | null;
  onChange: (items: NavItemConfig[] | null) => void;
}) {
  const config = getIndustryConfig(templateId);
  const defaultItems = getDefaultNavItems(config);
  const suggestedExtras = INDUSTRY_SUGGESTED_NAV[templateId] || [];

  // Merge: use custom if set, otherwise defaults + suggested
  const currentItems = customNavItems || [...defaultItems, ...suggestedExtras];

  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const handleToggle = (index: number) => {
    const updated = [...currentItems];
    if (updated[index].id === 'home') return;
    updated[index] = { ...updated[index], enabled: !updated[index].enabled };
    onChange(updated);
  };

  const handleLabelChange = (index: number, label: string) => {
    const updated = [...currentItems];
    updated[index] = { ...updated[index], label };
    onChange(updated);
  };

  const handleUrlChange = (index: number, url: string) => {
    const updated = [...currentItems];
    updated[index] = { ...updated[index], url };
    onChange(updated);
  };

  const handleRemove = (index: number) => {
    const item = currentItems[index];
    if (['home', 'products', 'news', 'warranty'].includes(item.id)) return;
    const updated = currentItems.filter((_, i) => i !== index);
    onChange(updated);
    if (expandedIndex === index) setExpandedIndex(null);
  };

  const [showAddMenu, setShowAddMenu] = useState(false);
  const [addMenuType, setAddMenuType] = useState<'system' | 'link'>('system');

  const handleAdd = () => {
    setShowAddMenu(true);
  };

  const handleAddSystemPage = (pageDef: typeof SYSTEM_PAGES[number]) => {
    const defaultItems_page = DEFAULT_PAGE_ITEMS[pageDef.id];
    const newItem: NavItemConfig = {
      id: pageDef.id + '_' + Date.now(),
      label: pageDef.label,
      enabled: true,
      type: 'page',
      pageView: pageDef.id,
      icon: pageDef.icon,
      pageItems: defaultItems_page ? [...defaultItems_page] : undefined,
    };
    onChange([...currentItems, newItem]);
    setShowAddMenu(false);
  };

  const handleAddCustomLink = () => {
    const newItem: NavItemConfig = {
      id: `custom_${Date.now()}`,
      label: 'Trang mới',
      enabled: true,
      type: 'link',
      icon: '📄',
      url: '',
    };
    onChange([...currentItems, newItem]);
    setShowAddMenu(false);
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const updated = [...currentItems];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    onChange(updated);
  };

  const handleMoveDown = (index: number) => {
    if (index >= currentItems.length - 1) return;
    const updated = [...currentItems];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    onChange(updated);
  };

  const handleAutoSuggest = () => {
    const full = getFullNavItems(templateId);
    onChange(full);
  };

  const handleReset = () => onChange(null);

  const isCoreItem = (id: string) => ['home', 'products', 'news', 'warranty'].includes(id);

  // Page items handlers
  const handlePageItemChange = (navIndex: number, itemIndex: number, field: keyof PageItemConfig, value: string) => {
    const updated = [...currentItems];
    const pageView = updated[navIndex].pageView || '';
    const defaults = DEFAULT_PAGE_ITEMS[pageView] || [];
    const items = updated[navIndex].pageItems ? [...updated[navIndex].pageItems!] : [...defaults];
    items[itemIndex] = { ...items[itemIndex], [field]: value };
    updated[navIndex] = { ...updated[navIndex], pageItems: items };
    onChange(updated);
  };

  const handleAddPageItem = (navIndex: number) => {
    const updated = [...currentItems];
    const pageView = updated[navIndex].pageView || '';
    const defaults = DEFAULT_PAGE_ITEMS[pageView] || [];
    const items = updated[navIndex].pageItems ? [...updated[navIndex].pageItems!] : [...defaults];
    items.push({ title: 'Mục mới', desc: '', icon: '📌', price: '' });
    updated[navIndex] = { ...updated[navIndex], pageItems: items };
    onChange(updated);
  };

  const handleRemovePageItem = (navIndex: number, itemIndex: number) => {
    const updated = [...currentItems];
    const pageView = updated[navIndex].pageView || '';
    const defaults = DEFAULT_PAGE_ITEMS[pageView] || [];
    const items = updated[navIndex].pageItems ? [...updated[navIndex].pageItems!] : [...defaults];
    items.splice(itemIndex, 1);
    updated[navIndex] = { ...updated[navIndex], pageItems: items };
    onChange(updated);
  };

  const handleResetPageItems = (navIndex: number) => {
    const updated = [...currentItems];
    updated[navIndex] = { ...updated[navIndex], pageItems: undefined };
    onChange(updated);
  };

  // Installment rate handlers
  const handleInstallmentRateChange = (navIndex: number, rateIndex: number, field: keyof InstallmentRateConfig, value: string | number | boolean) => {
    const updated = [...currentItems];
    const rates = updated[navIndex].installmentRates ? [...updated[navIndex].installmentRates!] : [...DEFAULT_INSTALLMENT_RATES];
    rates[rateIndex] = { ...rates[rateIndex], [field]: value };
    updated[navIndex] = { ...updated[navIndex], installmentRates: rates };
    onChange(updated);
  };

  const handleAddInstallmentRate = (navIndex: number) => {
    const updated = [...currentItems];
    const rates = updated[navIndex].installmentRates ? [...updated[navIndex].installmentRates!] : [...DEFAULT_INSTALLMENT_RATES];
    rates.push({ label: 'Ngân hàng mới', rate: 2.0 });
    updated[navIndex] = { ...updated[navIndex], installmentRates: rates };
    onChange(updated);
  };

  const handleRemoveInstallmentRate = (navIndex: number, rateIndex: number) => {
    const updated = [...currentItems];
    const rates = updated[navIndex].installmentRates ? [...updated[navIndex].installmentRates!] : [...DEFAULT_INSTALLMENT_RATES];
    rates.splice(rateIndex, 1);
    updated[navIndex] = { ...updated[navIndex], installmentRates: rates };
    onChange(updated);
  };

  const handleResetInstallmentRates = (navIndex: number) => {
    const updated = [...currentItems];
    updated[navIndex] = { ...updated[navIndex], installmentRates: undefined };
    onChange(updated);
  };

  const hasEditableItems = (item: NavItemConfig) => {
    if (item.type !== 'page') return false;
    const pv = item.pageView || '';
    return !!DEFAULT_PAGE_ITEMS[pv] || (item.pageItems && item.pageItems.length > 0) || pv === 'installment';
  };

  return (
    <div className="space-y-3">
      {/* Auto-suggest button */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleAutoSuggest}>
          <Sparkles className="h-3.5 w-3.5" />
          Gợi ý menu theo ngành
        </Button>
        {customNavItems && (
          <Button type="button" variant="ghost" size="sm" className="text-xs h-7" onClick={handleReset}>
            Khôi phục mặc định
          </Button>
        )}
      </div>

      {/* Nav items list */}
      <div className="space-y-2">
        {currentItems.map((item, i) => {
          const isExpanded = expandedIndex === i;
          const canEditItems = hasEditableItems(item);
          const pageView = item.pageView || '';
          const defaults = DEFAULT_PAGE_ITEMS[pageView] || [];
          const currentPageItems = item.pageItems || defaults;

          return (
            <div key={item.id + i} className="rounded-lg border transition-all overflow-hidden">
              <div
                className={`flex items-center gap-2 p-2.5 ${
                  item.enabled ? 'bg-background' : 'bg-muted/50 opacity-60'
                }`}
              >
                {/* Drag handle / order buttons */}
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button type="button" onClick={() => handleMoveUp(i)} disabled={i === 0}
                    className="h-4 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30">
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <button type="button" onClick={() => handleMoveDown(i)} disabled={i === currentItems.length - 1}
                    className="h-4 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30">
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </div>

                {/* Icon */}
                <span className="text-lg shrink-0">{item.icon || '📄'}</span>

                {/* Label input */}
                <div className="flex-1 min-w-0 space-y-1">
                  <Input value={item.label} onChange={(e) => handleLabelChange(i, e.target.value)}
                    className="h-8 text-sm font-medium" placeholder="Tên menu" />
                  {item.type === 'link' && !isCoreItem(item.id) && (
                    <Input value={item.url || ''} onChange={(e) => handleUrlChange(i, e.target.value)}
                      className="h-7 text-xs" placeholder="URL (tuỳ chọn, VD: https://...)" />
                  )}
                </div>

                {/* Type badge */}
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {isCoreItem(item.id) ? 'Mặc định' : item.type === 'page' ? 'Trang HT' : 'Link ngoài'}
                </span>

                {/* Expand items editor */}
                {canEditItems && (
                  <button type="button" onClick={() => setExpandedIndex(isExpanded ? null : i)}
                    className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
                    title="Chỉnh sửa nội dung trang">
                    <MenuIcon className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}

                {/* Toggle visibility */}
                <button type="button" onClick={() => handleToggle(i)} disabled={item.id === 'home'}
                  className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors disabled:opacity-30"
                  title={item.enabled ? 'Ẩn' : 'Hiện'}>
                  {item.enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                </button>

                {/* Remove (only custom items) */}
                {!isCoreItem(item.id) && (
                  <button type="button" onClick={() => handleRemove(i)}
                    className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Expanded page items editor */}
              {isExpanded && canEditItems && (
                <div className="border-t bg-muted/20 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Nội dung trang ({currentPageItems.length} mục)</Label>
                    <div className="flex gap-1">
                      {item.pageItems && (
                        <Button type="button" variant="ghost" size="sm" className="text-[10px] h-6 px-2" onClick={() => handleResetPageItems(i)}>
                          Mặc định
                        </Button>
                      )}
                      <Button type="button" variant="ghost" size="sm" className="text-[10px] h-6 px-2" onClick={() => handleAddPageItem(i)}>
                        <Plus className="h-3 w-3 mr-1" /> Thêm
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {currentPageItems.map((pi, j) => (
                      <div key={j} className="flex items-start gap-1.5 rounded-md border bg-background p-2">
                        <Input value={pi.icon || ''} onChange={(e) => handlePageItemChange(i, j, 'icon', e.target.value)}
                          className="h-7 w-10 text-center text-sm p-0 shrink-0" placeholder="📌" maxLength={4} />
                        <div className="flex-1 min-w-0 space-y-1">
                          <Input value={pi.title} onChange={(e) => handlePageItemChange(i, j, 'title', e.target.value)}
                            className="h-7 text-xs font-medium" placeholder="Tên dịch vụ" />
                          <Input value={pi.desc || ''} onChange={(e) => handlePageItemChange(i, j, 'desc', e.target.value)}
                            className="h-6 text-[11px]" placeholder="Mô tả ngắn" />
                          <div className="flex gap-1">
                            {(pageView === 'repair' || pageView === 'pricelist') && (
                              <Input value={pi.price || ''} onChange={(e) => handlePageItemChange(i, j, 'price', e.target.value)}
                                className="h-6 text-[11px] w-24" placeholder="Giá" />
                            )}
                            <Input value={pi.link || ''} onChange={(e) => handlePageItemChange(i, j, 'link', e.target.value)}
                              className="h-6 text-[11px] flex-1" placeholder="Link bài viết, sản phẩm, FB, Zalo... (tuỳ chọn)" />
                          </div>
                        </div>
                        <button type="button" onClick={() => handleRemovePageItem(i, j)}
                          className="h-6 w-6 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0 mt-0.5">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Installment rates editor */}
                  {pageView === 'installment' && (() => {
                    const currentRates = item.installmentRates || DEFAULT_INSTALLMENT_RATES;
                    return (
                      <div className="border-t pt-3 mt-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-medium">💰 Lãi suất ngân hàng ({currentRates.length})</Label>
                          <div className="flex gap-1">
                            {item.installmentRates && (
                              <Button type="button" variant="ghost" size="sm" className="text-[10px] h-6 px-2" onClick={() => handleResetInstallmentRates(i)}>
                                Mặc định
                              </Button>
                            )}
                            <Button type="button" variant="ghost" size="sm" className="text-[10px] h-6 px-2" onClick={() => handleAddInstallmentRate(i)}>
                              <Plus className="h-3 w-3 mr-1" /> Thêm NH
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          {currentRates.map((rt, ri) => (
                            <div key={ri} className={`flex items-center gap-1.5 rounded-md border p-2 ${rt.isBadCredit ? 'border-orange-300 bg-orange-50' : 'bg-background'}`}>
                              <Input value={rt.label} onChange={(e) => handleInstallmentRateChange(i, ri, 'label', e.target.value)}
                                className="h-7 text-xs font-medium flex-1" placeholder="Tên ngân hàng" />
                              <div className="flex items-center gap-1 shrink-0">
                                <Input value={rt.rate} onChange={(e) => handleInstallmentRateChange(i, ri, 'rate', parseFloat(e.target.value) || 0)}
                                  className="h-7 text-xs w-16 text-right" placeholder="1.83" type="number" step="0.01" min="0" />
                                <span className="text-[10px] text-muted-foreground">%</span>
                              </div>
                              <label className="flex items-center gap-1 shrink-0" title="Nợ xấu">
                                <input type="checkbox" checked={!!rt.isBadCredit}
                                  onChange={(e) => handleInstallmentRateChange(i, ri, 'isBadCredit', e.target.checked)}
                                  className="h-3 w-3 rounded" />
                                <span className="text-[10px]">⚠️</span>
                              </label>
                              <button type="button" onClick={() => handleRemoveInstallmentRate(i, ri)}
                                className="h-6 w-6 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0">
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <p className="text-[10px] text-muted-foreground">Lãi suất %/tháng. Đánh dấu ⚠️ cho mục "Góp nợ xấu".</p>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add new item - with type selector */}
      {!showAddMenu ? (
        <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs w-full" onClick={handleAdd}>
          <Plus className="h-3.5 w-3.5" />
          Thêm trang mới
        </Button>
      ) : (
        <div className="rounded-xl border p-3 space-y-3 bg-muted/30">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">Chọn loại nội dung</Label>
            <button type="button" onClick={() => setShowAddMenu(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          
          {/* Type tabs */}
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setAddMenuType('system')}
              className={`flex-1 text-xs py-2 rounded-lg font-medium transition-colors ${addMenuType === 'system' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
            >
              📄 Trang hệ thống
            </button>
            <button
              type="button"
              onClick={() => setAddMenuType('link')}
              className={`flex-1 text-xs py-2 rounded-lg font-medium transition-colors ${addMenuType === 'link' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
            >
              🔗 Link tuỳ chỉnh
            </button>
          </div>

          {addMenuType === 'system' ? (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {SYSTEM_PAGES.filter(p => !['home', 'products', 'news', 'warranty'].includes(p.id)).map(page => {
                const alreadyAdded = currentItems.some(it => it.pageView === page.id || it.id === page.id);
                return (
                  <button
                    key={page.id}
                    type="button"
                    disabled={alreadyAdded}
                    onClick={() => handleAddSystemPage(page)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${alreadyAdded ? 'opacity-40 cursor-not-allowed' : 'hover:bg-accent'}`}
                  >
                    <span>{page.icon}</span>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{page.label}</span>
                      <span className="text-[10px] text-muted-foreground ml-2">{page.description}</span>
                    </div>
                    {alreadyAdded && <span className="text-[10px] text-muted-foreground">Đã thêm</span>}
                  </button>
                );
              })}
            </div>
          ) : (
            <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs w-full" onClick={handleAddCustomLink}>
              <Plus className="h-3.5 w-3.5" />
              Thêm link tuỳ chỉnh
            </Button>
          )}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        💡 "Trang HT" = Trang hệ thống tự tạo nội dung (không cần URL). "Link ngoài" = liên kết đến trang bất kỳ.
      </p>
    </div>
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
  const [hasChanges, setHasChanges] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitializedRef = useRef(false);

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
    custom_trust_badges: null,
    custom_nav_items: null,
    hero_title: null,
    hero_subtitle: null,
    hero_cta: null,
    custom_home_sections: null,
    custom_font_family: null,
    custom_layout_style: null,
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
        custom_trust_badges: (settings as any).custom_trust_badges || null,
        custom_nav_items: (settings as any).custom_nav_items || null,
        hero_title: (settings as any).hero_title || null,
        hero_subtitle: (settings as any).hero_subtitle || null,
        hero_cta: (settings as any).hero_cta || null,
        custom_home_sections: (settings as any).custom_home_sections || null,
        custom_font_family: (settings as any).custom_font_family || null,
        custom_layout_style: (settings as any).custom_layout_style || null,
        order_email_enabled: (settings as any).order_email_enabled ?? false,
        order_email_sender: (settings as any).order_email_sender || '',
        order_email_app_password: (settings as any).order_email_app_password || '',
        order_email_on_confirmed: (settings as any).order_email_on_confirmed ?? false,
        order_email_on_shipping: (settings as any).order_email_on_shipping ?? false,
        order_email_on_warranty: (settings as any).order_email_on_warranty ?? false,
        zalo_enabled: (settings as any).zalo_enabled ?? false,
        zalo_oa_id: (settings as any).zalo_oa_id || '',
        zalo_access_token: (settings as any).zalo_access_token || '',
        zalo_on_export: (settings as any).zalo_on_export ?? false,
      } as any);
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
    setHasChanges(true);
  };

  const handleRemoveAddress = (index: number) => {
    const current = formData.additional_addresses || [];
    setFormData(prev => ({ 
      ...prev, 
      additional_addresses: current.filter((_, i) => i !== index) 
    }));
    setHasChanges(true);
  };

  const handleAddressChange = (index: number, value: string) => {
    const current = formData.additional_addresses || [];
    const updated = [...current];
    updated[index] = value;
    setFormData(prev => ({ ...prev, additional_addresses: updated }));
    setHasChanges(true);
  };

  const handleChange = (field: keyof TenantLandingSettings, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  // Auto-save: debounce 1.5s after any change
  useEffect(() => {
    if (!hasChanges || !isInitializedRef.current) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      updateSettings.mutateAsync(formData).then(() => {
        setHasChanges(false);
        toast({ title: '✓ Đã tự động lưu' });
      }).catch(() => {
        toast({ title: 'Lỗi', description: 'Không thể lưu. Vui lòng thử lại.', variant: 'destructive' });
      });
    }, 1500);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [formData, hasChanges]);

  // Mark initialized after first settings load
  useEffect(() => {
    if (settings && !isInitializedRef.current) {
      setTimeout(() => { isInitializedRef.current = true; }, 500);
    }
  }, [settings]);

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
                Bật lên để khách hàng đặt hàng online, tắt sẽ không đặt hàng được
              </p>
            </div>
            <Switch
              checked={formData.is_enabled}
              onCheckedChange={(checked) => handleChange('is_enabled', checked)}
            />
          </div>

          <Separator className="my-3" />

          {/* Email tự động đơn hàng */}
          <OrderEmailConfigSection formData={formData} handleChange={handleChange} tenantId={tenant?.id || null} onSave={() => {
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
            updateSettings.mutateAsync(formData).then(() => {
              setHasChanges(false);
            }).catch(() => {
              toast({ title: 'Lỗi', description: 'Không thể lưu. Vui lòng thử lại.', variant: 'destructive' });
            });
          }} />

          <Separator className="my-3" />

          {/* Zalo OA gửi tin nhắn tự động */}
          <ZaloOAConfigSection formData={formData} handleChange={handleChange} tenantId={tenant?.id || null} onSave={() => {
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
            updateSettings.mutateAsync(formData).then(() => {
              setHasChanges(false);
            }).catch(() => {
              toast({ title: 'Lỗi', description: 'Không thể lưu. Vui lòng thử lại.', variant: 'destructive' });
            });
          }} />
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
            onSelect={(id) => {
              handleChange('website_template' as any, id);
              // Auto-apply industry nav items when template changes
              const fullNav = getFullNavItems(id);
              setFormData(prev => ({ ...prev, custom_nav_items: fullNav }));
              setHasChanges(true);
            }}
            editableSettings={{
              custom_trust_badges: (formData as any).custom_trust_badges || null,
            }}
            onSettingsChange={(editSettings) => {
              if (editSettings.custom_trust_badges !== undefined) {
                setFormData(prev => ({ ...prev, custom_trust_badges: editSettings.custom_trust_badges as any }));
                setHasChanges(true);
              }
            }}
          />
        </CardContent>
      </Card>

      {/* Menu Website */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MenuIcon className="h-4 w-4" />
            Menu Website
          </CardTitle>
          <CardDescription>
            Tuỳ chỉnh các mục menu hiển thị trên website. Hệ thống tự gợi ý menu phù hợp theo ngành nghề.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <NavMenuEditor
            templateId={(formData as any).website_template || 'phone_store'}
            customNavItems={(formData as any).custom_nav_items}
            onChange={(items) => { setFormData(prev => ({ ...prev, custom_nav_items: items })); setHasChanges(true); }}
          />
        </CardContent>
      </Card>

      {/* Phase 3: Hero Text Customization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PanelTop className="h-4 w-4" />
            Nội dung Banner chính
          </CardTitle>
          <CardDescription>
            Tuỳ chỉnh tiêu đề, mô tả và nút CTA trên banner trang chủ. Để trống để dùng mặc định theo ngành.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(() => {
            const templateId = (formData as any).website_template || 'phone_store';
            const config = getIndustryConfig(templateId);
            return (
              <>
                <div className="space-y-2">
                  <Label>Tiêu đề chính</Label>
                  <Input
                    value={(formData as any).hero_title || ''}
                    onChange={(e) => handleChange('hero_title' as any, e.target.value || null)}
                    placeholder={config.heroTitle}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mô tả phụ</Label>
                  <Input
                    value={(formData as any).hero_subtitle || ''}
                    onChange={(e) => handleChange('hero_subtitle' as any, e.target.value || null)}
                    placeholder={config.heroSubtitle}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nút kêu gọi hành động (CTA)</Label>
                  <Input
                    value={(formData as any).hero_cta || ''}
                    onChange={(e) => handleChange('hero_cta' as any, e.target.value || null)}
                    placeholder={config.heroCta}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  💡 Để trống sẽ sử dụng nội dung mặc định: "{config.heroTitle}" / "{config.heroCta}"
                </p>
              </>
            );
          })()}
        </CardContent>
      </Card>

      {/* Phase 3: Layout Style & Font Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="h-4 w-4" />
            Phong cách giao diện
          </CardTitle>
          <CardDescription>
            Thay đổi kiểu bố cục và phông chữ. Hệ thống tự chọn phong cách phù hợp theo ngành nghề.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Kiểu bố cục (Layout Style)</Label>
            <Select
              value={(formData as any).custom_layout_style || '_auto_'}
              onValueChange={(val) => handleChange('custom_layout_style' as any, val === '_auto_' ? null : val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tự động theo ngành" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_auto_">🤖 Tự động theo ngành</SelectItem>
                <SelectItem value="apple">🍎 Apple – Tối giản, cao cấp</SelectItem>
                <SelectItem value="tgdd">🛒 TGDĐ – Grid, badge, giá nổi bật</SelectItem>
                <SelectItem value="hasaki">💄 Hasaki – Flash sale, deal sốc</SelectItem>
                <SelectItem value="nike">👟 Nike – Bold, lifestyle</SelectItem>
                <SelectItem value="canifa">👗 Canifa – Thanh lịch, BST</SelectItem>
                <SelectItem value="shopee">🛍️ Shopee – Marketplace, đa danh mục</SelectItem>
                <SelectItem value="minimal">✨ Minimal – Đơn giản, dịch vụ</SelectItem>
                <SelectItem value="luxury">💎 Luxury – Sang trọng, serif</SelectItem>
                <SelectItem value="organic">🌿 Organic – Tự nhiên, organic</SelectItem>
              </SelectContent>
            </Select>
            {(() => {
              const templateId = (formData as any).website_template || 'phone_store';
              const config = getIndustryConfig(templateId);
              return (
                <p className="text-[10px] text-muted-foreground">
                  Ngành "{templateId}" mặc định dùng phong cách: <strong>{config.layoutStyle}</strong>
                  {config.brandInspiration && <> ({config.brandInspiration})</>}
                </p>
              );
            })()}
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Type className="h-4 w-4" />
              Phông chữ
            </Label>
            <Select
              value={(formData as any).custom_font_family || '_auto_'}
              onValueChange={(val) => handleChange('custom_font_family' as any, val === '_auto_' ? null : val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tự động theo ngành" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_auto_">🤖 Tự động theo ngành</SelectItem>
                <SelectItem value='-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'>SF Pro – Apple (Mặc định)</SelectItem>
                <SelectItem value='"Inter", system-ui, sans-serif'>Inter – Hiện đại, rõ ràng</SelectItem>
                <SelectItem value='"Nunito Sans", system-ui, sans-serif'>Nunito Sans – Tròn, thân thiện</SelectItem>
                <SelectItem value='"Playfair Display", "Georgia", serif'>Playfair Display – Sang trọng, serif</SelectItem>
                <SelectItem value='"Cormorant Garamond", "Georgia", serif'>Cormorant Garamond – Cổ điển, quý phái</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Phase 3: Homepage Section Manager */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Layout className="h-4 w-4" />
            Bố cục trang chủ
          </CardTitle>
          <CardDescription>
            Bật/tắt và sắp xếp thứ tự các mục hiển thị trên trang chủ website
          </CardDescription>
        </CardHeader>
        <CardContent>
          <HomeSectionManager
            templateId={(formData as any).website_template || 'phone_store'}
            customSections={(formData as any).custom_home_sections || null}
            onChange={(sections) => { setFormData(prev => ({ ...prev, custom_home_sections: sections as any })); setHasChanges(true); }}
            customProductTabs={(formData as any).custom_product_tabs || []}
            onTabsChange={(tabs) => { setFormData(prev => ({ ...prev, custom_product_tabs: tabs as any })); setHasChanges(true); }}
          />
        </CardContent>
      </Card>

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



      {/* Tuỳ chỉnh màu sắc & Trust Badges */}
      <Card data-tour="landing-color-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="h-4 w-4" />
            Tuỳ chỉnh giao diện
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
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

          <Separator />

          {/* Trust Badges */}
          <TrustBadgeEditor
            badges={(formData as any).custom_trust_badges}
            defaultBadges={getIndustryConfig((formData as any).website_template || 'phone_store').trustBadges}
            onChange={(badges) => handleChange('custom_trust_badges' as any, badges)}
          />
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

      {/* Auto-save indicator */}
      {updateSettings.isPending && (
        <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Đang lưu...
        </div>
      )}
    </div>
  );
}
