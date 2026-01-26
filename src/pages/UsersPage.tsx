import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Shield, Edit2, UserPlus } from 'lucide-react';
import { useBranches } from '@/hooks/useBranches';
import { usePermissions, UserRole } from '@/hooks/usePermissions';
import { EditUserDialog } from '@/components/users/EditUserDialog';
import { CreateUserDialog } from '@/components/users/CreateUserDialog';

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
  const { data: permissions } = usePermissions();
  const { data: branches } = useBranches();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ['users-with-roles', permissions?.role, permissions?.branchId],
    queryFn: async () => {
      let query = supabase
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

      if (permissions?.role === 'branch_admin' && permissions.branchId) {
        query = query.eq('branch_id', permissions.branchId);
      }

      const { data: rolesData, error: rolesError } = await query;

      if (rolesError) throw rolesError;

      const userIds = rolesData.map(r => r.user_id);
      if (userIds.length === 0) return [];
      
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
    enabled: !!permissions,
  });

  const handleEdit = (user: UserWithRole) => {
    setSelectedUser(user);
    setIsEditOpen(true);
  };

  if (!permissions?.canManageUsers && !permissions?.canManageBranchStaff) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">Bạn không có quyền truy cập trang này</p>
        </div>
      </MainLayout>
    );
  }

  const isSuperAdmin = permissions?.role === 'super_admin';
  const isBranchAdmin = permissions?.role === 'branch_admin';

  const canEditUser = (user: UserWithRole) => {
    if (user.user_role === 'super_admin') return false;
    if (isSuperAdmin) return true;
    if (isBranchAdmin && user.branch_id === permissions.branchId && user.user_role !== 'branch_admin') {
      return true;
    }
    return false;
  };

  return (
    <MainLayout>
      <PageHeader 
        title="Quản lý người dùng" 
        description="Phân quyền và quản lý tài khoản nhân viên"
      />

      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Danh sách người dùng
          </CardTitle>
          {isSuperAdmin && (
            <Button onClick={() => setIsCreateOpen(true)} size="sm" className="w-full sm:w-auto">
              <UserPlus className="h-4 w-4 mr-2" />
              Tạo tài khoản
            </Button>
          )}
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Đang tải...</div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block">
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
                          {canEditUser(user) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(user)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card List */}
              <div className="md:hidden space-y-3">
                {users?.map((user) => (
                  <div 
                    key={user.id} 
                    className="bg-card border rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">
                          {user.profiles?.display_name || 'Chưa cập nhật'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {user.profiles?.phone || 'Chưa có SĐT'}
                        </p>
                      </div>
                      {canEditUser(user) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(user)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={roleColors[user.user_role]}>
                        {roleLabels[user.user_role]}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {user.user_role === 'super_admin' 
                          ? 'Tất cả chi nhánh'
                          : user.branches?.name || 'Chưa gán chi nhánh'
                        }
                      </span>
                    </div>
                  </div>
                ))}
                {users?.length === 0 && (
                  <p className="text-center py-8 text-muted-foreground">Không có người dùng nào</p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <EditUserDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        user={selectedUser}
        branches={branches}
        isSuperAdmin={isSuperAdmin}
      />

      <CreateUserDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        branches={branches}
      />
    </MainLayout>
  );
}
