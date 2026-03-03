import React, { useState, useEffect, useMemo } from 'react';
import { SearchInput } from '@/components/ui/search-input';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
  Search, 
  Filter, 
  X,
  RotateCcw,
  Package,
  Truck,
  ArrowLeft,
  Eye,
  List,
  Trash2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useBranches } from '@/hooks/useBranches';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useProducts } from '@/hooks/useProducts';
import { useExportReceiptItems, type ExportReceiptItemDetail } from '@/hooks/useExportReceipts';
import { useImportReturns, useExportReturns, useAllProfiles, useDeleteImportReturn, useDeleteExportReturn, type ImportReturn, type ExportReturn } from '@/hooks/useReturns';
import { usePermissions } from '@/hooks/usePermissions';
import { formatNumberWithSpaces } from '@/lib/formatNumber';
import { ImportReturnForm } from '@/components/returns/ImportReturnForm';
import { ExportReturnForm } from '@/components/returns/ExportReturnForm';
import { ReturnDetailDialog } from '@/components/returns/ReturnDetailDialog';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { Product } from '@/hooks/useProducts';

type ViewMode = 'history' | 'import-return' | 'export-return';
type ReturnHistoryTab = 'all' | 'export' | 'import';
type FeeTypeFilter = '_all_' | 'none' | 'percentage' | 'fixed_amount';
type DatePreset = '_custom_' | 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month';

type CombinedReturn = 
  | (ImportReturn & { returnType: 'import' })
  | (ExportReturn & { returnType: 'export' });

interface GroupedReturn {
  groupKey: string;
  returnType: 'import' | 'export';
  items: CombinedReturn[];
  return_date: string;
  totalRefundAmount: number;
  totalStoreKeepAmount: number;
  receiptCode: string | null; // original receipt code if available
  firstItem: CombinedReturn;
  productCount: number;
}

