import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePagination } from '@/hooks/usePagination';
import { TablePagination } from '@/components/ui/table-pagination';
import { Input } from '@/components/ui/input';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Search, Plus, MoreHorizontal, Eye, ShoppingCart, Wallet, Settings, Users, Merge, Pencil, UserPlus, Calendar, Tag } from 'lucide-react';
import { useCustomerSources } from '@/hooks/useCustomerSources';
import { useCustomersWithPoints, MEMBERSHIP_TIER_NAMES, MEMBERSHIP_TIER_COLORS } from '@/hooks/useCustomerPoints';
import { CRM_STATUS_LABELS, CRM_STATUS_COLORS, CRMStatus, useStaffList } from '@/hooks/useCRM';
import { useBranches } from '@/hooks/useBranches';
import { formatNumber } from '@/lib/formatNumber';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { CustomerDetailDialog } from '@/components/customers/CustomerDetailDialog';
import { CustomerFormDialog } from '@/components/customers/CustomerFormDialog';
import { PointSettingsDialog } from '@/components/customers/PointSettingsDialog';
import { CustomerMergeDialog } from '@/components/customers/CustomerMergeDialog';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';

export default function CustomersPage() {
  const navigate = useNavigate();
  const { data: permissions } = usePermissions();
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('_all_');
  const [tierFilter, setTierFilter] = useState('_all_');
  const [statusFilter, setStatusFilter] = useState('_all_');
  const [sourceFilter, setSourceFilter] = useState('_all_');
  const [crmStatusFilter, setCrmStatusFilter] = useState('_all_');
  const [staffFilter, setStaffFilter] = useState('_all_');

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<typeof customers extends (infer T)[] ? T : never | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);

  const { data: customers, isLoading } = useCustomersWithPoints({
    search: search || undefined,
    branchId: branchFilter !== '_all_' ? branchFilter : undefined,
    tier: tierFilter !== '_all_' ? tierFilter : undefined,
    status: statusFilter !== '_all_' ? statusFilter : undefined,
    crmStatus: crmStatusFilter !== '_all_' ? crmStatusFilter : undefined,
    staffId: staffFilter !== '_all_' ? staffFilter : undefined,
  });

  const { data: branches } = useBranches();
  const { data: customerSources } = useCustomerSources();
  const { data: staffList } = useStaffList();
  
  // Filter by source client-side (since hook doesn't support it)
  const filteredCustomers = customers?.filter(c => {
    if (sourceFilter === '_all_') return true;
    if (sourceFilter === '_none_') return !c.source;
    return c.source === sourceFilter;
  });

  // Pagination
  const pagination = usePagination(filteredCustomers || [], { storageKey: 'customers' });

  const handleViewDetail = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setShowDetailDialog(true);
  };

  const handleSell = (customerId: string) => {
    // Navigate to export page with customer pre-selected
    navigate(`/export/new?customerId=${customerId}`);
  };

  const handleCollectDebt = (customerId: string) => {
    navigate(`/debt?customerId=${customerId}`);
  };

  const handleEditCustomer = (customer: NonNullable<typeof customers>[number]) => {
    setEditingCustomer(customer);
    setShowFormDialog(true);
  };

  const handleCloseFormDialog = (open: boolean) => {
    setShowFormDialog(open);
    if (!open) {
      setEditingCustomer(null);
    }
  };

  const getBranchName = (branchId: string | null) => {
    if (!branchId) return '-';
    return branches?.find(b => b.id === branchId)?.name || '-';
  };

  // Summary stats
  const totalCustomers = filteredCustomers?.length || 0;
  const customersWithPoints = filteredCustomers?.filter(c => c.current_points > 0).length || 0;
  const customersWithDebt = filteredCustomers?.filter(c => c.total_spent > 0).length || 0;
  const vipCustomers = filteredCustomers?.filter(c => c.membership_tier === 'vip').length || 0;

  return (
    <MainLayout>
      <PageHeader title="Quản lý khách hàng" />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalCustomers}</p>
                <p className="text-xs text-muted-foreground">Tổng khách hàng</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Wallet className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{customersWithPoints}</p>
                <p className="text-xs text-muted-foreground">Khách có điểm</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{vipCustomers}</p>
                <p className="text-xs text-muted-foreground">Khách VIP</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <ShoppingCart className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{customersWithDebt}</p>
                <p className="text-xs text-muted-foreground">Đã mua hàng</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm theo tên, SĐT..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Chi nhánh" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all_">Tất cả chi nhánh</SelectItem>
                {branches?.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger className="w-full md:w-[150px]">
                <SelectValue placeholder="Hạng" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all_">Tất cả hạng</SelectItem>
                <SelectItem value="regular">Thường</SelectItem>
                <SelectItem value="silver">Bạc</SelectItem>
                <SelectItem value="gold">Vàng</SelectItem>
                <SelectItem value="vip">VIP</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[150px]">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all_">Tất cả</SelectItem>
                <SelectItem value="active">Hoạt động</SelectItem>
                <SelectItem value="inactive">Ngừng</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-full md:w-[150px]">
                <SelectValue placeholder="Nguồn" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all_">Tất cả nguồn</SelectItem>
                <SelectItem value="_none_">Chưa xác định</SelectItem>
                {customerSources?.map((source) => (
                  <SelectItem key={source.id} value={source.name}>
                    {source.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={crmStatusFilter} onValueChange={setCrmStatusFilter}>
              <SelectTrigger className="w-full md:w-[150px]">
                <SelectValue placeholder="Trạng thái CRM" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all_">Tất cả CRM</SelectItem>
                {Object.entries(CRM_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={staffFilter} onValueChange={setStaffFilter}>
              <SelectTrigger className="w-full md:w-[150px]">
                <SelectValue placeholder="NV phụ trách" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all_">Tất cả NV</SelectItem>
                {staffList?.map((staff) => (
                  <SelectItem key={staff.user_id} value={staff.user_id}>
                    {staff.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button onClick={() => setShowFormDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Thêm mới
              </Button>
              {permissions?.role === 'super_admin' && (
                <>
                  <Button variant="outline" onClick={() => setShowMergeDialog(true)}>
                    <Merge className="h-4 w-4 mr-2" />
                    Gộp trùng
                  </Button>
                  <Button variant="outline" onClick={() => setShowSettingsDialog(true)}>
                    <Settings className="h-4 w-4 mr-2" />
                    Cài đặt
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customer Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Khách hàng</TableHead>
                  <TableHead className="hidden lg:table-cell">Nguồn</TableHead>
                  <TableHead className="hidden md:table-cell">NV phụ trách</TableHead>
                  <TableHead className="hidden lg:table-cell">Trạng thái CRM</TableHead>
                  <TableHead className="text-right">Tổng chi tiêu</TableHead>
                  <TableHead className="hidden lg:table-cell">Chăm sóc gần nhất</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      Đang tải...
                    </TableCell>
                  </TableRow>
                ) : filteredCustomers?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Chưa có khách hàng nào
                    </TableCell>
                  </TableRow>
                ) : (
                  pagination.paginatedData.map((customer) => (
                    <TableRow key={customer.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleViewDetail(customer.id)}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{customer.name}</p>
                          <p className="text-sm text-muted-foreground">{customer.phone}</p>
                          <div className="flex gap-1 mt-1 md:hidden">
                            <Badge className={MEMBERSHIP_TIER_COLORS[customer.membership_tier]} variant="secondary">
                              {MEMBERSHIP_TIER_NAMES[customer.membership_tier]}
                            </Badge>
                            {customer.current_points > 0 && (
                              <Badge variant="outline">{formatNumber(customer.current_points)} điểm</Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {customer.source ? (
                          <Badge variant="outline">{customer.source}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {staffList?.find(s => s.user_id === customer.assigned_staff_id)?.display_name || (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Badge className={CRM_STATUS_COLORS[customer.crm_status as CRMStatus || 'new']} variant="secondary">
                          {CRM_STATUS_LABELS[customer.crm_status as CRMStatus || 'new']}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatNumber(customer.total_spent)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {customer.last_care_date
                          ? format(new Date(customer.last_care_date), 'dd/MM/yyyy', { locale: vi })
                          : '-'}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewDetail(customer.id)}>
                              <Eye className="h-4 w-4 mr-2" />
                              Xem chi tiết
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEditCustomer(customer)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Sửa thông tin
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleSell(customer.id)}>
                              <ShoppingCart className="h-4 w-4 mr-2" />
                              Bán hàng
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCollectDebt(customer.id)}>
                              <Wallet className="h-4 w-4 mr-2" />
                              Thu nợ
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate(`/crm/care?customerId=${customer.id}`)}>
                              <Calendar className="h-4 w-4 mr-2" />
                              Lịch chăm sóc
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          {(customers?.length || 0) > 0 && (
            <TablePagination
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              pageSize={pagination.pageSize}
              totalItems={pagination.totalItems}
              startIndex={pagination.startIndex}
              endIndex={pagination.endIndex}
              onPageChange={pagination.setPage}
              onPageSizeChange={pagination.setPageSize}
            />
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CustomerDetailDialog
        customerId={selectedCustomerId}
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
      />

      <CustomerFormDialog
        open={showFormDialog}
        onOpenChange={handleCloseFormDialog}
        customer={editingCustomer}
      />

      <PointSettingsDialog
        open={showSettingsDialog}
        onOpenChange={setShowSettingsDialog}
      />

      <CustomerMergeDialog
        open={showMergeDialog}
        onOpenChange={setShowMergeDialog}
      />
    </MainLayout>
  );
}
