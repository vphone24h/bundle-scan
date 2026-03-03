import { useState, useMemo, useCallback } from 'react';
import { SearchInput } from '@/components/ui/search-input';
import { useTranslation } from 'react-i18next';
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
import { Search, Barcode, Loader2, Filter, X, Download, Plus, Printer, PlayCircle, AlertCircle } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { useNavigate } from 'react-router-dom';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/mockData';
import { exportToExcel, formatDateForExcel } from '@/lib/exportExcel';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { OnboardingTourOverlay, TourStep } from '@/components/onboarding/OnboardingTourOverlay';
import { useOnboardingTour } from '@/hooks/useOnboardingTour';

const PRODUCTS_TOUR_STEPS: TourStep[] = [
  {
    title: '📦 Quản lý sản phẩm',
    description: 'Đây là trang **Quản lý sản phẩm** — nơi bạn xem toàn bộ sản phẩm trong kho, tìm kiếm, in mã vạch và chỉnh sửa thông tin sản phẩm. Sản phẩm được tạo tự động khi bạn **nhập hàng**!',
    isInfo: true,
  },
  {
    title: '🔍 Tìm kiếm sản phẩm',
    description: 'Nhập **tên sản phẩm**, **SKU** hoặc **IMEI** vào ô tìm kiếm để lọc nhanh. Nhấn **"Bộ lọc"** để mở thêm tùy chọn lọc theo danh mục, nhà cung cấp, trạng thái...',
    targetSelector: '[data-tour="product-search"]',
    position: 'bottom',
  },
  {
    title: '☑️ Chọn nhiều sản phẩm',
    description: 'Tick vào **ô checkbox** để chọn một hoặc nhiều sản phẩm cùng lúc. Sau khi chọn, nút **"In mã vạch"** sẽ xuất hiện để in tem cho tất cả sản phẩm đã chọn chỉ một lần!',
    targetSelector: '[data-tour="product-select-all"]',
    position: 'bottom',
  },
  {
    title: '🖨️ In mã vạch hàng loạt',
    description: 'Sau khi chọn sản phẩm, nhấn nút **"In mã vạch"** ở góc trên phải để in tem cho tất cả sản phẩm đã chọn. Tem có thể in **barcode** hoặc **QR code** tùy cấu hình.',
    targetSelector: '[data-tour="product-print-btn"]',
    position: 'bottom',
  },
  {
    title: '⚙️ Thao tác với sản phẩm',
    description: 'Nhấn nút **"⋯"** (ba chấm) ở cuối mỗi dòng để mở menu thao tác: **Chỉnh sửa** thông tin, **In mã vạch** riêng lẻ, hoặc **Điều chỉnh số lượng** (nếu là hàng không IMEI).',
    targetSelector: '[data-tour="product-action-menu"]',
    position: 'left',
  },
];

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
    isPrinted: product.is_printed || false,
  };
}

