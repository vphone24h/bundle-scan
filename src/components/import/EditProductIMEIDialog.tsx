import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Product } from '@/hooks/useProducts';

interface EditProductIMEIDialogProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditProductIMEIDialog({ product, open, onOpenChange }: EditProductIMEIDialogProps) {
  const queryClient = useQueryClient();
  const [imei, setImei] = useState('');

  useEffect(() => {
    if (product) {
      setImei(product.imei || '');
    }
  }, [product]);

  const updateIMEI = useMutation({
    mutationFn: async ({ productId, newImei }: { productId: string; newImei: string | null }) => {
      // Kiểm tra IMEI trùng nếu có giá trị mới
      if (newImei) {
        const { data: existing } = await supabase
          .from('products')
          .select('id, name, sku')
          .eq('imei', newImei)
          .neq('id', productId)
          .in('status', ['in_stock', 'sold', 'returned'])
          .limit(1);

        if (existing && existing.length > 0) {
          throw new Error(`IMEI "${newImei}" đã tồn tại trong kho (${existing[0].name} - ${existing[0].sku})`);
        }
      }

      const { error } = await supabase
        .from('products')
        .update({ imei: newImei || null })
        .eq('id', productId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });

  const handleSubmit = async () => {
    if (!product) return;

    try {
      await updateIMEI.mutateAsync({
        productId: product.id,
        newImei: imei.trim() || null,
      });

      toast({
        title: 'Cập nhật thành công',
        description: 'IMEI đã được thay đổi',
      });

      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể cập nhật IMEI',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa IMEI sản phẩm</DialogTitle>
        </DialogHeader>

        {product && (
          <div className="space-y-4">
            {/* Product info - read only */}
            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tên sản phẩm:</span>
                <span className="font-medium">{product.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">SKU:</span>
                <span className="font-mono">{product.sku}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Giá nhập:</span>
                <span className="font-medium text-muted-foreground">
                  {Number(product.import_price).toLocaleString('vi-VN')}đ (không thể sửa)
                </span>
              </div>
            </div>

            {/* IMEI - editable */}
            <div className="space-y-2">
              <Label htmlFor="imei">IMEI</Label>
              <Input
                id="imei"
                value={imei}
                onChange={(e) => setImei(e.target.value)}
                placeholder="Nhập số IMEI mới"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Để trống nếu muốn xóa IMEI khỏi sản phẩm
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button onClick={handleSubmit} disabled={updateIMEI.isPending}>
            {updateIMEI.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Save className="h-4 w-4 mr-2" />
            Lưu thay đổi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
