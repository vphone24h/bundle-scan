import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Shield, Edit2, UserPlus, Info, ChevronDown, ChevronUp, Star, ExternalLink } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useBranches } from '@/hooks/useBranches';
import { usePermissions, UserRole } from '@/hooks/usePermissions';
import { EditUserDialog } from '@/components/users/EditUserDialog';
import { CreateUserDialog } from '@/components/users/CreateUserDialog';
import { StaffReviewsTab } from '@/components/users/StaffReviewsTab';
import { useCurrentTenant } from '@/hooks/useTenant';
import { useUsersGuideUrl } from '@/hooks/useAppConfig';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';

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
  platform_user: {
    email: string | null;
  } | null;
  branches: {
    name: string;
  } | null;
}

const roleLabels: Record<UserRole, string> = {
  super_admin: 'Admin Tổng',
  branch_admin: 'Admin Chi nhánh',
  staff: 'Nhân viên',
  cashier: 'Kế toán',
};

const roleColors: Record<UserRole, string> = {
  super_admin: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  branch_admin: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  staff: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  cashier: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};

const roleDescriptions: Record<UserRole, { title: string; permissions: string[] }> = {
  super_admin: {
    title: 'Quyền cao nhất - Quản trị toàn bộ hệ thống',
    permissions: [
      '✅ Xem tất cả chi nhánh',
      '✅ Tạo/sửa/xóa tài khoản nhân viên',
      '✅ Quản lý chi nhánh (tạo/sửa/xóa)',
      '✅ Nhập hàng, xuất hàng',
      '✅ Xem báo cáo, sổ quỹ, giá nhập',
      '✅ Xem lịch sử thao tác (Audit Log)',
      '✅ Quản lý sản phẩm, danh mục, NCC, khách hàng',
      '✅ Điều chỉnh số lượng tồn kho',
      '✅ Xóa sản phẩm có IMEI',
    ],
  },
  branch_admin: {
    title: 'Quản lý một chi nhánh được gán',
    permissions: [
      '✅ Quản lý nhân viên trong chi nhánh',
      '✅ Nhập hàng, xuất hàng',
      '✅ Xem báo cáo, sổ quỹ chi nhánh',
      '✅ Xem giá nhập, lịch sử thao tác',
      '✅ Quản lý sản phẩm, danh mục, NCC, khách hàng',
      '❌ Không xem chi nhánh khác',
      '❌ Không tạo tài khoản mới',
      '❌ Không điều chỉnh số lượng tồn kho',
      '❌ Không xóa sản phẩm có IMEI',
    ],
  },
  staff: {
    title: 'Nhân viên bán hàng / kỹ thuật',
    permissions: [
      '✅ Xem sản phẩm, tồn kho chi nhánh',
      '✅ Xuất hàng (bán hàng)',
      '✅ Thêm khách hàng khi bán',
      '❌ Không nhập hàng',
      '❌ Không xem báo cáo, sổ quỹ',
      '❌ Không xem giá nhập',
      '❌ Không quản lý sản phẩm, danh mục',
      '❌ Không xem lịch sử thao tác',
    ],
  },
  cashier: {
    title: 'Kế toán - Phụ trách sổ sách & báo cáo tài chính',
    permissions: [
      '✅ Xem Dashboard (doanh thu, chi phí, lợi nhuận, công nợ)',
      '✅ Xem lịch sử bán hàng (chỉ xem, không tạo đơn)',
      '✅ Xem lịch sử nhập hàng, giá nhập, NCC, công nợ NCC',
      '✅ Xem tồn kho, giá vốn, kiểm kho',
      '✅ Xem/tạo sổ quỹ (thu-chi, đối soát)',
      '✅ Xem/quản lý công nợ khách hàng & NCC',
      '✅ Hoá đơn điện tử (tạo, tra cứu)',
      '✅ Xem tất cả báo cáo (doanh thu, chi phí, lãi lỗ, thuế, tồn kho)',
      '❌ Không tạo phiếu nhập/xuất',
      '❌ Không sửa giá bán, sửa/xóa sản phẩm',
      '❌ Không quản lý người dùng, chi nhánh, danh mục',
      '❌ Không chỉnh tồn kho trực tiếp',
    ],
  },
};

