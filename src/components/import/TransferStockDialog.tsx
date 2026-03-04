import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowRight, Loader2, Package } from 'lucide-react';
import { useBranches, Branch } from '@/hooks/useBranches';
import { useCreateStockTransfer } from '@/hooks/useStockTransfers';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/mockData';
import type { Product } from '@/hooks/useProducts';

interface TransferStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedProducts: Product[];
  fromBranchId: string;
  fromBranchName: string;
  onSuccess: () => void;
}

export function TransferStockDialog({
  open,
  onOpenChange,
  selectedProducts,
  fromBranchId,
  fromBranchName,
  onSuccess,
}: TransferStockDialogProps) {
  const { data: branches } = useBranches();
  const { data: permissions } = usePermissions();
  const createTransfer = useCreateStockTransfer();
  const [toBranchId, setToBranchId] = useState('');
  const [note, setNote] = useState('');

  // Track transfer quantities for non-IMEI products
  const [transferQuantities, setTransferQuantities] = useState<Record<string, number>>({});

  const isSuperAdmin = permissions?.role === 'super_admin';

  // Initialize quantities when products change
  const getTransferQty = (product: Product) => {
    if (product.imei) return 1; // IMEI products always transfer 1
    return transferQuantities[product.id] ?? product.quantity;
  };

  const setTransferQty = (productId: string, qty: number) => {
    setTransferQuantities(prev => ({ ...prev, [productId]: qty }));
  };

  const availableBranches = useMemo(() => {
    return (branches || []).filter((b: Branch) => b.id !== fromBranchId);
  }, [branches, fromBranchId]);

  const toBranchName = useMemo(() => {
    return availableBranches.find((b: Branch) => b.id === toBranchId)?.name || '';
  }, [availableBranches, toBranchId]);

  const totalValue = useMemo(() => {
    return selectedProducts.reduce((sum, p) => {
      const qty = getTransferQty(p);
      return sum + Number(p.import_price) * qty;
    }, 0);
  }, [selectedProducts, transferQuantities]);

  // Validate quantities
  const hasInvalidQty = useMemo(() => {
    return selectedProducts.some(p => {
      if (p.imei) return false;
      const qty = getTransferQty(p);
      return qty < 1 || qty > p.quantity;
    });
  }, [selectedProducts, transferQuantities]);

  const handleTransfer = () => {
    if (!toBranchId) {
      toast({
        title: 'Chưa chọn chi nhánh',
        description: 'Vui lòng chọn chi nhánh đích để chuyển hàng',
        variant: 'destructive',
      });
      return;
    }

    if (hasInvalidQty) {
      toast({
        title: 'Số lượng không hợp lệ',
        description: 'Vui lòng kiểm tra lại số lượng chuyển',
        variant: 'destructive',
      });
      return;
    }

    // Build quantities map for non-IMEI products
    const quantitiesMap: Record<string, number> = {};
    selectedProducts.forEach(p => {
      if (!p.imei) {
        quantitiesMap[p.id] = getTransferQty(p);
      }
    });

    createTransfer.mutate(
      {
        productIds: selectedProducts.map((p) => p.id),
        fromBranchId,
        toBranchId,
        fromBranchName,
        toBranchName,
        note: note.trim() || undefined,
        isAutoApprove: isSuperAdmin,
        transferQuantities: quantitiesMap,
      },
      {
        onSuccess: (data) => {
          const msg = data.status === 'approved'
            ? `Đã chuyển ${data.count} sản phẩm từ "${fromBranchName}" sang "${toBranchName}"`
            : `Đã tạo phiếu chuyển ${data.count} sản phẩm. Chờ chi nhánh "${toBranchName}" duyệt.`;
          toast({ title: data.status === 'approved' ? 'Chuyển hàng thành công' : 'Tạo phiếu thành công', description: msg });
          setToBranchId('');
          setNote('');
          setTransferQuantities({});
          onOpenChange(false);
          onSuccess();
        },
        onError: (error: any) => {
          toast({ title: 'Lỗi chuyển hàng', description: error.message, variant: 'destructive' });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Chuyển hàng giữa chi nhánh
          </DialogTitle>
          <DialogDescription>
            {isSuperAdmin
              ? `Chuyển ${selectedProducts.length} sản phẩm (tự động duyệt)`
              : `Tạo phiếu chuyển ${selectedProducts.length} sản phẩm – cần chi nhánh nhận duyệt`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Transfer direction */}
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <div className="flex-1 text-center">
              <Label className="text-xs text-muted-foreground">Từ chi nhánh</Label>
              <p className="font-medium text-sm mt-1">{fromBranchName}</p>
            </div>
            <ArrowRight className="h-5 w-5 text-primary flex-shrink-0" />
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1 block">Đến chi nhánh</Label>
              <Select value={toBranchId} onValueChange={setToBranchId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Chọn chi nhánh..." />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {availableBranches.map((branch: Branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Note */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Ghi chú (không bắt buộc)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Lý do chuyển hàng..."
              rows={2}
            />
          </div>

          {/* Approval info */}
          {!isSuperAdmin && (
            <div className="p-2.5 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-xs text-yellow-800 dark:text-yellow-300">
              ⚠️ Phiếu chuyển hàng sẽ cần admin chi nhánh nhận duyệt trước khi sản phẩm được chuyển.
            </div>
          )}

          {/* Products summary */}
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">
              Sản phẩm chuyển ({selectedProducts.length})
            </Label>
            <div className="border rounded-lg divide-y max-h-[40vh] overflow-y-auto">
              {selectedProducts.map((product, idx) => {
                const isIMEI = !!product.imei;
                const transferQty = getTransferQty(product);
                const isPartial = !isIMEI && transferQty < product.quantity;

                return (
                  <div key={product.id} className="p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex-shrink-0">
                            {idx + 1}
                          </span>
                          <span className="font-medium text-sm truncate">{product.name}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 pl-7">
                          {isIMEI ? (
                            <span className="font-mono">IMEI: {product.imei}</span>
                          ) : (
                            <span>SKU: {product.sku} · Tồn kho: {product.quantity}</span>
                          )}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs flex-shrink-0">
                        {formatCurrency(Number(product.import_price) * transferQty)}
                      </Badge>
                    </div>

                    {/* Quantity input for non-IMEI products */}
                    {!isIMEI && (
                      <div className="flex items-center gap-2 pl-7">
                        <Label className="text-xs text-muted-foreground whitespace-nowrap">SL chuyển:</Label>
                        <Input
                          type="number"
                          min={1}
                          max={product.quantity}
                          value={transferQty}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setTransferQty(product.id, Math.min(Math.max(val, 0), product.quantity));
                          }}
                          className="h-7 w-20 text-xs text-center"
                        />
                        <span className="text-xs text-muted-foreground">/ {product.quantity}</span>
                        {isPartial && (
                          <Badge variant="secondary" className="text-[10px] h-5">
                            Chuyển 1 phần
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Total value */}
          <div className="flex justify-between items-center p-3 bg-primary/5 rounded-lg border border-primary/20">
            <span className="text-sm font-medium">Tổng giá trị</span>
            <span className="font-bold text-primary">{formatCurrency(totalValue)}</span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={!toBranchId || createTransfer.isPending || hasInvalidQty}
          >
            {createTransfer.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang xử lý...
              </>
            ) : (
              <>
                <ArrowRight className="mr-2 h-4 w-4" />
                {isSuperAdmin ? 'Xác nhận chuyển hàng' : 'Tạo phiếu chuyển hàng'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
