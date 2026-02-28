import { useState } from 'react';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WebsiteTemplate } from '@/lib/websiteTemplates';
import { TEMPLATE_SAMPLE_PRODUCTS, SampleProduct } from '@/lib/templateSampleProducts';
import { getIndustryConfig, IndustryTrustBadge } from '@/lib/industryConfig';
import {
  Check, Shield, Award, Truck, CreditCard, Clock, Star,
  Phone, Store, MessageCircle, Pencil, X, RotateCcw,
  Menu, Search, ChevronDown,
} from 'lucide-react';

interface EditableSettings {
  custom_trust_badges?: { icon: string; title: string; desc: string }[] | null;
  hero_title?: string;
  hero_subtitle?: string;
  hero_cta?: string;
}

interface TemplatePreviewDialogProps {
  template: WebsiteTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (templateId: string) => void;
  isSelected: boolean;
  editableSettings?: EditableSettings | null;
  onSettingsChange?: (settings: EditableSettings) => void;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  Shield: <Shield className="h-5 w-5" />,
  Award: <Award className="h-5 w-5" />,
  Truck: <Truck className="h-5 w-5" />,
  CreditCard: <CreditCard className="h-5 w-5" />,
  Clock: <Clock className="h-5 w-5" />,
  Star: <Star className="h-5 w-5" />,
};

const ICON_MAP_SM: Record<string, React.ReactNode> = {
  Shield: <Shield className="h-3.5 w-3.5" />,
  Award: <Award className="h-3.5 w-3.5" />,
  Truck: <Truck className="h-3.5 w-3.5" />,
  CreditCard: <CreditCard className="h-3.5 w-3.5" />,
  Clock: <Clock className="h-3.5 w-3.5" />,
  Star: <Star className="h-3.5 w-3.5" />,
};

const BADGE_ICON_OPTIONS = [
  { value: 'Shield', label: 'Bảo vệ' },
  { value: 'Award', label: 'Chứng nhận' },
  { value: 'Truck', label: 'Giao hàng' },
  { value: 'CreditCard', label: 'Thanh toán' },
  { value: 'Clock', label: 'Thời gian' },
  { value: 'Star', label: 'Sao' },
];

