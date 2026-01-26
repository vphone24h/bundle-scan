import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';
import { useBranches } from '@/hooks/useBranches';
import { Search, History, Filter, User, Clock } from 'lucide-react';

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  create: { label: 'Tạo mới', color: 'bg-green-500' },
  update: { label: 'Cập nhật', color: 'bg-blue-500' },
  delete: { label: 'Xóa', color: 'bg-red-500' },
  view: { label: 'Xem', color: 'bg-gray-500' },
  login: { label: 'Đăng nhập', color: 'bg-purple-500' },
  logout: { label: 'Đăng xuất', color: 'bg-orange-500' },
};

const TABLE_LABELS: Record<string, string> = {
  products: 'Sản phẩm',
  categories: 'Danh mục',
  suppliers: 'Nhà cung cấp',
  customers: 'Khách hàng',
  import_receipts: 'Phiếu nhập',
  export_receipts: 'Phiếu xuất',
  cash_book: 'Sổ quỹ',
  branches: 'Chi nhánh',
  user_roles: 'Người dùng',
  profiles: 'Hồ sơ',
  import_returns: 'Trả hàng nhập',
  export_returns: 'Trả hàng xuất',
};

export default function AuditLogsPage() {
  const { data: permissions } = usePermissions();
  const { data: branches } = useBranches();
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');

  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit-logs', permissions?.branchId, branchFilter],
    queryFn: async () => {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      // Nếu không phải super_admin, chỉ lấy logs của chi nhánh mình
      if (permissions?.role !== 'super_admin' && permissions?.branchId) {
        query = query.eq('branch_id', permissions.branchId);
      } else if (branchFilter && branchFilter !== 'all') {
        query = query.eq('branch_id', branchFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!permissions,
  });

  // Lấy danh sách user_id để query profiles
  const userIds = [...new Set(logs?.map(log => log.user_id).filter(Boolean) || [])];
  
  const { data: profiles } = useQuery({
    queryKey: ['profiles-for-logs', userIds],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', userIds);
      if (error) throw error;
      return data;
    },
    enabled: userIds.length > 0,
  });

  const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);
  const branchMap = new Map(branches?.map(b => [b.id, b.name]) || []);

  const filteredLogs = logs?.filter(log => {
    const matchesSearch = !search || 
      log.description?.toLowerCase().includes(search.toLowerCase()) ||
      log.table_name?.toLowerCase().includes(search.toLowerCase()) ||
      profileMap.get(log.user_id)?.toLowerCase().includes(search.toLowerCase());
    
    const matchesAction = actionFilter === 'all' || log.action_type === actionFilter;
    
    return matchesSearch && matchesAction;
  });

  return (
    <MainLayout>
      <PageHeader 
        title="Lịch sử thao tác" 
        description={permissions?.role === 'super_admin' 
          ? "Xem lịch sử thao tác của toàn hệ thống"
          : "Xem lịch sử thao tác của chi nhánh"
        }
      />

      <div className="p-4 sm:p-6 space-y-4">
        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-col gap-3">
              <div className="flex-1">
                <Label className="sr-only">Tìm kiếm</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Tìm theo mô tả, người thực hiện..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 sm:flex-none sm:w-44">
                  <Label className="sr-only">Loại thao tác</Label>
                  <Select value={actionFilter} onValueChange={setActionFilter}>
                    <SelectTrigger>
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Loại thao tác" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="all">Tất cả thao tác</SelectItem>
                      <SelectItem value="create">Tạo mới</SelectItem>
                      <SelectItem value="update">Cập nhật</SelectItem>
                      <SelectItem value="delete">Xóa</SelectItem>
                      <SelectItem value="login">Đăng nhập</SelectItem>
                      <SelectItem value="logout">Đăng xuất</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {permissions?.role === 'super_admin' && (
                  <div className="flex-1 sm:flex-none sm:w-44">
                    <Label className="sr-only">Chi nhánh</Label>
                    <Select value={branchFilter} onValueChange={setBranchFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Chi nhánh" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="all">Tất cả chi nhánh</SelectItem>
                        {branches?.map(branch => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <History className="h-4 w-4 sm:h-5 sm:w-5" />
              Danh sách thao tác ({filteredLogs?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Đang tải...</div>
            ) : filteredLogs?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Không có lịch sử thao tác nào
              </div>
            ) : (
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap min-w-[140px]">Thời gian</TableHead>
                      <TableHead className="whitespace-nowrap hidden sm:table-cell">Người thực hiện</TableHead>
                      <TableHead className="whitespace-nowrap">Thao tác</TableHead>
                      <TableHead className="whitespace-nowrap hidden md:table-cell">Bảng dữ liệu</TableHead>
                      {permissions?.role === 'super_admin' && (
                        <TableHead className="whitespace-nowrap hidden lg:table-cell">Chi nhánh</TableHead>
                      )}
                      <TableHead className="hidden xl:table-cell">Mô tả</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs?.map((log) => {
                      const actionInfo = ACTION_LABELS[log.action_type] || { label: log.action_type, color: 'bg-gray-500' };
                      return (
                        <TableRow key={log.id}>
                          <TableCell>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                              <Clock className="h-3 w-3 text-muted-foreground hidden sm:block" />
                              <span>{format(new Date(log.created_at), 'dd/MM/yy HH:mm', { locale: vi })}</span>
                            </div>
                            {/* Mobile: Show user below time */}
                            <div className="sm:hidden text-xs text-muted-foreground mt-1">
                              {log.user_id ? profileMap.get(log.user_id) || 'N/A' : 'Hệ thống'}
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <div className="flex items-center gap-2">
                              <User className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-sm">
                                {log.user_id ? profileMap.get(log.user_id) || 'N/A' : 'Hệ thống'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={`${actionInfo.color} text-white text-xs`}>
                              {actionInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <span className="text-sm text-muted-foreground">
                              {log.table_name ? TABLE_LABELS[log.table_name] || log.table_name : '-'}
                            </span>
                          </TableCell>
                          {permissions?.role === 'super_admin' && (
                            <TableCell className="hidden lg:table-cell">
                              <span className="text-sm">
                                {log.branch_id ? branchMap.get(log.branch_id) || 'N/A' : 'Toàn HT'}
                              </span>
                            </TableCell>
                          )}
                          <TableCell className="hidden xl:table-cell">
                            <span className="text-sm line-clamp-1">{log.description || '-'}</span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
