import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Package, ClipboardList, FileUp, AlertTriangle, Wrench, ExternalLink, PlayCircle } from 'lucide-react';
import { differenceInDays, format } from 'date-fns';
import { MainLayout } from '@/components/layout/MainLayout';
import { usePagination } from '@/hooks/usePagination';
import { TablePagination } from '@/components/ui/table-pagination';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useInventory, useInventoryStats, InventoryItem } from '@/hooks/useInventory';
import { InventoryFiltersComponent, InventoryFilters } from '@/components/inventory/InventoryFilters';
import { InventoryTable } from '@/components/inventory/InventoryTable';
import { InventoryStats } from '@/components/inventory/InventoryStats';
import { StockCountTab } from '@/components/stockCount/StockCountTab';
import { WarrantyTab } from '@/components/inventory/WarrantyTab';
import { useToast } from '@/hooks/use-toast';
import { useStockCountGuideUrl } from '@/hooks/useAppConfig';
import { exportToExcel } from '@/lib/exportExcel';
import { useOnboardingTour } from '@/hooks/useOnboardingTour';
import { OnboardingTourOverlay, TourStep } from '@/components/onboarding/OnboardingTourOverlay';

const INVENTORY_TOUR_STEPS: TourStep[] = [
  { title: 'Tồn kho 📦', description: 'Đây là trang quản lý **tồn kho** — nơi bạn theo dõi toàn bộ hàng hóa đang có trong cửa hàng theo thời gian thực.', isInfo: true },
  { title: '📊 Bảng tồn kho', description: 'Sau khi **nhập hàng**, danh sách sản phẩm sẽ hiện ở đây với đầy đủ thông tin: **tên**, **SKU**, **chi nhánh**, **số lượng tồn**. Nếu chưa có sản phẩm, hãy vào **Nhập hàng** để thêm trước nhé!', isInfo: true },
  { title: '👆 Vuốt sang phải để xem thêm', description: 'Trên điện thoại, bảng có nhiều cột bị ẩn. Dùng ngón tay **vuốt sang phải** trên bảng để xem thêm thông tin như **giá nhập**, **tổng nhập**, **đã bán**.', isInfo: true },
  { title: '🔍 Xem chi tiết sản phẩm', description: 'Mỗi dòng có nút **"IMEI"** hoặc **"Chi tiết"** để mở popup xem toàn bộ thông tin: **danh sách IMEI**, **giá nhập**, **giá bán**, **trạng thái** từng máy.', isInfo: true },
  { title: '🔎 Bộ lọc & Tìm kiếm', description: 'Dùng thanh **tìm kiếm** để tìm nhanh theo tên, SKU hoặc IMEI. Bộ lọc giúp xem theo **danh mục**, **chi nhánh**, **loại sản phẩm** hay **trạng thái tồn kho**.', isInfo: true },
  { title: '✅ Hàng bảo hành & Kiểm kho', description: 'Tab **"Hàng bảo hành"** theo dõi hàng lỗi cần xử lý. Tab **"Kiểm kho"** giúp đối soát số lượng thực tế với hệ thống định kỳ. Vậy là xong! 🎊', isInfo: true },
];

