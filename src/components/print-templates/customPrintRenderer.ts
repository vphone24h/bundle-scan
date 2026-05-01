import type { TemplateElement } from '@/components/print-templates/designer/types';
import type { CustomPrintTemplate } from '@/hooks/useCustomPrintTemplates';

/**
 * Map dynamic field keys to actual receipt data values.
 */
interface RenderExtras {
  warrantyQrDataUrl?: string;
  warrantyQrLabel?: string;
  bankQrDataUrl?: string;
  bankQrLabel?: string;
}

function resolveField(key: string, receipt: any, branchInfo?: any, extras?: RenderExtras): string {
  const customer = receipt.customer || {};
  const fmt = (n: number | undefined | null) =>
    n != null ? n.toLocaleString('vi-VN') + 'đ' : '';
  const dateStr = (d: any) => d ? new Date(d).toLocaleDateString('vi-VN') : '';
  const timeStr = (d: any) => d ? new Date(d).toLocaleString('vi-VN') : '';

  switch (key) {
    // Store
    case 'store_name': return branchInfo?.name || receipt.branch_name || 'Cửa hàng';
    case 'store_phone': return branchInfo?.phone || '';
    case 'store_address': return branchInfo?.address || '';
    case 'store_email': return branchInfo?.email || receipt.store_email || '';
    case 'store_province': return branchInfo?.province || receipt.store_province || '';
    case 'store_logo': return ''; // handled as image element
    // Branch
    case 'location_name': return branchInfo?.name || '';
    case 'location_address': return branchInfo?.address || '';
    case 'location_phone': return branchInfo?.phone || '';
    case 'location_province': return branchInfo?.province || '';
    // Order
    case 'created_on': return dateStr(receipt.sale_date || receipt.export_date || receipt.created_at);
    case 'created_on_time': return timeStr(receipt.sale_date || receipt.export_date || receipt.created_at);
    case 'modified_on': return dateStr(receipt.updated_at);
    case 'invoice_code': return receipt.code || '';
    case 'staff_name': return receipt.staff_name || '';
    case 'assignee_name': return receipt.assignee_name || receipt.staff_name || '';
    case 'source': return receipt.source || '';
    case 'order_note': return receipt.note || receipt.notes || '';
    case 'warranty_number': {
      if (receipt.warranty_number) return receipt.warranty_number;
      if (receipt.warranty_term) return receipt.warranty_term;
      // Aggregate from items if not set at receipt level
      const items = receipt.items || [];
      const warranties = [...new Set(items.map((i: any) => i.warranty).filter(Boolean))];
      return warranties.join(', ');
    }
    // Customer
    case 'customer_name': return customer.name || '';
    case 'customer_phone': return customer.phone || '';
    case 'billing_address': return customer.address || '';
    case 'customer_code': return customer.code || '';
    case 'customer_group': return customer.group_name || '';
    case 'customer_debt': return customer.debt != null ? fmt(customer.debt) : '';
    case 'debt_before': return receipt.debt_before != null ? fmt(receipt.debt_before) : '';
    case 'customer_email': return customer.email || '';
    // Shipping
    case 'shipping_name': return receipt.shipping_name || '';
    case 'shipping_phone': return receipt.shipping_phone || '';
    case 'shipping_address': return receipt.shipping_address || '';
    case 'ship_date': return dateStr(receipt.ship_date);
    // Totals
    case 'total': return fmt(receipt.total_amount);
    case 'subtotal': return fmt(receipt.subtotal || receipt.total_amount);
    case 'paid_amount': {
      const paid = receipt.paid_amount ?? receipt.payments
        ?.filter((p: any) => p.payment_type !== 'debt')
        .reduce((s: number, p: any) => s + (p.amount || 0), 0);
      return fmt(paid);
    }
    case 'debt': {
      const debt = receipt.debt_amount ?? receipt.payments
        ?.filter((p: any) => p.payment_type === 'debt')
        .reduce((s: number, p: any) => s + (p.amount || 0), 0);
      return debt > 0 ? fmt(debt) : '0đ';
    }
    case 'discount': {
      const d = (receipt.points_discount || 0) + (receipt.voucher_discount || 0);
      return d > 0 ? fmt(d) : '0đ';
    }
    case 'total_quantity': {
      const qty = (receipt.items || []).reduce((s: number, i: any) => s + (Number(i.quantity) || 0), 0);
      return String(qty);
    }
    case 'payment_method': {
      const methods = (receipt.payments || []).map((p: any) => {
        if (p.payment_type === 'cash') return 'Tiền mặt';
        if (p.payment_type === 'transfer') return 'Chuyển khoản';
        if (p.payment_type === 'card') return 'Thẻ';
        if (p.payment_type === 'debt') return 'Công nợ';
        return p.payment_type || '';
      });
      return [...new Set(methods)].join(', ');
    }
    default:
      return `{${key}}`;
  }
}

