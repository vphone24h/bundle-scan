import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, Info } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ExportReceiptItemDetail } from '@/hooks/useExportReceipts';

interface EditExportItemDialogProps {
  item: ExportReceiptItemDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditExportItemDialog({ item, open, onOpenChange }: EditExportItemDialogProps) {
  const queryClient = useQueryClient();

  const [warranty, setWarranty] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (item) {
      setWarranty(item.warranty || '');
      setNote(item.note || '');
    }
  }, [item]);

  const updateItem = useMutation({
    mutationFn: async ({ 
      itemId, 
      updates,
      oldData
    }: { 
      itemId: string; 
      updates: { warranty?: string | null; note?: string | null };
      oldData: { warranty: string | null; note: string | null };
    }) => {
      const { error } = await supabase
        .from('export_receipt_items')
        .update(updates)
        .eq('id', itemId);

      if (error) throw error;

      // Ghi nhận lịch sử thao tác
      const tenantId = await supabase.rpc('get_user_tenant_id_secure');
      const { data: { user } } = await supabase.auth.getUser();
      
      if (tenantId.data) {
        await supabase.from('audit_logs').insert({
          tenant_id: tenantId.data,
          user_id: user?.id,
          action_type: 'UPDATE',
          table_name: 'export_receipt_items',
          record_id: itemId,
          description: `Thay đổi thời gian bảo hành: ${item?.product_name}`,
          old_data: oldData,
          new_data: updates,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['export-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['export-receipt-items'] });
    },
  });

  const handleSubmit = async () => {
    if (!item) return;

    try {
      const oldData = {
        warranty: item.warranty || null,
        note: item.note || null,
      };

      await updateItem.mutateAsync({
        itemId: item.id,
        updates: {
          warranty: warranty.trim() || null,
          note: note.trim() || null,
        },
        oldData,
      });

      toast({
        title: 'Cập nhật thành công',
        description: 'Thông tin bảo hành đã được cập nhật',
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
            {/* Read-only info */}
            <div className="rounded-lg bg-muted/50 p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tên sản phẩm:</span>
                <span className="font-medium">{item.product_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">SKU:</span>
                <span className="font-medium font-mono">{item.sku}</span>
              </div>
              {item.imei && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">IMEI:</span>
                  <span className="font-medium font-mono">{item.imei}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Thư mục:</span>
                <span className="font-medium">
                  {item.categories?.name || 'Không có'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Giá bán:</span>
                <span className="font-medium">
                  {Number(item.sale_price).toLocaleString('vi-VN')}đ
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

            {/* Note about read-only fields */}
            <div className="rounded-lg border border-border bg-muted/50 p-3">
              <div className="flex gap-2">
                <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p><strong>Tên, SKU, IMEI, Thư mục</strong> thuộc thông tin nhập hàng, không thể sửa tại đây.</p>
                  <p><strong>Giá bán</strong> không thể sửa. Nếu sai giá, hãy điều chỉnh dòng tiền trong <strong>Sổ quỹ</strong> hoặc thực hiện <strong>Trả hàng</strong> rồi xuất lại.</p>
                  <p>Nếu <strong>tên khách hàng</strong> hoặc <strong>SĐT</strong> sai, hãy sửa lại trong tab <strong>Khách hàng</strong>.</p>
                </div>
              </div>
            </div>

            {/* Editable fields */}
            <div className="space-y-2">
              <Label htmlFor="warranty">Thời gian bảo hành</Label>
              <Input
                id="warranty"
                value={warranty}
                onChange={(e) => setWarranty(e.target.value)}
                placeholder="VD: 12 tháng"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">Ghi chú</Label>
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ghi chú cho sản phẩm..."
                rows={2}
              />
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
