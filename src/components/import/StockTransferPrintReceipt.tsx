import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { formatCurrency } from '@/lib/mockData';
import type { StockTransferItem } from '@/hooks/useStockTransfers';

export interface TransferPrintData {
  id: string;
  fromBranchName: string;
  toBranchName: string;
  createdAt: string;
  creatorName?: string;
  note?: string;
  status: string;
  items: StockTransferItem[];
}

interface StockTransferPrintReceiptProps {
  data: TransferPrintData;
  variant?: 'button' | 'icon';
  canViewPrice?: boolean;
}

export function StockTransferPrintReceipt({ data, variant = 'button', canViewPrice = true }: StockTransferPrintReceiptProps) {
  const handlePrint = () => {
    const dateStr = format(new Date(data.createdAt), 'dd/MM/yyyy HH:mm', { locale: vi });
    const receiptCode = data.id.slice(0, 8).toUpperCase();
    const width = '80mm';

    const totalValue = data.items.reduce((s, i) => s + i.import_price * i.quantity, 0);

    const itemRows = data.items.map((item, idx) => {
      const lineTotal = item.import_price * item.quantity;
      return `
        <div class="item">
          <div class="item-header">
            <span class="item-idx">${idx + 1}</span>
            <span class="item-name">${item.product_name}</span>
          </div>
          <div class="item-detail">
            ${item.imei ? `<div>IMEI: ${item.imei}</div>` : ''}
            <div>SKU: ${item.sku}</div>
            ${item.supplier_name ? `<div>NCC: ${item.supplier_name}</div>` : ''}
            <div class="item-qty">SL: ${item.quantity}${canViewPrice ? ` x ${formatCurrency(item.import_price)}` : ''}</div>
            ${canViewPrice ? `<div class="item-total">= ${formatCurrency(lineTotal)}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');

    const bodyHtml = `
      <div class="center bold" style="font-size:16px">PHIẾU CHUYỂN HÀNG</div>
      <div class="center" style="font-size:11px;color:#555">Mã: ${receiptCode}</div>
      <div class="center" style="font-size:11px;color:#555">${dateStr}</div>
      <div class="sep"></div>

      <div class="row"><span class="label">Từ chi nhánh:</span><span class="value">${data.fromBranchName}</span></div>
      <div class="row"><span class="label">Đến chi nhánh:</span><span class="value">${data.toBranchName}</span></div>
      ${data.creatorName ? `<div class="row"><span class="label">Người chuyển:</span><span class="value">${data.creatorName}</span></div>` : ''}
      ${data.note ? `<div class="row"><span class="label">Ghi chú:</span><span class="value">${data.note}</span></div>` : ''}
      <div class="sep"></div>

      <div class="bold" style="font-size:12px;margin-bottom:4px">Danh sách sản phẩm (${data.items.length})</div>
      ${itemRows}
      <div class="sep"></div>

      ${canViewPrice ? `
      <div class="total-row">
        <span>Tổng giá trị (${data.items.length} SP)</span>
        <span class="total-value">${formatCurrency(totalValue)}</span>
      </div>
      <div class="sep"></div>
      ` : ''}

      <div class="sig-area">
        <div class="sig-box"><div class="sig-title">Người chuyển</div><div class="sig-line">(Ký, ghi rõ họ tên)</div></div>
        <div class="sig-box"><div class="sig-title">Người nhận</div><div class="sig-line">(Ký, ghi rõ họ tên)</div></div>
      </div>
      <div class="center" style="margin-top:10px;font-size:10px;color:#999">${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: vi })}</div>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Phiếu chuyển hàng - ${receiptCode}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
@page{size:${width};margin:0!important}
html,body{font-family:Arial,sans-serif;width:${width};max-width:${width};margin:0!important;padding:3mm;font-size:12px;color:#000;overflow:hidden}
.center{text-align:center}
.bold{font-weight:bold}
.sep{border-top:1px dashed #333;margin:6px 0}
.row{display:flex;justify-content:space-between;padding:2px 0}
.row .label{color:#555;flex-shrink:0}
.row .value{text-align:right;font-weight:500;word-break:break-word;max-width:55%}
.item{padding:4px 0;border-bottom:1px dotted #ccc}
.item:last-child{border-bottom:none}
.item-header{display:flex;align-items:center;gap:4px}
.item-idx{font-size:10px;color:#999;background:#f0f0f0;padding:1px 4px;border-radius:3px}
.item-name{font-weight:600;font-size:11px}
.item-detail{padding-left:20px;font-size:10px;color:#555;margin-top:2px}
.item-qty{margin-top:2px}
.item-total{font-weight:bold;color:#000;font-size:11px}
.total-row{display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-weight:bold}
.total-value{font-size:14px;color:#2563eb}
.sig-area{margin-top:12px;display:flex;justify-content:space-between}
.sig-box{text-align:center;width:45%}
.sig-title{font-size:11px;font-weight:bold}
.sig-line{margin-top:36px;font-size:10px;color:#999}
@media print{body{width:${width}}}
</style></head>
<body>${bodyHtml}</body></html>`);

    printWindow.document.close();
    const cleanup = () => { try { printWindow.close(); } catch { /* noop */ } };
    printWindow.onafterprint = cleanup;
    printWindow.focus();
    setTimeout(() => {
      try { printWindow.print(); } finally { setTimeout(cleanup, 1000); }
    }, 50);
  };

  if (variant === 'icon') {
    return (
      <Button onClick={handlePrint} variant="outline" size="sm" className="gap-1.5">
        <Printer className="h-3.5 w-3.5" />
        In
      </Button>
    );
  }

  return (
    <Button onClick={handlePrint} variant="outline" size="sm" className="gap-2">
      <Printer className="h-4 w-4" />
      In phiếu chuyển hàng
    </Button>
  );
}
