import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { SearchInput } from '@/components/ui/search-input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, MoreHorizontal, Eye, ShoppingCart, Wallet, Merge, Pencil, Calendar, Settings, Tag } from 'lucide-react';
import { useCustomerSources } from '@/hooks/useCustomerSources';
import { useCustomersWithPoints, MEMBERSHIP_TIER_NAMES, MEMBERSHIP_TIER_COLORS } from '@/hooks/useCustomerPoints';
import { CRM_STATUS_LABELS, CRM_STATUS_COLORS, CRMStatus, useStaffList, useCustomerTags } from '@/hooks/useCRM';
import { useBranches } from '@/hooks/useBranches';
import { formatNumber } from '@/lib/formatNumber';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { CustomerDetailDialog } from '@/components/customers/CustomerDetailDialog';
import { CustomerFormDialog } from '@/components/customers/CustomerFormDialog';
import { PointSettingsDialog } from '@/components/customers/PointSettingsDialog';
import { CustomerMergeDialog } from '@/components/customers/CustomerMergeDialog';
import { CustomerBulkActions } from '@/components/customers/CustomerBulkActions';
import { TagManagementDialog } from '@/components/customers/TagManagementDialog';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';

interface CustomerListTabProps {
  onViewCare: (customerId: string) => void;
  onViewTimeline: (customerId: string) => void;
  branchFilter: string;
  onBranchFilterChange: (value: string) => void;
  tierFilter: string;
  onTierFilterChange: (value: string) => void;
  crmStatusFilter: string;
  onCrmStatusFilterChange: (value: string) => void;
  staffFilter: string;
  onStaffFilterChange: (value: string) => void;
  tagFilter: string;
  onTagFilterChange: (value: string) => void;
}

