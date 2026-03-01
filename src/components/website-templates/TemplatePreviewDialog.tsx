import { useState } from 'react';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { WebsiteTemplate } from '@/lib/websiteTemplates';
import { TEMPLATE_SAMPLE_PRODUCTS, SampleProduct } from '@/lib/templateSampleProducts';
import { getIndustryConfig, IndustryTrustBadge, LayoutStyle } from '@/lib/industryConfig';
import {
  Check, Shield, Award, Truck, CreditCard, Clock, Star,
  Phone, MessageCircle, Pencil, X, RotateCcw, Zap,
  Menu, Search, ChevronDown, ShoppingBag,
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

const BADGE_ICON_OPTIONS = [
  { value: 'Shield', label: 'Bảo vệ' },
  { value: 'Award', label: 'Chứng nhận' },
  { value: 'Truck', label: 'Giao hàng' },
  { value: 'CreditCard', label: 'Thanh toán' },
  { value: 'Clock', label: 'Thời gian' },
  { value: 'Star', label: 'Sao' },
];

export function TemplatePreviewDialog({
  template, open, onOpenChange, onSelect, isSelected,
  editableSettings, onSettingsChange,
}: TemplatePreviewDialogProps) {
  const [editMode, setEditMode] = useState(false);

  if (!template) return null;

  const config = getIndustryConfig(template.id);
  const sampleProducts = TEMPLATE_SAMPLE_PRODUCTS[template.id] || [];
  const accent = config.accentColor;
  const layout = config.layoutStyle;

  const trustBadges = editableSettings?.custom_trust_badges || config.trustBadges;
  const heroTitle = editableSettings?.hero_title || config.heroTitle;
  const heroSubtitle = editableSettings?.hero_subtitle || config.heroSubtitle;
  const heroCta = editableSettings?.hero_cta || config.heroCta;

  const canEdit = !!onSettingsChange;

  const handleSelect = () => { onSelect(template.id); onOpenChange(false); };

  const updateSetting = (key: keyof EditableSettings, value: unknown) => {
    if (!onSettingsChange) return;
    onSettingsChange({ ...editableSettings, [key]: value });
  };

  const handleBadgeChange = (index: number, field: keyof IndustryTrustBadge, value: string) => {
    const current = [...trustBadges];
    current[index] = { ...current[index], [field]: value };
    updateSetting('custom_trust_badges', current);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setEditMode(false); onOpenChange(o); }}>
      <DialogContent className="max-w-md sm:max-w-lg p-0 gap-0 max-h-[90vh] overflow-hidden flex flex-col [&>button.absolute]:hidden">
        {canEdit && (
          <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/50 shrink-0">
            <span className="text-xs font-medium text-muted-foreground">
              {editMode ? '✏️ Đang chỉnh sửa' : 'Xem trước mẫu website'}
            </span>
            <Button size="sm" className="h-7 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setEditMode(!editMode)}>
              {editMode ? <><X className="h-3 w-3" /> Xong</> : <><Pencil className="h-3 w-3" /> Chỉnh sửa</>}
            </Button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto bg-white text-[#1d1d1f]" style={{ fontFamily: config.fontFamily }}>
          {/* HEADER */}
          <PreviewHeader layout={layout} templateName={template.name} />

          {/* HERO */}
          <PreviewHero layout={layout} accent={accent} heroTitle={heroTitle} heroSubtitle={heroSubtitle} heroCta={heroCta} heroGradient={config.heroGradient} brandInspiration={config.brandInspiration} editMode={editMode} onUpdate={updateSetting} />

          {/* TRUST BADGES */}
          <PreviewTrustBadges layout={layout} badges={trustBadges} accent={accent} editMode={editMode} onBadgeChange={handleBadgeChange} onReset={() => updateSetting('custom_trust_badges', null)} />

          {/* PRODUCTS */}
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
              <div className={getPreviewGridClass(layout)}>
                {sampleProducts.slice(0, 4).map((product, i) => (
                  <PreviewProductCard key={i} product={product} accentColor={accent} layout={layout} />
                ))}
              </div>
            </div>
          </section>

          {/* FOOTER */}
          <footer className={getFooterClass(layout)}>
            <div className="text-center">
              <p className={layout === 'luxury' ? 'text-[10px] text-amber-200/60' : 'text-[10px] text-[#86868b]'}>© 2025 {template.name}</p>
            </div>
          </footer>

          {/* STICKY BAR */}
          <div className="bg-white/90 backdrop-blur-xl border-t border-black/5 py-2 px-4">
            <div className="flex items-center gap-2">
              <button className="flex-1 text-white rounded-xl py-2 text-center text-xs font-medium flex items-center justify-center gap-1.5" style={{ backgroundColor: accent }}>
                <MessageCircle className="h-3.5 w-3.5" /> {config.stickyBarLabels.chat}
              </button>
              <button className="flex-1 bg-[#1d1d1f] text-white rounded-xl py-2 text-center text-xs font-medium flex items-center justify-center gap-1.5">
                <Phone className="h-3.5 w-3.5" /> {config.stickyBarLabels.call}
              </button>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-row gap-2 p-4 border-t bg-background shrink-0">
          <Button variant="outline" onClick={() => { setEditMode(false); onOpenChange(false); }} className="flex-1">Đóng</Button>
          <Button onClick={handleSelect} className="flex-1" variant={isSelected ? 'secondary' : 'default'}>
            {isSelected ? <><Check className="h-4 w-4 mr-1" /> Đã chọn</> : 'Chọn mẫu này'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// === Layout-specific Preview Header ===
function PreviewHeader({ layout, templateName }: { layout: LayoutStyle; templateName: string }) {
  const headerBg = layout === 'nike' ? 'bg-black text-white' :
                   layout === 'luxury' ? 'bg-[#0f0f23] text-amber-100' :
                   layout === 'tgdd' ? 'bg-yellow-400 text-black' :
                   layout === 'hasaki' ? 'bg-gradient-to-r from-pink-500 to-red-500 text-white' :
                   'bg-white/80 backdrop-blur-xl';
  const iconColor = layout === 'nike' || layout === 'luxury' || layout === 'hasaki' ? 'text-white/60' :
                    layout === 'tgdd' ? 'text-black/60' : 'text-[#86868b]';

  return (
    <header className={`sticky top-0 z-10 border-b border-black/5 ${headerBg}`}>
      <div className="px-4">
        <div className="flex items-center justify-between h-11">
          <div className="flex items-center gap-2.5">
            <Menu className={`h-4 w-4 ${iconColor}`} />
            <span className="font-semibold text-xs tracking-tight">{templateName}</span>
          </div>
          <Search className={`h-4 w-4 ${iconColor}`} />
        </div>
      </div>
    </header>
  );
}

// === Layout-specific Preview Hero ===
function PreviewHero({ layout, accent, heroTitle, heroSubtitle, heroCta, heroGradient, brandInspiration, editMode, onUpdate }: {
  layout: LayoutStyle; accent: string; heroTitle: string; heroSubtitle: string; heroCta: string;
  heroGradient: string; brandInspiration?: string; editMode: boolean;
  onUpdate: (key: keyof EditableSettings, value: unknown) => void;
}) {
  const getBackground = () => {
    switch (layout) {
      case 'tgdd': return 'linear-gradient(135deg, #ffd700 0%, #ff6b00 100%)';
      case 'hasaki': return 'linear-gradient(135deg, #ff6b81 0%, #ee5a24 50%, #ff4757 100%)';
      case 'nike': return '#000000';
      case 'luxury': return 'linear-gradient(135deg, #1a1a2e 0%, #0f0f23 50%, #16213e 100%)';
      default: return heroGradient;
    }
  };

  return (
    <section className="relative overflow-hidden text-white" style={{ background: getBackground() }}>
      <div className={`px-6 ${layout === 'luxury' ? 'py-14 text-center' : layout === 'nike' ? 'py-12' : 'py-10'}`}>
        {layout === 'tgdd' && (
          <div className="inline-flex items-center gap-1 bg-red-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full mb-2">
            <Zap className="h-2.5 w-2.5" /> DEAL SỐC
          </div>
        )}
        {layout === 'hasaki' && (
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-1 bg-white/20 backdrop-blur rounded-full px-2 py-0.5">
              <Zap className="h-2.5 w-2.5 text-yellow-300" />
              <span className="text-[9px] font-bold">FLASH SALE</span>
            </div>
            <div className="flex gap-1">
              {['05','23','47'].map((v, i) => (
                <span key={i} className="bg-white text-red-600 font-mono font-bold text-[10px] px-1.5 py-0.5 rounded min-w-[24px] text-center">{v}</span>
              ))}
            </div>
          </div>
        )}
        {layout === 'luxury' && <p className="text-[8px] tracking-[0.4em] uppercase text-amber-400/80 mb-3">✦ {brandInspiration || 'Premium'} ✦</p>}
        {layout === 'nike' && <p className="text-[9px] tracking-[0.3em] uppercase text-white/50 mb-2">{brandInspiration || 'New Collection'}</p>}

        {editMode ? (
          <input className="bg-white/10 border border-white/30 rounded-lg w-full px-2 py-1 text-white placeholder:text-white/40 focus:outline-none text-xl font-bold tracking-tight mb-2"
            value={heroTitle} onChange={(e) => onUpdate('hero_title', e.target.value)} placeholder="Tiêu đề" />
        ) : (
          <h1 className={
            layout === 'nike' ? 'text-2xl font-black tracking-tighter mb-2 leading-[0.9]' :
            layout === 'luxury' ? 'text-xl font-light tracking-wide mb-2' :
            'text-xl font-bold tracking-tight mb-2'
          }>{heroTitle}</h1>
        )}

        {layout === 'luxury' && !editMode && <div className="w-10 h-px bg-amber-400/40 mx-auto mb-2" />}

        {editMode ? (
          <input className="bg-white/10 border border-white/30 rounded-lg text-xs w-full px-2 py-1 text-white/70 placeholder:text-white/30 focus:outline-none mb-3"
            value={heroSubtitle} onChange={(e) => onUpdate('hero_subtitle', e.target.value)} placeholder="Mô tả" />
        ) : (
          <p className={`text-xs mb-4 max-w-xs ${layout === 'luxury' ? 'text-white/50 mx-auto' : 'text-white/70'}`}>{heroSubtitle}</p>
        )}

        {editMode ? (
          <input className="bg-white/10 border border-white/30 rounded-full text-xs font-medium px-6 py-2 text-white placeholder:text-white/40 focus:outline-none"
            value={heroCta} onChange={(e) => onUpdate('hero_cta', e.target.value)} placeholder="Nút CTA" />
        ) : (
          <button className={getCtaClass(layout)} style={getCtaStyle(layout, accent)}>
            {layout === 'hasaki' && <ShoppingBag className="h-3 w-3 mr-1" />}
            {heroCta}
          </button>
        )}
      </div>
    </section>
  );
}

function getCtaClass(layout: LayoutStyle): string {
  switch (layout) {
    case 'nike': return 'bg-white text-black rounded-full px-6 py-2 text-xs font-bold';
    case 'luxury': return 'bg-amber-600 text-white rounded-none px-8 py-2 text-[10px] tracking-[0.15em] uppercase font-medium';
    case 'tgdd': return 'bg-red-600 text-white rounded-lg px-6 py-2 text-xs font-bold shadow-lg';
    case 'hasaki': return 'bg-white text-red-600 rounded-full px-6 py-2 text-xs font-bold shadow-lg flex items-center';
    default: return 'text-white rounded-full px-6 py-2 text-xs font-medium';
  }
}

function getCtaStyle(layout: LayoutStyle, accent: string): React.CSSProperties {
  if (['apple', 'canifa', 'minimal', 'organic', 'shopee'].includes(layout)) return { backgroundColor: accent };
  return {};
}

// === Layout-specific Trust Badges Preview ===
function PreviewTrustBadges({ layout, badges, accent, editMode, onBadgeChange, onReset }: {
  layout: LayoutStyle; badges: IndustryTrustBadge[]; accent: string;
  editMode: boolean; onBadgeChange: (i: number, field: keyof IndustryTrustBadge, value: string) => void;
  onReset: () => void;
}) {
  const sectionClass = layout === 'tgdd' ? 'bg-blue-50 border-b border-blue-100' :
                        layout === 'hasaki' ? 'bg-gradient-to-r from-pink-50 to-red-50 border-b border-pink-100' :
                        layout === 'nike' || layout === 'canifa' ? 'bg-[#f5f5f5] border-b border-black/5' :
                        layout === 'luxury' ? 'bg-[#0f0f23] border-b border-amber-900/20' :
                        'border-b border-black/5';

  const badgeIconColor = layout === 'tgdd' ? 'text-blue-600' :
                          layout === 'hasaki' ? 'text-pink-600' :
                          layout === 'nike' ? 'text-black' :
                          layout === 'luxury' ? 'text-amber-500' : undefined;

  return (
    <section className={sectionClass}>
      <div className="px-4 py-4">
        {editMode && (
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-semibold text-[#86868b] uppercase tracking-wider">Biểu tượng cam kết</span>
            <button onClick={onReset} className="text-[9px] text-[#86868b] hover:text-[#1d1d1f] flex items-center gap-1">
              <RotateCcw className="h-2.5 w-2.5" /> Mặc định
            </button>
          </div>
        )}
        <div className={layout === 'tgdd' || layout === 'hasaki' ? 'flex overflow-x-auto gap-2 scrollbar-hide' : 'grid grid-cols-2 gap-2'}>
          {badges.slice(0, 4).map((badge, i) => (
            <div key={i} className={`flex items-center gap-2.5 p-2.5 rounded-xl ${layout === 'tgdd' ? 'bg-white shrink-0 shadow-sm border border-blue-100' : layout === 'hasaki' ? 'bg-white/80 shrink-0' : ''}`}>
              {editMode ? (
                <EditableBadge badge={badge} accentColor={accent} onChange={(field, value) => onBadgeChange(i, field, value)} />
              ) : (
                <>
                  <div className="shrink-0" style={badgeIconColor ? undefined : { color: accent }}>
                    <span className={badgeIconColor || ''}>{ICON_MAP[badge.icon] || <Shield className="h-5 w-5" />}</span>
                  </div>
                  <div className="min-w-0">
                    <p className={`text-[10px] font-semibold leading-tight ${layout === 'luxury' ? 'text-amber-100/80' : ''}`}>{badge.title}</p>
                    <p className="text-[9px] text-[#86868b] leading-tight">{badge.desc}</p>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function getPreviewGridClass(layout: LayoutStyle): string {
  switch (layout) {
    case 'tgdd': return 'grid grid-cols-2 gap-2';
    case 'nike':
    case 'canifa': return 'grid grid-cols-2 gap-4';
    default: return 'grid grid-cols-2 gap-3';
  }
}

function getFooterClass(layout: LayoutStyle): string {
  switch (layout) {
    case 'luxury': return 'py-4 border-t border-amber-900/20 bg-[#0f0f23]';
    case 'nike': return 'py-4 border-t border-black/10 bg-black text-white';
    default: return 'py-4 border-t border-black/5 bg-[#f5f5f7]';
  }
}

// === Preview Product Card with layout variant ===
function PreviewProductCard({ product, accentColor, layout }: { product: SampleProduct; accentColor: string; layout: LayoutStyle }) {
  switch (layout) {
    case 'tgdd':
      return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden relative">
          {product.tag && <div className="absolute top-0 right-0 z-10 bg-red-600 text-white text-[8px] font-extrabold px-2 py-0.5 rounded-bl-xl">{product.tag}</div>}
          <div className="p-2 bg-gray-50"><div className="w-full aspect-square flex items-center justify-center"><span className="text-3xl">{product.image}</span></div></div>
          <div className="p-2.5 space-y-1">
            <p className="font-medium text-[10px] line-clamp-2 min-h-[2rem]">{product.name}</p>
            <div className="flex items-center gap-0.5">{[1,2,3,4,5].map(i => <Star key={i} className="h-2.5 w-2.5 text-yellow-400 fill-yellow-400" />)}</div>
            <p className="font-extrabold text-xs text-blue-700">{product.price}</p>
            <div className="flex gap-1"><span className="text-[8px] bg-blue-50 text-blue-600 font-semibold px-1 py-0.5 rounded">Trả góp 0%</span></div>
          </div>
        </div>
      );
    case 'hasaki':
      return (
        <div className="bg-white rounded-2xl overflow-hidden border border-pink-100/50">
          <div className="relative"><div className="w-full aspect-square bg-pink-50 flex items-center justify-center"><span className="text-3xl">{product.image}</span></div>
            {product.tag && <div className="absolute top-1.5 left-1.5 bg-gradient-to-r from-red-500 to-pink-500 text-white text-[8px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-0.5"><Zap className="h-2.5 w-2.5" />{product.tag}</div>}
          </div>
          <div className="p-2.5 space-y-1">
            <p className="font-medium text-[10px] line-clamp-2">{product.name}</p>
            <div className="flex items-center gap-0.5">{[1,2,3,4,5].map(i => <Star key={i} className="h-2.5 w-2.5 text-amber-400 fill-amber-400" />)}</div>
            <p className="font-bold text-xs text-red-600">{product.price}</p>
          </div>
        </div>
      );
    case 'nike':
    case 'canifa':
      return (
        <div>
          <div className="rounded-xl bg-[#f5f5f5] overflow-hidden relative">
            <div className="w-full aspect-[3/4] flex items-center justify-center"><span className="text-4xl">{product.image}</span></div>
            {product.tag && <div className="absolute top-2 left-2 bg-black text-white text-[9px] font-bold px-2 py-0.5">{product.tag}</div>}
          </div>
          <div className="pt-2 space-y-0.5">
            <p className="font-semibold text-[11px] line-clamp-1">{product.name}</p>
            <p className="font-bold text-xs">{product.price}</p>
          </div>
        </div>
      );
    case 'luxury':
      return (
        <div className="text-center">
          <div className="bg-[#faf8f5] border border-amber-100/50 overflow-hidden relative">
            <div className="w-full aspect-square flex items-center justify-center"><span className="text-3xl">{product.image}</span></div>
            {product.tag && <div className="absolute top-2 left-2 bg-amber-800 text-amber-100 text-[8px] px-2 py-0.5">{product.tag}</div>}
          </div>
          <div className="pt-2 space-y-0.5">
            <p className="font-light text-[10px] tracking-wide" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>{product.name}</p>
            <p className="font-semibold text-xs text-amber-800">{product.price}</p>
          </div>
        </div>
      );
    default:
      return (
        <div className="bg-[#f5f5f7] rounded-2xl overflow-hidden">
          <div className="relative"><div className="w-full aspect-square bg-[#e8e8ed] flex items-center justify-center"><span className="text-4xl">{product.image}</span></div>
            {product.tag && <div className="absolute top-1.5 left-1.5 text-white text-[8px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: accentColor }}>{product.tag}</div>}
          </div>
          <div className="p-3">
            <p className="font-medium text-[10px] line-clamp-2 min-h-[2rem] leading-tight">{product.name}</p>
            <p className="font-bold text-xs mt-1" style={{ color: accentColor }}>{product.price}</p>
          </div>
        </div>
      );
  }
}

function EditableBadge({ badge, accentColor, onChange }: {
  badge: IndustryTrustBadge; accentColor: string;
  onChange: (field: keyof IndustryTrustBadge, value: string) => void;
}) {
  return (
    <div className="w-full space-y-1.5">
      <div className="flex justify-center">
        <select value={badge.icon} onChange={(e) => onChange('icon', e.target.value)}
          className="text-[9px] bg-transparent border border-black/10 rounded px-1 py-0.5 text-center appearance-none cursor-pointer focus:outline-none"
          style={{ color: accentColor }}>
          {BADGE_ICON_OPTIONS.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
        </select>
      </div>
      <div style={{ color: accentColor }} className="flex justify-center">{ICON_MAP[badge.icon] || <Shield className="h-5 w-5" />}</div>
      <input className="w-full text-center text-[10px] font-semibold bg-transparent border-b border-dashed border-black/20 focus:border-black/50 focus:outline-none py-0.5"
        value={badge.title} onChange={(e) => onChange('title', e.target.value)} placeholder="Tiêu đề" />
      <input className="w-full text-center text-[9px] text-[#86868b] bg-transparent border-b border-dashed border-black/10 focus:border-black/30 focus:outline-none py-0.5"
        value={badge.desc} onChange={(e) => onChange('desc', e.target.value)} placeholder="Mô tả" />
    </div>
  );
}
