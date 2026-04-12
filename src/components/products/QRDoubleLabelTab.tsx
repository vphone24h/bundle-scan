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
  showIMEI: boolean;
  showStoreName: boolean;
  storeName: string;
  showNote: boolean;
  note: string;
}

interface QRDoubleLabelTabProps {
  productEntries: ProductPriceEntry[];
  storeName: string;
  onPrinted?: (productIds: string[]) => Promise<void> | void;
}

function encodeQRData(entry: ProductPriceEntry): string {
  if (entry.imei) {
    return `${entry.imei}|${entry.name}|${entry.printPrice}`;
  }
  return `N:${entry.name}:${entry.printPrice}`;
}

async function generateQRDataUrl(data: string): Promise<string> {
  return QRCode.toDataURL(data, {
    width: 200,
    margin: 1,
    errorCorrectionLevel: 'M',
  });
}

// Label dimensions in mm
const LABEL_W = 35;
const LABEL_H = 22;
const PAGE_W = LABEL_W * 2; // 70mm - two labels side by side
const PAGE_H = LABEL_H;

export function QRDoubleLabelTab({ productEntries, storeName: defaultStoreName, onPrinted }: QRDoubleLabelTabProps) {
  const [settings, setSettings] = useState<QRSettings>(() => {
    const saved = localStorage.getItem('qr_label_store_name');
    return {
      showPrice: true,
      showProductName: true,
      showIMEI: true,
      showStoreName: true,
      storeName: saved || defaultStoreName,
      showNote: false,
      note: '',
    };
  });
  const [isExporting, setIsExporting] = useState(false);
  const [previewQrUrl, setPreviewQrUrl] = useState<string>('');

  const sampleEntry = productEntries[0];
  const totalLabels = productEntries.reduce((sum, e) => sum + e.quantity, 0);

  useEffect(() => {
    if (sampleEntry) {
      generateQRDataUrl(encodeQRData(sampleEntry)).then(setPreviewQrUrl);
    }
  }, [sampleEntry]);

  const expandLabels = (): ProductPriceEntry[] => {
    const all: ProductPriceEntry[] = [];
    productEntries.forEach(entry => {
      for (let i = 0; i < entry.quantity; i++) all.push(entry);
    });
    return all;
  };

  // Generate HTML for a single 35x22mm label cell
  const generateLabelCellHtml = (entry: ProductPriceEntry, qrDataUrl: string): string => {
    const qrSize = 16;
    return `
      <div style="width:${LABEL_W}mm;height:${LABEL_H}mm;display:inline-flex;align-items:center;justify-content:center;overflow:hidden;box-sizing:border-box;">
        <div style="display:flex;flex-direction:row;align-items:center;gap:1.5mm;width:${LABEL_W - 3}mm;height:${LABEL_H - 3}mm;">
          <div style="flex-shrink:0;width:${qrSize}mm;height:${qrSize}mm;">
            <img src="${qrDataUrl}" style="width:${qrSize}mm;height:${qrSize}mm;image-rendering:pixelated;" />
          </div>
          <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:0.3mm;overflow:hidden;min-width:0;">
            ${settings.showStoreName && settings.storeName ? `<div style="font-size:5.5pt;font-weight:bold;color:#000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.2;">${settings.storeName}</div>` : ''}
            ${settings.showProductName ? `<div style="font-size:4.5pt;color:#000;line-height:1.1;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${entry.name}</div>` : ''}
            ${settings.showIMEI && entry.imei ? `<div style="font-size:4.5pt;font-weight:bold;color:#000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.1;">${entry.imei}</div>` : ''}
            ${settings.showNote && settings.note ? `<div style="font-size:4pt;font-weight:bold;color:#000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.1;">${settings.note}</div>` : ''}
            ${settings.showPrice ? `<div style="font-size:6pt;font-weight:bold;color:#000;line-height:1.2;">${formatNumberWithSpaces(entry.printPrice)} đ</div>` : ''}
          </div>
        </div>
      </div>`;
  };

  // Generate full print HTML - each page is 70x22mm with 2 labels
  const generatePrintHtml = (labels: ProductPriceEntry[], qrUrls: string[]): string => {
    const pages: string[] = [];
    for (let i = 0; i < labels.length; i += 2) {
      const left = generateLabelCellHtml(labels[i], qrUrls[i]);
      const right = i + 1 < labels.length
        ? generateLabelCellHtml(labels[i + 1], qrUrls[i + 1])
        : `<div style="width:${LABEL_W}mm;height:${LABEL_H}mm;"></div>`;
      pages.push(`<div class="page">${left}${right}</div>`);
    }

    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>QR Double Label</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  @page { size: ${PAGE_W}mm ${PAGE_H}mm; margin: 0; }
  @media print { html,body { width:${PAGE_W}mm; margin:0; padding:0; } }
  html,body { margin:0; padding:0; font-family:Arial,sans-serif; background:white; }
  .page {
    width:${PAGE_W}mm; height:${PAGE_H}mm;
    display:flex; flex-direction:row;
    page-break-after:always;
    overflow:hidden; background:white;
  }
  .page:last-child { page-break-after:auto; }
</style></head><body>${pages.join('')}</body></html>`;
  };

  const handlePrint = useCallback(async () => {
    const allLabels = expandLabels();
    if (allLabels.length === 0) {
      toast.error('Không có tem để in');
      return;
    }

    toast.info(`Đang tạo ${allLabels.length} mã QR...`);
    const qrUrls: string[] = [];
    for (const entry of allLabels) {
      qrUrls.push(await generateQRDataUrl(encodeQRData(entry)));
    }

    const html = generatePrintHtml(allLabels, qrUrls);

    // Use iframe for printing
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:0;height:0;border:none;';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      toast.error('Không thể tạo khung in');
      document.body.removeChild(iframe);
      return;
    }

    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();

    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
        toast.success(`Đã gửi lệnh in ${allLabels.length} tem đôi (${Math.ceil(allLabels.length / 2)} tờ)`);
        const productIds = [...new Set(allLabels.map(e => e.productId))];
        if (onPrinted) onPrinted(productIds);
      }, 1000);
    }, 500);
  }, [productEntries, settings, onPrinted]);

  const handleExportPDF = async () => {
    setIsExporting(true);
    toast.info('Đang tạo file PDF...');

    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ]);

      const allLabels = expandLabels();
      const qrUrls: string[] = [];
      for (const entry of allLabels) {
        qrUrls.push(await generateQRDataUrl(encodeQRData(entry)));
      }

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [PAGE_W, PAGE_H],
      });

      // Process 2 labels per page
      for (let i = 0; i < allLabels.length; i += 2) {
        if (i > 0) pdf.addPage([PAGE_W, PAGE_H], 'landscape');

        const left = generateLabelCellHtml(allLabels[i], qrUrls[i]);
        const right = i + 1 < allLabels.length
          ? generateLabelCellHtml(allLabels[i + 1], qrUrls[i + 1])
          : `<div style="width:${LABEL_W}mm;height:${LABEL_H}mm;"></div>`;

        const pageHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8">
          <style>*{margin:0;padding:0;box-sizing:border-box;}html,body{margin:0;padding:0;font-family:Arial,sans-serif;background:white;}
          .page{width:${PAGE_W}mm;height:${PAGE_H}mm;display:flex;flex-direction:row;overflow:hidden;background:white;}</style>
          </head><body><div class="page">${left}${right}</div></body></html>`;

        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:absolute;left:-9999px;top:-9999px;border:none;';
        iframe.style.width = `${PAGE_W}mm`;
        iframe.style.height = `${PAGE_H}mm`;
        document.body.appendChild(iframe);

        const iDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iDoc) throw new Error('Cannot access iframe');
        iDoc.open();
        iDoc.write(pageHtml);
        iDoc.close();

        await new Promise(resolve => setTimeout(resolve, 300));

        const page = iDoc.querySelector('.page') as HTMLElement;
        if (page) {
          const canvas = await html2canvas(page, {
            scale: 4,
            backgroundColor: '#ffffff',
            logging: false,
          });
          pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, PAGE_W, PAGE_H);
        }

        document.body.removeChild(iframe);
      }

      pdf.save(`QR_Double_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success(`Đã xuất ${allLabels.length} nhãn QR ra PDF (tem đôi ${LABEL_W}x${LABEL_H}mm)`);
      const productIds = [...new Set(allLabels.map(e => e.productId))];
      if (onPrinted) await onPrinted(productIds);
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
          <span className="text-sm font-medium text-primary">Tem đôi 35×22mm (2 tem/hàng)</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Dành cho cuộn tem đôi 70×22mm (2 cột). Mỗi sản phẩm nằm trọn trong 1 ô 35×22mm.
          In lần lượt: SP1 → ô trái, SP2 → ô phải, SP3 → hàng tiếp...
        </p>
      </div>

      {/* Settings */}
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1 space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Tuỳ chọn hiển thị</p>

          <div className="flex items-center space-x-3">
            <Checkbox id="qr2-showPrice" checked={settings.showPrice}
              onCheckedChange={(c) => setSettings({ ...settings, showPrice: c as boolean })} />
            <Label htmlFor="qr2-showPrice" className="font-normal cursor-pointer">In giá</Label>
          </div>

          <div className="flex items-center space-x-3">
            <Checkbox id="qr2-showProductName" checked={settings.showProductName}
              onCheckedChange={(c) => setSettings({ ...settings, showProductName: c as boolean })} />
            <Label htmlFor="qr2-showProductName" className="font-normal cursor-pointer">In tên sản phẩm</Label>
          </div>

          <div className="flex items-center space-x-3">
            <Checkbox id="qr2-showIMEI" checked={settings.showIMEI}
              onCheckedChange={(c) => setSettings({ ...settings, showIMEI: c as boolean })} />
            <Label htmlFor="qr2-showIMEI" className="font-normal cursor-pointer">In IMEI</Label>
          </div>

          <div className="flex items-center space-x-3">
            <Checkbox id="qr2-showStoreName" checked={settings.showStoreName}
              onCheckedChange={(c) => setSettings({ ...settings, showStoreName: c as boolean })} />
            <Label htmlFor="qr2-showStoreName" className="font-normal cursor-pointer">In tên cửa hàng</Label>
          </div>

          {settings.showStoreName && (
            <div className="ml-7">
              <Input value={settings.storeName}
                onChange={(e) => {
                  const val = e.target.value;
                  setSettings({ ...settings, storeName: val });
                  localStorage.setItem('qr_label_store_name', val);
                }}
                placeholder="Tên cửa hàng" className="max-w-xs" />
            </div>
          )}

          <div className="flex items-center space-x-3">
            <Checkbox id="qr2-showNote" checked={settings.showNote}
              onCheckedChange={(c) => setSettings({ ...settings, showNote: c as boolean })} />
            <Label htmlFor="qr2-showNote" className="font-normal cursor-pointer">Ghi chú (tình trạng máy)</Label>
          </div>

          {settings.showNote && (
            <div className="ml-7">
              <Input value={settings.note}
                onChange={(e) => setSettings({ ...settings, note: e.target.value })}
                placeholder="VD: Pin 95%, màn zin..." className="max-w-xs" />
            </div>
          )}
        </div>

        {/* Preview */}
        {sampleEntry && (
          <div className="flex-1 flex flex-col items-center">
            <p className="text-xs text-muted-foreground mb-2">Xem trước 1 ô tem (35×22mm)</p>
            <div className="border-2 border-dashed border-primary/30 rounded-lg bg-background"
              style={{ width: '160px', height: '90px', padding: '4px' }}
            >
              <div className="flex items-center h-full gap-1.5">
                <div className="flex-shrink-0 w-[55px] h-[55px] flex items-center justify-center">
                  {previewQrUrl ? (
                    <img src={previewQrUrl} alt="QR Preview" className="w-full h-full" style={{ imageRendering: 'pixelated' }} />
                  ) : (
                    <QrCode className="h-10 w-10 text-foreground" />
                  )}
                </div>
                <div className="flex-1 flex flex-col justify-center gap-0 overflow-hidden min-w-0">
                  {settings.showStoreName && settings.storeName && (
                    <p className="text-[7px] font-bold text-primary truncate">{settings.storeName}</p>
                  )}
                  {settings.showProductName && (
                    <p className="text-[6px] text-foreground line-clamp-2 leading-tight">{sampleEntry.name}</p>
                  )}
                  {settings.showIMEI && sampleEntry.imei && (
                    <p className="text-[6px] font-bold text-foreground truncate">{sampleEntry.imei}</p>
                  )}
                  {settings.showNote && settings.note && (
                    <p className="text-[5px] font-bold text-foreground truncate">{settings.note}</p>
                  )}
                  {settings.showPrice && (
                    <p className="text-[8px] font-bold text-foreground">
                      {formatNumberWithSpaces(sampleEntry.printPrice)} đ
                    </p>
                  )}
                </div>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 text-center">
              Cuộn tem đôi: 2 ô/hàng × {LABEL_W}×{LABEL_H}mm
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
          In QR ({totalLabels} nhãn, {Math.ceil(totalLabels / 2)} tờ)
        </Button>
      </div>
    </div>
  );
}
