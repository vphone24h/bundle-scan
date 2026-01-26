import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { ImportHistoryTable } from '@/components/import/ImportHistoryTable';
import { mockImportReceipts, mockProducts, formatCurrency, formatDate } from '@/lib/mockData';
import { ImportReceipt, Product } from '@/types/warehouse';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Search, Download, Calendar, FileText, MoreHorizontal, Pencil, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export default function ImportHistoryPage() {
  const [receipts] = useState<ImportReceipt[]>(mockImportReceipts);
  const [products] = useState<Product[]>(mockProducts);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<ImportReceipt | null>(null);

  const filteredReceipts = receipts.filter(
    (r) =>
      r.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.supplierName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.imei?.includes(searchTerm) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleView = (receipt: ImportReceipt) => {
    setSelectedReceipt(receipt);
  };

  const handleEdit = (receipt: ImportReceipt) => {
    console.log('Edit receipt:', receipt);
  };

  const handleReturn = (receipt: ImportReceipt) => {
    console.log('Return receipt:', receipt);
  };

  const handleExport = () => {
    console.log('Export to Excel');
  };

  return (
    <MainLayout>
      <PageHeader
        title="Lịch sử nhập hàng"
        description="Theo dõi các phiếu nhập và sản phẩm đã nhập"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Xuất Excel
            </Button>
            <Button asChild>
              <Link to="/import/new">
                <FileText className="mr-2 h-4 w-4" />
                Tạo phiếu mới
              </Link>
            </Button>
          </div>
        }
      />

      <div className="p-6 lg:p-8 space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm theo mã phiếu, tên sản phẩm, IMEI..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline">
            <Calendar className="mr-2 h-4 w-4" />
            Lọc theo ngày
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="receipts" className="space-y-4">
          <TabsList>
            <TabsTrigger value="receipts">Theo phiếu nhập</TabsTrigger>
            <TabsTrigger value="products">Theo sản phẩm</TabsTrigger>
          </TabsList>

          <TabsContent value="receipts">
            <ImportHistoryTable
              receipts={filteredReceipts}
              onView={handleView}
              onEdit={handleEdit}
              onReturn={handleReturn}
            />
          </TabsContent>

          <TabsContent value="products">
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
                    <th>Mã phiếu</th>
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
                      <td>{product.categoryName}</td>
                      <td className="text-right font-medium">
                        {formatCurrency(product.importPrice)}
                      </td>
                      <td>{formatDate(product.importDate)}</td>
                      <td>{product.supplierName}</td>
                      <td className="font-mono text-primary">
                        {product.importReceiptId || '-'}
                      </td>
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
                  Không tìm thấy sản phẩm nào
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Receipt Detail Dialog */}
      <Dialog open={!!selectedReceipt} onOpenChange={() => setSelectedReceipt(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chi tiết phiếu nhập {selectedReceipt?.code}</DialogTitle>
          </DialogHeader>

          {selectedReceipt && (
            <div className="space-y-6">
              {/* Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Ngày nhập:</span>
                  <span className="ml-2 font-medium">
                    {formatDate(selectedReceipt.importDate)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Nhà cung cấp:</span>
                  <span className="ml-2 font-medium">{selectedReceipt.supplierName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Người tạo:</span>
                  <span className="ml-2 font-medium">{selectedReceipt.createdBy}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Trạng thái:</span>
                  <Badge
                    className={cn(
                      'ml-2',
                      selectedReceipt.status === 'completed'
                        ? 'status-in-stock'
                        : 'bg-destructive/10 text-destructive'
                    )}
                  >
                    {selectedReceipt.status === 'completed' ? 'Hoàn tất' : 'Đã huỷ'}
                  </Badge>
                </div>
              </div>

              {/* Products */}
              <div>
                <h4 className="font-semibold mb-3">Danh sách sản phẩm ({selectedReceipt.items.length})</h4>
                <div className="border rounded-lg divide-y">
                  {selectedReceipt.items.map((item) => (
                    <div key={item.id} className="p-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium">{item.productName}</p>
                        <p className="text-xs text-muted-foreground">
                          SKU: {item.sku}
                          {item.imei && ` • IMEI: ${item.imei}`}
                        </p>
                      </div>
                      <p className="font-medium">{formatCurrency(item.importPrice)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment */}
              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Tổng tiền:</span>
                  <span className="font-bold">{formatCurrency(selectedReceipt.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Đã thanh toán:</span>
                  <span className="text-success font-medium">
                    {formatCurrency(selectedReceipt.paidAmount)}
                  </span>
                </div>
                {selectedReceipt.debtAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Còn nợ:</span>
                    <span className="text-destructive font-medium">
                      {formatCurrency(selectedReceipt.debtAmount)}
                    </span>
                  </div>
                )}
                <div className="pt-2 border-t text-xs text-muted-foreground">
                  Thanh toán:{' '}
                  {selectedReceipt.payments.map((p) => (
                    <span key={p.type} className="mr-2">
                      {p.type === 'cash'
                        ? 'Tiền mặt'
                        : p.type === 'bank_card'
                        ? 'Thẻ NH'
                        : p.type === 'e_wallet'
                        ? 'Ví ĐT'
                        : 'Công nợ'}
                      : {formatCurrency(p.amount)}
                    </span>
                  ))}
                </div>
              </div>

              {selectedReceipt.note && (
                <div>
                  <h4 className="font-semibold mb-2">Ghi chú</h4>
                  <p className="text-sm text-muted-foreground">{selectedReceipt.note}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
