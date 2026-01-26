import { useState } from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Download, Search, Loader2, X, FolderOpen } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDetailedProfitReport } from '@/hooks/useDetailedProfitReport';
import { useBranches } from '@/hooks/useBranches';
import { useCategories } from '@/hooks/useCategories';
import { formatCurrency } from '@/lib/mockData';
import { startOfMonth, subDays, startOfWeek, subWeeks, subMonths, endOfWeek, endOfMonth } from 'date-fns';

const timePresets = [
  { label: 'Hôm nay', value: 'today' },
  { label: 'Hôm qua', value: 'yesterday' },
  { label: 'Tuần này', value: 'this_week' },
  { label: 'Tuần trước', value: 'last_week' },
  { label: 'Tháng này', value: 'this_month' },
  { label: 'Tháng trước', value: 'last_month' },
];

export function DetailedProfitTable() {
  const today = format(new Date(), 'yyyy-MM-dd');

  const [timePreset, setTimePreset] = useState('this_month');
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(today);
  const [branchId, setBranchId] = useState('_all_');
  const [categoryId, setCategoryId] = useState('_all_');
  const [search, setSearch] = useState('');

  const { data: branches } = useBranches();
  const { data: categories } = useCategories();

  const filters = {
    startDate,
    endDate,
    branchId: branchId !== '_all_' ? branchId : undefined,
    categoryId: categoryId !== '_all_' ? categoryId : undefined,
    search: search || undefined,
  };

  const { data, isLoading } = useDetailedProfitReport(filters);

  // Handle time preset
  const handleTimePreset = (preset: string) => {
    const now = new Date();
    let start: Date;
    let end: Date = now;

    switch (preset) {
      case 'today':
        start = now;
        break;
      case 'yesterday':
        start = subDays(now, 1);
        end = subDays(now, 1);
        break;
      case 'this_week':
        start = startOfWeek(now, { weekStartsOn: 1 });
        break;
      case 'last_week':
        start = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
        end = subDays(startOfWeek(now, { weekStartsOn: 1 }), 1);
        break;
      case 'this_month':
        start = startOfMonth(now);
        break;
      case 'last_month':
        start = startOfMonth(subMonths(now, 1));
        end = subDays(startOfMonth(now), 1);
        break;
      default:
        return;
    }

    setTimePreset(preset);
    setStartDate(format(start, 'yyyy-MM-dd'));
    setEndDate(format(end, 'yyyy-MM-dd'));
  };

  // Clear all filters
  const handleClearFilters = () => {
    setTimePreset('this_month');
    setStartDate(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    setEndDate(today);
    setBranchId('_all_');
    setCategoryId('_all_');
    setSearch('');
  };

  // Export to CSV
  const handleExport = () => {
    if (!data?.items.length) return;

    const headers = [
      'Sản phẩm',
      'SKU',
      'IMEI',
      'Khách hàng',
      'Chi nhánh',
      'Giá nhập',
      'Giá bán',
      'Số lượng',
      'Lợi nhuận',
      'Margin %',
      'Ngày bán',
      'Trạng thái',
      'Mã phiếu',
    ];

    const rows = data.items.map(item => {
      const margin = item.salePrice > 0 ? ((item.profit / item.salePrice) * 100).toFixed(1) : '0';
      return [
        item.productName,
        item.sku,
        item.imei || 'N/A',
        item.customerName || 'Khách lẻ',
        item.branchName,
        item.importPrice,
        item.salePrice,
        item.quantity,
        item.profit,
        margin + '%',
        format(new Date(item.saleDate), 'dd/MM/yyyy HH:mm'),
        item.status === 'sold' ? 'Đã bán' : 'Trả hàng',
        item.receiptCode,
      ];
    });

    // Add totals row
    rows.push([
      'TỔNG CỘNG',
      '',
      '',
      '',
      '',
      '',
      data.totals.totalRevenue,
      data.totals.totalQuantity,
      data.totals.totalProfit,
      '',
      '',
      '',
      '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `bao-cao-loi-nhuan-chi-tiet_${startDate}_${endDate}.csv`;
    link.click();
  };

  // Format price with abbreviation
  const formatPrice = (value: number) => {
    if (Math.abs(value) >= 1000000) {
      return (value / 1000000).toFixed(1) + 'Tr';
    } else if (Math.abs(value) >= 1000) {
      return Math.round(value / 1000) + 'K';
    }
    return value.toLocaleString('vi-VN');
  };

  return (
    <div className="space-y-4">
      {/* Filters Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="h-4 w-4" />
              Tìm kiếm & Lọc dữ liệu
            </CardTitle>
            <Button variant="outline" size="sm" onClick={handleClearFilters}>
              <X className="h-4 w-4 mr-1" />
              Xóa bộ lọc
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Time preset */}
            <div>
              <Label className="text-xs text-muted-foreground">Khoảng thời gian</Label>
              <Select value={timePreset} onValueChange={handleTimePreset}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn thời gian" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {timePresets.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Branch filter */}
            <div>
              <Label className="text-xs text-muted-foreground">Chi nhánh</Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger>
                  <SelectValue placeholder="Tất cả chi nhánh" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="_all_">
                    <span className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4 text-muted-foreground" />
                      Tất cả chi nhánh
                    </span>
                  </SelectItem>
                  {branches?.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      <span className="flex items-center gap-2">
                        <FolderOpen className="h-4 w-4 text-muted-foreground" />
                        {branch.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category filter */}
            <div>
              <Label className="text-xs text-muted-foreground">Danh mục</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Tất cả danh mục" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="_all_">
                    <span className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4 text-muted-foreground" />
                      Tất cả danh mục
                    </span>
                  </SelectItem>
                  {categories?.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <span className="flex items-center gap-2">
                        <FolderOpen className="h-4 w-4 text-muted-foreground" />
                        {cat.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <div>
              <Label className="text-xs text-muted-foreground">Tìm kiếm</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Tên SP, SKU, IMEI..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Chi tiết đơn hàng
            </CardTitle>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {data?.items.length || 0} hoạt động
              </span>
              <Button variant="outline" size="sm" onClick={handleExport} disabled={!data?.items.length}>
                <Download className="h-4 w-4 mr-1" />
                Xuất Excel
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : !data?.items.length ? (
            <div className="text-center py-12 text-muted-foreground">
              Không có dữ liệu trong khoảng thời gian này
            </div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="text-primary font-semibold min-w-[200px]">SẢN PHẨM</TableHead>
                    <TableHead className="text-primary font-semibold min-w-[140px]">IMEI</TableHead>
                    <TableHead className="text-primary font-semibold min-w-[140px]">KHÁCH HÀNG</TableHead>
                    <TableHead className="text-primary font-semibold text-center">CHI NHÁNH</TableHead>
                    <TableHead className="text-primary font-semibold text-right">GIÁ NHẬP</TableHead>
                    <TableHead className="text-primary font-semibold text-right">GIÁ BÁN</TableHead>
                    <TableHead className="text-primary font-semibold text-center">SỐ LƯỢNG</TableHead>
                    <TableHead className="text-primary font-semibold text-right">LỢI NHUẬN</TableHead>
                    <TableHead className="text-primary font-semibold text-right min-w-[100px]">NGÀY BÁN</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((item) => {
                    const margin = item.salePrice > 0 ? ((item.profit / item.salePrice) * 100).toFixed(1) : '0';
                    const isReturn = item.status === 'returned';
                    
                    return (
                      <TableRow 
                        key={item.id}
                        className={isReturn ? 'bg-red-50/50 dark:bg-red-950/10' : ''}
                      >
                        {/* Product */}
                        <TableCell>
                          <div>
                            <p className="font-medium text-primary">{item.productName}</p>
                            <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
                          </div>
                        </TableCell>

                        {/* IMEI */}
                        <TableCell>
                          <span className="font-mono text-sm text-muted-foreground">
                            {item.imei || 'N/A'}
                          </span>
                        </TableCell>

                        {/* Customer */}
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.customerName || 'Khách lẻ'}</p>
                            {item.customerName && (
                              <p className="text-xs text-muted-foreground">N/A</p>
                            )}
                          </div>
                        </TableCell>

                        {/* Branch */}
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-100">
                            {item.branchName}
                          </Badge>
                        </TableCell>

                        {/* Import Price */}
                        <TableCell className="text-right">
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            {formatPrice(item.importPrice)}
                          </span>
                        </TableCell>

                        {/* Sale Price */}
                        <TableCell className="text-right">
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            {formatPrice(item.salePrice)}
                          </span>
                        </TableCell>

                        {/* Quantity */}
                        <TableCell className="text-center font-medium">
                          {item.quantity}
                        </TableCell>

                        {/* Profit */}
                        <TableCell className="text-right">
                          <div>
                            <p className={`font-medium ${item.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                              {item.profit >= 0 ? '+' : ''}{formatPrice(item.profit)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Margin: {margin}%
                            </p>
                          </div>
                        </TableCell>

                        {/* Sale Date */}
                        <TableCell className="text-right">
                          <div>
                            <p className="font-medium">
                              {format(new Date(item.saleDate), 'd/M/yyyy', { locale: vi })}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(item.saleDate), 'HH:mm')}
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {/* Totals Row */}
                  <TableRow className="bg-muted/50 font-semibold border-t-2">
                    <TableCell colSpan={4} className="text-right">
                      TỔNG CỘNG
                    </TableCell>
                    <TableCell className="text-right">—</TableCell>
                    <TableCell className="text-right text-emerald-600 dark:text-emerald-400">
                      {formatPrice(data.totals.totalRevenue)}
                    </TableCell>
                    <TableCell className="text-center">
                      {data.totals.totalQuantity}
                    </TableCell>
                    <TableCell className={`text-right ${data.totals.totalProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                      {data.totals.totalProfit >= 0 ? '+' : ''}{formatPrice(data.totals.totalProfit)}
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
