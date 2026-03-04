 import { useState, useEffect, useCallback } from 'react';
 import { Card, CardContent } from '@/components/ui/card';
 import { TablePagination } from '@/components/ui/table-pagination';
 import { Input } from '@/components/ui/input';
 import { SearchInput } from '@/components/ui/search-input';
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
 import { Search, Plus, MoreHorizontal, Eye, ShoppingCart, Wallet, Merge, Pencil, Calendar, Settings } from 'lucide-react';
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
 import { useNavigate, useSearchParams } from 'react-router-dom';
 import { usePermissions } from '@/hooks/usePermissions';
 
interface CustomerListTabProps {
  onViewCare: (customerId: string) => void;
  onViewTimeline: (customerId: string) => void;
  branchFilter: string;
  onBranchFilterChange: (value: string) => void;
}

export function CustomerListTab({ onViewCare, onViewTimeline, branchFilter, onBranchFilterChange }: CustomerListTabProps) {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { data: permissions } = usePermissions();
    const isSuperAdmin = permissions?.canViewAllBranches === true;
    const [search, setSearch] = useState('');
    const [tierFilter, setTierFilter] = useState('_all_');
    const [statusFilter, setStatusFilter] = useState('_all_');
    const [sourceFilter, setSourceFilter] = useState('_all_');
    const [crmStatusFilter, setCrmStatusFilter] = useState('_all_');
    const [staffFilter, setStaffFilter] = useState('_all_');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(100);

    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
    const [editingCustomer, setEditingCustomer] = useState<any>(null);
    const [showDetailDialog, setShowDetailDialog] = useState(false);
    const [showFormDialog, setShowFormDialog] = useState(false);
    const [showSettingsDialog, setShowSettingsDialog] = useState(false);
    const [settingsDefaultTab, setSettingsDefaultTab] = useState<string | undefined>(undefined);
    const [showMergeDialog, setShowMergeDialog] = useState(false);

    // Auto-open settings dialog from URL param
    useEffect(() => {
      const openSettings = searchParams.get('openSettings');
      if (openSettings) {
        setSettingsDefaultTab(openSettings);
        setShowSettingsDialog(true);
        // Clear param
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('openSettings');
        setSearchParams(newParams, { replace: true });
      }
    }, [searchParams, setSearchParams]);

    // Helper: check if a customer belongs to current user's branch (for edit permission)
    const canEditCustomer = (customerBranchId: string | null | undefined): boolean => {
      if (isSuperAdmin) return true;
      if (!customerBranchId) return true; // No branch assigned = anyone can edit
      return permissions?.branchId === customerBranchId;
    };

    const { data: customers, isLoading, totalCount } = useCustomersWithPoints({
      search: search || undefined,
      branchId: branchFilter !== '_all_' ? branchFilter : undefined,
      tier: tierFilter !== '_all_' ? tierFilter : undefined,
      status: statusFilter !== '_all_' ? statusFilter : undefined,
      crmStatus: crmStatusFilter !== '_all_' ? crmStatusFilter : undefined,
      staffId: staffFilter !== '_all_' ? staffFilter : undefined,
      page: currentPage,
      pageSize,
    });
 
    const { data: branches } = useBranches();
    const { data: customerSources } = useCustomerSources();
    const { data: staffList } = useStaffList();
    
    const filteredCustomers = customers?.filter(c => {
      if (sourceFilter === '_all_') return true;
      if (sourceFilter === '_none_') return !c.source;
      return c.source === sourceFilter;
    });

    const totalPages = Math.ceil(totalCount / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalCount);

    // Reset page when filters change
    const handleSearchChange = useCallback((val: string) => {
      setSearch(val);
      setCurrentPage(1);
    }, []);

    const handlePageSizeChange = useCallback((val: number) => {
      setPageSize(val);
      setCurrentPage(1);
    }, []);
 
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
      if (!canEditCustomer(customer.preferred_branch_id)) {
        return; // Silently block - button should be hidden anyway
      }
      setEditingCustomer(customer);
      setShowFormDialog(true);
    };
 
   const handleCloseFormDialog = (open: boolean) => {
     setShowFormDialog(open);
     if (!open) setEditingCustomer(null);
   };
 
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
               <Select value={tierFilter} onValueChange={setTierFilter}>
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
               <Select value={crmStatusFilter} onValueChange={setCrmStatusFilter}>
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
               <Select value={staffFilter} onValueChange={setStaffFilter}>
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
               {permissions?.role === 'super_admin' && (
                 <>
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
                  className="p-3 active:bg-muted/50"
                  onClick={() => handleViewDetail(customer.id)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-sm">{customer.name}</p>
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
              ))
            )}
          </div>
          {/* Desktop: Table View */}
          <div className="hidden sm:block overflow-x-auto">
            <Table>
               <TableHeader>
                 <TableRow>
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
                     <TableCell colSpan={7} className="text-center py-8">Đang tải...</TableCell>
                   </TableRow>
                 ) : filteredCustomers?.length === 0 ? (
                   <TableRow>
                     <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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
                       <TableCell>
                         <div>
                           <p className="font-medium">{customer.name}</p>
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
           
            {totalCount > 0 && (
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={totalCount}
                startIndex={startIndex + 1}
                endIndex={endIndex}
                onPageChange={setCurrentPage}
                onPageSizeChange={handlePageSizeChange}
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
         onOpenChange={(v) => { setShowSettingsDialog(v); if (!v) setSettingsDefaultTab(undefined); }}
         defaultTab={settingsDefaultTab}
       />
 
       <CustomerMergeDialog
         open={showMergeDialog}
         onOpenChange={setShowMergeDialog}
       />
     </div>
   );
 }