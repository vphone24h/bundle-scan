import { useState, useEffect } from 'react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, Trash2, Eye } from 'lucide-react';
import { UserRole } from '@/hooks/usePermissions';
import { useUserBranchAccess, useManageBranchAccess } from '@/hooks/useUserBranchAccess';

interface Branch {
  id: string;
  name: string;
}

interface UserWithRole {
  id: string;
  user_id: string;
  user_role: UserRole;
  branch_id: string | null;
  created_at: string;
  profiles: {
    display_name: string;
    phone: string | null;
  } | null;
  platform_user?: {
    email: string | null;
  } | null;
  branches: {
    name: string;
  } | null;
}

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserWithRole | null;
  branches: Branch[] | undefined;
  isSuperAdmin: boolean;
  tenantId?: string | null;
}

export function EditUserDialog({
  open,
  onOpenChange,
  user,
  branches,
  isSuperAdmin,
  tenantId,
}: EditUserDialogProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('role');
  
  // Role tab state
  const [editRole, setEditRole] = useState<UserRole>('staff');
  const [editBranchId, setEditBranchId] = useState<string>('');
  
  // Info tab state
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  useEffect(() => {
    if (user) {
      setEditRole(user.user_role);
      setEditBranchId(user.branch_id || '');
      setEditDisplayName(user.profiles?.display_name || '');
      setEditPhone(user.profiles?.phone || '');
      setEditEmail('');
      setEditPassword('');
      setActiveTab('role');
    }
  }, [user]);

  const updateUserRole = useMutation({
    mutationFn: async ({ userId, role, branchId }: { userId: string; role: UserRole; branchId: string | null }) => {
      const updates = {
        user_role: role,
        branch_id: role === 'super_admin' ? null : branchId,
      } as Record<string, unknown>;

      // 1) Prefer updating the row in the current tenant
      if (tenantId) {
        const { data: updatedRows, error } = await supabase
          .from('user_roles')
          .update(updates)
          .eq('user_id', userId)
          .eq('tenant_id', tenantId)
          .select('id');

        if (error) throw error;

        // 2) If nothing was updated, this is likely a legacy row with tenant_id = NULL.
        //    Update it and also attach tenant_id so it won't "revert" on reload.
        if (!updatedRows || updatedRows.length === 0) {
          const { error: legacyError } = await supabase
            .from('user_roles')
            .update({ ...updates, tenant_id: tenantId })
            .eq('user_id', userId)
            .is('tenant_id', null);

          if (legacyError) throw legacyError;
        }

        return;
      }

      // Fallback (should be rare): no tenantId available
      const { error } = await supabase
        .from('user_roles')
        .update(updates)
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast.success('Cập nhật quyền thành công');
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error('Lỗi: ' + (error as Error).message);
    },
  });

  const updateUserInfo = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('No user selected');

      const body: Record<string, string> = { userId: user.user_id };
      
      if (editEmail.trim()) body.email = editEmail.trim();
      if (editPassword.trim()) body.password = editPassword.trim();
      if (editDisplayName.trim() && editDisplayName !== user.profiles?.display_name) {
        body.displayName = editDisplayName.trim();
      }
      if (editPhone !== (user.profiles?.phone || '')) {
        body.phone = editPhone.trim();
      }

      // Check if there are any updates
      if (Object.keys(body).length === 1) {
        throw new Error('Không có thay đổi nào');
      }

      const response = await supabase.functions.invoke('update-user', { body });

      // Check specific error from function response body first
      if (response.data?.error) throw new Error(response.data.error);
      // Then check generic invoke error  
      if (response.error) {
        // Try to extract specific error from response
        const errorMsg = response.error.message || 'Lỗi không xác định';
        throw new Error(errorMsg);
      }
      
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast.success('Cập nhật thông tin thành công');
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error('Lỗi: ' + (error as Error).message);
    },
  });

  const deleteUser = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('No user selected');

      const response = await supabase.functions.invoke('delete-user', {
        body: { userId: user.user_id },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast.success(data?.message || 'Xóa người dùng thành công');
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error('Lỗi: ' + (error as Error).message);
    },
  });

  const handleSaveRole = () => {
    if (!user) return;

    if (editRole !== 'super_admin' && !editBranchId) {
      toast.error('Vui lòng chọn chi nhánh cho tài khoản này');
      return;
    }

    updateUserRole.mutate({
      userId: user.user_id,
      role: editRole,
      branchId: editRole === 'super_admin' ? null : editBranchId,
    });
  };

  const handleSaveInfo = () => {
    if (!user) return;

    if (editPassword && editPassword.length < 6) {
      toast.error('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }

    updateUserInfo.mutate();
  };

  const handleDeleteUser = () => {
    deleteUser.mutate();
  };

  const isLoading = updateUserRole.isPending || updateUserInfo.isPending || deleteUser.isPending;

  // Branch access management
  const { data: branchAccess, isLoading: branchAccessLoading } = useUserBranchAccess(user?.user_id || null);
  const { grantAccess, revokeAccess } = useManageBranchAccess();

  // Get list of extra branch IDs this user can access
  const extraBranchIds = new Set((branchAccess || []).map(ba => ba.branch_id));

  const handleToggleBranch = async (branchId: string, checked: boolean) => {
    if (!user || !tenantId) return;

    try {
      if (checked) {
        await grantAccess.mutateAsync({ userId: user.user_id, branchId, tenantId });
        toast.success('Đã cấp quyền xem chi nhánh');
      } else {
        await revokeAccess.mutateAsync({ userId: user.user_id, branchId });
        toast.success('Đã thu hồi quyền xem chi nhánh');
      }
    } catch (error) {
      toast.error('Lỗi: ' + (error as Error).message);
    }
  };

  // Filter branches for the access tab: exclude the user's assigned branch
  const otherBranches = branches?.filter(b => b.id !== user?.branch_id) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa tài khoản</DialogTitle>
          <DialogDescription>
            {user?.profiles?.display_name}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className={`grid w-full ${isSuperAdmin && user?.user_role !== 'super_admin' ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <TabsTrigger value="role">Quyền hạn</TabsTrigger>
            {isSuperAdmin && user?.user_role !== 'super_admin' && (
              <TabsTrigger value="branch-access" className="gap-1">
                <Eye className="h-3 w-3" />
                Xem chi nhánh
              </TabsTrigger>
            )}
            {isSuperAdmin && <TabsTrigger value="info">Thông tin</TabsTrigger>}
          </TabsList>

          <TabsContent value="role" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Vai trò</Label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as UserRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="branch_admin">Admin Chi nhánh</SelectItem>
                  <SelectItem value="cashier">Kế toán</SelectItem>
                  <SelectItem value="staff">Nhân viên</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editRole !== 'super_admin' && (
              <div className="space-y-2">
                <Label>Chi nhánh</Label>
                <Select value={editBranchId} onValueChange={setEditBranchId}>
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

            <DialogFooter className="pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Hủy
              </Button>
              <Button onClick={handleSaveRole} disabled={isLoading}>
                {updateUserRole.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Lưu quyền
              </Button>
            </DialogFooter>
          </TabsContent>

          {/* Tab xem chi nhánh bổ sung */}
          {isSuperAdmin && user?.user_role !== 'super_admin' && (
            <TabsContent value="branch-access" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Chi nhánh chính</Label>
                <p className="text-sm text-muted-foreground px-2 py-1.5 bg-muted rounded">
                  {user?.branches?.name || 'Chưa gán'}
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Cho phép xem thêm chi nhánh</Label>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs text-muted-foreground">
                    Tích vào chi nhánh để nhân viên xem được tồn kho chi nhánh đó
                  </p>
                  <Badge variant="secondary" className="text-[10px] whitespace-nowrap shrink-0">
                    Tự động lưu
                  </Badge>
                </div>

                {branchAccessLoading ? (
                  <div className="text-center py-4 text-muted-foreground text-sm">Đang tải...</div>
                ) : otherBranches.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">Không có chi nhánh nào khác</p>
                ) : (
                  <div className="space-y-3 max-h-48 overflow-y-auto">
                    {otherBranches.map((branch) => {
                      const isGranted = extraBranchIds.has(branch.id);
                      const isPending = grantAccess.isPending || revokeAccess.isPending;

                      return (
                        <div key={branch.id} className="flex items-center space-x-3 px-2 py-1.5 rounded hover:bg-muted/50">
                          <Checkbox
                            id={`branch-${branch.id}`}
                            checked={isGranted}
                            disabled={isPending}
                            onCheckedChange={(checked) => handleToggleBranch(branch.id, !!checked)}
                          />
                          <label
                            htmlFor={`branch-${branch.id}`}
                            className="text-sm font-medium leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-1"
                          >
                            {branch.name}
                          </label>
                          {isPending && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <DialogFooter className="pt-4">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Đóng
                </Button>
              </DialogFooter>
            </TabsContent>
          )}

          {isSuperAdmin && (
            <TabsContent value="info" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Tên hiển thị</Label>
                <Input
                  placeholder="Nguyễn Văn A"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Số điện thoại</Label>
                <Input
                  placeholder="0901234567"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Email hiện tại</Label>
                <Input
                  value={user?.platform_user?.email || 'Không có email'}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2">
                <Label>Email mới</Label>
                <Input
                  type="email"
                  placeholder="Để trống nếu không đổi"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Mật khẩu mới</Label>
                <Input
                  type="password"
                  placeholder="Để trống nếu không đổi"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                />
              </div>

              <DialogFooter className="pt-4 flex-col sm:flex-row gap-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full sm:w-auto" disabled={isLoading}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Xóa
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Xác nhận xóa người dùng</AlertDialogTitle>
                      <AlertDialogDescription>
                        Bạn có chắc chắn muốn xóa tài khoản <strong>{user?.profiles?.display_name}</strong>? 
                        Hành động này không thể hoàn tác.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Hủy</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleDeleteUser}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deleteUser.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Xóa người dùng
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-initial">
                    Hủy
                  </Button>
                  <Button onClick={handleSaveInfo} disabled={isLoading} className="flex-1 sm:flex-initial">
                    {updateUserInfo.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Lưu thông tin
                  </Button>
                </div>
              </DialogFooter>
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
