import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, Info, CalendarIcon } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { useSecurityPasswordStatus, useSecurityUnlock } from '@/hooks/useSecurityPassword';
import { SecurityPasswordDialog } from '@/components/security/SecurityPasswordDialog';
import type { ExportReceiptItemDetail } from '@/hooks/useExportReceipts';

interface EditExportItemDialogProps {
  item: ExportReceiptItemDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditExportItemDialog({ item, open, onOpenChange }: EditExportItemDialogProps) {
  const queryClient = useQueryClient();

  const { data: hasSecurityPassword } = useSecurityPasswordStatus();
  const { unlocked: securityUnlocked, unlock: securityUnlock } = useSecurityUnlock('edit-export-date');
  const [showSecurityDialog, setShowSecurityDialog] = useState(false);
  const [pendingDateChange, setPendingDateChange] = useState<string | null>(null);

  const [warranty, setWarranty] = useState('');
  const [note, setNote] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [originalSalePrice, setOriginalSalePrice] = useState('');
  const [exportDate, setExportDate] = useState('');
  const [originalExportDate, setOriginalExportDate] = useState('');

  const quantity = item?.quantity || 1;
  const totalAmount = Number(salePrice || 0) * quantity;

  useEffect(() => {
    if (item) {
      setWarranty(item.warranty || '');
      setNote(item.note || '');
      setSalePrice(String(item.sale_price || 0));
      setOriginalSalePrice(String(item.sale_price || 0));
      const dateStr = item.export_receipts?.export_date 
        ? format(parseISO(item.export_receipts.export_date), "yyyy-MM-dd'T'HH:mm")
        : '';
      setExportDate(dateStr);
      setOriginalExportDate(dateStr);
    }
  }, [item]);

  const handleExportDateChange = (newDate: string) => {
    if (newDate !== originalExportDate && hasSecurityPassword && !securityUnlocked) {
      setPendingDateChange(newDate);
      setShowSecurityDialog(true);
      return;
    }
    setExportDate(newDate);
  };

  const handleSecuritySuccess = () => {
    securityUnlock();
    setShowSecurityDialog(false);
    if (pendingDateChange) {
      setExportDate(pendingDateChange);
      setPendingDateChange(null);
    }
  };

  const updateItem = useMutation({
    mutationFn: async ({ 
      itemId, 
      updates,
      oldData,
      receiptId,
      dateUpdates,
      priceChanged,
    }: { 
      itemId: string; 
      updates: { warranty?: string | null; note?: string | null; sale_price?: number };
      oldData: Record<string, any>;
      receiptId?: string;
      dateUpdates?: { export_date: string; export_date_modified: boolean };
      priceChanged?: boolean;
    }) => {
      const { error } = await supabase
        .from('export_receipt_items')
        .update(updates)
        .eq('id', itemId);

      if (error) throw error;

      // If price changed, recalculate receipt total_amount
      if (priceChanged && receiptId) {
        const { data: allItems } = await supabase
          .from('export_receipt_items')
          .select('sale_price, quantity')
          .eq('receipt_id', receiptId);
        if (allItems) {
          const newTotal = allItems.reduce((sum, i) => sum + (Number(i.sale_price) * (Number(i.quantity) || 1)), 0);
          await supabase.from('export_receipts').update({ total_amount: newTotal }).eq('id', receiptId);
        }
      }

      // Update export_date on the receipt if changed
      if (receiptId && dateUpdates) {
        const { error: receiptError } = await supabase
          .from('export_receipts')
          .update(dateUpdates)
          .eq('id', receiptId);
        if (receiptError) throw receiptError;
      }

      // Ghi nhận lịch sử thao tác
      const tenantId = await supabase.rpc('get_user_tenant_id_secure');
      const { data: { user } } = await supabase.auth.getUser();
      
      if (tenantId.data) {
        const isDateChanged = !!dateUpdates;
        const isPriceChanged = !!priceChanged;
        const actionType = isDateChanged ? 'UPDATE_EXPORT_DATE' : isPriceChanged ? 'UPDATE_SALE_PRICE' : 'UPDATE';
        const description = isDateChanged
          ? `Chỉnh sửa ngày bán: ${item?.product_name} (${oldData.export_date} → ${dateUpdates.export_date})`
          : isPriceChanged
          ? `Chỉnh sửa giá bán: ${item?.product_name} (${oldData.sale_price} → ${updates.sale_price})`
          : `Thay đổi thời gian bảo hành: ${item?.product_name}`;
        await supabase.from('audit_logs').insert({
          tenant_id: tenantId.data,
          user_id: user?.id,
          action_type: actionType,
          table_name: isDateChanged ? 'export_receipts' : 'export_receipt_items',
          record_id: isDateChanged ? receiptId : itemId,
          description,
          old_data: oldData,
          new_data: { ...updates, ...(dateUpdates || {}) },
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
      const oldData: Record<string, any> = {
        warranty: item.warranty || null,
        note: item.note || null,
        sale_price: item.sale_price,
        export_date: item.export_receipts?.export_date || null,
      };

      const dateChanged = exportDate && exportDate !== originalExportDate;
      const priceChanged = salePrice !== originalSalePrice;
      const receiptId = (item.export_receipts as any)?.id || item.receipt_id;

      await updateItem.mutateAsync({
        itemId: item.id,
        updates: {
          warranty: warranty.trim() || null,
          note: note.trim() || null,
          ...(priceChanged ? { sale_price: Number(salePrice) } : {}),
        },
        oldData,
        receiptId: (dateChanged || priceChanged) ? receiptId : undefined,
        dateUpdates: dateChanged ? {
          export_date: new Date(exportDate).toISOString(),
          export_date_modified: true,
        } : undefined,
        priceChanged,
      });

      toast({
        title: 'Cập nhật thành công',
        description: dateChanged 
          ? 'Ngày bán và thông tin sản phẩm đã được cập nhật'
          : 'Thông tin bảo hành đã được cập nhật',
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
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
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
              {quantity > 1 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Số lượng:</span>
                  <span className="font-medium">{quantity}</span>
                </div>
              )}
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
                  <p>Nếu <strong>tên khách hàng</strong> hoặc <strong>SĐT</strong> sai, hãy sửa lại trong tab <strong>Khách hàng</strong>.</p>
                </div>
              </div>
            </div>

            {/* Editable: Giá bán */}
            <div className="space-y-2">
              <Label htmlFor="sale_price">Giá bán (đơn giá)</Label>
              <Input
                id="sale_price"
                type="number"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                min={0}
                className={cn(
                  salePrice !== originalSalePrice && 'border-orange-500 ring-1 ring-orange-500/30'
                )}
              />
              {quantity > 1 && (
                <p className="text-xs text-muted-foreground">
                  Thành tiền: <strong>{totalAmount.toLocaleString('vi-VN')}đ</strong> ({quantity} x {Number(salePrice || 0).toLocaleString('vi-VN')}đ)
                </p>
              )}
              {salePrice !== originalSalePrice && (
                <p className="text-xs text-orange-600 font-medium">
                  ⚠ Giá bán đã thay đổi — thành tiền trên phiếu sẽ được cập nhật
                </p>
              )}
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

            {/* Ngày bán */}
            <div className="space-y-2">
              <Label htmlFor="export_date" className="flex items-center gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5" />
                Ngày giờ bán
              </Label>
              <Input
                id="export_date"
                type="datetime-local"
                value={exportDate}
                onChange={(e) => handleExportDateChange(e.target.value)}
                className={cn(
                  exportDate !== originalExportDate && 'border-green-500 ring-1 ring-green-500/30'
                )}
              />
              {exportDate !== originalExportDate && (
                <p className="text-xs text-green-600 font-medium">
                  ⚠ Ngày bán đã thay đổi — phiếu xuất sẽ hiển thị ở ngày mới trong lịch sử bán
                </p>
              )}
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

    <SecurityPasswordDialog
      open={showSecurityDialog}
      onOpenChange={setShowSecurityDialog}
      onSuccess={handleSecuritySuccess}
      title="Xác nhận chỉnh sửa ngày bán"
      description="Thay đổi ngày bán là thao tác nhạy cảm. Vui lòng nhập mật khẩu bảo mật."
    />
    </>
  );
}