import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { ProductTable } from '@/components/products/ProductTable';
import { BarcodeDialog } from '@/components/products/BarcodeDialog';
import { useProducts, Product } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useSuppliers } from '@/hooks/useSuppliers';
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
    importDate: new Date(product.import_date),
    supplierId: product.supplier_id || '',
    supplierName: product.suppliers?.name,
    status: product.status as 'in_stock' | 'sold' | 'returned',
    note: product.note || undefined,
    importReceiptId: product.import_receipt_id || undefined,
  };
}

export default function ProductsPage() {
  const { data: products, isLoading } = useProducts();
  const { data: categories } = useCategories();
  const { data: suppliers } = useSuppliers();
  
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const [productsForBarcode, setProductsForBarcode] = useState<any[]>([]);
  
  // Search & filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('_all_');
  const [supplierFilter, setSupplierFilter] = useState('_all_');
  const [statusFilter, setStatusFilter] = useState('_all_');
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
      
      return matchesSearch && matchesDate && matchesCategory && matchesSupplier && matchesStatus;
    });
  }, [mappedProducts, searchTerm, dateFrom, dateTo, categoryFilter, supplierFilter, statusFilter]);

  const clearFilters = () => {
    setSearchTerm('');
    setDateFrom('');
    setDateTo('');
    setCategoryFilter('_all_');
    setSupplierFilter('_all_');
    setStatusFilter('_all_');
  };

  const hasActiveFilters = dateFrom || dateTo || categoryFilter !== '_all_' || supplierFilter !== '_all_' || statusFilter !== '_all_';

  const handleEdit = (product: any) => {
    console.log('Edit product:', product);
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

    const headers = ['Tên sản phẩm', 'SKU', 'IMEI', 'Danh mục', 'Giá nhập', 'Ngày nhập', 'Nhà cung cấp', 'Trạng thái'];
    const rows = filteredProducts.map(p => [
      p.name,
      p.sku,
      p.imei || '',
      p.categoryName || '',
      p.importPrice,
      format(p.importDate, 'dd/MM/yyyy'),
      p.supplierName || '',
      p.status === 'in_stock' ? 'Tồn kho' : p.status === 'sold' ? 'Đã bán' : 'Đã trả'
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `san-pham-${format(new Date(), 'yyyyMMdd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);

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
                    placeholder="Tìm theo tên, SKU hoặc IMEI..."
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
                <Button variant="outline" onClick={handleExportProducts}>
                  <Download className="mr-2 h-4 w-4" />
                  Xuất Excel
                </Button>
              </div>

              {/* Extended filters */}
              {showFilters && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 pt-4 border-t">
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
                            {cat.parent_id ? `— ${cat.name}` : cat.name}
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

        {/* Results info */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Hiển thị {filteredProducts.length} / {mappedProducts.length} sản phẩm
          </p>
          {selectedProducts.length > 0 && (
            <p className="text-sm font-medium text-primary">
              Đã chọn {selectedProducts.length} sản phẩm
            </p>
          )}
        </div>

        {/* Table */}
        <ProductTable
          products={filteredProducts}
          selectedProducts={selectedProducts}
          onSelectionChange={setSelectedProducts}
          onEdit={handleEdit}
          onPrintBarcode={handlePrintBarcode}
        />
      </div>

      {/* Barcode Dialog */}
      <BarcodeDialog
        open={barcodeOpen}
        onClose={() => setBarcodeOpen(false)}
        products={productsForBarcode}
      />
    </MainLayout>
  );
}
