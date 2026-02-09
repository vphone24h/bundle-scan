import { useState, useMemo, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useSuppliers, useCreateSupplier, useUpdateSupplier, useDeleteSupplier, Supplier } from '@/hooks/useSuppliers';
import { useSupplierStats } from '@/hooks/useSupplierStats';
import { useBranches } from '@/hooks/useBranches';
import { usePagination } from '@/hooks/usePagination';
import { TablePagination } from '@/components/ui/table-pagination';
import { formatDate } from '@/lib/mockData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Plus, MoreHorizontal, Pencil, Trash2, Phone, MapPin, Loader2, Eye, Building2, Merge } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { SupplierDetailDialog } from '@/components/suppliers/SupplierDetailDialog';
import { SupplierMergeDialog } from '@/components/suppliers/SupplierMergeDialog';
import { SupplierStats } from '@/components/suppliers/SupplierStats';
import { SupplierFilters, SortMode } from '@/components/suppliers/SupplierFilters';
import { formatCurrency } from '@/lib/mockData';
import { usePermissions } from '@/hooks/usePermissions';
import { useDuplicateSuppliers } from '@/hooks/useSupplierMerge';

export default function SuppliersPage() {
  const { data: allSuppliers, isLoading } = useSuppliers();
  const { data: branches } = useBranches();
  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();
  const deleteSupplier = useDeleteSupplier();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [detailSupplier, setDetailSupplier] = useState<Supplier | null>(null);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('name');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [branchId, setBranchId] = useState('');
  const [formBranchId, setFormBranchId] = useState('');

  const { data: permissions } = usePermissions();
  const isSuperAdmin = permissions?.canViewAllBranches === true;

  // Auto-lock branch for non-super-admins
  useEffect(() => {
    if (!isSuperAdmin && permissions?.branchId) {
      setBranchId(permissions.branchId);
    }
  }, [isSuperAdmin, permissions?.branchId]);

  const [form, setForm] = useState({
    name: '',
    phone: '',
    address: '',
    note: '',
  });

  // Detect duplicate suppliers
  const duplicateGroups = useDuplicateSuppliers(allSuppliers);

  // Fetch stats for sorting
  const { data: supplierStats } = useSupplierStats({
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    branchId: branchId || undefined,
  });

  // Build a stats map for quick lookup
  const statsMap = useMemo(() => {
    const map = new Map<string, { totalImportValue: number; totalDebt: number; receiptCount: number; avgReceiptValue: number }>();
    supplierStats?.forEach((s) => {
      map.set(s.supplierId, {
        totalImportValue: s.totalImportValue,
        totalDebt: s.totalDebt,
        receiptCount: s.receiptCount,
        avgReceiptValue: s.avgReceiptValue,
      });
    });
    return map;
  }, [supplierStats]);

  // Build branch name map for display
  const branchNameMap = useMemo(() => {
    const map = new Map<string, string>();
    branches?.forEach((b) => map.set(b.id, b.name));
    return map;
  }, [branches]);

  // Filter by branch first, then search + sort
  const filteredSuppliers = useMemo(() => {
    let suppliers = allSuppliers || [];
    if (!isSuperAdmin && permissions?.branchId) {
      suppliers = suppliers.filter(s => s.branch_id === permissions.branchId);
    } else if (branchId) {
      suppliers = suppliers.filter(s => s.branch_id === branchId);
    }

    let result = suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.phone?.includes(searchTerm)
    );

    if (sortMode !== 'name' && supplierStats) {
      result.sort((a, b) => {
        const statsA = statsMap.get(a.id);
        const statsB = statsMap.get(b.id);
        const valA = getSortValue(statsA, sortMode);
        const valB = getSortValue(statsB, sortMode);
        return valB - valA;
      });
    }

    return result;
  }, [allSuppliers, searchTerm, sortMode, statsMap, supplierStats, isSuperAdmin, permissions?.branchId, branchId]);

  // Pagination
  const pagination = usePagination(filteredSuppliers, { storageKey: 'suppliers' });

  // Find default branch for form
  const defaultBranch = useMemo(() => {
    return branches?.find(b => b.is_default) || branches?.[0];
  }, [branches]);

  const handleAdd = () => {
    setEditSupplier(null);
    setForm({ name: '', phone: '', address: '', note: '' });
    // Super admin: default to default branch; branch admin: locked to their branch
    setFormBranchId(isSuperAdmin ? (defaultBranch?.id || '') : (permissions?.branchId || ''));
    setDialogOpen(true);
  };

  const handleEdit = (supplier: Supplier) => {
    setEditSupplier(supplier);
    setForm({
      name: supplier.name,
      phone: supplier.phone || '',
      address: supplier.address || '',
      note: supplier.note || '',
    });
    setFormBranchId(supplier.branch_id || '');
    setDialogOpen(true);
  };

  const handleDelete = async (supplier: Supplier) => {
    if (confirm(`Bạn có chắc muốn xoá nhà cung cấp "${supplier.name}"?`)) {
      try {
        await deleteSupplier.mutateAsync(supplier.id);
        toast({ title: 'Đã xoá nhà cung cấp' });
      } catch (error: any) {
        toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
      }
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;

    try {
      if (editSupplier) {
        await updateSupplier.mutateAsync({
          id: editSupplier.id,
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          address: form.address.trim() || null,
          note: form.note.trim() || null,
        });
        toast({ title: 'Đã cập nhật nhà cung cấp' });
      } else {
        await createSupplier.mutateAsync({
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          address: form.address.trim() || null,
          note: form.note.trim() || null,
          branch_id: formBranchId || null,
        });
        toast({ title: 'Đã thêm nhà cung cấp mới' });
      }
      setDialogOpen(false);
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageHeader
        title="Quản lý nhà cung cấp"
        description="Thông tin nhà cung cấp và đối tác"
        actions={
          <div className="flex items-center gap-2">
            {duplicateGroups.length > 0 && (
              <Button variant="outline" onClick={() => setMergeDialogOpen(true)} className="gap-1.5">
                <Merge className="h-4 w-4" />
                <span className="hidden sm:inline">Gộp trùng</span>
                <Badge variant="destructive" className="ml-1 text-[10px] h-5 px-1.5">
                  {duplicateGroups.length}
                </Badge>
              </Button>
            )}
            <Button onClick={handleAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Thêm nhà cung cấp
            </Button>
          </div>
        }
      />

      <div className="p-6 lg:p-8 space-y-4">
        {/* Stats Dashboard */}
        <SupplierStats
          suppliers={filteredSuppliers}
          supplierStats={supplierStats}
        />

        {/* Filters */}
        <SupplierFilters
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          sortMode={sortMode}
          onSortModeChange={setSortMode}
          startDate={startDate}
          onStartDateChange={setStartDate}
          endDate={endDate}
          onEndDateChange={setEndDate}
          branchId={branchId}
          onBranchIdChange={setBranchId}
          isSuperAdmin={isSuperAdmin}
        />

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pagination.paginatedData.map((supplier) => {
            const stats = statsMap.get(supplier.id);
            return (
              <div
                key={supplier.id}
                className="bg-card border rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setDetailSupplier(supplier)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{supplier.name}</h3>
                    {isSuperAdmin && supplier.branch_id && (
                      <p className="text-[10px] text-primary/70 flex items-center gap-1 mt-0.5">
                        <Building2 className="h-3 w-3" />
                        {branchNameMap.get(supplier.branch_id) || 'Không rõ'}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Thêm: {formatDate(new Date(supplier.created_at))}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-popover">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setDetailSupplier(supplier); }}>
                        <Eye className="mr-2 h-4 w-4" />
                        Xem chi tiết
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(supplier); }}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Chỉnh sửa
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => { e.stopPropagation(); handleDelete(supplier); }}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Xoá
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="mt-4 space-y-2">
                  {supplier.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{supplier.phone}</span>
                    </div>
                  )}
                  {supplier.address && (
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{supplier.address}</span>
                    </div>
                  )}
                </div>

                {/* Stats badges when sorting */}
                {sortMode !== 'name' && stats && (
                  <div className="mt-3 pt-3 border-t flex flex-wrap gap-1.5">
                    {sortMode === 'most_import_value' && (
                      <Badge variant="secondary" className="text-[10px]">
                        Nhập: {formatCurrency(stats.totalImportValue)}
                      </Badge>
                    )}
                    {sortMode === 'highest_debt' && (
                      <Badge variant={stats.totalDebt > 0 ? "destructive" : "secondary"} className="text-[10px]">
                        Nợ: {formatCurrency(stats.totalDebt)}
                      </Badge>
                    )}
                    {sortMode === 'most_receipts' && (
                      <Badge variant="secondary" className="text-[10px]">
                        {stats.receiptCount} phiếu nhập
                      </Badge>
                    )}
                    {sortMode === 'highest_avg' && (
                      <Badge variant="secondary" className="text-[10px]">
                        TB: {formatCurrency(stats.avgReceiptValue)}
                      </Badge>
                    )}
                  </div>
                )}

                {supplier.note && (
                  <p className={`mt-3 pt-3 ${sortMode === 'name' ? 'border-t' : ''} text-sm text-muted-foreground`}>
                    {supplier.note}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {filteredSuppliers.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            Không tìm thấy nhà cung cấp nào
          </div>
        )}

        {filteredSuppliers.length > 0 && (
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
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editSupplier ? 'Chỉnh sửa nhà cung cấp' : 'Thêm nhà cung cấp'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="form-field">
              <Label htmlFor="name">Tên nhà cung cấp *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nhập tên nhà cung cấp"
              />
            </div>

            <div className="form-field">
              <Label htmlFor="phone">Số điện thoại</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="VD: 0901234567"
              />
            </div>

            {/* Branch selector - Super Admin can choose, Branch Admin locked */}
            <div className="form-field">
              <Label>Chi nhánh</Label>
              {editSupplier ? (
                // When editing: show branch as read-only
                <Input
                  value={formBranchId ? (branchNameMap.get(formBranchId) || 'Không rõ') : 'Chưa gán'}
                  disabled
                  className="bg-muted"
                />
              ) : isSuperAdmin ? (
                <Select value={formBranchId} onValueChange={setFormBranchId}>
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
              ) : (
                <Input
                  value={formBranchId ? (branchNameMap.get(formBranchId) || '') : ''}
                  disabled
                  className="bg-muted"
                />
              )}
            </div>

            <div className="form-field">
              <Label htmlFor="address">Địa chỉ</Label>
              <Input
                id="address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Nhập địa chỉ"
              />
            </div>

            <div className="form-field">
              <Label htmlFor="note">Ghi chú</Label>
              <Textarea
                id="note"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="Ghi chú thêm (tuỳ chọn)"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Huỷ
            </Button>
            <Button
              onClick={handleSave}
              disabled={!form.name.trim() || createSupplier.isPending || updateSupplier.isPending}
            >
              {(createSupplier.isPending || updateSupplier.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editSupplier ? 'Cập nhật' : 'Thêm mới'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Supplier Detail Dialog */}
      <SupplierDetailDialog
        supplier={detailSupplier}
        open={!!detailSupplier}
        onOpenChange={(open) => !open && setDetailSupplier(null)}
      />

      {/* Supplier Merge Dialog */}
      <SupplierMergeDialog
        open={mergeDialogOpen}
        onOpenChange={setMergeDialogOpen}
        duplicateGroups={duplicateGroups}
        branchNameMap={branchNameMap}
      />
    </MainLayout>
  );
}

function getSortValue(
  stats: { totalImportValue: number; totalDebt: number; receiptCount: number; avgReceiptValue: number } | undefined,
  mode: SortMode
): number {
  if (!stats) return 0;
  switch (mode) {
    case 'most_import_value': return stats.totalImportValue;
    case 'highest_debt': return stats.totalDebt;
    case 'most_receipts': return stats.receiptCount;
    case 'highest_avg': return stats.avgReceiptValue;
    default: return 0;
  }
}
