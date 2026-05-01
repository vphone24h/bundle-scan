import { useRef, useState, useEffect, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Printer, X } from 'lucide-react';
import type { InvoiceTemplate, TextAlign } from '@/hooks/useInvoiceTemplates';
import { useActiveCustomPrintTemplates, type CustomPrintTemplate } from '@/hooks/useCustomPrintTemplates';
import { renderCustomPrintHTML } from '@/components/print-templates/customPrintRenderer';
import { generateWarrantyQrCard } from '@/lib/warrantyQrCard';
import { generateBankQrCard } from '@/lib/bankQrCard';

interface InvoicePrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receipt: any;
  template: InvoiceTemplate | null | undefined;
  branchInfo?: {
    name: string;
    address: string | null;
    phone: string | null;
  } | null;
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
  branchInfo,
}: InvoicePrintDialogProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const { data: customTemplates = [] } = useActiveCustomPrintTemplates(receipt?.branch_id);

  // Fetch custom domain for the RECEIPT's tenant (not the logged-in user's tenant).
  // This ensures QR points to the correct shop when admin views/prints another shop's receipt.
  const receiptTenantId = receipt?.tenant_id as string | undefined;
  const { data: receiptDomains } = useQuery({
    queryKey: ['custom-domains-by-tenant', receiptTenantId],
    enabled: !!receiptTenantId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_domains')
        .select('domain, is_verified')
        .eq('tenant_id', receiptTenantId!)
        .order('is_verified', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
  const verifiedDomain = receiptDomains?.find(d => d.is_verified)?.domain || receiptDomains?.[0]?.domain || null;

  // Build warranty QR URL: prefer IMEI, fallback to phone
  const warrantyQrUrl = useMemo(() => {
    if (!verifiedDomain) return null;
    const firstImei = receipt?.items?.find((i: any) => i?.imei)?.imei;
    const phone = receipt?.customer?.phone;
    const param = firstImei ? `imei=${encodeURIComponent(firstImei)}` : (phone ? `phone=${encodeURIComponent(phone)}` : null);
    if (!param) return null;
    return `https://${verifiedDomain}/bao-hanh?${param}`;
  }, [verifiedDomain, receipt]);

  const [warrantyQrDataUrl, setWarrantyQrDataUrl] = useState<string>('');
  useEffect(() => {
    if (!warrantyQrUrl) { setWarrantyQrDataUrl(''); return; }
    generateWarrantyQrCard({
      qrUrl: warrantyQrUrl,
      label: (template?.warranty_qr_label || 'Quét mã để tra cứu bảo hành'),
    })
      .then(setWarrantyQrDataUrl)
      .catch(() => setWarrantyQrDataUrl(''));
  }, [template?.warranty_qr_label, warrantyQrUrl]);

  // Bank QR — số tiền tự điền theo công nợ còn lại của hoá đơn
  const bankQrAmount = useMemo(() => {
    if (!receipt) return 0;
    const total = Number(receipt.total_amount) || 0;
    const paid = receipt.paid_amount != null
      ? Number(receipt.paid_amount) || 0
      : (receipt.payments || [])
          .filter((p: any) => p.payment_type !== 'debt')
          .reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
    const remaining = total - paid;
    // Nếu đã thanh toán đủ → dùng tổng tiền (để khách quét thanh toán lại nếu cần)
    return remaining > 0 ? remaining : total;
  }, [receipt]);

  const [bankQrDataUrl, setBankQrDataUrl] = useState<string>('');
  useEffect(() => {
    const enabled = (template as any)?.show_bank_qr;
    const bin = (template as any)?.bank_bin;
    const acct = (template as any)?.bank_account_number;
    if (!enabled || !bin || !acct) { setBankQrDataUrl(''); return; }
    generateBankQrCard({
      bankBin: bin,
      bankName: (template as any)?.bank_name || null,
      accountNumber: acct,
      accountHolder: (template as any)?.bank_account_holder || null,
      amount: bankQrAmount,
      addInfo: receipt?.code || null,
      label: (template as any)?.bank_qr_label || 'Quét mã để chuyển khoản',
    })
      .then(setBankQrDataUrl)
      .catch(() => setBankQrDataUrl(''));
  }, [
    (template as any)?.show_bank_qr,
    (template as any)?.bank_bin,
    (template as any)?.bank_name,
    (template as any)?.bank_account_number,
    (template as any)?.bank_account_holder,
    (template as any)?.bank_qr_label,
    bankQrAmount,
    receipt?.code,
  ]);

  // 'thermal' = old template, or custom template ID
  const [printMode, setPrintMode] = useState<string>('thermal');

  // Auto-select default custom template if one is marked is_default
  useEffect(() => {
    if (customTemplates.length === 0) return;
    const defaultCustom = customTemplates.find(t => t.is_default);
    if (defaultCustom && printMode === 'thermal') {
      setPrintMode(defaultCustom.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customTemplates.length]);

  // Find the selected custom template
  const selectedCustomTemplate = printMode !== 'thermal'
    ? customTemplates.find(t => t.id === printMode)
    : null;

  if (!receipt) return null;

  // Determine store info: use template values, fall back to branch info
  const storeInfo = {
    name: template?.store_name || branchInfo?.name || 'Cửa hàng',
    address: template?.store_address || branchInfo?.address || null,
    phone: template?.store_phone || branchInfo?.phone || null,
  };

  const handlePrint = () => {
    // Custom template print via iframe (stable on mobile)
    if (selectedCustomTemplate) {
      const html = renderCustomPrintHTML(selectedCustomTemplate, receipt, branchInfo, {
        warrantyQrDataUrl,
        warrantyQrLabel: template?.warranty_qr_label || 'Quét mã để tra cứu bảo hành',
        bankQrDataUrl,
        bankQrLabel: (template as any)?.bank_qr_label || 'Quét mã để chuyển khoản',
      });
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.left = '-9999px';
      iframe.style.top = '-9999px';
      iframe.style.width = '0';
      iframe.style.height = '0';
      document.body.appendChild(iframe);
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) return;
      doc.open();
      doc.write(html);
      doc.close();
      setTimeout(() => {
        try { iframe.contentWindow?.print(); } catch { /* noop */ }
        setTimeout(() => { try { document.body.removeChild(iframe); } catch { /* noop */ } }, 2000);
      }, 100);
      return;
    }

    // Thermal template print (existing logic)
    const printContent = printRef.current;
    if (!printContent) return;

    const isK80 = template?.paper_size === 'K80';
    const contentHeightPx = Math.ceil(printContent.scrollHeight + 24);

    const fontSize = template?.font_size === 'small' ? '12px' : template?.font_size === 'large' ? '16px' : '14px';
    const width = isK80 ? '80mm' : '210mm';
    const marginLeft = template?.margin_left ?? 0;
    const marginRight = template?.margin_right ?? 0;
    const pageSize = isK80 ? `${width} ${contentHeightPx}px` : 'A4';

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const printWindow = iframe.contentWindow;
    const printDocument = iframe.contentDocument || printWindow?.document;
    if (!printWindow || !printDocument) {
      document.body.removeChild(iframe);
      return;
    }

    printDocument.write(`
      <html>
        <head>
          <title>Hóa đơn ${receipt.code}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            @page {
              size: ${pageSize};
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
              color: #000 !important;
              ${isK80 ? 'font-weight: 600; -webkit-font-smoothing: none; -webkit-print-color-adjust: exact; print-color-adjust: exact;' : ''}
            }
            ${isK80 ? `
            * { color: #000 !important; }
            .text-gray, .text-muted-foreground { color: #000 !important; }
            b, strong, .font-bold { font-weight: 800 !important; }
            ` : ''}
            ${isK80 ? `html, body { height: ${contentHeightPx}px !important; overflow: hidden; }` : ''}
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
            thead { display: table-row-group; }
            .separator { border-top: 1px dashed #333; margin: 8px 0; }
            .flex-col { flex-direction: column; }
            .items-center { align-items: center; }
            .gap-1 { gap: 4px; }
            .mt-3 { margin-top: 12px; }
            .warranty-qr-box { width: 100%; margin-top: 12px; text-align: center; page-break-inside: avoid; break-inside: avoid; }
            .warranty-qr-box img { display: block; width: 100px; height: 100px; margin: 0 auto; }
            .warranty-qr-box .qr-label { display: block; width: 100%; font-size: 11px; line-height: 1.3; font-style: italic; color: #555; margin-top: 4px; text-align: center; white-space: normal; }
            .rich-text-content ul { list-style: disc; padding-left: 1.25rem; margin: 4px 0; }
            .rich-text-content ol { list-style: decimal; padding-left: 1.25rem; margin: 4px 0; }
            .rich-text-content li { margin: 2px 0; }
            .rich-text-content b, .rich-text-content strong { font-weight: bold; }
            .rich-text-content i, .rich-text-content em { font-style: italic; }
            .rich-text-content u { text-decoration: underline; }
            .rich-text-content p { margin: 4px 0; }
            @media print {
              body { width: ${width}; }
              thead { display: table-row-group; }
              ${isK80 ? `html, body { height: ${contentHeightPx}px !important; }` : ''}
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printDocument.close();

    const cleanup = () => {
      try { document.body.removeChild(iframe); } catch { /* noop */ }
    };
    printWindow.onafterprint = cleanup;

    const triggerPrint = () => {
      try {
        printWindow.focus();
        printWindow.print();
      } finally {
        setTimeout(cleanup, 1000);
      }
    };

    // Wait for all images (including QR) to load before printing to avoid layout shift
    const waitForImages = () => {
      const imgs = Array.from(printDocument.images || []);
      if (imgs.length === 0) return Promise.resolve();
      return Promise.all(
        imgs.map((img) =>
          img.complete && img.naturalWidth > 0
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                img.onload = () => resolve();
                img.onerror = () => resolve();
                setTimeout(() => resolve(), 2000);
              })
        )
      );
    };

    setTimeout(() => {
      waitForImages().then(triggerPrint);
    }, 100);
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
    show_tax: false,
    show_thank_you: true,
    show_custom_description: false,
    custom_description_text: '',
    custom_description_bold: false,
    custom_description_align: 'center' as TextAlign,
    custom_description_image_url: null as string | null,
    show_warranty_qr: false,
    warranty_qr_label: 'Quét mã để tra cứu bảo hành',
    show_bank_qr: false,
    bank_qr_label: 'Quét mã để chuyển khoản',
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

        {/* Template selector */}
        {customTemplates.length > 0 && (
          <div className="flex items-center gap-2 pb-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Mẫu in:</span>
            <Select value={printMode} onValueChange={setPrintMode}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="thermal">🧾 Mẫu in nhiệt (mặc định)</SelectItem>
                {customTemplates.map(ct => (
                  <SelectItem key={ct.id} value={ct.id}>
                    📄 {ct.name} ({ct.paper_size})
                    {ct.is_default ? ' ⭐' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Custom template preview */}
        {selectedCustomTemplate ? (
          <div className="border rounded-lg bg-white p-2 overflow-auto max-h-[60vh]">
            <div
              className="mx-auto bg-white text-black"
              style={{
                width: selectedCustomTemplate.paper_size === 'A5' ? '370px' : '520px',
                aspectRatio: selectedCustomTemplate.paper_size === 'A5' ? '148 / 210' : '210 / 297',
                position: 'relative',
                fontSize: '10px',
              }}
              dangerouslySetInnerHTML={{
                __html: (() => {
                  const elements = (selectedCustomTemplate.template_data as any)?.elements || [];
                  return elements.map((el: any) => {
                    // Inline mini-render for preview
                    const isAutoHeight = el.type === 'text' || el.type === 'dynamic' || el.type === 'table';
                    const style = [
                      `position: absolute`,
                      `left: ${(el.x / 200) * 100}%`,
                      `top: ${(el.y / 100) * 100}%`,
                      `width: ${(el.w / 200) * 100}%`,
                      isAutoHeight ? `min-height: ${(el.h / 100) * 100}%` : `height: ${(el.h / 100) * 100}%`,
                      isAutoHeight ? `overflow: visible` : `overflow: hidden`,
                      `white-space: pre-wrap`,
                      `word-wrap: break-word`,
                      `overflow-wrap: break-word`,
                      `box-sizing: border-box`,
                      el.fontSize ? `font-size: ${el.fontSize * 0.55}px` : '',
                      el.fontWeight === 'bold' ? 'font-weight: bold' : '',
                      el.fontStyle === 'italic' ? 'font-style: italic' : '',
                      el.textDecoration === 'underline' ? 'text-decoration: underline' : '',
                      el.textAlign ? `text-align: ${el.textAlign}` : '',
                      el.textTransform === 'uppercase' ? 'text-transform: uppercase' : '',
                    ].filter(Boolean).join('; ');

                    if (el.type === 'text') return `<div style="${style}">${el.content || ''}</div>`;
                    if (el.type === 'dynamic') {
                      if (el.field === 'warranty_qr') {
                        if (warrantyQrDataUrl) {
                          return `<div style="${style}; display:flex; align-items:center; justify-content:center;"><img src="${warrantyQrDataUrl}" style="max-width:100%;max-height:100%;object-fit:contain;" /></div>`;
                        }
                        return `<div style="${style}; display:flex; align-items:center; justify-content:center; border:1px dashed #999; color:#999; font-size:8px; text-align:center;">QR bảo hành</div>`;
                      }
                      const val = resolveFieldPreview(el.field, receipt, branchInfo);
                      return `<div style="${style}">${val}</div>`;
                    }
                    if (el.type === 'line') return `<div style="${style}; display:flex; align-items:center;"><div style="width:100%; border-top:1px solid #333;"></div></div>`;
                    if (el.type === 'image' && el.imageUrl) return `<div style="${style}"><img src="${el.imageUrl}" style="max-width:100%;max-height:100%;object-fit:contain;" /></div>`;
                    if (el.type === 'table') {
                      const cols = el.tableColumns || [];
                      const items = receipt.items || [];
                      const headerCells = cols.map((c: any) =>
                        `<th style="width:${c.width}%; padding:2px 1px; border:1px solid #999; font-weight:bold; text-align:left; font-size:${(el.fontSize || 10) * 0.5}px;">${c.label}</th>`
                      ).join('');
                      const bodyRows = items.slice(0, 5).map((item: any, idx: number) => {
                        const cells = cols.map((c: any) => {
                          const val = resolveTableFieldPreview(c.field, item, idx);
                          return `<td style="width:${c.width}%; padding:2px 1px; border:1px solid #ddd; font-size:${(el.fontSize || 10) * 0.5}px;">${val}</td>`;
                        }).join('');
                        return `<tr>${cells}</tr>`;
                      }).join('');
                      const moreRow = items.length > 5 ? `<tr><td colspan="${cols.length}" style="text-align:center; font-size:8px; color:#999;">... +${items.length - 5} SP</td></tr>` : '';
                      return `<div style="${style}"><table style="width:100%; border-collapse:collapse;"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}${moreRow}</tbody></table></div>`;
                    }
                    return '';
                  }).join('');
                })(),
              }}
            />
          </div>
        ) : (
          /* Thermal template preview (existing) */
          <div 
            ref={printRef} 
            className="p-4 border rounded-lg bg-white text-black text-sm"
            style={{ fontFamily: 'Arial, sans-serif' }}
          >
            {/* Section 1: Store info */}
            <div className={`section ${s1Align}`}>
              {settings.show_store_name && (
                <div className="text-xl font-bold">{storeInfo.name}</div>
              )}
              {settings.show_store_address && storeInfo.address && (
                <div className="text-sm">{storeInfo.address}</div>
              )}
              {settings.show_store_phone && storeInfo.phone && (
                <div className="text-sm">ĐT: {storeInfo.phone}</div>
              )}
            </div>

            <div className="separator"></div>

            {settings.show_receipt_code && (
              <div className={`section ${s2Align}`}>
                <div className="text-lg font-bold">HÓA ĐƠN BÁN HÀNG</div>
              </div>
            )}

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

            <div className="separator"></div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  {settings.show_product_name && <th className="py-1 text-left">Sản phẩm</th>}
                  {settings.show_sale_price && <th className="py-1 text-right">Giá</th>}
                </tr>
              </thead>
              <tbody>
                {receipt.items?.map((item: any, index: number) => {
                  const qty = Number(item.quantity) || 1;
                  const unitPrice = Number(item.sale_price) || 0;
                  const lineTotal = Math.round(qty * unitPrice * 1000) / 1000;
                  const unit = item.unit || '';
                  const isDecimalUnit = ['kg', 'lít', 'mét'].includes(unit.toLowerCase());
                  const displayQty = isDecimalUnit
                    ? parseFloat(qty.toFixed(3))
                    : Math.round(qty);
                  const showQty = !item.imei && qty !== 1;

                  return (
                  <tr key={index} className="border-b border-dashed">
                    <td className="py-1">
                      {settings.show_product_name && <div>{item.product_name}</div>}
                      {settings.show_sku && <div className="text-xs text-gray">SKU: {item.sku}</div>}
                      {settings.show_imei && item.imei && (
                        <div className="text-xs text-gray">IMEI: {item.imei}</div>
                      )}
                      {showQty && (
                        <div className="text-xs text-gray">
                          SL: {displayQty}{unit ? ` ${unit}` : ''} x {unitPrice.toLocaleString('vi-VN')}đ
                        </div>
                      )}
                      {settings.show_warranty && item.warranty && (
                        <div className="text-xs" style={{ color: '#0066cc' }}>BH: {item.warranty}</div>
                      )}
                    </td>
                    {settings.show_sale_price && (
                      <td className="py-1 text-right">{lineTotal.toLocaleString('vi-VN')}đ</td>
                    )}
                  </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="separator"></div>

            <div className={`section ${s5Align}`}>
              {settings.show_tax && receipt.tax_amount > 0 && settings.show_total && (
                <div className="flex justify-between text-sm">
                  <span>Tiền hàng:</span>
                  <span>
                    {receipt.subtotal_amount?.toLocaleString('vi-VN') || 
                      receipt.items?.reduce((s: number, i: any) => s + i.sale_price, 0).toLocaleString('vi-VN')}đ
                  </span>
                </div>
              )}
              {settings.show_tax && receipt.tax_amount > 0 && (
                <div className="flex justify-between text-sm" style={{ color: '#666' }}>
                  <span>Thuế VAT ({receipt.tax_rate}%):</span>
                  <span>{receipt.tax_amount?.toLocaleString('vi-VN')}đ</span>
                </div>
              )}
              {settings.show_total && (
                <div className="flex justify-between font-bold">
                  <span>Tổng tiền:</span>
                  <span>{receipt.total_amount?.toLocaleString('vi-VN') || 
                    receipt.items?.reduce((s: number, i: any) => s + i.sale_price, 0).toLocaleString('vi-VN')}đ</span>
                </div>
              )}
              {(receipt.points_discount > 0) && (
                <div className="flex justify-between text-sm" style={{ color: '#16a34a' }}>
                  <span>Giảm điểm ({receipt.points_redeemed} điểm):</span>
                  <span>-{receipt.points_discount?.toLocaleString('vi-VN')}đ</span>
                </div>
              )}
              {(receipt.voucher_discount > 0) && (
                <div className="flex justify-between text-sm" style={{ color: '#16a34a' }}>
                  <span>Giảm voucher:</span>
                  <span>-{receipt.voucher_discount?.toLocaleString('vi-VN')}đ</span>
                </div>
              )}
              {(receipt.points_discount > 0 || receipt.voucher_discount > 0) && (
                <div className="flex justify-between font-bold">
                  <span>Còn lại:</span>
                  <span>{((receipt.total_amount || 0) - (receipt.points_discount || 0) - (receipt.voucher_discount || 0)).toLocaleString('vi-VN')}đ</span>
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

            {settings.show_custom_description && (settings.custom_description_text || settings.custom_description_image_url) && (
              <div 
                className={`mt-2 text-sm rich-text-content ${getAlignClass(settings.custom_description_align)}`}
                style={{ 
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
                <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(settings.custom_description_text || '') }} />
              </div>
            )}

            {(settings as any).show_warranty_qr && warrantyQrDataUrl && (
              <div
                className="warranty-qr-box"
                style={{
                  width: '100%',
                  marginTop: '12px',
                  textAlign: 'center',
                  pageBreakInside: 'avoid',
                  breakInside: 'avoid',
                  overflow: 'hidden',
                }}
              >
                <img
                  src={warrantyQrDataUrl}
                  alt="QR bảo hành và hướng dẫn tra cứu"
                  style={{
                    display: 'block',
                    width: '120px',
                    height: 'auto',
                    margin: '0 auto',
                    verticalAlign: 'top',
                  }}
                />
              </div>
            )}

            {(settings as any).show_bank_qr && bankQrDataUrl && (
              <div
                className="bank-qr-box"
                style={{
                  width: '100%',
                  marginTop: '12px',
                  textAlign: 'center',
                  pageBreakInside: 'avoid',
                  breakInside: 'avoid',
                  overflow: 'hidden',
                }}
              >
                <img
                  src={bankQrDataUrl}
                  alt="QR chuyển khoản"
                  style={{
                    display: 'block',
                    width: '140px',
                    height: 'auto',
                    margin: '0 auto',
                    verticalAlign: 'top',
                  }}
                />
              </div>
            )}

            {settings.show_thank_you && (
              <div className="mt-4 text-center italic">
                {settings.thank_you_text || 'Cảm ơn quý khách!'}
              </div>
            )}
          </div>
        )}

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

// Helper functions for preview (simplified versions)
function resolveFieldPreview(key: string, receipt: any, branchInfo?: any): string {
  const customer = receipt?.customer || {};
  const fmt = (n: number | undefined | null) =>
    n != null ? n.toLocaleString('vi-VN') + 'đ' : '';

  switch (key) {
    case 'store_name': return branchInfo?.name || 'Cửa hàng';
    case 'store_phone': return branchInfo?.phone ? `SĐT: ${branchInfo.phone}` : '';
    case 'store_address': return branchInfo?.address || '';
    case 'created_on': return `Ngày: ${new Date(receipt?.sale_date || receipt?.export_date || receipt?.created_at || new Date()).toLocaleString('vi-VN')}`;
    case 'invoice_code': return `Mã: ${receipt?.code || ''}`;
    case 'staff_name': return receipt?.staff_name ? `NV: ${receipt.staff_name}` : '';
    case 'location_name': return branchInfo?.name || '';
    case 'customer_name': return customer.name ? `KH: ${customer.name}` : '';
    case 'customer_phone': return customer.phone ? `SĐT: ${customer.phone}` : '';
    case 'billing_address': return customer.address ? `ĐC: ${customer.address}` : '';
    case 'total': return `Tổng: ${fmt(receipt?.total_amount)}`;
    case 'paid_amount': return `Đã TT: ${fmt(receipt?.paid_amount)}`;
    case 'debt': return receipt?.debt_amount > 0 ? `Nợ: ${fmt(receipt.debt_amount)}` : '';
    case 'discount': {
      const d = (receipt?.points_discount || 0) + (receipt?.voucher_discount || 0);
      return d > 0 ? `Giảm: -${fmt(d)}` : '';
    }
    default: return `{${key}}`;
  }
}

function resolveTableFieldPreview(field: string, item: any, index: number): string {
  const qty = Number(item.quantity) || 1;
  const price = Number(item.sale_price) || 0;
  const amount = Math.round(qty * price * 1000) / 1000;
  switch (field) {
    case 'line_stt': return String(index + 1);
    case 'line_variant': return item.product_name || '';
    case 'serials': return item.imei || '';
    case 'line_qty': return String(qty);
    case 'line_price': return price.toLocaleString('vi-VN');
    case 'line_amount': return amount.toLocaleString('vi-VN');
    case 'line_warranty': return item.warranty || '';
    default: return '';
  }
}
