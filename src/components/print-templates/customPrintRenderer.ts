import type { TemplateElement } from '@/components/print-templates/designer/types';
import type { CustomPrintTemplate } from '@/hooks/useCustomPrintTemplates';

/**
 * Map dynamic field keys to actual receipt data values.
 */
function resolveField(key: string, receipt: any, branchInfo?: any): string {
  const customer = receipt.customer || {};
  const fmt = (n: number | undefined | null) =>
    n != null ? n.toLocaleString('vi-VN') + 'đ' : '';

  switch (key) {
    // Shop
    case 'store_name':
      return branchInfo?.name || receipt.branch_name || 'Cửa hàng';
    case 'store_phone':
      return branchInfo?.phone ? `SĐT: ${branchInfo.phone}` : '';
    case 'store_address':
      return branchInfo?.address || '';
    // Order
    case 'created_on':
      return `Ngày: ${new Date(receipt.sale_date || receipt.export_date || receipt.created_at || new Date()).toLocaleString('vi-VN')}`;
    case 'invoice_code':
      return `Mã: ${receipt.code || ''}`;
    case 'staff_name':
      return receipt.staff_name ? `NV: ${receipt.staff_name}` : '';
    case 'location_name':
      return branchInfo?.name || '';
    // Customer
    case 'customer_name':
      return customer.name ? `KH: ${customer.name}` : '';
    case 'customer_phone':
      return customer.phone ? `SĐT: ${customer.phone}` : '';
    case 'billing_address':
      return customer.address ? `ĐC: ${customer.address}` : '';
    // Totals
    case 'total':
      return `Tổng tiền: ${fmt(receipt.total_amount)}`;
    case 'paid_amount': {
      const paid = receipt.paid_amount ?? receipt.payments
        ?.filter((p: any) => p.payment_type !== 'debt')
        .reduce((s: number, p: any) => s + (p.amount || 0), 0);
      return `Đã TT: ${fmt(paid)}`;
    }
    case 'debt': {
      const debt = receipt.debt_amount ?? receipt.payments
        ?.filter((p: any) => p.payment_type === 'debt')
        .reduce((s: number, p: any) => s + (p.amount || 0), 0);
      return debt > 0 ? `Công nợ: ${fmt(debt)}` : '';
    }
    case 'discount': {
      const d = (receipt.points_discount || 0) + (receipt.voucher_discount || 0);
      return d > 0 ? `Giảm giá: -${fmt(d)}` : '';
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
  const parts: string[] = [
    `position: absolute`,
    `left: ${(el.x / 200) * 100}%`,
    `top: ${(el.y / 100) * 100}%`,
    `width: ${(el.w / 200) * 100}%`,
    `height: ${(el.h / 100) * 100}%`,
    `overflow: hidden`,
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
function renderElement(el: TemplateElement, receipt: any, branchInfo?: any): string {
  const style = elementStyle(el);

  switch (el.type) {
    case 'text':
      return `<div style="${style}">${el.content || ''}</div>`;

    case 'dynamic':
      return `<div style="${style}">${resolveField(el.field || '', receipt, branchInfo)}</div>`;

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

  const elementsHTML = elements.map(el => renderElement(el, receipt, branchInfo)).join('\n');

  return `
    <html>
    <head>
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
          height: 100%;
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