/**
 * Resolve a table column field for a single item row.
 */
function resolveTableField(field: string, item: any, index: number): string {
  const qty = Number(item.quantity) || 1;
  const price = Number(item.sale_price) || 0;
  const amount = Math.round(qty * price * 1000) / 1000;
  const unit = item.unit || '';
  const isDecimal = ['kg', 'lít', 'mét'].includes(unit.toLowerCase());
  const displayQty = isDecimal ? parseFloat(qty.toFixed(3)) : Math.round(qty);

  switch (field) {
    case 'line_stt': return String(index + 1);
    case 'line_variant': return item.product_name || '';
    case 'serials': return item.imei || item.serial || '';
    case 'line_qty': return `${displayQty}${unit ? ` ${unit}` : ''}`;
    case 'line_price': return price.toLocaleString('vi-VN') + 'đ';
    case 'line_amount': return amount.toLocaleString('vi-VN') + 'đ';
    case 'line_warranty': return item.warranty || '';
    default: return '';
  }
}

/**
 * Build inline CSS string from element properties.
 */
function elementStyle(el: TemplateElement): string {
  // Text & dynamic elements should NOT clip; table & image keep overflow hidden
  const autoHeight = el.type === 'text' || el.type === 'dynamic' || el.type === 'table';
  const parts: string[] = [
    `position: absolute`,
    `left: ${(el.x / 200) * 100}%`,
    `top: ${(el.y / 100) * 100}%`,
    `width: ${(el.w / 200) * 100}%`,
    autoHeight ? `min-height: ${(el.h / 100) * 100}%` : `height: ${(el.h / 100) * 100}%`,
    autoHeight ? `overflow: visible` : `overflow: hidden`,
    `box-sizing: border-box`,
    `white-space: pre-wrap`,
    `word-wrap: break-word`,
    `overflow-wrap: break-word`,
  ];
  if (el.fontFamily) parts.push(`font-family: '${el.fontFamily}', sans-serif`);
  if (el.fontSize) parts.push(`font-size: ${el.fontSize}px`);
  if (el.fontWeight === 'bold') parts.push(`font-weight: bold`);
  if (el.fontStyle === 'italic') parts.push(`font-style: italic`);
  if (el.textDecoration === 'underline') parts.push(`text-decoration: underline`);
  if (el.textAlign) parts.push(`text-align: ${el.textAlign}`);
  if (el.textTransform === 'uppercase') parts.push(`text-transform: uppercase`);
  return parts.join('; ');
}

/**
 * Render a single element to HTML string.
 */
