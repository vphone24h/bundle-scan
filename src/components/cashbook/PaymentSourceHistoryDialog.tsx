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
                  className="p-2.5 rounded-lg border bg-card hover:bg-accent/30 transition-colors space-y-1"
                >
                  {/* Row 1: description */}
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${
                        entry.type === 'income'
                          ? 'bg-green-100 dark:bg-green-900/30'
                          : 'bg-red-100 dark:bg-red-900/30'
                      }`}
                    >
                      {entry.type === 'income' ? (
                        <TrendingUp className="h-3 w-3 text-green-600" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-destructive" />
                      )}
                    </div>
                    <p className="flex-1 min-w-0 text-xs font-medium leading-tight line-clamp-2">{entry.description}</p>
                  </div>

                  {/* Row 2: meta info */}
                  <div className="flex flex-wrap items-center gap-1 pl-8 text-[11px] text-muted-foreground">
                    <span>{format(toVietnamDate(entry.transaction_date), 'dd/MM HH:mm', { locale: vi })}</span>
                    <span>•</span>
                    <span>{getBranchName(entry.branch_id)}</span>
                    {entry.created_by_name && (
                      <>
                        <span>•</span>
                        <span className="truncate max-w-[60px]">{entry.created_by_name}</span>
                      </>
                    )}
                    {entry.category && (
                      <Badge variant="outline" className="text-[9px] h-3.5 px-1">
                        {entry.category}
                      </Badge>
                    )}
                  </div>

                  {/* Row 3: amount + balance */}
                  <div className="flex items-center justify-between pl-8">
                    <p
                      className={`text-xs font-bold ${
                        entry.type === 'income' ? 'text-green-600' : 'text-destructive'
                      }`}
                    >
                      {entry.type === 'income' ? '+' : '-'}
                      {formatCurrency(Number(entry.amount))}
                    </p>
                    <div className="flex items-center gap-1 text-[11px]">
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
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
