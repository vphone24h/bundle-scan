import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { useBranches } from '@/hooks/useBranches';
import {
  Search,
  SlidersHorizontal,
  TrendingUp,
  CreditCard,
  FileText,
  Calculator,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type SortMode = 'name' | 'most_import_value' | 'highest_debt' | 'most_receipts' | 'highest_avg';

interface SupplierFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  sortMode: SortMode;
  onSortModeChange: (mode: SortMode) => void;
  startDate: string;
  onStartDateChange: (value: string) => void;
  endDate: string;
  onEndDateChange: (value: string) => void;
  branchId: string;
  onBranchIdChange: (value: string) => void;
}

const sortButtons: { mode: SortMode; label: string; icon: React.ElementType }[] = [
  { mode: 'most_import_value', label: 'Nhập nhiều nhất', icon: TrendingUp },
  { mode: 'highest_debt', label: 'Công nợ cao nhất', icon: CreditCard },
  { mode: 'most_receipts', label: 'Phiếu nhập nhiều nhất', icon: FileText },
  { mode: 'highest_avg', label: 'TB phiếu nhập lớn', icon: Calculator },
];

export function SupplierFilters({
  searchTerm,
  onSearchChange,
  sortMode,
  onSortModeChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  branchId,
  onBranchIdChange,
}: SupplierFiltersProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { data: branches } = useBranches();

  const activeFilterCount = [startDate, endDate, branchId].filter(Boolean).length;

  const handleClearFilters = () => {
    onStartDateChange('');
    onEndDateChange('');
    onBranchIdChange('');
    onSortModeChange('name');
  };

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm theo tên hoặc số điện thoại..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 relative">
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">Bộ lọc</span>
              {filtersOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {activeFilterCount > 0 && (
                <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </CollapsibleTrigger>
        </Collapsible>
      </div>

      {/* Sort Chips */}
      <div className="flex flex-wrap gap-2">
        {sortButtons.map(({ mode, label, icon: Icon }) => (
          <Button
            key={mode}
            variant={sortMode === mode ? 'default' : 'outline'}
            size="sm"
            onClick={() => onSortModeChange(sortMode === mode ? 'name' : mode)}
            className={cn(
              "gap-1.5 text-xs h-8",
              sortMode === mode && "shadow-sm"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </Button>
        ))}
      </div>

      {/* Extended Filters */}
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <CollapsibleContent>
          <div className="bg-muted/50 border rounded-lg p-3 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Từ ngày</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => onStartDateChange(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Đến ngày</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => onEndDateChange(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Chi nhánh</Label>
                <Select value={branchId || 'all'} onValueChange={(v) => onBranchIdChange(v === 'all' ? '' : v)}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Tất cả chi nhánh" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả chi nhánh</SelectItem>
                    {branches?.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {activeFilterCount > 0 && (
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={handleClearFilters} className="text-xs gap-1 h-7">
                  <X className="h-3 w-3" />
                  Xóa bộ lọc
                </Button>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