export default function ProductsPage() {
  const { t } = useTranslation();
  const { isCompleted: tourCompleted, completeTour } = useOnboardingTour('products-page-v1');
  const [tourDismissed, setTourDismissed] = useState(false);
  const [manualTourActive, setManualTourActive] = useState(false);
  const navigate = useNavigate();
  const { data: products, isLoading } = useProducts();
  const queryClient = useQueryClient();
  const { data: categories } = useCategories();
  const { data: suppliers } = useSuppliers();
  const { data: branches } = useBranches();
  
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const [productsForBarcode, setProductsForBarcode] = useState<any[]>([]);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('_all_');
  const [supplierFilter, setSupplierFilter] = useState('_all_');
  const [statusFilter, setStatusFilter] = useState('_all_');
  const [branchFilter, setBranchFilter] = useState('_all_');
  const [printedFilter, setPrintedFilter] = useState('_all_');
  const [showFilters, setShowFilters] = useState(false);

  const mappedProducts = products?.map(mapProductForTable) || [];

  const filteredProducts = useMemo(() => {
    return mappedProducts.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.imei && p.imei.toLowerCase().includes(searchTerm.toLowerCase()));
      
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
      
      const matchesCategory = categoryFilter === '_all_' || p.categoryId === categoryFilter;
      const matchesSupplier = supplierFilter === '_all_' || p.supplierId === supplierFilter;
      const matchesStatus = statusFilter === '_all_' || p.status === statusFilter;
      const matchesBranch = branchFilter === '_all_' || p.branchId === branchFilter;
      const matchesPrinted = printedFilter === '_all_' || 
        (printedFilter === 'printed' && p.isPrinted) || 
        (printedFilter === 'not_printed' && !p.isPrinted);
      
      return matchesSearch && matchesDate && matchesCategory && matchesSupplier && matchesStatus && matchesBranch && matchesPrinted;
    });
  }, [mappedProducts, searchTerm, dateFrom, dateTo, categoryFilter, supplierFilter, statusFilter, branchFilter, printedFilter]);

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
    setPrintedFilter('_all_');
  };

  const hasActiveFilters = dateFrom || dateTo || categoryFilter !== '_all_' || supplierFilter !== '_all_' || statusFilter !== '_all_' || branchFilter !== '_all_' || printedFilter !== '_all_';

  const handleEdit = (product: any) => {
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
      toast({ title: t('pages.products.noData'), description: t('pages.products.noProductsToExport'), variant: 'destructive' });
      return;
    }

    exportToExcel({
      filename: `San_pham_${format(new Date(), 'ddMMyyyy')}`,
      sheetName: t('sidebar.products'),
      columns: [
        { header: 'STT', key: 'stt', width: 6, isNumeric: true },
        { header: t('pages.products.searchPlaceholder').split(',')[0], key: 'name', width: 35 },
        { header: 'SKU', key: 'sku', width: 18 },
        { header: 'IMEI', key: 'imei', width: 18 },
        { header: t('pages.products.category'), key: 'categoryName', width: 18 },
        { header: t('pages.products.fromDate'), key: 'importPrice', width: 15, isNumeric: true },
        { header: t('pages.products.toDate'), key: 'salePrice', width: 15, isNumeric: true },
        { header: t('pages.products.fromDate'), key: 'importDate', width: 12, format: (v) => formatDateForExcel(v) },
        { header: t('pages.products.supplier'), key: 'supplierName', width: 20 },
        { header: t('pages.products.branch'), key: 'branchName', width: 18 },
        { header: t('pages.products.status'), key: 'status', width: 12, format: (v) => v === 'in_stock' ? t('pages.products.inStock') : v === 'sold' ? t('pages.products.sold') : t('pages.products.returned') },
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

    toast({ title: t('pages.products.exportSuccess'), description: t('pages.products.exportedProducts', { count: filteredProducts.length }) });
  };

  return (
    <MainLayout>
      <PageHeader
        title={t('pages.products.title')}
        description={t('pages.products.description')}
        helpText={t('pages.products.helpText')}
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={manualTourActive ? 'default' : 'outline'}
              size="sm"
              onClick={() => setManualTourActive(v => !v)}
            >
              <PlayCircle className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">{manualTourActive ? t('pages.products.turnOffGuide') : t('pages.products.viewGuide')}</span>
              <span className="sm:hidden">HD</span>
            </Button>
            <Button onClick={() => navigate('/import/new')} size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              {t('pages.products.addProduct')}
            </Button>
            <div className="flex items-center gap-1" data-tour="product-print-btn">
              <Button
                onClick={handlePrintSelected}
                size="sm"
                variant="outline"
                disabled={selectedProducts.length === 0}
                className={selectedProducts.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}
              >
                <Barcode className="mr-1.5 h-4 w-4" />
                {t('pages.products.printBarcode')} {selectedProducts.length > 0 ? `(${selectedProducts.length})` : ''}
              </Button>
              {selectedProducts.length === 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="text-muted-foreground hover:text-foreground transition-colors p-1">
                      <AlertCircle className="h-4 w-4" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto px-3 py-2 text-sm">
                    {t('pages.products.selectToPrint')}
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>
        }
      />

      <div className="p-4 sm:p-6 lg:p-8 space-y-4">
        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <SearchInput
                  placeholder={t('pages.products.searchPlaceholder')}
                  value={searchTerm}
                  onChange={setSearchTerm}
                  containerClassName="flex-1 data-[tour='product-search']"
                />
                <div className="flex gap-2">
                  <Button
                    variant={showFilters ? 'secondary' : 'outline'}
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex-1 sm:flex-none"
                    size="sm"
                  >
                    <Filter className="mr-1.5 sm:mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">{t('pages.products.filters')}</span>
                    <span className="sm:hidden">{t('pages.products.filtersShort')}</span>
                    {hasActiveFilters && (
                      <Badge variant="secondary" className="ml-1.5 sm:ml-2 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                        !
                      </Badge>
                    )}
                  </Button>
                  <Button variant="outline" onClick={handleExportProducts} size="sm" className="flex-1 sm:flex-none">
                    <Download className="mr-1.5 sm:mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">{t('pages.products.exportExcel')}</span>
                    <span className="sm:hidden">Excel</span>
                  </Button>
                </div>
              </div>

              {showFilters && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-8 gap-3 sm:gap-4 pt-4 border-t">
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-[10px] sm:text-xs">{t('pages.products.fromDate')}</Label>
                    <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="text-sm" />
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-[10px] sm:text-xs">{t('pages.products.toDate')}</Label>
                    <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="text-sm" />
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-[10px] sm:text-xs">{t('pages.products.category')}</Label>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger className="text-sm"><SelectValue placeholder={t('pages.products.allFilter')} /></SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="_all_">{t('pages.products.allFilter')}</SelectItem>
                        {categories?.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.parent_id ? `— ${cat.name}` : cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-[10px] sm:text-xs">{t('pages.products.supplier')}</Label>
                    <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                      <SelectTrigger className="text-sm"><SelectValue placeholder={t('pages.products.allFilter')} /></SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="_all_">{t('pages.products.allFilter')}</SelectItem>
                        {suppliers?.map((sup) => (<SelectItem key={sup.id} value={sup.id}>{sup.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-[10px] sm:text-xs">{t('pages.products.branch')}</Label>
                    <Select value={branchFilter} onValueChange={setBranchFilter}>
                      <SelectTrigger className="text-sm"><SelectValue placeholder={t('pages.products.allFilter')} /></SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="_all_">{t('pages.products.allFilter')}</SelectItem>
                        {branches?.map((branch) => (<SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-[10px] sm:text-xs">{t('pages.products.status')}</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="text-sm"><SelectValue placeholder={t('pages.products.allFilter')} /></SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="_all_">{t('pages.products.allFilter')}</SelectItem>
                        <SelectItem value="in_stock">{t('pages.products.inStock')}</SelectItem>
                        <SelectItem value="sold">{t('pages.products.sold')}</SelectItem>
                        <SelectItem value="returned">{t('pages.products.returned')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-[10px] sm:text-xs">{t('pages.products.printStatus')}</Label>
                    <Select value={printedFilter} onValueChange={setPrintedFilter}>
                      <SelectTrigger className="text-sm"><SelectValue placeholder={t('pages.products.allFilter')} /></SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="_all_">{t('pages.products.allFilter')}</SelectItem>
                        <SelectItem value="printed">{t('pages.products.printed')}</SelectItem>
                        <SelectItem value="not_printed">{t('pages.products.notPrinted')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end col-span-2 sm:col-span-1">
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="w-full text-xs sm:text-sm">
                      <X className="h-4 w-4 mr-1" />
                      {t('pages.products.clearFilters')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <p className="text-xs sm:text-sm text-muted-foreground">
            {t('pages.products.showingProducts', { filtered: filteredProducts.length, total: mappedProducts.length })}
          </p>
          {selectedProducts.length > 0 && (
            <p className="text-xs sm:text-sm font-medium text-primary">
              {t('pages.products.selectedProducts', { count: selectedProducts.length })}
            </p>
          )}
        </div>

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

      <BarcodeDialog
        open={barcodeOpen}
        onClose={() => setBarcodeOpen(false)}
        products={productsForBarcode}
        onPrinted={async (productIds) => {
          const { error } = await supabase
            .from('products')
            .update({ is_printed: true })
            .in('id', productIds);
          if (!error) {
            queryClient.invalidateQueries({ queryKey: ['products'], refetchType: 'all' });
          } else {
            console.error('Failed to mark products as printed:', error);
          }
        }}
      />

      <EditProductDialog
        product={editProduct}
        open={!!editProduct}
        onOpenChange={(open) => !open && setEditProduct(null)}
      />

      <OnboardingTourOverlay
        steps={PRODUCTS_TOUR_STEPS}
        isActive={manualTourActive || (!tourCompleted && !tourDismissed)}
        onComplete={() => { completeTour(); setManualTourActive(false); }}
        onSkip={() => { completeTour(); setTourDismissed(true); setManualTourActive(false); }}
        tourKey="products-page-v1"
      />
    </MainLayout>
  );
}
