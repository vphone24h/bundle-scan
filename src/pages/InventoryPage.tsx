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

function useInventoryTourSteps(): TourStep[] {
  const { t } = useTranslation();
  return [
    { title: t('tours.inventory.tourTitle1'), description: t('tours.inventory.tourDesc1'), isInfo: true },
    { title: t('tours.inventory.tourTitle2'), description: t('tours.inventory.tourDesc2'), isInfo: true },
    { title: t('tours.inventory.tourTitle3'), description: t('tours.inventory.tourDesc3'), isInfo: true },
    { title: t('tours.inventory.tourTitle4'), description: t('tours.inventory.tourDesc4'), isInfo: true },
    { title: t('tours.inventory.tourTitle5'), description: t('tours.inventory.tourDesc5'), isInfo: true },
    { title: t('tours.inventory.tourTitle6'), description: t('tours.inventory.tourDesc6'), isInfo: true },
  ];
}

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
        if (!matchesName && !matchesSku) return false;
      }
      if (filters.categoryId && item.categoryId !== filters.categoryId) return false;
      if (filters.branchId && item.branchId !== filters.branchId) return false;
      if (filters.productType === 'with_imei' && !item.hasImei) return false;
      if (filters.productType === 'without_imei' && item.hasImei) return false;
      if (filters.stockStatus === 'in_stock' && item.stock === 0) return false;
      if (filters.stockStatus === 'low_stock' && (item.stock === 0 || item.stock > 2)) return false;
      if (filters.stockStatus === 'out_of_stock' && item.stock !== 0) return false;
      if (filters.oldStockDays !== null) {
        if (!item.oldestImportDate) return false;
        const daysSinceImport = differenceInDays(new Date(), new Date(item.oldestImportDate));
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

  const handleExportForReimport = async () => {
    if (filteredInventory.length === 0) {
      toast({ title: t('pages.inventory.noDataExport'), description: t('pages.inventory.noDataExportDesc'), variant: 'destructive' });
      return;
    }
    toast({ title: 'Đang tải dữ liệu...', description: 'Vui lòng đợi trong giây lát' });
    
    // Fetch all in_stock products for reimport export
    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, sku, imei, import_price, import_date, quantity, note, supplier_id, branch_id, suppliers(name), branches(name)')
      .eq('status', 'in_stock' as any)
      .order('name');

    if (error || !products || products.length === 0) {
      toast({ title: t('pages.inventory.noDataExport'), description: t('pages.inventory.noProductsExport'), variant: 'destructive' });
      return;
    }

    // Filter by current inventory filter (name+sku match)
    const inventoryKeys = new Set(filteredInventory.map(i => `${i.productName}|${i.sku}`));
    const allProducts = products
      .filter((p: any) => inventoryKeys.has(`${p.name}|${p.sku}`))
      .map((p: any) => ({
        imei: p.imei || '', productName: p.name, sku: p.sku,
        importPrice: p.import_price, importDate: p.import_date ? format(new Date(p.import_date), 'dd/MM/yyyy') : '',
        supplierName: p.suppliers?.name || '', branchName: p.branches?.name || '',
        categoryName: '', quantity: p.imei ? 1 : (p.quantity || 1),
        note: p.note || '', status: t('pages.products.inStock'),
      }));

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
      <OnboardingTourOverlay steps={useInventoryTourSteps()} isActive={manualTourActive || (!tourCompleted && !tourDismissed)} onComplete={() => { completeTour(); setManualTourActive(false); }} onSkip={() => { completeTour(); setTourDismissed(true); setManualTourActive(false); }} tourKey="inventory" />
    </MainLayout>
  );
}
