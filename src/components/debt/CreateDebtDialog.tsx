import { useState, useEffect, useRef } from 'react';
import { createSafeDialogOpenChange, forceReleaseStuckInteraction, preventDialogAutoFocus } from '@/lib/dialogInteraction';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PriceInput } from '@/components/ui/price-input';
import { Loader2, Building2, Search, Plus, Phone, User, X, Truck, Wallet } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { useBranches } from '@/hooks/useBranches';
import { useSuppliers, type Supplier } from '@/hooks/useSuppliers';
import { useCustomPaymentSources } from '@/hooks/useCustomPaymentSources';
import { CustomerSearchCombobox } from '@/components/export/CustomerSearchCombobox';

interface CreateDebtDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: 'customer' | 'supplier';
}

async function getCurrentTenantId(): Promise<string | null> {
  const { data } = await supabase.rpc('get_user_tenant_id_secure');
  return data;
}

export function CreateDebtDialog({
  open,
  onOpenChange,
  entityType,
}: CreateDebtDialogProps) {
  useEffect(() => {
    if (!open) {
      forceReleaseStuckInteraction();
    }
  }, [open]);

  const queryClient = useQueryClient();
  const { data: permissions } = usePermissions();
  const { data: branches } = useBranches();
  const isSuperAdmin = permissions?.canViewAllBranches === true;

  const isCustomer = entityType === 'customer';

  // Common state
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');

  // Customer search state (for CustomerSearchCombobox)
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerSource, setCustomerSource] = useState('');
  const [customerBirthday, setCustomerBirthday] = useState<Date | undefined>();

  // Supplier search state
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [isAddingNewSupplier, setIsAddingNewSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const supplierSearchRef = useRef<HTMLDivElement>(null);

  const { data: allSuppliers } = useSuppliers();

  // Filter suppliers based on search
  const filteredSuppliers = (allSuppliers || []).filter(s => {
    if (!supplierSearchQuery.trim()) return false;
    const q = supplierSearchQuery.trim().toLowerCase();
    return s.name.toLowerCase().includes(q) || (s.phone && s.phone.includes(q));
  }).slice(0, 8);

  // Close supplier dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (supplierSearchRef.current && !supplierSearchRef.current.contains(e.target as Node)) {
        setShowSupplierDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Show dropdown when typing
  useEffect(() => {
    if (supplierSearchQuery.trim().length >= 2 && !selectedSupplier) {
      setShowSupplierDropdown(true);
    } else {
      setShowSupplierDropdown(false);
    }
  }, [supplierSearchQuery, selectedSupplier]);

  // Auto-set branch
  useEffect(() => {
    if (!isSuperAdmin && permissions?.branchId) {
      setSelectedBranchId(permissions.branchId);
    }
  }, [isSuperAdmin, permissions?.branchId]);

  useEffect(() => {
    if (open && isSuperAdmin && branches?.length && !selectedBranchId) {
      const defaultBranch = branches.find(b => b.is_default);
      if (defaultBranch) setSelectedBranchId(defaultBranch.id);
    }
  }, [open, isSuperAdmin, branches, selectedBranchId]);

  const createDebtMutation = useMutation({
    mutationFn: async () => {
      if (amount <= 0) throw new Error('Vui lòng nhập số tiền nợ');
      if (!selectedBranchId) throw new Error('Vui lòng chọn chi nhánh');

      const tenantId = await getCurrentTenantId();
      if (!tenantId) throw new Error('Không tìm thấy tenant');
      const { data: { user } } = await supabase.auth.getUser();

      let entityId: string;
      let entityName: string;

      if (isCustomer) {
        if (selectedCustomer) {
          entityId = selectedCustomer.id;
          entityName = selectedCustomer.name;
        } else if (customerName.trim() && customerPhone.trim()) {
          // Check existing by phone
          const { data: existing } = await supabase
            .from('customers')
            .select('id, name')
            .eq('phone', customerPhone.trim())
            .eq('tenant_id', tenantId)
            .single();

          if (existing) {
            entityId = existing.id;
            entityName = existing.name;
          } else {
            const { data: newCust, error } = await supabase
              .from('customers')
              .insert([{
                name: customerName.trim(),
                phone: customerPhone.trim(),
                email: customerEmail.trim() || null,
                address: customerAddress.trim() || null,
                source: customerSource || 'Công nợ',
                birthday: customerBirthday ? customerBirthday.toISOString().split('T')[0] : null,
                crm_status: 'new',
                tenant_id: tenantId,
                preferred_branch_id: selectedBranchId,
              }])
              .select('id, name')
              .single();
            if (error) throw error;
            entityId = newCust.id;
            entityName = newCust.name;
          }
        } else {
          throw new Error('Vui lòng chọn hoặc thêm khách hàng');
        }
      } else {
        if (selectedSupplier) {
          entityId = selectedSupplier.id;
          entityName = selectedSupplier.name;
        } else if (isAddingNewSupplier && newSupplierName.trim()) {
          // Check existing supplier
          const { data: existing } = await supabase
            .from('suppliers')
            .select('id, name')
            .eq('name', newSupplierName.trim())
            .eq('tenant_id', tenantId)
            .maybeSingle();

          if (existing) {
            entityId = existing.id;
            entityName = existing.name;
          } else {
            const { data: newSup, error } = await supabase
              .from('suppliers')
              .insert([{
                name: newSupplierName.trim(),
                phone: newSupplierPhone.trim() || null,
                tenant_id: tenantId,
                branch_id: selectedBranchId,
              }])
              .select('id, name')
              .single();
            if (error) throw error;
            entityId = newSup.id;
            entityName = newSup.name;
          }
        } else {
          throw new Error('Vui lòng chọn hoặc thêm nhà cung cấp');
        }
      }

      // Create debt payment
      const { error: debtError } = await supabase
        .from('debt_payments')
        .insert([{
          entity_type: entityType,
          entity_id: entityId,
          payment_type: 'addition',
          amount,
          description: note.trim() || (isCustomer ? 'Công nợ khách hàng mới' : 'Công nợ nhà cung cấp mới'),
          created_by: user?.id,
          tenant_id: tenantId,
          branch_id: selectedBranchId,
        }]);
      if (debtError) throw debtError;

      await supabase.from('audit_logs').insert([{
        user_id: user?.id,
        action_type: 'create',
        table_name: 'debt_payments',
        branch_id: selectedBranchId,
        description: `Thêm công nợ mới: ${entityName} - ${amount.toLocaleString('vi-VN')}đ`,
      }]);

      return { entityId, name: entityName };
    },
    onSuccess: (data) => {
      toast.success(`Đã thêm công nợ cho ${data.name}`);
      queryClient.invalidateQueries({ queryKey: ['customer-debts'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-debts'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      resetForm();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Có lỗi xảy ra');
    },
  });

  const resetForm = () => {
    setAmount(0);
    setNote('');
    setSelectedCustomer(null);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setCustomerEmail('');
    setCustomerSource('');
    setCustomerBirthday(undefined);
    setSelectedSupplier(null);
    setSupplierSearchQuery('');
    setIsAddingNewSupplier(false);
    setNewSupplierName('');
    setNewSupplierPhone('');
    if (isSuperAdmin) setSelectedBranchId('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createDebtMutation.mutate();
  };

  const handleSelectSupplier = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setShowSupplierDropdown(false);
    setSupplierSearchQuery('');
    setIsAddingNewSupplier(false);
  };

  const handleClearSupplier = () => {
    setSelectedSupplier(null);
    setSupplierSearchQuery('');
    setIsAddingNewSupplier(false);
  };

  const handleAddNewSupplier = () => {
    setIsAddingNewSupplier(true);
    setShowSupplierDropdown(false);
    if (/^\d+$/.test(supplierSearchQuery)) {
      setNewSupplierPhone(supplierSearchQuery);
    } else if (supplierSearchQuery.trim()) {
      setNewSupplierName(supplierSearchQuery);
    }
    setSupplierSearchQuery('');
  };

  const handleDialogOpenChange = createSafeDialogOpenChange(onOpenChange, resetForm);

  return (
    <Dialog modal open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" onCloseAutoFocus={preventDialogAutoFocus}>
        <DialogHeader>
          <DialogTitle>
            {isCustomer ? 'Thêm công nợ khách hàng' : 'Thêm công nợ nhà cung cấp'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Branch */}
          <div className="space-y-2">
            <Label>Chi nhánh <span className="text-destructive">*</span></Label>
            {isSuperAdmin ? (
              <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                <SelectTrigger>
                  <Building2 className="h-4 w-4 mr-2 shrink-0" />
                  <SelectValue placeholder="Chọn chi nhánh" />
                </SelectTrigger>
                <SelectContent>
                  {branches?.map(branch => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={branches?.find(b => b.id === selectedBranchId)?.name || 'Chi nhánh của bạn'}
                disabled
                className="bg-muted"
              />
            )}
          </div>

          {/* Customer/Supplier Search */}
          {isCustomer ? (
            <CustomerSearchCombobox
              selectedCustomer={selectedCustomer}
              onSelect={setSelectedCustomer}
              onCustomerInfoChange={() => {}}
              customerName={customerName}
              customerPhone={customerPhone}
              customerAddress={customerAddress}
              customerEmail={customerEmail}
              customerSource={customerSource}
              customerBirthday={customerBirthday}
              setCustomerName={setCustomerName}
              setCustomerPhone={setCustomerPhone}
              setCustomerAddress={setCustomerAddress}
              setCustomerEmail={setCustomerEmail}
              setCustomerSource={setCustomerSource}
              setCustomerBirthday={setCustomerBirthday}
            />
          ) : (
            /* Supplier Search */
            selectedSupplier ? (
              <div className="p-3 rounded-xl bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 border-2 border-primary/30 relative">
                <button
                  type="button"
                  onClick={handleClearSupplier}
                  className="absolute top-2 right-2 p-1 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <Truck className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{selectedSupplier.name}</div>
                    {selectedSupplier.phone && (
                      <div className="text-sm text-muted-foreground">{selectedSupplier.phone}</div>
                    )}
                  </div>
                </div>
              </div>
            ) : isAddingNewSupplier ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium text-primary">
                    <Plus className="h-4 w-4" />
                    Thêm NCC mới
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAddingNewSupplier(false)}
                    className="h-7 text-xs"
                  >
                    ← Quay lại
                  </Button>
                </div>
                <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
                  <div>
                    <Label className="flex items-center gap-1 text-xs mb-1">
                      <User className="h-3 w-3" />
                      Tên NCC <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      placeholder="Nhập tên nhà cung cấp"
                      value={newSupplierName}
                      onChange={(e) => setNewSupplierName(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Label className="flex items-center gap-1 text-xs mb-1">
                      <Phone className="h-3 w-3" />
                      Số điện thoại
                    </Label>
                    <Input
                      placeholder="Nhập SĐT (tùy chọn)"
                      value={newSupplierPhone}
                      onChange={(e) => setNewSupplierPhone(e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 relative" ref={supplierSearchRef}>
                <div>
                  <Label className="flex items-center gap-1 mb-1.5">
                    <Search className="h-3.5 w-3.5" />
                    Nhà cung cấp
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Nhập tên hoặc SĐT nhà cung cấp..."
                      value={supplierSearchQuery}
                      onChange={(e) => setSupplierSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Nhập từ 2 ký tự để tìm. Nếu NCC mới, bấm "Thêm mới".
                  </p>
                </div>

                {showSupplierDropdown && filteredSuppliers.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 bg-popover border rounded-lg shadow-lg max-h-60 overflow-auto" style={{ top: '70px' }}>
                    {filteredSuppliers.map((s) => (
                      <button
                        type="button"
                        key={s.id}
                        className="w-full px-4 py-3 text-left hover:bg-accent flex items-center gap-2 border-b last:border-b-0"
                        onClick={() => handleSelectSupplier(s)}
                      >
                        <Truck className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <div className="font-medium truncate">{s.name}</div>
                          {s.phone && <div className="text-xs text-muted-foreground">{s.phone}</div>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddNewSupplier}
                  className="w-full border-dashed gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Thêm nhà cung cấp mới
                </Button>
              </div>
            )
          )}

          {/* Amount */}
          <div className="space-y-2">
            <Label>
              {isCustomer ? 'Số tiền khách nợ' : 'Số tiền mình nợ'} <span className="text-destructive">*</span>
            </Label>
            <PriceInput value={amount} onChange={setAmount} placeholder="Nhập số tiền" />
          </div>

          {/* Note */}
          <div className="space-y-2">
            <Label>Ghi chú</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Nội dung công nợ..."
              rows={2}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createDebtMutation.isPending}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={createDebtMutation.isPending}>
              {createDebtMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Lưu công nợ
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
