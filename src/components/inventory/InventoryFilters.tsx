import { useState, useEffect } from 'react';
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
import { useBranches } from '@/hooks/useBranches';

export interface InventoryFilters {
  search: string;
  categoryId: string;
  branchId: string;
  productType: 'all' | 'with_imei' | 'without_imei';
  stockStatus: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
  oldStockDays: number | null;
}

interface InventoryFiltersProps {
  filters: InventoryFilters;
  onFiltersChange: (filters: InventoryFilters) => void;
}

export function InventoryFiltersComponent({ filters, onFiltersChange }: InventoryFiltersProps) {
  const { data: categories } = useCategories();
  const { data: branches } = useBranches();
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

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

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      categoryId: '',
      branchId: '',
      productType: 'all',
      stockStatus: 'all',
      oldStockDays: null,
    });
  };

  const hasActiveFilters =
    filters.categoryId ||
    filters.branchId ||
    filters.productType !== 'all' ||
    filters.stockStatus !== 'all' ||
    filters.oldStockDays !== null;

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm theo tên sản phẩm, IMEI, SKU..."
            value={filters.search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          variant={showAdvancedFilters ? 'secondary' : 'outline'}
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          Bộ lọc
          {hasActiveFilters && (
            <Badge variant="destructive" className="ml-1 h-5 w-5 rounded-full p-0 text-xs">
              !
            </Badge>
          )}
        </Button>
        {hasActiveFilters && (
          <Button variant="ghost" onClick={clearFilters} className="gap-2">
            <X className="h-4 w-4" />
            Xóa lọc
          </Button>
        )}
      </div>

      {/* Advanced Filters */}
      {showAdvancedFilters && (
        <div className="grid gap-4 rounded-lg border bg-card p-4 md:grid-cols-2 lg:grid-cols-5">
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

          {/* Branch */}
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
        </div>
      )}
    </div>
  );
}
