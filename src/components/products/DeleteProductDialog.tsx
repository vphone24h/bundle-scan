import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface DeleteProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  sku: string;
  imei: string;
}

export function DeleteProductDialog({
  open,
  onOpenChange,
  productId,
  productName,
  sku,
  imei,
}: DeleteProductDialogProps) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [confirmText, setConfirmText] = useState('');

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!reason.trim()) {
        throw new Error('Vui lòng nhập lý do xóa');
      }

      // Lấy thông tin tenant và user
      const [tenantResult, userResult] = await Promise.all([
        supabase.rpc('get_user_tenant_id_secure'),
        supabase.auth.getUser(),
      ]);

      const tenantId = tenantResult.data;
      const user = userResult.data.user;

      if (!tenantId) throw new Error('Không tìm thấy tenant');

      // Lấy thông tin sản phẩm trước khi xóa
      const { data: product, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

      if (fetchError) throw fetchError;

      // Soft delete: cập nhật status sang 'deleted'
      const { error: deleteError } = await supabase
        .from('products')
        .update({ status: 'deleted' as any })
        .eq('id', productId);

      if (deleteError) throw deleteError;

      // Ghi log thao tác
      await supabase.from('audit_logs').insert({
        tenant_id: tenantId,
        user_id: user?.id,
        action_type: 'DELETE_IMEI_PRODUCT',
        table_name: 'products',
        record_id: productId,
        description: `Xóa sản phẩm IMEI: ${productName} (${sku}) - IMEI: ${imei}`,
        old_data: {
          id: product.id,
          name: product.name,
          sku: product.sku,
          imei: product.imei,
          import_price: product.import_price,
          status: product.status,
          branch_id: product.branch_id,
        },
        new_data: {
          deleted: true,
          reason: reason.trim(),
          deleted_at: new Date().toISOString(),
        },
      });

      return product;
    },
    onSuccess: async (data) => {
      // Invalidate với refetchType: 'all' để đảm bảo refetch ngay lập tức
      await queryClient.invalidateQueries({ 
        queryKey: ['inventory'],
        refetchType: 'all'
      });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['all-products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });

      toast({
        title: 'Đã xóa sản phẩm',
        description: `IMEI ${data.imei} đã được xóa khỏi hệ thống`,
      });
      onOpenChange(false);
      setReason('');
      setConfirmText('');
    },
    onError: (error: any) => {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể xóa sản phẩm',
        variant: 'destructive',
      });
    },
  });

  const handleDelete = () => {
    deleteMutation.mutate();
  };

  // Robust confirmation check: accept various Unicode/IME variants of "XÓA"
  // (e.g. composed/decomposed accents, different keyboard input methods)
  const normalizedConfirm = confirmText
    .trim()
    .toLowerCase()
    .normalize('NFD')
    // Remove all diacritics marks
    .replace(/\p{Diacritic}/gu, '');
  const isConfirmValid = normalizedConfirm === 'xoa';

  const isReasonValid = !!reason.trim();
  const isSubmitDisabled = deleteMutation.isPending || !isConfirmValid || !isReasonValid;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Xóa sản phẩm IMEI
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>Bạn đang xóa sản phẩm này khỏi hệ thống. Thao tác này sẽ được ghi lại trong lịch sử.</p>
              
              <div className="rounded-lg bg-muted p-3 space-y-1">
                <p className="font-medium text-foreground">{productName}</p>
                <p className="text-xs">SKU: {sku}</p>
                <p className="text-xs font-mono">IMEI: {imei}</p>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-2">
          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="deleteReason">Lý do xóa <span className="text-destructive">*</span></Label>
            <Textarea
              id="deleteReason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="VD: Máy hỏng không sửa được, IMEI nhập sai, sản phẩm thất lạc..."
              rows={3}
            />
            {!isReasonValid && (
              <p className="text-xs text-destructive">Vui lòng nhập lý do xóa để mở nút.</p>
            )}
          </div>

          {/* Confirm text */}
          <div className="space-y-2">
            <Label htmlFor="confirmDelete">
              Nhập <span className="font-bold text-destructive">XÓA</span> để xác nhận
            </Label>
            <Input
              id="confirmDelete"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="XÓA"
              className="uppercase"
            />
            {!isConfirmValid && (
              <p className="text-xs text-destructive">Vui lòng nhập đúng “XÓA” (có thể gõ XOA).</p>
            )}
          </div>
        </div>

        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isSubmitDisabled}
          >
            {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Trash2 className="h-4 w-4 mr-2" />
            Xóa sản phẩm
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
