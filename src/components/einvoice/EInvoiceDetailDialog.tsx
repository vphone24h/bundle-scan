import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { EInvoice, EInvoiceStatus } from '@/hooks/useEInvoice';
import { formatNumber } from '@/lib/formatNumber';

interface EInvoiceDetailDialogProps {
  invoice: EInvoice;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_LABELS: Record<EInvoiceStatus, string> = {
  draft: 'Nháp',
  pending: 'Đang xử lý',
  issued: 'Đã phát hành',
  cancelled: 'Đã huỷ',
  adjusted: 'Điều chỉnh',
  error: 'Lỗi',
};

export function EInvoiceDetailDialog({ invoice, open, onOpenChange }: EInvoiceDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Hoá đơn {invoice.invoice_series}/{invoice.invoice_number || 'Chưa cấp số'}
            <Badge>{STATUS_LABELS[invoice.status]}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Invoice Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Ngày hoá đơn</div>
              <div className="font-medium">
                {format(new Date(invoice.invoice_date), 'dd/MM/yyyy HH:mm', { locale: vi })}
              </div>
            </div>
            {invoice.lookup_code && (
              <div>
                <div className="text-muted-foreground">Mã tra cứu</div>
                <div className="font-medium font-mono">{invoice.lookup_code}</div>
              </div>
            )}
          </div>

          <Separator />

          {/* Customer Info */}
          <div>
            <h4 className="font-medium mb-2">Thông tin khách hàng</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Tên khách hàng</div>
                <div className="font-medium">{invoice.customer_name}</div>
              </div>
              {invoice.customer_tax_code && (
                <div>
                  <div className="text-muted-foreground">Mã số thuế</div>
                  <div className="font-medium">{invoice.customer_tax_code}</div>
                </div>
              )}
              {invoice.customer_address && (
                <div className="col-span-2">
                  <div className="text-muted-foreground">Địa chỉ</div>
                  <div className="font-medium">{invoice.customer_address}</div>
                </div>
              )}
              {invoice.customer_email && (
                <div>
                  <div className="text-muted-foreground">Email</div>
                  <div className="font-medium">{invoice.customer_email}</div>
                </div>
              )}
              {invoice.customer_phone && (
                <div>
                  <div className="text-muted-foreground">Điện thoại</div>
                  <div className="font-medium">{invoice.customer_phone}</div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Items */}
          <div>
            <h4 className="font-medium mb-2">Chi tiết hàng hoá</h4>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">STT</TableHead>
                    <TableHead>Tên hàng hoá</TableHead>
                    <TableHead className="text-right">SL</TableHead>
                    <TableHead className="text-right">Đơn giá</TableHead>
                    <TableHead className="text-right">Thành tiền</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.einvoice_items?.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>
                        <div>{item.product_name}</div>
                        {item.product_code && (
                          <div className="text-xs text-muted-foreground">
                            Mã: {item.product_code}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.quantity} {item.unit}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(item.unit_price)}đ
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(item.amount)}đ
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-full max-w-xs space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tiền chưa thuế:</span>
                <span>{formatNumber(invoice.subtotal)}đ</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Thuế GTGT ({invoice.vat_rate}%):</span>
                <span>{formatNumber(invoice.vat_amount)}đ</span>
              </div>
              <Separator />
              <div className="flex justify-between font-medium text-base">
                <span>Tổng cộng:</span>
                <span>{formatNumber(invoice.total_amount)}đ</span>
              </div>
              {invoice.amount_in_words && (
                <div className="text-xs text-muted-foreground italic">
                  Bằng chữ: {invoice.amount_in_words}
                </div>
              )}
            </div>
          </div>

          {/* Error Message */}
          {invoice.error_message && (
            <>
              <Separator />
              <div className="p-4 bg-destructive/10 rounded-md">
                <div className="text-sm font-medium text-destructive">Thông báo lỗi:</div>
                <div className="text-sm text-destructive/80">{invoice.error_message}</div>
              </div>
            </>
          )}

          {/* Cancellation Info */}
          {invoice.status === 'cancelled' && invoice.adjustment_reason && (
            <>
              <Separator />
              <div className="p-4 bg-muted rounded-md">
                <div className="text-sm font-medium">Lý do huỷ:</div>
                <div className="text-sm text-muted-foreground">{invoice.adjustment_reason}</div>
                {invoice.cancelled_at && (
                  <div className="text-xs text-muted-foreground mt-2">
                    Huỷ lúc: {format(new Date(invoice.cancelled_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
