import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, AlertTriangle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface AdjustQuantityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  sku: string;
  currentQuantity: number;
}

export function AdjustQuantityDialog({
  open,
  onOpenChange,
  productId,
  productName,
  sku,
  currentQuantity,
}: AdjustQuantityDialogProps) {
  const queryClient = useQueryClient();
  const [newQuantity, setNewQuantity] = useState<number>(currentQuantity);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) {
      setNewQuantity(currentQuantity);
      setReason('');
    }
  }, [open, currentQuantity]);

  const adjustMutation = useMutation({
    mutationFn: async () => {
      if (newQuantity < 0) {
        throw new Error('Số lượng không được âm');
      }
      if (!reason.trim()) {
        throw new Error('Vui lòng nhập lý do điều chỉnh');
      }

      // Lấy thông tin tenant và user
      const [tenantResult, userResult] = await Promise.all([
        supabase.rpc('get_user_tenant_id_secure'),
        supabase.auth.getUser(),
      ]);

      const tenantId = tenantResult.data;
      const user = userResult.data.user;

      if (!tenantId) throw new Error('Không tìm thấy tenant');

      // Lấy thông tin sản phẩm hiện tại
      const { data: product, error: fetchError } = await supabase
        .from('products')
        .select('quantity, total_import_cost, import_price')
        .eq('id', productId)
        .single();

      if (fetchError) throw fetchError;

      const oldQuantity = product.quantity;
      const quantityDiff = newQuantity - oldQuantity;

      // Tính toán lại total_import_cost
      // Nếu tăng số lượng: thêm với giá nhập hiện tại
      // Nếu giảm số lượng: giảm theo tỷ lệ
      let newTotalCost = product.total_import_cost;
      if (quantityDiff > 0) {
        newTotalCost = product.total_import_cost + (quantityDiff * product.import_price);
      } else if (quantityDiff < 0 && oldQuantity > 0) {
        const costPerUnit = product.total_import_cost / oldQuantity;
        newTotalCost = Math.max(0, newQuantity * costPerUnit);
      }

      // Cập nhật số lượng sản phẩm
      const { error: updateError } = await supabase
        .from('products')
        .update({
          quantity: newQuantity,
          total_import_cost: newTotalCost,
        })
        .eq('id', productId);

      if (updateError) throw updateError;

      // Ghi log thao tác với format rõ ràng
      await supabase.from('audit_logs').insert({
        tenant_id: tenantId,
        user_id: user?.id,
        action_type: 'ADJUST_QUANTITY',
        table_name: 'products',
        record_id: productId,
        description: `Điều chỉnh số lượng: ${productName} (${sku}) | ${oldQuantity} → ${newQuantity} (${quantityDiff > 0 ? '+' : ''}${quantityDiff}) | Lý do: ${reason.trim()}`,
        old_data: {
          name: productName,
          sku: sku,
          quantity: oldQuantity,
          total_import_cost: product.total_import_cost,
        },
        new_data: {
          name: productName,
          sku: sku,
          quantity: newQuantity,
          total_import_cost: newTotalCost,
          reason: reason.trim(),
          quantity_change: `${oldQuantity} → ${newQuantity}`,
          quantity_diff: quantityDiff,
        },
      });

      return { oldQuantity, newQuantity, quantityDiff };
    },
    onSuccess: (data) => {
      // Invalidate all related queries to refresh data immediately
      queryClient.invalidateQueries({ queryKey: ['products'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['all-products'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['inventory'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'], refetchType: 'all' });

      toast({
        title: 'Điều chỉnh thành công',
        description: `Số lượng đã thay đổi từ ${data.oldQuantity} → ${data.newQuantity} (${data.quantityDiff > 0 ? '+' : ''}${data.quantityDiff})`,
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể điều chỉnh số lượng',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = () => {
    adjustMutation.mutate();
  };

  const diff = newQuantity - currentQuantity;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Điều chỉnh số lượng tồn kho
          </DialogTitle>
          <DialogDescription>
            Thao tác này sẽ ảnh hưởng đến tồn kho và được ghi lại trong lịch sử.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Product info */}
          <div className="rounded-lg bg-muted/50 p-3 space-y-1">
            <p className="font-medium text-sm">{productName}</p>
            <p className="text-xs text-muted-foreground">SKU: {sku}</p>
          </div>

          {/* Current quantity */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Số lượng hiện tại:</span>
            <span className="font-medium">{currentQuantity}</span>
          </div>

          {/* New quantity input */}
          <div className="space-y-2">
            <Label htmlFor="newQuantity">Số lượng mới <span className="text-destructive">*</span></Label>
            <Input
              id="newQuantity"
              type="number"
              min={0}
              value={newQuantity}
              onChange={(e) => setNewQuantity(parseInt(e.target.value) || 0)}
              className="text-lg font-medium"
            />
            {diff !== 0 && (
              <p className={`text-sm font-medium ${diff > 0 ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                {diff > 0 ? `+${diff}` : diff} sản phẩm
              </p>
            )}
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Lý do điều chỉnh <span className="text-destructive">*</span></Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="VD: Cân bằng kho theo kiểm kê thực tế, hàng bị hỏng, thất lạc..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={adjustMutation.isPending || diff === 0 || !reason.trim()}
          >
            {adjustMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Xác nhận điều chỉnh
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
