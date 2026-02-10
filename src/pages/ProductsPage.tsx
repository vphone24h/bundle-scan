import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { ProductTable } from '@/components/products/ProductTable';
import { usePagination } from '@/hooks/usePagination';
import { TablePagination } from '@/components/ui/table-pagination';
import { BarcodeDialog } from '@/components/products/BarcodeDialog';
import { EditProductDialog } from '@/components/import/EditProductDialog';
import { useProducts, Product } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useBranches } from '@/hooks/useBranches';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Barcode, Loader2, Filter, X, Download } from 'lucide-react';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/mockData';
import { exportToExcel, formatDateForExcel } from '@/lib/exportExcel';

// Map Product to the format expected by ProductTable
function mapProductForTable(product: Product) {
  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    imei: product.imei || undefined,
    categoryId: product.category_id || '',
    categoryName: product.categories?.name,
    importPrice: Number(product.import_price),
    salePrice: product.sale_price ? Number(product.sale_price) : undefined,
    importDate: new Date(product.import_date),
    supplierId: product.supplier_id || '',
    supplierName: product.suppliers?.name,
    branchId: product.branch_id || '',
    branchName: product.branches?.name,
    status: product.status as 'in_stock' | 'sold' | 'returned',
    note: product.note || undefined,
    importReceiptId: product.import_receipt_id || undefined,
    quantity: product.quantity || 1,
  };
}

