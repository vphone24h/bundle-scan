import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { WebsiteTemplate } from '@/lib/websiteTemplates';
import { TEMPLATE_SAMPLE_PRODUCTS, SampleProduct } from '@/lib/templateSampleProducts';
import { cn } from '@/lib/utils';
import { Eye, Check } from 'lucide-react';

interface TemplatePreviewDialogProps {
  template: WebsiteTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (templateId: string) => void;
  isSelected: boolean;
}

const tierColors: Record<string, string> = {
  basic: 'bg-muted text-muted-foreground',
  premium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  pro: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
};

const tierLabels: Record<string, string> = {
  basic: 'Cơ bản',
  premium: 'Cao cấp',
  pro: 'Premium',
};

export function TemplatePreviewDialog({
  template,
  open,
  onOpenChange,
  onSelect,
  isSelected,
}: TemplatePreviewDialogProps) {
  if (!template) return null;

  const sampleProducts = TEMPLATE_SAMPLE_PRODUCTS[template.id] || [];

  const handleSelect = () => {
    onSelect(template.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="text-4xl">{template.icon}</span>
            <div className="flex-1">
              <DialogTitle className="text-lg">{template.name}</DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className={cn('text-xs', tierColors[template.tier])}>
                  {tierLabels[template.tier]}
                </Badge>
                <span className="text-xs text-muted-foreground">{template.category}</span>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Description */}
        <p className="text-sm text-muted-foreground">{template.description}</p>

        {/* Sample Products */}
        {sampleProducts.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-semibold">Sản phẩm mẫu</h4>
            </div>
            <div className="space-y-2">
              {sampleProducts.map((product, index) => (
                <SampleProductCard key={index} product={product} />
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="flex-row gap-2 sm:gap-2">
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

function SampleProductCard({ product }: { product: SampleProduct }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3 bg-card">
      <span className="text-2xl shrink-0">{product.image}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium truncate">{product.name}</span>
          {product.tag && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0 bg-primary/10 text-primary">
              {product.tag}
            </Badge>
          )}
        </div>
        <span className="text-xs font-semibold text-primary">{product.price}</span>
      </div>
    </div>
  );
}
