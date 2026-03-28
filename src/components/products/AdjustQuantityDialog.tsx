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
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';

interface AdjustQuantityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  sku: string;
  currentQuantity: number;
  unit?: string;
}

export function AdjustQuantityDialog({
  open,
  onOpenChange,
  productId,
  productName,
  sku,
  currentQuantity,
  unit = 'cái',
}: AdjustQuantityDialogProps) {
  const isDecimalUnit = ['kg', 'lít', 'mét'].includes(unit);
  const queryClient = useQueryClient();
  const [newTotalImported, setNewTotalImported] = useState<string>('');
  const [newStock, setNewStock] = useState<string>('');
  const [reason, setReason] = useState('');

  // Fetch product_imports total for this product
  const { data: importData } = useQuery({
    queryKey: ['product-import-total', productId],
    queryFn: async () => {
      // Get product info
      const { data: product } = await supabase
        .from('products')
        .select('name, sku, branch_id, quantity, import_price, total_import_cost')
        .eq('id', productId)
        .single();

      if (!product) return null;

      // Get product_imports records for this product
      const { data: piRecords } = await supabase
        .from('product_imports')
        .select('id, quantity, import_price')
        .eq('product_id', productId);

      // Also get total from products table entries with same name/sku
      const totalImportedFromPI = piRecords?.reduce((sum, r) => sum + Number(r.quantity), 0) || 0;

      return {
        product,
        totalImported: totalImportedFromPI > 0 ? totalImportedFromPI : Number(product.quantity),
        currentStock: Number(product.quantity),
        hasProductImports: (piRecords?.length || 0) > 0,
        piRecords: piRecords || [],
      };
    },
    enabled: open && !!productId,
  });

  useEffect(() => {
    if (open && importData) {
      setNewTotalImported(String(importData.totalImported));
      setNewStock(String(importData.currentStock));
      setReason('');
    }
  }, [open, importData]);

  const parsedTotalImported = Math.round((parseFloat(newTotalImported) || 0) * 1000) / 1000;
  const parsedStock = Math.round((parseFloat(newStock) || 0) * 1000) / 1000;
  const originalTotalImported = importData?.totalImported || 0;
  const originalStock = importData?.currentStock || currentQuantity;

  const totalImportedDiff = Math.round((parsedTotalImported - originalTotalImported) * 1000) / 1000;
  const stockDiff = Math.round((parsedStock - originalStock) * 1000) / 1000;
  const hasChanges = totalImportedDiff !== 0 || stockDiff !== 0;

  const adjustMutation = useMutation({
    mutationFn: async () => {
      if (parsedStock < 0 || parsedTotalImported < 0) {
        throw new Error('Số lượng không được âm');
      }
      if (parsedStock > parsedTotalImported) {
        throw new Error('Tồn kho không được lớn hơn tổng nhập');
      }
      if (!reason.trim()) {
        throw new Error('Vui lòng nhập lý do điều chỉnh');
      }

      const [tenantResult, userResult] = await Promise.all([
        supabase.rpc('get_user_tenant_id_secure'),
        supabase.auth.getUser(),
      ]);

      const tenantId = tenantResult.data;
      const user = userResult.data.user;
      if (!tenantId) throw new Error('Không tìm thấy tenant');

      // Get current product data
      const { data: product, error: fetchError } = await supabase
        .from('products')
        .select('quantity, total_import_cost, import_price')
        .eq('id', productId)
        .single();

      if (fetchError) throw fetchError;

      const oldQuantity = Number(product.quantity);
      const newQuantityValue = isDecimalUnit
        ? Math.round(parsedStock * 1000) / 1000
        : Math.round(parsedStock);

      // Recalculate total_import_cost based on new stock
      let newTotalCost = Number(product.total_import_cost || 0);
      const importPrice = Number(product.import_price || 0);

      if (newQuantityValue !== oldQuantity) {
        if (newQuantityValue > oldQuantity) {
          // Stock increased - add cost at import price
          newTotalCost += (newQuantityValue - oldQuantity) * importPrice;
        } else if (oldQuantity > 0) {
          // Stock decreased - reduce proportionally
          const costPerUnit = newTotalCost / oldQuantity;
          newTotalCost = Math.max(0, newQuantityValue * costPerUnit);
        }
        newTotalCost = Math.round(newTotalCost * 1000) / 1000;
      }

      // Update products table
      const updateData: Record<string, any> = {
        quantity: newQuantityValue,
        total_import_cost: newTotalCost,
      };
      if (newQuantityValue === 0) {
        updateData.status = 'deleted';
      }

      const { error: updateError } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', productId);

      if (updateError) throw updateError;

      // Update product_imports if total imported changed
      if (totalImportedDiff !== 0 && importData?.hasProductImports && importData.piRecords.length > 0) {
        // Adjust the latest product_import record
        const latestPI = importData.piRecords[importData.piRecords.length - 1];
        const newPIQuantity = Math.max(0, Number(latestPI.quantity) + totalImportedDiff);

        const { error: piError } = await supabase
          .from('product_imports')
          .update({ quantity: isDecimalUnit ? Math.round(newPIQuantity * 1000) / 1000 : Math.round(newPIQuantity) })
          .eq('id', latestPI.id);

        if (piError) throw piError;
      }

      // Audit log
      await supabase.from('audit_logs').insert({
        tenant_id: tenantId,
        user_id: user?.id,
        action_type: 'ADJUST_QUANTITY',
        table_name: 'products',
        record_id: productId,
        description: `Điều chỉnh số lượng: ${productName} (${sku}) | Tổng nhập: ${originalTotalImported} → ${parsedTotalImported} | Tồn kho: ${oldQuantity} → ${newQuantityValue} | Lý do: ${reason.trim()}`,
        old_data: {
          name: productName,
          sku,
          quantity: oldQuantity,
          total_imported: originalTotalImported,
          total_import_cost: product.total_import_cost,
        },
        new_data: {
          name: productName,
          sku,
          quantity: newQuantityValue,
          total_imported: parsedTotalImported,
          total_import_cost: newTotalCost,
          reason: reason.trim(),
        },
      });

      return { oldQuantity, newQuantityValue, stockDiff };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['products'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['all-products'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['inventory'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['product-import-history'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['product-import-total'], refetchType: 'all' });

      toast({
        title: 'Điều chỉnh thành công',
        description: `Tồn kho: ${data.oldQuantity} → ${data.newQuantityValue} (${data.stockDiff > 0 ? '+' : ''}${data.stockDiff})`,
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

  const handleNumberChange = (
    value: string,
    setter: (v: string) => void,
  ) => {
    // Allow empty, digits, decimal point
    if (value === '' || /^[0-9]*\.?[0-9]*$/.test(value)) {
      setter(value);
    }
  };

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

          {/* Two columns: Tổng nhập & Tồn kho */}
          <div className="grid grid-cols-2 gap-4">
            {/* Tổng nhập */}
            <div className="space-y-2">
              <Label htmlFor="totalImported">
                Tổng nhập ({unit})
              </Label>
              <Input
                id="totalImported"
                type="text"
                inputMode="decimal"
                value={newTotalImported}
                onChange={(e) => handleNumberChange(e.target.value, setNewTotalImported)}
                onBlur={() => {
                  const num = parseFloat(newTotalImported);
                  if (!Number.isFinite(num) || num < 0) {
                    setNewTotalImported('0');
                  }
                }}
                className="text-lg font-medium"
              />
              {totalImportedDiff !== 0 && (
                <p className={`text-xs font-medium ${totalImportedDiff > 0 ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                  {totalImportedDiff > 0 ? `+${totalImportedDiff}` : totalImportedDiff} {unit}
                </p>
              )}
            </div>

            {/* Tồn kho */}
            <div className="space-y-2">
              <Label htmlFor="stock">
                Tồn kho ({unit})
              </Label>
              <Input
                id="stock"
                type="text"
                inputMode="decimal"
                value={newStock}
                onChange={(e) => handleNumberChange(e.target.value, setNewStock)}
                onBlur={() => {
                  const num = parseFloat(newStock);
                  if (!Number.isFinite(num) || num < 0) {
                    setNewStock('0');
                  }
                }}
                className="text-lg font-medium"
              />
              {stockDiff !== 0 && (
                <p className={`text-xs font-medium ${stockDiff > 0 ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                  {stockDiff > 0 ? `+${stockDiff}` : stockDiff} {unit}
                </p>
              )}
            </div>
          </div>

          {/* Validation warning */}
          {parsedStock > parsedTotalImported && (
            <p className="text-xs text-destructive">⚠ Tồn kho không được lớn hơn tổng nhập</p>
          )}

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
            onClick={() => adjustMutation.mutate()}
            disabled={adjustMutation.isPending || !hasChanges || !reason.trim() || parsedStock > parsedTotalImported}
          >
            {adjustMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Xác nhận điều chỉnh
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