export default function ReturnsPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [datePreset, setDatePreset] = useState<DatePreset>('_custom_');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [branchFilter, setBranchFilter] = useState('_all_');
  const [employeeFilter, setEmployeeFilter] = useState('_all_');
  const [feeTypeFilter, setFeeTypeFilter] = useState<FeeTypeFilter>('_all_');
  const [paymentSourceFilters, setPaymentSourceFilters] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  
  // History Tab
  const [historyTab, setHistoryTab] = useState<ReturnHistoryTab>('all');
  
  // View mode & selected item
  const [viewMode, setViewMode] = useState<ViewMode>('history');
  const [selectedImportProduct, setSelectedImportProduct] = useState<Product | null>(null);
  const [selectedExportItem, setSelectedExportItem] = useState<ExportReceiptItemDetail | null>(null);
  
  // Detail dialog
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedReturnItem, setSelectedReturnItem] = useState<CombinedReturn | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<CombinedReturn | null>(null);

  const deleteImportReturn = useDeleteImportReturn();
  const deleteExportReturn = useDeleteExportReturn();

  const { data: permissions } = usePermissions();
  const isSuperAdmin = permissions?.canViewAllBranches === true;
  
  const { data: branches } = useBranches();
  const { data: suppliers } = useSuppliers();
  const { data: products } = useProducts();
  const { data: exportItems } = useExportReceiptItems();
  const { data: profiles } = useAllProfiles();
  
  // Apply date preset
  useEffect(() => {
    if (datePreset === '_custom_') return;
    
    const today = new Date();
    let from: Date;
    let to: Date;
    
    switch (datePreset) {
      case 'today':
        from = startOfDay(today);
        to = endOfDay(today);
        break;
      case 'yesterday':
        from = startOfDay(subDays(today, 1));
        to = endOfDay(subDays(today, 1));
        break;
      case 'this_week':
        from = startOfWeek(today, { weekStartsOn: 1 });
        to = endOfWeek(today, { weekStartsOn: 1 });
        break;
      case 'last_week':
        from = startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
        to = endOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
        break;
      case 'this_month':
        from = startOfMonth(today);
        to = endOfMonth(today);
        break;
      case 'last_month':
        from = startOfMonth(subMonths(today, 1));
        to = endOfMonth(subMonths(today, 1));
        break;
      default:
        return;
    }
    
    setDateFrom(format(from, 'yyyy-MM-dd'));
    setDateTo(format(to, 'yyyy-MM-dd'));
  }, [datePreset]);
  
  const { data: importReturns, isLoading: importLoading } = useImportReturns({
    startDate: dateFrom || undefined,
    endDate: dateTo || undefined,
    branchId: branchFilter !== '_all_' ? branchFilter : undefined,
    createdBy: employeeFilter !== '_all_' ? employeeFilter : undefined,
  });
  
  const { data: exportReturns, isLoading: exportLoading } = useExportReturns({
    startDate: dateFrom || undefined,
    endDate: dateTo || undefined,
    branchId: branchFilter !== '_all_' ? branchFilter : undefined,
    feeType: feeTypeFilter !== '_all_' ? feeTypeFilter : undefined,
    createdBy: employeeFilter !== '_all_' ? employeeFilter : undefined,
  });

  // Handle URL params for direct navigation from Import/Export History pages
  useEffect(() => {
    const type = searchParams.get('type');
    const productId = searchParams.get('productId');
    const itemId = searchParams.get('itemId');

    if (type === 'import' && productId && products) {
      const product = products.find(p => p.id === productId);
      if (product && product.status === 'in_stock') {
        setSelectedImportProduct(product);
        setViewMode('import-return');
      }
    } else if (type === 'export' && itemId && exportItems) {
      const item = exportItems.find(i => i.id === itemId);
      if (item && item.status !== 'returned') {
        setSelectedExportItem(item);
        setViewMode('export-return');
      }
    }
  }, [searchParams, products, exportItems]);

  const hasActiveFilters = dateFrom || dateTo || branchFilter !== '_all_' || employeeFilter !== '_all_' || feeTypeFilter !== '_all_' || paymentSourceFilters.length > 0;

  const clearFilters = () => {
    setDatePreset('_custom_');
    setDateFrom('');
    setDateTo('');
    setBranchFilter('_all_');
    setEmployeeFilter('_all_');
    setFeeTypeFilter('_all_');
    setPaymentSourceFilters([]);
  };

  const handleReturnSuccess = () => {
    setViewMode('history');
    setSelectedImportProduct(null);
    setSelectedExportItem(null);
    setSearchParams({});
  };

  const handleCancel = () => {
    setViewMode('history');
    setSelectedImportProduct(null);
    setSelectedExportItem(null);
    setSearchParams({});
  };

  const togglePaymentSource = (source: string) => {
    setPaymentSourceFilters(prev => 
      prev.includes(source) 
        ? prev.filter(s => s !== source) 
        : [...prev, source]
    );
  };

  // Filter and combine returns
  const filteredImportReturns = useMemo(() => {
    return importReturns?.filter((r) => {
      const matchesSearch =
        r.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.imei?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.suppliers?.name?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    }) || [];
  }, [importReturns, searchTerm]);

  const filteredExportReturns = useMemo(() => {
    return exportReturns?.filter((r) => {
      const matchesSearch =
        r.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.imei?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.customers?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.customers?.phone?.includes(searchTerm);
      return matchesSearch;
    }) || [];
  }, [exportReturns, searchTerm]);

  const combinedReturns = useMemo(() => {
    const importWithType = filteredImportReturns.map(r => ({ ...r, returnType: 'import' as const }));
    const exportWithType = filteredExportReturns.map(r => ({ ...r, returnType: 'export' as const }));
    return [...importWithType, ...exportWithType].sort(
      (a, b) => new Date(b.return_date).getTime() - new Date(a.return_date).getTime()
    );
  }, [filteredImportReturns, filteredExportReturns]);

  // Group returns by receipt
  const groupedReturns = useMemo(() => {
    const groups = new Map<string, GroupedReturn>();
    
    for (const r of combinedReturns) {
      let groupKey: string;
      let receiptCode: string | null = null;
      if (r.returnType === 'export') {
        const er = r as ExportReturn;
        groupKey = `export-${er.export_receipt_id || r.id}`;
        receiptCode = er.export_receipts?.code || null;
      } else {
        const ir = r as ImportReturn;
        groupKey = `import-${ir.import_receipt_id || r.id}`;
        receiptCode = ir.import_receipts?.code || null;
      }
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          groupKey,
          returnType: r.returnType,
          items: [],
          return_date: r.return_date,
          totalRefundAmount: 0,
          totalStoreKeepAmount: 0,
          receiptCode,
          firstItem: r,
          productCount: 0,
        });
      }
      
      const group = groups.get(groupKey)!;
      group.items.push(r);
      group.productCount++;
      
      if (r.returnType === 'import') {
        group.totalRefundAmount += (r as ImportReturn).total_refund_amount;
      } else {
        group.totalRefundAmount += (r as ExportReturn).refund_amount;
        group.totalStoreKeepAmount += (r as ExportReturn).store_keep_amount;
      }
    }
    
    return Array.from(groups.values()).sort(
      (a, b) => new Date(b.return_date).getTime() - new Date(a.return_date).getTime()
    );
  }, [combinedReturns]);

  const groupedExportReturns = useMemo(() => groupedReturns.filter(g => g.returnType === 'export'), [groupedReturns]);
  const groupedImportReturns = useMemo(() => groupedReturns.filter(g => g.returnType === 'import'), [groupedReturns]);

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const getEmployeeName = (userId: string | null) => {
    if (!userId || !profiles) return '-';
    const profile = profiles.find((p) => p.user_id === userId);
    return profile?.display_name || '-';
  };

  const openDetailDialog = (item: CombinedReturn) => {
    setSelectedReturnItem(item);
    setDetailDialogOpen(true);
  };

  const openDeleteDialog = (item: CombinedReturn) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      if (itemToDelete.returnType === 'import') {
        await deleteImportReturn.mutateAsync(itemToDelete as ImportReturn);
      } else {
        await deleteExportReturn.mutateAsync(itemToDelete as ExportReturn);
      }
      toast.success(t('pages.returns.deleteSuccess'));
    } catch (error: any) {
      toast.error(t('pages.returns.deleteError') + ': ' + (error?.message || ''));
    } finally {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  // Render form for creating return
  if (viewMode === 'import-return') {
    return (
      <MainLayout>
        <PageHeader
          title={t('pages.returns.importReturnTitle')}
          description={t('pages.returns.importReturnDesc')}
          helpText={t('pages.returns.importReturnHelp')}
          actions={
            <Button variant="outline" onClick={handleCancel}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('pages.returns.goBack')}
            </Button>
          }
        />
        <div className="p-6 max-w-4xl mx-auto">
          <ImportReturnForm 
            product={selectedImportProduct} 
            onSuccess={handleReturnSuccess}
            onCancel={handleCancel}
          />
        </div>
      </MainLayout>
    );
  }

  if (viewMode === 'export-return') {
    return (
      <MainLayout>
        <PageHeader
          title={t('pages.returns.exportReturnTitle')}
          description={t('pages.returns.exportReturnDesc')}
          helpText={t('pages.returns.exportReturnHelp')}
          actions={
            <Button variant="outline" onClick={handleCancel}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('pages.returns.goBack')}
            </Button>
          }
        />
        <div className="p-6 max-w-4xl mx-auto">
          <ExportReturnForm 
            item={selectedExportItem} 
            onSuccess={handleReturnSuccess}
            onCancel={handleCancel}
          />
        </div>
      </MainLayout>
    );
  }

  const renderGroupedTable = (groups: GroupedReturn[]) => {
    if (groups.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <RotateCcw className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>{t('pages.returns.noReturns')}</p>
          <p className="text-sm mt-1">{t('pages.returns.noReturnsHint')}</p>
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8"></TableHead>
            <TableHead>{t('pages.returns.dateTime')}</TableHead>
            <TableHead>{t('pages.returns.type')}</TableHead>
            <TableHead>{t('pages.returns.product')}</TableHead>
            <TableHead className="text-right">{t('pages.returns.totalRefund')}</TableHead>
            <TableHead className="text-right">{t('pages.returns.keepFee')}</TableHead>
            <TableHead>{t('pages.returns.target')}</TableHead>
            <TableHead>{t('common.branch')}</TableHead>
            <TableHead>{t('pages.returns.employee')}</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => {
            const isExpanded = expandedGroups.has(group.groupKey);
            const isImport = group.returnType === 'import';
            const firstItem = group.firstItem;
            const isSingleItem = group.productCount === 1;

            return (
              <React.Fragment key={group.groupKey}>
                <TableRow 
                  className={isSingleItem ? '' : 'cursor-pointer'}
                  onClick={() => !isSingleItem && toggleGroup(group.groupKey)}
                >
                  <TableCell className="px-2">
                    {!isSingleItem && (
                      isExpanded 
                        ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> 
                        : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {format(new Date(group.return_date), 'dd/MM/yyyy', { locale: vi })}
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(group.return_date), 'HH:mm', { locale: vi })}
                    </div>
                  </TableCell>
                  <TableCell>
                    {isImport ? (
                      <Badge variant="outline" className="border-orange-500 text-orange-600 bg-orange-50">
                        <Truck className="h-3 w-3 mr-1" />
                        {t('pages.returns.importType')}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-blue-500 text-blue-600 bg-blue-50">
                        <Package className="h-3 w-3 mr-1" />
                        {t('pages.returns.exportType')}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {group.receiptCode && (
                      <div className="text-xs text-muted-foreground mb-0.5">
                        {t('pages.returns.receipt')}: {group.receiptCode}
                      </div>
                    )}
                    {isSingleItem ? (
                      <>
                        <div className="font-medium">{firstItem.product_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {firstItem.imei ? `IMEI: ${firstItem.imei}` : `SKU: ${firstItem.sku}`}
                        </div>
                      </>
                    ) : (
                      <div className="font-medium">
                        {t('pages.returns.products_count', { count: group.productCount })}
                        <div className="text-xs text-muted-foreground">
                          {t('pages.returns.clickToView')}
                        </div>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {isImport ? (
                      <span className="text-green-600">{formatNumberWithSpaces(group.totalRefundAmount)}đ</span>
                    ) : (
                      <span className="text-red-600">{formatNumberWithSpaces(group.totalRefundAmount)}đ</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {group.totalStoreKeepAmount > 0 ? (
                      <span className="text-green-600">{formatNumberWithSpaces(group.totalStoreKeepAmount)}đ</span>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    {isImport ? (
                      <div>{(firstItem as ImportReturn & { returnType: 'import' }).suppliers?.name || '-'}</div>
                    ) : (
                      <div>
                        <div>{(firstItem as ExportReturn & { returnType: 'export' }).customers?.name || '-'}</div>
                        <div className="text-xs text-muted-foreground">{(firstItem as ExportReturn & { returnType: 'export' }).customers?.phone}</div>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{firstItem.branches?.name || '-'}</TableCell>
                  <TableCell>{getEmployeeName(firstItem.created_by)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); openDetailDialog(firstItem); }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {isSingleItem && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); openDeleteDialog(firstItem); }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>

                {isExpanded && !isSingleItem && group.items.map((r) => (
                  <TableRow key={`detail-${r.returnType}-${r.id}`} className="bg-muted/30">
                    <TableCell></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(r.return_date), 'HH:mm', { locale: vi })}
                    </TableCell>
                    <TableCell></TableCell>
                    <TableCell>
                      <div className="text-sm">{r.product_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.imei ? `IMEI: ${r.imei}` : `SKU: ${r.sku}`}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {r.returnType === 'import' ? (
                        <span className="text-green-600">{formatNumberWithSpaces((r as ImportReturn & { returnType: 'import' }).total_refund_amount)}đ</span>
                      ) : (
                        <span className="text-red-600">{formatNumberWithSpaces((r as ExportReturn & { returnType: 'export' }).refund_amount)}đ</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {r.returnType === 'export' && (r as ExportReturn & { returnType: 'export' }).store_keep_amount > 0 ? (
                        <span className="text-green-600">{formatNumberWithSpaces((r as ExportReturn & { returnType: 'export' }).store_keep_amount)}đ</span>
                      ) : '-'}
                    </TableCell>
                    <TableCell colSpan={2}></TableCell>
                    <TableCell></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => openDetailDialog(r)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); openDeleteDialog(r); }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    );
  };

  return (
    <MainLayout>
      <PageHeader
        title={t('pages.returns.historyTitle')}
        description={t('pages.returns.historyDesc')}
        helpText={t('pages.returns.historyHelp')}
      />

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <SearchInput
                  placeholder={t('pages.returns.searchPlaceholder')}
                  value={searchTerm}
                  onChange={setSearchTerm}
                />
              </div>
              <Button
                variant={showFilters ? 'secondary' : 'outline'}
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="mr-2 h-4 w-4" />
                {t('pages.returns.filtersBtn')}
                {hasActiveFilters && (
                  <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 flex items-center justify-center">
                    !
                  </Badge>
                )}
              </Button>
            </div>

            {showFilters && (
              <div className="space-y-4 pt-4 border-t">
                {/* Row 1: Date & Branch */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">{t('pages.returns.dateRange')}</Label>
                    <Select value={datePreset} onValueChange={(v) => setDatePreset(v as DatePreset)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="_custom_">{t('pages.returns.custom')}</SelectItem>
                        <SelectItem value="today">{t('pages.returns.today')}</SelectItem>
                        <SelectItem value="yesterday">{t('pages.returns.yesterday')}</SelectItem>
                        <SelectItem value="this_week">{t('pages.returns.thisWeek')}</SelectItem>
                        <SelectItem value="last_week">{t('pages.returns.lastWeek')}</SelectItem>
                        <SelectItem value="this_month">{t('pages.returns.thisMonth')}</SelectItem>
                        <SelectItem value="last_month">{t('pages.returns.lastMonth')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">{t('pages.returns.fromDate')}</Label>
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => { setDateFrom(e.target.value); setDatePreset('_custom_'); }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">{t('pages.returns.toDate')}</Label>
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(e) => { setDateTo(e.target.value); setDatePreset('_custom_'); }}
                    />
                  </div>
                  {isSuperAdmin && (
                    <div className="space-y-2">
                      <Label className="text-xs">{t('pages.returns.branchLabel')}</Label>
                      <Select value={branchFilter} onValueChange={setBranchFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="Tất cả" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover">
                          <SelectItem value="_all_">{t('pages.returns.allBranches')}</SelectItem>
                          {branches?.map((branch) => (
                            <SelectItem key={branch.id} value={branch.id}>
                              {branch.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label className="text-xs">{t('pages.returns.employeeLabel')}</Label>
                    <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Tất cả" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="_all_">{t('pages.returns.allEmployees')}</SelectItem>
                        {profiles?.map((profile) => (
                          <SelectItem key={profile.user_id} value={profile.user_id}>
                            {profile.display_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Row 2: Fee type & Payment sources */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">{t('pages.returns.returnMethod')}</Label>
                    <Select value={feeTypeFilter} onValueChange={(v) => setFeeTypeFilter(v as FeeTypeFilter)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Tất cả" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="_all_">{t('pages.returns.allMethods')}</SelectItem>
                        <SelectItem value="none">{t('pages.returns.fullRefund')}</SelectItem>
                        <SelectItem value="percentage">{t('pages.returns.percentFee')}</SelectItem>
                        <SelectItem value="fixed_amount">{t('pages.returns.fixedFee')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">{t('pages.returns.paymentSource')}</Label>
                    <div className="flex flex-wrap gap-3">
                      {['cash', 'bank_card', 'e_wallet', 'debt'].map((source) => {
                        const labelKey: Record<string, string> = {
                          cash: 'pages.returns.cashSource',
                          bank_card: 'pages.returns.cardSource',
                          e_wallet: 'pages.returns.eWalletSource',
                          debt: 'pages.returns.debtSource',
                        };
                        return (
                          <div key={source} className="flex items-center space-x-2">
                            <Checkbox
                              id={`source-${source}`}
                              checked={paymentSourceFilters.includes(source)}
                              onCheckedChange={() => togglePaymentSource(source)}
                            />
                            <label htmlFor={`source-${source}`} className="text-sm cursor-pointer">
                              {t(labelKey[source])}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Clear filters */}
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-1" />
                    {t('pages.returns.clearFilters')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={historyTab} onValueChange={(v) => setHistoryTab(v as ReturnHistoryTab)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="all" className="gap-2">
            <List className="h-4 w-4" />
            {t('pages.returns.allTab')} ({groupedReturns.length})
          </TabsTrigger>
          <TabsTrigger value="export" className="gap-2">
            <Package className="h-4 w-4" />
            {t('pages.returns.exportReturnTab')} ({groupedExportReturns.length})
          </TabsTrigger>
          <TabsTrigger value="import" className="gap-2">
            <Truck className="h-4 w-4" />
            {t('pages.returns.importReturnTab')} ({groupedImportReturns.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab: All */}
        <TabsContent value="all">
          <Card>
            <CardContent className="pt-6">
              {(importLoading || exportLoading) ? (
                <div className="text-center py-8 text-muted-foreground">
                  {t('pages.returns.loading')}
                </div>
              ) : renderGroupedTable(groupedReturns)}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Export Returns */}
        <TabsContent value="export">
          <Card>
            <CardContent className="pt-6">
              {exportLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  {t('pages.returns.loading')}
                </div>
              ) : renderGroupedTable(groupedExportReturns)}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Import Returns */}
        <TabsContent value="import">
          <Card>
            <CardContent className="pt-6">
              {importLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  {t('pages.returns.loading')}
                </div>
              ) : renderGroupedTable(groupedImportReturns)}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <ReturnDetailDialog
        returnItem={selectedReturnItem ? { ...selectedReturnItem, type: selectedReturnItem.returnType } as any : null}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        profiles={profiles}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('pages.returns.confirmDeleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {itemToDelete && (
                <>
                  <span dangerouslySetInnerHTML={{ __html: t('pages.returns.confirmDeleteDesc', { code: itemToDelete.code, name: itemToDelete.product_name }) }} />
                  <br />
                  <span className="text-destructive font-medium">{t('pages.returns.cannotUndo')}</span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteImportReturn.isPending || deleteExportReturn.isPending}
            >
              {(deleteImportReturn.isPending || deleteExportReturn.isPending) ? t('pages.returns.deleting') : t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