function renderElement(el: TemplateElement, receipt: any, branchInfo?: any, extras?: RenderExtras): string {
  const style = elementStyle(el);

  switch (el.type) {
    case 'text':
      return `<div style="${style}">${el.content || ''}</div>`;

    case 'dynamic': {
      // Special: warranty QR is rendered as an image
      if (el.field === 'warranty_qr') {
        const qrSrc = extras?.warrantyQrDataUrl;
        if (!qrSrc) {
          return `<div style="${style}; display:flex; align-items:center; justify-content:center; border:1px dashed #999; color:#999; font-size:10px; text-align:center;">QR bảo hành<br/>(chưa có IMEI/SĐT hoặc tên miền)</div>`;
        }
        return `<div style="${style}; display:flex; align-items:center; justify-content:center;"><img src="${qrSrc}" style="max-width:100%;max-height:100%;object-fit:contain;" /></div>`;
      }
      if (el.field === 'bank_qr') {
        const qrSrc = extras?.bankQrDataUrl;
        if (!qrSrc) {
          return `<div style="${style}; display:flex; align-items:center; justify-content:center; border:1px dashed #999; color:#999; font-size:10px; text-align:center;">QR chuyển khoản<br/>(chưa cấu hình STK)</div>`;
        }
        return `<div style="${style}; display:flex; align-items:center; justify-content:center;"><img src="${qrSrc}" style="max-width:100%;max-height:100%;object-fit:contain;" /></div>`;
      }
      const value = resolveField(el.field || '', receipt, branchInfo, extras);
      const prefix = el.fieldLabel || '';
      return `<div style="${style}">${prefix}${value}</div>`;
    }

    case 'image':
      if (el.imageUrl) {
        return `<div style="${style}"><img src="${el.imageUrl}" style="max-width:100%;max-height:100%;object-fit:contain;" /></div>`;
      }
      return '';

    case 'line':
      return `<div style="${style}; display:flex; align-items:center;"><div style="width:100%; border-top:1px solid #333;"></div></div>`;

    case 'table': {
      const cols = el.tableColumns || [];
      const items = receipt.items || [];
      const headerCells = cols.map(c =>
        `<th style="width:${c.width}%; padding:4px 2px; border:1px solid #999; font-weight:bold; text-align:left; font-size:${(el.fontSize || 11)}px;">${c.label}</th>`
      ).join('');
      const bodyRows = items.map((item: any, idx: number) => {
        const cells = cols.map(c =>
          `<td style="width:${c.width}%; padding:4px 2px; border:1px solid #ddd; font-size:${(el.fontSize || 11)}px;">${resolveTableField(c.field, item, idx)}</td>`
        ).join('');
        return `<tr>${cells}</tr>`;
      }).join('');

      return `<div style="${style}">
        <table style="width:100%; border-collapse:collapse;">
          <thead><tr>${headerCells}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>`;
    }

    default:
      return '';
  }
}

/**
 * Generate the full print HTML for a custom template.
 */
export function renderCustomPrintHTML(
  template: CustomPrintTemplate,
  receipt: any,
  branchInfo?: { name: string; address: string | null; phone: string | null } | null,
  extras?: RenderExtras,
): string {
  const elements = (template.template_data as any)?.elements as TemplateElement[] | undefined;
  if (!elements?.length) return '<p style="text-align:center;padding:40px;">Mẫu in chưa có nội dung. Vui lòng thiết kế mẫu trước.</p>';

  const paper = template.paper_size === 'A5'
    ? { w: 148, h: 210 }
    : { w: 210, h: 297 };

  const mt = template.margin_top || 0;
  const mb = template.margin_bottom || 0;
  const ml = template.margin_left || 0;
  const mr = template.margin_right || 0;
  const scale = (template.scale_percent || 100) / 100;

  const elementsHTML = elements.map(el => renderElement(el, receipt, branchInfo, extras)).join('\n');

  return `
    <html>
    <head>
      <link href="https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,400;0,700;1,400&family=Open+Sans:ital,wght@0,400;0,700;1,400&family=Montserrat:wght@400;700&family=Lato:ital,wght@0,400;0,700;1,400&family=Nunito:wght@400;700&family=Be+Vietnam+Pro:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
      <title>Hoá đơn ${receipt.code || ''}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page {
          size: ${paper.w}mm ${paper.h}mm;
          margin: ${mt}mm ${mr}mm ${mb}mm ${ml}mm;
        }
        html, body {
          font-family: Arial, sans-serif;
          width: ${paper.w}mm;
          height: ${paper.h}mm;
          margin: 0;
          padding: ${mt}mm ${mr}mm ${mb}mm ${ml}mm;
          box-sizing: border-box;
          color: #000;
          transform: scale(${scale});
          transform-origin: top left;
        }
        .canvas {
          position: relative;
          width: 100%;
          min-height: 100%;
        }
        table { page-break-inside: auto; }
        tr { page-break-inside: avoid; page-break-after: auto; }
        @media print {
          body { width: ${paper.w}mm; }
        }
      </style>
    </head>
    <body>
      <div class="canvas">
        ${elementsHTML}
      </div>
    </body>
    </html>
  `;
}
