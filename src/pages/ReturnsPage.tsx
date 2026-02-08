import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { usePagination } from '@/hooks/usePagination';
import { TablePagination } from '@/components/ui/table-pagination';
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
} from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useBranches } from '@/hooks/useBranches';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useProducts } from '@/hooks/useProducts';
import { useExportReceiptItems, type ExportReceiptItemDetail } from '@/hooks/useExportReceipts';
import { useImportReturns, useExportReturns, useAllProfiles, type ImportReturn, type ExportReturn } from '@/hooks/useReturns';
import { usePermissions } from '@/hooks/usePermissions';
import { formatNumberWithSpaces } from '@/lib/formatNumber';
import { ImportReturnForm } from '@/components/returns/ImportReturnForm';
import { ExportReturnForm } from '@/components/returns/ExportReturnForm';
import { ReturnDetailDialog } from '@/components/returns/ReturnDetailDialog';
import type { Product } from '@/hooks/useProducts';

type ViewMode = 'history' | 'import-return' | 'export-return';
type ReturnHistoryTab = 'all' | 'export' | 'import';
type FeeTypeFilter = '_all_' | 'none' | 'percentage' | 'fixed_amount';
type DatePreset = '_custom_' | 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month';

type CombinedReturn = 
  | (ImportReturn & { returnType: 'import' })
  | (ExportReturn & { returnType: 'export' });

