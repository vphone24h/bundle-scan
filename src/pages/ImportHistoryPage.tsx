import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useImportReceipts, useImportReceiptDetails, ImportReceipt } from '@/hooks/useImportReceipts';
import { useProducts } from '@/hooks/useProducts';
import { formatCurrency, formatDate } from '@/lib/mockData';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Search, Download, Calendar, FileText, MoreHorizontal, Eye, Pencil, RotateCcw, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export default function ImportHistoryPage() {
  const { data: receipts, isLoading: receiptsLoading } = useImportReceipts();
  const { data: products, isLoading: productsLoading } = useProducts();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const { data: receiptDetails, isLoading: detailsLoading } = useImportReceiptDetails(selectedReceiptId);

  const filteredReceipts = receipts?.filter(
    (r) =>
      r.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.suppliers?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const filteredProducts = products?.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.imei?.includes(searchTerm) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleView = (receipt: ImportReceipt) => {
    setSelectedReceiptId(receipt.id);
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
                  Chưa có phiếu nhập nào
                </div>
              )}
            </div>
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
                  Không tìm thấy sản phẩm nào
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
