import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSubscriptionHistory } from '@/hooks/useTenant';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { formatNumber } from '@/lib/formatNumber';

const actionLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  payment_approved: { label: 'Thanh toán', variant: 'default' },
  manual_extend: { label: 'Gia hạn thủ công', variant: 'secondary' },
  trial_started: { label: 'Dùng thử', variant: 'outline' },
  expired: { label: 'Hết hạn', variant: 'destructive' },
  locked: { label: 'Khóa', variant: 'destructive' },
  unlocked: { label: 'Mở khóa', variant: 'default' },
};

export function PaymentHistoryTable() {
  const { data: history, isLoading } = useSubscriptionHistory();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Thời gian</TableHead>
            <TableHead>Hành động</TableHead>
            <TableHead>Thay đổi</TableHead>
            <TableHead>Ghi chú</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {history?.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                Chưa có lịch sử
              </TableCell>
            </TableRow>
          )}
          {history?.map((record) => {
            const actionConfig = actionLabels[record.action] || { label: record.action, variant: 'outline' as const };
            
            return (
              <TableRow key={record.id}>
                <TableCell>
                  {format(new Date(record.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
                </TableCell>
                <TableCell>
                  <Badge variant={actionConfig.variant}>{actionConfig.label}</Badge>
                </TableCell>
                <TableCell>
                  <div className="text-sm space-y-1">
                    {record.days_added && (
                      <p>+{record.days_added} ngày</p>
                    )}
                    {record.old_status && record.new_status && (
                      <p>
                        <span className="text-muted-foreground">{record.old_status}</span>
                        {' → '}
                        <span className="font-medium">{record.new_status}</span>
                      </p>
                    )}
                    {record.old_end_date && record.new_end_date && (
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(record.old_end_date), 'dd/MM/yyyy')}
                        {' → '}
                        {format(new Date(record.new_end_date), 'dd/MM/yyyy')}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {record.note}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
