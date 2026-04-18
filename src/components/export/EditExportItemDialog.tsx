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
import { PriceInput } from '@/components/ui/price-input';
import type { ExportReceiptItemDetail } from '@/hooks/useExportReceipts';

interface EditExportItemDialogProps {
  item: (ExportReceiptItemDetail & { _groupedIds?: string[]; _groupedQuantity?: number }) | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditExportItemDialog({ item, open, onOpenChange }: EditExportItemDialogProps) {
  const queryClient = useQueryClient();

  const { data: hasSecurityPassword } = useSecurityPasswordStatus();
  const { unlocked: securityUnlocked, unlock: securityUnlock } = useSecurityUnlock('edit-export-item');
  const [showSecurityDialog, setShowSecurityDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<'date' | 'price' | null>(null);
  const [pendingValue, setPendingValue] = useState<any>(null);

  const [warranty, setWarranty] = useState('');
  const [note, setNote] = useState('');
  const [salePrice, setSalePrice] = useState<number>(0);
  const [originalSalePrice, setOriginalSalePrice] = useState<number>(0);
  const [exportDate, setExportDate] = useState('');
  const [originalExportDate, setOriginalExportDate] = useState('');

  const quantity = item?._groupedQuantity || item?.quantity || 1;
  const totalPrice = salePrice * quantity;

  useEffect(() => {
    if (item) {
      setWarranty(item.warranty || '');
      setNote(item.note || '');
      setSalePrice(item.sale_price || 0);
      setOriginalSalePrice(item.sale_price || 0);
      const dateStr = item.export_receipts?.export_date 
        ? format(parseISO(item.export_receipts.export_date), "yyyy-MM-dd'T'HH:mm")
        : '';
      setExportDate(dateStr);
      setOriginalExportDate(dateStr);
    }
  }, [item]);

  const requireSecurity = (action: 'date' | 'price', value: any, callback: () => void) => {
    if (hasSecurityPassword && !securityUnlocked) {
      setPendingAction(action);
      setPendingValue(value);
      setShowSecurityDialog(true);
      return;
    }
    callback();
  };

  const handleExportDateChange = (newDate: string) => {
    if (newDate !== originalExportDate) {
      requireSecurity('date', newDate, () => setExportDate(newDate));
    } else {
      setExportDate(newDate);
    }
  };

  const handleSalePriceChange = (newPrice: number) => {
    if (newPrice !== originalSalePrice) {
      requireSecurity('price', newPrice, () => setSalePrice(newPrice));
    } else {
      setSalePrice(newPrice);
    }
  };

  const handleSecuritySuccess = () => {
    securityUnlock();
    setShowSecurityDialog(false);
    if (pendingAction === 'date' && pendingValue) {
      setExportDate(pendingValue);
    } else if (pendingAction === 'price' && pendingValue !== null) {
      setSalePrice(pendingValue);
    }
    setPendingAction(null);
    setPendingValue(null);
  };

  const updateItem = useMutation({
    mutationFn: async (params: {
      itemId: string;
      groupedIds?: string[];
      updates: { warranty?: string | null; note?: string | null; sale_price?: number };
      oldData: Record<string, any>;
      receiptId?: string;
      dateUpdates?: { export_date: string; export_date_modified: boolean };
      priceChanged?: boolean;
    }) => {
      const { itemId, groupedIds, updates, oldData, receiptId, dateUpdates, priceChanged } = params;

      // Update all items in group (for grouped non-IMEI) or single item
      const idsToUpdate = groupedIds && groupedIds.length > 0 ? groupedIds : [itemId];
      
      for (const id of idsToUpdate) {
        const { error } = await supabase
          .from('export_receipt_items')
          .update(updates)
          .eq('id', id);
        if (error) throw error;
      }

      // Update export_date on the receipt if changed
      if (receiptId && dateUpdates) {
        const { error: receiptError } = await supabase
          .from('export_receipts')
          .update(dateUpdates)
          .eq('id', receiptId);
        if (receiptError) throw receiptError;

        // ★ Đồng bộ ngày vào sổ quỹ (cash_book) cho dòng thu của phiếu bán
        await supabase
          .from('cash_book')
          .update({ transaction_date: dateUpdates.export_date })
          .eq('reference_id', receiptId)
          .eq('reference_type', 'export_receipt');
      }

      // Recalculate receipt total if price changed
      if (receiptId && priceChanged) {
        const { data: allItems, error: fetchError } = await supabase
          .from('export_receipt_items')
          .select('sale_price, quantity')
          .eq('receipt_id', receiptId);
        if (fetchError) throw fetchError;

        const newTotal = (allItems || []).reduce((sum, i) => sum + (i.sale_price * (i.quantity || 1)), 0);
        const { error: totalError } = await supabase
          .from('export_receipts')
          .update({ total_amount: newTotal })
          .eq('id', receiptId);
        if (totalError) throw totalError;
      }

      // Audit log
      const tenantId = await supabase.rpc('get_user_tenant_id_secure');
      const { data: { user } } = await supabase.auth.getUser();
      
      if (tenantId.data) {
        const isDateChanged = !!dateUpdates;
        const isPriceChanged = priceChanged;
        let actionType = 'UPDATE';
        let description = `Thay đổi thông tin: ${item?.product_name}`;

        if (isDateChanged && isPriceChanged) {
          actionType = 'UPDATE_EXPORT_DATE_PRICE';
          description = `Chỉnh sửa ngày bán & giá bán: ${item?.product_name} (Ngày: ${oldData.export_date} → ${dateUpdates.export_date}, Giá: ${oldData.sale_price?.toLocaleString('vi-VN')}đ → ${updates.sale_price?.toLocaleString('vi-VN')}đ)`;
        } else if (isDateChanged) {
          actionType = 'UPDATE_EXPORT_DATE';
          description = `Chỉnh sửa ngày bán: ${item?.product_name} (${oldData.export_date} → ${dateUpdates.export_date})`;
        } else if (isPriceChanged) {
          actionType = 'UPDATE_EXPORT_PRICE';
          description = `Chỉnh sửa giá bán: ${item?.product_name} (${oldData.sale_price?.toLocaleString('vi-VN')}đ → ${updates.sale_price?.toLocaleString('vi-VN')}đ)`;
        }

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
        groupedIds: item._groupedIds,
        updates: {
          warranty: warranty.trim() || null,
          note: note.trim() || null,
          sale_price: salePrice,
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
          : priceChanged
            ? 'Giá bán đã được cập nhật'
            : 'Thông tin sản phẩm đã được cập nhật',
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
                <span className="text-muted-foreground">Số lượng:</span>
                <span className="font-medium">{quantity}</span>
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
                  <p><strong>Tên, SKU, IMEI</strong> thuộc thông tin nhập hàng, không thể sửa tại đây.</p>
                  <p>Nếu <strong>tên khách hàng</strong> hoặc <strong>SĐT</strong> sai, hãy sửa lại trong tab <strong>Khách hàng</strong>.</p>
                </div>
              </div>
            </div>

            {/* Editable: Giá bán */}
            <div className="space-y-2">
              <Label htmlFor="sale_price">Giá bán (đơn giá)</Label>
              <PriceInput
                id="sale_price"
                value={salePrice}
                onChange={handleSalePriceChange}
                className={cn(
                  salePrice !== originalSalePrice && 'border-green-500 ring-1 ring-green-500/30'
                )}
              />
              {quantity > 1 && (
                <p className="text-xs text-muted-foreground">
                  Thành tiền: <span className="font-medium">{totalPrice.toLocaleString('vi-VN')}đ</span> ({quantity} x {salePrice.toLocaleString('vi-VN')}đ)
                </p>
              )}
              {salePrice !== originalSalePrice && (
                <p className="text-xs text-green-600 font-medium">
                  ⚠ Giá bán thay đổi: {originalSalePrice.toLocaleString('vi-VN')}đ → {salePrice.toLocaleString('vi-VN')}đ
                </p>
              )}
            </div>

            {/* Editable: Bảo hành */}
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
      title="Xác nhận chỉnh sửa"
      description="Thay đổi giá bán hoặc ngày bán là thao tác nhạy cảm. Vui lòng nhập mật khẩu bảo mật."
    />
    </>
  );
}
