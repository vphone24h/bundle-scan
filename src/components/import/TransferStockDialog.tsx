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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowRight, Loader2, Package } from 'lucide-react';
import { useBranches, Branch } from '@/hooks/useBranches';
import { useTransferStock } from '@/hooks/useTransferStock';
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
  const transferStock = useTransferStock();
  const [toBranchId, setToBranchId] = useState('');

  // Filter out the source branch
  const availableBranches = useMemo(() => {
    return (branches || []).filter((b: Branch) => b.id !== fromBranchId);
  }, [branches, fromBranchId]);

  const toBranchName = useMemo(() => {
    return availableBranches.find((b: Branch) => b.id === toBranchId)?.name || '';
  }, [availableBranches, toBranchId]);

  const totalValue = useMemo(() => {
    return selectedProducts.reduce((sum, p) => sum + Number(p.import_price) * p.quantity, 0);
  }, [selectedProducts]);

  const handleTransfer = () => {
    if (!toBranchId) {
      toast({
        title: 'Chưa chọn chi nhánh',
        description: 'Vui lòng chọn chi nhánh đích để chuyển hàng',
        variant: 'destructive',
      });
      return;
    }

    transferStock.mutate(
      {
        productIds: selectedProducts.map((p) => p.id),
        fromBranchId,
        toBranchId,
        fromBranchName,
        toBranchName,
      },
      {
        onSuccess: (data) => {
          toast({
            title: 'Chuyển hàng thành công',
            description: `Đã chuyển ${data.count} sản phẩm từ "${fromBranchName}" sang "${toBranchName}"`,
          });
          setToBranchId('');
          onOpenChange(false);
          onSuccess();
        },
        onError: (error: any) => {
          toast({
            title: 'Lỗi chuyển hàng',
            description: error.message,
            variant: 'destructive',
          });
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
            Chuyển {selectedProducts.length} sản phẩm đã chọn sang chi nhánh khác
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

          {/* Products summary */}
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">
              Sản phẩm chuyển ({selectedProducts.length})
            </Label>
            <div className="border rounded-lg divide-y max-h-[40vh] overflow-y-auto">
              {selectedProducts.map((product, idx) => (
                <div key={product.id} className="p-2.5 flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex-shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-medium text-sm truncate">{product.name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 pl-7">
                      {product.imei ? (
                        <span className="font-mono">IMEI: {product.imei}</span>
                      ) : (
                        <span>SKU: {product.sku} · SL: {product.quantity}</span>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs flex-shrink-0">
                    {formatCurrency(Number(product.import_price) * product.quantity)}
                  </Badge>
                </div>
              ))}
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
            disabled={!toBranchId || transferStock.isPending}
          >
            {transferStock.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang chuyển...
              </>
            ) : (
              <>
                <ArrowRight className="mr-2 h-4 w-4" />
                Xác nhận chuyển hàng
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
