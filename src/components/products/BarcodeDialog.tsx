import { useState } from 'react';
import { Product, PaperTemplate, BarcodeSettings } from '@/types/warehouse';
import { mockPaperTemplates } from '@/lib/mockData';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Printer, ArrowLeft, Eye, Grid3X3, Barcode } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BarcodeDialogProps {
  open: boolean;
  onClose: () => void;
  products: Product[];
}

type Step = 'settings' | 'paper';

export function BarcodeDialog({ open, onClose, products }: BarcodeDialogProps) {
  const [step, setStep] = useState<Step>('settings');
  const [settings, setSettings] = useState<BarcodeSettings>({
    showPrice: true,
    priceWithVND: true,
    showProductName: true,
    showStoreName: true,
    storeName: 'Kho Hàng VN',
  });
  const [selectedPaper, setSelectedPaper] = useState<string | null>(null);
  const [previewPaper, setPreviewPaper] = useState<PaperTemplate | null>(null);

  const handlePrint = () => {
    console.log('Printing barcodes with settings:', { settings, selectedPaper, products });
    onClose();
  };

  const renderSettings = () => (
    <div className="space-y-6">
      <div className="rounded-lg border p-4 bg-muted/30">
        <p className="text-sm text-muted-foreground mb-2">
          Đang in mã vạch cho <span className="font-semibold text-foreground">{products.length}</span> sản phẩm
        </p>
        <div className="flex flex-wrap gap-1">
          {products.slice(0, 3).map((p) => (
            <span key={p.id} className="text-xs bg-secondary px-2 py-1 rounded">
              {p.name}
            </span>
          ))}
          {products.length > 3 && (
            <span className="text-xs bg-secondary px-2 py-1 rounded">
              +{products.length - 3} sản phẩm khác
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold">Tuỳ chọn nội dung in</h3>

        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <Checkbox
              id="showPrice"
              checked={settings.showPrice}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, showPrice: checked as boolean })
              }
            />
            <Label htmlFor="showPrice" className="font-normal">
              In giá
            </Label>
          </div>

          {settings.showPrice && (
            <div className="ml-7">
              <RadioGroup
                value={settings.priceWithVND ? 'with' : 'without'}
                onValueChange={(v) =>
                  setSettings({ ...settings, priceWithVND: v === 'with' })
                }
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="with" id="priceWith" />
                  <Label htmlFor="priceWith" className="font-normal text-sm">
                    Giá kèm VND (vd: 28,000,000 VND)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="without" id="priceWithout" />
                  <Label htmlFor="priceWithout" className="font-normal text-sm">
                    Giá không kèm VND (vd: 28,000,000)
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          <div className="flex items-center space-x-3">
            <Checkbox
              id="showProductName"
              checked={settings.showProductName}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, showProductName: checked as boolean })
              }
            />
            <Label htmlFor="showProductName" className="font-normal">
              In tên sản phẩm
            </Label>
          </div>

          <div className="flex items-center space-x-3">
            <Checkbox
              id="showStoreName"
              checked={settings.showStoreName}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, showStoreName: checked as boolean })
              }
            />
            <Label htmlFor="showStoreName" className="font-normal">
              In tên cửa hàng
            </Label>
          </div>

          {settings.showStoreName && (
            <div className="ml-7">
              <Input
                value={settings.storeName}
                onChange={(e) => setSettings({ ...settings, storeName: e.target.value })}
                placeholder="Tên cửa hàng"
                className="max-w-xs"
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button variant="outline" onClick={onClose}>
          Huỷ
        </Button>
        <Button onClick={() => setStep('paper')}>
          Tiếp tục
        </Button>
      </div>
    </div>
  );

  const renderPaperSelection = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setStep('settings')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h3 className="font-semibold">Chọn loại giấy in</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {mockPaperTemplates.map((paper) => (
          <div
            key={paper.id}
            onClick={() => setSelectedPaper(paper.id)}
            className={cn(
              'paper-template',
              selectedPaper === paper.id && 'selected'
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <Grid3X3 className="h-8 w-8 text-primary" />
              <span className="text-xs font-medium bg-secondary px-2 py-1 rounded">
                {paper.labelCount} nhãn
              </span>
            </div>
            <h4 className="font-semibold text-sm">{paper.name}</h4>
            <p className="text-xs text-muted-foreground mt-1">{paper.size}</p>
            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
              {paper.description}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 w-full text-xs"
              onClick={(e) => {
                e.stopPropagation();
                setPreviewPaper(paper);
              }}
            >
              <Eye className="h-3 w-3 mr-1" />
              Xem chi tiết
            </Button>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button variant="outline" onClick={() => setStep('settings')}>
          Quay lại
        </Button>
        <Button onClick={handlePrint} disabled={!selectedPaper}>
          <Printer className="mr-2 h-4 w-4" />
          In mã vạch
        </Button>
      </div>

      {/* Paper Preview Dialog */}
      <Dialog open={!!previewPaper} onOpenChange={() => setPreviewPaper(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{previewPaper?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="aspect-video bg-muted rounded-lg flex items-center justify-center border-2 border-dashed">
              <div className="text-center">
                <Grid3X3 className="h-16 w-16 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground mt-2">
                  Hình minh hoạ mẫu giấy
                </p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Kích thước:</span>
                <span className="font-medium">{previewPaper?.size}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Số nhãn:</span>
                <span className="font-medium">{previewPaper?.labelCount} nhãn/tờ</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Kích thước (mm):</span>
                <span className="font-medium">
                  {previewPaper?.dimensions.width} x {previewPaper?.dimensions.height}
                </span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{previewPaper?.description}</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Barcode className="h-5 w-5" />
            In mã vạch
          </DialogTitle>
        </DialogHeader>
        {step === 'settings' ? renderSettings() : renderPaperSelection()}
      </DialogContent>
    </Dialog>
  );
}
