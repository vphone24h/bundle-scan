import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { UserRole } from '@/hooks/usePermissions';

interface Branch {
  id: string;
  name: string;
}

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches: Branch[] | undefined;
}

export function CreateUserDialog({
  open,
  onOpenChange,
  branches,
}: CreateUserDialogProps) {
  const queryClient = useQueryClient();
  
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('staff');
  const [newBranchId, setNewBranchId] = useState<string>('');

  const resetForm = () => {
    setNewEmail('');
    setNewPassword('');
    setNewDisplayName('');
    setNewPhone('');
    setNewRole('staff');
    setNewBranchId('');
  };

  const createUser = useMutation({
    mutationFn: async () => {
      const response = await supabase.functions.invoke('create-user', {
        body: {
          email: newEmail,
          password: newPassword,
          displayName: newDisplayName,
          phone: newPhone,
          role: newRole,
          branchId: newRole === 'super_admin' ? null : newBranchId,
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast.success('Tạo tài khoản thành công');
      onOpenChange(false);
      resetForm();
    },
    onError: (error) => {
      toast.error('Lỗi: ' + (error as Error).message);
    },
  });

  const handleCreateUser = () => {
    if (!newEmail || !newPassword || !newDisplayName) {
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }

    if (newRole !== 'super_admin' && !newBranchId) {
      toast.error('Vui lòng chọn chi nhánh cho tài khoản này');
      return;
    }

    createUser.mutate();
  };

  const handleOpenChange = (open: boolean) => {
    onOpenChange(open);
    if (!open) resetForm();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tạo tài khoản mới</DialogTitle>
          <DialogDescription>
            Tạo tài khoản cho nhân viên hoặc quản lý
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Email <span className="text-destructive">*</span></Label>
            <Input
              type="email"
              placeholder="email@example.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Mật khẩu <span className="text-destructive">*</span></Label>
            <Input
              type="password"
              placeholder="Tối thiểu 6 ký tự"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Tên hiển thị <span className="text-destructive">*</span></Label>
            <Input
              placeholder="Nguyễn Văn A"
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Số điện thoại</Label>
            <Input
              placeholder="0901234567"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Vai trò <span className="text-destructive">*</span></Label>
            <Select value={newRole} onValueChange={(v) => setNewRole(v as UserRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="branch_admin">Admin Chi nhánh</SelectItem>
                <SelectItem value="cashier">Thu ngân</SelectItem>
                <SelectItem value="staff">Nhân viên</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {newRole !== 'super_admin' && (
            <div className="space-y-2">
              <Label>Chi nhánh <span className="text-destructive">*</span></Label>
              <Select value={newBranchId} onValueChange={setNewBranchId}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn chi nhánh" />
                </SelectTrigger>
                <SelectContent>
                  {branches?.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button onClick={handleCreateUser} disabled={createUser.isPending}>
            {createUser.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Tạo tài khoản
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
