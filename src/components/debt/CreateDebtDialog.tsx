import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PriceInput } from '@/components/ui/price-input';
import { CalendarIcon, Loader2, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import { useBranches } from '@/hooks/useBranches';

interface CreateDebtDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: 'customer' | 'supplier';
}

// Helper to get current user's tenant_id
async function getCurrentTenantId(): Promise<string | null> {
  const { data } = await supabase.rpc('get_user_tenant_id_secure');
  return data;
}

export function CreateDebtDialog({
  open,
  onOpenChange,
  entityType,
}: CreateDebtDialogProps) {
  const queryClient = useQueryClient();
  const { data: permissions } = usePermissions();
  const { data: branches } = useBranches();
  const isSuperAdmin = permissions?.canViewAllBranches === true;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [birthday, setBirthday] = useState<Date | undefined>();
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');

  const isCustomer = entityType === 'customer';

  // Auto-set branch for non-super-admin
  useEffect(() => {
    if (!isSuperAdmin && permissions?.branchId) {
      setSelectedBranchId(permissions.branchId);
    }
  }, [isSuperAdmin, permissions?.branchId]);

  // Reset branch when dialog opens for super admin (pick default)
  useEffect(() => {
    if (open && isSuperAdmin && branches?.length && !selectedBranchId) {
      const defaultBranch = branches.find(b => b.is_default);
      if (defaultBranch) setSelectedBranchId(defaultBranch.id);
    }
  }, [open, isSuperAdmin, branches, selectedBranchId]);

  const createDebtMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error('Vui lòng nhập tên');
      if (!phone.trim() && isCustomer) throw new Error('Vui lòng nhập số điện thoại');
      if (amount <= 0) throw new Error('Vui lòng nhập số tiền nợ');
      if (!selectedBranchId) throw new Error('Vui lòng chọn chi nhánh');

      const tenantId = await getCurrentTenantId();
      if (!tenantId) throw new Error('Không tìm thấy tenant');

      const { data: { user } } = await supabase.auth.getUser();

      let entityId: string;

      if (isCustomer) {
        // Check if customer already exists by phone
        const { data: existingCustomer } = await supabase
          .from('customers')
          .select('id')
          .eq('phone', phone.trim())
          .eq('tenant_id', tenantId)
          .single();

        if (existingCustomer) {
          entityId = existingCustomer.id;
        } else {
          // Create new customer
          const { data: newCustomer, error: customerError } = await supabase
            .from('customers')
            .insert([{
              name: name.trim(),
              phone: phone.trim(),
              email: email.trim() || null,
              birthday: birthday ? format(birthday, 'yyyy-MM-dd') : null,
              source: 'Công nợ',
              crm_status: 'new',
              tenant_id: tenantId,
              preferred_branch_id: selectedBranchId,
            }])
            .select('id')
            .single();

          if (customerError) throw customerError;
          entityId = newCustomer.id;
        }
      } else {
        // Check if supplier already exists by name/phone
        let query = supabase
          .from('suppliers')
          .select('id')
          .eq('name', name.trim())
          .eq('tenant_id', tenantId);
        
        if (phone.trim()) {
          query = query.eq('phone', phone.trim());
        }

        const { data: existingSupplier } = await query.single();

        if (existingSupplier) {
          entityId = existingSupplier.id;
        } else {
          // Create new supplier with branch
          const { data: newSupplier, error: supplierError } = await supabase
            .from('suppliers')
            .insert([{
              name: name.trim(),
              phone: phone.trim() || null,
              note: email.trim() ? `Email: ${email.trim()}` : null,
              tenant_id: tenantId,
              branch_id: selectedBranchId,
            }])
            .select('id')
            .single();

          if (supplierError) throw supplierError;
          entityId = newSupplier.id;
        }
      }

      // Create debt payment record (as addition type)
      const { error: debtError } = await supabase
        .from('debt_payments')
        .insert([{
          entity_type: entityType,
          entity_id: entityId,
          payment_type: 'addition',
          amount: amount,
          description: note.trim() || (isCustomer ? 'Công nợ khách hàng mới' : 'Công nợ nhà cung cấp mới'),
          created_by: user?.id,
          tenant_id: tenantId,
          branch_id: selectedBranchId,
        }]);

      if (debtError) throw debtError;

      // Audit log
      await supabase.from('audit_logs').insert([{
        user_id: user?.id,
        action_type: 'create',
        table_name: 'debt_payments',
        branch_id: selectedBranchId,
        description: `Thêm công nợ mới: ${name.trim()} - ${amount.toLocaleString('vi-VN')}đ`,
      }]);

      return { entityId, name: name.trim() };
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
    setName('');
    setPhone('');
    setEmail('');
    setBirthday(undefined);
    setAmount(0);
    setNote('');
    if (isSuperAdmin) {
      setSelectedBranchId('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createDebtMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => {
      if (!o) resetForm();
      onOpenChange(o);
    }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isCustomer ? 'Thêm công nợ khách hàng' : 'Thêm công nợ nhà cung cấp'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Branch selector - Super Admin sees dropdown, others see label */}
          <div className="space-y-2">
            <Label>
              Chi nhánh <span className="text-destructive">*</span>
            </Label>
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

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">
              {isCustomer ? 'Tên khách hàng' : 'Tên nhà cung cấp'} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isCustomer ? 'Nhập tên khách hàng' : 'Nhập tên nhà cung cấp'}
              required
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone">
              Số điện thoại {isCustomer && <span className="text-destructive">*</span>}
            </Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Nhập số điện thoại"
              required={isCustomer}
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Nhập email (không bắt buộc)"
            />
          </div>

          {/* Birthday */}
          <div className="space-y-2">
            <Label>Ngày sinh</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !birthday && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {birthday ? format(birthday, 'dd/MM/yyyy', { locale: vi }) : 'Chọn ngày sinh'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={birthday}
                  onSelect={setBirthday}
                  disabled={(date) => date > new Date()}
                  initialFocus
                  captionLayout="dropdown-buttons"
                  fromYear={1940}
                  toYear={new Date().getFullYear()}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">
              {isCustomer ? 'Số tiền khách nợ' : 'Số tiền mình nợ'} <span className="text-destructive">*</span>
            </Label>
            <PriceInput
              value={amount}
              onChange={setAmount}
              placeholder="Nhập số tiền"
            />
          </div>

          {/* Note */}
          <div className="space-y-2">
            <Label htmlFor="note">Ghi chú</Label>
            <Textarea
              id="note"
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
