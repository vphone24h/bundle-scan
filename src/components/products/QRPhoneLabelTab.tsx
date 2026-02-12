import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Printer, Loader2, FileDown, Smartphone, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import { formatNumberWithSpaces } from '@/lib/formatNumber';
import QRCode from 'qrcode';

interface ProductPriceEntry {
  productId: string;
  name: string;
  sku: string;
  imei?: string;
  importPrice: number;
  printPrice: number;
  quantity: number;
}

interface QRSettings {
  showPrice: boolean;
  showProductName: boolean;
  showStoreName: boolean;
  storeName: string;
}

interface QRPhoneLabelTabProps {
  productEntries: ProductPriceEntry[];
  storeName: string;
}

// Encode QR data in format compatible with existing scanner
// IMEI: IMEI|Name|Price (KiotViet format)
// Non-IMEI: N:Name:Price
function encodeQRData(entry: ProductPriceEntry): string {
  if (entry.imei) {
    return `${entry.imei}|${entry.name}|${entry.printPrice}`;
  }
  return `N:${entry.name}:${entry.printPrice}`;
}

// Generate QR code as base64 data URL locally
async function generateQRDataUrl(data: string): Promise<string> {
  return QRCode.toDataURL(data, {
    width: 300,
    margin: 1,
    errorCorrectionLevel: 'M',
  });
}

