import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCategories } from '@/hooks/useCategories';
import { useBranches } from '@/hooks/useBranches';
import type { ExportReceiptItemDetail } from '@/hooks/useExportReceipts';

interface EditExportItemDialogProps {
  item: ExportReceiptItemDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditExportItemDialog({ item, open, onOpenChange }: EditExportItemDialogProps) {
  const queryClient = useQueryClient();
  const { data: categories } = useCategories();
  const { data: branches } = useBranches();

  const [formData, setFormData] = useState({
    product_name: '',
    sku: '',
    imei: '',
    category_id: '',
    warranty: '',
  });

  useEffect(() => {
    if (item) {
      setFormData({
        product_name: item.product_name || '',
        sku: item.sku || '',
        imei: item.imei || '',
        category_id: item.category_id || '_none_',
        warranty: item.warranty || '',
      });
    }
  }, [item]);

  const updateItem = useMutation({
    mutationFn: async ({ 
      itemId, 
      updates 
    }: { 
      itemId: string; 
      updates: {
        product_name?: string;
        sku?: string;
        imei?: string | null;
        category_id?: string | null;
        warranty?: string | null;
      }
    }) => {
      // Kiểm tra IMEI trùng nếu có giá trị mới
      if (updates.imei) {
        const { data: existing } = await supabase
          .from('export_receipt_items')
          .select('id, product_name, sku')
          .eq('imei', updates.imei)
          .neq('id', itemId)
          .limit(1);

        if (existing && existing.length > 0) {
          throw new Error(`IMEI "${updates.imei}" đã tồn tại (${existing[0].product_name} - ${existing[0].sku})`);
        }
      }

      const { error } = await supabase
        .from('export_receipt_items')
        .update(updates)
        .eq('id', itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['export-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['export-receipt-items'] });
    },
  });

  const handleSubmit = async () => {
    if (!item) return;

    if (!formData.product_name.trim()) {
      toast({ title: 'Lỗi', description: 'Tên sản phẩm không được để trống', variant: 'destructive' });
      return;
    }

    if (!formData.sku.trim()) {
      toast({ title: 'Lỗi', description: 'SKU không được để trống', variant: 'destructive' });
      return;
    }

    try {
      await updateItem.mutateAsync({
        itemId: item.id,
        updates: {
          product_name: formData.product_name.trim(),
          sku: formData.sku.trim(),
          imei: formData.imei.trim() || null,
          category_id: formData.category_id === '_none_' ? null : formData.category_id,
          warranty: formData.warranty.trim() || null,
        },
      });

      toast({
        title: 'Cập nhật thành công',
        description: 'Thông tin sản phẩm đã được cập nhật',
      });

      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể cập nhật sản phẩm',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa sản phẩm đã bán</DialogTitle>
        </DialogHeader>

        {item && (
          <div className="space-y-4">
            {/* Price & Customer - read only */}
            <div className="rounded-lg bg-muted/50 p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Giá bán:</span>
                <span className="font-medium">
                  {Number(item.sale_price).toLocaleString('vi-VN')}đ (không thể sửa)
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Khách hàng:</span>
                <span className="font-medium">
                  {item.export_receipts?.customers?.name || 'Khách lẻ'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Chi nhánh:</span>
                <span className="font-medium">
                  {item.export_receipts?.branches?.name || '-'}
                </span>
              </div>
            </div>

            {/* Editable fields */}
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="product_name">Tên sản phẩm <span className="text-destructive">*</span></Label>
                <Input
                  id="product_name"
                  value={formData.product_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, product_name: e.target.value }))}
                  placeholder="Nhập tên sản phẩm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sku">SKU <span className="text-destructive">*</span></Label>
                  <Input
                    id="sku"
                    value={formData.sku}
                    onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                    placeholder="Nhập SKU"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="imei">IMEI</Label>
                  <Input
                    id="imei"
                    value={formData.imei}
                    onChange={(e) => setFormData(prev => ({ ...prev, imei: e.target.value }))}
                    placeholder="Nhập IMEI"
                    className="font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Thư mục</Label>
                  <Select 
                    value={formData.category_id} 
                    onValueChange={(v) => setFormData(prev => ({ ...prev, category_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn thư mục" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="_none_">Không có</SelectItem>
                      {categories?.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="warranty">Bảo hành</Label>
                  <Input
                    id="warranty"
                    value={formData.warranty}
                    onChange={(e) => setFormData(prev => ({ ...prev, warranty: e.target.value }))}
                    placeholder="VD: 12 tháng"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button onClick={handleSubmit} disabled={updateItem.isPending}>
            {updateItem.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Save className="h-4 w-4 mr-2" />
            Lưu thay đổi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
