import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Shield, Edit2, UserPlus, Loader2 } from 'lucide-react';
import { useBranches } from '@/hooks/useBranches';
import { usePermissions, UserRole } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';

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
  branches: {
    name: string;
  } | null;
}

const roleLabels: Record<UserRole, string> = {
  super_admin: 'Admin Tổng',
  branch_admin: 'Admin Chi nhánh',
  staff: 'Nhân viên',
  cashier: 'Thu ngân',
};

const roleColors: Record<UserRole, string> = {
  super_admin: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  branch_admin: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  staff: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  cashier: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};

export default function UsersPage() {
  const queryClient = useQueryClient();
  const { data: permissions } = usePermissions();
  const { data: branches } = useBranches();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [editRole, setEditRole] = useState<UserRole>('staff');
  const [editBranchId, setEditBranchId] = useState<string>('');
  
  // Create user form state
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('staff');
  const [newBranchId, setNewBranchId] = useState<string>('');

  const { data: users, isLoading } = useQuery({
    queryKey: ['users-with-roles'],
    queryFn: async () => {
      // Lấy user_roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select(`
          id,
          user_id,
          user_role,
          branch_id,
          created_at,
          branches(name)
        `)
        .order('created_at', { ascending: false });

      if (rolesError) throw rolesError;

      // Lấy profiles riêng
      const userIds = rolesData.map(r => r.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name, phone')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      const profilesMap = new Map(profilesData.map(p => [p.user_id, p]));

      return rolesData.map(role => ({
        ...role,
        profiles: profilesMap.get(role.user_id) || null,
      })) as unknown as UserWithRole[];
    },
  });

  const updateUserRole = useMutation({
    mutationFn: async ({ userId, role, branchId }: { userId: string; role: UserRole; branchId: string | null }) => {
      const { error } = await supabase
        .from('user_roles')
        .update({ 
          user_role: role, 
          branch_id: role === 'super_admin' ? null : branchId 
        })
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast.success('Cập nhật quyền thành công');
      setIsEditOpen(false);
    },
    onError: (error) => {
      toast.error('Lỗi: ' + (error as Error).message);
    },
  });

  const createUser = useMutation({
    mutationFn: async () => {
      // 1. Create auth user using admin API via edge function
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
      setIsCreateOpen(false);
      resetCreateForm();
    },
    onError: (error) => {
      toast.error('Lỗi: ' + (error as Error).message);
    },
  });

  const resetCreateForm = () => {
    setNewEmail('');
    setNewPassword('');
    setNewDisplayName('');
    setNewPhone('');
    setNewRole('staff');
    setNewBranchId('');
  };

  const handleEdit = (user: UserWithRole) => {
    setSelectedUser(user);
    setEditRole(user.user_role);
    setEditBranchId(user.branch_id || '');
    setIsEditOpen(true);
  };

  const handleSave = () => {
    if (!selectedUser) return;

    if (editRole !== 'super_admin' && !editBranchId) {
      toast.error('Vui lòng chọn chi nhánh cho tài khoản này');
      return;
    }

    updateUserRole.mutate({
      userId: selectedUser.user_id,
      role: editRole,
      branchId: editRole === 'super_admin' ? null : editBranchId,
    });
  };

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

  if (!permissions?.canManageUsers) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">Bạn không có quyền truy cập trang này</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageHeader 
        title="Quản lý người dùng" 
        description="Phân quyền và quản lý tài khoản nhân viên"
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Danh sách người dùng
          </CardTitle>
          {permissions?.role === 'super_admin' && (
            <Button onClick={() => setIsCreateOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Tạo tài khoản
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Đang tải...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tên</TableHead>
                  <TableHead>SĐT</TableHead>
                  <TableHead>Vai trò</TableHead>
                  <TableHead>Chi nhánh</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.profiles?.display_name || 'Chưa cập nhật'}
                    </TableCell>
                    <TableCell>{user.profiles?.phone || '-'}</TableCell>
                    <TableCell>
                      <Badge className={roleColors[user.user_role]}>
                        {roleLabels[user.user_role]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.user_role === 'super_admin' 
                        ? <span className="text-muted-foreground italic">Tất cả</span>
                        : user.branches?.name || <span className="text-destructive">Chưa gán</span>
                      }
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(user)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chỉnh sửa quyền</DialogTitle>
            <DialogDescription>
              Cập nhật vai trò và chi nhánh cho {selectedUser?.profiles?.display_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Vai trò</Label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as UserRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">Admin Tổng</SelectItem>
                  <SelectItem value="branch_admin">Admin Chi nhánh</SelectItem>
                  <SelectItem value="cashier">Thu ngân</SelectItem>
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleSave} disabled={updateUserRole.isPending}>
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => {
        setIsCreateOpen(open);
        if (!open) resetCreateForm();
      }}>
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
                  <SelectItem value="super_admin">Admin Tổng</SelectItem>
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
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleCreateUser} disabled={createUser.isPending}>
              {createUser.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Tạo tài khoản
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