export function QRPhoneLabelTab({ productEntries, storeName: defaultStoreName }: QRPhoneLabelTabProps) {
  const [settings, setSettings] = useState<QRSettings>({
    showPrice: true,
    showProductName: true,
    showStoreName: true,
    storeName: defaultStoreName,
  });
  const [isExporting, setIsExporting] = useState(false);
  const [previewQrUrl, setPreviewQrUrl] = useState<string>('');

  const sampleEntry = productEntries[0];
  const totalLabels = productEntries.reduce((sum, e) => sum + e.quantity, 0);

  // Generate preview QR
  useEffect(() => {
    if (sampleEntry) {
      generateQRDataUrl(encodeQRData(sampleEntry)).then(setPreviewQrUrl);
    }
  }, [sampleEntry]);

  // Expand all labels by quantity
  const expandLabels = (): ProductPriceEntry[] => {
    const all: ProductPriceEntry[] = [];
    productEntries.forEach(entry => {
      for (let i = 0; i < entry.quantity; i++) all.push(entry);
    });
    return all;
  };

  // Generate single label HTML for 55x30mm with QR as embedded data URL
  const generateSingleLabelHtml = (entry: ProductPriceEntry, qrDataUrl: string): string => {
    const width = 55;
    const height = 30;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>QR Label</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page { size: ${width}mm ${height}mm; margin: 0; }
          @media print {
            html, body { width: ${width}mm; height: ${height}mm; margin: 0; padding: 0; }
          }
          html, body {
            margin: 0; padding: 0;
            font-family: Arial, sans-serif;
            background: white;
          }
          .label {
            width: ${width}mm;
            height: ${height}mm;
            position: relative;
            background: white;
            overflow: hidden;
          }
          .label-content {
            position: absolute;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            display: flex;
            flex-direction: row;
            align-items: center;
            width: ${width - 2}mm;
            height: ${height - 2}mm;
            gap: 2mm;
          }
          .qr-section {
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .qr-section img {
            width: ${height - 4}mm;
            height: ${height - 4}mm;
            image-rendering: pixelated;
          }
          .info-section {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: 1px;
            overflow: hidden;
            min-width: 0;
          }
          .store-name {
            font-size: 8pt;
            font-weight: bold;
            color: #000;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            line-height: 1.3;
          }
          .product-name {
            font-size: 6.5pt;
            color: #000;
            line-height: 1.2;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
          .price {
            font-size: 9pt;
            font-weight: bold;
            color: #000;
            line-height: 1.3;
          }
        </style>
      </head>
      <body>
        <div class="label">
          <div class="label-content">
            <div class="qr-section">
              <img src="${qrDataUrl}" alt="QR" />
            </div>
            <div class="info-section">
              ${settings.showStoreName && settings.storeName ? `<div class="store-name">${settings.storeName}</div>` : ''}
              ${settings.showProductName ? `<div class="product-name">${entry.name}</div>` : ''}
              ${settings.showPrice ? `<div class="price">${formatNumberWithSpaces(entry.printPrice)} đ</div>` : ''}
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  // Print: 1 job = 1 label
  const handlePrint = useCallback(async () => {
    const allLabels = expandLabels();
    if (allLabels.length === 0) {
      toast.error('Không có tem để in');
      return;
    }

    // Pre-generate all QR data URLs
    toast.info(`Đang tạo ${allLabels.length} mã QR...`);
    const qrDataUrls: string[] = [];
    for (const entry of allLabels) {
      const url = await generateQRDataUrl(encodeQRData(entry));
      qrDataUrls.push(url);
    }

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      toast.error('Trình duyệt đang chặn popup in. Vui lòng cho phép popups.');
      return;
    }

    let currentIndex = 0;
    const printNextLabel = () => {
      if (currentIndex >= allLabels.length) {
        printWindow.close();
        toast.success(`Đã gửi ${allLabels.length} lệnh in QR (1 tem/lệnh)`);
        return;
      }
      const labelHtml = generateSingleLabelHtml(allLabels[currentIndex], qrDataUrls[currentIndex]);
      printWindow.document.open();
      printWindow.document.write(labelHtml);
      printWindow.document.close();

      setTimeout(() => {
        printWindow.print();
        currentIndex++;
        setTimeout(printNextLabel, 300);
      }, 200);
    };
    printNextLabel();
  }, [productEntries, settings]);

  // Export PDF
  const handleExportPDF = async () => {
    setIsExporting(true);
    toast.info('Đang tạo file PDF...');

    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ]);

      const allLabels = expandLabels();
      const width = 55;
      const height = 30;

      // Pre-generate all QR data URLs
      const qrDataUrls: string[] = [];
      for (const entry of allLabels) {
        qrDataUrls.push(await generateQRDataUrl(encodeQRData(entry)));
      }

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [width, height],
      });

      for (let i = 0; i < allLabels.length; i++) {
        if (i > 0) pdf.addPage([width, height], 'landscape');

        const labelHtml = generateSingleLabelHtml(allLabels[i], qrDataUrls[i]);

        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:absolute;left:-9999px;top:-9999px;border:none;';
        iframe.style.width = `${width}mm`;
        iframe.style.height = `${height}mm`;
        document.body.appendChild(iframe);

        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc) throw new Error('Cannot access iframe');
        iframeDoc.open();
        iframeDoc.write(labelHtml);
        iframeDoc.close();

        await new Promise(resolve => setTimeout(resolve, 300));

        const label = iframeDoc.querySelector('.label') as HTMLElement;
        if (label) {
          const canvas = await html2canvas(label, {
            scale: 4,
            backgroundColor: '#ffffff',
            logging: false,
          });
          pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, width, height);
        }

        document.body.removeChild(iframe);
      }

      pdf.save(`QR_Label_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success(`Đã xuất ${allLabels.length} nhãn QR ra PDF (55x30mm)`);
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('Lỗi khi xuất PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-primary/20 p-3 bg-primary/5">
        <div className="flex items-center gap-2 mb-1">
          <Smartphone className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-primary">Tối ưu cho quét bằng điện thoại</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Mã QR lớn, dễ quét bằng camera. Dùng cho kiểm kho hoặc xuất hàng - quét phát ăn ngay!
          Khổ giấy cố định: 55x30mm (máy in 365B).
        </p>
      </div>

      {/* Settings */}
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1 space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Tuỳ chọn hiển thị</p>

          <div className="flex items-center space-x-3">
            <Checkbox
              id="qr-showPrice"
              checked={settings.showPrice}
              onCheckedChange={(checked) => setSettings({ ...settings, showPrice: checked as boolean })}
            />
            <Label htmlFor="qr-showPrice" className="font-normal cursor-pointer">In giá</Label>
          </div>

          <div className="flex items-center space-x-3">
            <Checkbox
              id="qr-showProductName"
              checked={settings.showProductName}
              onCheckedChange={(checked) => setSettings({ ...settings, showProductName: checked as boolean })}
            />
            <Label htmlFor="qr-showProductName" className="font-normal cursor-pointer">In tên sản phẩm</Label>
          </div>

          <div className="flex items-center space-x-3">
            <Checkbox
              id="qr-showStoreName"
              checked={settings.showStoreName}
              onCheckedChange={(checked) => setSettings({ ...settings, showStoreName: checked as boolean })}
            />
            <Label htmlFor="qr-showStoreName" className="font-normal cursor-pointer">In tên cửa hàng</Label>
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

        {/* Preview */}
        {sampleEntry && (
          <div className="flex-1 flex flex-col items-center">
            <p className="text-xs text-muted-foreground mb-2">Xem trước nhãn (55x30mm)</p>
            <div className="border-2 border-dashed border-primary/30 rounded-lg bg-background"
              style={{ width: '220px', height: '120px', padding: '6px' }}
            >
              <div className="flex items-center h-full gap-2">
                {/* QR preview - real QR */}
                <div className="flex-shrink-0 w-[90px] h-[90px] flex items-center justify-center">
                  {previewQrUrl ? (
                    <img src={previewQrUrl} alt="QR Preview" className="w-full h-full" style={{ imageRendering: 'pixelated' }} />
                  ) : (
                    <QrCode className="h-12 w-12 text-foreground" />
                  )}
                </div>
                {/* Info */}
                <div className="flex-1 flex flex-col justify-center gap-0.5 overflow-hidden min-w-0">
                  {settings.showStoreName && settings.storeName && (
                    <p className="text-[9px] font-bold text-primary truncate">{settings.storeName}</p>
                  )}
                  {settings.showProductName && (
                    <p className="text-[7px] text-foreground line-clamp-2">{sampleEntry.name}</p>
                  )}
                  {settings.showPrice && (
                    <p className="text-[10px] font-bold text-foreground">
                      {formatNumberWithSpaces(sampleEntry.printPrice)} đ
                    </p>
                  )}
                </div>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 text-center">
              QR chứa: {sampleEntry.imei ? `${sampleEntry.imei}|Tên|Giá` : `N:Tên:Giá`}
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={handleExportPDF} disabled={isExporting}>
          {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
          Xuất PDF
        </Button>
        <Button onClick={handlePrint} disabled={isExporting}>
          <Printer className="mr-2 h-4 w-4" />
          In QR ({totalLabels} nhãn)
        </Button>
      </div>
    </div>
  );
}