export function TemplatePreviewDialog({
  template,
  open,
  onOpenChange,
  onSelect,
  isSelected,
  editableSettings,
  onSettingsChange,
}: TemplatePreviewDialogProps) {
  const [editMode, setEditMode] = useState(false);

  if (!template) return null;

  const config = getIndustryConfig(template.id);
  const sampleProducts = TEMPLATE_SAMPLE_PRODUCTS[template.id] || [];
  const accent = config.accentColor;

  // Editable values with fallbacks
  const trustBadges = editableSettings?.custom_trust_badges || config.trustBadges;
  const heroTitle = editableSettings?.hero_title || config.heroTitle;
  const heroSubtitle = editableSettings?.hero_subtitle || config.heroSubtitle;
  const heroCta = editableSettings?.hero_cta || config.heroCta;

  const canEdit = !!onSettingsChange;

  const handleSelect = () => {
    onSelect(template.id);
    onOpenChange(false);
  };

  const updateSetting = (key: keyof EditableSettings, value: unknown) => {
    if (!onSettingsChange) return;
    onSettingsChange({ ...editableSettings, [key]: value });
  };

  const handleBadgeChange = (index: number, field: keyof IndustryTrustBadge, value: string) => {
    const current = [...trustBadges];
    current[index] = { ...current[index], [field]: value };
    updateSetting('custom_trust_badges', current);
  };

  const handleResetBadges = () => {
    updateSetting('custom_trust_badges', null);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setEditMode(false); onOpenChange(o); }}>
      <DialogContent className="max-w-md sm:max-w-lg p-0 gap-0 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Edit mode toggle */}
        {canEdit && (
          <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/50 shrink-0">
            <span className="text-xs font-medium text-muted-foreground">
              {editMode ? '✏️ Đang chỉnh sửa — nhấn vào nội dung để sửa' : 'Xem trước mẫu website'}
            </span>
            <Button
              size="sm"
              className="h-7 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => setEditMode(!editMode)}
            >
              {editMode ? <><X className="h-3 w-3" /> Xong</> : <><Pencil className="h-3 w-3" /> Chỉnh sửa</>}
            </Button>
          </div>
        )}

        {/* === Actual store template preview === */}
        <div className="flex-1 overflow-y-auto bg-white text-[#1d1d1f]" style={{ fontFamily: config.fontFamily }}>

          {/* HEADER - matching new layout */}
          <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-xl border-b border-black/5">
            <div className="px-4">
              <div className="flex items-center justify-between h-11">
                <div className="flex items-center gap-2.5">
                  <Menu className="h-4 w-4 text-[#86868b]" />
                  <span className="font-semibold text-xs tracking-tight">{template.name}</span>
                </div>
                <Search className="h-4 w-4 text-[#86868b]" />
              </div>
            </div>
          </header>

          {/* HERO BANNER - left aligned */}
          <section className="relative overflow-hidden text-white" style={{ background: config.heroGradient }}>
            <div className="px-6 py-10">
              {editMode ? (
                <input
                  className="bg-white/10 border border-white/30 rounded-lg text-xl font-bold tracking-tight mb-2 w-full px-2 py-1 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/40"
                  value={heroTitle}
                  onChange={(e) => updateSetting('hero_title', e.target.value)}
                  placeholder="Tiêu đề hero"
                />
              ) : (
                <h1 className="text-xl font-bold tracking-tight mb-2">{heroTitle}</h1>
              )}

              {editMode ? (
                <input
                  className="bg-white/10 border border-white/30 rounded-lg text-xs mb-4 w-full px-2 py-1 text-white/70 placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/40"
                  value={heroSubtitle}
                  onChange={(e) => updateSetting('hero_subtitle', e.target.value)}
                  placeholder="Mô tả phụ"
                />
              ) : (
                <p className="text-xs text-white/70 mb-4 max-w-xs">{heroSubtitle}</p>
              )}

              {editMode ? (
                <input
                  className="bg-white/10 border border-white/30 rounded-full text-xs font-medium px-6 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/40"
                  value={heroCta}
                  onChange={(e) => updateSetting('hero_cta', e.target.value)}
                  placeholder="Nút CTA"
                />
              ) : (
                <button
                  className="text-white rounded-full px-6 py-2 text-xs font-medium"
                  style={{ backgroundColor: accent }}
                >
                  {heroCta}
                </button>
              )}
            </div>
          </section>

          {/* TRUST BADGES - horizontal layout */}
          <section className="border-b border-black/5">
            <div className="px-4 py-4">
              {editMode && (
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-semibold text-[#86868b] uppercase tracking-wider">Biểu tượng cam kết</span>
                  <button
                    onClick={handleResetBadges}
                    className="text-[9px] text-[#86868b] hover:text-[#1d1d1f] flex items-center gap-1 transition-colors"
                  >
                    <RotateCcw className="h-2.5 w-2.5" /> Mặc định
                  </button>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                {trustBadges.slice(0, 4).map((badge, i) => (
                  <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-xl">
                    {editMode ? (
                      <EditableBadge
                        badge={badge}
                        accentColor={accent}
                        onChange={(field, value) => handleBadgeChange(i, field, value)}
                      />
                    ) : (
                      <>
                        <div className="shrink-0" style={{ color: accent }}>
                          {ICON_MAP[badge.icon] || <Shield className="h-5 w-5" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold leading-tight">{badge.title}</p>
                          <p className="text-[9px] text-[#86868b] leading-tight">{badge.desc}</p>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* FEATURED PRODUCTS */}
          <section className="py-5 bg-white">
            <div className="px-4">
              <div className="flex items-end justify-between mb-4">
                <div>
                  <h2 className="text-sm font-bold tracking-tight">{config.productSectionTitle}</h2>
                  <p className="text-[10px] text-[#86868b] mt-0.5">{config.productSectionSubtitle}</p>
                </div>
                <span className="text-[10px] font-medium flex items-center gap-0.5" style={{ color: accent }}>
                  Xem tất cả <ChevronDown className="h-2.5 w-2.5 -rotate-90" />
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {sampleProducts.slice(0, 4).map((product, i) => (
                  <PreviewProductCard key={i} product={product} accentColor={accent} />
                ))}
              </div>
            </div>
          </section>

          {/* FOOTER */}
          <footer className="py-4 border-t border-black/5 bg-[#f5f5f7]">
            <div className="text-center">
              <p className="text-[10px] text-[#86868b]">© 2025 {template.name}</p>
            </div>
          </footer>

          {/* STICKY BUY BAR */}
          <div className="bg-white/90 backdrop-blur-xl border-t border-black/5 py-2 px-4">
            <div className="flex items-center gap-2">
              <button
                className="flex-1 text-white rounded-xl py-2 text-center text-xs font-medium flex items-center justify-center gap-1.5"
                style={{ backgroundColor: accent }}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                {config.stickyBarLabels.chat}
              </button>
              <button className="flex-1 bg-[#1d1d1f] text-white rounded-xl py-2 text-center text-xs font-medium flex items-center justify-center gap-1.5">
                <Phone className="h-3.5 w-3.5" />
                {config.stickyBarLabels.call}
              </button>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <DialogFooter className="flex-row gap-2 p-4 border-t bg-background shrink-0">
          <Button variant="outline" onClick={() => { setEditMode(false); onOpenChange(false); }} className="flex-1">
            Đóng
          </Button>
          <Button
            onClick={handleSelect}
            className="flex-1"
            variant={isSelected ? 'secondary' : 'default'}
          >
            {isSelected ? (
              <><Check className="h-4 w-4 mr-1" /> Đã chọn</>
            ) : (
              'Chọn mẫu này'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Editable trust badge inline */
function EditableBadge({
  badge,
  accentColor,
  onChange,
}: {
  badge: IndustryTrustBadge;
  accentColor: string;
  onChange: (field: keyof IndustryTrustBadge, value: string) => void;
}) {
  return (
    <div className="w-full space-y-1.5">
      {/* Icon selector */}
      <div className="flex justify-center">
        <select
          value={badge.icon}
          onChange={(e) => onChange('icon', e.target.value)}
          className="text-[9px] bg-transparent border border-black/10 rounded px-1 py-0.5 text-center appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-black/20"
          style={{ color: accentColor }}
        >
          {BADGE_ICON_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      <div style={{ color: accentColor }} className="flex justify-center">
        {ICON_MAP[badge.icon] || <Shield className="h-5 w-5" />}
      </div>
      <input
        className="w-full text-center text-[10px] font-semibold bg-transparent border-b border-dashed border-black/20 focus:border-black/50 focus:outline-none py-0.5"
        value={badge.title}
        onChange={(e) => onChange('title', e.target.value)}
        placeholder="Tiêu đề"
      />
      <input
        className="w-full text-center text-[9px] text-[#86868b] bg-transparent border-b border-dashed border-black/10 focus:border-black/30 focus:outline-none py-0.5"
        value={badge.desc}
        onChange={(e) => onChange('desc', e.target.value)}
        placeholder="Mô tả"
      />
    </div>
  );
}

/** Product card matching UniversalStoreTemplate's ProductCard style */
function PreviewProductCard({ product, accentColor }: { product: SampleProduct; accentColor: string }) {
  return (
    <div className="bg-[#f5f5f7] rounded-2xl overflow-hidden text-left">
      <div className="relative">
        <div className="w-full aspect-square bg-[#e8e8ed] flex items-center justify-center">
          <span className="text-4xl">{product.image}</span>
        </div>
        {product.tag && (
          <div className="absolute top-1.5 left-1.5 text-white text-[8px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: accentColor }}>
            {product.tag}
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="font-medium text-[10px] line-clamp-2 min-h-[2rem] leading-tight">{product.name}</p>
        <p className="font-bold text-xs mt-1" style={{ color: accentColor }}>{product.price}</p>
      </div>
    </div>
  );
}
