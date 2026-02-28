import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { WebsiteTemplate } from '@/lib/websiteTemplates';
import { TEMPLATE_SAMPLE_PRODUCTS } from '@/lib/templateSampleProducts';
import { getIndustryConfig } from '@/lib/industryConfig';
import { cn } from '@/lib/utils';
import { Check, Shield, Award, Truck, CreditCard, Clock, Star, Phone, MessageCircle, Search, Menu, ChevronRight } from 'lucide-react';

interface TemplatePreviewDialogProps {
  template: WebsiteTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (templateId: string) => void;
  isSelected: boolean;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  Shield: <Shield className="h-3.5 w-3.5" />,
  Award: <Award className="h-3.5 w-3.5" />,
  Truck: <Truck className="h-3.5 w-3.5" />,
  CreditCard: <CreditCard className="h-3.5 w-3.5" />,
  Clock: <Clock className="h-3.5 w-3.5" />,
  Star: <Star className="h-3.5 w-3.5" />,
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
        {/* Mini website preview */}
        <div className="flex-1 overflow-y-auto">
          {/* Mock browser frame */}
          <div className="bg-muted/50 border-b px-3 py-2 flex items-center gap-2 sticky top-0 z-10">
            <div className="flex gap-1">
              <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
              <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
              <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 bg-background rounded-md px-3 py-1 text-[10px] text-muted-foreground text-center truncate border">
              {template.name.toLowerCase().replace(/[\s\/]/g, '')}.vkho.vn
            </div>
          </div>

          {/* Mock store navbar */}
          <div className="bg-background border-b px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Menu className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-bold truncate">{template.name}</span>
            </div>
            <Search className="h-4 w-4 text-muted-foreground" />
          </div>

          {/* Hero banner */}
          <div
            className="px-5 py-8 text-white relative overflow-hidden"
            style={{ background: config.heroGradient }}
          >
            <div className="relative z-10">
              <h2 className="text-lg font-bold leading-tight">{config.heroTitle}</h2>
              <p className="text-xs opacity-80 mt-1">{config.heroSubtitle}</p>
              <button
                className="mt-3 px-4 py-1.5 rounded-full text-xs font-semibold"
                style={{ backgroundColor: accent, color: '#fff' }}
              >
                {config.heroCta}
              </button>
            </div>
            {/* Decorative emoji */}
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-5xl opacity-20">
              {template.icon}
            </span>
          </div>

          {/* Trust badges */}
          <div className="grid grid-cols-2 gap-2 p-3">
            {config.trustBadges.slice(0, 4).map((badge, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg bg-muted/50 p-2">
                <div className="shrink-0" style={{ color: accent }}>
                  {ICON_MAP[badge.icon] || <Shield className="h-3.5 w-3.5" />}
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold truncate">{badge.title}</div>
                  <div className="text-[9px] text-muted-foreground truncate">{badge.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Products section */}
          <div className="px-3 pb-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold">{config.productSectionTitle}</h3>
              <span className="text-[10px] flex items-center gap-0.5" style={{ color: accent }}>
                Xem tất cả <ChevronRight className="h-3 w-3" />
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mb-3">{config.productSectionSubtitle}</p>

            {/* Product grid */}
            <div className="grid grid-cols-2 gap-2">
              {sampleProducts.slice(0, 4).map((product, i) => (
                <div key={i} className="rounded-xl border bg-card p-2.5 space-y-1.5">
                  {/* Product image placeholder */}
                  <div className="aspect-square rounded-lg bg-muted/60 flex items-center justify-center">
                    <span className="text-3xl">{product.image}</span>
                  </div>
                  {product.tag && (
                    <Badge
                      className="text-[8px] px-1.5 py-0 border-0"
                      style={{ backgroundColor: `${accent}15`, color: accent }}
                    >
                      {product.tag}
                    </Badge>
                  )}
                  <p className="text-[10px] font-medium leading-tight line-clamp-2">{product.name}</p>
                  <p className="text-xs font-bold" style={{ color: accent }}>{product.price}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Mock sticky bar */}
          <div className="border-t bg-card px-3 py-2 flex items-center gap-2">
            <button
              className="flex-1 flex items-center justify-center gap-1.5 rounded-full py-1.5 text-[10px] font-semibold text-white"
              style={{ backgroundColor: accent }}
            >
              <MessageCircle className="h-3 w-3" />
              {config.stickyBarLabels.chat}
            </button>
            <button
              className="flex-1 flex items-center justify-center gap-1.5 rounded-full py-1.5 text-[10px] font-semibold border"
            >
              <Phone className="h-3 w-3" />
              {config.stickyBarLabels.call}
            </button>
          </div>
        </div>

        {/* Footer actions */}
        <DialogFooter className="flex-row gap-2 p-4 border-t bg-background shrink-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Đóng
          </Button>
          <Button
            onClick={handleSelect}
            className="flex-1"
            variant={isSelected ? 'secondary' : 'default'}
          >
            {isSelected ? (
              <>
                <Check className="h-4 w-4 mr-1" />
                Đã chọn
              </>
            ) : (
              'Chọn mẫu này'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
