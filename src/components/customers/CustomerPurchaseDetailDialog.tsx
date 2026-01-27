import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatNumber } from '@/lib/formatNumber';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { ShoppingBag, Calendar, Hash, Wallet, Star } from 'lucide-react';

interface PurchaseReceipt {
  id: string;
  code: string;
  export_date: string;
  total_amount: number;
  paid_amount: number;
  debt_amount: number;
  points_earned: number;
  points_redeemed: number;
  points_discount: number;
  status: string;
  branch_id: string | null;
  export_receipt_items: {
    id: string;
    product_name: string;
    sku: string;
    imei: string | null;
    sale_price: number;
    status: string;
    warranty?: string | null;
  }[];
}

interface CustomerPurchaseDetailDialogProps {
  receipt: PurchaseReceipt | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomerPurchaseDetailDialog({ 
  receipt, 
  open, 
  onOpenChange 
}: CustomerPurchaseDetailDialogProps) {
  if (!receipt) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Chi tiết đơn hàng {receipt.code}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Order Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Ngày mua</p>
                <p className="font-medium text-sm">
                  {format(new Date(receipt.export_date), 'dd/MM/yyyy HH:mm', { locale: vi })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Mã đơn</p>
                <p className="font-mono text-sm">{receipt.code}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Tổng tiền</p>
                <p className="font-medium text-sm">{formatNumber(receipt.total_amount)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Điểm tích</p>
                <p className="font-medium text-sm text-green-600">
                  +{receipt.points_earned || 0}
                </p>
              </div>
            </div>
          </div>

          {/* Payment Info */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">
              Đã thanh toán: {formatNumber(receipt.paid_amount)}
            </Badge>
            {receipt.debt_amount > 0 && (
              <Badge variant="destructive">
                Còn nợ: {formatNumber(receipt.debt_amount)}
              </Badge>
            )}
            {receipt.points_redeemed > 0 && (
              <Badge variant="secondary">
                Đổi {receipt.points_redeemed} điểm = -{formatNumber(receipt.points_discount)}
              </Badge>
            )}
            <Badge variant={receipt.status === 'completed' ? 'default' : 'secondary'}>
              {receipt.status === 'completed' ? 'Hoàn tất' : 'Đã hủy'}
            </Badge>
          </div>

          {/* Products Table */}
          <div>
            <h4 className="font-semibold mb-2">Danh sách sản phẩm ({receipt.export_receipt_items?.length || 0})</h4>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>STT</TableHead>
                    <TableHead>Sản phẩm</TableHead>
                    <TableHead>IMEI/Mã</TableHead>
                    <TableHead className="text-right">Giá bán</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receipt.export_receipt_items?.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-center">{index + 1}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.product_name}</p>
                          <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
                          {item.warranty && (
                            <p className="text-xs text-blue-600">BH: {item.warranty}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.imei ? (
                          <code className="text-sm bg-muted px-1.5 py-0.5 rounded">{item.imei}</code>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatNumber(item.sale_price)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Summary */}
          <div className="flex justify-end pt-2 border-t">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Tổng giá trị đơn hàng</p>
              <p className="text-xl font-bold">{formatNumber(receipt.total_amount)}</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
