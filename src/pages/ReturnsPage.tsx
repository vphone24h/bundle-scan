import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
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
import { 
  Search, 
  Filter, 
  X,
  RotateCcw,
  Package,
  Truck,
  ArrowLeft,
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useBranches } from '@/hooks/useBranches';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useProducts } from '@/hooks/useProducts';
import { useExportReceiptItems, type ExportReceiptItemDetail } from '@/hooks/useExportReceipts';
import { useImportReturns, useExportReturns } from '@/hooks/useReturns';
import { formatNumberWithSpaces } from '@/lib/formatNumber';
import { ImportReturnForm } from '@/components/returns/ImportReturnForm';
import { ExportReturnForm } from '@/components/returns/ExportReturnForm';
import type { Product } from '@/hooks/useProducts';

type ViewMode = 'history' | 'import-return' | 'export-return';

export default function ReturnsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [branchFilter, setBranchFilter] = useState('_all_');
  const [supplierFilter, setSupplierFilter] = useState('_all_');
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState('import');
  
  // View mode & selected item
  const [viewMode, setViewMode] = useState<ViewMode>('history');
  const [selectedImportProduct, setSelectedImportProduct] = useState<Product | null>(null);
  const [selectedExportItem, setSelectedExportItem] = useState<ExportReceiptItemDetail | null>(null);

  const { data: branches } = useBranches();
  const { data: suppliers } = useSuppliers();
  const { data: products } = useProducts();
  const { data: exportItems } = useExportReceiptItems();
  
  const { data: importReturns, isLoading: importLoading } = useImportReturns({
    startDate: dateFrom || undefined,
    endDate: dateTo || undefined,
    supplierId: supplierFilter !== '_all_' ? supplierFilter : undefined,
    branchId: branchFilter !== '_all_' ? branchFilter : undefined,
  });
  
  const { data: exportReturns, isLoading: exportLoading } = useExportReturns({
    startDate: dateFrom || undefined,
    endDate: dateTo || undefined,
    branchId: branchFilter !== '_all_' ? branchFilter : undefined,
  });

  // Handle URL params for direct navigation from Import/Export History pages
  useEffect(() => {
    const type = searchParams.get('type');
    const productId = searchParams.get('productId');
    const itemId = searchParams.get('itemId');

    if (type === 'import' && productId && products) {
      const product = products.find(p => p.id === productId);
      if (product && product.status === 'in_stock') {
        setSelectedImportProduct(product);
        setViewMode('import-return');
        setActiveTab('import');
      }
    } else if (type === 'export' && itemId && exportItems) {
      const item = exportItems.find(i => i.id === itemId);
      if (item && item.status !== 'returned') {
        setSelectedExportItem(item);
        setViewMode('export-return');
        setActiveTab('export');
      }
    }
  }, [searchParams, products, exportItems]);

  const hasActiveFilters = dateFrom || dateTo || branchFilter !== '_all_' || supplierFilter !== '_all_';

  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setBranchFilter('_all_');
    setSupplierFilter('_all_');
  };

  const handleReturnSuccess = () => {
    setViewMode('history');
    setSelectedImportProduct(null);
    setSelectedExportItem(null);
    setSearchParams({});
  };

  const handleCancel = () => {
    setViewMode('history');
    setSelectedImportProduct(null);
    setSelectedExportItem(null);
    setSearchParams({});
  };

  // Filter import returns
  const filteredImportReturns = importReturns?.filter((r) => {
    const matchesSearch =
      r.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.imei?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.code.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  // Filter export returns
  const filteredExportReturns = exportReturns?.filter((r) => {
    const matchesSearch =
      r.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.imei?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.customers?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.customers?.phone?.includes(searchTerm);
    return matchesSearch;
  });

  // Render form for creating return
  if (viewMode === 'import-return') {
    return (
      <MainLayout>
        <PageHeader
          title="Trả hàng nhập"
          description="Hoàn trả sản phẩm cho nhà cung cấp"
          actions={
            <Button variant="outline" onClick={handleCancel}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Quay lại
            </Button>
          }
        />
        <div className="p-6 max-w-4xl mx-auto">
          <ImportReturnForm 
            product={selectedImportProduct} 
            onSuccess={handleReturnSuccess}
            onCancel={handleCancel}
          />
        </div>
      </MainLayout>
    );
  }

  if (viewMode === 'export-return') {
    return (
      <MainLayout>
        <PageHeader
          title="Trả hàng bán"
          description="Khách hàng trả lại sản phẩm"
          actions={
            <Button variant="outline" onClick={handleCancel}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Quay lại
            </Button>
          }
        />
        <div className="p-6 max-w-4xl mx-auto">
          <ExportReturnForm 
            item={selectedExportItem} 
            onSuccess={handleReturnSuccess}
            onCancel={handleCancel}
          />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageHeader
        title="Lịch sử trả hàng"
        description="Xem lịch sử trả hàng nhập và trả hàng bán"
      />

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Tìm theo mã phiếu, IMEI, tên SP, khách hàng..."
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
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

            {showFilters && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-4 border-t">
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
                  <Label className="text-xs">Chi nhánh</Label>
                  <Select value={branchFilter} onValueChange={setBranchFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tất cả" />
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
                {activeTab === 'import' && (
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
                )}
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
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="import" className="gap-2">
            <Truck className="h-4 w-4" />
            Trả hàng nhập ({filteredImportReturns?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="export" className="gap-2">
            <Package className="h-4 w-4" />
            Trả hàng bán ({filteredExportReturns?.length || 0})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Import Returns */}
        <TabsContent value="import">
          <Card>
            <CardContent className="pt-6">
              {importLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Đang tải...
                </div>
              ) : filteredImportReturns?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <RotateCcw className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Chưa có phiếu trả hàng nhập nào</p>
                  <p className="text-sm mt-1">Trả hàng từ Lịch sử nhập hàng</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mã phiếu</TableHead>
                      <TableHead>Ngày trả</TableHead>
                      <TableHead>Sản phẩm</TableHead>
                      <TableHead>IMEI</TableHead>
                      <TableHead className="text-right">Giá nhập</TableHead>
                      <TableHead className="text-right">Hoàn trả</TableHead>
                      <TableHead>Nhà cung cấp</TableHead>
                      <TableHead>Chi nhánh</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredImportReturns?.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.code}</TableCell>
                        <TableCell>
                          {format(new Date(r.return_date), 'dd/MM/yyyy HH:mm', { locale: vi })}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{r.product_name}</div>
                          <div className="text-xs text-muted-foreground">SKU: {r.sku}</div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{r.imei || '-'}</TableCell>
                        <TableCell className="text-right">
                          {formatNumberWithSpaces(r.import_price)}đ
                        </TableCell>
                        <TableCell className="text-right font-medium text-success">
                          {formatNumberWithSpaces(r.total_refund_amount)}đ
                        </TableCell>
                        <TableCell>{r.suppliers?.name || '-'}</TableCell>
                        <TableCell>{r.branches?.name || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Export Returns */}
        <TabsContent value="export">
          <Card>
            <CardContent className="pt-6">
              {exportLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Đang tải...
                </div>
              ) : filteredExportReturns?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <RotateCcw className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Chưa có phiếu trả hàng bán nào</p>
                  <p className="text-sm mt-1">Trả hàng từ Lịch sử xuất hàng</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mã phiếu</TableHead>
                      <TableHead>Ngày trả</TableHead>
                      <TableHead>Sản phẩm</TableHead>
                      <TableHead>IMEI</TableHead>
                      <TableHead className="text-right">Giá bán</TableHead>
                      <TableHead className="text-right">Hoàn khách</TableHead>
                      <TableHead className="text-right">Giữ lại</TableHead>
                      <TableHead>Khách hàng</TableHead>
                      <TableHead>Chi nhánh</TableHead>
                      <TableHead>Loại</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExportReturns?.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.code}</TableCell>
                        <TableCell>
                          {format(new Date(r.return_date), 'dd/MM/yyyy HH:mm', { locale: vi })}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{r.product_name}</div>
                          <div className="text-xs text-muted-foreground">SKU: {r.sku}</div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{r.imei || '-'}</TableCell>
                        <TableCell className="text-right">
                          {formatNumberWithSpaces(r.sale_price)}đ
                        </TableCell>
                        <TableCell className="text-right font-medium text-destructive">
                          {formatNumberWithSpaces(r.refund_amount)}đ
                        </TableCell>
                        <TableCell className="text-right font-medium text-success">
                          {r.store_keep_amount > 0 ? `${formatNumberWithSpaces(r.store_keep_amount)}đ` : '-'}
                        </TableCell>
                        <TableCell>
                          <div>{r.customers?.name || '-'}</div>
                          <div className="text-xs text-muted-foreground">{r.customers?.phone}</div>
                        </TableCell>
                        <TableCell>{r.branches?.name || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={r.fee_type === 'none' ? 'default' : 'secondary'}>
                            {r.fee_type === 'none' ? 'Hoàn đủ' : 'Mất phí'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
