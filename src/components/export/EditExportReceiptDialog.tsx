import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, CalendarIcon, Search, User, Package, Pencil, UserCircle, FileText } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { useSecurityPasswordStatus, useSecurityUnlock } from '@/hooks/useSecurityPassword';
import { SecurityPasswordDialog } from '@/components/security/SecurityPasswordDialog';
import { PriceInput } from '@/components/ui/price-input';
import type { ExportReceipt, ExportReceiptItemDetail } from '@/hooks/useExportReceipts';
import { CustomerFormDialog } from '@/components/customers/CustomerFormDialog';
import { useStaffList } from '@/hooks/useCRM';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

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
  const { data: staffList } = useStaffList();

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
  // Sales staff
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [originalIsSelfSold, setOriginalIsSelfSold] = useState<boolean>(false);
  const [isSelfSold, setIsSelfSold] = useState<boolean>(false);
  const [originalStaffId, setOriginalStaffId] = useState<string | null>(null);
  // Items
  const [editableItems, setEditableItems] = useState<EditableItem[]>([]);
  // Receipt note
  const [receiptNote, setReceiptNote] = useState('');
  const [originalReceiptNote, setOriginalReceiptNote] = useState('');

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
      const staffId = (receipt as any).sales_staff_id || null;
      setSelectedStaffId(staffId);
      setOriginalStaffId(staffId);
      const note = (receipt as any).note || '';
      setReceiptNote(note);
      setOriginalReceiptNote(note);
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
  };

  const handleOpenEditCustomer = async () => {
    if (!selectedCustomerId) return;
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('id', selectedCustomerId)
      .single();
    if (data) {
      setEditingCustomerData(data);
      setShowEditCustomerDialog(true);
    }
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

  // Check if receipt is older than 1 month
  const canEditDate = receipt?.export_date
    ? differenceInDays(new Date(), new Date(receipt.export_date)) <= 30
    : true;

  // Computed
  const dateChanged = exportDate && exportDate !== originalExportDate;
  const customerChanged = selectedCustomerId !== originalCustomerId;
  const staffChanged = selectedStaffId !== originalStaffId;
  const priceChanges = editableItems.filter(i => i.sale_price !== i.original_sale_price);
  const hasPriceChanges = priceChanges.length > 0;
  const newTotal = editableItems.reduce((sum, i) => sum + (i.sale_price * i.quantity), 0);
  const noteChanged = receiptNote !== originalReceiptNote;
  const hasChanges = dateChanged || customerChanged || hasPriceChanges || staffChanged || noteChanged;

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

        // ★ Đồng bộ ngày vào sổ quỹ (cash_book)
        await supabase
          .from('cash_book')
          .update({ transaction_date: isoDate })
          .eq('reference_id', receipt.id)
          .eq('reference_type', 'export_receipt');

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

      // 2b. Update sales staff
      if (staffChanged) {
        const { error } = await supabase
          .from('export_receipts')
          .update({ sales_staff_id: selectedStaffId })
          .eq('id', receipt.id);
        if (error) throw error;
        const oldStaffName = staffList?.find(s => s.user_id === originalStaffId)?.display_name || 'N/A';
        const newStaffName = staffList?.find(s => s.user_id === selectedStaffId)?.display_name || 'N/A';
        oldData.sales_staff_id = originalStaffId;
        newData.sales_staff_id = selectedStaffId;
        changes.push(`NV bán: ${oldStaffName} → ${newStaffName}`);
      }

      // 3. Update note
      if (noteChanged) {
        const { error } = await supabase
          .from('export_receipts')
          .update({ note: receiptNote || null })
          .eq('id', receipt.id);
        if (error) throw error;
        oldData.note = originalReceiptNote || null;
        newData.note = receiptNote || null;
        changes.push(`Ghi chú: "${originalReceiptNote || '(trống)'}" → "${receiptNote || '(trống)'}"`);
      }

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

        // ★ Đồng bộ số tiền vào sổ quỹ (cash_book)
        const { data: cashEntries } = await supabase
          .from('cash_book')
          .select('id, amount')
          .eq('reference_id', receipt.id)
          .eq('reference_type', 'export_receipt');

        if (cashEntries && cashEntries.length > 0) {
          const oldTotal = Number(receipt.total_amount);
          const ratio = oldTotal > 0 ? newTotal / oldTotal : 1;
          for (const c of cashEntries) {
            const newAmount = Math.round(Number(c.amount) * ratio);
            await supabase.from('cash_book').update({ amount: newAmount }).eq('id', c.id);
          }
        }

      }

      // Audit log
      if (tenantId && changes.length > 0) {
        const actionType = [
          dateChanged && 'DATE',
          customerChanged && 'CUSTOMER',
          staffChanged && 'STAFF',
          hasPriceChanges && 'PRICE',
          noteChanged && 'NOTE',
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
      queryClient.invalidateQueries({ queryKey: ['staff-detail'] });
      queryClient.invalidateQueries({ queryKey: ['staff-revenue'] });
      queryClient.invalidateQueries({ queryKey: ['cash-book'] });
      queryClient.invalidateQueries({ queryKey: ['debt'] });
    },
  });

  const handleSubmit = async () => {
    if (!receipt || !hasChanges) return;

    const isSensitive = dateChanged || hasPriceChanges || customerChanged;
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
                  <span>{selectedCustomerName}</span>
                  {selectedCustomerId && (
                    <button
                      type="button"
                      onClick={handleOpenEditCustomer}
                      className="p-1 rounded hover:bg-muted"
                      title="Sửa thông tin khách hàng"
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>
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
                  disabled={!canEditDate}
                  className={cn(dateChanged && 'border-green-500 ring-1 ring-green-500/30')}
                />
                {!canEditDate && (
                  <p className="text-xs text-destructive">
                    Phiếu xuất quá 1 tháng, không cho phép sửa ngày
                  </p>
                )}
                {dateChanged && canEditDate && (
                  <p className="text-xs text-green-600 font-medium">
                    ⚠ Ngày bán đã thay đổi
                  </p>
                )}
              </div>

              {/* Sales Staff */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <UserCircle className="h-3.5 w-3.5" />
                  Nhân viên bán hàng
                </Label>
                <Select
                  value={selectedStaffId || '_none_'}
                  onValueChange={(v) => setSelectedStaffId(v === '_none_' ? null : v)}
                >
                  <SelectTrigger className={cn(staffChanged && 'border-green-500 ring-1 ring-green-500/30')}>
                    <SelectValue placeholder="Chọn nhân viên..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none_">Chưa gán</SelectItem>
                    {staffList?.map((staff) => (
                      <SelectItem key={staff.user_id} value={staff.user_id}>
                        {staff.display_name || 'Nhân viên'}
                        {staff.user_role === 'super_admin' && ' (Admin)'}
                        {staff.user_role === 'branch_admin' && ' (QL)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {staffChanged && (
                  <p className="text-xs text-green-600 font-medium">
                    ⚠ Nhân viên bán đã thay đổi
                  </p>
                )}
              </div>

              {/* Receipt Note */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  Ghi chú phiếu
                </Label>
                <Input
                  placeholder="Ghi chú cho cả phiếu xuất (tuỳ chọn)"
                  value={receiptNote}
                  onChange={(e) => setReceiptNote(e.target.value)}
                  className={cn(noteChanged && 'border-green-500 ring-1 ring-green-500/30')}
                />
                {noteChanged && (
                  <p className="text-xs text-green-600 font-medium">
                    ⚠ Ghi chú đã thay đổi
                  </p>
                )}
              </div>

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

      {editingCustomerData && (
        <CustomerFormDialog
          open={showEditCustomerDialog}
          onOpenChange={(open) => {
            setShowEditCustomerDialog(open);
            if (!open) {
              setEditingCustomerData(null);
              queryClient.invalidateQueries({ queryKey: ['export-receipts'] });
              queryClient.invalidateQueries({ queryKey: ['customers'] });
            }
          }}
          customer={editingCustomerData}
        />
      )}
    </>
  );
}