export default function ReturnsPage() {
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

  // Pagination for each tab
  const allReturnsPagination = usePagination(combinedReturns, { storageKey: 'returns-all' });
  const exportReturnsPagination = usePagination(
    filteredExportReturns.map(r => ({ ...r, returnType: 'export' as const })),
    { storageKey: 'returns-export' }
  );
  const importReturnsPagination = usePagination(
    filteredImportReturns.map(r => ({ ...r, returnType: 'import' as const })),
    { storageKey: 'returns-import' }
  );

  const getEmployeeName = (userId: string | null) => {
    if (!userId || !profiles) return '-';
    const profile = profiles.find((p) => p.user_id === userId);
    return profile?.display_name || '-';
  };

  const openDetailDialog = (item: CombinedReturn) => {
    setSelectedReturnItem(item);
    setDetailDialogOpen(true);
  };

  // Render form for creating return
  if (viewMode === 'import-return') {
    return (
      <MainLayout>
        <PageHeader
          title="Trả hàng nhập"
          description="Hoàn trả sản phẩm cho nhà cung cấp"
          actions={
            <Button variant="outline" onClick={handleCancel}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Quay lại
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
          title="Trả hàng bán"
          description="Khách hàng trả lại sản phẩm"
          actions={
            <Button variant="outline" onClick={handleCancel}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Quay lại
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

  const renderHistoryTable = (returns: CombinedReturn[]) => {
    if (returns.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <RotateCcw className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Chưa có phiếu trả hàng nào</p>
          <p className="text-sm mt-1">Trả hàng từ Lịch sử nhập/xuất hàng</p>
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ngày giờ</TableHead>
            <TableHead>Loại</TableHead>
            <TableHead>Sản phẩm / IMEI</TableHead>
            <TableHead className="text-right">Giá</TableHead>
            <TableHead>Hình thức</TableHead>
            <TableHead className="text-right">Hoàn trả</TableHead>
            <TableHead className="text-right">Phí giữ</TableHead>
            <TableHead>Đối tượng</TableHead>
            <TableHead>Chi nhánh</TableHead>
            <TableHead>Nhân viên</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {returns.map((r) => {
            const isImport = r.returnType === 'import';
            return (
              <TableRow key={`${r.returnType}-${r.id}`}>
                <TableCell className="whitespace-nowrap">
                  {format(new Date(r.return_date), 'dd/MM/yyyy', { locale: vi })}
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(r.return_date), 'HH:mm', { locale: vi })}
                  </div>
                </TableCell>
                <TableCell>
                  {isImport ? (
                    <Badge variant="outline" className="border-orange-500 text-orange-600 bg-orange-50">
                      <Truck className="h-3 w-3 mr-1" />
                      Nhập
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-blue-500 text-blue-600 bg-blue-50">
                      <Package className="h-3 w-3 mr-1" />
                      Bán
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="font-medium">{r.product_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.imei ? `IMEI: ${r.imei}` : `SKU: ${r.sku}`}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {isImport ? (
                    <span>{formatNumberWithSpaces(r.import_price)}đ</span>
                  ) : (
                    <span>{formatNumberWithSpaces((r as ExportReturn).sale_price)}đ</span>
                  )}
                </TableCell>
                <TableCell>
                  {isImport ? (
                    <Badge variant="secondary">Hoàn NCC</Badge>
                  ) : (
                    <Badge variant={(r as ExportReturn).fee_type === 'none' ? 'default' : 'secondary'}>
                      {(r as ExportReturn).fee_type === 'none' 
                        ? 'Hoàn đủ' 
                        : (r as ExportReturn).fee_type === 'percentage' 
                          ? `Mất ${(r as ExportReturn).fee_percentage}%`
                          : 'Mất phí'}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {isImport ? (
                    <span className="text-green-600">{formatNumberWithSpaces((r as ImportReturn).total_refund_amount)}đ</span>
                  ) : (
                    <span className="text-red-600">{formatNumberWithSpaces((r as ExportReturn).refund_amount)}đ</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {isImport ? (
                    '-'
                  ) : (r as ExportReturn).store_keep_amount > 0 ? (
                    <span className="text-green-600">{formatNumberWithSpaces((r as ExportReturn).store_keep_amount)}đ</span>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell>
                  {isImport ? (
                    <div>{(r as ImportReturn).suppliers?.name || '-'}</div>
                  ) : (
                    <div>
                      <div>{(r as ExportReturn).customers?.name || '-'}</div>
                      <div className="text-xs text-muted-foreground">{(r as ExportReturn).customers?.phone}</div>
                    </div>
                  )}
                </TableCell>
                <TableCell>{r.branches?.name || '-'}</TableCell>
                <TableCell>{getEmployeeName(r.created_by)}</TableCell>
                <TableCell>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => openDetailDialog(r)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  };

  return (
    <MainLayout>
      <PageHeader
        title="Lịch sử trả hàng"
        description="Xem lịch sử trả hàng nhập và trả hàng bán"
      />

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Tìm theo mã phiếu, IMEI, SKU, tên SP, khách hàng, NCC..."
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <Button
                variant={showFilters ? 'secondary' : 'outline'}
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="mr-2 h-4 w-4" />
                Bộ lọc
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
                    <Label className="text-xs">Khoảng thời gian</Label>
                    <Select value={datePreset} onValueChange={(v) => setDatePreset(v as DatePreset)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="_custom_">Tuỳ chọn</SelectItem>
                        <SelectItem value="today">Hôm nay</SelectItem>
                        <SelectItem value="yesterday">Hôm qua</SelectItem>
                        <SelectItem value="this_week">Tuần này</SelectItem>
                        <SelectItem value="last_week">Tuần trước</SelectItem>
                        <SelectItem value="this_month">Tháng này</SelectItem>
                        <SelectItem value="last_month">Tháng trước</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Từ ngày</Label>
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => { setDateFrom(e.target.value); setDatePreset('_custom_'); }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Đến ngày</Label>
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(e) => { setDateTo(e.target.value); setDatePreset('_custom_'); }}
                    />
                  </div>
                  {isSuperAdmin && (
                    <div className="space-y-2">
                      <Label className="text-xs">Chi nhánh</Label>
                      <Select value={branchFilter} onValueChange={setBranchFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="Tất cả" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover">
                          <SelectItem value="_all_">Tất cả chi nhánh</SelectItem>
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
                    <Label className="text-xs">Nhân viên</Label>
                    <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Tất cả" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="_all_">Tất cả nhân viên</SelectItem>
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
                    <Label className="text-xs">Hình thức trả (Trả hàng bán)</Label>
                    <Select value={feeTypeFilter} onValueChange={(v) => setFeeTypeFilter(v as FeeTypeFilter)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Tất cả" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="_all_">Tất cả</SelectItem>
                        <SelectItem value="none">Trả đủ tiền</SelectItem>
                        <SelectItem value="percentage">Mất phí (%)</SelectItem>
                        <SelectItem value="fixed_amount">Mất phí (số tiền)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Nguồn tiền</Label>
                    <div className="flex flex-wrap gap-3">
                      {['cash', 'bank_card', 'e_wallet', 'debt'].map((source) => {
                        const labels: Record<string, string> = {
                          cash: 'Tiền mặt',
                          bank_card: 'Thẻ',
                          e_wallet: 'Ví điện tử',
                          debt: 'Công nợ',
                        };
                        return (
                          <div key={source} className="flex items-center space-x-2">
                            <Checkbox
                              id={`source-${source}`}
                              checked={paymentSourceFilters.includes(source)}
                              onCheckedChange={() => togglePaymentSource(source)}
                            />
                            <label htmlFor={`source-${source}`} className="text-sm cursor-pointer">
                              {labels[source]}
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
                    Xóa bộ lọc
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
            Tất cả ({combinedReturns.length})
          </TabsTrigger>
          <TabsTrigger value="export" className="gap-2">
            <Package className="h-4 w-4" />
            Trả hàng bán ({filteredExportReturns.length})
          </TabsTrigger>
          <TabsTrigger value="import" className="gap-2">
            <Truck className="h-4 w-4" />
            Trả hàng nhập ({filteredImportReturns.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab: All */}
        <TabsContent value="all">
          <Card>
            <CardContent className="pt-6">
              {(importLoading || exportLoading) ? (
                <div className="text-center py-8 text-muted-foreground">
                  Đang tải...
                </div>
              ) : renderHistoryTable(allReturnsPagination.paginatedData)}
            </CardContent>
          </Card>
          {combinedReturns.length > 0 && (
            <TablePagination
              currentPage={allReturnsPagination.currentPage}
              totalPages={allReturnsPagination.totalPages}
              pageSize={allReturnsPagination.pageSize}
              totalItems={allReturnsPagination.totalItems}
              startIndex={allReturnsPagination.startIndex}
              endIndex={allReturnsPagination.endIndex}
              onPageChange={allReturnsPagination.setPage}
              onPageSizeChange={allReturnsPagination.setPageSize}
            />
          )}
        </TabsContent>

        {/* Tab: Export Returns */}
        <TabsContent value="export">
          <Card>
            <CardContent className="pt-6">
              {exportLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Đang tải...
                </div>
              ) : renderHistoryTable(exportReturnsPagination.paginatedData)}
            </CardContent>
          </Card>
          {filteredExportReturns.length > 0 && (
            <TablePagination
              currentPage={exportReturnsPagination.currentPage}
              totalPages={exportReturnsPagination.totalPages}
              pageSize={exportReturnsPagination.pageSize}
              totalItems={exportReturnsPagination.totalItems}
              startIndex={exportReturnsPagination.startIndex}
              endIndex={exportReturnsPagination.endIndex}
              onPageChange={exportReturnsPagination.setPage}
              onPageSizeChange={exportReturnsPagination.setPageSize}
            />
          )}
        </TabsContent>

        {/* Tab: Import Returns */}
        <TabsContent value="import">
          <Card>
            <CardContent className="pt-6">
              {importLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Đang tải...
                </div>
              ) : renderHistoryTable(importReturnsPagination.paginatedData)}
            </CardContent>
          </Card>
          {filteredImportReturns.length > 0 && (
            <TablePagination
              currentPage={importReturnsPagination.currentPage}
              totalPages={importReturnsPagination.totalPages}
              pageSize={importReturnsPagination.pageSize}
              totalItems={importReturnsPagination.totalItems}
              startIndex={importReturnsPagination.startIndex}
              endIndex={importReturnsPagination.endIndex}
              onPageChange={importReturnsPagination.setPage}
              onPageSizeChange={importReturnsPagination.setPageSize}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <ReturnDetailDialog
        returnItem={selectedReturnItem ? { ...selectedReturnItem, type: selectedReturnItem.returnType } as any : null}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        profiles={profiles}
      />
    </MainLayout>
  );
}
