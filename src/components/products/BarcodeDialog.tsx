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
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Printer, ArrowLeft, Eye, Grid3X3, Barcode, DollarSign, Copy, Trash2, Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNumberWithSpaces } from '@/lib/formatNumber';

// Import paper template images
import paperTemplate1 from '@/assets/paper-template-1.jpg';
import paperTemplate2 from '@/assets/paper-template-2.jpg';
import paperTemplate3 from '@/assets/paper-template-3.jpg';
import paperTemplate4 from '@/assets/paper-template-4.jpg';
import paperTemplate5 from '@/assets/paper-template-5.jpg';
import paperTemplate6 from '@/assets/paper-template-6.jpg';

const paperTemplateImages: Record<string, string> = {
  'paper-template-1': paperTemplate1,
  'paper-template-2': paperTemplate2,
  'paper-template-3': paperTemplate3,
  'paper-template-4': paperTemplate4,
  'paper-template-5': paperTemplate5,
  'paper-template-6': paperTemplate6,
  'paper-template-7': paperTemplate1, // Reuse template 1 image, mẫu cuộn tương tự
};

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

type Step = 'price' | 'settings' | 'paper' | 'adjust';

interface PrintAdjustments {
  scale: number; // 0.5 to 1.5
  rotation: 0 | 90 | 270; // degrees
  autoCompensateRotation: boolean; // tự bù xoay cho driver máy in nhiệt
}

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
    showCustomDescription: false,
    customDescription: '',
  });
  const [selectedPaper, setSelectedPaper] = useState<string | null>(null);
  const [previewPaper, setPreviewPaper] = useState<PaperTemplate | null>(null);
  const [adjustments, setAdjustments] = useState<PrintAdjustments>({
    scale: 1,
    rotation: 0,
    autoCompensateRotation: true,
  });

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
    if (!selectedPaper) return;
    
    const paper = mockPaperTemplates.find(p => p.id === selectedPaper);
    if (!paper) return;

    // Create print content with adjustments
    const printContent = generatePrintContent(paper, productEntries, settings, adjustments);
    
    // Open print window
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      
      // Wait for images/fonts to load, then print
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
    
    onClose();
  };

  // Get selected paper for adjustment step
  const getSelectedPaperTemplate = () => {
    return mockPaperTemplates.find(p => p.id === selectedPaper);
  };

  // Generate print HTML content
  const generatePrintContent = (
    paper: PaperTemplate,
    entries: ProductPriceEntry[],
    printSettings: BarcodeSettings,
    printAdjustments?: PrintAdjustments
  ): string => {
    const { width, height } = paper.dimensions;
    const isA4Sheet = paper.size.toLowerCase().includes('a4');
    const scale = printAdjustments?.scale ?? 1;
    const rotation = printAdjustments?.rotation ?? 0;
    const autoCompensateRotation = printAdjustments?.autoCompensateRotation ?? true;
    
    // Tem cuộn (ví dụ 50x30) đôi khi bị driver ép in dọc (30x50) dù chọn Landscape.
    // Giải pháp bền vững: "bù xoay" bằng cách hoán đổi @page size và xoay nội dung 90°.
    // - Nếu người dùng đã chọn rotation thủ công thì tôn trọng.
    // - Nếu không, tự động bật bù xoay cho tem cuộn ngang (width > height, không phải A4).
    const shouldAutoCompensateRotation = !isA4Sheet && width > height;
    const effectiveRotation: 0 | 90 | 270 =
      rotation !== 0
        ? rotation
        : autoCompensateRotation && shouldAutoCompensateRotation
          ? 270
          : 0;

    // Dimension locking: khi xoay 90°, swap kích thước trang để khớp cách driver render.
    const isRotated = effectiveRotation !== 0;
    const pageWidth = isRotated ? height : width;
    const pageHeight = isRotated ? width : height;
    
    // Generate all labels (repeat by quantity)
    const allLabels: ProductPriceEntry[] = [];
    entries.forEach(entry => {
      for (let i = 0; i < entry.quantity; i++) {
        allLabels.push(entry);
      }
    });

    // Calculate QR/Barcode sizes based on label dimensions and scale
    // Convert mm to approximate pixels (1mm ≈ 3.78px at 96dpi, but print uses ~2.8px)
    const isSmallLabel = height <= 22; // Giấy cuộn nhỏ
    const isJewelryLabel = height <= 10; // Tem trang sức
    const isLargeLabel = height >= 100; // Mẫu A4, Tomy
    
    // Base QR size - will be scaled
    const baseQrSize = isJewelryLabel ? 28 : isSmallLabel ? 40 : isLargeLabel ? 80 : 64;
    const baseBarcodeHeight = isJewelryLabel ? 12 : isSmallLabel ? 14 : 18;
    // Thu ngắn chiều ngang barcode (giảm từ 1 xuống 0.6)
    const baseBarcodeWidth = isJewelryLabel ? 0.6 : 0.6;
    
    // Apply scale to sizes
    const qrSize = Math.round(baseQrSize * scale);
    const barcodeHeight = Math.round(baseBarcodeHeight * scale);
    const barcodeWidth = baseBarcodeWidth * scale;

    const labelHTML = allLabels.map((entry, idx) => {
      // Encode format: CODE:PRICE (e.g., "353902103999926:24000000")
      // Using ":" as delimiter - simple and scanner-compatible
      const codeValue = `${entry.imei || entry.sku}:${entry.printPrice}`;
      
      // For jewelry labels, only show barcode (too small for QR)
      if (isJewelryLabel) {
        return `
          <div class="label jewelry-label" style="width: ${width}mm; height: ${height}mm;">
            <div class="codes-container-inline">
              <svg class="barcode" id="barcode-${idx}"></svg>
            </div>
            ${printSettings.showPrice ? 
              `<div class="price-inline">${formatNumberWithSpaces(entry.printPrice)}</div>` : ''}
          </div>
        `;
      }
      
      // Template đơn giản - CHỈ BARCODE, không QR
      return `
        <div class="label" style="width: ${width}mm; height: ${height}mm;">
          <div class="label-content-wrapper">
            ${printSettings.showStoreName && printSettings.storeName ? 
              `<div class="store-name">${printSettings.storeName}</div>` : ''}
            ${printSettings.showProductName ? 
              `<div class="product-name">${entry.name}</div>` : ''}
            ${printSettings.showCustomDescription && printSettings.customDescription ? 
              `<div class="custom-description">${printSettings.customDescription.replace(/\n/g, '<br/>')}</div>` : ''}
            <div class="codes-container ${isSmallLabel ? 'codes-small' : ''}">
              <svg class="barcode" id="barcode-${idx}"></svg>
            </div>
            <div class="code-text">${entry.imei || entry.sku}</div>
            ${printSettings.showPrice ? 
              `<div class="price">${formatNumberWithSpaces(entry.printPrice)}${printSettings.priceWithVND ? ' VND' : ''}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Generate initialization script for both QR and Barcode
    // CHỈ tạo Barcode, không tạo QR
    const initScript = allLabels.map((entry, idx) => {
      const codeValue = `${entry.imei || entry.sku}:${entry.printPrice}`;
      
      return `
        JsBarcode("#barcode-${idx}", "${codeValue}", {
          format: "CODE128",
          width: ${barcodeWidth},
          height: ${barcodeHeight},
          displayValue: false,
          margin: 0
        });
      `;
    }).join('\n');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>In mã vạch</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
        <style>
          /* Reset hoàn toàn */
          * {
            margin: 0 !important;
            padding: 0 !important;
            box-sizing: border-box !important;
          }
          
          /* Kích thước trang - QUAN TRỌNG cho máy in nhiệt */
          @page {
            size: ${pageWidth}mm ${pageHeight}mm;
            margin: 0mm !important;
            padding: 0mm !important;
          }
          
          /* Ẩn header/footer trình duyệt hoàn toàn */
          @media print {
            @page {
              margin: 0mm !important;
            }
            
            html {
              margin: 0mm !important;
              padding: 0mm !important;
            }
            
            body {
              margin: 0mm !important;
              padding: 0mm !important;
            }
          }

          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: ${pageWidth}mm;
            height: auto;
            font-family: Arial, sans-serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            background: white;
          }
          
          .labels-container {
            display: block;
            margin: 0 !important;
            padding: 0 !important;
            width: ${pageWidth}mm;
          }
          
          .label {
            width: ${pageWidth}mm !important;
            height: ${pageHeight}mm !important;
            margin: 0 !important;
            padding: 1mm !important;
            box-sizing: border-box !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            page-break-after: always;
            page-break-inside: avoid;
            overflow: hidden !important;
            background: white;
          }
          
          .label-content-wrapper {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            text-align: center !important;
            gap: 0 !important;
            /* Bù xoay để tránh driver ép in dọc */
            transform: rotate(${effectiveRotation === 270 ? -90 : effectiveRotation}deg) scale(${scale});
            transform-origin: center center;
            /* Khi xoay 90°, khung nội dung cần swap để fit trong trang đã swap */
            width: ${isRotated ? pageHeight - 4 : pageWidth - 4}mm;
            height: ${isRotated ? pageWidth - 4 : pageHeight - 4}mm;
            margin: 0 auto !important;
          }
          
          .store-name {
            font-size: ${Math.round(8 * scale)}px;
            font-weight: bold;
            color: #000;
            margin: 0 !important;
            padding: 0 !important;
            line-height: 1.1;
          }
          
          .product-name {
            font-size: ${Math.round(7 * scale)}px;
            color: #000;
            margin: 0 !important;
            padding: 0 !important;
            line-height: 1.1;
            word-break: break-word;
          }
          
          .custom-description {
            font-size: ${Math.round(7 * scale)}px;
            color: #000;
            margin: 0 !important;
            padding: 0 !important;
            line-height: 1.1;
            white-space: pre-wrap;
          }
          
          .codes-container {
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: center;
            gap: 0;
            margin: 0 !important;
            padding: 0 !important;
            flex-shrink: 0;
          }
          
          .codes-small {
            gap: 0;
          }
          
          .codes-container-inline {
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: center;
          }
          
          .qr-code {
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }
          
          .qr-code img, .qr-code canvas {
            width: 100% !important;
            height: 100% !important;
          }
          
          .barcode {
            max-width: 100%;
            height: auto;
            flex-shrink: 0;
          }
          
          .code-text {
            font-size: ${Math.round(6 * scale)}px;
            font-family: monospace;
            margin: 0 !important;
            padding: 0 !important;
            color: #000;
          }
          
          .price {
            font-size: ${Math.round(10 * scale)}px;
            font-weight: bold;
            margin: 0 !important;
            padding: 0 !important;
            color: #000;
          }
          
          .price-inline {
            font-size: 7px;
            font-weight: bold;
            margin-left: 1mm;
          }
          
          /* Jewelry label special styling */
          .jewelry-label {
            flex-direction: row;
            padding: 0.5mm;
          }
          
          @media print {
            html, body {
              width: ${isA4Sheet ? 'auto' : `${width}mm`};
              height: ${isA4Sheet ? 'auto' : `${height}mm`};
              margin: 0 !important;
              padding: 0 !important;
            }
            .labels-container {
              width: ${isA4Sheet ? 'auto' : `${width}mm`};
            }
            .label {
              border: none !important;
              margin: 0 !important;
              width: ${width}mm !important;
              height: ${height}mm !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="labels-container">
          ${labelHTML}
        </div>
        <script>
          document.addEventListener('DOMContentLoaded', function() {
            ${initScript}
          });
        </script>
      </body>
      </html>
    `;
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

  // Get sample product for preview
  const sampleProduct = productEntries[0];

  const renderBarcodePreview = () => (
    <div className="flex-1 flex flex-col items-center">
      <p className="text-xs text-muted-foreground mb-2">Xem trước nhãn</p>
      <div className="border-2 border-dashed border-primary/30 rounded-lg p-4 bg-background min-w-[200px] max-w-[240px]">
        {/* Barcode label preview */}
        <div className="flex flex-col items-center gap-2 text-center">
          {/* Store name */}
          {settings.showStoreName && settings.storeName && (
            <p className="text-[10px] font-semibold text-primary truncate w-full">
              {settings.storeName}
            </p>
          )}

          {/* Product name */}
          {settings.showProductName && sampleProduct && (
            <p className="text-[9px] text-foreground line-clamp-2 w-full">
              {sampleProduct.name}
            </p>
          )}

          {/* Custom description */}
          {settings.showCustomDescription && settings.customDescription && (
            <p className="text-[9px] text-foreground whitespace-pre-wrap w-full">
              {settings.customDescription}
            </p>
          )}

          {/* Barcode placeholder */}
          <div className="w-full py-2">
            <div className="flex items-end justify-center gap-[1px] h-10">
              {/* Generate barcode-like lines */}
              {Array.from({ length: 40 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-foreground"
                  style={{
                    width: i % 3 === 0 ? '2px' : '1px',
                    height: `${20 + Math.random() * 20}px`,
                  }}
                />
              ))}
            </div>
            {sampleProduct && (
              <p className="text-[8px] text-muted-foreground mt-1 font-mono">
                {sampleProduct.imei || sampleProduct.sku}
              </p>
            )}
          </div>

          {/* Price */}
          {settings.showPrice && sampleProduct && (
            <p className="text-sm font-bold text-foreground">
              {formatNumberWithSpaces(sampleProduct.printPrice)}
              {settings.priceWithVND && <span className="text-[10px] ml-1">VND</span>}
            </p>
          )}
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground mt-2 text-center">
        Nội dung thay đổi theo tuỳ chọn bên trái
      </p>
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

      {/* Main content: Options + Preview */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Options */}
        <div className="flex-1 space-y-4">
          <p className="text-sm font-medium text-muted-foreground">Tuỳ chọn hiển thị</p>
          
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="showPrice"
                checked={settings.showPrice}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, showPrice: checked as boolean })
                }
              />
              <Label htmlFor="showPrice" className="font-normal cursor-pointer">
                In giá
              </Label>
            </div>

            {settings.showPrice && (
              <div className="ml-7 space-y-2">
                <RadioGroup
                  value={settings.priceWithVND ? 'with' : 'without'}
                  onValueChange={(v) =>
                    setSettings({ ...settings, priceWithVND: v === 'with' })
                  }
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="with" id="priceWith" />
                    <Label htmlFor="priceWith" className="font-normal text-sm cursor-pointer">
                      Giá kèm VND (vd: 28,000,000 VND)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="without" id="priceWithout" />
                    <Label htmlFor="priceWithout" className="font-normal text-sm cursor-pointer">
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
              <Label htmlFor="showProductName" className="font-normal cursor-pointer">
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
              <Label htmlFor="showStoreName" className="font-normal cursor-pointer">
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

            <div className="flex items-center space-x-3">
              <Checkbox
                id="showCustomDescription"
                checked={settings.showCustomDescription}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, showCustomDescription: checked as boolean })
                }
              />
              <Label htmlFor="showCustomDescription" className="font-normal cursor-pointer">
                Mô tả khác
              </Label>
            </div>

            {settings.showCustomDescription && (
              <div className="ml-7">
                <Textarea
                  value={settings.customDescription}
                  onChange={(e) => setSettings({ ...settings, customDescription: e.target.value })}
                  placeholder="Nhập mô tả tùy chỉnh..."
                  className="max-w-xs min-h-[80px] resize-none"
                  rows={3}
                />
              </div>
            )}
          </div>
        </div>

        {/* Live Preview */}
        {sampleProduct && renderBarcodePreview()}
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
        {mockPaperTemplates.map((paper) => {
          const imageUrl = paper.image ? paperTemplateImages[paper.image] : null;
          return (
            <div
              key={paper.id}
              onClick={() => setSelectedPaper(paper.id)}
              className={cn(
                'paper-template cursor-pointer rounded-lg border p-4 transition-all hover:shadow-md',
                selectedPaper === paper.id && 'border-primary ring-2 ring-primary/20'
              )}
            >
              {/* Thumbnail image */}
              {imageUrl ? (
                <div className="aspect-square mb-3 rounded-md overflow-hidden bg-muted">
                  <img 
                    src={imageUrl} 
                    alt={paper.name} 
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between mb-3">
                  <Grid3X3 className="h-8 w-8 text-primary" />
                  <span className="text-xs font-medium bg-secondary px-2 py-1 rounded">
                    {paper.labelCount} nhãn
                  </span>
                </div>
              )}
              
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-semibold text-sm">{paper.name}</h4>
                <span className="text-xs font-medium bg-secondary px-2 py-1 rounded">
                  {paper.labelCount} nhãn
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{paper.size}</p>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
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
          );
        })}
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button variant="outline" onClick={() => setStep('settings')}>
          Quay lại
        </Button>
        <Button onClick={() => {
          // Reset adjustments when entering adjust step
          setAdjustments({ scale: 1, rotation: 0, autoCompensateRotation: true });
          setStep('adjust');
        }} disabled={!selectedPaper}>
          Tiếp tục
        </Button>
      </div>

      {/* Paper Preview Dialog */}
      <Dialog open={!!previewPaper} onOpenChange={() => setPreviewPaper(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{previewPaper?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Full size image */}
            {previewPaper?.image && paperTemplateImages[previewPaper.image] ? (
              <div className="rounded-lg overflow-hidden bg-muted border">
                <img 
                  src={paperTemplateImages[previewPaper.image]} 
                  alt={previewPaper.name} 
                  className="w-full h-auto object-contain max-h-[300px]"
                />
              </div>
            ) : (
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center border-2 border-dashed">
                <div className="text-center">
                  <Grid3X3 className="h-16 w-16 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mt-2">
                    Hình minh hoạ mẫu giấy
                  </p>
                </div>
              </div>
            )}
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

  // Render adjustment step - cho phép điều chỉnh kích thước và xoay
  const renderAdjustment = () => {
    const paper = getSelectedPaperTemplate();
    if (!paper) return null;

    const { width, height } = paper.dimensions;
    const sampleEntry = productEntries[0];
    
    // Calculate preview dimensions (scaled for display)
    const previewScale = 3; // 1mm = 3px for preview
    const previewWidth = width * previewScale;
    const previewHeight = height * previewScale;
    
    // Content dimensions based on adjustments
    const contentScale = adjustments.scale;
    const previewRotateDeg = adjustments.rotation === 270 ? -90 : adjustments.rotation;

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setStep('paper')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h3 className="font-semibold">Điều chỉnh nội dung in - {paper.name}</h3>
        </div>

        {/* Preview Area */}
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm text-muted-foreground">
            Kéo thanh trượt để điều chỉnh kích thước, bấm xoay để xoay 90°
          </p>
          
          {/* Paper Preview Container */}
          <div 
            className="relative border-2 border-dashed border-primary/50 bg-white rounded-lg overflow-hidden flex items-center justify-center"
            style={{
              width: `${previewWidth}px`,
              height: `${previewHeight}px`,
              minWidth: `${previewWidth}px`,
              minHeight: `${previewHeight}px`,
            }}
          >
            {/* Content Preview - dùng cùng thứ tự transform như print */}
            <div 
              className="flex flex-col items-center justify-center text-center transition-transform duration-200"
              style={{
                transform: `rotate(${previewRotateDeg}deg) scale(${contentScale})`,
                transformOrigin: 'center center',
              }}
            >
              {settings.showStoreName && settings.storeName && (
                <div className="text-[8px] font-bold text-foreground">{settings.storeName}</div>
              )}
              {settings.showProductName && sampleEntry && (
                <div className="text-[6px] text-foreground truncate max-w-[60px]">{sampleEntry.name}</div>
              )}
              <div className="flex items-center gap-1 my-1">
                <div className="w-6 h-6 bg-muted rounded-sm flex items-center justify-center border">
                  <span className="text-muted-foreground text-[4px]">QR</span>
                </div>
                <div className="w-10 h-4 bg-muted rounded-sm flex items-center justify-center border">
                  <span className="text-muted-foreground text-[3px]">|||||||</span>
                </div>
              </div>
              {settings.showPrice && sampleEntry && (
                <div className="text-[7px] font-bold text-foreground">
                  {formatNumberWithSpaces(sampleEntry.printPrice)}{settings.priceWithVND ? ' VND' : ''}
                </div>
              )}
            </div>

            {/* Paper size indicator */}
            <div className="absolute bottom-1 right-1 text-[8px] text-muted-foreground bg-white/80 px-1 rounded">
              {width}x{height}mm
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-4 max-w-md mx-auto">
          {/* Scale slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Kích thước nội dung</Label>
              <span className="text-sm text-muted-foreground">{Math.round(adjustments.scale * 100)}%</span>
            </div>
            <div className="flex items-center gap-3">
              <Minus className="h-4 w-4 text-muted-foreground" />
              <input
                type="range"
                min="0.3"
                max="1.5"
                step="0.05"
                value={adjustments.scale}
                onChange={(e) => setAdjustments({ ...adjustments, scale: parseFloat(e.target.value) })}
                className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <Plus className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          {/* Rotation options */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Xoay nội dung</Label>
              <span className="text-sm text-muted-foreground">{adjustments.rotation}°</span>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={adjustments.rotation === 0 ? 'default' : 'outline'}
                onClick={() => setAdjustments({ ...adjustments, rotation: 0 })}
              >
                0°
              </Button>
              <Button
                type="button"
                size="sm"
                variant={adjustments.rotation === 90 ? 'default' : 'outline'}
                onClick={() => setAdjustments({ ...adjustments, rotation: 90 })}
              >
                90°
              </Button>
              <Button
                type="button"
                size="sm"
                variant={adjustments.rotation === 270 ? 'default' : 'outline'}
                onClick={() => setAdjustments({ ...adjustments, rotation: 270 })}
              >
                270°
              </Button>
            </div>
          </div>

          {/* Auto compensation (365B) */}
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Tự bù xoay (365B)</Label>
            <Button
              type="button"
              size="sm"
              variant={adjustments.autoCompensateRotation ? 'default' : 'outline'}
              onClick={() =>
                setAdjustments({
                  ...adjustments,
                  autoCompensateRotation: !adjustments.autoCompensateRotation,
                })
              }
            >
              {adjustments.autoCompensateRotation ? 'Bật' : 'Tắt'}
            </Button>
          </div>

          {/* Quick presets */}
          <div className="flex gap-2 flex-wrap">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setAdjustments({ scale: 0.5, rotation: 0, autoCompensateRotation: true })}
            >
              50%
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setAdjustments({ scale: 0.75, rotation: 0, autoCompensateRotation: true })}
            >
              75%
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setAdjustments({ scale: 1, rotation: 0, autoCompensateRotation: true })}
            >
              100%
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setAdjustments({ scale: 0.6, rotation: 270, autoCompensateRotation: true })}
            >
              60% + Xoay
            </Button>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={() => setStep('paper')}>
            Quay lại
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            In mã vạch ({totalLabels} nhãn)
          </Button>
        </div>
      </div>
    );
  };

  const renderStep = () => {
    switch (step) {
      case 'price':
        return renderPriceSettings();
      case 'settings':
        return renderSettings();
      case 'paper':
        return renderPaperSelection();
      case 'adjust':
        return renderAdjustment();
      default:
        return null;
    }
  };

  const stepTitles: Record<Step, string> = {
    price: 'Chỉnh giá in',
    settings: 'Tuỳ chọn nội dung',
    paper: 'Chọn loại giấy',
    adjust: 'Điều chỉnh in',
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
