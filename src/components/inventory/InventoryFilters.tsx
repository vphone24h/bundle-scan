import { useState } from 'react';
import { Search, Filter, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCategories } from '@/hooks/useCategories';
import { useAccessibleBranches, usePermissions } from '@/hooks/usePermissions';

export interface InventoryFilters {
  search: string;
  categoryId: string;
  branchId: string;
  productType: 'all' | 'with_imei' | 'without_imei';
  stockStatus: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
  oldStockDays: number | null;
  stockSort: 'none' | 'stock_high' | 'stock_low';
}

interface InventoryFiltersProps {
  filters: InventoryFilters;
  onFiltersChange: (filters: InventoryFilters) => void;
}

export function InventoryFiltersComponent({ filters, onFiltersChange }: InventoryFiltersProps) {
  const { data: categories } = useCategories();
  const { data: branches } = useAccessibleBranches();
  const { data: permissions } = usePermissions();
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Chỉ Super Admin mới thấy bộ lọc chi nhánh
  const canFilterBranch = permissions?.canViewAllBranches;

  const handleSearchChange = (value: string) => {
    onFiltersChange({ ...filters, search: value });
  };

  const handleCategoryChange = (value: string) => {
    onFiltersChange({ ...filters, categoryId: value === '_all_' ? '' : value });
  };

  const handleBranchChange = (value: string) => {
    onFiltersChange({ ...filters, branchId: value === '_all_' ? '' : value });
  };

  const handleProductTypeChange = (value: string) => {
    onFiltersChange({ ...filters, productType: value as InventoryFilters['productType'] });
  };

  const handleStockStatusChange = (value: string) => {
    onFiltersChange({ ...filters, stockStatus: value as InventoryFilters['stockStatus'] });
  };

  const handleOldStockDaysChange = (value: string) => {
    onFiltersChange({ ...filters, oldStockDays: value === '_none_' ? null : parseInt(value) });
  };

  const handleStockSortChange = (value: string) => {
    onFiltersChange({ ...filters, stockSort: value as InventoryFilters['stockSort'] });
  };

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      categoryId: '',
      branchId: '',
      productType: 'all',
      stockStatus: 'all',
      oldStockDays: null,
      stockSort: 'none',
    });
  };

  const hasActiveFilters =
    filters.categoryId ||
    filters.branchId ||
    filters.productType !== 'all' ||
    filters.stockStatus !== 'all' ||
    filters.oldStockDays !== null ||
    filters.stockSort !== 'none';

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" />
          <Input
            placeholder="Tìm theo tên, IMEI, SKU..."
            value={filters.search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10 h-11 text-base border-2 border-primary bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary shadow-md ring-2 ring-primary/20"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={showAdvancedFilters ? 'secondary' : 'outline'}
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="gap-2 flex-1 sm:flex-none"
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Bộ lọc</span>
            {hasActiveFilters && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 rounded-full p-0 text-xs">
                !
              </Badge>
            )}
          </Button>
          {hasActiveFilters && (
            <Button variant="ghost" onClick={clearFilters} className="gap-2">
              <X className="h-4 w-4" />
              <span className="hidden sm:inline">Xóa lọc</span>
            </Button>
          )}
        </div>
      </div>

      {/* Advanced Filters */}
      {showAdvancedFilters && (
        <div className="grid gap-4 rounded-lg border bg-card p-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
          {/* Category */}
          <div>
            <label className="mb-2 block text-sm font-medium">Danh mục</label>
            <Select value={filters.categoryId || '_all_'} onValueChange={handleCategoryChange}>
              <SelectTrigger>
                <SelectValue placeholder="Tất cả danh mục" />
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

          {/* Branch - Chỉ hiện cho Super Admin */}
          {canFilterBranch && (
            <div>
              <label className="mb-2 block text-sm font-medium">Chi nhánh</label>
              <Select value={filters.branchId || '_all_'} onValueChange={handleBranchChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Tất cả chi nhánh" />
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

          {/* Product Type */}
          <div>
            <label className="mb-2 block text-sm font-medium">Loại sản phẩm</label>
            <Select value={filters.productType} onValueChange={handleProductTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Tất cả" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="with_imei">Có IMEI</SelectItem>
                <SelectItem value="without_imei">Không có IMEI</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Stock Status */}
          <div>
            <label className="mb-2 block text-sm font-medium">Trạng thái tồn kho</label>
            <Select value={filters.stockStatus} onValueChange={handleStockStatusChange}>
              <SelectTrigger>
                <SelectValue placeholder="Tất cả" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="in_stock">Còn hàng</SelectItem>
                <SelectItem value="low_stock">Sắp hết (≤2)</SelectItem>
                <SelectItem value="out_of_stock">Hết hàng</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Old Stock Filter */}
          <div>
            <label className="mb-2 block text-sm font-medium">Hàng tồn lâu</label>
            <Select
              value={filters.oldStockDays?.toString() || '_none_'}
              onValueChange={handleOldStockDaysChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Không lọc" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="_none_">Không lọc</SelectItem>
                <SelectItem value="30">Trên 30 ngày</SelectItem>
                <SelectItem value="60">Trên 60 ngày</SelectItem>
                <SelectItem value="90">Trên 90 ngày</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Stock Quantity Sort */}
          <div>
            <label className="mb-2 block text-sm font-medium">Tồn kho theo số lượng</label>
            <Select value={filters.stockSort} onValueChange={handleStockSortChange}>
              <SelectTrigger>
                <SelectValue placeholder="Không sắp xếp" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="none">Không sắp xếp</SelectItem>
                <SelectItem value="stock_high">Tồn kho nhiều nhất</SelectItem>
                <SelectItem value="stock_low">Tồn kho ít nhất</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}
