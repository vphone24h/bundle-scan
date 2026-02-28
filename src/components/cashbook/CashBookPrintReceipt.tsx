import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { formatCurrency } from '@/lib/mockData';
import { toVietnamDate } from '@/lib/vietnamTime';
import type { CashBookEntry } from '@/hooks/useCashBook';

interface CashBookPrintReceiptProps {
  entry: CashBookEntry;
  paymentSourceLabel: string;
  storeName?: string;
  branchName?: string;
}

export function CashBookPrintReceipt({
  entry,
  paymentSourceLabel,
  storeName,
  branchName,
}: CashBookPrintReceiptProps) {

  const handlePrint = () => {
    const isIncome = entry.type === 'income';
    const typeLabel = isIncome ? 'PHIẾU THU' : 'PHIẾU CHI';
    const dateStr = format(toVietnamDate(entry.transaction_date), 'dd/MM/yyyy HH:mm', { locale: vi });
    const receiptCode = entry.id.slice(0, 8).toUpperCase();
    const amountColor = isIncome ? '#16a34a' : '#dc2626';
    const amountSign = isIncome ? '+' : '-';
    const width = '80mm';

    // Build rows
    const rows: string[] = [];
    rows.push(`<div class="row"><span class="label">Danh mục:</span><span class="value">${entry.category}</span></div>`);
    rows.push(`<div class="row"><span class="label">Nguồn tiền:</span><span class="value">${paymentSourceLabel}</span></div>`);
    rows.push(`<div class="row"><span class="label">Mô tả:</span><span class="value">${entry.description}</span></div>`);
    if (entry.created_by_name) {
      rows.push(`<div class="row"><span class="label">Người lập:</span><span class="value">${entry.created_by_name}</span></div>`);
    }
    if (entry.recipient_name) {
      rows.push(`<div class="row"><span class="label">Người nhận:</span><span class="value">${entry.recipient_name}</span></div>`);
      if (entry.recipient_phone) {
        rows.push(`<div class="row"><span class="label">SĐT:</span><span class="value">${entry.recipient_phone}</span></div>`);
      }
    }

    const noteHtml = entry.note
      ? `<div class="sep"></div><div class="note-label">Ghi chú:</div><div class="note-text">${entry.note}</div>`
      : '';

    const bodyHtml = `
      ${storeName ? `<div class="center bold" style="font-size:13px">${storeName}</div>` : ''}
      ${branchName ? `<div class="center" style="font-size:11px;color:#555">${branchName}</div>` : ''}
      <div class="sep"></div>
      <div class="center bold" style="font-size:16px">${typeLabel}</div>
      <div class="center" style="font-size:11px;color:#555">Mã: ${receiptCode}</div>
      <div class="center" style="font-size:11px;color:#555">${dateStr}</div>
      <div class="sep"></div>
      <div class="center bold" style="font-size:18px;color:${amountColor};margin:6px 0">${amountSign}${formatCurrency(Number(entry.amount))}</div>
      <div class="sep"></div>
      ${rows.join('')}
      ${noteHtml}
      <div class="sep"></div>
      <div class="sig-area">
        <div class="sig-box"><div class="sig-title">Người lập phiếu</div><div class="sig-line">(Ký, ghi rõ họ tên)</div></div>
        <div class="sig-box"><div class="sig-title">${isIncome ? 'Người nộp' : 'Người nhận'}</div><div class="sig-line">(Ký, ghi rõ họ tên)</div></div>
      </div>
      <div class="center" style="margin-top:10px;font-size:10px;color:#999">${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: vi })}</div>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${typeLabel} - ${receiptCode}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
@page{size:${width} auto;margin:0!important}
html,body{font-family:Arial,sans-serif;width:${width};margin:0!important;padding:3mm;font-size:12px;color:#000}
.center{text-align:center}
.bold{font-weight:bold}
.sep{border-top:1px dashed #333;margin:6px 0}
.row{display:flex;justify-content:space-between;padding:2px 0}
.row .label{color:#555;flex-shrink:0}
.row .value{text-align:right;font-weight:500;word-break:break-word;max-width:55%}
.note-label{font-weight:bold;font-size:11px;color:#555}
.note-text{font-size:11px;margin-top:2px}
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

  return (
    <Button onClick={handlePrint} variant="outline" size="sm" className="gap-2">
      <Printer className="h-4 w-4" />
      In phiếu
    </Button>
  );
}
