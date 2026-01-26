import { useState, useMemo } from 'react';
import { Download } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { useInventory, useInventoryStats, InventoryItem } from '@/hooks/useInventory';
import { InventoryFiltersComponent, InventoryFilters } from '@/components/inventory/InventoryFilters';
import { InventoryTable } from '@/components/inventory/InventoryTable';
import { InventoryStats } from '@/components/inventory/InventoryStats';
import { useToast } from '@/hooks/use-toast';

export default function InventoryPage() {
  const { toast } = useToast();
  const { data: inventory, isLoading } = useInventory();
  const { stats } = useInventoryStats();

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

  // Calculate filtered stats
  const filteredStats = useMemo(() => {
    return {
      totalProducts: filteredInventory.length,
      totalStock: filteredInventory.reduce((sum, item) => sum + item.stock, 0),
      lowStockItems: filteredInventory.filter((item) => item.stock > 0 && item.stock <= 2).length,
      outOfStockItems: filteredInventory.filter((item) => item.stock === 0).length,
    };
  }, [filteredInventory]);

  // Export to Excel
  const handleExportExcel = () => {
    if (filteredInventory.length === 0) {
      toast({
        title: 'Không có dữ liệu',
        description: 'Không có dữ liệu tồn kho để xuất',
        variant: 'destructive',
      });
      return;
    }

    // Create CSV content
    const headers = ['STT', 'Tên sản phẩm', 'SKU', 'Chi nhánh', 'Loại', 'Tổng nhập', 'Đã bán', 'Tồn kho'];
    const rows = filteredInventory.map((item, index) => [
      index + 1,
      item.productName,
      item.sku,
      item.branchName || '',
      item.hasImei ? 'Có IMEI' : 'Không IMEI',
      item.totalImported,
      item.totalSold,
      item.stock,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    // Add BOM for Excel UTF-8 support
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ton-kho-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    toast({
      title: 'Xuất thành công',
      description: `Đã xuất ${filteredInventory.length} dòng dữ liệu`,
    });
  };

  return (
    <MainLayout>
      <PageHeader
        title="Tồn kho"
        description="Quản lý và theo dõi tồn kho theo thời gian thực"
        actions={
          <Button onClick={handleExportExcel} className="gap-2">
            <Download className="h-4 w-4" />
            Xuất Excel
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <InventoryStats {...filteredStats} />

        {/* Filters */}
        <InventoryFiltersComponent filters={filters} onFiltersChange={setFilters} />

        {/* Table */}
        <InventoryTable data={filteredInventory} isLoading={isLoading} />
      </div>
    </MainLayout>
  );
}
