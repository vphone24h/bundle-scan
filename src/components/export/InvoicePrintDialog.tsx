import { useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, X } from 'lucide-react';
import type { InvoiceTemplate, TextAlign } from '@/hooks/useInvoiceTemplates';

interface InvoicePrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receipt: any;
  template: InvoiceTemplate | null | undefined;
}

const getAlignClass = (align: TextAlign | undefined) => {
  switch (align) {
    case 'center': return 'text-center';
    case 'right': return 'text-right';
    default: return 'text-left';
  }
};

export function InvoicePrintDialog({
  open,
  onOpenChange,
  receipt,
  template,
}: InvoicePrintDialogProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!receipt) return null;

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const fontSize = template?.font_size === 'small' ? '12px' : template?.font_size === 'large' ? '16px' : '14px';
    const width = template?.paper_size === 'K80' ? '80mm' : '210mm';
    const marginLeft = template?.margin_left ?? 0;
    const marginRight = template?.margin_right ?? 0;

    printWindow.document.write(`
      <html>
        <head>
          <title>Hóa đơn ${receipt.code}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            @page {
              size: ${width} auto;
              margin: 0 !important;
              padding: 0 !important;
            }
            html, body {
              font-family: Arial, sans-serif;
              font-size: ${fontSize};
              width: ${width};
              margin: 0 !important;
              padding: 2mm ${marginRight}mm 2mm ${marginLeft}mm;
              box-sizing: border-box;
            }
            /* Section alignment classes */
            .section { margin-bottom: 8px; }
            .text-center { text-align: center !important; }
            .text-left { text-align: left !important; }
            .text-right { text-align: right !important; }
            .text-xl { font-size: 1.25rem; }
            .text-lg { font-size: 1.125rem; }
            .text-sm { font-size: 0.875rem; }
            .text-xs { font-size: 0.75rem; }
            .font-bold { font-weight: bold; }
            .mb-1 { margin-bottom: 0.25rem; }
            .mb-2 { margin-bottom: 0.5rem; }
            .mb-4 { margin-bottom: 1rem; }
            .mt-2 { margin-top: 0.5rem; }
            .mt-4 { margin-top: 1rem; }
            .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
            .space-y-1 > * + * { margin-top: 0.25rem; }
            .italic { font-style: italic; }
            .flex { display: flex; }
            .justify-between { justify-content: space-between; }
            .w-full { width: 100%; }
            .border-b { border-bottom: 1px solid #333; }
            .border-dashed { border-style: dashed; }
            .text-red { color: #dc2626; }
            .text-gray { color: #666; }
            table { width: 100%; border-collapse: collapse; page-break-inside: auto; }
            th, td { padding: 4px 2px; border-bottom: 1px dashed #999; }
            th { font-weight: bold; }
            tr { page-break-inside: avoid; page-break-after: auto; }
            thead { display: table-row-group; } /* Prevent header repeat on page break */
            .separator { border-top: 1px dashed #333; margin: 8px 0; }
            @media print {
              body { width: ${width}; }
              thead { display: table-row-group; }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  const settings = template || {
    show_store_name: true,
    store_name: 'Cửa hàng',
    show_store_address: false,
    store_address: '',
    show_store_phone: false,
    store_phone: '',
    show_customer_info: true,
    show_sale_date: true,
    show_receipt_code: true,
    show_product_name: true,
    show_sku: true,
    show_imei: true,
    show_warranty: true,
    show_sale_price: true,
    show_total: true,
    show_paid_amount: true,
    show_debt: true,
    show_points_earned: false,
    show_thank_you: true,
    show_custom_description: false,
    custom_description_text: '',
    custom_description_bold: false,
    custom_description_align: 'center' as TextAlign,
    custom_description_image_url: null as string | null,
    thank_you_text: 'Cảm ơn quý khách!',
    section1_align: 'center' as TextAlign,
    section2_align: 'center' as TextAlign,
    section3_align: 'left' as TextAlign,
    section4_align: 'left' as TextAlign,
    section5_align: 'left' as TextAlign,
  };

  const s1Align = getAlignClass(settings.section1_align);
  const s2Align = getAlignClass(settings.section2_align);
  const s3Align = getAlignClass(settings.section3_align);
  const s5Align = getAlignClass(settings.section5_align);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            In hóa đơn
          </DialogTitle>
        </DialogHeader>

        {/* Preview */}
        <div 
          ref={printRef} 
          className="p-4 border rounded-lg bg-white text-black text-sm"
          style={{ fontFamily: 'Arial, sans-serif' }}
        >
          {/* Section 1: Store info */}
          <div className={`section ${s1Align}`}>
            {settings.show_store_name && (
              <div className="text-xl font-bold">{settings.store_name || 'Cửa hàng'}</div>
            )}
            {settings.show_store_address && settings.store_address && (
              <div className="text-sm">{settings.store_address}</div>
            )}
            {settings.show_store_phone && settings.store_phone && (
              <div className="text-sm">ĐT: {settings.store_phone}</div>
            )}
          </div>

          {/* Separator */}
          <div className="separator"></div>

          {/* Section 2: Invoice title */}
          {settings.show_receipt_code && (
            <div className={`section ${s2Align}`}>
              <div className="text-lg font-bold">HÓA ĐƠN BÁN HÀNG</div>
            </div>
          )}

          {/* Section 3: Code, date, customer */}
          <div className={`section ${s3Align}`}>
            {settings.show_receipt_code && (
              <div className="text-sm mb-1">Mã: {receipt.code}</div>
            )}
            {settings.show_sale_date && (
              <div className="text-sm mb-1">
                Ngày: {new Date(receipt.export_date || receipt.created_at || new Date()).toLocaleString('vi-VN')}
              </div>
            )}
            {settings.show_customer_info && receipt.customer && (
              <>
                <div className="text-sm">KH: {receipt.customer.name}</div>
                <div className="text-sm">SĐT: {receipt.customer.phone}</div>
                {receipt.customer.address && <div className="text-sm">ĐC: {receipt.customer.address}</div>}
              </>
            )}
          </div>

          {/* Separator */}
          <div className="separator"></div>

          {/* Section 4: Items */}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                {settings.show_product_name && <th className="py-1 text-left">Sản phẩm</th>}
                {settings.show_sale_price && <th className="py-1 text-right">Giá</th>}
              </tr>
            </thead>
            <tbody>
              {receipt.items?.map((item: any, index: number) => (
                <tr key={index} className="border-b border-dashed">
                  <td className="py-1">
                    {settings.show_product_name && <div>{item.product_name}</div>}
                    {settings.show_sku && <div className="text-xs text-gray">SKU: {item.sku}</div>}
                    {settings.show_imei && item.imei && (
                      <div className="text-xs text-gray">IMEI: {item.imei}</div>
                    )}
                    {settings.show_warranty && item.warranty && (
                      <div className="text-xs" style={{ color: '#0066cc' }}>BH: {item.warranty}</div>
                    )}
                  </td>
                  {settings.show_sale_price && (
                    <td className="py-1 text-right">{item.sale_price?.toLocaleString('vi-VN')}đ</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Separator */}
          <div className="separator"></div>

          {/* Section 5: Totals */}
          <div className={`section ${s5Align}`}>
            {settings.show_total && (
              <div className="flex justify-between font-bold">
                <span>Tổng tiền:</span>
                <span>{receipt.total_amount?.toLocaleString('vi-VN') || 
                  receipt.items?.reduce((s: number, i: any) => s + i.sale_price, 0).toLocaleString('vi-VN')}đ</span>
              </div>
            )}
            {settings.show_paid_amount && (
              <div className="flex justify-between">
                <span>Đã thanh toán:</span>
                <span>{receipt.paid_amount?.toLocaleString('vi-VN') ||
                  receipt.payments?.filter((p: any) => p.payment_type !== 'debt')
                    .reduce((s: number, p: any) => s + p.amount, 0).toLocaleString('vi-VN')}đ</span>
              </div>
            )}
            {settings.show_debt && (receipt.debt_amount > 0 || receipt.payments?.some((p: any) => p.payment_type === 'debt')) && (
              <div className="flex justify-between text-red">
                <span>Công nợ:</span>
                <span>{receipt.debt_amount?.toLocaleString('vi-VN') ||
                  receipt.payments?.filter((p: any) => p.payment_type === 'debt')
                    .reduce((s: number, p: any) => s + p.amount, 0).toLocaleString('vi-VN')}đ</span>
              </div>
            )}
            {settings.show_points_earned && receipt.points_earned > 0 && (
              <div className="flex justify-between" style={{ color: '#16a34a' }}>
                <span>Điểm tích lũy:</span>
                <span>+{receipt.points_earned} điểm</span>
              </div>
            )}
          </div>

          {/* Custom description */}
          {settings.show_custom_description && (settings.custom_description_text || settings.custom_description_image_url) && (
            <div 
              className={`mt-2 text-sm ${getAlignClass(settings.custom_description_align)}`}
              style={{ 
                whiteSpace: 'pre-wrap',
                fontWeight: settings.custom_description_bold ? 'bold' : 'normal'
              }}
            >
              {settings.custom_description_image_url && (
                <img 
                  src={settings.custom_description_image_url} 
                  alt="Custom" 
                  style={{ maxWidth: '100%', maxHeight: '60px', marginBottom: '4px' }}
                />
              )}
              {settings.custom_description_text}
            </div>
          )}

          {/* Thank you */}
          {settings.show_thank_you && (
            <div className="mt-4 text-center italic">
              {settings.thank_you_text || 'Cảm ơn quý khách!'}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-2" />
            Đóng
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            In hóa đơn
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}