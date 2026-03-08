import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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

  const duplicateGroups = useDuplicateSuppliers(allSuppliers);

  const { data: supplierStats } = useSupplierStats({
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    branchId: branchId || undefined,
  });

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

  const branchNameMap = useMemo(() => {
    const map = new Map<string, string>();
    branches?.forEach((b) => map.set(b.id, b.name));
    return map;
  }, [branches]);

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

  const pagination = usePagination(filteredSuppliers, { storageKey: 'suppliers' });

  const defaultBranch = useMemo(() => {
    return branches?.find(b => b.is_default) || branches?.[0];
  }, [branches]);

  const handleAdd = () => {
    setEditSupplier(null);
    setForm({ name: '', phone: '', address: '', note: '' });
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
    if (confirm(`${t('pages.suppliers.confirmDelete')} "${supplier.name}"?`)) {
      try {
        await deleteSupplier.mutateAsync(supplier.id);
        toast({ title: t('pages.suppliers.deleted') });
      } catch (error: any) {
        toast({ title: t('pages.suppliers.error'), description: error.message, variant: 'destructive' });
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
        toast({ title: t('pages.suppliers.updated') });
      } else {
        await createSupplier.mutateAsync({
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          address: form.address.trim() || null,
          note: form.note.trim() || null,
          branch_id: formBranchId || null,
        });
        toast({ title: t('pages.suppliers.added') });
      }
      setDialogOpen(false);
    } catch (error: any) {
      toast({ title: t('pages.suppliers.error'), description: error.message, variant: 'destructive' });
    }
  };

  return (
    <MainLayout>
      <PageHeader
        title={t('pages.suppliers.title')}
        description={t('pages.suppliers.description')}
        helpText={t('pages.suppliers.helpText')}
        actions={
          <div className="flex items-center gap-2">
            {duplicateGroups.length > 0 && (
              <Button variant="outline" onClick={() => setMergeDialogOpen(true)} className="gap-1.5">
                <Merge className="h-4 w-4" />
                <span className="hidden sm:inline">{t('pages.suppliers.mergeDuplicates')}</span>
                <Badge variant="destructive" className="ml-1 text-[10px] h-5 px-1.5">
                  {duplicateGroups.length}
                </Badge>
              </Button>
            )}
            <Button onClick={handleAdd}>
              <Plus className="mr-2 h-4 w-4" />
              {t('pages.suppliers.addSupplier')}
            </Button>
          </div>
        }
      />

      <div className="p-6 lg:p-8 space-y-4">
        <SupplierStats
          suppliers={filteredSuppliers}
          supplierStats={supplierStats}
        />

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
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{supplier.name}</h3>
                      {(supplier as any).entity_code && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-mono">
                          {(supplier as any).entity_code}
                        </Badge>
                      )}
                    </div>
                    {isSuperAdmin && supplier.branch_id && (
                      <p className="text-[10px] text-primary/70 flex items-center gap-1 mt-0.5">
                        <Building2 className="h-3 w-3" />
                        {branchNameMap.get(supplier.branch_id) || t('pages.suppliers.unknown')}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('pages.suppliers.addedDate')}: {formatDate(new Date(supplier.created_at))}
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
                        {t('pages.suppliers.viewDetails')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(supplier); }}>
                        <Pencil className="mr-2 h-4 w-4" />
                        {t('pages.suppliers.edit')}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => { e.stopPropagation(); handleDelete(supplier); }}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {t('pages.suppliers.delete')}
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

                {sortMode !== 'name' && stats && (
                  <div className="mt-3 pt-3 border-t flex flex-wrap gap-1.5">
                    {sortMode === 'most_import_value' && (
                      <Badge variant="secondary" className="text-[10px]">
                        {t('pages.suppliers.import')}: {formatCurrency(stats.totalImportValue)}
                      </Badge>
                    )}
                    {sortMode === 'highest_debt' && (
                      <Badge variant={stats.totalDebt > 0 ? "destructive" : "secondary"} className="text-[10px]">
                        {t('pages.suppliers.debt')}: {formatCurrency(stats.totalDebt)}
                      </Badge>
                    )}
                    {sortMode === 'most_receipts' && (
                      <Badge variant="secondary" className="text-[10px]">
                        {stats.receiptCount} {t('pages.suppliers.receipts')}
                      </Badge>
                    )}
                    {sortMode === 'highest_avg' && (
                      <Badge variant="secondary" className="text-[10px]">
                        {t('pages.suppliers.avg')}: {formatCurrency(stats.avgReceiptValue)}
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
            {t('pages.suppliers.noSuppliers')}
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
              {editSupplier ? t('pages.suppliers.editSupplier') : t('pages.suppliers.addSupplier')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="form-field">
              <Label htmlFor="name">{t('pages.suppliers.supplierNameRequired')}</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t('pages.suppliers.enterName')}
              />
            </div>

            <div className="form-field">
              <Label htmlFor="phone">{t('pages.suppliers.phone')}</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder={t('pages.suppliers.enterPhone')}
              />
            </div>

            <div className="form-field">
              <Label>{t('pages.suppliers.branch')}</Label>
              {editSupplier ? (
                <Input
                  value={formBranchId ? (branchNameMap.get(formBranchId) || t('pages.suppliers.unknown')) : t('pages.suppliers.notAssigned')}
                  disabled
                  className="bg-muted"
                />
              ) : isSuperAdmin ? (
                <Select value={formBranchId} onValueChange={setFormBranchId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('pages.suppliers.selectBranch')} />
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
              <Label htmlFor="address">{t('pages.suppliers.address')}</Label>
              <Input
                id="address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder={t('pages.suppliers.enterAddress')}
              />
            </div>

            <div className="form-field">
              <Label htmlFor="note">{t('pages.suppliers.note')}</Label>
              <Textarea
                id="note"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder={t('pages.suppliers.noteOptional')}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('pages.suppliers.cancel')}
            </Button>
            <Button
              onClick={handleSave}
              disabled={!form.name.trim() || createSupplier.isPending || updateSupplier.isPending}
            >
              {(createSupplier.isPending || updateSupplier.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editSupplier ? t('pages.suppliers.update') : t('pages.suppliers.addNew')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SupplierDetailDialog
        supplier={detailSupplier}
        open={!!detailSupplier}
        onOpenChange={(open) => !open && setDetailSupplier(null)}
      />

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
