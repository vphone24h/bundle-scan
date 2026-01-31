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
import type { InvoiceTemplate } from '@/hooks/useInvoiceTemplates';

interface InvoicePrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receipt: any;
  template: InvoiceTemplate | null | undefined;
}

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
    const textAlign = template?.text_align || 'left';
    const width = template?.paper_size === 'K80' ? '80mm' : '210mm';

    printWindow.document.write(`
      <html>
        <head>
          <title>Hóa đơn ${receipt.code}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              font-size: ${fontSize};
              text-align: ${textAlign};
              width: ${width};
              margin: 0 auto;
              padding: 10mm;
            }
            .header { margin-bottom: 10px; }
            .store-name { font-size: 1.5em; font-weight: bold; }
            .receipt-code { font-weight: bold; margin: 10px 0; }
            table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            th, td { padding: 5px; border-bottom: 1px dashed #ccc; text-align: left; }
            th { font-weight: bold; }
            .text-right { text-align: right; }
            .total { font-weight: bold; font-size: 1.2em; }
            .thank-you { margin-top: 20px; text-align: center; font-style: italic; }
            @media print {
              body { width: ${width}; }
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
    show_sale_price: true,
    show_total: true,
    show_paid_amount: true,
    show_debt: true,
    show_thank_you: true,
    thank_you_text: 'Cảm ơn quý khách!',
  };

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
          {/* Store info */}
          {settings.show_store_name && (
            <div className="text-center mb-4">
              <div className="text-xl font-bold">{settings.store_name || 'Cửa hàng'}</div>
            </div>
          )}
          {settings.show_store_address && settings.store_address && (
            <div className="text-center text-sm">{settings.store_address}</div>
          )}
          {settings.show_store_phone && settings.store_phone && (
            <div className="text-center text-sm mb-2">ĐT: {settings.store_phone}</div>
          )}

          {/* Receipt code */}
          {settings.show_receipt_code && (
            <div className="text-center font-bold my-2">
              HÓA ĐƠN BÁN HÀNG
              <div className="text-sm">Mã: {receipt.code}</div>
            </div>
          )}

          {/* Date */}
          {settings.show_sale_date && (
            <div className="text-sm mb-2">
              Ngày: {new Date(receipt.export_date || receipt.created_at || new Date()).toLocaleString('vi-VN')}
            </div>
          )}

          {/* Customer */}
          {settings.show_customer_info && receipt.customer && (
            <div className="mb-4 text-sm">
              <div>Khách hàng: {receipt.customer.name}</div>
              <div>SĐT: {receipt.customer.phone}</div>
              {receipt.customer.address && <div>Địa chỉ: {receipt.customer.address}</div>}
            </div>
          )}

          {/* Items */}
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
                    {settings.show_sku && <div className="text-xs text-gray-500">SKU: {item.sku}</div>}
                    {settings.show_imei && item.imei && (
                      <div className="text-xs text-gray-500">IMEI: {item.imei}</div>
                    )}
                  </td>
                  {settings.show_sale_price && (
                    <td className="py-1 text-right">{item.sale_price?.toLocaleString('vi-VN')}đ</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="mt-4 space-y-1 text-sm">
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
              <div className="flex justify-between text-destructive">
                <span>Công nợ:</span>
                <span>{receipt.debt_amount?.toLocaleString('vi-VN') ||
                  receipt.payments?.filter((p: any) => p.payment_type === 'debt')
                    .reduce((s: number, p: any) => s + p.amount, 0).toLocaleString('vi-VN')}đ</span>
              </div>
            )}
          </div>

          {/* Thank you */}
          {settings.show_thank_you && (
            <div className="mt-6 text-center italic">
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