export default function InventoryPage() {
  const { t } = useTranslation();
  const { isCompleted: tourCompleted, completeTour } = useOnboardingTour('inventory');
  const [tourDismissed, setTourDismissed] = useState(false);
  const [manualTourActive, setManualTourActive] = useState(false);
  const { toast } = useToast();
  const { data: inventory, isLoading } = useInventory();
  const stockCountGuideUrl = useStockCountGuideUrl();
  const [activeTab, setActiveTab] = useState('inventory');

  const [filters, setFilters] = useState<InventoryFilters>({
    search: '', categoryId: '', branchId: '', productType: 'all', stockStatus: 'all', oldStockDays: null, stockSort: 'none',
  });

  const filteredInventory = useMemo(() => {
    if (!inventory) return [] as InventoryItem[];
    const filtered = inventory.filter((item) => {
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesName = item.productName.toLowerCase().includes(searchLower);
        const matchesSku = item.sku.toLowerCase().includes(searchLower);
        const matchesImei = item.products.some((p) => p.imei?.toLowerCase().includes(searchLower));
        if (!matchesName && !matchesSku && !matchesImei) return false;
      }
      if (filters.categoryId && item.categoryId !== filters.categoryId) return false;
      if (filters.branchId && item.branchId !== filters.branchId) return false;
      if (filters.productType === 'with_imei' && !item.hasImei) return false;
      if (filters.productType === 'without_imei' && item.hasImei) return false;
      if (filters.stockStatus === 'in_stock' && item.stock === 0) return false;
      if (filters.stockStatus === 'low_stock' && (item.stock === 0 || item.stock > 2)) return false;
      if (filters.stockStatus === 'out_of_stock' && item.stock !== 0) return false;
      if (filters.oldStockDays !== null) {
        const oldestInStockProduct = item.products.filter((p) => p.status === 'in_stock').sort((a, b) => new Date(a.importDate).getTime() - new Date(b.importDate).getTime())[0];
        if (!oldestInStockProduct) return false;
        const daysSinceImport = differenceInDays(new Date(), new Date(oldestInStockProduct.importDate));
        if (daysSinceImport < filters.oldStockDays) return false;
      }
      return true;
    });
    if (filters.stockSort === 'stock_high') filtered.sort((a, b) => b.stock - a.stock);
    else if (filters.stockSort === 'stock_low') filtered.sort((a, b) => a.stock - b.stock);
    return filtered;
  }, [inventory, filters]);

  const pagination = usePagination(filteredInventory, { storageKey: 'inventory-list' });

  const filteredStats = useMemo(() => {
    const totalValue = filteredInventory.reduce((sum, item) => sum + item.totalImportCost, 0);
    return {
      totalProducts: filteredInventory.length,
      totalStock: filteredInventory.reduce((sum, item) => sum + item.stock, 0),
      lowStockItems: filteredInventory.filter((item) => item.stock > 0 && item.stock <= 2).length,
      outOfStockItems: filteredInventory.filter((item) => item.stock === 0).length,
      totalValue,
    };
  }, [filteredInventory]);

  const handleExportExcel = () => {
    if (filteredInventory.length === 0) {
      toast({ title: t('pages.inventory.noDataExport'), description: t('pages.inventory.noDataExportDesc'), variant: 'destructive' });
      return;
    }
    exportToExcel({
      filename: `Ton_kho_${format(new Date(), 'ddMMyyyy')}`,
      sheetName: t('pages.inventory.title'),
      columns: [
        { header: 'STT', key: 'stt', width: 6, isNumeric: true },
        { header: t('common.name'), key: 'productName', width: 35 },
        { header: 'SKU', key: 'sku', width: 18 },
        { header: t('common.branch'), key: 'branchName', width: 20 },
        { header: t('pages.products.category'), key: 'categoryName', width: 18 },
        { header: t('pages.products.status'), key: 'type', width: 12 },
        { header: t('pages.inventory.totalStock'), key: 'totalImported', width: 12, isNumeric: true },
        { header: t('pages.dashboard.soldToday'), key: 'totalSold', width: 10, isNumeric: true },
        { header: t('pages.inventory.inventoryTab'), key: 'stock', width: 10, isNumeric: true },
        { header: 'Avg', key: 'avgImportPrice', width: 15, isNumeric: true },
        { header: t('pages.inventory.stockValue'), key: 'stockValue', width: 18, isNumeric: true },
      ],
      data: filteredInventory.map((item, index) => ({
        stt: index + 1, productName: item.productName, sku: item.sku, branchName: item.branchName || '',
        categoryName: item.categoryName || '', type: item.hasImei ? t('pages.inventory.hasImei') : t('pages.inventory.noImei'),
        totalImported: item.totalImported, totalSold: item.totalSold, stock: item.stock,
        avgImportPrice: item.avgImportPrice, stockValue: item.stock * item.avgImportPrice,
      })),
    });
    toast({ title: t('pages.inventory.exportSuccess'), description: t('pages.inventory.exportedRows', { count: filteredInventory.length }) });
  };

  const handleExportForReimport = () => {
    if (filteredInventory.length === 0) {
      toast({ title: t('pages.inventory.noDataExport'), description: t('pages.inventory.noDataExportDesc'), variant: 'destructive' });
      return;
    }
    const allProducts: any[] = [];
    filteredInventory.forEach(item => {
      item.products.forEach(product => {
        if (product.status === 'in_stock') {
          allProducts.push({
            imei: product.imei || '', productName: product.name, sku: product.sku,
            importPrice: product.importPrice, importDate: product.importDate ? format(new Date(product.importDate), 'dd/MM/yyyy') : '',
            supplierName: product.supplierName || '', branchName: product.branchName || '',
            categoryName: item.categoryName || '', quantity: product.imei ? 1 : product.quantity,
            note: product.note || '', status: t('pages.products.inStock'),
          });
        }
      });
    });
    if (allProducts.length === 0) {
      toast({ title: t('pages.inventory.noDataExport'), description: t('pages.inventory.noProductsExport'), variant: 'destructive' });
      return;
    }
    exportToExcel({
      filename: `Du_lieu_nhap_lai_${format(new Date(), 'ddMMyyyy')}`,
      sheetName: t('sidebar.import'),
      columns: [
        { header: 'IMEI', key: 'imei', width: 18 }, { header: t('common.name'), key: 'productName', width: 35 },
        { header: 'SKU', key: 'sku', width: 35 }, { header: 'Price', key: 'importPrice', width: 15 },
        { header: t('common.date'), key: 'importDate', width: 12 }, { header: t('pages.products.supplier'), key: 'supplierName', width: 18 },
        { header: t('common.branch'), key: 'branchName', width: 15 }, { header: t('pages.products.category'), key: 'categoryName', width: 15 },
        { header: 'Qty', key: 'quantity', width: 10 }, { header: t('common.note'), key: 'note', width: 30 },
        { header: t('common.status'), key: 'status', width: 12 },
      ],
      data: allProducts,
    });
    toast({ title: t('pages.inventory.exportReimportSuccess'), description: t('pages.inventory.exportReimportDesc', { count: allProducts.length }) });
  };

  return (
    <MainLayout>
      <PageHeader
        title={activeTab === 'inventory' ? t('pages.inventory.title') : activeTab === 'warranty' ? t('pages.inventory.warranty') : t('pages.inventory.stockCount')}
        description={activeTab === 'inventory' ? t('pages.inventory.description') : activeTab === 'warranty' ? t('pages.inventory.warranty') : t('pages.inventory.stockCount')}
        helpText={t('pages.inventory.helpText')}
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button variant={manualTourActive ? "default" : "outline"} size="sm" onClick={() => setManualTourActive(v => !v)} className="h-8 text-xs sm:text-sm">
              <PlayCircle className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">{manualTourActive ? t('common.turnOffGuide') : t('common.viewGuide')}</span>
              <span className="sm:hidden">{manualTourActive ? t('common.turnOffGuideShort') : t('common.viewGuideShort')}</span>
            </Button>
            {activeTab === 'inventory' && (
              <>
                <Button variant="outline" onClick={handleExportForReimport} className="gap-2">
                  <FileUp className="h-4 w-4" />
                  {t('pages.inventory.exportReimport')}
                </Button>
                <Button onClick={handleExportExcel} className="gap-2">
                  <Download className="h-4 w-4" />
                  {t('pages.inventory.exportExcel')}
                </Button>
              </>
            )}
            {activeTab === 'stock-count' && stockCountGuideUrl && (
              <Button variant="outline" size="sm" onClick={() => window.open(stockCountGuideUrl, '_blank')} className="gap-2">
                <ExternalLink className="h-4 w-4" />
                {t('pages.inventory.guide')}
              </Button>
            )}
          </div>
        }
      />

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium">{t('pages.inventory.rememberExport')}</p>
            <p className="text-xs opacity-80">{t('pages.inventory.rememberExportDesc')}</p>
          </div>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="inventory" className="gap-2"><Package className="h-4 w-4" />{t('pages.inventory.inventoryTab')}</TabsTrigger>
            <TabsTrigger value="warranty" className="gap-2"><Wrench className="h-4 w-4" />{t('pages.inventory.warrantyTab')}</TabsTrigger>
            <TabsTrigger value="stock-count" className="gap-2"><ClipboardList className="h-4 w-4" />{t('pages.inventory.stockCountTab')}</TabsTrigger>
          </TabsList>
          <TabsContent value="inventory" className="space-y-4 sm:space-y-6">
            <InventoryStats {...filteredStats} />
            <InventoryFiltersComponent filters={filters} onFiltersChange={setFilters} />
            <InventoryTable data={pagination.paginatedData} isLoading={isLoading} />
            {filteredInventory.length > 0 && (
              <TablePagination currentPage={pagination.currentPage} totalPages={pagination.totalPages} pageSize={pagination.pageSize} totalItems={pagination.totalItems} startIndex={pagination.startIndex} endIndex={pagination.endIndex} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} />
            )}
          </TabsContent>
          <TabsContent value="warranty"><WarrantyTab /></TabsContent>
          <TabsContent value="stock-count"><StockCountTab /></TabsContent>
        </Tabs>
      </div>
      <OnboardingTourOverlay steps={INVENTORY_TOUR_STEPS} isActive={manualTourActive || (!tourCompleted && !tourDismissed)} onComplete={() => { completeTour(); setManualTourActive(false); }} onSkip={() => { completeTour(); setTourDismissed(true); setManualTourActive(false); }} tourKey="inventory" />
    </MainLayout>
  );
}
