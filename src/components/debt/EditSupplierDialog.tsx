import { useState, useEffect } from 'react';
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
import { Loader2 } from 'lucide-react';

interface EditSupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplierId: string;
  supplierName: string;
  supplierPhone: string | null;
  supplierNote?: string | null;
  branchName?: string | null;
}

export function EditSupplierDialog({
  open,
  onOpenChange,
  supplierId,
  supplierName,
  supplierPhone,
  supplierNote,
  branchName,
}: EditSupplierDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(supplierName);
  const [phone, setPhone] = useState(supplierPhone || '');
  const [note, setNote] = useState('');
  const [loadingNote, setLoadingNote] = useState(false);

  // Load full supplier data when dialog opens
  useEffect(() => {
    if (open && supplierId) {
      setName(supplierName);
      setPhone(supplierPhone || '');
      setLoadingNote(true);
      supabase
        .from('suppliers')
        .select('note')
        .eq('id', supplierId)
        .single()
        .then(({ data }) => {
          setNote(data?.note || '');
          setLoadingNote(false);
        });
    }
  }, [open, supplierId, supplierName, supplierPhone]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error('Vui lòng nhập tên nhà cung cấp');

      const { error } = await supabase
        .from('suppliers')
        .update({
          name: name.trim(),
          phone: phone.trim() || null,
          note: note.trim() || null,
        })
        .eq('id', supplierId);

      if (error) throw error;

      // Audit log
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('audit_logs').insert([{
        user_id: user?.id,
        action_type: 'update',
        table_name: 'suppliers',
        record_id: supplierId,
        description: `Sửa NCC: ${supplierName} → ${name.trim()}`,
      }]);
    },
    onSuccess: () => {
      toast.success('Đã cập nhật nhà cung cấp');
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-debts'] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Có lỗi xảy ra');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Sửa nhà cung cấp</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Branch - read only */}
          <div className="space-y-2">
            <Label>Chi nhánh</Label>
            <Input
              value={branchName || 'Chưa phân chi nhánh'}
              disabled
              className="bg-muted"
            />
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="edit-supplier-name">
              Tên nhà cung cấp <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-supplier-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nhập tên nhà cung cấp"
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="edit-supplier-phone">Số điện thoại</Label>
            <Input
              id="edit-supplier-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Nhập số điện thoại"
            />
          </div>

          {/* Note */}
          <div className="space-y-2">
            <Label htmlFor="edit-supplier-note">Ghi chú</Label>
            <Textarea
              id="edit-supplier-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ghi chú..."
              rows={3}
              disabled={loadingNote}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={updateMutation.isPending}>
            Hủy
          </Button>
          <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
            {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Lưu thay đổi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
