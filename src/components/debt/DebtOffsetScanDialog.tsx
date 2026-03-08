import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatNumber } from '@/lib/formatNumber';
import { useDebtOffsetMatches, useExecuteDebtOffset, DebtOffsetMatch } from '@/hooks/useDebtOffset';
import { toast } from 'sonner';
import { ArrowLeftRight, CheckCircle, Loader2, ScanSearch } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

interface DebtOffsetScanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DebtOffsetScanDialog({ open, onOpenChange }: DebtOffsetScanDialogProps) {
  const matches = useDebtOffsetMatches();
  const executeOffset = useExecuteDebtOffset();
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);

  // Reset on open
  const handleOpenChange = (v: boolean) => {
    if (v) {
      setSelectedIndexes(new Set(matches.map((_, i) => i)));
      setProcessedCount(0);
    }
    onOpenChange(v);
  };

  const toggleIndex = (i: number) => {
    setSelectedIndexes(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIndexes.size === matches.length) {
      setSelectedIndexes(new Set());
    } else {
      setSelectedIndexes(new Set(matches.map((_, i) => i)));
    }
  };

  const totalOffset = useMemo(() => {
    return matches.reduce((sum, m, i) => {
      if (!selectedIndexes.has(i)) return sum;
      return sum + Math.min(m.customerDebt.remaining_amount, m.supplierDebt.remaining_amount);
    }, 0);
  }, [matches, selectedIndexes]);

  const handleExecuteAll = async () => {
    const selected = matches.filter((_, i) => selectedIndexes.has(i));
    if (selected.length === 0) return;

    setProcessing(true);
    setProcessedCount(0);
    let success = 0;
    let failed = 0;

    for (const match of selected) {
      const offsetAmount = Math.min(match.customerDebt.remaining_amount, match.supplierDebt.remaining_amount);
      if (offsetAmount <= 0) continue;

      try {
        await executeOffset.mutateAsync({
          customerEntityId: match.customerDebt.entity_id,
          supplierEntityId: match.supplierDebt.entity_id,
          customerName: match.customerDebt.entity_name,
          supplierName: match.supplierDebt.entity_name,
          customerDebtBefore: match.customerDebt.remaining_amount,
          supplierDebtBefore: match.supplierDebt.remaining_amount,
          offsetAmount,
          customerBranchId: match.customerDebt.branch_id,
          supplierBranchId: match.supplierDebt.branch_id,
          supplierMergedEntityIds: match.supplierDebt.merged_entity_ids,
        });
        success++;
      } catch {
        failed++;
      }
      setProcessedCount(prev => prev + 1);
    }

    setProcessing(false);
    if (failed === 0) {
      toast.success(`Bù trừ thành công ${success} cặp công nợ`);
      onOpenChange(false);
    } else {
      toast.error(`Thành công ${success}, thất bại ${failed}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanSearch className="h-5 w-5 text-primary" />
            Bù trừ công nợ 2 chiều
          </DialogTitle>
          <DialogDescription>
            Hệ thống tự động quét các đối tượng vừa là khách hàng vừa là NCC (cùng SĐT) để bù trừ công nợ.
          </DialogDescription>
        </DialogHeader>

        {matches.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ScanSearch className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>Không tìm thấy cặp công nợ 2 chiều nào.</p>
            <p className="text-xs mt-1">Chỉ phát hiện khi cùng SĐT và cả 2 bên đều còn nợ.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Select all */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedIndexes.size === matches.length}
                  onCheckedChange={toggleAll}
                />
                <span className="text-sm font-medium">Chọn tất cả ({matches.length} cặp)</span>
              </div>
              <Badge variant="outline" className="text-xs">
                Tổng bù trừ: {formatNumber(totalOffset)}đ
              </Badge>
            </div>

            {/* Match list */}
            <div className="space-y-2">
              {matches.map((match, i) => {
                const offsetAmount = Math.min(match.customerDebt.remaining_amount, match.supplierDebt.remaining_amount);
                const isSelected = selectedIndexes.has(i);
                return (
                  <div
                    key={match.matchedPhone}
                    className={`rounded-lg border p-3 space-y-2 cursor-pointer transition-colors ${isSelected ? 'border-primary/50 bg-primary/5' : 'opacity-60'}`}
                    onClick={() => toggleIndex(i)}
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox checked={isSelected} onCheckedChange={() => toggleIndex(i)} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{match.customerDebt.entity_name}</p>
                        <p className="text-xs text-muted-foreground">{match.matchedPhone}</p>
                      </div>
                      <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-200 text-[10px] shrink-0">
                        2 chiều
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">KH nợ bạn</span>
                        <p className="font-medium text-green-600">{formatNumber(match.customerDebt.remaining_amount)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Bạn nợ NCC</span>
                        <p className="font-medium text-destructive">{formatNumber(match.supplierDebt.remaining_amount)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Bù trừ</span>
                        <p className="font-bold text-primary">{formatNumber(offsetAmount)}</p>
                      </div>
                    </div>
                    <div className="text-[11px] text-muted-foreground border-t pt-1.5">
                      Sau: KH còn nợ {formatNumber(match.customerDebt.remaining_amount - offsetAmount)}đ · Bạn còn nợ NCC {formatNumber(match.supplierDebt.remaining_amount - offsetAmount)}đ
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>Đóng</Button>
          {matches.length > 0 && (
            <Button onClick={handleExecuteAll} disabled={processing || selectedIndexes.size === 0}>
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang xử lý {processedCount}/{selectedIndexes.size}...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Bù trừ {selectedIndexes.size} cặp
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