export function CustomerListTab({
  onViewCare, onViewTimeline,
  branchFilter, onBranchFilterChange,
  tierFilter, onTierFilterChange,
  crmStatusFilter, onCrmStatusFilterChange,
  staffFilter, onStaffFilterChange,
  tagFilter, onTagFilterChange,
}: CustomerListTabProps) {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { data: permissions } = usePermissions();
    const isSuperAdmin = permissions?.canViewAllBranches === true;
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [sourceFilter, setSourceFilter] = useState('_all_');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);

    // Debounce search input (400ms)
    useEffect(() => {
      const timer = setTimeout(() => {
        setDebouncedSearch(search);
      }, 400);
      return () => clearTimeout(timer);
    }, [search]);

    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
    const [editingCustomer, setEditingCustomer] = useState<any>(null);
    const [showDetailDialog, setShowDetailDialog] = useState(false);
    const [showFormDialog, setShowFormDialog] = useState(false);
    const [showSettingsDialog, setShowSettingsDialog] = useState(false);
    const [settingsDefaultTab, setSettingsDefaultTab] = useState<string | undefined>(undefined);
    const [showMergeDialog, setShowMergeDialog] = useState(false);

    // Multi-select
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [showTagManagement, setShowTagManagement] = useState(false);

    // Auto-open settings dialog from URL param
    useEffect(() => {
      const openSettings = searchParams.get('openSettings');
      if (openSettings) {
        setSettingsDefaultTab(openSettings);
        setShowSettingsDialog(true);
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('openSettings');
        setSearchParams(newParams, { replace: true });
      }
    }, [searchParams, setSearchParams]);

    const canEditCustomer = (customerBranchId: string | null | undefined): boolean => {
      if (isSuperAdmin) return true;
      if (!customerBranchId) return true;
      return permissions?.branchId === customerBranchId;
    };

    const { data: customers, isLoading, hasMore } = useCustomersWithPoints({
      search: debouncedSearch || undefined,
      branchId: branchFilter !== '_all_' ? branchFilter : undefined,
      tier: tierFilter !== '_all_' ? tierFilter : undefined,
      status: undefined,
      crmStatus: crmStatusFilter !== '_all_' ? crmStatusFilter : undefined,
      staffId: staffFilter !== '_all_' ? staffFilter : undefined,
      tagId: tagFilter !== '_all_' ? tagFilter : undefined,
      page: currentPage,
      pageSize,
    });
 
    const { data: branches } = useBranches();
    const { data: customerSources } = useCustomerSources();
    const { data: staffList } = useStaffList();
    const { data: tags } = useCustomerTags();
    
    const filteredCustomers = customers?.filter(c => {
      if (sourceFilter !== '_all_') {
        if (sourceFilter === '_none_' ? c.source : c.source !== sourceFilter) return false;
      }
      return true;
    });

    const handleSearchChange = useCallback((val: string) => {
      setSearch(val);
      setCurrentPage(1);
    }, []);

    const handlePageSizeChange = useCallback((val: number) => {
      setPageSize(val);
      setCurrentPage(1);
    }, []);

    // Clear selection when data changes
    useEffect(() => {
      setSelectedIds([]);
    }, [currentPage, search, branchFilter, tierFilter, crmStatusFilter, staffFilter, tagFilter]);
 
    const handleViewDetail = (customerId: string) => {
      setSelectedCustomerId(customerId);
      setShowDetailDialog(true);
    };
 
    const handleSell = (customerId: string) => {
      navigate(`/export/new?customerId=${customerId}`);
    };
 
    const handleCollectDebt = (customerId: string) => {
      navigate(`/debt?customerId=${customerId}`);
    };
 
    const handleEditCustomer = (customer: any) => {
      if (!canEditCustomer(customer.preferred_branch_id)) return;
      setEditingCustomer(customer);
      setShowFormDialog(true);
    };
 
    const handleCloseFormDialog = (open: boolean) => {
      setShowFormDialog(open);
      if (!open) setEditingCustomer(null);
    };

    const toggleSelect = (id: string) => {
      setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const toggleSelectAll = () => {
      if (!filteredCustomers) return;
      if (selectedIds.length === filteredCustomers.length) {
        setSelectedIds([]);
      } else {
        setSelectedIds(filteredCustomers.map(c => c.id));
      }
    };

    const allSelected = (filteredCustomers?.length || 0) > 0 && selectedIds.length === (filteredCustomers?.length || 0);
 
    return (
     <div className="space-y-3 sm:space-y-4">
        {/* Filters */}
        <Card>
         <CardContent className="pt-3 sm:pt-4 px-3 sm:px-4">
           <div className="flex flex-col gap-3">
             <div className="flex gap-2">
                <SearchInput
                  placeholder="Tìm theo tên, SĐT..."
                  value={search}
                  onChange={handleSearchChange}
                  containerClassName="flex-1"
                  className="h-9 text-sm"
                  loading={isLoading && !!debouncedSearch}
                />
               <Button size="sm" onClick={() => setShowFormDialog(true)} className="h-9 px-3">
                 <Plus className="h-4 w-4 sm:mr-2" />
                 <span className="hidden sm:inline">Thêm</span>
               </Button>
             </div>
             <div className="flex flex-wrap gap-2 overflow-x-auto">
                <Select value={branchFilter} onValueChange={onBranchFilterChange}>
                 <SelectTrigger className="w-[100px] sm:w-[140px] h-9 text-xs sm:text-sm">
                   <SelectValue placeholder="CN" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all_">Tất cả CN</SelectItem>
                    {branches?.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={tierFilter} onValueChange={onTierFilterChange}>
                 <SelectTrigger className="w-[90px] sm:w-[120px] h-9 text-xs sm:text-sm">
                    <SelectValue placeholder="Hạng" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all_">Tất cả</SelectItem>
                    <SelectItem value="regular">Thường</SelectItem>
                    <SelectItem value="silver">Bạc</SelectItem>
                    <SelectItem value="gold">Vàng</SelectItem>
                    <SelectItem value="vip">VIP</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={crmStatusFilter} onValueChange={onCrmStatusFilterChange}>
                 <SelectTrigger className="w-[100px] sm:w-[140px] h-9 text-xs sm:text-sm">
                   <SelectValue placeholder="CRM" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all_">Tất cả CRM</SelectItem>
                    {Object.entries(CRM_STATUS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={staffFilter} onValueChange={onStaffFilterChange}>
                 <SelectTrigger className="w-[100px] sm:w-[140px] h-9 text-xs sm:text-sm">
                   <SelectValue placeholder="NV" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all_">Tất cả NV</SelectItem>
                    {staffList?.map((staff) => (
                      <SelectItem key={staff.user_id} value={staff.user_id}>{staff.display_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={tagFilter} onValueChange={onTagFilterChange}>
                 <SelectTrigger className="w-[100px] sm:w-[140px] h-9 text-xs sm:text-sm">
                   <SelectValue placeholder="Tag" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all_">Tất cả Tag</SelectItem>
                    {tags?.map((tag) => (
                      <SelectItem key={tag.id} value={tag.id}>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                          {tag.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {permissions?.role === 'super_admin' && (
                  <>
                   <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setShowTagManagement(true)} title="Quản lý Tag">
                      <Tag className="h-4 w-4" />
                    </Button>
                   <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setShowMergeDialog(true)}>
                      <Merge className="h-4 w-4" />
                    </Button>
                   <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setShowSettingsDialog(true)}>
                      <Settings className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Actions */}
        <CustomerBulkActions selectedIds={selectedIds} onClearSelection={() => setSelectedIds([])} />
 
        {/* Customer Table */}
        <Card>
          <CardContent className="p-0">
           {/* Mobile: Card View */}
           <div className="sm:hidden divide-y">
             {isLoading ? (
               <p className="text-center py-8 text-sm text-muted-foreground">Đang tải...</p>
             ) : filteredCustomers?.length === 0 ? (
               <p className="text-center py-8 text-sm text-muted-foreground">Chưa có khách hàng</p>
             ) : (
                (filteredCustomers || []).map((customer) => (
                 <div
                   key={customer.id}
                   className="p-3 flex items-start gap-2"
                 >
                   <Checkbox
                     checked={selectedIds.includes(customer.id)}
                     onCheckedChange={() => toggleSelect(customer.id)}
                     className="mt-1 shrink-0"
                   />
                   <div
                     className="flex-1 active:bg-muted/50"
                     onClick={() => handleViewDetail(customer.id)}
                   >
                     <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-sm">{customer.name}</p>
                            {(customer as any).entity_code && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-mono shrink-0">
                                {(customer as any).entity_code}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{customer.phone}</p>
                        </div>
                       <Badge className={`${MEMBERSHIP_TIER_COLORS[customer.membership_tier]} text-xs`}>
                         {MEMBERSHIP_TIER_NAMES[customer.membership_tier]}
                       </Badge>
                     </div>
                     <div className="flex justify-between items-center mt-2">
                       <Badge className={`${CRM_STATUS_COLORS[customer.crm_status as CRMStatus || 'new']} text-xs`}>
                         {CRM_STATUS_LABELS[customer.crm_status as CRMStatus || 'new']}
                       </Badge>
                       <p className="text-sm font-semibold">{formatNumber(customer.total_spent)}</p>
                     </div>
                   </div>
                 </div>
               ))
             )}
           </div>
           {/* Desktop: Table View */}
           <div className="hidden sm:block overflow-x-auto">
             <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Khách hàng</TableHead>
                    <TableHead className="hidden md:table-cell">Nguồn</TableHead>
                    <TableHead className="hidden lg:table-cell">NV phụ trách</TableHead>
                    <TableHead className="hidden lg:table-cell">Trạng thái CRM</TableHead>
                    <TableHead className="text-right">Chi tiêu</TableHead>
                    <TableHead className="hidden xl:table-cell">Chăm sóc gần nhất</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">Đang tải...</TableCell>
                    </TableRow>
                  ) : filteredCustomers?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Chưa có khách hàng nào
                      </TableCell>
                    </TableRow>
                  ) : (
                    (filteredCustomers || []).map((customer) => (
                      <TableRow 
                        key={customer.id} 
                        className="cursor-pointer hover:bg-muted/50" 
                        onClick={() => handleViewDetail(customer.id)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.includes(customer.id)}
                            onCheckedChange={() => toggleSelect(customer.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-medium">{customer.name}</p>
                              {(customer as any).entity_code && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-mono shrink-0">
                                  {(customer as any).entity_code}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{customer.phone}</p>
                            <div className="flex gap-1 mt-1 lg:hidden">
                              <Badge className={MEMBERSHIP_TIER_COLORS[customer.membership_tier]} variant="secondary">
                                {MEMBERSHIP_TIER_NAMES[customer.membership_tier]}
                              </Badge>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {customer.source ? (
                            <Badge variant="outline" className="text-xs">{customer.source}</Badge>
                          ) : <span className="text-muted-foreground text-sm">-</span>}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
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
                        <TableCell className="hidden xl:table-cell">
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
                                 <Eye className="h-4 w-4 mr-2" />Xem chi tiết
                               </DropdownMenuItem>
                               {canEditCustomer(customer.preferred_branch_id) && (
                                 <DropdownMenuItem onClick={() => handleEditCustomer(customer)}>
                                   <Pencil className="h-4 w-4 mr-2" />Sửa thông tin
                                 </DropdownMenuItem>
                               )}
                               <DropdownMenuItem onClick={() => handleSell(customer.id)}>
                                 <ShoppingCart className="h-4 w-4 mr-2" />Bán hàng
                               </DropdownMenuItem>
                               {canEditCustomer(customer.preferred_branch_id) && (
                                 <>
                                   <DropdownMenuItem onClick={() => handleCollectDebt(customer.id)}>
                                     <Wallet className="h-4 w-4 mr-2" />Thu nợ
                                   </DropdownMenuItem>
                                   <DropdownMenuItem onClick={() => onViewCare(customer.id)}>
                                     <Calendar className="h-4 w-4 mr-2" />Lịch chăm sóc
                                   </DropdownMenuItem>
                                 </>
                               )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            
             {(filteredCustomers?.length || 0) > 0 && (
               <div className="flex items-center justify-between px-4 py-3 border-t">
                 <div className="text-sm text-muted-foreground">
                   Trang {currentPage} · {filteredCustomers?.length || 0} kết quả
                 </div>
                 <div className="flex items-center gap-2">
                   <Select value={String(pageSize)} onValueChange={(v) => handlePageSizeChange(Number(v))}>
                     <SelectTrigger className="w-[80px] h-8 text-xs">
                       <SelectValue />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="15">15</SelectItem>
                       <SelectItem value="25">25</SelectItem>
                       <SelectItem value="50">50</SelectItem>
                     </SelectContent>
                   </Select>
                   <Button
                     variant="outline"
                     size="sm"
                     onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                     disabled={currentPage <= 1}
                   >
                     Trước
                   </Button>
                   <Button
                     variant="outline"
                     size="sm"
                     onClick={() => setCurrentPage(p => p + 1)}
                     disabled={!hasMore}
                   >
                     Sau
                   </Button>
                 </div>
               </div>
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
          onOpenChange={(v) => { setShowSettingsDialog(v); if (!v) setSettingsDefaultTab(undefined); }}
          defaultTab={settingsDefaultTab}
        />
 
        <CustomerMergeDialog
          open={showMergeDialog}
          onOpenChange={setShowMergeDialog}
        />

        <TagManagementDialog
          open={showTagManagement}
          onOpenChange={setShowTagManagement}
        />
      </div>
    );
  }
