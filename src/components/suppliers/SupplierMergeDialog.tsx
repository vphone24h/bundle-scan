import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/mockData';
import { Loader2, Merge, AlertTriangle, CheckCircle2, Phone, Building2 } from 'lucide-react';
import type { DuplicateGroup } from '@/hooks/useSupplierMerge';
import { useMergeSuppliers } from '@/hooks/useSupplierMerge';

interface SupplierMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicateGroups: DuplicateGroup[];
  branchNameMap: Map<string, string>;
}

export function SupplierMergeDialog({
  open,
  onOpenChange,
  duplicateGroups,
  branchNameMap,
}: SupplierMergeDialogProps) {
  // Track which supplier is selected as primary for each group
  const [selectedPrimary, setSelectedPrimary] = useState<Record<string, string>>({});
  // Track which groups are selected for merge
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const mergeSuppliers = useMergeSuppliers();

  // Initialize primaries (oldest supplier = default primary)
  const effectivePrimary = useMemo(() => {
    const map: Record<string, string> = {};
    for (const group of duplicateGroups) {
      map[group.key] = selectedPrimary[group.key] || group.suppliers[0].id;
    }
    return map;
  }, [duplicateGroups, selectedPrimary]);

  const toggleGroup = (key: string) => {
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedGroups.size === duplicateGroups.length) {
      setSelectedGroups(new Set());
    } else {
      setSelectedGroups(new Set(duplicateGroups.map((g) => g.key)));
    }
  };

  const handleMerge = async () => {
    const groupsToMerge = duplicateGroups.filter((g) => selectedGroups.has(g.key));
    if (groupsToMerge.length === 0) {
      toast({ title: 'Chưa chọn nhóm nào để gộp', variant: 'destructive' });
      return;
    }

    const confirmMsg = `Bạn có chắc muốn gộp ${groupsToMerge.length} nhóm NCC trùng?\nThao tác này không thể hoàn tác.`;
    if (!confirm(confirmMsg)) return;

    let successCount = 0;
    let errorCount = 0;

    for (const group of groupsToMerge) {
      const primaryId = effectivePrimary[group.key];
      const duplicateIds = group.suppliers.filter((s) => s.id !== primaryId).map((s) => s.id);

      try {
        await mergeSuppliers.mutateAsync({ primaryId, duplicateIds });
        successCount++;
      } catch (err: any) {
        errorCount++;
        console.error('Merge error for group:', group.key, err);
      }
    }

    if (successCount > 0) {
      toast({ title: `Đã gộp thành công ${successCount} nhóm NCC trùng` });
    }
    if (errorCount > 0) {
      toast({
        title: `${errorCount} nhóm gặp lỗi khi gộp`,
        variant: 'destructive',
      });
    }

    setSelectedGroups(new Set());
    if (errorCount === 0) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Merge className="h-5 w-5 text-primary" />
            Gộp nhà cung cấp trùng
          </DialogTitle>
        </DialogHeader>

        {duplicateGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-3" />
            <p className="font-medium text-lg">Không có NCC trùng lặp</p>
            <p className="text-sm text-muted-foreground mt-1">
              Tất cả NCC đều có thông tin duy nhất (tên + SĐT + chi nhánh)
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-1">
              <p className="text-sm text-muted-foreground">
                Tìm thấy <span className="font-semibold text-foreground">{duplicateGroups.length}</span> nhóm NCC trùng
              </p>
              <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs">
                {selectedGroups.size === duplicateGroups.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
              </Button>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Khi gộp, toàn bộ sản phẩm, phiếu nhập và công nợ của các NCC trùng sẽ được chuyển sang NCC chính (được chọn). Các NCC trùng sẽ bị xoá. Thao tác <strong>không thể hoàn tác</strong>.
              </p>
            </div>

            <ScrollArea className="flex-1 min-h-0 -mx-6 px-6">
              <div className="space-y-3 py-1">
                {duplicateGroups.map((group) => {
                  const isSelected = selectedGroups.has(group.key);
                  const primaryId = effectivePrimary[group.key];
                  const branchName = group.branchId ? branchNameMap.get(group.branchId) : null;

                  return (
                    <div
                      key={group.key}
                      className={`border rounded-lg p-3 transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-muted-foreground/30'
                      }`}
                      onClick={() => toggleGroup(group.key)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleGroup(group.key)}
                            className="rounded border-input"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div>
                            <p className="font-semibold text-sm">{group.name}</p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              {group.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {group.phone}
                                </span>
                              )}
                              {branchName && (
                                <span className="flex items-center gap-1">
                                  <Building2 className="h-3 w-3" />
                                  {branchName}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-[10px]">
                          {group.suppliers.length} bản ghi
                        </Badge>
                      </div>

                      {isSelected && (
                        <div className="mt-2 pt-2 border-t" onClick={(e) => e.stopPropagation()}>
                          <p className="text-xs text-muted-foreground mb-2">
                            Chọn NCC chính (giữ lại):
                          </p>
                          <RadioGroup
                            value={primaryId}
                            onValueChange={(val) =>
                              setSelectedPrimary((prev) => ({ ...prev, [group.key]: val }))
                            }
                          >
                            {group.suppliers.map((s, idx) => (
                              <div
                                key={s.id}
                                className={`flex items-center gap-2 p-2 rounded-md text-sm ${
                                  primaryId === s.id ? 'bg-primary/10' : 'bg-muted/30'
                                }`}
                              >
                                <RadioGroupItem value={s.id} id={`s-${s.id}`} />
                                <Label htmlFor={`s-${s.id}`} className="flex-1 cursor-pointer">
                                  <span className="font-medium">{s.name}</span>
                                  {idx === 0 && (
                                    <Badge variant="outline" className="ml-2 text-[9px]">
                                      cũ nhất
                                    </Badge>
                                  )}
                                  <span className="text-xs text-muted-foreground ml-2">
                                    Tạo: {formatDate(new Date(s.created_at))}
                                  </span>
                                  {s.note && (
                                    <span className="text-xs text-muted-foreground ml-2">
                                      - {s.note}
                                    </span>
                                  )}
                                </Label>
                              </div>
                            ))}
                          </RadioGroup>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
          {duplicateGroups.length > 0 && (
            <Button
              onClick={handleMerge}
              disabled={selectedGroups.size === 0 || mergeSuppliers.isPending}
              variant="destructive"
            >
              {mergeSuppliers.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Merge className="mr-2 h-4 w-4" />
              Gộp {selectedGroups.size > 0 ? `${selectedGroups.size} nhóm` : ''}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
