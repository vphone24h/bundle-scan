import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/formatNumber';
import { Phone, MessageSquare } from 'lucide-react';
import type { DebtSummary } from '@/hooks/useDebt';

interface DebtDueListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  debts: DebtSummary[];
  overdueDays: number;
}

function getDebtStatus(daysOverdue: number, overdueDays: number) {
  if (daysOverdue >= overdueDays) return { label: 'Quá hạn', color: 'bg-red-100 text-red-700 border-red-200' };
  if (daysOverdue >= overdueDays - 1) return { label: 'Đến hạn hôm nay', color: 'bg-orange-100 text-orange-700 border-orange-200' };
  if (daysOverdue >= overdueDays - 3) return { label: 'Sắp đến hạn', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
  return { label: 'Nợ mới', color: 'bg-green-100 text-green-700 border-green-200' };
}

export function DebtDueListDialog({ open, onOpenChange, title, debts, overdueDays }: DebtDueListDialogProps) {
  const totalAmount = debts.reduce((sum, d) => sum + d.remaining_amount, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {debts.length} khách · Tổng: <span className="font-semibold text-destructive">{formatNumber(totalAmount)}đ</span>
          </p>
        </DialogHeader>
        <div className="space-y-2">
          {debts.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Không có công nợ nào</p>
          ) : (
            debts.map((debt) => {
              const status = getDebtStatus(debt.days_overdue, overdueDays);
              return (
                <div key={debt.entity_id} className="rounded-lg border p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">{debt.entity_name}</p>
                      {debt.entity_phone && (
                        <p className="text-xs text-muted-foreground">{debt.entity_phone}</p>
                      )}
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${status.color}`}>
                      {status.label}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Còn nợ:</span>
                    <span className="font-bold text-destructive">{formatNumber(debt.remaining_amount)}đ</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{debt.days_overdue} ngày</span>
                    {debt.entity_phone && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => window.open(`tel:${debt.entity_phone}`, '_self')}
                        >
                          <Phone className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => window.open(`sms:${debt.entity_phone}?body=Xin chào ${debt.entity_name}, nhắc nhở thanh toán công nợ ${formatNumber(debt.remaining_amount)}đ. Cảm ơn!`, '_self')}
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => window.open(`https://zalo.me/${debt.entity_phone?.replace(/^0/, '84')}`, '_blank')}
                        >
                          <span className="text-[10px] font-bold">Z</span>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
