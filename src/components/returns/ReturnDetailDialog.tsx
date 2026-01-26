import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Printer, Package, Truck, User, MapPin, Calendar, CreditCard, FileText } from 'lucide-react';
import { formatNumberWithSpaces } from '@/lib/formatNumber';
import { supabase } from '@/integrations/supabase/client';
import type { ImportReturn, ExportReturn, ReturnPayment } from '@/hooks/useReturns';

type ReturnItem = 
  | (ImportReturn & { type: 'import' })
  | (ExportReturn & { type: 'export' });

interface ReturnDetailDialogProps {
  returnItem: ReturnItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profiles?: { user_id: string; display_name: string }[];
}

export function ReturnDetailDialog({
  returnItem,
  open,
  onOpenChange,
  profiles,
}: ReturnDetailDialogProps) {
  const [payments, setPayments] = useState<ReturnPayment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (returnItem && open) {
      loadPayments();
    }
  }, [returnItem, open]);

  const loadPayments = async () => {
    if (!returnItem) return;
    setLoading(true);
    try {
      const returnType = returnItem.type === 'import' ? 'import_return' : 'export_return';
      const { data, error } = await supabase
        .from('return_payments')
        .select('*')
        .eq('return_id', returnItem.id)
        .eq('return_type', returnType);

      if (error) throw error;
      setPayments(data || []);
    } catch (error) {
      console.error('Error loading payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEmployeeName = (userId: string | null) => {
    if (!userId || !profiles) return '-';
    const profile = profiles.find((p) => p.user_id === userId);
    return profile?.display_name || '-';
  };

  const getPaymentSourceLabel = (source: string) => {
    const labels: Record<string, string> = {
      cash: 'Tiền mặt',
      bank_card: 'Thẻ ngân hàng',
      e_wallet: 'Ví điện tử',
      debt: 'Công nợ',
    };
    return labels[source] || source;
  };

  const handlePrint = () => {
    window.print();
  };

  if (!returnItem) return null;

  const isImportReturn = returnItem.type === 'import';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isImportReturn ? (
              <Truck className="h-5 w-5 text-orange-500" />
            ) : (
              <Package className="h-5 w-5 text-blue-500" />
            )}
            Chi tiết phiếu trả hàng
            <Badge variant={isImportReturn ? 'outline' : 'default'} className={isImportReturn ? 'border-orange-500 text-orange-500' : ''}>
              {isImportReturn ? 'Trả hàng nhập' : 'Trả hàng bán'}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Info */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <div className="text-sm text-muted-foreground">Mã phiếu</div>
              <div className="font-semibold">{returnItem.code}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Ngày trả</div>
              <div className="font-semibold flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {format(new Date(returnItem.return_date), 'dd/MM/yyyy HH:mm', { locale: vi })}
              </div>
            </div>
          </div>

          <Separator />

          {/* Product Info */}
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Package className="h-4 w-4" />
              Thông tin sản phẩm
            </h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Tên sản phẩm:</span>
                <div className="font-medium">{returnItem.product_name}</div>
              </div>
              <div>
                <span className="text-muted-foreground">SKU:</span>
                <div className="font-medium">{returnItem.sku}</div>
              </div>
              {returnItem.imei && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">IMEI:</span>
                  <div className="font-mono font-medium">{returnItem.imei}</div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Pricing Info */}
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Thông tin tài chính
            </h4>
            <div className="space-y-2 text-sm">
              {isImportReturn ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Giá nhập:</span>
                    <span className="font-medium">{formatNumberWithSpaces(returnItem.import_price)}đ</span>
                  </div>
                  <div className="flex justify-between text-lg font-semibold text-success">
                    <span>Tiền hoàn trả:</span>
                    <span>{formatNumberWithSpaces(returnItem.total_refund_amount)}đ</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Giá bán:</span>
                    <span className="font-medium">{formatNumberWithSpaces(returnItem.sale_price)}đ</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Giá nhập gốc:</span>
                    <span className="font-medium">{formatNumberWithSpaces(returnItem.import_price)}đ</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Hình thức:</span>
                    <Badge variant={returnItem.fee_type === 'none' ? 'default' : 'secondary'}>
                      {returnItem.fee_type === 'none' 
                        ? 'Hoàn đủ tiền' 
                        : returnItem.fee_type === 'percentage' 
                          ? `Mất ${returnItem.fee_percentage}%`
                          : `Mất ${formatNumberWithSpaces(returnItem.fee_amount)}đ`}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-lg font-semibold text-destructive">
                    <span>Tiền hoàn khách:</span>
                    <span>{formatNumberWithSpaces(returnItem.refund_amount)}đ</span>
                  </div>
                  {returnItem.store_keep_amount > 0 && (
                    <div className="flex justify-between text-success">
                      <span>Cửa hàng giữ lại:</span>
                      <span className="font-semibold">{formatNumberWithSpaces(returnItem.store_keep_amount)}đ</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <Separator />

          {/* Payment Sources */}
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Nguồn tiền
            </h4>
            {loading ? (
              <div className="text-sm text-muted-foreground">Đang tải...</div>
            ) : payments.length === 0 ? (
              <div className="text-sm text-muted-foreground">Không có thông tin nguồn tiền</div>
            ) : (
              <div className="space-y-2">
                {payments.map((payment) => (
                  <div key={payment.id} className="flex justify-between text-sm p-2 bg-muted/30 rounded">
                    <span>{getPaymentSourceLabel(payment.payment_source)}</span>
                    <span className="font-medium">{formatNumberWithSpaces(payment.amount)}đ</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Party Info */}
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <User className="h-4 w-4" />
              {isImportReturn ? 'Nhà cung cấp' : 'Khách hàng'}
            </h4>
            <div className="text-sm">
              {isImportReturn ? (
                <div>{returnItem.suppliers?.name || '-'}</div>
              ) : (
                <div>
                  <div className="font-medium">{returnItem.customers?.name || '-'}</div>
                  {returnItem.customers?.phone && (
                    <div className="text-muted-foreground">{returnItem.customers.phone}</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Branch & Employee */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Chi nhánh
              </h4>
              <div className="text-sm">{returnItem.branches?.name || '-'}</div>
            </div>
            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <User className="h-4 w-4" />
                Nhân viên xử lý
              </h4>
              <div className="text-sm">{getEmployeeName(returnItem.created_by)}</div>
            </div>
          </div>

          {/* Note */}
          {returnItem.note && (
            <>
              <Separator />
              <div>
                <h4 className="font-medium mb-2">Ghi chú</h4>
                <div className="text-sm text-muted-foreground">{returnItem.note}</div>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              In phiếu
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