export default function ProductsPage() {
  const { data: products, isLoading } = useProducts();
  const { data: categories } = useCategories();
  const { data: suppliers } = useSuppliers();
  const { data: branches } = useBranches();
  
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const [productsForBarcode, setProductsForBarcode] = useState<any[]>([]);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  
  // Search & filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('_all_');
  const [supplierFilter, setSupplierFilter] = useState('_all_');
  const [statusFilter, setStatusFilter] = useState('_all_');
  const [branchFilter, setBranchFilter] = useState('_all_');
  const [showFilters, setShowFilters] = useState(false);

  const mappedProducts = products?.map(mapProductForTable) || [];

  const filteredProducts = useMemo(() => {
    return mappedProducts.filter((p) => {
      // Search filter
      const matchesSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.imei && p.imei.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // Date filter
      let matchesDate = true;
      if (dateFrom || dateTo) {
        const productDate = startOfDay(p.importDate);
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
      const matchesCategory = categoryFilter === '_all_' || p.categoryId === categoryFilter;
      
      // Supplier filter
      const matchesSupplier = supplierFilter === '_all_' || p.supplierId === supplierFilter;
      
      // Status filter
      const matchesStatus = statusFilter === '_all_' || p.status === statusFilter;
      
      // Branch filter
      const matchesBranch = branchFilter === '_all_' || p.branchId === branchFilter;
      
      return matchesSearch && matchesDate && matchesCategory && matchesSupplier && matchesStatus && matchesBranch;
    });
  }, [mappedProducts, searchTerm, dateFrom, dateTo, categoryFilter, supplierFilter, statusFilter, branchFilter]);

  // Pagination
  const pagination = usePagination(filteredProducts, { 
    storageKey: 'products-list'
  });

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

  const handleEdit = (product: any) => {
    // Find the original product from the products array
    const originalProduct = products?.find(p => p.id === product.id);
    if (originalProduct) {
      setEditProduct(originalProduct);
    }
  };

  const handlePrintBarcode = (prods: any[]) => {
    setProductsForBarcode(prods);
    setBarcodeOpen(true);
  };

  const handlePrintSelected = () => {
    const selected = mappedProducts.filter((p) => selectedProducts.includes(p.id));
    handlePrintBarcode(selected);
  };

  const handleExportProducts = () => {
    if (filteredProducts.length === 0) {
      toast({ title: 'Không có dữ liệu', description: 'Không có sản phẩm nào để xuất', variant: 'destructive' });
      return;
    }

    exportToExcel({
      filename: `San_pham_${format(new Date(), 'ddMMyyyy')}`,
      sheetName: 'Sản phẩm',
      columns: [
        { header: 'STT', key: 'stt', width: 6, isNumeric: true },
        { header: 'Tên sản phẩm', key: 'name', width: 35 },
        { header: 'SKU', key: 'sku', width: 18 },
        { header: 'IMEI', key: 'imei', width: 18 },
        { header: 'Danh mục', key: 'categoryName', width: 18 },
        { header: 'Giá nhập', key: 'importPrice', width: 15, isNumeric: true },
        { header: 'Giá bán', key: 'salePrice', width: 15, isNumeric: true },
        { header: 'Ngày nhập', key: 'importDate', width: 12, format: (v) => formatDateForExcel(v) },
        { header: 'Nhà cung cấp', key: 'supplierName', width: 20 },
        { header: 'Chi nhánh', key: 'branchName', width: 18 },
        { header: 'Trạng thái', key: 'status', width: 12, format: (v) => v === 'in_stock' ? 'Tồn kho' : v === 'sold' ? 'Đã bán' : 'Đã trả' },
      ],
      data: filteredProducts.map((p, index) => ({
        stt: index + 1,
        name: p.name,
        sku: p.sku,
        imei: p.imei || '',
        categoryName: p.categoryName || '',
        importPrice: p.importPrice,
        salePrice: p.salePrice || '',
        importDate: p.importDate,
        supplierName: p.supplierName || '',
        branchName: p.branchName || '',
        status: p.status,
      })),
    });

    toast({ title: 'Xuất Excel thành công', description: `Đã xuất ${filteredProducts.length} sản phẩm` });
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
        title="Quản lý sản phẩm"
        description="Xem, chỉnh sửa và in mã vạch cho sản phẩm"
        actions={
          selectedProducts.length > 0 && (
            <Button onClick={handlePrintSelected}>
              <Barcode className="mr-2 h-4 w-4" />
              In mã vạch ({selectedProducts.length})
            </Button>
          )
        }
      />

      <div className="p-4 sm:p-6 lg:p-8 space-y-4">
        {/* Filters */}
        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="space-y-4">
              {/* Search row */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Tìm theo tên, SKU hoặc IMEI..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={showFilters ? 'secondary' : 'outline'}
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex-1 sm:flex-none"
                    size="sm"
                  >
                    <Filter className="mr-1.5 sm:mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">Bộ lọc</span>
                    <span className="sm:hidden">Lọc</span>
                    {hasActiveFilters && (
                      <Badge variant="secondary" className="ml-1.5 sm:ml-2 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                        !
                      </Badge>
                    )}
                  </Button>
                  <Button variant="outline" onClick={handleExportProducts} size="sm" className="flex-1 sm:flex-none">
                    <Download className="mr-1.5 sm:mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">Xuất Excel</span>
                    <span className="sm:hidden">Excel</span>
                  </Button>
                </div>
              </div>

              {/* Extended filters */}
              {showFilters && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 sm:gap-4 pt-4 border-t">
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-[10px] sm:text-xs">Từ ngày</Label>
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-[10px] sm:text-xs">Đến ngày</Label>
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-[10px] sm:text-xs">Danh mục</Label>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Tất cả" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="_all_">Tất cả</SelectItem>
                        {categories?.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.parent_id ? `— ${cat.name}` : cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-[10px] sm:text-xs">Nhà cung cấp</Label>
                    <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Tất cả" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="_all_">Tất cả</SelectItem>
                        {suppliers?.map((sup) => (
                          <SelectItem key={sup.id} value={sup.id}>
                            {sup.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-[10px] sm:text-xs">Chi nhánh</Label>
                    <Select value={branchFilter} onValueChange={setBranchFilter}>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Tất cả" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="_all_">Tất cả</SelectItem>
                        {branches?.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-[10px] sm:text-xs">Trạng thái</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Tất cả" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="_all_">Tất cả</SelectItem>
                        <SelectItem value="in_stock">Tồn kho</SelectItem>
                        <SelectItem value="sold">Đã bán</SelectItem>
                        <SelectItem value="returned">Đã trả</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end col-span-2 sm:col-span-1">
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="w-full text-xs sm:text-sm">
                      <X className="h-4 w-4 mr-1" />
                      Xóa lọc
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Results info */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <p className="text-xs sm:text-sm text-muted-foreground">
            Hiển thị {filteredProducts.length} / {mappedProducts.length} sản phẩm
          </p>
          {selectedProducts.length > 0 && (
            <p className="text-xs sm:text-sm font-medium text-primary">
              Đã chọn {selectedProducts.length} sản phẩm
            </p>
          )}
        </div>

        {/* Table */}
        <ProductTable
          products={pagination.paginatedData}
          selectedProducts={selectedProducts}
          onSelectionChange={setSelectedProducts}
          onEdit={handleEdit}
          onPrintBarcode={handlePrintBarcode}
        />
        
        {filteredProducts.length > 0 && (
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

      {/* Barcode Dialog */}
      <BarcodeDialog
        open={barcodeOpen}
        onClose={() => setBarcodeOpen(false)}
        products={productsForBarcode}
      />

      {/* Edit Product Dialog */}
      <EditProductDialog
        product={editProduct}
        open={!!editProduct}
        onOpenChange={(open) => !open && setEditProduct(null)}
      />
    </MainLayout>
  );
}
