import { useState, useEffect } from 'react';
import { PaperTemplate, BarcodeSettings } from '@/types/warehouse';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Printer, ArrowLeft, Eye, Grid3X3, Barcode, DollarSign, Copy, Trash2, Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNumberWithSpaces } from '@/lib/formatNumber';

interface ProductForBarcode {
  id: string;
  name: string;
  sku: string;
  imei?: string;
  importPrice: number;
}

interface ProductPriceEntry {
  productId: string;
  name: string;
  sku: string;
  imei?: string;
  importPrice: number;
  printPrice: number;
  quantity: number;
}

interface BarcodeDialogProps {
  open: boolean;
  onClose: () => void;
  products: ProductForBarcode[];
}

type Step = 'price' | 'settings' | 'paper';

export function BarcodeDialog({ open, onClose, products }: BarcodeDialogProps) {
  const [step, setStep] = useState<Step>('price');
  const [productEntries, setProductEntries] = useState<ProductPriceEntry[]>([]);
  const [bulkPrice, setBulkPrice] = useState<string>('');
  const [settings, setSettings] = useState<BarcodeSettings>({
    showPrice: true,
    priceWithVND: true,
    showProductName: true,
    showStoreName: true,
    storeName: 'Kho Hàng VN',
  });
  const [selectedPaper, setSelectedPaper] = useState<string | null>(null);
  const [previewPaper, setPreviewPaper] = useState<PaperTemplate | null>(null);

  // Initialize product entries when products change
  useEffect(() => {
    if (products.length > 0) {
      setProductEntries(
        products.map((p) => ({
          productId: p.id,
          name: p.name,
          sku: p.sku,
          imei: p.imei,
          importPrice: p.importPrice,
          printPrice: p.importPrice, // Default to import price, user can change
          quantity: 1,
        }))
      );
      setStep('price');
    }
  }, [products]);

  const handlePrint = () => {
    console.log('Printing barcodes with settings:', { settings, selectedPaper, productEntries });
    onClose();
  };

  const updateProductPrice = (productId: string, price: number) => {
    setProductEntries((prev) =>
      prev.map((entry) =>
        entry.productId === productId ? { ...entry, printPrice: price } : entry
      )
    );
  };

  const updateProductQuantity = (productId: string, quantity: number) => {
    setProductEntries((prev) =>
      prev.map((entry) =>
        entry.productId === productId ? { ...entry, quantity: Math.max(1, quantity) } : entry
      )
    );
  };

  const applyBulkPrice = () => {
    const price = parseFloat(bulkPrice.replace(/[,.]/g, ''));
    if (!isNaN(price) && price >= 0) {
      setProductEntries((prev) =>
        prev.map((entry) => ({ ...entry, printPrice: price }))
      );
    }
  };

  const removeProduct = (productId: string) => {
    setProductEntries((prev) => prev.filter((entry) => entry.productId !== productId));
  };

  const totalLabels = productEntries.reduce((sum, entry) => sum + entry.quantity, 0);

  const renderPriceSettings = () => (
    <div className="space-y-4">
      {/* Bulk price section */}
      <div className="rounded-lg border p-4 bg-muted/30">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Đặt giá đồng loạt
            </Label>
            <Input
              type="text"
              placeholder="Nhập giá áp dụng cho tất cả..."
              value={bulkPrice}
              onChange={(e) => {
                // Allow only numbers
                const value = e.target.value.replace(/[^0-9]/g, '');
                setBulkPrice(value ? formatNumberWithSpaces(parseInt(value)) : '');
              }}
              className="max-w-xs"
            />
          </div>
          <Button onClick={applyBulkPrice} disabled={!bulkPrice}>
            <Copy className="h-4 w-4 mr-2" />
            Áp dụng tất cả
          </Button>
        </div>
      </div>

      <Separator />

      {/* Individual products */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <Label className="text-sm font-medium">
            Chỉnh giá từng sản phẩm ({productEntries.length} sản phẩm)
          </Label>
          <span className="text-sm text-muted-foreground">
            Tổng: {totalLabels} nhãn
          </span>
        </div>

        <ScrollArea className="h-[300px] rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[180px]">Sản phẩm</TableHead>
                <TableHead className="w-[140px]">Giá in</TableHead>
                <TableHead className="w-[100px] text-center">Số lượng</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productEntries.map((entry) => (
                <TableRow key={entry.productId}>
                  <TableCell>
                    <div className="space-y-0.5">
                      <div className="font-medium text-sm line-clamp-1">{entry.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {entry.imei ? `IMEI: ${entry.imei}` : `SKU: ${entry.sku}`}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Giá nhập: {formatNumberWithSpaces(entry.importPrice)}đ
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="text"
                      value={formatNumberWithSpaces(entry.printPrice)}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9]/g, '');
                        updateProductPrice(entry.productId, parseInt(value) || 0);
                      }}
                      className="text-right font-medium"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateProductQuantity(entry.productId, entry.quantity - 1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <Input
                        type="number"
                        min={1}
                        value={entry.quantity}
                        onChange={(e) => updateProductQuantity(entry.productId, parseInt(e.target.value) || 1)}
                        className="w-12 text-center px-1"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateProductQuantity(entry.productId, entry.quantity + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => removeProduct(entry.productId)}
                      disabled={productEntries.length <= 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button variant="outline" onClick={onClose}>
          Huỷ
        </Button>
        <Button onClick={() => setStep('settings')} disabled={productEntries.length === 0}>
          Tiếp tục
        </Button>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setStep('price')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h3 className="font-semibold">Tuỳ chọn nội dung in</h3>
      </div>

      <div className="rounded-lg border p-4 bg-muted/30">
        <p className="text-sm text-muted-foreground mb-2">
          Đang in mã vạch cho <span className="font-semibold text-foreground">{productEntries.length}</span> sản phẩm
          {' '}(<span className="font-semibold text-foreground">{totalLabels}</span> nhãn)
        </p>
        <div className="flex flex-wrap gap-1">
          {productEntries.slice(0, 3).map((p) => (
            <span key={p.productId} className="text-xs bg-secondary px-2 py-1 rounded">
              {p.name} x{p.quantity}
            </span>
          ))}
          {productEntries.length > 3 && (
            <span className="text-xs bg-secondary px-2 py-1 rounded">
              +{productEntries.length - 3} sản phẩm khác
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4">
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
        <Button variant="outline" onClick={() => setStep('price')}>
          Quay lại
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
              'paper-template cursor-pointer rounded-lg border p-4 transition-all hover:shadow-md',
              selectedPaper === paper.id && 'border-primary ring-2 ring-primary/20'
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
          In mã vạch ({totalLabels} nhãn)
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

  const renderStep = () => {
    switch (step) {
      case 'price':
        return renderPriceSettings();
      case 'settings':
        return renderSettings();
      case 'paper':
        return renderPaperSelection();
      default:
        return null;
    }
  };

  const stepTitles: Record<Step, string> = {
    price: 'Chỉnh giá in',
    settings: 'Tuỳ chọn nội dung',
    paper: 'Chọn loại giấy',
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Barcode className="h-5 w-5" />
            In mã vạch - {stepTitles[step]}
          </DialogTitle>
        </DialogHeader>
        {renderStep()}
      </DialogContent>
    </Dialog>
  );
}
