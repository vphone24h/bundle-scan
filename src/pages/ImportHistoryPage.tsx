import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useImportReceipts, useImportReceiptDetails, ImportReceipt } from '@/hooks/useImportReceipts';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useSuppliers } from '@/hooks/useSuppliers';
import { formatCurrency, formatDate } from '@/lib/mockData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Search, Download, FileText, MoreHorizontal, Eye, Pencil, RotateCcw, Loader2, Filter, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { toast } from '@/hooks/use-toast';

export default function ImportHistoryPage() {
  const { data: receipts, isLoading: receiptsLoading } = useImportReceipts();
  const { data: products, isLoading: productsLoading } = useProducts();
  const { data: categories } = useCategories();
  const { data: suppliers } = useSuppliers();
  
  // Search & filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('_all_');
  const [supplierFilter, setSupplierFilter] = useState('_all_');
  const [statusFilter, setStatusFilter] = useState('_all_');
  const [showFilters, setShowFilters] = useState(false);
  
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const { data: receiptDetails, isLoading: detailsLoading } = useImportReceiptDetails(selectedReceiptId);

  // Filter receipts
  const filteredReceipts = useMemo(() => {
    if (!receipts) return [];
    
    return receipts.filter((r) => {
      // Search filter
      const matchesSearch = 
        r.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.suppliers?.name?.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Date filter
      let matchesDate = true;
      if (dateFrom || dateTo) {
        const receiptDate = startOfDay(new Date(r.import_date));
        if (dateFrom && dateTo) {
          matchesDate = isWithinInterval(receiptDate, {
            start: startOfDay(parseISO(dateFrom)),
            end: endOfDay(parseISO(dateTo))
          });
        } else if (dateFrom) {
          matchesDate = receiptDate >= startOfDay(parseISO(dateFrom));
        } else if (dateTo) {
          matchesDate = receiptDate <= endOfDay(parseISO(dateTo));
        }
      }
      
      // Supplier filter
      const matchesSupplier = supplierFilter === '_all_' || r.supplier_id === supplierFilter;
      
      return matchesSearch && matchesDate && matchesSupplier;
    });
  }, [receipts, searchTerm, dateFrom, dateTo, supplierFilter]);

  // Filter products
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    
    return products.filter((p) => {
      // Search filter
      const matchesSearch = 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.imei?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Date filter
      let matchesDate = true;
      if (dateFrom || dateTo) {
        const productDate = startOfDay(new Date(p.import_date));
        if (dateFrom && dateTo) {
          matchesDate = isWithinInterval(productDate, {
            start: startOfDay(parseISO(dateFrom)),
            end: endOfDay(parseISO(dateTo))
          });
        } else if (dateFrom) {
          matchesDate = productDate >= startOfDay(parseISO(dateFrom));
        } else if (dateTo) {
          matchesDate = productDate <= endOfDay(parseISO(dateTo));
        }
      }
      
      // Category filter
      const matchesCategory = categoryFilter === '_all_' || p.category_id === categoryFilter;
      
      // Supplier filter
      const matchesSupplier = supplierFilter === '_all_' || p.supplier_id === supplierFilter;
      
      // Status filter
      const matchesStatus = statusFilter === '_all_' || p.status === statusFilter;
      
      return matchesSearch && matchesDate && matchesCategory && matchesSupplier && matchesStatus;
    });
  }, [products, searchTerm, dateFrom, dateTo, categoryFilter, supplierFilter, statusFilter]);

  const handleView = (receipt: ImportReceipt) => {
    setSelectedReceiptId(receipt.id);
  };

  const handleEdit = (receipt: ImportReceipt) => {
    console.log('Edit receipt:', receipt);
  };

  const handleReturn = (receipt: ImportReceipt) => {
    console.log('Return receipt:', receipt);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setDateFrom('');
    setDateTo('');
    setCategoryFilter('_all_');
    setSupplierFilter('_all_');
    setStatusFilter('_all_');
  };

  const hasActiveFilters = dateFrom || dateTo || categoryFilter !== '_all_' || supplierFilter !== '_all_' || statusFilter !== '_all_';

  // Export to Excel
  const handleExportReceipts = () => {
    if (filteredReceipts.length === 0) {
      toast({ title: 'Không có dữ liệu', description: 'Không có phiếu nhập nào để xuất', variant: 'destructive' });
      return;
    }

    const headers = ['Mã phiếu', 'Ngày nhập', 'Tổng tiền', 'Đã thanh toán', 'Còn nợ', 'Nhà cung cấp', 'Trạng thái'];
    const rows = filteredReceipts.map(r => [
      r.code,
      format(new Date(r.import_date), 'dd/MM/yyyy HH:mm'),
      r.total_amount,
      r.paid_amount,
      r.debt_amount,
      r.suppliers?.name || '',
      r.status === 'completed' ? 'Hoàn tất' : 'Đã huỷ'
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `phieu-nhap-hang-${format(new Date(), 'yyyyMMdd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({ title: 'Xuất Excel thành công', description: `Đã xuất ${filteredReceipts.length} phiếu nhập` });
  };

  const handleExportProducts = () => {
    if (filteredProducts.length === 0) {
      toast({ title: 'Không có dữ liệu', description: 'Không có sản phẩm nào để xuất', variant: 'destructive' });
      return;
    }

    const headers = ['Tên sản phẩm', 'SKU', 'IMEI', 'Danh mục', 'Giá nhập', 'Ngày nhập', 'Nhà cung cấp', 'Trạng thái'];
    const rows = filteredProducts.map(p => [
      p.name,
      p.sku,
      p.imei || '',
      p.categories?.name || '',
      p.import_price,
      format(new Date(p.import_date), 'dd/MM/yyyy'),
      p.suppliers?.name || '',
      p.status === 'in_stock' ? 'Tồn kho' : p.status === 'sold' ? 'Đã bán' : 'Đã trả'
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `san-pham-nhap-${format(new Date(), 'yyyyMMdd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({ title: 'Xuất Excel thành công', description: `Đã xuất ${filteredProducts.length} sản phẩm` });
  };

  const isLoading = receiptsLoading || productsLoading;

  if (isLoading) {
    return (
      <MainLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageHeader
        title="Lịch sử nhập hàng"
        description="Theo dõi các phiếu nhập và sản phẩm đã nhập"
        actions={
          <Button asChild>
            <Link to="/import/new">
              <FileText className="mr-2 h-4 w-4" />
              Tạo phiếu mới
            </Link>
          </Button>
        }
      />

      <div className="p-6 lg:p-8 space-y-4">
        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* Search row */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Tìm theo tên sản phẩm, IMEI, mã phiếu..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button
                  variant={showFilters ? 'secondary' : 'outline'}
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter className="mr-2 h-4 w-4" />
                  Bộ lọc
                  {hasActiveFilters && (
                    <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 flex items-center justify-center">
                      !
                    </Badge>
                  )}
                </Button>
              </div>

              {/* Extended filters */}
              {showFilters && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 pt-4 border-t">
                  <div className="space-y-2">
                    <Label className="text-xs">Từ ngày</Label>
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Đến ngày</Label>
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Danh mục</Label>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Tất cả" />
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
                  <div className="space-y-2">
                    <Label className="text-xs">Nhà cung cấp</Label>
                    <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Tất cả" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="_all_">Tất cả NCC</SelectItem>
                        {suppliers?.map((sup) => (
                          <SelectItem key={sup.id} value={sup.id}>
                            {sup.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Trạng thái</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Tất cả" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="_all_">Tất cả trạng thái</SelectItem>
                        <SelectItem value="in_stock">Tồn kho</SelectItem>
                        <SelectItem value="sold">Đã bán</SelectItem>
                        <SelectItem value="returned">Đã trả NCC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="w-full">
                      <X className="h-4 w-4 mr-1" />
                      Xóa lọc
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="receipts" className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="receipts">
                Theo phiếu nhập ({filteredReceipts.length})
              </TabsTrigger>
              <TabsTrigger value="products">
                Theo sản phẩm ({filteredProducts.length})
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="receipts">
            <div className="flex justify-end mb-4">
              <Button variant="outline" onClick={handleExportReceipts}>
                <Download className="mr-2 h-4 w-4" />
                Xuất Excel ({filteredReceipts.length})
              </Button>
            </div>
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Mã phiếu</th>
                    <th>Ngày nhập</th>
                    <th className="text-right">Tổng tiền</th>
                    <th className="text-right">Đã thanh toán</th>
                    <th className="text-right">Còn nợ</th>
                    <th>Nhà cung cấp</th>
                    <th>Trạng thái</th>
                    <th className="w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReceipts.map((receipt) => (
                    <tr key={receipt.id}>
                      <td className="font-mono font-medium text-primary">{receipt.code}</td>
                      <td>{formatDate(new Date(receipt.import_date))}</td>
                      <td className="text-right font-medium">{formatCurrency(Number(receipt.total_amount))}</td>
                      <td className="text-right text-success">{formatCurrency(Number(receipt.paid_amount))}</td>
                      <td className="text-right">
                        {Number(receipt.debt_amount) > 0 ? (
                          <span className="text-destructive font-medium">
                            {formatCurrency(Number(receipt.debt_amount))}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>{receipt.suppliers?.name || '-'}</td>
                      <td>
                        <Badge
                          className={cn(
                            receipt.status === 'completed'
                              ? 'status-in-stock'
                              : 'bg-destructive/10 text-destructive border-destructive/20'
                          )}
                        >
                          {receipt.status === 'completed' ? 'Hoàn tất' : 'Đã huỷ'}
                        </Badge>
                      </td>
                      <td>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover">
                            <DropdownMenuItem onClick={() => handleView(receipt)}>
                              <Eye className="mr-2 h-4 w-4" />
                              Xem chi tiết
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(receipt)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Chỉnh sửa
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleReturn(receipt)}>
                              <RotateCcw className="mr-2 h-4 w-4" />
                              Trả hàng
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredReceipts.length === 0 && (
                <div className="py-12 text-center text-muted-foreground">
                  {hasActiveFilters ? 'Không tìm thấy phiếu nhập phù hợp' : 'Chưa có phiếu nhập nào'}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="products">
            <div className="flex justify-end mb-4">
              <Button variant="outline" onClick={handleExportProducts}>
                <Download className="mr-2 h-4 w-4" />
                Xuất Excel ({filteredProducts.length})
              </Button>
            </div>
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tên sản phẩm</th>
                    <th>SKU</th>
                    <th>IMEI</th>
                    <th>Danh mục</th>
                    <th className="text-right">Giá nhập</th>
                    <th>Ngày nhập</th>
                    <th>Nhà cung cấp</th>
                    <th>Trạng thái</th>
                    <th className="w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => (
                    <tr key={product.id}>
                      <td className="font-medium">{product.name}</td>
                      <td className="text-muted-foreground">{product.sku}</td>
                      <td className="font-mono text-sm">{product.imei || '-'}</td>
                      <td>{product.categories?.name || '-'}</td>
                      <td className="text-right font-medium">
                        {formatCurrency(Number(product.import_price))}
                      </td>
                      <td>{formatDate(new Date(product.import_date))}</td>
                      <td>{product.suppliers?.name || '-'}</td>
                      <td>
                        <Badge
                          className={cn(
                            product.status === 'in_stock'
                              ? 'status-in-stock'
                              : product.status === 'sold'
                              ? 'status-sold'
                              : 'status-pending'
                          )}
                        >
                          {product.status === 'in_stock'
                            ? 'Tồn kho'
                            : product.status === 'sold'
                            ? 'Đã bán'
                            : 'Đã trả'}
                        </Badge>
                      </td>
                      <td>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover">
                            <DropdownMenuItem>
                              <Pencil className="mr-2 h-4 w-4" />
                              Chỉnh sửa
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <RotateCcw className="mr-2 h-4 w-4" />
                              Trả hàng
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredProducts.length === 0 && (
                <div className="py-12 text-center text-muted-foreground">
                  {hasActiveFilters ? 'Không tìm thấy sản phẩm phù hợp' : 'Không có sản phẩm nào'}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Receipt Detail Dialog */}
      <Dialog open={!!selectedReceiptId} onOpenChange={() => setSelectedReceiptId(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chi tiết phiếu nhập {receiptDetails?.receipt?.code}</DialogTitle>
          </DialogHeader>

          {detailsLoading ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : receiptDetails?.receipt && (
            <div className="space-y-6">
              {/* Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Ngày nhập:</span>
                  <span className="ml-2 font-medium">
                    {formatDate(new Date(receiptDetails.receipt.import_date))}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Nhà cung cấp:</span>
                  <span className="ml-2 font-medium">{receiptDetails.receipt.suppliers?.name || '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Trạng thái:</span>
                  <Badge
                    className={cn(
                      'ml-2',
                      receiptDetails.receipt.status === 'completed'
                        ? 'status-in-stock'
                        : 'bg-destructive/10 text-destructive'
                    )}
                  >
                    {receiptDetails.receipt.status === 'completed' ? 'Hoàn tất' : 'Đã huỷ'}
                  </Badge>
                </div>
              </div>

              {/* Products */}
              <div>
                <h4 className="font-semibold mb-3">Danh sách sản phẩm ({receiptDetails.products?.length || 0})</h4>
                <div className="border rounded-lg divide-y">
                  {receiptDetails.products?.map((item: any) => (
                    <div key={item.id} className="p-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          SKU: {item.sku}
                          {item.imei && ` • IMEI: ${item.imei}`}
                        </p>
                      </div>
                      <p className="font-medium">{formatCurrency(Number(item.import_price))}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment */}
              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Tổng tiền:</span>
                  <span className="font-bold">{formatCurrency(Number(receiptDetails.receipt.total_amount))}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Đã thanh toán:</span>
                  <span className="text-success font-medium">
                    {formatCurrency(Number(receiptDetails.receipt.paid_amount))}
                  </span>
                </div>
                {Number(receiptDetails.receipt.debt_amount) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Còn nợ:</span>
                    <span className="text-destructive font-medium">
                      {formatCurrency(Number(receiptDetails.receipt.debt_amount))}
                    </span>
                  </div>
                )}
                {receiptDetails.payments && receiptDetails.payments.length > 0 && (
                  <div className="pt-2 border-t text-xs text-muted-foreground">
                    Thanh toán:{' '}
                    {receiptDetails.payments.map((p: any) => (
                      <span key={p.id} className="mr-2">
                        {p.payment_type === 'cash'
                          ? 'Tiền mặt'
                          : p.payment_type === 'bank_card'
                          ? 'Thẻ NH'
                          : p.payment_type === 'e_wallet'
                          ? 'Ví ĐT'
                          : 'Công nợ'}
                        : {formatCurrency(Number(p.amount))}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {receiptDetails.receipt.note && (
                <div>
                  <h4 className="font-semibold mb-2">Ghi chú</h4>
                  <p className="text-sm text-muted-foreground">{receiptDetails.receipt.note}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
