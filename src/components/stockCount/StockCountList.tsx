import { useState } from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Plus, Eye, Edit, Search, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBranches } from '@/hooks/useBranches';
import { useStockCounts, StockCount, StockCountStatus } from '@/hooks/useStockCounts';

interface StockCountListProps {
  onCreateNew: () => void;
  onView: (stockCount: StockCount) => void;
  onEdit: (stockCount: StockCount) => void;
}

export function StockCountList({ onCreateNew, onView, onEdit }: StockCountListProps) {
  const { data: branches } = useBranches();
  const [branchId, setBranchId] = useState<string>('');
  const [status, setStatus] = useState<StockCountStatus | ''>('');
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });

  const { data: stockCounts, isLoading } = useStockCounts({
    branchId: branchId || undefined,
    status: status || undefined,
    startDate: dateRange.from?.toISOString(),
    endDate: dateRange.to?.toISOString(),
    search: search || undefined,
  });

  const clearFilters = () => {
    setBranchId('');
    setStatus('');
    setSearch('');
    setDateRange({ from: undefined, to: undefined });
  };

  const hasFilters = branchId || status || search || dateRange.from || dateRange.to;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Button onClick={onCreateNew} className="gap-2">
          <Plus className="h-4 w-4" />
          Tạo phiếu kiểm kho
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-card rounded-lg border">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm mã phiếu, nhân viên..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <Select value={branchId} onValueChange={setBranchId}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Chi nhánh" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Tất cả chi nhánh</SelectItem>
            {branches?.map((branch) => (
              <SelectItem key={branch.id} value={branch.id}>
                {branch.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={(v) => setStatus(v as StockCountStatus | '')}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Trạng thái" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Tất cả</SelectItem>
            <SelectItem value="draft">Nháp</SelectItem>
            <SelectItem value="confirmed">Đã xác nhận</SelectItem>
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <CalendarIcon className="h-4 w-4" />
              {dateRange.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, 'dd/MM')} - {format(dateRange.to, 'dd/MM')}
                  </>
                ) : (
                  format(dateRange.from, 'dd/MM/yyyy')
                )
              ) : (
                'Thời gian'
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange.from}
              selected={{ from: dateRange.from, to: dateRange.to }}
              onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })}
              numberOfMonths={2}
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
            <X className="h-4 w-4" />
            Xóa lọc
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Mã phiếu</TableHead>
              <TableHead>Chi nhánh</TableHead>
              <TableHead>Ngày kiểm</TableHead>
              <TableHead>NV kiểm</TableHead>
              <TableHead className="text-center">Hệ thống</TableHead>
              <TableHead className="text-center">Thực tế</TableHead>
              <TableHead className="text-center">Tổng lệch</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  </div>
                </TableCell>
              </TableRow>
            ) : stockCounts?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <ClipboardList className="h-12 w-12 opacity-50" />
                    <p>Chưa có phiếu kiểm kho</p>
                    <Button variant="outline" size="sm" onClick={onCreateNew}>
                      Tạo phiếu đầu tiên
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              stockCounts?.map((sc) => (
                <TableRow key={sc.id}>
                  <TableCell className="font-medium">{sc.code}</TableCell>
                  <TableCell>
                    {sc.branchName || <span className="text-muted-foreground">Tất cả</span>}
                  </TableCell>
                  <TableCell>
                    {format(new Date(sc.countDate), 'dd/MM/yyyy', { locale: vi })}
                  </TableCell>
                  <TableCell>{sc.createdByName || '-'}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{sc.totalSystemQuantity}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{sc.totalActualQuantity}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      className={cn(
                        sc.totalVariance < 0
                          ? 'bg-destructive text-destructive-foreground'
                          : sc.totalVariance > 0
                          ? 'bg-emerald-500 text-white'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {sc.totalVariance > 0 ? '+' : ''}
                      {sc.totalVariance}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {sc.status === 'draft' ? (
                      <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                        🟡 Nháp
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        🟢 Đã xác nhận
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onView(sc)}
                        title="Xem chi tiết"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {sc.status === 'draft' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(sc)}
                          title="Chỉnh sửa"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
