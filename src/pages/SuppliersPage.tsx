import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useSuppliers, useCreateSupplier, useUpdateSupplier, useDeleteSupplier, Supplier } from '@/hooks/useSuppliers';
import { useSupplierStats } from '@/hooks/useSupplierStats';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, MoreHorizontal, Pencil, Trash2, Phone, MapPin, Loader2, Eye } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { SupplierDetailDialog } from '@/components/suppliers/SupplierDetailDialog';
import { SupplierFilters, SortMode } from '@/components/suppliers/SupplierFilters';
import { formatCurrency } from '@/lib/mockData';

export default function SuppliersPage() {
  const { data: suppliers, isLoading } = useSuppliers();
  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();
  const deleteSupplier = useDeleteSupplier();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [detailSupplier, setDetailSupplier] = useState<Supplier | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('name');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [branchId, setBranchId] = useState('');
  const [form, setForm] = useState({
    name: '',
    phone: '',
    address: '',
    note: '',
  });

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

  // Filter and sort suppliers
  const filteredSuppliers = useMemo(() => {
    let result = suppliers?.filter(
      (s) =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.phone?.includes(searchTerm)
    ) || [];

    // When sorting by stats, only show suppliers that have stats (i.e. have import receipts)
    if (sortMode !== 'name' && supplierStats) {
      result.sort((a, b) => {
        const statsA = statsMap.get(a.id);
        const statsB = statsMap.get(b.id);
        const valA = getSortValue(statsA, sortMode);
        const valB = getSortValue(statsB, sortMode);
        return valB - valA; // descending
      });
    }

    return result;
  }, [suppliers, searchTerm, sortMode, statsMap, supplierStats]);

  // Pagination
  const pagination = usePagination(filteredSuppliers, { storageKey: 'suppliers' });

  const handleAdd = () => {
    setEditSupplier(null);
    setForm({ name: '', phone: '', address: '', note: '' });
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
          <Button onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Thêm nhà cung cấp
          </Button>
        }
      />

      <div className="p-6 lg:p-8 space-y-4">
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
