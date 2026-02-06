import { useState, useMemo } from 'react';
import { Download, Wrench } from 'lucide-react';
import { differenceInDays, format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { usePagination } from '@/hooks/usePagination';
import { TablePagination } from '@/components/ui/table-pagination';
import { useWarrantyInventory } from '@/hooks/useWarrantyInventory';
import { InventoryFiltersComponent, InventoryFilters } from './InventoryFilters';
import { WarrantyTable } from './WarrantyTable';
import { InventoryStats } from './InventoryStats';
import { useToast } from '@/hooks/use-toast';
import { exportToExcel } from '@/lib/exportExcel';

export function WarrantyTab() {
  const { toast } = useToast();
  const { data: warrantyInventory, isLoading } = useWarrantyInventory();

  const [filters, setFilters] = useState<InventoryFilters>({
    search: '',
    categoryId: '',
    branchId: '',
    productType: 'all',
    stockStatus: 'all',
    oldStockDays: null,
    stockSort: 'none',
  });

  // Filter warranty inventory based on filters
  const filteredInventory = useMemo(() => {
    if (!warrantyInventory) return [];

    return warrantyInventory.filter((item) => {
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

      return true;
    });
  }, [warrantyInventory, filters]);

  // Pagination
  const pagination = usePagination(filteredInventory, {
    storageKey: 'warranty-inventory-list',
  });

  // Calculate filtered stats
  const filteredStats = useMemo(() => {
    const totalValue = filteredInventory.reduce((sum, item) => {
      return sum + item.stock * item.avgImportPrice;
    }, 0);

    return {
      totalProducts: filteredInventory.length,
      totalStock: filteredInventory.reduce((sum, item) => sum + item.stock, 0),
      lowStockItems: 0,
      outOfStockItems: 0,
      totalValue,
    };
  }, [filteredInventory]);

  // Export to Excel
  const handleExportExcel = () => {
    if (filteredInventory.length === 0) {
      toast({
        title: 'Không có dữ liệu',
        description: 'Không có hàng bảo hành để xuất',
        variant: 'destructive',
      });
      return;
    }

    exportToExcel({
      filename: `Hang_bao_hanh_${format(new Date(), 'ddMMyyyy')}`,
      sheetName: 'Hàng bảo hành',
      columns: [
        { header: 'STT', key: 'stt', width: 6, isNumeric: true },
        { header: 'Tên sản phẩm', key: 'productName', width: 35 },
        { header: 'SKU', key: 'sku', width: 18 },
        { header: 'Chi nhánh', key: 'branchName', width: 20 },
        { header: 'Danh mục', key: 'categoryName', width: 18 },
        { header: 'Loại', key: 'type', width: 12 },
        { header: 'Số lượng BH', key: 'stock', width: 12, isNumeric: true },
        { header: 'Giá nhập TB', key: 'avgImportPrice', width: 15, isNumeric: true },
        { header: 'Giá trị', key: 'stockValue', width: 18, isNumeric: true },
      ],
      data: filteredInventory.map((item, index) => ({
        stt: index + 1,
        productName: item.productName,
        sku: item.sku,
        branchName: item.branchName || '',
        categoryName: item.categoryName || '',
        type: item.hasImei ? 'Có IMEI' : 'Không IMEI',
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

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header actions */}
      <div className="flex justify-end">
        <Button onClick={handleExportExcel} className="gap-2">
          <Download className="h-4 w-4" />
          Xuất Excel
        </Button>
      </div>

      {/* Stats */}
      <InventoryStats
        totalProducts={filteredStats.totalProducts}
        totalStock={filteredStats.totalStock}
        lowStockItems={filteredStats.lowStockItems}
        outOfStockItems={filteredStats.outOfStockItems}
        totalValue={filteredStats.totalValue}
      />

      {/* Filters */}
      <InventoryFiltersComponent
        filters={filters}
        onFiltersChange={setFilters}
      />

      {/* Table */}
      <WarrantyTable data={pagination.paginatedData} isLoading={isLoading} />

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
    </div>
  );
}
