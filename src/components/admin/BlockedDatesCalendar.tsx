import { useState, useMemo } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useBlockedDates, useToggleBlockedDate, useClearBlockedDates } from '@/hooks/useBlockedDates';
import { Loader2, Trash2, CalendarDays } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface BlockedDatesCalendarProps {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  productId: string;
  productName: string;
}

export function BlockedDatesCalendar({ open, onClose, tenantId, productId, productName }: BlockedDatesCalendarProps) {
  const { data: blockedDates = [], isLoading } = useBlockedDates(productId);
  const toggleDate = useToggleBlockedDate();
  const clearAll = useClearBlockedDates();

  const blockedDateStrings = useMemo(
    () => new Set(blockedDates.map(d => d.blocked_date)),
    [blockedDates]
  );

  const blockedDayObjects = useMemo(
    () => blockedDates.map(d => new Date(d.blocked_date + 'T00:00:00')),
    [blockedDates]
  );

  const handleDayClick = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    toggleDate.mutate(
      { tenantId, productId, date: dateStr },
      {
        onSuccess: (result) => {
          toast({
            title: result.action === 'added' ? '🔒 Đã chặn ngày' : '🔓 Đã mở ngày',
            description: format(day, 'dd/MM/yyyy'),
          });
        },
        onError: () => toast({ title: 'Lỗi', description: 'Không thể cập nhật', variant: 'destructive' }),
      }
    );
  };

  const handleClearAll = () => {
    if (!confirm('Xóa tất cả ngày đã chặn?')) return;
    clearAll.mutate(
      { tenantId, productId },
      {
        onSuccess: () => toast({ title: '✅ Đã xóa tất cả ngày chặn' }),
        onError: () => toast({ title: 'Lỗi', variant: 'destructive' }),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-5 w-5" />
            Quản lý ngày chặn
          </DialogTitle>
          <DialogDescription className="text-sm">
            {productName} — Nhấn vào ngày để chặn/mở
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-block w-3 h-3 rounded bg-destructive" /> Ngày đã chặn ({blockedDates.length})
              <span className="inline-block w-3 h-3 rounded bg-primary ml-2" /> Hôm nay
            </div>

            <Calendar
              mode="multiple"
              selected={blockedDayObjects}
              onDayClick={handleDayClick}
              className="rounded-md border"
              modifiers={{ blocked: blockedDayObjects }}
              modifiersClassNames={{
                blocked: 'bg-destructive text-destructive-foreground hover:bg-destructive/80',
              }}
              locale={vi}
            />

            {blockedDates.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Ngày đã chặn:</span>
                  <Button variant="ghost" size="sm" className="text-destructive h-7 text-xs" onClick={handleClearAll} disabled={clearAll.isPending}>
                    <Trash2 className="h-3 w-3 mr-1" /> Xóa tất cả
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {blockedDates.map(d => (
                    <Badge
                      key={d.id}
                      variant="destructive"
                      className="cursor-pointer text-xs"
                      onClick={() => handleDayClick(new Date(d.blocked_date + 'T00:00:00'))}
                    >
                      {format(new Date(d.blocked_date + 'T00:00:00'), 'dd/MM')}
                      <span className="ml-1 opacity-70">×</span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
