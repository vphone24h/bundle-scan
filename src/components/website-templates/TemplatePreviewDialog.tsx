import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { WebsiteTemplate } from '@/lib/websiteTemplates';
import { TEMPLATE_SAMPLE_PRODUCTS, SampleProduct } from '@/lib/templateSampleProducts';
import { getIndustryConfig, IndustryConfig } from '@/lib/industryConfig';
import {
  Check, Shield, Award, Truck, CreditCard, Clock, Star,
  Phone, Store, Search, Package, ShoppingBag, MessageCircle,
} from 'lucide-react';

interface TemplatePreviewDialogProps {
  template: WebsiteTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (templateId: string) => void;
  isSelected: boolean;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  Shield: <Shield className="h-5 w-5" />,
  Award: <Award className="h-5 w-5" />,
  Truck: <Truck className="h-5 w-5" />,
  CreditCard: <CreditCard className="h-5 w-5" />,
  Clock: <Clock className="h-5 w-5" />,
  Star: <Star className="h-5 w-5" />,
};

export function TemplatePreviewDialog({
  template,
  open,
  onOpenChange,
  onSelect,
  isSelected,
}: TemplatePreviewDialogProps) {
  if (!template) return null;

  const config = getIndustryConfig(template.id);
  const sampleProducts = TEMPLATE_SAMPLE_PRODUCTS[template.id] || [];
  const accent = config.accentColor;

  const handleSelect = () => {
    onSelect(template.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg p-0 gap-0 max-h-[90vh] overflow-hidden flex flex-col">
        {/* === Actual store template preview === */}
        <div className="flex-1 overflow-y-auto bg-white text-[#1d1d1f]" style={{ fontFamily: config.fontFamily }}>

          {/* HEADER - exact match UniversalStoreTemplate */}
          <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-xl border-b border-black/5">
            <div className="px-4">
              <div className="flex items-center justify-between h-11">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: accent }}>
                    <Store className="h-3.5 w-3.5 text-white" />
                  </div>
                  <span className="font-semibold text-xs tracking-tight">{template.name}</span>
                </div>
                <nav className="flex items-center gap-0.5">
                  {[config.navLabels.home, config.navLabels.products, config.navLabels.warranty].map((label, i) => (
                    <span
                      key={label}
                      className="px-2.5 py-1 text-[10px] font-medium rounded-full"
                      style={i === 0 ? { backgroundColor: '#1d1d1f', color: 'white' } : { color: '#86868b' }}
                    >
                      {label}
                    </span>
                  ))}
                </nav>
              </div>
            </div>
          </header>

          {/* HERO BANNER - matches default hero in UniversalStoreTemplate */}
          <section className="relative overflow-hidden text-white" style={{ background: config.heroGradient }}>
            <div className="px-6 py-12 text-center">
              <p className="text-[10px] font-medium text-white/60 tracking-widest uppercase mb-2">
                {template.name}
              </p>
              <h1 className="text-2xl font-bold tracking-tight mb-2">
                {config.heroTitle}
              </h1>
              <p className="text-xs text-white/70 mb-5 max-w-xs mx-auto">
                {config.heroSubtitle}
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  className="text-white rounded-full px-6 py-2 text-xs font-medium"
                  style={{ backgroundColor: accent }}
                >
                  {config.heroCta}
                </button>
                <button className="border border-white/30 text-white rounded-full px-6 py-2 text-xs font-medium bg-transparent">
                  Xem chi tiết
                </button>
              </div>
            </div>
          </section>

          {/* TRUST BADGES - exact section from UniversalStoreTemplate */}
          <section className="border-b border-black/5">
            <div className="px-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                {config.trustBadges.slice(0, 4).map((badge, i) => (
                  <div key={i} className="flex flex-col items-center text-center gap-1.5 p-2">
                    <div style={{ color: accent }}>
                      {ICON_MAP[badge.icon] || <Shield className="h-5 w-5" />}
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold">{badge.title}</p>
                      <p className="text-[9px] text-[#86868b]">{badge.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* FEATURED PRODUCTS - matches product grid in UniversalStoreTemplate */}
          <section className="py-6 bg-white">
            <div className="px-4">
              <div className="text-center mb-5">
                <h2 className="text-base font-bold tracking-tight">{config.productSectionTitle}</h2>
                <p className="text-[10px] text-[#86868b] mt-0.5">{config.productSectionSubtitle}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {sampleProducts.slice(0, 4).map((product, i) => (
                  <PreviewProductCard key={i} product={product} accentColor={accent} />
                ))}
              </div>
              <div className="text-center mt-5">
                <button
                  className="rounded-full px-6 py-2 text-[10px] font-medium border"
                  style={{ borderColor: accent, color: accent }}
                >
                  Xem tất cả sản phẩm →
                </button>
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
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
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

/** Product card matching UniversalStoreTemplate's ProductCard style */
function PreviewProductCard({ product, accentColor }: { product: SampleProduct; accentColor: string }) {
  return (
    <div className="bg-[#f5f5f7] rounded-2xl overflow-hidden text-left">
      {/* Product image */}
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
