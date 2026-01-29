import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useImportReceipts, useImportReceiptDetails, ImportReceipt } from '@/hooks/useImportReceipts';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useBranches } from '@/hooks/useBranches';
import { formatCurrency, formatDate } from '@/lib/mockData';
import { usePagination } from '@/hooks/usePagination';
import { TablePagination } from '@/components/ui/table-pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Search, Download, FileText, MoreHorizontal, Eye, Pencil, RotateCcw, Loader2, Filter, X, StickyNote, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { exportToExcel, formatCurrencyForExcel, formatDateForExcel } from '@/lib/exportExcel';
import type { Product } from '@/hooks/useProducts';
import { EditImportReceiptDialog } from '@/components/import/EditImportReceiptDialog';
import { ReturnImportReceiptDialog } from '@/components/import/ReturnImportReceiptDialog';
import { EditProductDialog } from '@/components/import/EditProductDialog';
import { DeleteProductDialog } from '@/components/products/DeleteProductDialog';
import { usePermissions } from '@/hooks/usePermissions';

export default function ImportHistoryPage() {
  const navigate = useNavigate();
  const { data: receipts, isLoading: receiptsLoading } = useImportReceipts();
  const { data: products, isLoading: productsLoading } = useProducts();
  const { data: categories } = useCategories();
  const { data: suppliers } = useSuppliers();
  const { data: branches } = useBranches();
  const { data: permissions } = usePermissions();
  
  // Search & filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('_all_');
  const [supplierFilter, setSupplierFilter] = useState('_all_');
  const [statusFilter, setStatusFilter] = useState('_all_');
  const [branchFilter, setBranchFilter] = useState('_all_');
  const [showFilters, setShowFilters] = useState(false);
  
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const { data: receiptDetails, isLoading: detailsLoading } = useImportReceiptDetails(selectedReceiptId);

  // Dialog states for edit and return
  const [editReceipt, setEditReceipt] = useState<ImportReceipt | null>(null);
  const [returnReceipt, setReturnReceipt] = useState<ImportReceipt | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);

  // Calculate receipt return status
  const getReceiptReturnStatus = (receipt: ImportReceipt): 'completed' | 'cancelled' | 'full_return' => {
    if (receipt.status === 'cancelled') return 'cancelled';
    
    // Check if all products from this receipt are returned
    const receiptProducts = products?.filter(p => p.import_receipt_id === receipt.id) || [];
    if (receiptProducts.length === 0) return receipt.status as 'completed' | 'cancelled';
    
    const allReturned = receiptProducts.every(p => p.status === 'returned');
    if (allReturned) return 'full_return';
    
    return 'completed';
  };

  // Filter receipts
  const filteredReceipts = useMemo(() => {
    if (!receipts) return [];
    
    return receipts.filter((r) => {
      // Search filter
      const matchesSearch = 
        r.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.suppliers?.name?.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Date filter
      let matchesDate = true;
      if (dateFrom || dateTo) {
        const receiptDate = startOfDay(new Date(r.import_date));
        if (dateFrom && dateTo) {
          matchesDate = isWithinInterval(receiptDate, {
            start: startOfDay(parseISO(dateFrom)),
            end: endOfDay(parseISO(dateTo))
          });
        } else if (dateFrom) {
          matchesDate = receiptDate >= startOfDay(parseISO(dateFrom));
        } else if (dateTo) {
          matchesDate = receiptDate <= endOfDay(parseISO(dateTo));
        }
      }
      
      // Supplier filter
      const matchesSupplier = supplierFilter === '_all_' || r.supplier_id === supplierFilter;
      
      // Branch filter
      const matchesBranch = branchFilter === '_all_' || r.branch_id === branchFilter;
      
      return matchesSearch && matchesDate && matchesSupplier && matchesBranch;
    });
  }, [receipts, searchTerm, dateFrom, dateTo, supplierFilter, branchFilter]);

  // Filter products
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    
    return products.filter((p) => {
      // Search filter
      const matchesSearch = 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.imei?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Date filter
      let matchesDate = true;
      if (dateFrom || dateTo) {
        const productDate = startOfDay(new Date(p.import_date));
        if (dateFrom && dateTo) {
          matchesDate = isWithinInterval(productDate, {
            start: startOfDay(parseISO(dateFrom)),
            end: endOfDay(parseISO(dateTo))
          });
        } else if (dateFrom) {
          matchesDate = productDate >= startOfDay(parseISO(dateFrom));
        } else if (dateTo) {
          matchesDate = productDate <= endOfDay(parseISO(dateTo));
        }
      }
      
      // Category filter
      const matchesCategory = categoryFilter === '_all_' || p.category_id === categoryFilter;
      
      // Supplier filter
      const matchesSupplier = supplierFilter === '_all_' || p.supplier_id === supplierFilter;
      
      // Status filter
      const matchesStatus = statusFilter === '_all_' || p.status === statusFilter;
      
      // Branch filter
      const matchesBranch = branchFilter === '_all_' || p.branch_id === branchFilter;
      
      return matchesSearch && matchesDate && matchesCategory && matchesSupplier && matchesStatus && matchesBranch;
    });
  }, [products, searchTerm, dateFrom, dateTo, categoryFilter, supplierFilter, statusFilter, branchFilter]);

  // Pagination for receipts tab
  const receiptsPagination = usePagination(filteredReceipts, { 
    storageKey: 'import-receipts'
  });

  // Pagination for products tab
  const productsPagination = usePagination(filteredProducts, { 
    storageKey: 'import-products'
  });

  const handleView = (receipt: ImportReceipt) => {
    setSelectedReceiptId(receipt.id);
  };

  const handleEdit = (receipt: ImportReceipt) => {
    setEditReceipt(receipt);
  };

  const handleReturn = (receipt: ImportReceipt) => {
    setReturnReceipt(receipt);
  };

  const handleReturnProduct = (product: Product) => {
    if (product.status !== 'in_stock') {
      toast({
        title: 'Không thể trả hàng',
        description: 'Sản phẩm này đã bán hoặc đã trả trước đó',
        variant: 'destructive',
      });
      return;
    }
    navigate(`/returns?type=import&productId=${product.id}`);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setDateFrom('');
    setDateTo('');
    setCategoryFilter('_all_');
    setSupplierFilter('_all_');
    setStatusFilter('_all_');
    setBranchFilter('_all_');
  };

  const hasActiveFilters = dateFrom || dateTo || categoryFilter !== '_all_' || supplierFilter !== '_all_' || statusFilter !== '_all_' || branchFilter !== '_all_';

  // Export to Excel - Receipts
  const handleExportReceipts = () => {
    if (filteredReceipts.length === 0) {
      toast({ title: 'Không có dữ liệu', description: 'Không có phiếu nhập nào để xuất', variant: 'destructive' });
      return;
    }

    exportToExcel({
      filename: `Phieu_nhap_hang_${format(new Date(), 'ddMMyyyy')}`,
      sheetName: 'Phiếu nhập hàng',
      columns: [
        { header: 'STT', key: 'stt', width: 6 },
        { header: 'Mã phiếu', key: 'code', width: 18 },
        { header: 'Ngày nhập', key: 'import_date', width: 18, format: (v) => formatDateForExcel(v, 'dd/MM/yyyy HH:mm') },
        { header: 'Tổng tiền', key: 'total_amount', width: 15, format: (v) => formatCurrencyForExcel(v) },
        { header: 'Đã thanh toán', key: 'paid_amount', width: 15, format: (v) => formatCurrencyForExcel(v) },
        { header: 'Còn nợ', key: 'debt_amount', width: 15, format: (v) => formatCurrencyForExcel(v) },
        { header: 'Nhà cung cấp', key: 'supplier_name', width: 25 },
        { header: 'Chi nhánh', key: 'branch_name', width: 20 },
        { header: 'Ghi chú', key: 'note', width: 30 },
        { header: 'Trạng thái', key: 'status', width: 12, format: (v) => v === 'completed' ? 'Hoàn tất' : 'Đã huỷ' },
      ],
      data: filteredReceipts.map((r, index) => ({
        stt: index + 1,
        code: r.code,
        import_date: r.import_date,
        total_amount: r.total_amount,
        paid_amount: r.paid_amount,
        debt_amount: r.debt_amount,
        supplier_name: r.suppliers?.name || '',
        branch_name: r.branches?.name || '',
        note: r.note || '',
        status: r.status,
      })),
    });

    toast({ title: 'Xuất Excel thành công', description: `Đã xuất ${filteredReceipts.length} phiếu nhập` });
  };

  // Export to Excel - Products
  const handleExportProducts = () => {
    if (filteredProducts.length === 0) {
      toast({ title: 'Không có dữ liệu', description: 'Không có sản phẩm nào để xuất', variant: 'destructive' });
      return;
    }

    exportToExcel({
      filename: `San_pham_nhap_${format(new Date(), 'ddMMyyyy')}`,
      sheetName: 'Sản phẩm nhập',
      columns: [
        { header: 'STT', key: 'stt', width: 6 },
        { header: 'Tên sản phẩm', key: 'name', width: 35 },
        { header: 'SKU', key: 'sku', width: 18 },
        { header: 'IMEI', key: 'imei', width: 18 },
        { header: 'Danh mục', key: 'category_name', width: 18 },
        { header: 'Giá nhập', key: 'import_price', width: 15, format: (v) => formatCurrencyForExcel(v) },
        { header: 'Ngày nhập', key: 'import_date', width: 12, format: (v) => formatDateForExcel(v) },
        { header: 'Nhà cung cấp', key: 'supplier_name', width: 20 },
        { header: 'Chi nhánh', key: 'branch_name', width: 18 },
        { header: 'Ghi chú', key: 'note', width: 25 },
        { header: 'Trạng thái', key: 'status', width: 12, format: (v) => v === 'in_stock' ? 'Tồn kho' : v === 'sold' ? 'Đã bán' : 'Đã trả' },
      ],
      data: filteredProducts.map((p, index) => ({
        stt: index + 1,
        name: p.name,
        sku: p.sku,
        imei: p.imei || '',
        category_name: p.categories?.name || '',
        import_price: p.import_price,
        import_date: p.import_date,
        supplier_name: p.suppliers?.name || '',
        branch_name: p.branches?.name || '',
        note: p.note || '',
        status: p.status,
      })),
    });

    toast({ title: 'Xuất Excel thành công', description: `Đã xuất ${filteredProducts.length} sản phẩm` });
  };

  const isLoading = receiptsLoading || productsLoading;

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
        title="Lịch sử nhập hàng"
        description="Theo dõi các phiếu nhập và sản phẩm đã nhập"
        actions={
          <Button asChild>
            <Link to="/import/new">
              <FileText className="mr-2 h-4 w-4" />
              Tạo phiếu mới
            </Link>
          </Button>
        }
      />

      <div className="p-6 lg:p-8 space-y-4">
        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* Search row */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Tìm theo tên sản phẩm, IMEI, mã phiếu..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
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

              {/* Extended filters */}
              {showFilters && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4 pt-4 border-t">
                  <div className="space-y-2">
                    <Label className="text-xs">Từ ngày</Label>
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Đến ngày</Label>
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Danh mục</Label>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Tất cả" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="_all_">Tất cả danh mục</SelectItem>
                        {categories?.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Nhà cung cấp</Label>
                    <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Tất cả" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="_all_">Tất cả NCC</SelectItem>
                        {suppliers?.map((sup) => (
                          <SelectItem key={sup.id} value={sup.id}>
                            {sup.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
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
                  <div className="space-y-2">
                    <Label className="text-xs">Trạng thái</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Tất cả" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="_all_">Tất cả trạng thái</SelectItem>
                        <SelectItem value="in_stock">Tồn kho</SelectItem>
                        <SelectItem value="sold">Đã bán</SelectItem>
                        <SelectItem value="returned">Đã trả NCC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="w-full">
                      <X className="h-4 w-4 mr-1" />
                      Xóa lọc
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="receipts" className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="receipts">
                Theo phiếu nhập ({filteredReceipts.length})
              </TabsTrigger>
              <TabsTrigger value="products">
                Theo sản phẩm ({filteredProducts.length})
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="receipts">
            <div className="flex justify-end mb-4">
              <Button variant="outline" onClick={handleExportReceipts}>
                <Download className="mr-2 h-4 w-4" />
                Xuất Excel ({filteredReceipts.length})
              </Button>
            </div>
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Mã phiếu</th>
                    <th>Ngày nhập</th>
                    <th className="text-right">Tổng tiền</th>
                    <th className="text-right">Đã thanh toán</th>
                    <th className="text-right">Còn nợ</th>
                    <th>Nhà cung cấp</th>
                    <th>Chi nhánh</th>
                    <th>Ghi chú</th>
                    <th>Trạng thái</th>
                    <th className="w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {receiptsPagination.paginatedData.map((receipt) => (
                    <tr key={receipt.id}>
                      <td className="font-mono font-medium text-primary">{receipt.code}</td>
                      <td>{formatDate(new Date(receipt.import_date))}</td>
                      <td className="text-right font-medium">{formatCurrency(Number(receipt.total_amount))}</td>
                      <td className="text-right text-success">{formatCurrency(Number(receipt.paid_amount))}</td>
                      <td className="text-right">
                        {Number(receipt.debt_amount) > 0 ? (
                          <span className="text-destructive font-medium">
                            {formatCurrency(Number(receipt.debt_amount))}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>{receipt.suppliers?.name || '-'}</td>
                      <td>{receipt.branches?.name || '-'}</td>
                      <td className="max-w-[150px] truncate" title={receipt.note || ''}>
                        {receipt.note ? (
                          <span className="flex items-center gap-1">
                            <StickyNote className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            <span className="truncate">{receipt.note}</span>
                          </span>
                        ) : '-'}
                      </td>
                      <td>
                        {(() => {
                          const returnStatus = getReceiptReturnStatus(receipt);
                          return (
                            <Badge
                              className={cn(
                                returnStatus === 'completed'
                                  ? 'status-in-stock'
                                  : returnStatus === 'full_return'
                                  ? 'bg-destructive/10 text-destructive border-destructive/20'
                                  : 'bg-destructive/10 text-destructive border-destructive/20'
                              )}
                            >
                              {returnStatus === 'completed' ? 'Hoàn tất' : returnStatus === 'full_return' ? 'Đã trả' : 'Đã huỷ'}
                            </Badge>
                          );
                        })()}
                      </td>
                      <td>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover">
                            <DropdownMenuItem onClick={() => handleView(receipt)}>
                              <Eye className="mr-2 h-4 w-4" />
                              Xem chi tiết
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(receipt)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Chỉnh sửa
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleReturn(receipt)}>
                              <RotateCcw className="mr-2 h-4 w-4" />
                              Trả hàng
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredReceipts.length === 0 && (
                <div className="py-12 text-center text-muted-foreground">
                  {hasActiveFilters ? 'Không tìm thấy phiếu nhập phù hợp' : 'Chưa có phiếu nhập nào'}
                </div>
              )}
            </div>
            {filteredReceipts.length > 0 && (
              <TablePagination
                currentPage={receiptsPagination.currentPage}
                totalPages={receiptsPagination.totalPages}
                pageSize={receiptsPagination.pageSize}
                totalItems={receiptsPagination.totalItems}
                startIndex={receiptsPagination.startIndex}
                endIndex={receiptsPagination.endIndex}
                onPageChange={receiptsPagination.setPage}
                onPageSizeChange={receiptsPagination.setPageSize}
              />
            )}
          </TabsContent>

          <TabsContent value="products">
            <div className="flex justify-end mb-4">
              <Button variant="outline" onClick={handleExportProducts}>
                <Download className="mr-2 h-4 w-4" />
                Xuất Excel ({filteredProducts.length})
              </Button>
            </div>
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tên sản phẩm</th>
                    <th>SKU</th>
                    <th>IMEI</th>
                    <th>Danh mục</th>
                    <th className="text-center">SL</th>
                    <th className="text-right">Giá nhập</th>
                    <th className="text-right">Thành tiền</th>
                    <th>Ngày nhập</th>
                    <th>Nhà cung cấp</th>
                    <th>Chi nhánh</th>
                    <th>Ghi chú</th>
                    <th>Trạng thái</th>
                    <th className="w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {productsPagination.paginatedData.map((product) => (
                    <tr key={product.id}>
                      <td className="font-medium">{product.name}</td>
                      <td className="text-muted-foreground">{product.sku}</td>
                      <td className="font-mono text-sm">{product.imei || '-'}</td>
                      <td>{product.categories?.name || '-'}</td>
                      <td className="text-center font-medium">{product.quantity}</td>
                      <td className="text-right font-medium">
                        {formatCurrency(Number(product.import_price))}
                      </td>
                      <td className="text-right font-medium text-primary">
                        {formatCurrency(Number(product.import_price) * product.quantity)}
                      </td>
                      <td>{formatDate(new Date(product.import_date))}</td>
                      <td>{product.suppliers?.name || '-'}</td>
                      <td>{product.branches?.name || '-'}</td>
                      <td className="max-w-[120px] truncate" title={product.note || ''}>
                        {product.note ? (
                          <span className="flex items-center gap-1">
                            <StickyNote className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            <span className="truncate">{product.note}</span>
                          </span>
                        ) : '-'}
                      </td>
                      <td>
                        <Badge
                          className={cn(
                            product.status === 'in_stock'
                              ? 'status-in-stock'
                              : product.status === 'sold'
                              ? 'status-sold'
                              : 'status-pending'
                          )}
                        >
                          {product.status === 'in_stock'
                            ? 'Tồn kho'
                            : product.status === 'sold'
                            ? 'Đã bán'
                            : 'Đã trả'}
                        </Badge>
                      </td>
                      <td>
                        <div className="flex gap-1">
                          {product.status === 'in_stock' && (
                            <>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => setEditProduct(product)}
                                className="h-7 w-7"
                                title="Sửa thông tin"
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleReturnProduct(product)}
                                className="h-7 text-xs"
                              >
                                <RotateCcw className="mr-1 h-3 w-3" />
                                Trả
                              </Button>
                              {/* Delete button - only for IMEI products and super_admin */}
                              {product.imei && permissions?.canDeleteIMEIProducts && (
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => setDeleteProduct(product)}
                                  className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  title="Xóa sản phẩm"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </>
                          )}
                          {product.status !== 'in_stock' && (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredProducts.length === 0 && (
                <div className="py-12 text-center text-muted-foreground">
                  {hasActiveFilters ? 'Không tìm thấy sản phẩm phù hợp' : 'Không có sản phẩm nào'}
                </div>
              )}
            </div>
            {filteredProducts.length > 0 && (
              <TablePagination
                currentPage={productsPagination.currentPage}
                totalPages={productsPagination.totalPages}
                pageSize={productsPagination.pageSize}
                totalItems={productsPagination.totalItems}
                startIndex={productsPagination.startIndex}
                endIndex={productsPagination.endIndex}
                onPageChange={productsPagination.setPage}
                onPageSizeChange={productsPagination.setPageSize}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Receipt Detail Dialog */}
      <Dialog open={!!selectedReceiptId} onOpenChange={() => setSelectedReceiptId(null)}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chi tiết phiếu nhập {receiptDetails?.receipt?.code}</DialogTitle>
          </DialogHeader>

          {detailsLoading ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : receiptDetails?.receipt && (
            <div className="space-y-6">
              {/* Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-muted/30 rounded-lg p-4">
                <div>
                  <span className="text-muted-foreground block text-xs">Ngày nhập</span>
                  <span className="font-medium">
                    {formatDate(new Date(receiptDetails.receipt.import_date))}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Nhà cung cấp</span>
                  <span className="font-medium">{receiptDetails.receipt.suppliers?.name || '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Chi nhánh</span>
                  <span className="font-medium">{receiptDetails.receipt.branches?.name || '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Trạng thái</span>
                  <Badge
                    className={cn(
                      receiptDetails.receipt.status === 'completed'
                        ? 'status-in-stock'
                        : 'bg-destructive/10 text-destructive'
                    )}
                  >
                    {receiptDetails.receipt.status === 'completed' ? 'Hoàn tất' : 'Đã huỷ'}
                  </Badge>
                </div>
              </div>

              {/* Products Table */}
              <div>
                <h4 className="font-semibold mb-3">
                  Danh sách sản phẩm ({receiptDetails.productImports?.length || 0} dòng)
                </h4>
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-3 font-medium">STT</th>
                          <th className="text-left p-3 font-medium">Tên sản phẩm</th>
                          <th className="text-left p-3 font-medium">SKU</th>
                          <th className="text-left p-3 font-medium">IMEI</th>
                          <th className="text-left p-3 font-medium">Danh mục</th>
                          <th className="text-center p-3 font-medium">SL</th>
                          <th className="text-right p-3 font-medium">Đơn giá</th>
                          <th className="text-right p-3 font-medium">Thành tiền</th>
                          <th className="text-center p-3 font-medium">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {receiptDetails.productImports?.map((item: any, index: number) => (
                          <tr key={item.id} className="hover:bg-muted/30">
                            <td className="p-3 text-muted-foreground">{index + 1}</td>
                            <td className="p-3 font-medium">{item.products?.name || 'N/A'}</td>
                            <td className="p-3 font-mono text-xs">{item.products?.sku || '-'}</td>
                            <td className="p-3 font-mono text-xs">
                              {item.products?.imei || <span className="text-muted-foreground">-</span>}
                            </td>
                            <td className="p-3 text-muted-foreground">
                              {item.products?.categories?.name || '-'}
                            </td>
                            <td className="p-3 text-center">{item.quantity}</td>
                            <td className="p-3 text-right font-medium">
                              {formatCurrency(Number(item.import_price))}
                            </td>
                            <td className="p-3 text-right font-medium">
                              {formatCurrency(Number(item.import_price) * item.quantity)}
                            </td>
                            <td className="p-3 text-center">
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-xs',
                                  item.products?.status === 'in_stock'
                                    ? 'border-success text-success'
                                    : item.products?.status === 'sold'
                                    ? 'border-primary text-primary'
                                    : 'border-destructive text-destructive'
                                )}
                              >
                                {item.products?.status === 'in_stock'
                                  ? 'Tồn kho'
                                  : item.products?.status === 'sold'
                                  ? 'Đã bán'
                                  : 'Đã trả'}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Payment Summary */}
              <div className="rounded-lg bg-muted/50 p-4 space-y-3">
                <h4 className="font-semibold">Thanh toán</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Tổng tiền:</span>
                    <span className="ml-2 font-bold text-lg">{formatCurrency(Number(receiptDetails.receipt.total_amount))}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Đã thanh toán:</span>
                    <span className="ml-2 text-success font-medium text-lg">
                      {formatCurrency(Number(receiptDetails.receipt.paid_amount))}
                    </span>
                  </div>
                  {Number(receiptDetails.receipt.debt_amount) > 0 && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Còn nợ:</span>
                      <span className="ml-2 text-destructive font-medium text-lg">
                        {formatCurrency(Number(receiptDetails.receipt.debt_amount))}
                      </span>
                    </div>
                  )}
                </div>
                {receiptDetails.payments && receiptDetails.payments.length > 0 && (
                  <div className="pt-3 border-t text-sm text-muted-foreground flex flex-wrap gap-3">
                    <span>Hình thức:</span>
                    {receiptDetails.payments.map((p: any) => (
                      <Badge key={p.id} variant="outline" className="font-normal">
                        {p.payment_type === 'cash'
                          ? 'Tiền mặt'
                          : p.payment_type === 'bank_card'
                          ? 'Thẻ NH'
                          : p.payment_type === 'e_wallet'
                          ? 'Ví ĐT'
                          : 'Công nợ'}
                        : {formatCurrency(Number(p.amount))}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {receiptDetails.receipt.note && (
                <div className="rounded-lg border p-4">
                  <h4 className="font-semibold mb-2">Ghi chú</h4>
                  <p className="text-sm text-muted-foreground">{receiptDetails.receipt.note}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Receipt Dialog */}
      <EditImportReceiptDialog
        receipt={editReceipt}
        open={!!editReceipt}
        onOpenChange={(open) => !open && setEditReceipt(null)}
      />

      {/* Return Receipt Dialog */}
      <ReturnImportReceiptDialog
        receipt={returnReceipt}
        open={!!returnReceipt}
        onOpenChange={(open) => !open && setReturnReceipt(null)}
      />

      {/* Edit Product Dialog */}
      <EditProductDialog
        product={editProduct}
        open={!!editProduct}
        onOpenChange={(open) => !open && setEditProduct(null)}
      />

      {/* Delete Product Dialog - only for IMEI products */}
      {deleteProduct && deleteProduct.imei && (
        <DeleteProductDialog
          open={!!deleteProduct}
          onOpenChange={(open) => !open && setDeleteProduct(null)}
          productId={deleteProduct.id}
          productName={deleteProduct.name}
          sku={deleteProduct.sku}
          imei={deleteProduct.imei}
        />
      )}
    </MainLayout>
  );
}
