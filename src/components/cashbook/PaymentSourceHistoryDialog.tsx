import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { formatCurrency } from '@/lib/mockData';
import { toVietnamDate } from '@/lib/vietnamTime';
import type { CashBookEntry } from '@/hooks/useCashBook';
import { normalizePaymentSource } from '@/pages/CashBookPage';

interface PaymentSourceHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceName: string;
  sourceId: string;
  allEntries: CashBookEntry[];
  branches: { id: string; name: string }[];
  openingBalance?: number;
}

export function PaymentSourceHistoryDialog({
  open,
  onOpenChange,
  sourceName,
  sourceId,
  allEntries,
  branches,
  openingBalance = 0,
}: PaymentSourceHistoryDialogProps) {
  // Filter entries for this payment source, sorted by date ascending for running balance
  const filtered = (allEntries || [])
    .filter((e) => normalizePaymentSource(e.payment_source) === sourceId)
    .sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime());

  // Calculate running balance
  let runningBalance = openingBalance;
  const entriesWithBalance = filtered.map((entry) => {
    const delta = entry.type === 'income' ? Number(entry.amount) : -Number(entry.amount);
    runningBalance += delta;
    return { ...entry, runningBalance };
  });

  // Show newest first
  const displayEntries = [...entriesWithBalance].reverse();

  const getBranchName = (branchId: string | null) => {
    if (!branchId) return '—';
    return branches.find((b) => b.id === branchId)?.name || '—';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg sm:max-w-2xl max-h-[85vh] p-0">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="text-base">
            Lịch sử giao dịch — {sourceName}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {filtered.length} giao dịch • Đầu kỳ: {formatCurrency(openingBalance)}
          </p>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh] px-4 pb-4">
          {displayEntries.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">
              Chưa có giao dịch nào
            </p>
          ) : (
            <div className="space-y-2">
              {displayEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors space-y-1.5"
                >
                  {/* Top row: icon + description + amount */}
                  <div className="flex items-start gap-2">
                    <div
                      className={`mt-0.5 h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${
                        entry.type === 'income'
                          ? 'bg-green-100 dark:bg-green-900/30'
                          : 'bg-red-100 dark:bg-red-900/30'
                      }`}
                    >
                      {entry.type === 'income' ? (
                        <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                      )}
                    </div>
                    <p className="flex-1 min-w-0 text-sm font-medium truncate">{entry.description}</p>
                    <p
                      className={`shrink-0 text-sm font-bold ${
                        entry.type === 'income' ? 'text-green-600' : 'text-destructive'
                      }`}
                    >
                      {entry.type === 'income' ? '+' : '-'}
                      {formatCurrency(Number(entry.amount))}
                    </p>
                  </div>

                  {/* Bottom row: meta + running balance */}
                  <div className="flex items-center justify-between pl-9">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                      <span>
                        {format(toVietnamDate(entry.transaction_date), 'dd/MM/yyyy HH:mm', { locale: vi })}
                      </span>
                      <span>•</span>
                      <span>{getBranchName(entry.branch_id)}</span>
                      {entry.created_by_name && (
                        <>
                          <span>•</span>
                          <span className="truncate max-w-[80px]">{entry.created_by_name}</span>
                        </>
                      )}
                      {entry.category && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                          {entry.category}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 text-[11px] text-muted-foreground">
                      <span>SD:</span>
                      <span className={`font-semibold ${entry.runningBalance >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                        {formatCurrency(entry.runningBalance)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
