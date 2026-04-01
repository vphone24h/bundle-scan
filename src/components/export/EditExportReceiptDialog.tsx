import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, CalendarIcon, Search, User, Package, Pencil } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { useSecurityPasswordStatus, useSecurityUnlock } from '@/hooks/useSecurityPassword';
import { SecurityPasswordDialog } from '@/components/security/SecurityPasswordDialog';
import { PriceInput } from '@/components/ui/price-input';
import type { ExportReceipt, ExportReceiptItemDetail } from '@/hooks/useExportReceipts';
import { CustomerFormDialog } from '@/components/customers/CustomerFormDialog';

interface EditExportReceiptDialogProps {
  receipt: ExportReceipt | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CustomerOption {
  id: string;
  name: string;
  phone: string;
}

interface EditableItem {
  id: string;
  product_name: string;
  sku: string;
  imei: string | null;
  sale_price: number;
  original_sale_price: number;
  quantity: number;
  unit: string;
}

export function EditExportReceiptDialog({ receipt, open, onOpenChange }: EditExportReceiptDialogProps) {
  const queryClient = useQueryClient();

  const { data: hasSecurityPassword } = useSecurityPasswordStatus();
  const { unlocked: securityUnlocked, unlock: securityUnlock } = useSecurityUnlock('edit-export-receipt-full');
  const [showSecurityDialog, setShowSecurityDialog] = useState(false);

  const [exportDate, setExportDate] = useState('');
  const [originalExportDate, setOriginalExportDate] = useState('');

  // Customer
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [originalCustomerId, setOriginalCustomerId] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<CustomerOption[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomerName, setSelectedCustomerName] = useState('');

  // Edit customer dialog
  const [showEditCustomerDialog, setShowEditCustomerDialog] = useState(false);
  const [editingCustomerData, setEditingCustomerData] = useState<any>(null);
  // Items
  const [editableItems, setEditableItems] = useState<EditableItem[]>([]);

  // Fetch receipt items
  const { data: receiptItems } = useQuery({
    queryKey: ['export-receipt-detail', receipt?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('export_receipt_items')
        .select('id, product_name, sku, imei, sale_price, quantity, unit')
        .eq('receipt_id', receipt!.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!receipt?.id && open,
  });

  useEffect(() => {
    if (receipt) {
      const dateStr = receipt.export_date
        ? format(parseISO(receipt.export_date), "yyyy-MM-dd'T'HH:mm")
        : '';
      setExportDate(dateStr);
      setOriginalExportDate(dateStr);
      setSelectedCustomerId(receipt.customer_id);
      setOriginalCustomerId(receipt.customer_id);
      setSelectedCustomerName(receipt.customers?.name || 'Khách lẻ');
      setCustomerSearch('');
      setShowCustomerDropdown(false);
      setShowEditCustomerDialog(false);
    }
  }, [receipt]);

  useEffect(() => {
    if (receiptItems) {
      setEditableItems(receiptItems.map(item => ({
        id: item.id,
        product_name: item.product_name,
        sku: item.sku,
        imei: item.imei,
        sale_price: item.sale_price,
        original_sale_price: item.sale_price,
        quantity: item.quantity || 1,
        unit: item.unit || 'cái',
      })));
    }
  }, [receiptItems]);

  // Customer search
  const searchCustomers = useCallback(async (term: string) => {
    if (term.length < 1) {
      setCustomerResults([]);
      return;
    }
    const { data } = await supabase
      .from('customers')
      .select('id, name, phone')
      .or(`name.ilike.%${term}%,phone.ilike.%${term}%`)
      .limit(10);
    setCustomerResults(data || []);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (customerSearch.trim()) {
        searchCustomers(customerSearch.trim());
        setShowCustomerDropdown(true);
      } else {
        setShowCustomerDropdown(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [customerSearch, searchCustomers]);

  const selectCustomer = (c: CustomerOption) => {
    setSelectedCustomerId(c.id);
    setSelectedCustomerName(`${c.name} - ${c.phone}`);
    setCustomerSearch('');
    setShowCustomerDropdown(false);
    setEditCustomerName(c.name);
    setEditCustomerPhone(c.phone);
    setOriginalCustomerNameVal(c.name);
    setOriginalCustomerPhoneVal(c.phone);
    setEditingCustomerInfo(false);
  };

  const handleItemPriceChange = (index: number, newPrice: number) => {
    setEditableItems(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], sale_price: newPrice };
      return copy;
    });
  };

  const requireSecurity = (callback: () => void) => {
    if (hasSecurityPassword && !securityUnlocked) {
      setShowSecurityDialog(true);
      return;
    }
    callback();
  };

  const handleSecuritySuccess = () => {
    securityUnlock();
    setShowSecurityDialog(false);
  };

  // Computed
  const dateChanged = exportDate && exportDate !== originalExportDate;
  const customerChanged = selectedCustomerId !== originalCustomerId;
  const customerInfoChanged = editCustomerName !== originalCustomerNameVal || editCustomerPhone !== originalCustomerPhoneVal;
  const priceChanges = editableItems.filter(i => i.sale_price !== i.original_sale_price);
  const hasPriceChanges = priceChanges.length > 0;
  const newTotal = editableItems.reduce((sum, i) => sum + (i.sale_price * i.quantity), 0);
  const hasChanges = dateChanged || customerChanged || customerInfoChanged || hasPriceChanges;

  const updateReceipt = useMutation({
    mutationFn: async () => {
      if (!receipt) throw new Error('No receipt');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const tenantRes = await supabase.rpc('get_user_tenant_id_secure');
      const tenantId = tenantRes.data;
      const changes: string[] = [];
      const oldData: Record<string, any> = {};
      const newData: Record<string, any> = {};

      // 1. Update date
      if (dateChanged) {
        const isoDate = new Date(exportDate).toISOString();
        const { error } = await supabase
          .from('export_receipts')
          .update({ export_date: isoDate, export_date_modified: true })
          .eq('id', receipt.id);
        if (error) throw error;
        oldData.export_date = receipt.export_date;
        newData.export_date = isoDate;
        changes.push(`Ngày bán: ${receipt.export_date?.substring(0, 16).replace('T', ' ')} → ${isoDate.substring(0, 16).replace('T', ' ')}`);
      }

      // 2. Update customer
      if (customerChanged && selectedCustomerId) {
        const { error } = await supabase
          .from('export_receipts')
          .update({ customer_id: selectedCustomerId })
          .eq('id', receipt.id);
        if (error) throw error;
        oldData.customer_id = originalCustomerId;
        oldData.customer_name = receipt.customers?.name;
        newData.customer_id = selectedCustomerId;
        newData.customer_name = selectedCustomerName;
        changes.push(`Khách hàng: ${receipt.customers?.name || 'Khách lẻ'} → ${selectedCustomerName}`);
      }

      // 2b. Update customer info (name/phone)
      if (customerInfoChanged && selectedCustomerId) {
        const updateData: Record<string, string> = {};
        if (editCustomerName !== originalCustomerNameVal) updateData.name = editCustomerName;
        if (editCustomerPhone !== originalCustomerPhoneVal) updateData.phone = editCustomerPhone;
        
        const { error } = await supabase
          .from('customers')
          .update(updateData)
          .eq('id', selectedCustomerId);
        if (error) throw error;
        
        if (editCustomerName !== originalCustomerNameVal) {
          changes.push(`Tên KH: ${originalCustomerNameVal} → ${editCustomerName}`);
          oldData.customer_name_info = originalCustomerNameVal;
          newData.customer_name_info = editCustomerName;
        }
        if (editCustomerPhone !== originalCustomerPhoneVal) {
          changes.push(`SĐT KH: ${originalCustomerPhoneVal} → ${editCustomerPhone}`);
          oldData.customer_phone = originalCustomerPhoneVal;
          newData.customer_phone = editCustomerPhone;
        }
      }

      // 3. Update item prices
      if (hasPriceChanges) {
        for (const item of priceChanges) {
          const { error } = await supabase
            .from('export_receipt_items')
            .update({ sale_price: item.sale_price })
            .eq('id', item.id);
          if (error) throw error;
          changes.push(`Giá ${item.product_name}: ${item.original_sale_price.toLocaleString('vi-VN')}đ → ${item.sale_price.toLocaleString('vi-VN')}đ`);
        }

        // Recalculate receipt total
        const { error: totalError } = await supabase
          .from('export_receipts')
          .update({ total_amount: newTotal })
          .eq('id', receipt.id);
        if (totalError) throw totalError;
        oldData.total_amount = receipt.total_amount;
        newData.total_amount = newTotal;
      }

      // Audit log
      if (tenantId && changes.length > 0) {
        const actionType = [
          dateChanged && 'DATE',
          (customerChanged || customerInfoChanged) && 'CUSTOMER',
          hasPriceChanges && 'PRICE',
        ].filter(Boolean).join('_');

        await supabase.from('audit_logs').insert({
          tenant_id: tenantId,
          user_id: user.id,
          action_type: `UPDATE_EXPORT_${actionType}`,
          table_name: 'export_receipts',
          record_id: receipt.id,
          description: `Chỉnh sửa phiếu ${receipt.code}: ${changes.join('; ')}`,
          old_data: oldData,
          new_data: newData,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['export-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['export-receipt-items'] });
      queryClient.invalidateQueries({ queryKey: ['export-receipt-detail'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  const handleSubmit = async () => {
    if (!receipt || !hasChanges) return;

    const isSensitive = dateChanged || hasPriceChanges || customerChanged || customerInfoChanged;
    if (isSensitive && hasSecurityPassword && !securityUnlocked) {
      setShowSecurityDialog(true);
      return;
    }

    try {
      await updateReceipt.mutateAsync();
      toast({
        title: 'Cập nhật thành công',
        description: 'Phiếu xuất đã được cập nhật',
      });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể cập nhật phiếu xuất',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa phiếu xuất {receipt?.code}</DialogTitle>
          </DialogHeader>

          {receipt && (
            <div className="space-y-4">
              {/* Customer */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  Khách hàng
                </Label>
                <div className="rounded-lg bg-muted/50 p-2 text-sm font-medium flex items-center justify-between">
                  {editingCustomerInfo ? (
                    <div className="flex-1 space-y-2">
                      <Input
                        value={editCustomerName}
                        onChange={(e) => setEditCustomerName(e.target.value)}
                        placeholder="Tên khách hàng"
                        className="h-8 text-sm"
                      />
                      <Input
                        value={editCustomerPhone}
                        onChange={(e) => setEditCustomerPhone(e.target.value)}
                        placeholder="Số điện thoại"
                        className="h-8 text-sm"
                      />
                      <div className="flex gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          onClick={() => {
                            setEditingCustomerInfo(false);
                            setEditCustomerName(originalCustomerNameVal);
                            setEditCustomerPhone(originalCustomerPhoneVal);
                          }}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => setEditingCustomerInfo(false)}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span>{selectedCustomerName}</span>
                      <button
                        type="button"
                        onClick={() => setEditingCustomerInfo(true)}
                        className="p-1 rounded hover:bg-muted"
                      >
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </>
                  )}
                </div>
                {customerInfoChanged && (
                  <p className="text-xs text-green-600 font-medium">
                    ⚠ Thông tin khách hàng đã thay đổi
                  </p>
                )}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Tìm khách hàng để thay đổi..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className={cn('pl-8', customerChanged && 'border-green-500 ring-1 ring-green-500/30')}
                  />
                  {showCustomerDropdown && customerResults.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {customerResults.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex justify-between"
                          onClick={() => selectCustomer(c)}
                        >
                          <span className="font-medium">{c.name}</span>
                          <span className="text-muted-foreground">{c.phone}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {customerChanged && (
                  <p className="text-xs text-green-600 font-medium">
                    ⚠ Khách hàng đã thay đổi
                  </p>
                )}
              </div>

              {/* Date */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  Ngày giờ bán
                </Label>
                <Input
                  type="datetime-local"
                  value={exportDate}
                  onChange={(e) => setExportDate(e.target.value)}
                  className={cn(dateChanged && 'border-green-500 ring-1 ring-green-500/30')}
                />
                {dateChanged && (
                  <p className="text-xs text-green-600 font-medium">
                    ⚠ Ngày bán đã thay đổi
                  </p>
                )}
              </div>

              {/* Items */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5" />
                  Sản phẩm ({editableItems.length})
                </Label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {editableItems.map((item, idx) => (
                    <div key={item.id} className={cn(
                      "rounded-lg border p-2.5 space-y-1.5",
                      item.sale_price !== item.original_sale_price && 'border-green-500 bg-green-50/50'
                    )}>
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.product_name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{item.sku}{item.imei ? ` • ${item.imei}` : ''}</p>
                        </div>
                        {item.quantity > 1 && (
                          <span className="text-xs text-muted-foreground ml-2">x{item.quantity}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <PriceInput
                          value={item.sale_price}
                          onChange={(v) => handleItemPriceChange(idx, v)}
                          className="h-8 text-sm"
                        />
                        {item.quantity > 1 && (
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            = {(item.sale_price * item.quantity).toLocaleString('vi-VN')}đ
                          </span>
                        )}
                      </div>
                      {item.sale_price !== item.original_sale_price && (
                        <p className="text-xs text-green-600">
                          {item.original_sale_price.toLocaleString('vi-VN')}đ → {item.sale_price.toLocaleString('vi-VN')}đ
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="flex justify-between text-sm font-medium">
                  <span>Tổng tiền:</span>
                  <span className={cn(hasPriceChanges && 'text-green-600')}>
                    {newTotal.toLocaleString('vi-VN')}đ
                  </span>
                </div>
                {hasPriceChanges && (
                  <p className="text-xs text-green-600 mt-1">
                    Trước: {receipt.total_amount.toLocaleString('vi-VN')}đ → Sau: {newTotal.toLocaleString('vi-VN')}đ
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button onClick={handleSubmit} disabled={updateReceipt.isPending || !hasChanges}>
              {updateReceipt.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
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
        title="Xác nhận chỉnh sửa phiếu xuất"
        description="Thay đổi thông tin phiếu xuất là thao tác nhạy cảm. Vui lòng nhập mật khẩu bảo mật."
      />
    </>
  );
}
