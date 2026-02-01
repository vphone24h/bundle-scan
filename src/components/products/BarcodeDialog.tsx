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
import { Printer, ArrowLeft, Eye, Grid3X3, Barcode, DollarSign, Copy, Trash2, Plus, Minus, FileDown, Loader2, HelpCircle, ExternalLink, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useBarcodePrintGuideUrl } from '@/hooks/useAppConfig';
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
  const [settings, setSettings] = useState<BarcodeSettings>(() => {
    // Load saved store name from localStorage
    const savedStoreName = localStorage.getItem('barcode-store-name') || 'Kho Hàng VN';
    return {
      showPrice: true,
      priceWithVND: true,
      showProductName: true,
      showStoreName: true,
      storeName: savedStoreName,
      showCustomDescription: false,
      customDescription: '',
    };
  });

  // Save store name to localStorage when it changes
  useEffect(() => {
    if (settings.storeName) {
      localStorage.setItem('barcode-store-name', settings.storeName);
    }
  }, [settings.storeName]);
  const [selectedPaper, setSelectedPaper] = useState<string | null>(null);
  const [previewPaper, setPreviewPaper] = useState<PaperTemplate | null>(null);
  const [adjustments, setAdjustments] = useState<PrintAdjustments>({
    scale: 1,
    rotation: 0,
    autoCompensateRotation: true,
  });
  const [isExporting, setIsExporting] = useState(false);
  
  // Lấy URL hướng dẫn in từ cấu hình admin
  const barcodePrintGuideUrl = useBarcodePrintGuideUrl();

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

  // Export to PDF for manual printing later
  // PDF phải đồng bộ 100% với màn hình preview: cùng layout, cùng scale, KHÔNG xoay/swap kích thước.
  const handleExportPDF = async () => {
    if (!selectedPaper) return;
    
    const paper = mockPaperTemplates.find(p => p.id === selectedPaper);
    if (!paper) return;

    setIsExporting(true);
    toast.info('Đang tạo file PDF...');

    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ]);

      const { width, height } = paper.dimensions;
      const scale = adjustments.scale ?? 1;

      // PDF giữ nguyên khổ giấy gốc (55x30), không swap
      const pdfPageWidth = width;
      const pdfPageHeight = height;

      // Tạo HTML riêng cho PDF - KHÔNG có rotation compensation
      const pdfHtmlContent = generatePdfOnlyContent(paper, productEntries, settings, scale);
      
      // Tạo iframe ẩn để render
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:absolute;left:-9999px;top:-9999px;border:none;';
      iframe.style.width = `${pdfPageWidth}mm`;
      iframe.style.height = `${pdfPageHeight * 10}mm`; // Đủ cao cho nhiều label
      document.body.appendChild(iframe);
      
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) throw new Error('Cannot access iframe document');
      
      iframeDoc.open();
      iframeDoc.write(pdfHtmlContent);
      iframeDoc.close();

      // Đợi JsBarcode render xong - tăng thời gian và kiểm tra đã render
      await new Promise<void>((resolve) => {
        let attempts = 0;
        const maxAttempts = 50;
        const checkInterval = setInterval(() => {
          attempts++;
          const barcodes = iframeDoc.querySelectorAll('.barcode');
          const allRendered = Array.from(barcodes).every(svg => {
            const rect = svg.querySelector('rect');
            return rect !== null;
          });
          
          if (allRendered || attempts >= maxAttempts) {
            clearInterval(checkInterval);
            // Thêm thời gian buffer để đảm bảo tất cả nội dung đã render
            setTimeout(resolve, 500);
          }
        }, 100);
      });

      const labels = iframeDoc.querySelectorAll('.label');
      
      // Tạo PDF với đúng khổ giấy
      const pdf = new jsPDF({
        orientation: pdfPageWidth > pdfPageHeight ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [pdfPageWidth, pdfPageHeight],
      });

      for (let i = 0; i < labels.length; i++) {
        const label = labels[i] as HTMLElement;
        
        if (i > 0) {
          pdf.addPage([pdfPageWidth, pdfPageHeight], pdfPageWidth > pdfPageHeight ? 'landscape' : 'portrait');
        }

        // Capture với scale cao để barcode sắc nét
        const canvas = await html2canvas(label, {
          scale: 4,
          backgroundColor: '#ffffff',
          logging: false,
          useCORS: true,
          allowTaint: true,
        });

        // Fill toàn bộ trang PDF
        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 0, 0, pdfPageWidth, pdfPageHeight);
      }

      const paperName = paper.name.replace(/[^a-zA-Z0-9]/g, '_');
      pdf.save(`Ma_Vach_${paperName}_${new Date().toISOString().slice(0, 10)}.pdf`);
      
      document.body.removeChild(iframe);
      toast.success(`Đã xuất ${labels.length} nhãn ra file PDF (${pdfPageWidth}x${pdfPageHeight}mm)`);
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('Lỗi khi xuất PDF. Vui lòng thử lại.');
    } finally {
      setIsExporting(false);
    }
  };

  // Export to Word với kích thước 55x30mm
  const handleExportWord = async () => {
    if (!selectedPaper) return;
    
    const paper = mockPaperTemplates.find(p => p.id === selectedPaper);
    if (!paper) return;

    setIsExporting(true);
    toast.info('Đang tạo file Word...');

    try {
      const [{ Document, Packer, Paragraph, TextRun, ImageRun, PageOrientation, convertMillimetersToTwip }, { saveAs }, { default: html2canvas }] = await Promise.all([
        import('docx'),
        import('file-saver'),
        import('html2canvas'),
      ]);

      const { width, height } = paper.dimensions;
      const scale = adjustments.scale ?? 1;

      // Tạo HTML để render nhãn thành hình ảnh
      const pdfHtmlContent = generatePdfOnlyContent(paper, productEntries, settings, scale);
      
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:absolute;left:-9999px;top:-9999px;border:none;';
      iframe.style.width = `${width}mm`;
      iframe.style.height = `${height * 10}mm`;
      document.body.appendChild(iframe);
      
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) throw new Error('Cannot access iframe document');
      
      iframeDoc.open();
      iframeDoc.write(pdfHtmlContent);
      iframeDoc.close();

      // Đợi JsBarcode render xong
      await new Promise<void>((resolve) => {
        let attempts = 0;
        const maxAttempts = 50;
        const checkInterval = setInterval(() => {
          attempts++;
          const barcodes = iframeDoc.querySelectorAll('.barcode');
          const allRendered = Array.from(barcodes).every(svg => {
            const rect = svg.querySelector('rect');
            return rect !== null;
          });
          
          if (allRendered || attempts >= maxAttempts) {
            clearInterval(checkInterval);
            setTimeout(resolve, 500);
          }
        }, 100);
      });

      const labels = iframeDoc.querySelectorAll('.label');
      const sections: any[] = [];

      for (let i = 0; i < labels.length; i++) {
        const label = labels[i] as HTMLElement;

        // Capture nhãn thành hình ảnh
        const canvas = await html2canvas(label, {
          scale: 4,
          backgroundColor: '#ffffff',
          logging: false,
          useCORS: true,
          allowTaint: true,
        });

        // Convert canvas to blob
        const blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((b) => resolve(b!), 'image/png', 1.0);
        });
        const arrayBuffer = await blob.arrayBuffer();

        sections.push({
          properties: {
            page: {
              size: {
                width: convertMillimetersToTwip(width),
                height: convertMillimetersToTwip(height),
                orientation: width > height ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
              },
              margin: {
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
              },
            },
          },
          children: [
            new Paragraph({
              children: [
                new ImageRun({
                  data: arrayBuffer,
                  transformation: {
                    width: convertMillimetersToTwip(width) / 15, // Convert twip to points approx
                    height: convertMillimetersToTwip(height) / 15,
                  },
                  type: 'png',
                }),
              ],
            }),
          ],
        });
      }

      const doc = new Document({ sections });
      const buffer = await Packer.toBlob(doc);

      const paperName = paper.name.replace(/[^a-zA-Z0-9]/g, '_');
      saveAs(buffer, `Ma_Vach_${paperName}_${new Date().toISOString().slice(0, 10)}.docx`);
      
      document.body.removeChild(iframe);
      toast.success(`Đã xuất ${labels.length} nhãn ra file Word (${width}x${height}mm)`);
    } catch (error) {
      console.error('Word export error:', error);
      toast.error('Lỗi khi xuất Word. Vui lòng thử lại.');
    } finally {
      setIsExporting(false);
    }
  };

  // Tạo HTML riêng cho PDF - ĐỒNG BỘ 100% với template in trực tiếp
  const generatePdfOnlyContent = (
    paper: PaperTemplate,
    entries: ProductPriceEntry[],
    printSettings: BarcodeSettings,
    scale: number
  ): string => {
    const { width, height } = paper.dimensions;
    
    // Expand theo số lượng
    const allLabels: ProductPriceEntry[] = [];
    entries.forEach(entry => {
      for (let i = 0; i < entry.quantity; i++) {
        allLabels.push(entry);
      }
    });

    const isSmallLabel = height <= 22;
    const isJewelryLabel = height <= 10;
    
    // Giảm chiều cao barcode để không che tên sản phẩm - ĐỒNG BỘ với print
    const baseBarcodeHeight = isJewelryLabel ? 10 : isSmallLabel ? 12 : 14;
    const baseBarcodeWidth = isJewelryLabel ? 0.5 : 0.5;
    const barcodeHeight = Math.round(baseBarcodeHeight * scale);
    const barcodeWidth = baseBarcodeWidth * scale;

    const labelHTML = allLabels.map((entry, idx) => {
      if (isJewelryLabel) {
        return `
          <div class="label">
            <div class="label-content-wrapper">
              <div class="codes-container-inline">
                <svg class="barcode" id="barcode-${idx}"></svg>
              </div>
              ${printSettings.showPrice ? 
                `<div class="price-inline">${formatNumberWithSpaces(entry.printPrice)}</div>` : ''}
            </div>
          </div>
        `;
      }
      
      return `
        <div class="label">
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
            ${entry.imei ? `<div class="code-text">${entry.imei}</div>` : ''}
            ${printSettings.showPrice ? 
              `<div class="price">${formatNumberWithSpaces(entry.printPrice)}${printSettings.priceWithVND ? ' VND' : ''}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');

    const initScript = allLabels.map((entry, idx) => {
      const rawValue = entry.imei ? `${entry.imei}:${entry.printPrice}` : (entry.sku || entry.productId);
      const sanitizedValue = String(rawValue).replace(/[^\x20-\x7E]/g, '');
      return `
        JsBarcode("#barcode-${idx}", ${JSON.stringify(sanitizedValue)}, {
          format: "CODE128",
          width: ${barcodeWidth},
          height: ${barcodeHeight},
          displayValue: false,
          margin: 0
        });
      `;
    }).join('\n');

    // CSS ĐỒNG BỘ với template in - giữ nguyên tỷ lệ, không xoay
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>PDF Export</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
        <style>
          * { margin: 0 !important; padding: 0 !important; box-sizing: border-box !important; }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            font-family: Arial, sans-serif;
            background: white;
          }
          
          .label {
            width: ${width}mm;
            height: ${height}mm;
            position: relative;
            background: white;
            overflow: hidden;
            page-break-after: always;
          }
          
          .label-content-wrapper {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(${scale});
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            gap: 1px;
            width: ${width - 2}mm;
          }
          
          .store-name {
            font-size: ${Math.round(7 * scale)}px;
            font-weight: bold;
            color: #000;
            line-height: 1;
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            flex-shrink: 0;
          }
          
          .product-name {
            font-size: ${Math.round(6 * scale)}px;
            color: #000;
            line-height: 1;
            word-break: break-word;
            max-width: 100%;
            max-height: 1.2em;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            flex-shrink: 0;
          }
          
          .custom-description {
            font-size: ${Math.round(6 * scale)}px;
            color: #000;
            line-height: 1;
            white-space: pre-wrap;
            flex-shrink: 0;
          }
          
          .codes-container, .codes-container-inline {
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 1px 0 !important;
            flex-shrink: 0;
          }
          
          .barcode { display: block; }
          
          .code-text {
            font-size: ${Math.round(5 * scale)}px;
            color: #333;
            line-height: 1;
            flex-shrink: 0;
          }
          
          .price, .price-inline {
            font-size: ${Math.round(8 * scale)}px;
            font-weight: bold;
            color: #000;
            line-height: 1;
            flex-shrink: 0;
          }
        </style>
      </head>
      <body>
        <div class="labels-container">
          ${labelHTML}
        </div>
        <script>
          document.addEventListener('DOMContentLoaded', function() {
            try {
              ${initScript}
            } catch(e) {
              console.error('Barcode init error:', e);
            }
          });
        </script>
      </body>
      </html>
    `;
  };

  // Generate PDF content - giữ nguyên hướng ngang, không xoay
  const generatePdfContent = (
    paper: PaperTemplate,
    entries: ProductPriceEntry[],
    printSettings: BarcodeSettings,
    scale: number
  ): string => {
    const { width, height } = paper.dimensions;
    
    // Generate all labels (repeat by quantity)
    const allLabels: ProductPriceEntry[] = [];
    entries.forEach(entry => {
      for (let i = 0; i < entry.quantity; i++) {
        allLabels.push(entry);
      }
    });

    // Calculate sizes based on label dimensions
    const isSmallLabel = height <= 22;
    const isJewelryLabel = height <= 10;
    
    const baseBarcodeHeight = isJewelryLabel ? 12 : isSmallLabel ? 14 : 18;
    const baseBarcodeWidth = 0.6;
    
    const barcodeHeight = Math.round(baseBarcodeHeight * scale);
    const barcodeWidth = baseBarcodeWidth * scale;

     const labelHTML = allLabels.map((entry, idx) => {
        // Encode format:
        // - IMEI products: IMEI:PRICE (barcode CODE128)
        // - Non-IMEI products (phụ kiện): dùng BARCODE dài (CODE128) theo SKU (tránh QR đè chữ)
        const codeValue = entry.imei
          ? `${entry.imei}:${entry.printPrice}`
          : (entry.sku || entry.productId);
      
      if (isJewelryLabel) {
        return `
          <div class="label jewelry-label">
            <div class="codes-container-inline">
              <svg class="barcode" id="barcode-${idx}"></svg>
            </div>
            ${printSettings.showPrice ? 
              `<div class="price-inline">${formatNumberWithSpaces(entry.printPrice)}</div>` : ''}
          </div>
        `;
      }
      
       return `
        <div class="label">
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
             ${entry.imei ? `<div class="code-text">${entry.imei}</div>` : ''}
            ${printSettings.showPrice ? 
              `<div class="price">${formatNumberWithSpaces(entry.printPrice)}${printSettings.priceWithVND ? ' VND' : ''}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');

      // Generate initialization script for Barcode (IMEI + non-IMEI)
     const initScript = allLabels.map((entry, idx) => {
        const rawValue = entry.imei ? `${entry.imei}:${entry.printPrice}` : (entry.sku || entry.productId);
        // CODE128 chỉ nên dùng ASCII; nếu sku có ký tự lạ -> loại bỏ để tránh in trắng.
        const sanitizedValue = String(rawValue).replace(/[^\x20-\x7E]/g, '');
        const codeValueJs = JSON.stringify(sanitizedValue);

       return `
         JsBarcode("#barcode-${idx}", ${codeValueJs}, {
           format: "CODE128",
           width: ${barcodeWidth},
           height: ${barcodeHeight},
           displayValue: false,
           margin: 0
         });
       `;
     }).filter(Boolean).join('\n');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Xuất PDF mã vạch</title>
         <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
        <style>
          * {
            margin: 0 !important;
            padding: 0 !important;
            box-sizing: border-box !important;
          }
          
          @page {
            size: ${width}mm ${height}mm;
            margin: 0mm !important;
          }
          
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: ${width}mm;
            font-family: Arial, sans-serif;
            background: white;
          }
          
          .labels-container {
            display: block;
            margin: 0 !important;
            padding: 0 !important;
            width: ${width}mm;
          }
          
          .label {
            width: ${width}mm !important;
            height: ${height}mm !important;
            margin: 0 !important;
            padding: 0 !important;
            box-sizing: border-box !important;
            position: relative !important;
            page-break-after: always;
            page-break-inside: avoid;
            overflow: hidden !important;
            background: white;
          }
          
           .label-content-wrapper {
            /* Định vị tuyệt đối ở giữa - đồng bộ với mẫu in */
            position: absolute !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) scale(${scale}) !important;
            
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            text-align: center !important;
            gap: 2px !important;
            
            width: ${width - 4}mm;
            height: ${height - 4}mm;
          }
          
          .store-name {
            font-size: ${Math.round(8 * scale)}px;
            font-weight: bold;
            color: #000;
            line-height: 1.1;
             max-width: 100%;
             overflow: hidden;
             text-overflow: ellipsis;
             white-space: nowrap;
          }
          
          .product-name {
            font-size: ${Math.round(7 * scale)}px;
            color: #000;
            line-height: 1.1;
            word-break: break-word;
             max-width: 100%;
             max-height: 2.2em;
             overflow: hidden;
          }
          
          .custom-description {
            font-size: ${Math.round(7 * scale)}px;
            color: #000;
            line-height: 1.1;
            white-space: pre-wrap;
          }
          
          .codes-container {
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: center;
            gap: 0;
             margin: 2px 0;
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

           /* QR styles removed: phụ kiện không IMEI chuyển sang barcode */
          
          .barcode {
            max-width: 100%;
            height: auto;
            flex-shrink: 0;
          }
          
          .code-text {
            font-size: ${Math.round(6 * scale)}px;
            font-family: monospace;
            color: #000;
          }
          
          .price {
            font-size: ${Math.round(10 * scale)}px;
            font-weight: bold;
            color: #000;
          }
          
          .price-inline {
            font-size: 7px;
            font-weight: bold;
            margin-left: 1mm;
          }
          
          .jewelry-label {
            flex-direction: row;
            padding: 0.5mm;
          }
        </style>
      </head>
      <body>
        <div class="labels-container">
          ${labelHTML}
        </div>
        <script>
          // Chờ JsBarcode load xong (QR dùng API image không cần JS)
          function waitForBarcode(callback) {
            var checkCount = 0;
            var check = function() {
              checkCount++;
              if (typeof JsBarcode !== 'undefined') {
                callback();
              } else if (checkCount < 50) {
                setTimeout(check, 100);
              } else {
                console.error('Không thể load thư viện JsBarcode');
              }
            };
            check();
          }
          
          document.addEventListener('DOMContentLoaded', function() {
            waitForBarcode(function() {
              ${initScript}
            });
          });
        </script>
      </body>
      </html>
    `;
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

    // Calculate Barcode sizes - ĐỒNG BỘ với PDF template
    const isSmallLabel = height <= 22; // Giấy cuộn nhỏ
    const isJewelryLabel = height <= 10; // Tem trang sức
    
    // Giảm chiều cao barcode để không che tên sản phẩm - ĐỒNG BỘ với PDF
    const baseBarcodeHeight = isJewelryLabel ? 10 : isSmallLabel ? 12 : 14;
    const baseBarcodeWidth = isJewelryLabel ? 0.5 : 0.5;
    
    // Apply scale to sizes
    const barcodeHeight = Math.round(baseBarcodeHeight * scale);
    const barcodeWidth = baseBarcodeWidth * scale;

     const labelHTML = allLabels.map((entry, idx) => {
        // Encode format:
        // - IMEI products: IMEI:PRICE (barcode CODE128)
        // - Non-IMEI products (phụ kiện): BARCODE dài (CODE128) theo SKU (tránh QR đè chữ)
        const codeValue = entry.imei
          ? `${entry.imei}:${entry.printPrice}`
          : (entry.sku || entry.productId);
      
      // For jewelry labels, only show barcode (too small for QR)
      // QUAN TRỌNG: Dùng pageWidth/pageHeight để khớp với CSS .label (đã swap khi rotate)
      if (isJewelryLabel) {
        return `
          <div class="label jewelry-label">
            <div class="codes-container-inline">
              <svg class="barcode" id="barcode-${idx}"></svg>
            </div>
            ${printSettings.showPrice ? 
              `<div class="price-inline">${formatNumberWithSpaces(entry.printPrice)}</div>` : ''}
          </div>
        `;
      }
      
       // Template đơn giản:
       // - IMEI: BARCODE
       // - Non-IMEI (phụ kiện): BARCODE theo SKU
       // QUAN TRỌNG: Không set inline width/height - sử dụng CSS .label để đảm bảo nhất quán
      return `
        <div class="label">
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
             ${entry.imei ? `<div class="code-text">${entry.imei}</div>` : ''}
            ${printSettings.showPrice ? 
              `<div class="price">${formatNumberWithSpaces(entry.printPrice)}${printSettings.priceWithVND ? ' VND' : ''}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');

     // Generate initialization script for Barcode (IMEI + non-IMEI)
     const initScript = allLabels.map((entry, idx) => {
        const rawValue = entry.imei ? `${entry.imei}:${entry.printPrice}` : (entry.sku || entry.productId);
        const sanitizedValue = String(rawValue).replace(/[^\x20-\x7E]/g, '');
        const codeValueJs = JSON.stringify(sanitizedValue);

       return `
         JsBarcode("#barcode-${idx}", ${codeValueJs}, {
           format: "CODE128",
           width: ${barcodeWidth},
           height: ${barcodeHeight},
           displayValue: false,
           margin: 0
         });
       `;
    }).filter(Boolean).join('\n');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>In mã vạch</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
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
            padding: 0 !important;
            box-sizing: border-box !important;
            position: relative !important;
            page-break-after: always;
            page-break-inside: avoid;
            overflow: hidden !important;
            background: white;
          }
          
           .label-content-wrapper {
            /* Định vị tuyệt đối ở giữa */
            position: absolute !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) rotate(${effectiveRotation === 270 ? -90 : effectiveRotation}deg) scale(${scale}) !important;
            
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            text-align: center !important;
             gap: 2px !important;
            
            /* Kích thước = kích thước tem gốc (trước khi driver swap) */
            width: ${width - 4}mm;
            height: ${height - 4}mm;
          }
          
          .store-name {
            font-size: ${Math.round(8 * scale)}px;
            font-weight: bold;
            color: #000;
            margin: 0 !important;
            padding: 0 !important;
            line-height: 1.1;
             max-width: 100%;
             overflow: hidden;
             text-overflow: ellipsis;
             white-space: nowrap;
          }
          
          .product-name {
            font-size: ${Math.round(7 * scale)}px;
            color: #000;
            margin: 0 !important;
            padding: 0 !important;
            line-height: 1.1;
            word-break: break-word;
             max-width: 100%;
             max-height: 2.2em;
             overflow: hidden;
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
             margin: 2px 0 !important;
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
          
          .qr-code-img {
            display: block;
            flex-shrink: 0;
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
          // Chờ JsBarcode load xong (QR dùng API image không cần JS)
          function waitForBarcode(callback) {
            var checkCount = 0;
            var check = function() {
              checkCount++;
              if (typeof JsBarcode !== 'undefined') {
                callback();
              } else if (checkCount < 50) {
                setTimeout(check, 100);
              } else {
                console.error('Không thể load thư viện JsBarcode');
              }
            };
            check();
          }
          
          document.addEventListener('DOMContentLoaded', function() {
            waitForBarcode(function() {
              ${initScript}
            });
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

           {/* Barcode placeholder (IMEI + phụ kiện không IMEI) */}
          <div className="w-full py-2">
             <div className="flex items-end justify-center gap-[1px] h-10">
               {Array.from({ length: 46 }).map((_, i) => (
                 <div
                   key={i}
                   className="bg-foreground"
                   style={{
                     width: i % 4 === 0 ? '2px' : '1px',
                     height: `${18 + Math.random() * 22}px`,
                   }}
                 />
               ))}
             </div>
             {/* Chỉ hiển thị code-text cho IMEI (phụ kiện đã ẩn để tránh chồng chữ) */}
             {sampleProduct?.imei && (
               <p className="text-[8px] text-muted-foreground mt-1 font-mono">
                 {sampleProduct.imei}
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
                {sampleEntry?.imei ? (
                  // IMEI: barcode
                  <div className="w-10 h-4 bg-muted rounded-sm flex items-center justify-center border">
                    <span className="text-muted-foreground text-[3px]">|||||||</span>
                  </div>
                ) : (
                  // Non-IMEI: QR only
                  <div className="w-6 h-6 bg-muted rounded-sm flex items-center justify-center border">
                    <span className="text-muted-foreground text-[4px]">QR</span>
                  </div>
                )}
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

        <div className="flex flex-col gap-3 pt-4">
          {/* Link hướng dẫn in */}
          {barcodePrintGuideUrl && (
            <div className="flex justify-center">
              <a
                href={barcodePrintGuideUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <HelpCircle className="h-4 w-4" />
                In rất khó, hướng dẫn
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
          
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="outline" onClick={() => setStep('paper')}>
              Quay lại
            </Button>
            <Button variant="outline" onClick={handleExportWord} disabled={isExporting}>
              {isExporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              Xuất Word
            </Button>
            <Button variant="outline" onClick={handleExportPDF} disabled={isExporting}>
              {isExporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="mr-2 h-4 w-4" />
              )}
              Xuất PDF
            </Button>
            <Button onClick={handlePrint} disabled={isExporting}>
              <Printer className="mr-2 h-4 w-4" />
              In ({totalLabels} nhãn)
            </Button>
          </div>
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