export default function UsersPage() {
  const { t } = useTranslation();
  const { data: permissions } = usePermissions();
  const { data: branches } = useBranches();
  const { data: currentTenant } = useCurrentTenant();
  const usersGuideUrl = useUsersGuideUrl();
  const { user } = useAuth();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [isRoleDescOpen, setIsRoleDescOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('users');

  const { data: users, isLoading } = useQuery({
    queryKey: ['users-with-roles', currentTenant?.id, permissions?.role, permissions?.branchId],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      let query = supabase
        .from('user_roles')
        .select(`
          id,
          user_id,
          user_role,
          branch_id,
          tenant_id,
          created_at,
          branches(name)
        `)
        .or(`tenant_id.eq.${currentTenant.id},tenant_id.is.null`)
        .order('created_at', { ascending: false });

      const { data: rolesData, error: rolesError } = await query;

      if (rolesError) throw rolesError;

      let filteredRoles = rolesData || [];
      if (permissions?.role === 'branch_admin') {
        filteredRoles = filteredRoles.filter(r => 
          r.user_role !== 'super_admin' && 
          r.branch_id === permissions.branchId
        );
      }

      const userIds = filteredRoles.map(r => r.user_id);
      if (userIds.length === 0) return [];
      
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name, phone')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      const { data: platformUsersData, error: platformUsersError } = await supabase
        .from('platform_users')
        .select('user_id, email')
        .eq('tenant_id', currentTenant.id)
        .in('user_id', userIds);

      if (platformUsersError) throw platformUsersError;

      const profilesMap = new Map(profilesData.map(p => [p.user_id, p]));
      const platformUsersMap = new Map(platformUsersData.map(p => [p.user_id, p]));

      return filteredRoles.map(role => ({
        ...role,
        profiles: profilesMap.get(role.user_id) || null,
        platform_user: platformUsersMap.get(role.user_id) || null,
      })) as unknown as UserWithRole[];
    },
    enabled: !!permissions && !!currentTenant?.id,
  });

  const handleEdit = (user: UserWithRole) => {
    setSelectedUser(user);
    setIsEditOpen(true);
  };

  const isStaffOnly = !permissions?.canManageUsers && !permissions?.canManageBranchStaff;
  const effectiveTab = isStaffOnly ? 'reviews' : activeTab;

  useEffect(() => {
    if (effectiveTab === 'reviews' && user?.id) {
      localStorage.setItem(`reviews_last_viewed_${user.id}`, new Date().toISOString());
    }
  }, [effectiveTab, user?.id]);

  const isSuperAdmin = permissions?.role === 'super_admin';

  const canEditUser = (user: UserWithRole) => {
    if (user.user_role === 'super_admin') return false;
    if (isSuperAdmin) return true;
    return false;
  };

  return (
    <MainLayout>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <PageHeader 
          title={isStaffOnly ? t('pages.users.staffReviewsTitle') : t('pages.users.title')}
          description={isStaffOnly ? t('pages.users.staffReviewsDesc') : t('pages.users.description')}
          helpText={isStaffOnly ? t('pages.users.staffReviewsHelp') : t('pages.users.helpText')}
        />
        {usersGuideUrl && !isStaffOnly && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(usersGuideUrl, '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-1.5" />
            Hướng dẫn
          </Button>
        )}
      </div>

      <Tabs value={effectiveTab} onValueChange={setActiveTab} className="space-y-4">
        {!isStaffOnly && (
          <TabsList>
            <TabsTrigger value="users" className="flex items-center gap-1.5">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Danh sách</span>
            </TabsTrigger>
            <TabsTrigger value="reviews" className="flex items-center gap-1.5">
              <Star className="h-4 w-4" />
              <span className="hidden sm:inline">Đánh giá</span>
            </TabsTrigger>
          </TabsList>
        )}

        <TabsContent value="users" className="space-y-4">
          {/* Role Description Section */}
          <Collapsible open={isRoleDescOpen} onOpenChange={setIsRoleDescOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <CardTitle className="flex items-center justify-between text-base">
                    <div className="flex items-center gap-2">
                      <Info className="h-5 w-5 text-primary" />
                      <span>Mô tả chức năng từng loại tài khoản</span>
                    </div>
                    {isRoleDescOpen ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="grid gap-4 md:grid-cols-2">
                    {(Object.entries(roleDescriptions) as [UserRole, typeof roleDescriptions[UserRole]][]).map(([role, desc]) => (
                      <div 
                        key={role} 
                        className="border rounded-lg p-4 bg-card hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={roleColors[role]}>
                            {roleLabels[role]}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium text-foreground mb-3">{desc.title}</p>
                        <ul className="text-xs space-y-1">
                          {desc.permissions.map((perm, idx) => (
                            <li 
                              key={idx} 
                              className={perm.startsWith('✅') ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}
                            >
                              {perm}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

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
                          <TableHead>Email</TableHead>
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
                            <TableCell className="text-muted-foreground">
                              {user.platform_user?.email || '-'}
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
                            <p className="text-sm text-muted-foreground truncate">
                              {user.platform_user?.email || 'Chưa có email'}
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
        </TabsContent>

        <TabsContent value="reviews">
          <StaffReviewsTab />
        </TabsContent>
      </Tabs>

      <EditUserDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        user={selectedUser}
        branches={branches}
        isSuperAdmin={isSuperAdmin}
        tenantId={currentTenant?.id || null}
      />

      <CreateUserDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        branches={branches}
      />
    </MainLayout>
  );
}
