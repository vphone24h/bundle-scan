import { useState, useMemo } from 'react';
import { Download, Package, ClipboardList, FileUp, AlertTriangle } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { exportToExcel, formatCurrencyForExcel } from '@/lib/exportExcel';

export default function InventoryPage() {
  const { toast } = useToast();
  const { data: inventory, isLoading } = useInventory();
  // Bỏ useInventoryStats vì đã tính filteredStats bên dưới
  const [activeTab, setActiveTab] = useState('inventory');

  const [filters, setFilters] = useState<InventoryFilters>({
    search: '',
    categoryId: '',
    branchId: '',
    productType: 'all',
    stockStatus: 'all',
    oldStockDays: null,
  });

  // Filter inventory based on filters
  const filteredInventory = useMemo(() => {
    if (!inventory) return [];

    return inventory.filter((item) => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesName = item.productName.toLowerCase().includes(searchLower);
        const matchesSku = item.sku.toLowerCase().includes(searchLower);
        const matchesImei = item.products.some(
          (p) => p.imei?.toLowerCase().includes(searchLower)
        );
        if (!matchesName && !matchesSku && !matchesImei) return false;
      }

      // Category filter
      if (filters.categoryId && item.categoryId !== filters.categoryId) {
        return false;
      }

      // Branch filter
      if (filters.branchId && item.branchId !== filters.branchId) {
        return false;
      }

      // Product type filter
      if (filters.productType === 'with_imei' && !item.hasImei) return false;
      if (filters.productType === 'without_imei' && item.hasImei) return false;

      // Stock status filter
      if (filters.stockStatus === 'in_stock' && item.stock === 0) return false;
      if (filters.stockStatus === 'low_stock' && (item.stock === 0 || item.stock > 2)) return false;
      if (filters.stockStatus === 'out_of_stock' && item.stock !== 0) return false;

      // Old stock filter
      if (filters.oldStockDays !== null) {
        const oldestInStockProduct = item.products
          .filter((p) => p.status === 'in_stock')
          .sort((a, b) => new Date(a.importDate).getTime() - new Date(b.importDate).getTime())[0];

        if (!oldestInStockProduct) return false;

        const daysSinceImport = differenceInDays(new Date(), new Date(oldestInStockProduct.importDate));
        if (daysSinceImport < filters.oldStockDays) return false;
      }

      return true;
    });
  }, [inventory, filters]);

  // Pagination
  const pagination = usePagination(filteredInventory, { 
    storageKey: 'inventory-list'
  });

  // Calculate filtered stats including total value
  const filteredStats = useMemo(() => {
    // Tính tổng giá trị kho = sum(stock * avgImportPrice) cho mỗi item
    const totalValue = filteredInventory.reduce((sum, item) => {
      return sum + (item.stock * item.avgImportPrice);
    }, 0);

    return {
      totalProducts: filteredInventory.length,
      totalStock: filteredInventory.reduce((sum, item) => sum + item.stock, 0),
      lowStockItems: filteredInventory.filter((item) => item.stock > 0 && item.stock <= 2).length,
      outOfStockItems: filteredInventory.filter((item) => item.stock === 0).length,
      totalValue,
    };
  }, [filteredInventory]);

  // Export to Excel (summary view)
  const handleExportExcel = () => {
    if (filteredInventory.length === 0) {
      toast({
        title: 'Không có dữ liệu',
        description: 'Không có dữ liệu tồn kho để xuất',
        variant: 'destructive',
      });
      return;
    }

    exportToExcel({
      filename: `Ton_kho_${format(new Date(), 'ddMMyyyy')}`,
      sheetName: 'Tồn kho',
      columns: [
        { header: 'STT', key: 'stt', width: 6 },
        { header: 'Tên sản phẩm', key: 'productName', width: 35 },
        { header: 'SKU', key: 'sku', width: 18 },
        { header: 'Chi nhánh', key: 'branchName', width: 20 },
        { header: 'Danh mục', key: 'categoryName', width: 18 },
        { header: 'Loại', key: 'type', width: 12 },
        { header: 'Tổng nhập', key: 'totalImported', width: 12 },
        { header: 'Đã bán', key: 'totalSold', width: 10 },
        { header: 'Tồn kho', key: 'stock', width: 10 },
        { header: 'Giá nhập TB', key: 'avgImportPrice', width: 15, format: (v) => formatCurrencyForExcel(v) },
        { header: 'Giá trị tồn', key: 'stockValue', width: 18, format: (v) => formatCurrencyForExcel(v) },
      ],
      data: filteredInventory.map((item, index) => ({
        stt: index + 1,
        productName: item.productName,
        sku: item.sku,
        branchName: item.branchName || '',
        categoryName: item.categoryName || '',
        type: item.hasImei ? 'Có IMEI' : 'Không IMEI',
        totalImported: item.totalImported,
        totalSold: item.totalSold,
        stock: item.stock,
        avgImportPrice: item.avgImportPrice,
        stockValue: item.stock * item.avgImportPrice,
      })),
    });

    toast({
      title: 'Xuất Excel thành công',
      description: `Đã xuất ${filteredInventory.length} dòng dữ liệu`,
    });
  };

  // Export for re-import (detailed format matching import template)
  const handleExportForReimport = () => {
    if (filteredInventory.length === 0) {
      toast({
        title: 'Không có dữ liệu',
        description: 'Không có dữ liệu tồn kho để xuất',
        variant: 'destructive',
      });
      return;
    }

    // Flatten all in-stock products from inventory
    const allProducts: any[] = [];
    filteredInventory.forEach(item => {
      item.products.forEach(product => {
        if (product.status === 'in_stock') {
          allProducts.push({
            imei: product.imei || '',
            productName: product.name,
            sku: product.sku,
            importPrice: product.importPrice,
            importDate: product.importDate ? format(new Date(product.importDate), 'dd/MM/yyyy') : '',
            supplierName: product.supplierName || '',
            branchName: product.branchName || '',
            categoryName: item.categoryName || '',
            quantity: product.imei ? 1 : product.quantity,
            note: product.note || '',
            status: 'Tồn kho',
          });
        }
      });
    });

    if (allProducts.length === 0) {
      toast({
        title: 'Không có dữ liệu',
        description: 'Không có sản phẩm tồn kho để xuất',
        variant: 'destructive',
      });
      return;
    }

    // Export with import template format
    exportToExcel({
      filename: `Du_lieu_nhap_lai_${format(new Date(), 'ddMMyyyy')}`,
      sheetName: 'Nhập hàng',
      columns: [
        { header: 'IMEI', key: 'imei', width: 18 },
        { header: 'Tên sản phẩm', key: 'productName', width: 35 },
        { header: 'SKU', key: 'sku', width: 35 },
        { header: 'Giá nhập', key: 'importPrice', width: 15 },
        { header: 'Ngày nhập', key: 'importDate', width: 12 },
        { header: 'Nhà cung cấp', key: 'supplierName', width: 18 },
        { header: 'Chi nhánh', key: 'branchName', width: 15 },
        { header: 'Thư mục', key: 'categoryName', width: 15 },
        { header: 'Số lượng', key: 'quantity', width: 10 },
        { header: 'Ghi chú', key: 'note', width: 30 },
        { header: 'Trạng thái', key: 'status', width: 12 },
      ],
      data: allProducts,
    });

    toast({
      title: 'Xuất file nhập lại thành công',
      description: `Đã xuất ${allProducts.length} sản phẩm theo định dạng file mẫu nhập hàng`,
    });
  };

  return (
    <MainLayout>
      <PageHeader
        title="Tồn kho"
        description="Quản lý và theo dõi tồn kho theo thời gian thực"
        actions={
          activeTab === 'inventory' && (
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={handleExportForReimport} className="gap-2">
                <FileUp className="h-4 w-4" />
                Xuất file nhập lại
              </Button>
              <Button onClick={handleExportExcel} className="gap-2">
                <Download className="h-4 w-4" />
                Xuất Excel
              </Button>
            </div>
          )
        }
      />

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Reminder banner */}
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <p className="text-sm font-medium">
            Nhớ xuất file ra Excel mỗi ngày để lưu trữ dữ liệu!
          </p>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="inventory" className="gap-2">
              <Package className="h-4 w-4" />
              Tồn kho
            </TabsTrigger>
            <TabsTrigger value="stock-count" className="gap-2">
              <ClipboardList className="h-4 w-4" />
              Kiểm kho
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inventory" className="space-y-4 sm:space-y-6">
            {/* Stats */}
            <InventoryStats {...filteredStats} />

            {/* Filters */}
            <InventoryFiltersComponent filters={filters} onFiltersChange={setFilters} />

            {/* Table */}
            <InventoryTable data={pagination.paginatedData} isLoading={isLoading} />
            
            {filteredInventory.length > 0 && (
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
          </TabsContent>

          <TabsContent value="stock-count">
            <StockCountTab />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
