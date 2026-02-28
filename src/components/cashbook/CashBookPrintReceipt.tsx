import { useRef } from 'react';
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
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank', 'width=350,height=600');
    if (!printWindow) return;

    const contentHeightPx = printContent.scrollHeight + 40;
    const width = '72mm';
    const isIncome = entry.type === 'income';
    const typeLabel = isIncome ? 'PHIẾU THU' : 'PHIẾU CHI';
    const dateStr = format(toVietnamDate(entry.transaction_date), 'dd/MM/yyyy HH:mm', { locale: vi });
    const receiptCode = entry.id.slice(0, 8).toUpperCase();

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${typeLabel} - ${receiptCode}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: 'Arial', sans-serif;
              width: ${width};
              padding: 4mm 3mm;
              font-size: 12px;
              color: #000;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .title { font-size: 16px; font-weight: bold; margin: 6px 0; }
            .store-name { font-size: 13px; font-weight: bold; }
            .separator { border-top: 1px dashed #333; margin: 6px 0; }
            .row { display: flex; justify-content: space-between; padding: 2px 0; }
            .row .label { color: #555; flex-shrink: 0; }
            .row .value { text-align: right; font-weight: 500; word-break: break-word; max-width: 55%; }
            .amount { font-size: 18px; font-weight: bold; text-align: center; margin: 8px 0; }
            .amount.income { color: #16a34a; }
            .amount.expense { color: #dc2626; }
            .note-section { margin-top: 4px; }
            .note-label { font-weight: bold; font-size: 11px; color: #555; }
            .note-text { font-size: 11px; margin-top: 2px; }
            .signature-area { margin-top: 16px; display: flex; justify-content: space-between; }
            .signature-box { text-align: center; width: 45%; }
            .signature-title { font-size: 11px; font-weight: bold; }
            .signature-line { margin-top: 40px; font-size: 10px; color: #999; }
            .footer { text-align: center; margin-top: 12px; font-size: 10px; color: #999; }
            @page { size: ${width} ${contentHeightPx}px; margin: 0; }
            @media print {
              body { width: ${width}; }
              html, body { height: ${contentHeightPx}px !important; }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();

    const cleanup = () => {
      try { printWindow.close(); } catch { /* noop */ }
    };
    printWindow.onafterprint = cleanup;
    printWindow.focus();
    setTimeout(() => {
      try { printWindow.print(); } finally {
        setTimeout(cleanup, 1000);
      }
    }, 50);
  };

  const isIncome = entry.type === 'income';
  const typeLabel = isIncome ? 'PHIẾU THU' : 'PHIẾU CHI';
  const dateStr = format(toVietnamDate(entry.transaction_date), 'dd/MM/yyyy HH:mm', { locale: vi });
  const receiptCode = entry.id.slice(0, 8).toUpperCase();

  return (
    <>
      <Button onClick={handlePrint} variant="outline" size="sm" className="gap-2">
        <Printer className="h-4 w-4" />
        In phiếu
      </Button>

      {/* Hidden print content */}
      <div ref={printRef} className="hidden">
        {/* Store name */}
        {storeName && (
          <div className="center store-name">{storeName}</div>
        )}
        {branchName && (
          <div className="center" style={{ fontSize: '11px', color: '#555' }}>{branchName}</div>
        )}

        <div className="separator" />

        {/* Title */}
        <div className="center title">{typeLabel}</div>
        <div className="center" style={{ fontSize: '11px', color: '#555' }}>
          Mã: {receiptCode}
        </div>
        <div className="center" style={{ fontSize: '11px', color: '#555' }}>
          {dateStr}
        </div>

        <div className="separator" />

        {/* Amount */}
        <div className={`amount ${isIncome ? 'income' : 'expense'}`}>
          {isIncome ? '+' : '-'}{formatCurrency(Number(entry.amount))}
        </div>

        <div className="separator" />

        {/* Details */}
        <div className="row">
          <span className="label">Danh mục:</span>
          <span className="value">{entry.category}</span>
        </div>
        <div className="row">
          <span className="label">Nguồn tiền:</span>
          <span className="value">{paymentSourceLabel}</span>
        </div>
        <div className="row">
          <span className="label">Mô tả:</span>
          <span className="value">{entry.description}</span>
        </div>

        {entry.created_by_name && (
          <div className="row">
            <span className="label">Người lập:</span>
            <span className="value">{entry.created_by_name}</span>
          </div>
        )}

        {entry.recipient_name && (
          <>
            <div className="row">
              <span className="label">Người nhận:</span>
              <span className="value">{entry.recipient_name}</span>
            </div>
            {entry.recipient_phone && (
              <div className="row">
                <span className="label">SĐT:</span>
                <span className="value">{entry.recipient_phone}</span>
              </div>
            )}
          </>
        )}

        {entry.note && (
          <div className="note-section">
            <div className="separator" />
            <div className="note-label">Ghi chú:</div>
            <div className="note-text">{entry.note}</div>
          </div>
        )}

        {/* Signature area */}
        <div className="separator" />
        <div className="signature-area">
          <div className="signature-box">
            <div className="signature-title">Người lập phiếu</div>
            <div className="signature-line">(Ký, ghi rõ họ tên)</div>
          </div>
          <div className="signature-box">
            <div className="signature-title">{isIncome ? 'Người nộp' : 'Người nhận'}</div>
            <div className="signature-line">(Ký, ghi rõ họ tên)</div>
          </div>
        </div>

        <div className="footer">
          {format(new Date(), 'dd/MM/yyyy HH:mm', { locale: vi })}
        </div>
      </div>
    </>
  );
}
